import { useEffect, useMemo, useRef, useState } from 'react'
import PocketBase from 'pocketbase'
import './App.css'

const PB_URL = import.meta.env.VITE_PB_URL ?? 'http://127.0.0.1:8090'
const PB_TOKEN = import.meta.env.VITE_PB_TOKEN as string | undefined
const CONNECTIONS_LIMIT = 200
const THEME_STORAGE_KEY = 'logview-theme'

const pb = new PocketBase(PB_URL)
if (PB_TOKEN) {
  pb.authStore.save(PB_TOKEN, null)
}

type Theme = 'light' | 'dark'

const getPreferredTheme = (): Theme =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'

type ConnectionRecord = {
  id: string
  real_ip?: string
  country?: string
  address?: string
  path?: string
  router?: string
  service?: string
  created?: string
}

type RouterRecord = {
  id: string
  name: string
}

type ServiceRecord = {
  id: string
  name: string
}

type RealtimeEvent = {
  action: 'create' | 'update' | 'delete'
  record: ConnectionRecord
}

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const sortByName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name)

const buildDetails = (connection: ConnectionRecord) => {
  const parts = [connection.address, connection.path].filter(
    (value): value is string => Boolean(value && value.trim()),
  )
  return parts.length ? parts.join(' · ') : '—'
}

function App() {
  const [connections, setConnections] = useState<ConnectionRecord[]>([])
  const [routers, setRouters] = useState<RouterRecord[]>([])
  const [services, setServices] = useState<ServiceRecord[]>([])
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

  const listRef = useRef<HTMLDivElement | null>(null)
  const stickToTopRef = useRef(true)
  const routerMapRef = useRef<Record<string, string>>({})
  const serviceMapRef = useRef<Record<string, string>>({})
  const detailRequestRef = useRef(0)

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
      if (!PB_TOKEN) {
        setDataError('Missing VITE_PB_TOKEN for PocketBase authorization.')
        setRealtimeStatus('error')
        setRealtimeError('Missing VITE_PB_TOKEN for realtime connection.')
        return
      }

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
    const container = listRef.current
    if (!container || !stickToTopRef.current) {
      return
    }
    container.scrollTop = 0
  }, [connections])

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
      if (!PB_TOKEN) {
        return
      }
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
      pb.realtime.onDisconnect = undefined
    }
  }, [])

  const handleScroll = () => {
    const container = listRef.current
    if (!container) {
      return
    }
    stickToTopRef.current = container.scrollTop < 20
  }

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

    if (!PB_TOKEN) {
      setDetailModal({
        type,
        id,
        name: type === 'router' ? id : id,
      })
      setDetailEvents([])
      setDetailLoading(false)
      setDetailError('Missing VITE_PB_TOKEN for PocketBase authorization.')
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
        <div>
          <h1>Live Connections</h1>
          <p className="subtitle">Streaming PocketBase activity</p>
        </div>
        <div className="header-actions">
          <div className="status">
            <div className="status-line">
              <div className="theme-switch">
                <input
                  type="checkbox"
                  className="checkbox"
                  id="theme-toggle"
                  checked={theme === 'dark'}
                  onChange={toggleTheme}
                  aria-label={`Switch to ${
                    theme === 'dark' ? 'light' : 'dark'
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
            </div>
            <span className="status-metrics">
              {connections.length} connections · {routers.length} routers ·{' '}
              {services.length} services
            </span>
          </div>
        </div>
      </header>

      {(dataError || realtimeError) && (
        <div className="banner" role="alert">
          {dataError ?? realtimeError}
        </div>
      )}

      <div className="workspace">
        <section className="placeholder-card" aria-label="Placeholder">
          <div className="placeholder-copy">Placeholder</div>
        </section>

        <div className="content-grid">
        <section className="connections">
          <div className="connections-header">
            <h2>Connections feed</h2>
            <span>Newest events appear at the top</span>
          </div>
          <div
            className="connections-list"
            ref={listRef}
            onScroll={handleScroll}
          >
            <div className="connections-table-header">
              <div className="header-cell">Time</div>
              <div className="header-cell ip">IP</div>
              <div className="header-cell country">Country</div>
              <div className="header-cell">Details</div>
              <div className="header-cell router">Router</div>
              <div className="header-cell service">Service</div>
            </div>
            {connections.map((connection) => {
              const routerName =
                (connection.router && routerNameById[connection.router]) ||
                connection.router ||
                'Unknown router'
              const serviceName =
                (connection.service && serviceNameById[connection.service]) ||
                connection.service ||
                'Unknown service'
              const details = buildDetails(connection)

              return (
                <div className="connection-row" key={connection.id}>
                  <div className="connection-cell time">
                    {connection.created
                      ? timeFormatter.format(new Date(connection.created))
                      : '--:--:--'}
                  </div>
                  <div className="connection-cell ip">
                    {connection.real_ip || '—'}
                  </div>
                  <div className="connection-cell country">
                    {connection.country || '—'}
                  </div>
                  <div className="connection-cell details" title={details}>
                    {details}
                  </div>
                  <button
                    type="button"
                    className="connection-cell link-button router"
                    onClick={() => openDetail('router', connection.router)}
                    disabled={!connection.router}
                  >
                    {routerName}
                  </button>
                  <button
                    type="button"
                    className="connection-cell link-button service"
                    onClick={() => openDetail('service', connection.service)}
                    disabled={!connection.service}
                  >
                    {serviceName}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        <aside className="panels">
          <section className="panel">
            <div className="panel-header">
              <h2>Routers</h2>
              <span>{routers.length}</span>
            </div>
            <div className="panel-list">
              {routers.map((router) => (
                <button
                  key={router.id}
                  id={`router-${router.id}`}
                  type="button"
                  className="panel-item"
                  onClick={() => openDetail('router', router.id)}
                >
                  {router.name}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Services</h2>
              <span>{services.length}</span>
            </div>
            <div className="panel-list">
              {services.map((service) => (
                <button
                  key={service.id}
                  id={`service-${service.id}`}
                  type="button"
                  className="panel-item"
                  onClick={() => openDetail('service', service.id)}
                >
                  {service.name}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
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
                <div className="detail-list">
                  <div className="connections-table-header">
                    <div className="header-cell">Time</div>
                    <div className="header-cell ip">IP</div>
                    <div className="header-cell country">Country</div>
                    <div className="header-cell">Details</div>
                    <div className="header-cell router">Router</div>
                    <div className="header-cell service">Service</div>
                  </div>
                  {detailEvents.map((connection) => {
                    const routerName =
                      (connection.router &&
                        routerNameById[connection.router]) ||
                      connection.router ||
                      'Unknown router'
                    const serviceName =
                      (connection.service &&
                        serviceNameById[connection.service]) ||
                      connection.service ||
                      'Unknown service'
                    const details = buildDetails(connection)

                    return (
                      <div className="connection-row" key={connection.id}>
                        <div className="connection-cell time">
                          {connection.created
                            ? timeFormatter.format(
                                new Date(connection.created),
                              )
                            : '--:--:--'}
                        </div>
                        <div className="connection-cell ip">
                          {connection.real_ip || '—'}
                        </div>
                        <div className="connection-cell country">
                          {connection.country || '—'}
                        </div>
                        <div className="connection-cell details" title={details}>
                          {details}
                        </div>
                        <button
                          type="button"
                          className="connection-cell link-button router"
                          onClick={() =>
                            openDetail('router', connection.router)
                          }
                          disabled={!connection.router}
                        >
                          {routerName}
                        </button>
                        <button
                          type="button"
                          className="connection-cell link-button service"
                          onClick={() =>
                            openDetail('service', connection.service)
                          }
                          disabled={!connection.service}
                        >
                          {serviceName}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
