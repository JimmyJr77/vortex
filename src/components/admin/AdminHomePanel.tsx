import type { ComponentType } from 'react'
import type { GroupId } from '../Admin'

interface GroupCard {
  id: GroupId
  label: string
  icon: ComponentType<{ className?: string }>
}

const DESCRIPTIONS: Partial<Record<GroupId, string>> = {
  messaging: 'Staff messaging with athletes, coaches, and admins.',
  accounts: 'Admins, Vortex accounts, and access control.',
  leads: 'Inbound inquiries from prospective families.',
  classSetup: 'Classes, coaches, and scheduling.',
  registrations: 'Class registrations and event signups.',
  calendar: 'Facility schedule at a glance.',
  pricingBilling: 'Pricing plans and family billing.',
  legal: 'Waivers and insurance.',
  highlightsEvents: 'Site highlights and events.',
  dataAnalysis: 'Analytics, database queries, and schools.',
  preferences: 'Critical alerts and notification settings.',
  settings: 'Email and system configuration.',
}

export default function AdminHomePanel({
  groups,
  onNavigate,
  adminName,
}: {
  groups: GroupCard[]
  onNavigate: (id: GroupId) => void
  adminName?: string
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome{adminName ? `, ${adminName}` : ''}</h2>
        <p className="text-sm text-gray-500">Your admin workspace. Jump into any area.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => {
          const Icon = group.icon
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onNavigate(group.id)}
              className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-vortex-red transition-all"
            >
              <Icon className="w-7 h-7 text-vortex-red" />
              <h3 className="mt-3 font-bold text-gray-900">{group.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{DESCRIPTIONS[group.id] ?? ''}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
