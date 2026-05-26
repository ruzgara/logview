import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import ConnectionsTable from './components/ConnectionsTable'
import EntityPanel from './components/EntityPanel'
import type { ConnectionRecord, RouterRecord, ServiceRecord } from './types'
import ConnectionGlobe from './components/ConnectionGlobe'
import AuthScreen from './components/AuthScreen'
import { pb } from './pocketbase'


const CONNECTIONS_LIMIT = 200
const THEME_STORAGE_KEY = 'logview-theme'

type Theme = 'light' | 'dark'

const getPreferredTheme = (): Theme =>
  typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'

type RealtimeEvent = {
  action: 'create' | 'update' | 'delete'
  record: ConnectionRecord
}

const sortByName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name)

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [connections, setConnections] = useState<ConnectionRecord[]>([])
  const [routers, setRouters] = useState<RouterRecord[]>([])
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [globeEvents, setGlobeEvents] = useState<ConnectionRecord[]>([])
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'light'
    }
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : getPreferredTheme()
  })
  const [detailModal, setDetailModal] = useState<{
    type: 'router' | 'service'
    id: string
    name: string
  } | null>(null)
  const [detailEvents, setDetailEvents] = useState<ConnectionRecord[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<
    'connecting' | 'connected' | 'error'
  >('connecting')
  const [realtimeError, setRealtimeError] = useState<string | null>(null)
  const [alertExpanded, setAlertExpanded] = useState(false)

  const routerMapRef = useRef<Record<string, string>>({})
  const serviceMapRef = useRef<Record<string, string>>({})
  const detailRequestRef = useRef(0)
  const globeQueueRef = useRef<ConnectionRecord[]>([])
  const globeFlushRef = useRef<number | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? 'dark' : 'light')
    }

    if (media.addEventListener) {
      media.addEventListener('change', handleChange)
    } else {
      media.addListener(handleChange)
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', handleChange)
      } else {
        media.removeListener(handleChange)
      }
    }
  }, [])

  const routerNameById = useMemo(
    () =>
      Object.fromEntries(routers.map((router) => [router.id, router.name])),
    [routers],
  )

  const serviceNameById = useMemo(
    () =>
      Object.fromEntries(services.map((service) => [service.id, service.name])),
    [services],
  )

  useEffect(() => {
    routerMapRef.current = routerNameById
  }, [routerNameById])

  useEffect(() => {
    serviceMapRef.current = serviceNameById
  }, [serviceNameById])

  useEffect(() => {
    let isMounted = true

    const loadInitial = async () => {
      try {
        const [routerData, serviceData, connectionData] = await Promise.all([
          pb.collection('routers').getList<RouterRecord>(1, 200, {
            sort: 'name',
          }),
          pb.collection('services').getList<ServiceRecord>(1, 200, {
            sort: 'name',
          }),
          pb.collection('connections').getList<ConnectionRecord>(
            1,
            CONNECTIONS_LIMIT,
            {
              sort: '-created',
            },
          ),
        ])

        if (!isMounted) {
          return
        }

        setRouters(routerData.items.sort(sortByName))
        setServices(serviceData.items.sort(sortByName))
        setConnections(connectionData.items)
      } catch (error) {
        if (!isMounted) {
          return
        }
        const message =
          error instanceof Error ? error.message : 'Failed to load data.'
        setDataError(message)
      }
    }

    loadInitial()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    let unsubscribe: (() => Promise<void>) | null = null

    const ensureRouter = async (id?: string) => {
      if (!id || routerMapRef.current[id]) {
        return
      }

      try {
        const router = await pb.collection('routers').getOne<RouterRecord>(id)
        setRouters((prev) => {
          if (prev.some((item) => item.id === router.id)) {
            return prev
          }
          return [...prev, router].sort(sortByName)
        })
      } catch (error) {
        if (!isMounted) {
          return
        }
        const message =
          error instanceof Error ? error.message : 'Failed to load router.'
        setDataError(message)
      }
    }

    const ensureService = async (id?: string) => {
      if (!id || serviceMapRef.current[id]) {
        return
      }

      try {
        const service = await pb
          .collection('services')
          .getOne<ServiceRecord>(id)
        setServices((prev) => {
          if (prev.some((item) => item.id === service.id)) {
            return prev
          }
          return [...prev, service].sort(sortByName)
        })
      } catch (error) {
        if (!isMounted) {
          return
        }
        const message =
          error instanceof Error ? error.message : 'Failed to load service.'
        setDataError(message)
      }
    }

    const connectRealtime = async () => {
      setRealtimeStatus('connecting')
      try {
        unsubscribe = await pb
          .collection('connections')
          .subscribe('*', (event) => {
            const payload = event as RealtimeEvent
            const { action, record } = payload

            if (action === 'delete') {
              setConnections((prev) =>
                prev.filter((item) => item.id !== record.id),
              )
              return
            }

            if (action === 'create') {
              globeQueueRef.current.push(record)
              if (globeFlushRef.current === null) {
                globeFlushRef.current = window.requestAnimationFrame(() => {
                  globeFlushRef.current = null
                  const nextBatch = globeQueueRef.current.splice(0)
                  if (nextBatch.length > 0) {
                    setGlobeEvents(nextBatch)
                  }
                })
              }
            }

            setConnections((prev) => {
              const existingIndex = prev.findIndex(
                (item) => item.id === record.id,
              )
              if (existingIndex === -1) {
                const next = [record, ...prev]
                return next.slice(0, CONNECTIONS_LIMIT)
              }
              const next = [...prev]
              next[existingIndex] = { ...next[existingIndex], ...record }
              return next
            })

            void ensureRouter(record.router)
            void ensureService(record.service)
          })

        if (!isMounted) {
          return
        }
        setRealtimeStatus('connected')
        setRealtimeError(null)
      } catch (error) {
        if (!isMounted) {
          return
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to subscribe to realtime.'
        setRealtimeStatus('error')
        setRealtimeError(message)
      }
    }

    pb.realtime.onDisconnect = (activeSubscriptions) => {
      if (!isMounted || activeSubscriptions.length === 0) {
        return
      }
      setRealtimeStatus('error')
      setRealtimeError('Realtime connection was interrupted.')
    }

    void connectRealtime()

    return () => {
      isMounted = false
      void unsubscribe?.()
      if (globeFlushRef.current !== null) {
        window.cancelAnimationFrame(globeFlushRef.current)
        globeFlushRef.current = null
      }
      pb.realtime.onDisconnect = undefined
    }
  }, [])

  const closeDetail = () => {
    detailRequestRef.current += 1
    setDetailModal(null)
    setDetailEvents([])
    setDetailError(null)
    setDetailLoading(false)
  }

  const openDetail = async (type: 'router' | 'service', id?: string) => {
    if (!id) {
      return
    }

    const name =
      type === 'router'
        ? routerNameById[id] ?? id
        : serviceNameById[id] ?? id

    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    setDetailModal({ type, id, name })
    setDetailEvents([])
    setDetailError(null)
    setDetailLoading(true)

    try {
      const perPage = 200
      const filter =
        type === 'router' ? `router = "${id}"` : `service = "${id}"`
      let page = 1
      let items: ConnectionRecord[] = []

      while (true) {
        const result = await pb
          .collection('connections')
          .getList<ConnectionRecord>(page, perPage, {
            filter,
            sort: '-created',
          })
        items = [...items, ...result.items]
        if (result.items.length < perPage) {
          break
        }
        page += 1
      }

      if (detailRequestRef.current !== requestId) {
        return
      }

      setDetailEvents(items)
    } catch (error) {
      if (detailRequestRef.current !== requestId) {
        return
      }
      const message =
        error instanceof Error ? error.message : 'Failed to load events.'
      setDetailError(message)
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false)
      }
    }
  }

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  return (
    <div className="dashboard">
      <header className="header">
        <div className="header-copy">
          <h1>LogView Dashboard</h1>
          <p className="subtitle">Streaming network activity</p>
        </div>
        <section className="globe-hero" aria-label="Connection globe">
          <ConnectionGlobe
            connections={globeEvents}
            serverCountry="JP"
            theme={theme}
          />
        </section>
        <div className="header-actions">
          <div className="status">
            <div className="status-line">
              {(dataError || realtimeError) && (
                <div className="alert-icon-container">
                  <button
                    type="button"
                    className="alert-icon"
                    onClick={() => setAlertExpanded(!alertExpanded)}
                    aria-label={alertExpanded ? 'Hide alert' : 'Show alert'}
                    aria-expanded={alertExpanded}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                  {alertExpanded && (
                    <div className="alert-expanded" role="alert">
                      {dataError ?? realtimeError}
                    </div>
                  )}
                </div>
              )}
              <div className="theme-switch">
                <input
                  type="checkbox"
                  className="checkbox"
                  id="theme-toggle"
                  checked={theme === 'dark'}
                  onChange={toggleTheme}
                  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'
                    } mode`}
                />
                <label htmlFor="theme-toggle" className="label">
                  <svg
                    className="moon"
                    width="24"
                    height="24"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3 11.5066C3 16.7497 7.25034 21 12.4934 21C16.2209 21 19.4466 18.8518 21 15.7259C12.4934 15.7259 8.27411 11.5066 8.27411 3C5.14821 4.55344 3 7.77915 3 11.5066Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <svg
                    className="sun"
                    width="24"
                    height="24"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M22 12L23 12"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 2V1"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 23V22"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20 20L19 19"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20 4L19 5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 20L5 19"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 4L5 5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M1 12L2 12"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="ball" />
                </label>
              </div>
              <span className={`status-pill ${realtimeStatus}`}>
                {realtimeStatus === 'connected' ? 'Live' : 'Offline'}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={onSignOut}
              >
                Sign out
              </button>
            </div>
            <span className="status-metrics">
              {connections.length} connections · {routers.length} routers ·{' '}
              {services.length} services
            </span>
          </div>
        </div>
      </header>

      <div className="content-grid">
        <div className="feed-column">
          <section className="connections">
            <div className="connections-table-header">
              <div className="header-cell">Time</div>
              <div className="header-cell ip">IP</div>
              <div className="header-cell country">Country</div>
              <div className="header-cell">Details</div>
              <div className="header-cell router">Router</div>
              <div className="header-cell service">Service</div>
            </div>
            <ConnectionsTable
              connections={connections}
              routerNameById={routerNameById}
              serviceNameById={serviceNameById}
              onOpenDetail={openDetail}
              containerClassName="connections-list"
              showHeader={false}
            />
          </section>
        </div>

        <aside className="panels">
          <EntityPanel
            title="Routers"
            count={routers.length}
            items={routers}
            idPrefix="router"
            onSelect={(id) => openDetail('router', id)}
          />
          <EntityPanel
            title="Services"
            count={services.length}
            items={services}
            idPrefix="service"
            onSelect={(id) => openDetail('service', id)}
          />
        </aside>
      </div>

      {detailModal && (
        <div className="modal-backdrop" onClick={closeDetail}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{detailModal.name}</h2>
                <p className="modal-subtitle">
                  {detailModal.type === 'router'
                    ? 'Router events'
                    : 'Service events'}{' '}
                  · {detailEvents.length} total
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeDetail}
              >
                Close
              </button>
            </div>
            <div className="modal-body">
              {detailLoading && (
                <div className="modal-state">Loading events…</div>
              )}
              {!detailLoading && detailError && (
                <div className="modal-state" role="alert">
                  {detailError}
                </div>
              )}
              {!detailLoading && !detailError && (
                <div className="detail-table">
                  <div className="connections-table-header">
                    <div className="header-cell">Time</div>
                    <div className="header-cell ip">IP</div>
                    <div className="header-cell country">Country</div>
                    <div className="header-cell">Details</div>
                    <div className="header-cell router">Router</div>
                    <div className="header-cell service">Service</div>
                  </div>
                  <ConnectionsTable
                    connections={detailEvents}
                    routerNameById={routerNameById}
                    serviceNameById={serviceNameById}
                    onOpenDetail={openDetail}
                    containerClassName="detail-list"
                    showHeader={false}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => pb.authStore.isValid,
  )

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => {
      setIsAuthenticated(pb.authStore.isValid)
    }, true)

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

  const handleSignOut = () => {
    pb.authStore.clear()
  }

  if (!isAuthenticated) {
    return <AuthScreen />
  }

  return <Dashboard onSignOut={handleSignOut} />
}

export default App
