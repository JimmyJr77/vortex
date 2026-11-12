import { Suspense, useCallback, useEffect, useState } from 'react'
import { BookOpen, CreditCard, Inbox, RefreshCw, Users, ReceiptText, ChartNoAxesCombined, Home, Menu, X, Clock3, DollarSign } from 'lucide-react'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import type { PortalId } from '../../utils/portalSession'
import LegacyWorkspaces from './LegacyWorkspaces'
import { legacySections, type LegacySection } from './legacySections'
import { NOTIFICATION_NAV_EVENT, type NotificationNavigateDetail } from '../../utils/notificationNavigation'
import PortalNavButtons from '../PortalNavButtons'
import NotificationBell from '../NotificationBell'
import { button, Dialog, ErrorNotice, Loading } from './shared'
import { allowed, useRead, type Access, type BillingTarget } from './api'
import type { AccountingWorkspaceState } from './accounting/Accounting'

const Dashboard = lazyWithRetry(() => import('./EnrollmentDashboard'))
const Members = lazyWithRetry(() => import('./Members'))
const Leads = lazyWithRetry(() => import('./Leads'))
const Classes = lazyWithRetry(() => import('./Classes'))
const Billing = lazyWithRetry(() => import('./BillingWorkspace'))
const Pricing = lazyWithRetry(() => import('../AdminPricing'))
const CancellationReview = lazyWithRetry(() => import('../billing/CancellationReviewPanel'))
const Accounting = lazyWithRetry(() => import('./accounting/Accounting'))
const Timesheets = lazyWithRetry(() => import('./Timesheets'))
type Section = LegacySection | 'home' | 'dashboard' | 'accounting' | 'members' | 'classes' | 'leads' | 'billing' | 'timesheets' | 'pricing'
const descriptions: Record<string, string> = {
  calendar: 'View the facility schedule and event details.',
  floorPlanner: 'Plan classes, locations, and coaches for every day.',
  messaging: 'Staff messaging with athletes, coaches, and admins.',
  store: 'Manage products, orders, and store settings.',
  highlightsEvents: 'Manage special pages, popups, and events.',
  opportunityResearch: 'Research and track growth opportunities.',
  marketingVisibility: 'Manage marketing, visibility, and competitor research.',
  dataAnalysis: 'Explore analytics, database queries, and schools.',
  faqLibrary: 'Manage shared FAQ entries for conversations.',
  legal: 'Manage waivers, insurance, and staff policies.',
  preferences: 'Configure notifications and critical alerts.',
  staffAccess: 'Manage staff accounts, roles, and permissions.',
  settings: 'Manage email, portal navigation, and Stripe settings.',
  dashboard: 'Track enrollment trends, growth, and acquisition.',
  accounting: 'Review revenue, balances, and financial activity.',
  members: 'Manage members, families, and their accounts.',
  classes: 'Manage programs, classes, and schedules.',
  leads: 'Follow up with inquiries and prospective families.',
  billing: 'Review account billing, payments, and enrollments.',
  timesheets: 'Log hours worked and manage coach assignments.',
  pricing: 'Set class prices, discounts, rules, and promo codes.',
}
const sections = [
  { id: 'home' as const, label: 'Home', icon: Home, permission: null },
  { id: 'dashboard' as const, label: 'Dashboard', icon: ChartNoAxesCombined, permission: 'members.view' },
  { id: 'accounting' as const, label: 'Accounting', icon: ReceiptText, permission: 'billing.view' },
  { id: 'members' as const, label: 'Members & accounts', icon: Users, permission: 'members.view' },
  { id: 'classes' as const, label: 'Classes & schedules', icon: BookOpen, permission: 'classes.view' },
  { id: 'leads' as const, label: 'Leads', icon: Inbox, permission: 'members.view' },
  { id: 'pricing' as const, label: 'Pricing', icon: DollarSign, permission: 'pricing.view' },
  { id: 'billing' as const, label: 'Billing', icon: CreditCard, permission: 'billing.view' },
  { id: 'timesheets' as const, label: 'Timesheets', icon: Clock3, permission: null },
]

export default function NewAdmin({ onLogout, availablePortals = ['admin', 'new-admin'], onSwitchPortal }: {
  onLogout: () => void; availablePortals?: PortalId[]; onSwitchPortal?: (portal: PortalId) => void
}) {
  const [section, setSection] = useState<Section>('home')
  const [navOpen, setNavOpen] = useState(false)
  const [cancellationReviewOpen, setCancellationReviewOpen] = useState(false)
  const [threadId, setThreadId] = useState<number | null>(null)
  const [messagesMaximized, setMessagesMaximized] = useState(false)
  const [revision, setRevision] = useState(0)
  const [familyId, setFamilyId] = useState<number | null>(null)
  const [memberId, setMemberId] = useState<number | null>(null)
  const [billingTarget, setBillingTarget] = useState<BillingTarget | null>(null)
  const [accountingWorkspace, setAccountingWorkspace] = useState<AccountingWorkspaceState | null>(null)
  const access = useRead<Access & { user?: { id?: number } }>('/api/admin/access/me')
  const refresh = () => setRevision(value => value + 1)
  const consumeBillingTarget = useCallback(() => setBillingTarget(null), [])
  const openMember = (id: number) => { setFamilyId(null); setMemberId(id); setSection('members') }
  const openBilling = (target: BillingTarget) => { setBillingTarget(target); setSection('billing') }
  const visible = access.data ? [...sections.filter(item => item.permission === null || allowed(access.data!, item.permission)), ...legacySections.filter(item => item.tabs.some(tab => tab.permission === null || allowed(access.data!, tab.permission)))] : []
  const current = visible.find(item => item.id === section) ?? visible.find(item => item.id === 'members') ?? visible[0]
  const navigate = (id: Section) => {
    setMessagesMaximized(false)
    setSection(id)
    setMemberId(null)
    setFamilyId(null)
    setNavOpen(false)
    refresh()
  }
  useEffect(() => {
    const onNotification = (event: Event) => {
      const detail = (event as CustomEvent<NotificationNavigateDetail>).detail
      if (detail?.portal !== 'admin') return
      if (detail.section === 'messages' || detail.group === 'messaging') {
        setMessagesMaximized(false)
        setSection('messaging')
        setThreadId(detail.threadId ?? null)
        setNavOpen(false)
      } else if (detail.section === 'billing' && access.data && allowed(access.data, 'billing.view')) {
        setCancellationReviewOpen(true)
        setNavOpen(false)
      }
    }
    if (access.data) {
      const pending = sessionStorage.getItem('vortex_admin_handoff')
      if (pending) {
        sessionStorage.removeItem('vortex_admin_handoff')
        try {
          const handoff = JSON.parse(pending)
          if (handoff.notification) onNotification(new CustomEvent(NOTIFICATION_NAV_EVENT, { detail: handoff.notification }))
          else if (handoff.section === 'billing' && allowed(access.data, 'billing.view')) {
            setSection('billing')
            if (Number.isSafeInteger(handoff.familyId) && handoff.familyId > 0) {
              setBillingTarget({ familyId: handoff.familyId, memberId: Number.isSafeInteger(handoff.memberId) && handoff.memberId > 0 ? handoff.memberId : null })
            }
            const url = new URL(window.location.href)
            url.searchParams.delete('adminBillingFamilyId')
            url.searchParams.delete('adminBillingMemberId')
            window.history.replaceState(window.history.state, '', url)
          }
        } catch { /* Ignore an invalid or expired navigation hint. */ }
      }
    }
    window.addEventListener(NOTIFICATION_NAV_EVENT, onNotification)
    return () => window.removeEventListener(NOTIFICATION_NAV_EVENT, onNotification)
  }, [access.data])
  const fullscreen = current?.id === 'messaging' && messagesMaximized
  const legacy = legacySections.find(item => item.id === current?.id)
  const fixedPanel = current?.id === 'messaging' || current?.id === 'faqLibrary'
  return <div className="min-h-screen h-dvh max-h-dvh bg-gray-50 text-gray-900 flex flex-col overflow-hidden">
    <header hidden={fullscreen} className="bg-gradient-to-br from-black via-gray-900 to-black shrink-0">
      <div className="container-admin py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" className="lg:hidden text-white" aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={navOpen} aria-controls="new-admin-navigation" onClick={() => setNavOpen(open => !open)}>
            {navOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h1 className="text-3xl md:text-5xl font-display font-bold text-white">VORTEX <span className="text-vortex-red">ADMIN</span></h1>
        </div>
        <PortalNavButtons activePortal="new-admin" availablePortals={availablePortals} onSwitchPortal={onSwitchPortal} onLogout={onLogout} notifications={<NotificationBell apiPrefix="admin" />} />
      </div>
    </header>
    <div className={fullscreen ? "flex flex-col flex-1 min-h-0 overflow-hidden" : "container-admin pt-6 pb-6 flex flex-col lg:grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] flex-1 min-h-0 overflow-hidden"}>
      <nav id="new-admin-navigation" aria-label="Admin sections" className={`${fullscreen ? 'hidden' : navOpen ? 'block' : 'hidden lg:block'} shrink-0 max-h-[45dvh] lg:max-h-none min-h-0 overflow-y-auto overscroll-contain`}>
        <div className="bg-white border border-gray-200 rounded-xl p-2">
          {visible.map(item => <button type="button" key={item.id} onClick={() => navigate(item.id)} aria-current={current?.id === item.id ? 'page' : undefined} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${current?.id === item.id ? 'bg-vortex-red text-white' : 'text-gray-700 hover:bg-gray-100'}`}><item.icon className="w-4 h-4 shrink-0" /><span className="text-left">{item.label}</span></button>)}
        </div>
      </nav>
      <main className={`min-w-0 min-h-0 flex-1 ${fixedPanel ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}>
        {access.loading ? <Loading label="Checking administrative access…" /> : null}
        <ErrorNotice message={access.error} onRetry={() => window.location.reload()} />
        {access.data && current?.id === 'home' ? <div className="space-y-5">
          <div><h2 className="text-2xl font-bold text-gray-900">Admin</h2><p className="text-sm text-gray-500">Welcome to your admin workspace. Jump into any area.</p></div>
          {visible.length === 1 ? <p role="status">Your staff account has no permissions for these administrative workflows.</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.filter(item => item.id !== 'home').map(item => <button type="button" key={item.id} aria-label={`Open ${item.label}`} onClick={() => navigate(item.id)} className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-vortex-red transition-all">
              <item.icon className="w-7 h-7 text-vortex-red" /><h3 className="mt-3 font-bold text-gray-900">{item.label}</h3><p className="text-sm text-gray-500 mt-1">{descriptions[item.id]}</p>
            </button>)}
          </div>
        </div> : null}
        {current && current.id !== 'home' && current.id !== 'billing' && !fixedPanel ? <div className="flex justify-end mb-4"><button type="button" className={button} onClick={refresh} aria-label="Refresh Admin"><RefreshCw className="h-4 w-4" />Refresh</button></div> : null}
        <Suspense fallback={<Loading label="Opening workspace…" />}>
        {access.data && legacy ? <LegacyWorkspaces key={`${legacy.id}-${revision}`} section={legacy.id} access={access.data} threadId={threadId} onThreadOpened={() => setThreadId(null)} maximized={fullscreen} onMaximizedChange={setMessagesMaximized} /> : null}
        {access.data && current?.id === 'dashboard' ? <Dashboard revision={revision} canViewBilling={allowed(access.data, 'billing.view')} onBilling={openBilling} /> : null}
        {access.data && current?.id === 'accounting' ? <Accounting revision={revision} onBilling={openBilling} workspace={accountingWorkspace} onWorkspaceChange={setAccountingWorkspace} /> : null}
        {access.data && current?.id === 'members' ? <Members access={access.data} revision={revision} selectedId={memberId} selectedFamilyId={familyId} onSelectFamily={setFamilyId} onSelect={setMemberId} onBilling={openBilling} /> : null}
        {access.data && current?.id === 'leads' ? <Leads access={access.data} revision={revision} onMember={openMember} /> : null}
        {access.data && current?.id === 'classes' ? <Classes access={access.data} revision={revision} onMember={openMember} /> : null}
        {access.data && current?.id === 'timesheets' ? <Timesheets revision={revision} access={access.data} /> : null}
        {access.data && current?.id === 'pricing' ? <Pricing access={access.data} revision={revision} /> : null}
        {current?.id === 'billing' && (familyId != null || memberId != null) ? <button className={`${button} mb-4`} onClick={() => { setSection('members'); refresh() }}>Back to family workspace</button> : null}
        {access.data && current?.id === 'billing' ? <Billing access={access.data} accountTarget={billingTarget} onAccountTargetConsumed={consumeBillingTarget} /> : null}
        {cancellationReviewOpen && access.data && allowed(access.data, 'billing.view') ? <Dialog title="Cancellation review" onClose={() => setCancellationReviewOpen(false)}><CancellationReview /></Dialog> : null}
      </Suspense></main>
    </div>
  </div>
}
