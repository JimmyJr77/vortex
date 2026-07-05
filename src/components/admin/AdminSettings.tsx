import { useState } from 'react'
import { Settings } from 'lucide-react'
import AdminEmail from '../AdminEmail'
import AdminPortalTabSettings from './AdminPortalTabSettings'
import AdminStripeCatalogSettings from './AdminStripeCatalogSettings'

type SettingsTab = 'email' | 'memberPortal' | 'coachPortal' | 'stripe'

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'email', label: 'Email' },
  { id: 'memberPortal', label: 'Member Portal' },
  { id: 'coachPortal', label: 'Coach Portal' },
  { id: 'stripe', label: 'Stripe' },
]

export default function AdminSettings() {
  const [tab, setTab] = useState<SettingsTab>('email')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-7 h-7 text-vortex-red" />
          Settings
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Email delivery, portal navigation, and Stripe catalog sync.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-1 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'border-vortex-red text-vortex-red'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'email' && <AdminEmail embedded />}
      {tab === 'memberPortal' && <AdminPortalTabSettings portal="member" />}
      {tab === 'coachPortal' && <AdminPortalTabSettings portal="coach" />}
      {tab === 'stripe' && <AdminStripeCatalogSettings />}
    </div>
  )
}
