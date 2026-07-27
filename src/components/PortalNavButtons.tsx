import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Home, LogOut } from 'lucide-react'
import type { PortalId } from '../utils/portalSession'

/** Shared height/padding for portal header action buttons (dropdown, bell, home, Logout). */
export const HEADER_ACTION_BTN =
  'inline-flex items-center justify-center gap-2 h-9 px-3 md:px-4 rounded-lg font-semibold transition-colors text-sm shrink-0'

const PORTAL_LABELS: Record<'admin' | 'coach' | 'member', string> = {
  admin: 'Admin',
  coach: 'Coach',
  member: 'Member',
}

const PORTAL_ORDER: Array<'admin' | 'coach' | 'member'> = ['admin', 'coach', 'member']

interface PortalNavButtonsProps {
  activePortal: 'admin' | 'coach' | 'member'
  availablePortals?: PortalId[]
  onSwitchPortal?: (portal: 'admin' | 'coach' | 'member' | 'website') => void
  onLogout: () => void
  /** Rendered between home and Logout (notification bell). */
  notifications?: ReactNode
}

export default function PortalNavButtons({
  activePortal,
  availablePortals = [],
  onSwitchPortal,
  onLogout,
  notifications,
}: PortalNavButtonsProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selectablePortals = PORTAL_ORDER.filter((portal) => availablePortals.includes(portal))

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="flex gap-2 flex-wrap items-center justify-center md:justify-end">
      {selectablePortals.length > 0 && (
        <div ref={rootRef} className="relative z-50">
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label="Switch portal account"
            onClick={() => setOpen((value) => !value)}
            className={`${HEADER_ACTION_BTN} bg-white text-black hover:bg-gray-100`}
          >
            <span>{PORTAL_LABELS[activePortal]}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>

          {open && (
            <div
              role="listbox"
              aria-label="Available portals"
              className="absolute right-0 top-full z-50 mt-2 min-w-[10.5rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-left shadow-2xl"
            >
              {selectablePortals.map((portal) => {
                const isActive = activePortal === portal
                return (
                  <button
                    key={portal}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setOpen(false)
                      if (!isActive) onSwitchPortal?.(portal)
                    }}
                    className={`block w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-vortex-red/10 text-vortex-red'
                        : 'text-gray-800 hover:bg-gray-50 hover:text-vortex-red'
                    }`}
                  >
                    {PORTAL_LABELS[portal]}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onSwitchPortal?.('website')}
        className={`${HEADER_ACTION_BTN} bg-gray-700 text-white hover:bg-gray-600`}
        aria-label="Return to website home"
        title="Website home"
      >
        <Home className="h-4 w-4" aria-hidden />
      </button>

      {notifications}

      <button
        type="button"
        onClick={onLogout}
        className={`${HEADER_ACTION_BTN} bg-vortex-red text-white hover:bg-red-700`}
        aria-label="Log out"
        title="Log out"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </div>
  )
}
