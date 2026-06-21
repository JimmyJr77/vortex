import { Home, LogOut } from 'lucide-react'
import type { PortalId } from '../utils/portalSession'

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
}

function portalButtonClass(isActive: boolean): string {
  const base = 'px-3 md:px-4 py-2 rounded-lg font-semibold transition-colors text-sm'
  return isActive
    ? `${base} bg-white text-black hover:bg-gray-100`
    : `${base} bg-gray-700 text-white hover:bg-gray-600`
}

export default function PortalNavButtons({
  activePortal,
  availablePortals = [],
  onSwitchPortal,
  onLogout,
}: PortalNavButtonsProps) {
  return (
    <div className="flex gap-2 flex-wrap justify-center md:justify-end">
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
      <button
        type="button"
        onClick={onLogout}
        className="flex items-center gap-2 bg-vortex-red text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
      >
        <LogOut className="w-4 h-4" />
        <span>Logout</span>
      </button>
    </div>
  )
}
