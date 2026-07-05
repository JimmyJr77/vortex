import {
  Users,
  LayoutGrid,
  Dumbbell,
  TrendingUp,
  MessageSquare,
  CircleHelp,
  Calendar,
  CreditCard,
  FileText,
  Settings,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { MemberTab } from '../MemberDashboard'
import {
  MEMBER_PORTAL_HOME_CARD_COPY,
  MEMBER_PORTAL_TAB_OPTIONS,
  isPortalTabVisible,
  orderPortalItems,
} from '../../utils/portalTabConfig'

const CARD_ICONS: Record<Exclude<MemberTab, 'home'>, ComponentType<{ className?: string }>> = {
  profile: Users,
  classes: LayoutGrid,
  training: Dumbbell,
  progress: TrendingUp,
  messages: MessageSquare,
  faqs: CircleHelp,
  events: Calendar,
  billing: CreditCard,
  waivers: FileText,
  preferences: Settings,
}

const ALL_CARDS = MEMBER_PORTAL_TAB_OPTIONS.filter((option) => option.key !== 'home').map((option) => {
  const tab = option.key as Exclude<MemberTab, 'home'>
  const copy = MEMBER_PORTAL_HOME_CARD_COPY[tab]
  return {
    tab,
    title: copy.title,
    description: copy.description,
    icon: CARD_ICONS[tab],
  }
})

export default function MemberHomePanel({
  onNavigate,
  firstName,
  hiddenTabs = [],
  tabOrder,
}: {
  onNavigate: (tab: MemberTab) => void
  firstName?: string
  hiddenTabs?: MemberTab[]
  tabOrder?: MemberTab[]
}) {
  const visibleCards = orderPortalItems(ALL_CARDS, tabOrder, (card) => card.tab).filter((card) =>
    isPortalTabVisible(card.tab, hiddenTabs),
  )

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
            <button
              key={c.tab}
              type="button"
              onClick={() => onNavigate(c.tab)}
              className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-vortex-red transition-all"
            >
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
