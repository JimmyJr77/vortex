import { Settings } from 'lucide-react'
import MessagingNotificationPreferences from './MessagingNotificationPreferences'
import type { MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface PortalPreferencesPanelProps {
  role: MessagingRole
  fetcher: Fetcher
}

export default function PortalPreferencesPanel({ role, fetcher }: PortalPreferencesPanelProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-7 h-7 text-vortex-red" />
          Preferences
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Notification settings apply across all Vortex portals linked to your account.
        </p>
      </div>
      <MessagingNotificationPreferences role={role} fetcher={fetcher} variant="page" />
    </div>
  )
}
