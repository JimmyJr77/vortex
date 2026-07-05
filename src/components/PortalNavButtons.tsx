import type { ReactNode } from 'react'
import { Home, LogOut } from 'lucide-react'
import type { PortalId } from '../utils/portalSession'

/** Shared height/padding for portal header action buttons (Admin, Coach, Member, bell, Logout). */
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
  /** Rendered immediately left of Logout (notification bell on narrow layouts). */
  notifications?: ReactNode
}

function portalButtonClass(isActive: boolean): string {
  return isActive
    ? `${HEADER_ACTION_BTN} bg-white text-black hover:bg-gray-100`
    : `${HEADER_ACTION_BTN} bg-gray-700 text-white hover:bg-gray-600`
}

export default function PortalNavButtons({
  activePortal,
  availablePortals = [],
  onSwitchPortal,
  onLogout,
  notifications,
}: PortalNavButtonsProps) {
  return (
    <div className="flex gap-2 flex-wrap items-center justify-center md:justify-end">
      {PORTAL_ORDER.map((portal) => {
        if (!availablePortals.includes(portal)) return null
        const isActive = activePortal === portal
        return (
          <button
            key={portal}
            type="button"
            onClick={() => onSwitchPortal?.(portal)}
            className={portalButtonClass(isActive)}
            aria-current={isActive ? 'page' : undefined}
          >
            {PORTAL_LABELS[portal]}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => onSwitchPortal?.('website')}
        className={`${portalButtonClass(false)} flex items-center gap-2`}
      >
        <Home className="w-4 h-4" />
        <span>Website</span>
      </button>
      {notifications}
      <button
        type="button"
        onClick={onLogout}
        className={`${HEADER_ACTION_BTN} bg-vortex-red text-white hover:bg-red-700`}
      >
        <LogOut className="w-4 h-4" />
        <span>Logout</span>
      </button>
    </div>
  )
}
