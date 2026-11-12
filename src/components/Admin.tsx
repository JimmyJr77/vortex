import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { adminApiRequest, clearAdminSession, getAdminToken } from '../utils/api'
import AdminInquiries from './AdminInquiries'
import AdminMembers from './AdminMembers'
import AdminClasses from './AdminClasses'
import AdminScheduling from './AdminScheduling'
import AdminSignups from './AdminSignups'
import AdminMultiClassPasses from './AdminMultiClassPasses'
import AdminBillingOverview from './AdminBillingOverview'
import BillingAnomaliesPanel from './admin/BillingAnomaliesPanel'
import StaffLegalPolicies from './legal/StaffLegalPolicies'
import AdminEventSignups from './AdminEventSignups'
import AdminHomePanel from './admin/AdminHomePanel'
import AdminDashboard from './admin/AdminDashboard'
import HorizontalScrollContainer from './HorizontalScrollContainer'
import PortalNavButtons from './PortalNavButtons'
import NotificationBell from './NotificationBell'
import {
  NOTIFICATION_NAV_EVENT,
  type NotificationNavigateDetail,
} from '../utils/notificationNavigation'
import { Home, Users, Inbox, BookOpen, ClipboardList, Menu, X, LayoutDashboard, Landmark } from 'lucide-react'
import type { SchedulingNavigationIntent } from '../utils/schedulingNavigation'
import type { PortalId } from '../utils/portalSession'

const AdminPayroll = lazy(() => import('./payroll/AdminPayroll'))

interface AdminProps {
  onLogout: () => void
  availablePortals?: PortalId[]
  onSwitchPortal?: (portal: PortalId) => void
}


type TabType = 'floorPlanner' | 'dashboard' | 'users' | 'payroll' | 'opportunities' | 'analytics' | 'marketing' | 'competitors' | 'membership' | 'billingOverview' | 'classSetupOverview' | 'classes' | 'coaches' | 'classesEvents' | 'events' | 'admins' | 'specialPages' | 'highlights' | 'scheduling' | 'calendar' | 'pricing' | 'customerBilling' | 'billingAnomalies' | 'store' | 'signups' | 'multiClassPasses' | 'eventSignups' | 'dbQueries' | 'schools' | 'access' | 'billing' | 'stripePayments' | 'waivers' | 'insurance' | 'staffLegal' | 'email' | 'messages' | 'faqs' | 'preferences'

export type GroupId = 'floorPlanner' | 'home' | 'dashboard' | 'payroll' | 'opportunityResearch' | 'messaging' | 'faqLibrary' | 'accounts' | 'store' | 'leads' | 'classSetup' | 'registrations' | 'calendar' | 'pricingBilling' | 'legal' | 'highlightsEvents' | 'marketingVisibility' | 'dataAnalysis' | 'preferences' | 'settings'

interface AccessContext {
  permissions: string[]
  roles: string[]
  isMasterAdmin: boolean
  userId?: number | null
}


const tabDefinitions: Array<{ id: TabType; label: string; permission?: string; masterAdminOnly?: boolean }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'payroll', label: 'Payroll', permission: 'payroll.view' },
  { id: 'membership', label: 'Members', permission: 'members.view' },
  { id: 'billingOverview', label: 'Billing Overview', permission: 'billing.view' },
  { id: 'users', label: 'Inquiries', permission: 'members.view' },
  { id: 'classes', label: 'Program & Class Creation', permission: 'classes.view' },
  { id: 'scheduling', label: 'Class & Event Scheduling', permission: 'scheduling.view' },
  { id: 'classesEvents', label: 'All Classes/Events', permission: 'classes.view' },
  { id: 'billingAnomalies', label: 'Billing Anomalies', permission: 'billing.view' },
  { id: 'signups', label: 'Enrollments', permission: 'scheduling.view' },
  { id: 'multiClassPasses', label: 'Multi-Class Passes', permission: 'scheduling.view' },
  { id: 'eventSignups', label: 'Signups', permission: 'scheduling.view' },
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
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, sections: ['dashboard'] },
  { id: 'payroll', label: 'Payroll', icon: Landmark, sections: ['payroll'] },
  { id: 'leads', label: 'Leads', icon: Inbox, sections: ['users'] },
  { id: 'accounts', label: 'Accounts', icon: Users, sections: ['membership', 'billingOverview', 'billingAnomalies'] },
  { id: 'registrations', label: 'Enrollments', icon: ClipboardList, sections: ['signups', 'multiClassPasses', 'eventSignups'] },
  { id: 'classSetup', label: 'Class Setup', icon: BookOpen, sections: ['classesEvents', 'classes', 'scheduling'] },
]

const groupForSection = (tab: TabType): GroupId =>
  GROUPS.find((g) => g.sections.includes(tab))?.id ?? 'home'


export default function Admin({ onLogout, availablePortals = ['admin'], onSwitchPortal }: AdminProps) {
  const [activeTab, setActiveTab] = useState<TabType>(()=>new URLSearchParams(window.location.search).get('payrollQuickbooks')==='connected'?'payroll':'users')
  const [activeGroup, setActiveGroup] = useState<GroupId>(()=>new URLSearchParams(window.location.search).get('payrollQuickbooks')==='connected'?'payroll':'home')
  const [navOpen, setNavOpen] = useState(false)
  const [adminInfo, setAdminInfo] = useState<{ email: string; name: string; id?: number; firstName?: string; lastName?: string; phone?: string; username?: string; isMaster?: boolean } | null>(null)
  const [schedulingIntent, setSchedulingIntent] = useState<SchedulingNavigationIntent | null>(null)
  const [schedulingNavKey, setSchedulingNavKey] = useState(0)
  const [accessContext, setAccessContext] = useState<AccessContext | null>(null)
  const [accessLoading, setAccessLoading] = useState(true)

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
        if (tab.masterAdminOnly && !accessContext?.isMasterAdmin) return false
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

  const openAdminBilling = useCallback((familyId?: number, memberId: number | null = null) => {
    sessionStorage.setItem('vortex_admin_handoff', JSON.stringify({ section: 'billing', familyId, memberId }))
    onSwitchPortal?.('new-admin')
  }, [onSwitchPortal])

  useEffect(() => {
    if (accessLoading) return
    const params = new URLSearchParams(window.location.search)
    const familyId = Number(params.get('adminBillingFamilyId'))
    const memberId = Number(params.get('adminBillingMemberId'))
    if (Number.isSafeInteger(familyId) && familyId > 0) {
      openAdminBilling(familyId, Number.isSafeInteger(memberId) && memberId > 0 ? memberId : null)
    }
  }, [accessLoading, openAdminBilling])

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
      if (detail.section === 'messages' || detail.section === 'billing') {
        sessionStorage.setItem('vortex_admin_handoff', JSON.stringify({ notification: detail }))
        onSwitchPortal?.('new-admin')
        return
      }
      if (detail.group) openGroup(detail.group as GroupId)
      if (detail.section) goToSection(detail.section as TabType)
    }
    window.addEventListener(NOTIFICATION_NAV_EVENT, onNavigateNotification)
    return () => window.removeEventListener(NOTIFICATION_NAV_EVENT, onNavigateNotification)
  }, [goToSection, openGroup, onSwitchPortal])

  useEffect(() => {
    if (accessLoading || activeGroup === 'home') return
    const sections = visibleSectionsForGroup(activeGroup)
    if (sections.length === 0) {
      setActiveGroup('home')
    } else if (!sections.includes(activeTab)) {
      setActiveTab(sections[0])
    }
  }, [accessLoading, activeGroup, activeTab, visibleSectionsForGroup])

  const renderSection = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard onOpenCustomerBilling={() => openAdminBilling()} onOpenEnrollments={() => goToSection('signups')} />
      case 'payroll':
        return <Suspense fallback={<div className="py-16 text-center text-sm font-semibold text-slate-500">Loading payroll…</div>}><AdminPayroll /></Suspense>
      case 'billingOverview':
        return (
          <AdminBillingOverview
            onOpenFamily={(familyId, memberId) => {
              openAdminBilling(familyId, memberId)
            }}
          />
        )
      case 'billingAnomalies':
        return <BillingAnomaliesPanel onOpenAccount={(familyId) => {
          openAdminBilling(familyId)
        }} />
      case 'scheduling':
        return (
          <AdminScheduling
            key={`scheduling-${schedulingNavKey}`}
            navigationIntent={schedulingIntent}
            onNavigationIntentConsumed={() => setSchedulingIntent(null)}
          />
        )
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
      case 'classesEvents':
        return <AdminClasses spreadsheetOnly />
      case 'membership':
        return (
          <AdminMembers
            canCreateAccounts={Boolean(
              accessContext?.isMasterAdmin
              || (
                accessContext?.permissions.includes('members.edit')
                && accessContext?.permissions.includes('scheduling.manage')
              )
            )}
            canViewBilling={Boolean(
              accessContext?.isMasterAdmin || accessContext?.permissions.includes('billing.view')
            )}
            canEditMembers={Boolean(
              accessContext?.isMasterAdmin || accessContext?.permissions.includes('members.edit')
            )}
            canArchiveMembers={Boolean(
              accessContext?.isMasterAdmin || accessContext?.permissions.includes('members.archive')
            )}
            canManageClasses={Boolean(
              accessContext?.isMasterAdmin || accessContext?.permissions.includes('classes.manage')
            )}
          />
        )
      default:
        return <AdminInquiries />
    }
  }

  const groupSections = activeGroup === 'home' ? [] : visibleSectionsForGroup(activeGroup)
  const messagingFullscreen = false

  return (
    <div className="min-h-screen h-dvh max-h-dvh bg-gray-50 flex flex-col overflow-hidden">
      <StaffLegalPolicies portal="admin" />
      {/* Admin Header Section - Dark Background */}
      <div className={`bg-gradient-to-br from-black via-gray-900 to-black shrink-0 ${messagingFullscreen ? 'hidden' : ''}`}>
        <div className="container-admin py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" className="lg:hidden text-white" onClick={() => setNavOpen((o) => !o)}>
              {navOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white">
              VORTEX <span className="text-vortex-red">LEGACY ADMIN</span>
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
      <div className={`${messagingFullscreen ? 'flex flex-col flex-1 min-h-0 h-full max-h-full overflow-hidden p-0' : 'container-admin pt-6 pb-6 grid gap-6 lg:grid-cols-[220px_1fr] flex-1 min-h-0 overflow-hidden'}`}>
        <nav aria-label="Legacy Admin sections" className={messagingFullscreen ? 'hidden' : navOpen ? 'block' : 'hidden lg:block'}>
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

        <main className={`min-w-0 flex flex-col min-h-0 flex-1 ${activeGroup === 'messaging' || activeGroup === 'faqLibrary' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
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
            <div className={`${activeTab === 'messages' || activeTab === 'faqs' ? `flex flex-col flex-1 min-h-0 h-full ${messagingFullscreen ? 'gap-0' : 'gap-4'}` : 'space-y-4'}`}>
              {groupSections.length > 1 && !messagingFullscreen && (
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
                  className={`min-w-0 ${activeTab === 'messages' || activeTab === 'faqs' ? 'flex flex-col flex-1 min-h-0 h-full' : ''}`}
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
