import { useEffect, useMemo, useRef, useState } from 'react'
import { TriangleAlert} from 'lucide-react'
import './App.css'
import ConnectionsTable from './components/ConnectionsTable'
import EntityPanel from './components/EntityPanel'
import type { ConnectionRecord, RouterRecord, ServiceRecord } from './types'
import ConnectionGlobe from './components/ConnectionGlobe'
import ServerLocationModal, { type ServerLocation } from './components/ServerLocationModal'
import AgentManagementModal from './components/AgentManagementModal'
import AgentCreateForm from './components/AgentCreateForm'
import Modal from './components/Modal'
import ThemeToggle from './components/ThemeToggle'
import SettingsMenu from './components/SettingsMenu'
import { pb } from './pocketbase'
import { useAuth, type AuthUser } from './auth-context'
import { AuthScreen } from './components/AuthScreen'

const TABLE_HEADERS = (
  <>
    <div className="header-cell">Time</div>
    <div className="header-cell ip">IP</div>
    <div className="header-cell country">Country</div>
    <div className="header-cell">Details</div>
    <div className="header-cell router">Router</div>
    <div className="header-cell service">Service</div>
  </>
)


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

function Dashboard({ user }: { user: AuthUser }) {
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
  const [serverLocation, setServerLocation] = useState<ServerLocation>({})
  const [locationConfigured, setLocationConfigured] = useState(false)
  const [settingsRecordId, setSettingsRecordId] = useState('')
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [agentModalOpen, setAgentModalOpen] = useState(false)
  const [agentCount, setAgentCount] = useState(0)
  const [agentCountLoading, setAgentCountLoading] = useState(true)

  const routerMapRef = useRef<Record<string, string>>({})
  const serviceMapRef = useRef<Record<string, string>>({})
  const detailRequestRef = useRef(0)
  const globeQueueRef = useRef<ConnectionRecord[]>([])
  const globeFlushRef = useRef<number | null>(null)

  const { signOut } = useAuth()

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

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    pb.collection('agents')
      .getList(1, 1, { fields: 'id' })
      .then((result) => setAgentCount(result.totalItems))
      .catch(() => {})
      .finally(() => setAgentCountLoading(false))
  }, [agentModalOpen])

  useEffect(() => {
    pb.collection('settings')
      .getFirstListItem('key = "server_location"')
      .then((rec) => {
        setSettingsRecordId(rec.id)
        const val = rec.value as Record<string, string> | string
        if (typeof val === 'object' && val.country_code) {
          setServerLocation({ country: val.country_code })
          setLocationConfigured(true)
        } else if (typeof val === 'object' && val.lat_long) {
          const [lat, lng] = val.lat_long.split(',').map(Number)
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setServerLocation({ lat, lng })
            setLocationConfigured(true)
          }
        }
      })
      .catch(() => {})
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
            serverCountry={serverLocation.country}
            serverLat={serverLocation.lat}
            serverLng={serverLocation.lng}
            theme={theme}
          />
        </section>
        <div className="header-actions">
          <div className="status">
            <div className="status-line">
              <SettingsMenu
                userEmail={user.email}
                locationConfigured={locationConfigured}
                onOpenLocationModal={() => setLocationModalOpen(true)}
                onOpenAgentModal={() => setAgentModalOpen(true)}
                onSignOut={signOut}
              />
              {(dataError || realtimeError) && (
                <div className="alert-icon-container">
                  <button
                    type="button"
                    className="alert-icon"
                    onClick={() => setAlertExpanded(!alertExpanded)}
                    aria-label={alertExpanded ? 'Hide alert' : 'Show alert'}
                    aria-expanded={alertExpanded}
                  >
                    <TriangleAlert size={20} />
                  </button>
                  {alertExpanded && (
                    <div className="alert-expanded" role="alert">
                      {dataError ?? realtimeError}
                    </div>
                  )}
                </div>
              )}
              <ThemeToggle theme={theme} onChange={toggleTheme} />
              <span className={`status-pill ${realtimeStatus}`}>
                {realtimeStatus === 'connected' ? 'Live' : 'Offline'}
              </span>
            </div>
            <span className="status-metrics">
              {agentCount} agents · {routers.length} routers ·{' '}
              {services.length} services
            </span>
          </div>
        </div>
      </header>

      {!agentCountLoading && agentCount === 0 ? (
        <div className="welcome-card-wrapper">
          <div className="welcome-card">
            <h2 className="welcome-title">Welcome to LogView</h2>
            <p className="welcome-subtitle">
              Create your first agent to start ingesting traffic data.
            </p>
            <AgentCreateForm onCreated={() => setAgentCount((n) => n + 1)} />
          </div>
        </div>
      ) : (
        <div className="content-grid">
          <div className="feed-column">
            <section className="connections">
              <div className="connections-table-header">{TABLE_HEADERS}</div>
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
      )}

      {locationModalOpen && (
        <ServerLocationModal
          current={serverLocation}
          recordId={settingsRecordId}
          onSave={(loc) => {
            setServerLocation(loc)
            setLocationConfigured(true)
            setLocationModalOpen(false)
          }}
          onClose={() => setLocationModalOpen(false)}
        />
      )}

      {agentModalOpen && (
        <AgentManagementModal
          onClose={() => setAgentModalOpen(false)}
        />
      )}

      {detailModal && (
        <Modal
          title={detailModal.name}
          subtitle={`${detailModal.type === 'router' ? 'Router events' : 'Service events'} · ${detailEvents.length} total`}
          onClose={closeDetail}
        >
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
              <div className="connections-table-header">{TABLE_HEADERS}</div>
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
        </Modal>
      )}
    </div>
  )
}

function App() {
  const { user, isAuthenticated, isInitializing } = useAuth()

  if (isInitializing) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="auth-loading">Loading…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <AuthScreen />
  }

  return <Dashboard user={user} />
}

export default App
