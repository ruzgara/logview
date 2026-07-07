import { useEffect, useRef, useState } from 'react'
import { Cog } from 'lucide-react'

type Props = {
  userEmail: string
  locationConfigured: boolean
  onOpenLocationModal: () => void
  onOpenAgentModal: () => void
  onSignOut: () => void
}

function SettingsMenu({ userEmail, locationConfigured, onOpenLocationModal, onOpenAgentModal, onSignOut }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="settings-container" ref={containerRef}>
      <button
        type="button"
        className="settings-icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings menu"
        aria-expanded={open}
      >
        <Cog size={20} />
      </button>
      {open && (
        <div className="settings-dropdown">
          <div className="settings-section">
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => { setOpen(false); onOpenAgentModal(); }}
            >
              Manage Agents
            </button>
          </div>
          <div className="settings-section">
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => { setOpen(false); onOpenLocationModal(); }}
            >
              Server Location
              {!locationConfigured && (
                <span className="btn-hint">not set</span>
              )}
            </button>
          </div>
          <div className="settings-divider" />
          <div className="settings-section settings-user">
            <span className="settings-email">{userEmail}</span>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={onSignOut}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsMenu;