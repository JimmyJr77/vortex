import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut } from 'lucide-react'
import { getApiUrl } from '../utils/api'
import AdminAdmins from './AdminAdmins'
import AdminInquiries from './AdminInquiries'
import AdminMembers from './AdminMembers'
import AdminClasses from './AdminClasses'
import AdminEvents from './AdminEvents'
import AdminAnalytics from './AdminAnalytics'

interface AdminProps {
  onLogout: () => void
}

interface Program {
  id: number
  category: 'EARLY_DEVELOPMENT' | 'GYMNASTICS' | 'VORTEX_NINJA' | 'ATHLETICISM_ACCELERATOR' | 'ADULT_FITNESS' | 'HOMESCHOOL'
  categoryId?: number | null
  categoryName?: string | null
  categoryDisplayName?: string | null
  name: string
  displayName: string
  skillLevel: 'EARLY_STAGE' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | null
  ageMin: number | null
  ageMax: number | null
  description: string | null
  skillRequirements: string | null
  isActive: boolean
  archived?: boolean
  createdAt: string
  updatedAt: string
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

type TabType = 'users' | 'analytics' | 'membership' | 'classes' | 'events' | 'admins'


export default function Admin({ onLogout }: AdminProps) {
  const [activeTab, setActiveTab] = useState<TabType>('users')
  const [adminInfo, setAdminInfo] = useState<{ email: string; name: string; id?: number; firstName?: string; lastName?: string; phone?: string; username?: string; isMaster?: boolean } | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    if (activeTab === 'events') {
      fetchAllCategories()
      fetchAllPrograms()
    }
  }, [activeTab])

  const fetchAllPrograms = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/programs`)
      
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
      const apiUrl = getApiUrl()
      
      // Fetch both archived and active categories
      const [activeResponse, archivedResponse] = await Promise.all([
        fetch(`${apiUrl}/api/admin/categories?archived=false`),
        fetch(`${apiUrl}/api/admin/categories?archived=true`)
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
      <div className="bg-gradient-to-br from-black via-gray-900 to-black pt-32 pb-0">
        <div className="container-custom">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white text-center md:text-left">
              VORTEX <span className="text-vortex-red">ADMIN</span>
            </h1>
          <div className="flex gap-2">
            <motion.button
              onClick={onLogout}
              className="flex items-center space-x-2 bg-vortex-red text-white px-3 md:px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </motion.button>
          </div>
          </div>

          {/* Tabs */}
          <div className="flex justify-center border-t border-gray-700">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('admins')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'admins'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Admins
                {activeTab === 'admins' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'users'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Inquiries
                {activeTab === 'users' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('membership')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'membership'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Members
                {activeTab === 'membership' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('classes')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'classes'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Classes
                {activeTab === 'classes' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'events'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Events
                {activeTab === 'events' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'analytics'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Analytics & Engagement
                {activeTab === 'analytics' && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                    layoutId="activeTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section - White Background */}
      <div className="bg-white p-4 md:p-8">
        <div className="container-custom">

          <AnimatePresence mode="wait">
            {activeTab === 'analytics' ? (
              <AdminAnalytics />
            ) : activeTab === 'classes' ? (
              <AdminClasses />
            ) : activeTab === 'events' ? (
              <AdminEvents programs={programs} categories={categories} adminInfo={adminInfo} />
            ) : activeTab === 'admins' ? (
              <AdminAdmins adminInfo={adminInfo} setAdminInfo={setAdminInfo} />
            ) : activeTab === 'membership' ? (
              <AdminMembers />
            ) : (
              <AdminInquiries />
            )}
            </AnimatePresence>
          </div>
        </div>

    </div>
  )
}
