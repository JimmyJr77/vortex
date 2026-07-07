import {
  Dumbbell,
  Flame,
  Sparkles,
  ClipboardCheck,
  Send,
  BarChart3,
  Trophy,
  CalendarRange,
  Users,
  BookOpen,
  ScrollText,
  CalendarDays,
  GitBranch,
  MessageSquare,
  Video,
  Bell,
  CircleHelp,
  Layers,
  Blocks,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { CoachTab } from './CoachLayout'
import {
  COACH_PORTAL_HOME_CARD_COPY,
  COACH_PORTAL_TAB_OPTIONS,
  isPortalTabVisible,
  orderPortalItems,
} from '../../utils/portalTabConfig'

const CARD_ICONS: Record<Exclude<CoachTab, 'home'>, ComponentType<{ className?: string }>> = {
  sessions: CalendarDays,
  needs: Sparkles,
  library: BookOpen,
  framework: ScrollText,
  workout: Dumbbell,
  warmup: Flame,
  programs: CalendarRange,
  'training-blocks': Blocks,
  regimens: Layers,
  challenges: Trophy,
  assess: ClipboardCheck,
  skills: GitBranch,
  assign: Send,
  messages: MessageSquare,
  faqs: CircleHelp,
  reviews: Video,
  insights: BarChart3,
  roster: Users,
  preferences: Bell,
}

const ALL_CARDS = COACH_PORTAL_TAB_OPTIONS.filter((option) => option.key !== 'home').map((option) => {
  const tab = option.key as Exclude<CoachTab, 'home'>
  const copy = COACH_PORTAL_HOME_CARD_COPY[tab]
  return {
    tab,
    title: copy.title,
    description: copy.description,
    icon: CARD_ICONS[tab],
  }
})

export default function HomePanel({
  onNavigate,
  coachName,
  hiddenTabs = [],
  tabOrder,
}: {
  onNavigate: (tab: CoachTab) => void
  coachName?: string
  hiddenTabs?: CoachTab[]
  tabOrder?: CoachTab[]
}) {
  const visibleCards = orderPortalItems(ALL_CARDS, tabOrder, (card) => card.tab).filter((card) =>
    isPortalTabVisible(card.tab, hiddenTabs),
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome{coachName ? `, ${coachName}` : ''}</h2>
        <p className="text-sm text-gray-500">Your coaching workspace. Jump into any tool.</p>
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
