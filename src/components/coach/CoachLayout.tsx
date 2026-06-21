import { lazy, Suspense, useState } from 'react'
import { Home, LogOut, Users, BookOpen, Dumbbell, Flame, Sparkles, CalendarRange, Trophy, ClipboardCheck, Send, BarChart3, Menu, X, Loader2, CalendarDays } from 'lucide-react'
import HomePanel from './HomePanel'

const LiveSessionPanel = lazy(() => import('./LiveSessionPanel'))
const RosterPanel = lazy(() => import('./RosterPanel'))
const LibraryPanel = lazy(() => import('./LibraryPanel'))
const WorkoutBuilder = lazy(() => import('./WorkoutBuilder'))
const NeedsEnginePanel = lazy(() => import('./NeedsEnginePanel'))
const ProgramBuilder = lazy(() => import('./ProgramBuilder'))
const ChallengeBuilder = lazy(() => import('./ChallengeBuilder'))
const AssessPanel = lazy(() => import('./AssessPanel'))
const AssignPanel = lazy(() => import('./AssignPanel'))
const InsightsPanel = lazy(() => import('./InsightsPanel'))

export type CoachTab =
  | 'home'
  | 'sessions'
  | 'roster'
  | 'library'
  | 'workout'
  | 'warmup'
  | 'needs'
  | 'programs'
  | 'challenges'
  | 'assess'
  | 'assign'
  | 'insights'

interface CoachAccount {
  fullName?: string
  email?: string
  [key: string]: unknown
}

interface CoachLayoutProps {
  coach: CoachAccount
  onLogout: () => void
  onReturnToWebsite?: () => void
  availablePortals?: string[]
  onSwitchPortal?: (portal: 'admin' | 'coach' | 'member' | 'website') => void
}

const NAV: Array<{ tab: CoachTab; label: string; icon: typeof Home }> = [
  { tab: 'home', label: 'Home', icon: Home },
  { tab: 'sessions', label: 'Today', icon: CalendarDays },
  { tab: 'needs', label: 'Needs Engine', icon: Sparkles },
  { tab: 'library', label: 'Library', icon: BookOpen },
  { tab: 'workout', label: 'Workouts', icon: Dumbbell },
  { tab: 'warmup', label: 'Warmups', icon: Flame },
  { tab: 'programs', label: 'Programs', icon: CalendarRange },
  { tab: 'challenges', label: 'Challenges', icon: Trophy },
  { tab: 'assess', label: 'Assess', icon: ClipboardCheck },
  { tab: 'assign', label: 'Assign', icon: Send },
  { tab: 'insights', label: 'Insights', icon: BarChart3 },
  { tab: 'roster', label: 'Roster', icon: Users },
]

export default function CoachLayout({ coach, onLogout, onReturnToWebsite, availablePortals = ['coach'], onSwitchPortal }: CoachLayoutProps) {
  const [tab, setTab] = useState<CoachTab>('home')
  const [navOpen, setNavOpen] = useState(false)

  const renderPanel = () => {
    switch (tab) {
      case 'home':
        return <HomePanel onNavigate={setTab} coachName={coach.fullName} />
      case 'sessions':
        return <LiveSessionPanel />
      case 'roster':
        return <RosterPanel />
      case 'library':
        return <LibraryPanel />
      case 'workout':
        return <WorkoutBuilder defaultType="workout" />
      case 'warmup':
        return <WorkoutBuilder defaultType="warmup" />
      case 'needs':
        return <NeedsEnginePanel onSendToBuilder={() => setTab('workout')} />
      case 'programs':
        return <ProgramBuilder />
      case 'challenges':
        return <ChallengeBuilder />
      case 'assess':
        return <AssessPanel />
      case 'assign':
        return <AssignPanel />
      case 'insights':
        return <InsightsPanel />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="container-custom py-4 flex items-center justify-between gap-4 pt-below-site-header">
          <div className="flex items-center gap-3">
            <button type="button" className="lg:hidden text-white" onClick={() => setNavOpen((o) => !o)}>
              {navOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div>
              <h1 className="text-xl md:text-3xl font-display font-bold text-white">VORTEX <span className="text-vortex-red">COACH</span></h1>
              {coach.fullName && <p className="text-gray-400 text-xs">{coach.fullName}</p>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {availablePortals.includes('admin') && (
              <button type="button" onClick={() => onSwitchPortal?.('admin')} className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-600">Admin</button>
            )}
            {availablePortals.includes('member') && (
              <button type="button" onClick={() => onSwitchPortal?.('member')} className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-600">Member</button>
            )}
            {onReturnToWebsite && (
              <button type="button" onClick={onReturnToWebsite} className="flex items-center gap-2 bg-gray-700 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-600"><Home className="w-4 h-4" /> Website</button>
            )}
            <button type="button" onClick={onLogout} className="flex items-center gap-2 bg-vortex-red text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-700"><LogOut className="w-4 h-4" /> Logout</button>
          </div>
        </div>
      </header>

      <div className="container-custom py-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className={`${navOpen ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-white border border-gray-200 rounded-xl p-2 sticky top-4">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = tab === item.tab
              return (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => {
                    setTab(item.tab)
                    setNavOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-vortex-red text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <Icon className="w-4 h-4" /> {item.label}
                </button>
              )
            })}
          </div>
        </nav>
        <main className="min-w-0">
          <Suspense fallback={<div className="flex items-center gap-2 text-gray-500 py-12"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>}>
            {renderPanel()}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
