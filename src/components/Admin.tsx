import { useEffect, useMemo, useState } from 'react'
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
import AdminDbQueries from './AdminDbQueries'
import AdminSchools from './AdminSchools'
import AdminAccess from './AdminAccess'
import AdminFamilyBilling from './AdminFamilyBilling'
import AdminWaivers from './AdminWaivers'
import AdminCoaches from './AdminCoaches'
import HorizontalScrollContainer from './HorizontalScrollContainer'
import PortalNavButtons from './PortalNavButtons'
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

type TabType = 'users' | 'analytics' | 'membership' | 'classes' | 'coaches' | 'events' | 'admins' | 'highlights' | 'scheduling' | 'calendar' | 'pricing' | 'signups' | 'dbQueries' | 'schools' | 'access' | 'billing' | 'waivers'

interface AccessContext {
  permissions: string[]
  roles: string[]
  isMasterAdmin: boolean
  userId?: number | null
}

const tabDefinitions: Array<{ id: TabType; label: string; permission?: string }> = [
  { id: 'admins', label: 'Admins', permission: 'admins.manage' },
  { id: 'access', label: 'Access', permission: 'admin_access.manage' },
  { id: 'membership', label: 'Members', permission: 'members.view' },
  { id: 'users', label: 'Inquiries', permission: 'members.view' },
  { id: 'classes', label: 'Classes', permission: 'classes.view' },
  { id: 'coaches', label: 'Coaches', permission: 'classes.manage' },
  { id: 'scheduling', label: 'Scheduling', permission: 'scheduling.view' },
  { id: 'calendar', label: 'Calendar', permission: 'scheduling.view' },
  { id: 'pricing', label: 'Pricing', permission: 'pricing.view' },
  { id: 'billing', label: 'Billing', permission: 'billing.view' },
  { id: 'waivers', label: 'Waivers', permission: 'waivers.view' },
  { id: 'signups', label: 'Signups', permission: 'scheduling.view' },
  { id: 'highlights', label: 'Highlights', permission: 'classes.view' },
  { id: 'events', label: 'Events', permission: 'classes.view' },
  { id: 'dbQueries', label: 'DB Queries', permission: 'admin_access.manage' },
  { id: 'schools', label: 'Schools', permission: 'schools.view' },
  { id: 'analytics', label: 'Analytics & Engagement', permission: 'analytics.view' },
]


export default function Admin({ onLogout, availablePortals = ['admin'], onSwitchPortal }: AdminProps) {
  const [activeTab, setActiveTab] = useState<TabType>('users')
  const [adminInfo, setAdminInfo] = useState<{ email: string; name: string; id?: number; firstName?: string; lastName?: string; phone?: string; username?: string; isMaster?: boolean } | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [categories, setCategories] = useState<Category[]>([])
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
        if (!tab.permission) return true
        if (!accessContext) return false
        return accessContext.isMasterAdmin || accessContext.permissions.includes(tab.permission)
      }),
    [accessContext],
  )

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id)
    }
  }, [activeTab, visibleTabs])

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

  return (
    <div className="min-h-screen bg-white">
      {/* Admin Header Section - Dark Background */}
      <div className="bg-gradient-to-br from-black via-gray-900 to-black pt-4 pb-0">
        <div className="container-admin">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white text-center md:text-left">
              VORTEX <span className="text-vortex-red">ADMIN</span>
            </h1>
          <PortalNavButtons
            activePortal="admin"
            availablePortals={availablePortals}
            onSwitchPortal={onSwitchPortal}
            onLogout={onLogout}
          />
          </div>

          {/* Tabs */}
          <HorizontalScrollContainer
            className="border-t border-gray-700"
            fadeFromClassName="from-gray-900"
          >
            <div className="flex w-max mx-auto space-x-1">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 whitespace-nowrap px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                    activeTab === tab.id
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                      layoutId="activeTab"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </HorizontalScrollContainer>
        </div>
      </div>

      {/* Content Section - White Background */}
      <div className="bg-white">
        <div className="container-admin py-4 md:py-8">

          {accessLoading ? (
            <div className="rounded-xl bg-white p-8 text-center text-gray-600 shadow-sm">
              Loading admin access...
            </div>
          ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'analytics' ? (
              <AdminAnalytics />
            ) : activeTab === 'access' ? (
              <AdminAccess
                isMasterAdmin={accessContext?.isMasterAdmin ?? false}
                currentUserId={accessContext?.userId ?? null}
              />
            ) : activeTab === 'billing' ? (
              <AdminFamilyBilling />
            ) : activeTab === 'waivers' ? (
              <AdminWaivers />
            ) : activeTab === 'dbQueries' ? (
              <AdminDbQueries />
            ) : activeTab === 'schools' ? (
              <AdminSchools />
            ) : activeTab === 'scheduling' ? (
              <AdminScheduling
                key={`scheduling-${schedulingNavKey}`}
                navigationIntent={schedulingIntent}
                onNavigationIntentConsumed={() => setSchedulingIntent(null)}
              />
            ) : activeTab === 'calendar' ? (
              <AdminCalendar />
            ) : activeTab === 'pricing' ? (
              <AdminPricing />
            ) : activeTab === 'signups' ? (
              <AdminSignups />
            ) : activeTab === 'classes' ? (
              <AdminClasses
                onOpenScheduling={(intent) => {
                  setSchedulingIntent(intent)
                  setSchedulingNavKey((key) => key + 1)
                  setActiveTab('scheduling')
                }}
              />
            ) : activeTab === 'coaches' ? (
              <AdminCoaches isMasterAdmin={accessContext?.isMasterAdmin ?? false} />
            ) : activeTab === 'highlights' ? (
              <AdminHighlights />
            ) : activeTab === 'events' ? (
              <AdminEvents programs={programs} categories={categories} adminInfo={adminInfo} />
            ) : activeTab === 'admins' ? (
              <AdminAdmins adminInfo={adminInfo} setAdminInfo={setAdminInfo} />
            ) : activeTab === 'membership' ? (
              <AdminMembers isMasterAdmin={accessContext?.isMasterAdmin ?? false} />
            ) : (
              <AdminInquiries />
            )}
            </AnimatePresence>
          )}
          </div>
        </div>

    </div>
  )
}
