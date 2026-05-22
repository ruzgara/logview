import { useEffect, useRef } from 'react'

import type { ConnectionRecord } from '../types'

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

type ConnectionsTableProps = {
  connections: ConnectionRecord[]
  routerNameById: Record<string, string>
  serviceNameById: Record<string, string>
  onOpenDetail: (type: 'router' | 'service', id?: string) => void
  containerClassName?: string
}

function ConnectionsTable({
  connections,
  routerNameById,
  serviceNameById,
  onOpenDetail,
  containerClassName = 'connections-list',
}: ConnectionsTableProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const stickToTopRef = useRef(true)

  const handleScroll = () => {
    const container = listRef.current
    if (!container) {
      return
    }
    stickToTopRef.current = container.scrollTop < 20
  }

  useEffect(() => {
    const container = listRef.current
    if (!container || !stickToTopRef.current) {
      return
    }
    container.scrollTop = 0
  }, [connections])

  const handleRouterClick = (id?: string) => {
    onOpenDetail('router', id)
  }

  const handleServiceClick = (id?: string) => {
    onOpenDetail('service', id)
  }

  const formatTime = (value?: string) =>
    value ? timeFormatter.format(new Date(value)) : '--:--:--'

  const buildDetails = (connection: ConnectionRecord) => {
    const parts = [connection.address, connection.path].filter(
      (value): value is string => Boolean(value && value.trim()),
    )
    return parts.length ? parts.join(' · ') : '—'
  }

  return (
    <div className={containerClassName} ref={listRef} onScroll={handleScroll}>
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
              {formatTime(connection.created)}
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
              onClick={() => handleRouterClick(connection.router)}
              disabled={!connection.router}
            >
              {routerName}
            </button>
            <button
              type="button"
              className="connection-cell link-button service"
              onClick={() => handleServiceClick(connection.service)}
              disabled={!connection.service}
            >
              {serviceName}
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default ConnectionsTable
