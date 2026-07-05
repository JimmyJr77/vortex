import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { adminApiRequest, clearAdminSession, getAdminToken } from '../utils/api'
import AdminAdmins from './AdminAdmins'
import AdminInquiries from './AdminInquiries'
import AdminMembers from './AdminMembers'
import AdminClasses from './AdminClasses'
import AdminEvents from './AdminEvents'
import AdminAnalytics from './AdminAnalytics'
import AdminHighlights from './AdminHighlights'
import AdminScheduling from './AdminScheduling'
import AdminCalendar from './scheduling/AdminCalendar'
import AdminPricing from './AdminPricing'
import AdminSignups from './AdminSignups'
import AdminMultiClassPasses from './AdminMultiClassPasses'
import AdminDbQueries from './AdminDbQueries'
import AdminSchools from './AdminSchools'
import AdminAccess from './AdminAccess'
import AdminFamilyBilling from './AdminFamilyBilling'
import AdminWaivers from './AdminWaivers'
import AdminSettings from './admin/AdminSettings'
import AdminCoaches from './AdminCoaches'
import AdminEventSignups from './AdminEventSignups'
import AdminInsurance from './AdminInsurance'
import AdminMessagesPanel from './admin/AdminMessagesPanel'
import AdminHomePanel from './admin/AdminHomePanel'
import MessagingFaqMasterPanel from './messaging/MessagingFaqMasterPanel'
import HorizontalScrollContainer from './HorizontalScrollContainer'
import PortalNavButtons from './PortalNavButtons'
import NotificationBell from './NotificationBell'
import PortalPreferencesPanel from './messaging/PortalPreferencesPanel'
import {
  NOTIFICATION_NAV_EVENT,
  type NotificationNavigateDetail,
} from '../utils/notificationNavigation'
import { Home, Users, Inbox, BookOpen, ClipboardList, CalendarDays, DollarSign, FileText, Sparkles, Database, Settings, Menu, X, MessageSquare, Bell } from 'lucide-react'
import type { SchedulingNavigationIntent } from '../utils/schedulingNavigation'
import type { PortalId } from '../utils/portalSession'

interface AdminProps {
  onLogout: () => void
  availablePortals?: PortalId[]
  onSwitchPortal?: (portal: 'admin' | 'coach' | 'member' | 'website') => void
}

interface Program {
  id: number // Database column: id
  category?: string // Legacy enum value - kept for backward compatibility, use categoryId instead
  categoryId?: number | null // Foreign key to program_categories table - SINGLE SOURCE OF TRUTH
  categoryName?: string | null // From database join with program_categories.name
  categoryDisplayName?: string | null // From database join with program_categories.display_name - SINGLE SOURCE OF TRUTH
  name: string // Database column: name
  displayName: string // Database column: display_name
  skillLevel: string | null // Database column: skill_level (enum value from database)
  ageMin: number | null // Database column: age_min
  ageMax: number | null // Database column: age_max
  description: string | null // Database column: description
  skillRequirements: string | null // Database column: skill_requirements
  isActive: boolean // Database column: is_active
  archived?: boolean // Database column: archived
  createdAt: string // Database column: created_at
  updatedAt: string // Database column: updated_at
}

interface Category {
  id: number
  name: string
  displayName: string
  description?: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

type TabType = 'users' | 'analytics' | 'membership' | 'classes' | 'coaches' | 'classesEvents' | 'events' | 'admins' | 'highlights' | 'scheduling' | 'calendar' | 'pricing' | 'signups' | 'multiClassPasses' | 'eventSignups' | 'dbQueries' | 'schools' | 'access' | 'billing' | 'waivers' | 'insurance' | 'email' | 'messages' | 'faqs' | 'preferences'

export type GroupId = 'home' | 'messaging' | 'accounts' | 'leads' | 'classSetup' | 'registrations' | 'calendar' | 'pricingBilling' | 'legal' | 'highlightsEvents' | 'dataAnalysis' | 'preferences' | 'settings'

interface AccessContext {
  permissions: string[]
  roles: string[]
  isMasterAdmin: boolean
  userId?: number | null
}

const tabDefinitions: Array<{ id: TabType; label: string; permission?: string }> = [
  { id: 'admins', label: 'Admins', permission: 'admins.manage' },
  { id: 'membership', label: 'Vortex Accounts', permission: 'members.view' },
  { id: 'messages', label: 'Messages' },
  { id: 'faqs', label: 'FAQ library' },
  { id: 'access', label: 'Access', permission: 'admin_access.manage' },
  { id: 'users', label: 'Inquiries', permission: 'members.view' },
  { id: 'classes', label: 'Classes', permission: 'classes.view' },
  { id: 'coaches', label: 'Coaches', permission: 'classes.manage' },
  { id: 'scheduling', label: 'Scheduling', permission: 'scheduling.view' },
  { id: 'classesEvents', label: 'All Classes/Events', permission: 'classes.view' },
  { id: 'calendar', label: 'Calendar', permission: 'scheduling.view' },
  { id: 'pricing', label: 'Pricing', permission: 'pricing.view' },
  { id: 'billing', label: 'Billing', permission: 'billing.view' },
  { id: 'waivers', label: 'Waivers', permission: 'waivers.view' },
  { id: 'insurance', label: 'Insurance', permission: 'waivers.view' },
  { id: 'signups', label: 'Enrollments', permission: 'scheduling.view' },
  { id: 'multiClassPasses', label: 'Multi-Class Passes', permission: 'scheduling.view' },
  { id: 'eventSignups', label: 'Signups', permission: 'scheduling.view' },
  { id: 'highlights', label: 'Highlights', permission: 'classes.view' },
  { id: 'events', label: 'Events', permission: 'classes.view' },
  { id: 'dbQueries', label: 'Database Queries', permission: 'admin_access.manage' },
  { id: 'email', label: 'Email', permission: 'admin_access.manage' },
  { id: 'schools', label: 'Schools', permission: 'schools.view' },
  { id: 'analytics', label: 'Analytics & Engagement', permission: 'analytics.view' },
  { id: 'preferences', label: 'Preferences' },
]

const tabLabel = (id: TabType): string => tabDefinitions.find((t) => t.id === id)?.label ?? id

interface GroupDef {
  id: GroupId
  label: string
  icon: typeof Home
  sections: TabType[]
}

const GROUPS: GroupDef[] = [
  { id: 'home', label: 'Home', icon: Home, sections: [] },
  { id: 'messaging', label: 'Messages', icon: MessageSquare, sections: ['messages', 'faqs'] },
  { id: 'accounts', label: 'Accounts', icon: Users, sections: ['admins', 'membership', 'access'] },
  { id: 'leads', label: 'Leads', icon: Inbox, sections: ['users'] },
  { id: 'classSetup', label: 'Class Setup', icon: BookOpen, sections: ['classes', 'coaches', 'scheduling', 'classesEvents'] },
  { id: 'registrations', label: 'Enrollments', icon: ClipboardList, sections: ['signups', 'multiClassPasses', 'eventSignups'] },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, sections: ['calendar'] },
  { id: 'pricingBilling', label: 'Pricing & Billing', icon: DollarSign, sections: ['pricing', 'billing'] },
  { id: 'legal', label: 'Legal', icon: FileText, sections: ['waivers', 'insurance'] },
  { id: 'highlightsEvents', label: 'Highlights & Events', icon: Sparkles, sections: ['highlights', 'events'] },
  { id: 'dataAnalysis', label: 'Database & Analysis', icon: Database, sections: ['analytics', 'dbQueries', 'schools'] },
  { id: 'preferences', label: 'Preferences', icon: Bell, sections: ['preferences'] },
  { id: 'settings', label: 'Settings', icon: Settings, sections: ['email'] },
]

const groupForSection = (tab: TabType): GroupId =>
  GROUPS.find((g) => g.sections.includes(tab))?.id ?? 'home'


export default function Admin({ onLogout, availablePortals = ['admin'], onSwitchPortal }: AdminProps) {
  const [activeTab, setActiveTab] = useState<TabType>('users')
  const [activeGroup, setActiveGroup] = useState<GroupId>('home')
  const [navOpen, setNavOpen] = useState(false)
  const [adminInfo, setAdminInfo] = useState<{ email: string; name: string; id?: number; firstName?: string; lastName?: string; phone?: string; username?: string; isMaster?: boolean } | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [schedulingIntent, setSchedulingIntent] = useState<SchedulingNavigationIntent | null>(null)
  const [schedulingNavKey, setSchedulingNavKey] = useState(0)
  const [accessContext, setAccessContext] = useState<AccessContext | null>(null)
  const [accessLoading, setAccessLoading] = useState(true)
  const [openMessageThreadId, setOpenMessageThreadId] = useState<number | null>(null)
  const [messagesMaximized, setMessagesMaximized] = useState(false)

  useEffect(() => {
    if (!getAdminToken()) {
      clearAdminSession()
      onLogout()
      return
    }

    // Get admin info from localStorage (set during login)
    const storedAdmin = localStorage.getItem('vortex-admin-info')
    if (storedAdmin) {
      try {
        setAdminInfo(JSON.parse(storedAdmin))
      } catch {
        // If parsing fails, use default admin info
        const defaultAdmin = { email: 'admin@vortexathletics.com', name: 'Admin' }
        setAdminInfo(defaultAdmin)
        localStorage.setItem('vortex-admin-info', JSON.stringify(defaultAdmin))
      }
    } else {
      // If no admin info stored, use default (shouldn't happen if login worked)
      const defaultAdmin = { email: 'admin@vortexathletics.com', name: 'Admin' }
      setAdminInfo(defaultAdmin)
      localStorage.setItem('vortex-admin-info', JSON.stringify(defaultAdmin))
    }
  }, [onLogout])

  useEffect(() => {
    const loadAccessContext = async () => {
      try {
        const response = await adminApiRequest('/api/admin/access/me')
        if (!response.ok) return
        const data = await response.json()
        if (data.success) {
          setAccessContext({
            permissions: data.data?.permissions ?? [],
            roles: data.data?.roles ?? [],
            isMasterAdmin: Boolean(data.data?.isMasterAdmin),
            userId: data.data?.user?.id ?? null,
          })
        }
      } catch (error) {
        console.warn('Unable to load admin access context:', error)
      } finally {
        setAccessLoading(false)
      }
    }
    void loadAccessContext()
  }, [])

  const visibleTabs = useMemo(
    () =>
      tabDefinitions.filter((tab) => {
        if (!tab.permission) return true
        if (!accessContext) return false
        return accessContext.isMasterAdmin || accessContext.permissions.includes(tab.permission)
      }),
    [accessContext],
  )

  const visibleSectionIds = useMemo(() => new Set(visibleTabs.map((t) => t.id)), [visibleTabs])

  const visibleGroups = useMemo(
    () => GROUPS.filter((g) => g.id === 'home' || g.sections.some((s) => visibleSectionIds.has(s))),
    [visibleSectionIds],
  )

  const visibleSectionsForGroup = useCallback(
    (groupId: GroupId): TabType[] => {
      const group = GROUPS.find((g) => g.id === groupId)
      if (!group) return []
      return group.sections.filter((s) => visibleSectionIds.has(s))
    },
    [visibleSectionIds],
  )

  const goToSection = useCallback((tab: TabType) => {
    setActiveTab(tab)
    setActiveGroup(groupForSection(tab))
  }, [])

  const adminFetch = useCallback(async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const res = await adminApiRequest(endpoint, options)
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.success === false) {
      throw new Error(json?.message || `Request failed: ${res.status}`)
    }
    return (json?.data ?? json) as T
  }, [])

  const openGroup = useCallback(
    (groupId: GroupId) => {
      setActiveGroup(groupId)
      if (groupId !== 'home') {
        const sections = visibleSectionsForGroup(groupId)
        if (sections.length > 0) setActiveTab(sections[0])
      }
      setNavOpen(false)
    },
    [visibleSectionsForGroup],
  )

  useEffect(() => {
    const onNavigateNotification = (evt: globalThis.Event) => {
      const detail = (evt as CustomEvent<NotificationNavigateDetail>).detail
      if (!detail || detail.portal !== 'admin') return
      if (detail.group) openGroup(detail.group as GroupId)
      if (detail.section) goToSection(detail.section as TabType)
      if (detail.threadId != null) setOpenMessageThreadId(detail.threadId)
    }
    window.addEventListener(NOTIFICATION_NAV_EVENT, onNavigateNotification)
    return () => window.removeEventListener(NOTIFICATION_NAV_EVENT, onNavigateNotification)
  }, [goToSection, openGroup])

  useEffect(() => {
    if (activeGroup === 'home') return
    const sections = visibleSectionsForGroup(activeGroup)
    if (sections.length === 0) {
      setActiveGroup('home')
    } else if (!sections.includes(activeTab)) {
      setActiveTab(sections[0])
    }
  }, [activeGroup, activeTab, visibleSectionsForGroup])

  useEffect(() => {
    if (activeTab !== 'messages' && messagesMaximized) setMessagesMaximized(false)
  }, [activeTab, messagesMaximized])

  useEffect(() => {
    if (activeTab === 'events') {
      fetchAllCategories()
      fetchAllPrograms()
    }
  }, [activeTab])

  const fetchAllPrograms = async () => {
    try {
      const response = await adminApiRequest('/api/admin/programs')
      
      if (!response.ok) {
        throw new Error(`Backend returned error`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setPrograms(data.data || [])
      } else {
        setPrograms([])
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
      setPrograms([])
    }
  }

  const fetchAllCategories = async () => {
    try {
      // Fetch both archived and active categories
      const [activeResponse, archivedResponse] = await Promise.all([
        adminApiRequest('/api/admin/categories?archived=false'),
        adminApiRequest('/api/admin/categories?archived=true')
      ])
      
      if (!activeResponse.ok || !archivedResponse.ok) {
        throw new Error(`Backend returned error`)
      }
      
      const [activeData, archivedData] = await Promise.all([
        activeResponse.json(),
        archivedResponse.json()
      ])
      
      if (activeData.success && archivedData.success) {
        setCategories([...activeData.data, ...archivedData.data])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const renderSection = () => {
    switch (activeTab) {
      case 'analytics':
        return <AdminAnalytics />
      case 'access':
        return (
          <AdminAccess
            isMasterAdmin={accessContext?.isMasterAdmin ?? false}
            currentUserId={accessContext?.userId ?? null}
          />
        )
      case 'billing':
        return <AdminFamilyBilling />
      case 'waivers':
        return <AdminWaivers />
      case 'insurance':
        return <AdminInsurance />
      case 'dbQueries':
        return <AdminDbQueries />
      case 'email':
        return <AdminSettings />
      case 'schools':
        return <AdminSchools />
      case 'scheduling':
        return (
          <AdminScheduling
            key={`scheduling-${schedulingNavKey}`}
            navigationIntent={schedulingIntent}
            onNavigationIntentConsumed={() => setSchedulingIntent(null)}
          />
        )
      case 'calendar':
        return <AdminCalendar />
      case 'pricing':
        return <AdminPricing />
      case 'signups':
        return <AdminSignups />
      case 'multiClassPasses':
        return <AdminMultiClassPasses />
      case 'eventSignups':
        return <AdminEventSignups />
      case 'classes':
        return (
          <AdminClasses
            onOpenScheduling={(intent) => {
              setSchedulingIntent(intent)
              setSchedulingNavKey((key) => key + 1)
              goToSection('scheduling')
            }}
          />
        )
      case 'coaches':
        return <AdminCoaches isMasterAdmin={accessContext?.isMasterAdmin ?? false} />
      case 'classesEvents':
        return <AdminClasses spreadsheetOnly />
      case 'highlights':
        return <AdminHighlights />
      case 'events':
        return <AdminEvents programs={programs} categories={categories} adminInfo={adminInfo} />
      case 'admins':
        return <AdminAdmins adminInfo={adminInfo} setAdminInfo={setAdminInfo} />
      case 'membership':
        return <AdminMembers isMasterAdmin={accessContext?.isMasterAdmin ?? false} />
      case 'messages':
        return (
          <AdminMessagesPanel
            initialThreadId={openMessageThreadId}
            onInitialThreadOpened={() => setOpenMessageThreadId(null)}
            maximized={messagesMaximized}
            onMaximizedChange={setMessagesMaximized}
          />
        )
      case 'faqs':
        return (
          <div className="flex flex-col flex-1 min-h-0 h-full max-h-full overflow-hidden">
            <MessagingFaqMasterPanel role="admin" fetcher={adminFetch} />
          </div>
        )
      case 'preferences':
        return <PortalPreferencesPanel role="admin" fetcher={adminFetch} />
      default:
        return <AdminInquiries />
    }
  }

  const groupSections = activeGroup === 'home' ? [] : visibleSectionsForGroup(activeGroup)
  const messagingFullscreen = messagesMaximized && activeTab === 'messages'

  return (
    <div className="min-h-screen h-dvh max-h-dvh bg-gray-50 flex flex-col overflow-hidden">
      {/* Admin Header Section - Dark Background */}
      <div className={`bg-gradient-to-br from-black via-gray-900 to-black shrink-0 ${messagingFullscreen ? 'hidden' : ''}`}>
        <div className="container-admin py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" className="lg:hidden text-white" onClick={() => setNavOpen((o) => !o)}>
              {navOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white">
              VORTEX <span className="text-vortex-red">ADMIN</span>
            </h1>
          </div>
          <PortalNavButtons
            activePortal="admin"
            availablePortals={availablePortals}
            onSwitchPortal={onSwitchPortal}
            onLogout={onLogout}
            notifications={<NotificationBell apiPrefix="admin" />}
          />
        </div>
      </div>

      {/* Workspace: sidebar groups + main content */}
      <div className={`${messagingFullscreen ? 'flex-1 min-h-0 overflow-hidden p-0' : 'container-admin pt-6 pb-6 grid gap-6 lg:grid-cols-[220px_1fr] flex-1 min-h-0 overflow-hidden'}`}>
        <nav className={`${messagingFullscreen ? 'hidden' : navOpen ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-white border border-gray-200 rounded-xl p-2 sticky top-4">
            {visibleGroups.map((group) => {
              const Icon = group.icon
              const active = activeGroup === group.id
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => openGroup(group.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-vortex-red text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <Icon className="w-4 h-4" /> {group.label}
                </button>
              )
            })}
          </div>
        </nav>

        <main className={`min-w-0 flex flex-col min-h-0 flex-1 ${activeGroup === 'messaging' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className="flex flex-col flex-1 min-h-0 h-full">
          {accessLoading ? (
            <div className="rounded-xl bg-white p-8 text-center text-gray-600 shadow-sm">
              Loading admin access...
            </div>
          ) : activeGroup === 'home' ? (
            <AdminHomePanel
              groups={visibleGroups.filter((g) => g.id !== 'home').map((g) => ({ id: g.id, label: g.label, icon: g.icon }))}
              onNavigate={openGroup}
              adminName={adminInfo?.firstName}
            />
          ) : (
            <div className={`${activeTab === 'messages' || activeTab === 'faqs' ? 'flex flex-col flex-1 min-h-0 h-full gap-4' : 'space-y-4'}`}>
              {groupSections.length > 1 && (
                <HorizontalScrollContainer
                  className="border-b border-gray-200"
                  fadeFromClassName="from-gray-50"
                >
                  <div className="flex w-max space-x-1">
                    {groupSections.map((sectionId) => (
                      <button
                        key={sectionId}
                        onClick={() => goToSection(sectionId)}
                        className={`flex-shrink-0 whitespace-nowrap px-5 py-3 font-semibold text-sm transition-all duration-300 relative ${
                          activeTab === sectionId
                            ? 'text-gray-900'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {tabLabel(sectionId)}
                        {activeTab === sectionId && (
                          <motion.div
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-vortex-red"
                            layoutId="activeAdminSubTab"
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </HorizontalScrollContainer>
              )}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className={`min-w-0 ${activeTab === 'messages' ? 'flex flex-col flex-1 min-h-0 h-full' : ''}`}
                >
                  {renderSection()}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  )
}
