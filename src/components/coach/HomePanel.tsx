import { Dumbbell, Flame, Sparkles, ClipboardCheck, Send, BarChart3, Trophy, CalendarRange, Users, BookOpen, CalendarDays, GitBranch } from 'lucide-react'
import type { CoachTab } from './CoachLayout'
import { isPortalTabVisible, orderPortalItems } from '../../utils/portalTabConfig'

const cards: Array<{ tab: CoachTab; title: string; description: string; icon: typeof Dumbbell }> = [
  { tab: 'sessions', title: "Today's Sessions", description: 'Run a class: attendance and group logging.', icon: CalendarDays },
  { tab: 'needs', title: 'Needs Engine', description: 'Describe a need, get a time-packed session.', icon: Sparkles },
  { tab: 'library', title: 'Exercise Library', description: 'Search and tag the movement library.', icon: BookOpen },
  { tab: 'workout', title: 'Workout Builder', description: 'Build sessions with a live time clock.', icon: Dumbbell },
  { tab: 'warmup', title: 'Warmup Builder', description: 'Design quick activation routines.', icon: Flame },
  { tab: 'programs', title: 'Training Programs', description: 'Sequence weeks of training.', icon: CalendarRange },
  { tab: 'challenges', title: 'Challenges', description: 'Run scored competitions.', icon: Trophy },
  { tab: 'assess', title: 'Assess & Grade', description: 'Record benchmarks and skills.', icon: ClipboardCheck },
  { tab: 'skills', title: 'Skill Tree', description: 'Prerequisite progressions and mastery.', icon: GitBranch },
  { tab: 'assign', title: 'Assign & Share', description: 'Push plans to athletes.', icon: Send },
  { tab: 'insights', title: 'Insights', description: 'Load, readiness, PRs, and trends.', icon: BarChart3 },
  { tab: 'roster', title: 'Roster', description: 'Attendance, notes, waivers.', icon: Users },
]

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
  const visibleCards = orderPortalItems(cards, tabOrder, (card) => card.tab).filter((card) =>
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
