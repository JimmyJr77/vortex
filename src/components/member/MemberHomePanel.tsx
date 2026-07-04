import { Users, LayoutGrid, Dumbbell, TrendingUp, MessageSquare, Calendar, CreditCard, FileText } from 'lucide-react'
import type { MemberTab } from '../MemberDashboard'
import { isPortalTabVisible } from '../../utils/portalTabConfig'

const cards: Array<{ tab: MemberTab; title: string; description: string; icon: typeof Users }> = [
  { tab: 'profile', title: 'Profile', description: 'Your account and family members.', icon: Users },
  { tab: 'classes', title: 'Classes', description: 'Current enrollments and class signups.', icon: LayoutGrid },
  { tab: 'training', title: 'Training', description: 'Your assigned workouts and programs.', icon: Dumbbell },
  { tab: 'progress', title: 'Progress', description: 'PRs, goals, and achievements.', icon: TrendingUp },
  { tab: 'messages', title: 'Messages', description: 'Talk with your coaches.', icon: MessageSquare },
  { tab: 'events', title: 'Events', description: 'Upcoming events and signups.', icon: Calendar },
  { tab: 'billing', title: 'Billing', description: 'Statements and payment history.', icon: CreditCard },
  { tab: 'waivers', title: 'Waivers', description: 'Review and sign required waivers.', icon: FileText },
]

export default function MemberHomePanel({
  onNavigate,
  firstName,
  hiddenTabs = [],
}: {
  onNavigate: (tab: MemberTab) => void
  firstName?: string
  hiddenTabs?: MemberTab[]
}) {
  const visibleCards = cards.filter((card) => isPortalTabVisible(card.tab, hiddenTabs))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome{firstName ? `, ${firstName}` : ''}</h2>
        <p className="text-sm text-gray-500">Your member portal. Jump into any section.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map((c) => {
          const Icon = c.icon
          return (
            <button key={c.tab} type="button" onClick={() => onNavigate(c.tab)} className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-vortex-red transition-all">
              <Icon className="w-7 h-7 text-vortex-red" />
              <h3 className="mt-3 font-bold text-gray-900">{c.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{c.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
