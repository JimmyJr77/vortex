import { Suspense, useState, useEffect, useMemo } from 'react'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import { Home, Users, BookOpen, Dumbbell, Flame, Sparkles, CalendarRange, Trophy, ClipboardCheck, Send, BarChart3, Menu, X, Loader2, CalendarDays, GitBranch, MessageSquare, Video, Settings, CircleHelp } from 'lucide-react'
import PortalPreferencesPanel from '../messaging/PortalPreferencesPanel'
import MessagingFaqMasterPanel from '../messaging/MessagingFaqMasterPanel'
import HomePanel from './HomePanel'
import PortalNavButtons from '../PortalNavButtons'
import NotificationBell from '../NotificationBell'
import {
  NOTIFICATION_NAV_EVENT,
  type NotificationNavigateDetail,
} from '../../utils/notificationNavigation'
import type { PortalId } from '../../utils/portalSession'
import { coachFetch } from '../../coach/api'
import { firstVisiblePortalTab, isPortalTabVisible, orderPortalItems } from '../../utils/portalTabConfig'

const LiveSessionPanel = lazyWithRetry(() => import('./LiveSessionPanel'))
const RosterPanel = lazyWithRetry(() => import('./RosterPanel'))
const LibraryPanel = lazyWithRetry(() => import('./LibraryPanel'))
const WorkoutBuilder = lazyWithRetry(() => import('./WorkoutBuilder'))
const NeedsEnginePanel = lazyWithRetry(() => import('./NeedsEnginePanel'))
const ProgramBuilder = lazyWithRetry(() => import('./ProgramBuilder'))
const ChallengeBuilder = lazyWithRetry(() => import('./ChallengeBuilder'))
const AssessPanel = lazyWithRetry(() => import('./AssessPanel'))
const AssignPanel = lazyWithRetry(() => import('./AssignPanel'))
const InsightsPanel = lazyWithRetry(() => import('./InsightsPanel'))
const SkillTreePanel = lazyWithRetry(() => import('./SkillTreePanel'))
const MessagesPanel = lazyWithRetry(() => import('./MessagesPanel'))
const FormReviewPanel = lazyWithRetry(() => import('./FormReviewPanel'))

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
  | 'skills'
  | 'messages'
  | 'faqs'
  | 'reviews'
  | 'preferences'

interface CoachAccount {
  fullName?: string
  email?: string
  [key: string]: unknown
}

interface CoachLayoutProps {
  coach: CoachAccount
  onLogout: () => void
  onReturnToWebsite?: () => void
  availablePortals?: PortalId[]
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
  { tab: 'skills', label: 'Skill Tree', icon: GitBranch },
  { tab: 'assign', label: 'Assign', icon: Send },
  { tab: 'messages', label: 'Messages', icon: MessageSquare },
  { tab: 'faqs', label: 'FAQ library', icon: CircleHelp },
  { tab: 'reviews', label: 'Form Review', icon: Video },
  { tab: 'insights', label: 'Insights', icon: BarChart3 },
  { tab: 'roster', label: 'Roster', icon: Users },
  { tab: 'preferences', label: 'Preferences', icon: Settings },
]

export default function CoachLayout({ coach, onLogout, availablePortals = ['coach'], onSwitchPortal }: CoachLayoutProps) {
  const [tab, setTab] = useState<CoachTab>('home')
  const [navOpen, setNavOpen] = useState(false)
  const [openMessageThreadId, setOpenMessageThreadId] = useState<number | null>(null)
  const [messagesMaximized, setMessagesMaximized] = useState(false)
  const [openFormReviewSubmissionId, setOpenFormReviewSubmissionId] = useState<number | null>(null)
  const [hiddenCoachTabs, setHiddenCoachTabs] = useState<CoachTab[]>([])
  const [coachTabOrder, setCoachTabOrder] = useState<CoachTab[]>(NAV.map((item) => item.tab))

  const visibleNav = useMemo(
    () =>
      orderPortalItems(NAV, coachTabOrder, (item) => item.tab).filter((item) =>
        isPortalTabVisible(item.tab, hiddenCoachTabs),
      ),
    [coachTabOrder, hiddenCoachTabs],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await coachFetch<{ hiddenTabs: CoachTab[]; tabOrder: CoachTab[] }>('/api/coach/portal-config')
        if (!cancelled) setHiddenCoachTabs(Array.isArray(data.hiddenTabs) ? data.hiddenTabs : [])
        if (!cancelled) setCoachTabOrder(Array.isArray(data.tabOrder) ? data.tabOrder : NAV.map((item) => item.tab))
      } catch {
        if (!cancelled) setHiddenCoachTabs([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (isPortalTabVisible(tab, hiddenCoachTabs)) return
    setTab(firstVisiblePortalTab(visibleNav.map((item) => item.tab), hiddenCoachTabs, 'home'))
  }, [tab, hiddenCoachTabs, visibleNav])

  useEffect(() => {
    const onNavigateNotification = (evt: globalThis.Event) => {
      const detail = (evt as CustomEvent<NotificationNavigateDetail>).detail
      if (!detail || detail.portal !== 'coach') return
      if (detail.tab) setTab(detail.tab as CoachTab)
      if (detail.threadId != null) setOpenMessageThreadId(detail.threadId)
      if (detail.submissionId != null) setOpenFormReviewSubmissionId(detail.submissionId)
      setNavOpen(false)
    }
    window.addEventListener(NOTIFICATION_NAV_EVENT, onNavigateNotification)
    return () => window.removeEventListener(NOTIFICATION_NAV_EVENT, onNavigateNotification)
  }, [])

  useEffect(() => {
    if (tab !== 'messages' && messagesMaximized) setMessagesMaximized(false)
  }, [tab, messagesMaximized])

  const renderPanel = () => {
    switch (tab) {
      case 'home':
        return <HomePanel onNavigate={setTab} coachName={coach.fullName} hiddenTabs={hiddenCoachTabs} tabOrder={coachTabOrder} />
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
      case 'skills':
        return <SkillTreePanel />
      case 'assign':
        return <AssignPanel />
      case 'messages':
        return (
          <MessagesPanel
            initialThreadId={openMessageThreadId}
            onInitialThreadOpened={() => setOpenMessageThreadId(null)}
            maximized={messagesMaximized}
            onMaximizedChange={setMessagesMaximized}
          />
        )
      case 'faqs':
        return (
          <div className="flex flex-col flex-1 min-h-0 h-full max-h-full overflow-hidden">
            <MessagingFaqMasterPanel role="coach" fetcher={coachFetch} />
          </div>
        )
      case 'reviews':
        return (
          <FormReviewPanel
            initialSubmissionId={openFormReviewSubmissionId}
            onInitialSubmissionOpened={() => setOpenFormReviewSubmissionId(null)}
          />
        )
      case 'insights':
        return <InsightsPanel />
      case 'preferences':
        return <PortalPreferencesPanel role="coach" fetcher={coachFetch} />
      default:
        return null
    }
  }

  const messagingFullscreen = messagesMaximized && tab === 'messages'

  return (
    <div className="min-h-screen h-dvh max-h-dvh bg-gray-50 flex flex-col overflow-hidden">
      <header className={`bg-gradient-to-br from-black via-gray-900 to-black shrink-0 ${messagingFullscreen ? 'hidden' : ''}`}>
        <div className="container-admin py-4 flex items-center justify-between gap-4 pt-below-site-header">
          <div className="flex items-center gap-3">
            <button type="button" className="lg:hidden text-white" onClick={() => setNavOpen((o) => !o)}>
              {navOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div>
              <h1 className="text-3xl md:text-5xl font-display font-bold text-white">VORTEX <span className="text-vortex-red">COACH</span></h1>
              {coach.fullName && <p className="text-gray-400 text-xs">{coach.fullName}</p>}
            </div>
          </div>
          <PortalNavButtons
            activePortal="coach"
            availablePortals={availablePortals}
            onSwitchPortal={onSwitchPortal}
            onLogout={onLogout}
            notifications={<NotificationBell apiPrefix="coach" />}
          />
        </div>
      </header>

      <div className={`${messagingFullscreen ? 'flex-1 min-h-0 overflow-hidden p-0' : 'container-admin pt-6 pb-6 grid gap-6 lg:grid-cols-[220px_1fr] flex-1 min-h-0 overflow-hidden'}`}>
        <nav className={messagingFullscreen ? 'hidden' : navOpen ? 'block' : 'hidden lg:block'}>
          <div className="bg-white border border-gray-200 rounded-xl p-2 sticky top-4">
            {visibleNav.map((item) => {
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
        <main className={`min-w-0 flex flex-col min-h-0 flex-1 ${tab === 'messages' || tab === 'faqs' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className="flex flex-col flex-1 min-h-0 h-full">
            <Suspense fallback={<div className="flex items-center gap-2 text-gray-500 py-12"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>}>
              {renderPanel()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
