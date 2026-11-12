import { useState, type ComponentProps } from 'react'
import { legacySections, type LegacySection } from './legacySections'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import { adminApiRequest } from '../../utils/api'
import { allowed, useRead, type Access } from './api'
import { ErrorNotice, Loading } from './shared'

const Calendar = lazyWithRetry(() => import('../scheduling/AdminCalendar'))
const FloorPlanner = lazyWithRetry(() => import('../floorPlanner/FloorPlanner'))
const Messages = lazyWithRetry(() => import('../admin/AdminMessagesPanel'))
const Store = lazyWithRetry(() => import('../admin/AdminStore'))
const Pages = lazyWithRetry(() => import('../AdminSpecialPages'))
const Popups = lazyWithRetry(() => import('../AdminHighlights'))
const Events = lazyWithRetry(() => import('../AdminEvents'))
const Opportunities = lazyWithRetry(() => import('../AdminOpportunities'))
const Marketing = lazyWithRetry(() => import('../admin/AdminMarketingVisibility'))
const Competitors = lazyWithRetry(() => import('../admin/AdminCompetitors'))
const Analytics = lazyWithRetry(() => import('../AdminAnalytics'))
const Queries = lazyWithRetry(() => import('../AdminDbQueries'))
const Schools = lazyWithRetry(() => import('../AdminSchools'))
const Faq = lazyWithRetry(() => import('../messaging/MessagingFaqMasterPanel'))
const Waivers = lazyWithRetry(() => import('../AdminWaivers'))
const Insurance = lazyWithRetry(() => import('../AdminInsurance'))
const StaffLegal = lazyWithRetry(() => import('../legal/AdminStaffLegal'))
const Preferences = lazyWithRetry(() => import('../messaging/PortalPreferencesPanel'))
const StaffAccess = lazyWithRetry(() => import('../AdminAccess'))
const AdminSettings = lazyWithRetry(() => import('../admin/AdminSettings'))

async function adminFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await adminApiRequest(endpoint, options)
  const json = await response.json()
  if (!response.ok || json?.success === false) throw new Error(json?.message || `Request failed: ${response.status}`)
  return (json?.data ?? json) as T
}

function EventsWorkspace() {
  type Props = ComponentProps<typeof Events>
  const programs = useRead<Props['programs']>('/api/admin/programs')
  const active = useRead<Props['categories']>('/api/admin/categories?archived=false')
  const archived = useRead<Props['categories']>('/api/admin/categories?archived=true')
  const [adminInfo] = useState<Props['adminInfo']>(() => {
    try { return JSON.parse(localStorage.getItem('vortex-admin-info') || 'null') } catch { return null }
  })
  if (programs.loading || active.loading || archived.loading) return <Loading />
  const error = programs.error || active.error || archived.error
  if (error) return <ErrorNotice message={error} />
  return <Events programs={programs.data ?? []} categories={[...(active.data ?? []), ...(archived.data ?? [])]} adminInfo={adminInfo} />
}

export default function LegacyWorkspaces({ section, access, threadId, onThreadOpened, maximized, onMaximizedChange }: {
  section: LegacySection; access: Access & { user?: { id?: number } }; threadId: number | null
  onThreadOpened: () => void; maximized: boolean; onMaximizedChange: (value: boolean) => void
}) {
  const [selectedTab, setSelectedTab] = useState<string>('')
  const group = legacySections.find(item => item.id === section)!
  const tabs = group.tabs.filter(tab => tab.permission === null || allowed(access, tab.permission))
  const current = tabs.find(tab => tab.id === selectedTab) ?? tabs[0]
  if (!current) return null
  const panel = () => {
    switch (current.id) {
      case 'calendar': return <Calendar />
      case 'floorPlanner': return <FloorPlanner canManage={allowed(access, 'scheduling.manage')} userId={access.user?.id ?? null} />
      case 'messages': return <Messages initialThreadId={threadId} onInitialThreadOpened={onThreadOpened} maximized={maximized} onMaximizedChange={onMaximizedChange} />
      case 'store': return <Store />
      case 'specialPages': return <Pages />
      case 'highlights': return <Popups />
      case 'events': return <EventsWorkspace />
      case 'opportunities': return <Opportunities />
      case 'marketing': return <Marketing canManage={allowed(access, 'marketing.manage')} />
      case 'competitors': return <Competitors />
      case 'analytics': return <Analytics />
      case 'dbQueries': return <Queries />
      case 'schools': return <Schools />
      case 'faqs': return <Faq role="admin" fetcher={adminFetch} />
      case 'waivers': return <Waivers />
      case 'insurance': return <Insurance />
      case 'staffLegal': return <StaffLegal />
      case 'preferences': return <Preferences role="admin" fetcher={adminFetch} />
      case 'staffAccess': return <StaffAccess currentUserId={access.user?.id ?? null} />
      case 'email': return <AdminSettings />
    }
  }
  return <div className={section === 'messaging' || section === 'faqLibrary' ? 'flex flex-col flex-1 min-h-0 h-full overflow-hidden' : 'space-y-4'}>
    {tabs.length > 1 ? <nav aria-label={`${group.label} tabs`} className="flex gap-1 overflow-x-auto border-b border-gray-200 shrink-0">{tabs.map(tab => <button type="button" key={tab.id} aria-current={tab.id === current.id ? 'page' : undefined} onClick={() => setSelectedTab(tab.id)} className={`whitespace-nowrap px-5 py-3 text-sm font-semibold border-b-2 ${tab.id === current.id ? 'border-vortex-red text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>)}</nav> : null}
    {panel()}
  </div>
}
