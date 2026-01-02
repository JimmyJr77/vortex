import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Home, Calendar, Search, Edit2, Save, X, UserPlus, CheckCircle, MapPin, Award, Users, Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getApiUrl } from '../utils/api'

interface MemberDashboardProps {
  member: any
  onLogout: () => void
  onReturnToWebsite?: () => void
}

type MemberTab = 'profile' | 'classes' | 'events'

interface FamilyMember {
  id: number
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  date_of_birth?: string | null
  age?: number | null
  user_id?: number | null
  is_adult?: boolean
  marked_for_removal?: boolean
}

interface Category {
  id: number
  name: string
  displayName: string
  description?: string | null
  archived: boolean
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
}

interface Event {
  id: string | number
  eventName: string
  shortDescription: string
  longDescription: string
  startDate: Date | string
  endDate?: Date | string
  type?: 'camp' | 'class' | 'event' | 'watch-party'
  datesAndTimes?: any[]
  keyDetails?: string[]
  address?: string
  archived?: boolean
}

export default function MemberDashboard({ member: _member, onLogout, onReturnToWebsite }: MemberDashboardProps) {
  const [activeTab, setActiveTab] = useState<MemberTab>('profile')
  const [profileData, setProfileData] = useState<any>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileFormData, setProfileFormData] = useState<any>({})
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [editingFamilyMemberId, setEditingFamilyMemberId] = useState<number | null>(null)
  const [familyMemberFormData, setFamilyMemberFormData] = useState<Partial<FamilyMember>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Classes tab state
  const [classes, setClasses] = useState<Program[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [classSearchQuery, setClassSearchQuery] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | 'all'>('all')
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [selectedClassForEnrollment, setSelectedClassForEnrollment] = useState<Program | null>(null)
  const [selectedFamilyMemberForEnrollment, setSelectedFamilyMemberForEnrollment] = useState<number | null>(null)
  const [daysPerWeek, setDaysPerWeek] = useState<number>(1)
  const [classesLoading, setClassesLoading] = useState(false)
  
  // Events tab state
  const [events, setEvents] = useState<Event[]>([])
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [eventsLoading, setEventsLoading] = useState(false)

  const apiUrl = getApiUrl()
  const token = localStorage.getItem('vortex_member_token')

  // Check if current member is an adult (can edit family members)
  const isAdult = () => {
    // Check if user role is PARENT_GUARDIAN
    return profileData?.role === 'PARENT_GUARDIAN'
  }

  useEffect(() => {
    fetchProfileData()
    fetchFamilyMembers()
  }, [])

  useEffect(() => {
    if (activeTab === 'classes') {
      fetchClasses()
      fetchCategories()
    } else if (activeTab === 'events') {
      fetchEvents()
    }
  }, [activeTab])

  const fetchProfileData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${apiUrl}/api/members/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const member = data.data || data.member
        setProfileData(member)
        // Handle both full_name and first_name/last_name formats
        const firstName = member.firstName || (member.full_name ? member.full_name.split(' ')[0] : '')
        const lastName = member.lastName || (member.full_name ? member.full_name.split(' ').slice(1).join(' ') : '')
        setProfileFormData({
          first_name: firstName,
          last_name: lastName,
          email: member.email || '',
          phone: member.phone || '',
          address: member.address || ''
        })
      } else {
        setError('Failed to load profile data')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      setError('Unable to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const fetchFamilyMembers = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/members/family`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setFamilyMembers(data.familyMembers || [])
      }
    } catch (error) {
      console.error('Error fetching family members:', error)
    }
  }

  const fetchClasses = async () => {
    try {
      setClassesLoading(true)
      const response = await fetch(`${apiUrl}/api/admin/programs?archived=false`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        // Filter out archived classes and only show active ones
        setClasses((data.programs || []).filter((p: Program) => !p.archived && p.isActive))
      } else {
        // If admin endpoint fails, try public endpoint
        const publicResponse = await fetch(`${apiUrl}/api/admin/programs?archived=false`)
        if (publicResponse.ok) {
          const publicData = await publicResponse.json()
          setClasses((publicData.programs || []).filter((p: Program) => !p.archived && p.isActive))
        }
      }
    } catch (error) {
      console.error('Error fetching classes:', error)
    } finally {
      setClassesLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/categories?archived=false`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        // Filter out archived categories
        setCategories((data.categories || []).filter((c: Category) => !c.archived))
      } else {
        // If admin endpoint fails, try public endpoint
        const publicResponse = await fetch(`${apiUrl}/api/admin/categories?archived=false`)
        if (publicResponse.ok) {
          const publicData = await publicResponse.json()
          setCategories((publicData.categories || []).filter((c: Category) => !c.archived))
        }
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchEvents = async () => {
    try {
      setEventsLoading(true)
      // Use public events endpoint
      const response = await fetch(`${apiUrl}/api/events`)
      
      if (response.ok) {
        const data = await response.json()
        // Filter out archived events - handle both response formats
        const eventsList = data.events || data.data || data || []
        const activeEvents = eventsList.filter((e: Event) => !e.archived)
        // Convert date strings to Date objects
        const eventsWithDates = activeEvents.map((e: Event) => ({
          ...e,
          startDate: new Date(e.startDate),
          endDate: e.endDate ? new Date(e.endDate) : undefined
        }))
        setEvents(eventsWithDates)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setEventsLoading(false)
    }
  }

  const handleUpdateProfile = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/members/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileFormData)
      })
      
      if (response.ok) {
        await fetchProfileData()
        setEditingProfile(false)
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile')
    }
  }

  const handleUpdateFamilyMember = async (memberId: number) => {
    if (!isAdult()) {
      alert('Only adults can edit family member information')
      return
    }

    try {
      const response = await fetch(`${apiUrl}/api/members/family/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(familyMemberFormData)
      })
      
      if (response.ok) {
        await fetchFamilyMembers()
        setEditingFamilyMemberId(null)
        setFamilyMemberFormData({})
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update family member')
      }
    } catch (error) {
      console.error('Error updating family member:', error)
      alert('Failed to update family member')
    }
  }

  const handleMarkForRemoval = async (memberId: number) => {
    if (!isAdult()) {
      alert('Only adults can mark family members for removal')
      return
    }

    if (!confirm('Are you sure you want to mark this family member for removal? This will notify the site administrator.')) {
      return
    }

    try {
      const response = await fetch(`${apiUrl}/api/members/family/${memberId}/mark-for-removal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        await fetchFamilyMembers()
        alert('Family member marked for removal. The administrator will be notified.')
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to mark for removal')
      }
    } catch (error) {
      console.error('Error marking for removal:', error)
      alert('Failed to mark for removal')
    }
  }

  const handleEnrollInClass = async () => {
    if (!selectedClassForEnrollment || !selectedFamilyMemberForEnrollment) {
      alert('Please select a class and family member')
      return
    }

    try {
      const response = await fetch(`${apiUrl}/api/members/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          programId: selectedClassForEnrollment.id,
          familyMemberId: selectedFamilyMemberForEnrollment,
          daysPerWeek: daysPerWeek
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(data.message || 'Successfully enrolled in class!')
        setShowEnrollModal(false)
        setSelectedClassForEnrollment(null)
        setSelectedFamilyMemberForEnrollment(null)
        setDaysPerWeek(1)
        // Refresh family members to show updated athlete status
        await fetchFamilyMembers()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to enroll in class')
      }
    } catch (error) {
      console.error('Error enrolling in class:', error)
      alert('Failed to enroll in class')
    }
  }

  const startEditFamilyMember = (member: FamilyMember) => {
    if (!isAdult()) {
      alert('Only adults can edit family member information')
      return
    }
    setEditingFamilyMemberId(member.id)
    setFamilyMemberFormData({
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email || '',
      phone: member.phone || ''
    })
  }

  // Filter classes based on search and category
  const filteredClasses = classes.filter(program => {
    // Category filter
    if (selectedCategoryFilter !== 'all') {
      if (program.categoryId !== selectedCategoryFilter) {
        return false
      }
    }
    
    // Search filter
    if (classSearchQuery.trim()) {
      const query = classSearchQuery.toLowerCase()
      const searchableText = [
        program.displayName,
        program.name,
        program.description || '',
        program.skillRequirements || ''
      ].join(' ').toLowerCase()
      
      return searchableText.includes(query)
    }
    
    return true
  })

  // Filter events based on search
  const filteredEvents = events.filter(event => {
    if (!eventSearchQuery.trim()) return true
    
    const query = eventSearchQuery.toLowerCase()
    const searchableText = [
      event.eventName,
      event.shortDescription,
      event.longDescription,
      event.address || ''
    ].join(' ').toLowerCase()
    
    return searchableText.includes(query)
  }).sort((a, b) => {
    try {
      const aTime = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime()
      const bTime = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime()
      return aTime - bTime
    } catch {
      return 0
    }
  })

  const formatDate = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const formatDateRange = (start: Date | string, end?: Date | string) => {
    if (!end || (start instanceof Date ? start.getTime() : new Date(start).getTime()) === (end instanceof Date ? end.getTime() : new Date(end).getTime())) {
      return formatDate(start)
    }
    return `${formatDate(start)} - ${formatDate(end)}`
  }

  const getEventIcon = (type?: Event['type']) => {
    switch (type) {
      case 'camp':
        return Award
      case 'class':
        return Users
      case 'watch-party':
        return Trophy
      default:
        return Calendar
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Member Portal Header Section - Dark Background */}
      <div className="bg-gradient-to-br from-black via-gray-900 to-black pt-32 pb-0">
        <div className="container-custom">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white text-center md:text-left">
              VORTEX <span className="text-vortex-red">MEMBER</span> PORTAL
            </h1>
            <div className="flex gap-2">
              {onReturnToWebsite ? (
                <motion.button
                  onClick={onReturnToWebsite}
                  className="flex items-center space-x-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden md:inline">Return to Website</span>
                </motion.button>
              ) : (
                <Link
                  to="/"
                  className="flex items-center space-x-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm"
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden md:inline">Return to Website</span>
                </Link>
              )}
              <motion.button
                onClick={onLogout}
                className="flex items-center space-x-2 bg-vortex-red text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Logout</span>
              </motion.button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-t border-gray-700 mt-6">
            <div className="flex flex-wrap gap-2 md:gap-0">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                  activeTab === 'profile'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Profile
                {activeTab === 'profile' && (
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
            </div>
          </div>
        </div>
      </div>

      {/* Content Section - White Background */}
      <div className="bg-white p-4 md:p-8">
        <div className="container-custom">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Profile Information */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
                      Your Profile
                    </h2>
                    {!editingProfile ? (
                      <button
                        onClick={() => setEditingProfile(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateProfile}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingProfile(false)
                            setProfileFormData({
                              first_name: profileData?.first_name || '',
                              last_name: profileData?.last_name || '',
                              email: profileData?.email || '',
                              phone: profileData?.phone || '',
                              address: profileData?.address || ''
                            })
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm font-medium"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {loading ? (
                    <div className="text-center py-12 text-gray-600">Loading profile...</div>
                  ) : error ? (
                    <div className="text-center py-12 text-red-600">{error}</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                        {editingProfile ? (
                          <input
                            type="text"
                            value={profileFormData.first_name || ''}
                            onChange={(e) => setProfileFormData({ ...profileFormData, first_name: e.target.value })}
                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                          />
                        ) : (
                          <p className="text-gray-900">{profileData?.firstName || profileData?.first_name || (profileData?.full_name ? profileData.full_name.split(' ')[0] : 'N/A')}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                        {editingProfile ? (
                          <input
                            type="text"
                            value={profileFormData.last_name || ''}
                            onChange={(e) => setProfileFormData({ ...profileFormData, last_name: e.target.value })}
                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                          />
                        ) : (
                          <p className="text-gray-900">{profileData?.lastName || profileData?.last_name || (profileData?.full_name ? profileData.full_name.split(' ').slice(1).join(' ') : 'N/A')}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                        {editingProfile ? (
                          <input
                            type="email"
                            value={profileFormData.email || ''}
                            onChange={(e) => setProfileFormData({ ...profileFormData, email: e.target.value })}
                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                          />
                        ) : (
                          <p className="text-gray-900">{profileData?.email || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                        {editingProfile ? (
                          <input
                            type="tel"
                            value={profileFormData.phone || ''}
                            onChange={(e) => setProfileFormData({ ...profileFormData, phone: e.target.value })}
                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                          />
                        ) : (
                          <p className="text-gray-900">{profileData?.phone || 'N/A'}</p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                        {editingProfile ? (
                          <textarea
                            value={profileFormData.address || ''}
                            onChange={(e) => setProfileFormData({ ...profileFormData, address: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                          />
                        ) : (
                          <p className="text-gray-900">{profileData?.address || 'N/A'}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Family Members */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">
                    Family Members
                  </h2>
                  
                  {familyMembers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No family members found</div>
                  ) : (
                    <div className="space-y-4">
                      {familyMembers.map((member) => (
                        <div key={member.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          {editingFamilyMemberId === member.id ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                                  <input
                                    type="text"
                                    value={familyMemberFormData.first_name || ''}
                                    onChange={(e) => setFamilyMemberFormData({ ...familyMemberFormData, first_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                                  <input
                                    type="text"
                                    value={familyMemberFormData.last_name || ''}
                                    onChange={(e) => setFamilyMemberFormData({ ...familyMemberFormData, last_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                                  <input
                                    type="email"
                                    value={familyMemberFormData.email || ''}
                                    onChange={(e) => setFamilyMemberFormData({ ...familyMemberFormData, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                                  <input
                                    type="tel"
                                    value={familyMemberFormData.phone || ''}
                                    onChange={(e) => setFamilyMemberFormData({ ...familyMemberFormData, phone: e.target.value })}
                                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdateFamilyMember(member.id)}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                                >
                                  <Save className="w-4 h-4" />
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingFamilyMemberId(null)
                                    setFamilyMemberFormData({})
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm font-medium"
                                >
                                  <X className="w-4 h-4" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-black mb-2">
                                  {member.first_name} {member.last_name}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                                  {member.email && (
                                    <div>
                                      <span className="font-medium">Email:</span> {member.email}
                                    </div>
                                  )}
                                  {member.phone && (
                                    <div>
                                      <span className="font-medium">Phone:</span> {member.phone}
                                    </div>
                                  )}
                                  {member.date_of_birth && (
                                    <div>
                                      <span className="font-medium">Date of Birth:</span> {new Date(member.date_of_birth).toLocaleDateString()}
                                    </div>
                                  )}
                                  {member.age && (
                                    <div>
                                      <span className="font-medium">Age:</span> {member.age}
                                    </div>
                                  )}
                                </div>
                                {member.marked_for_removal && (
                                  <div className="mt-2 text-sm text-yellow-600 font-medium">
                                    Marked for removal by administrator
                                  </div>
                                )}
                              </div>
                              {isAdult() && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => startEditFamilyMember(member)}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Edit
                                  </button>
                                  {!member.marked_for_removal && (
                                    <button
                                      onClick={() => handleMarkForRemoval(member.id)}
                                      className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm font-medium"
                                    >
                                      <X className="w-4 h-4" />
                                      Mark for Removal
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'classes' && (
              <motion.div
                key="classes"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Search and Filter */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search classes by name, description, or requirements..."
                        value={classSearchQuery}
                        onChange={(e) => setClassSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Category</label>
                      <select
                        value={selectedCategoryFilter === 'all' ? 'all' : String(selectedCategoryFilter)}
                        onChange={(e) => setSelectedCategoryFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                      >
                        <option value="all">All Categories</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={String(cat.id)}>{cat.displayName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Classes List */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">
                    Available Classes {filteredClasses.length > 0 && `(${filteredClasses.length} found)`}
                  </h2>
                  
                  {classesLoading ? (
                    <div className="text-center py-12 text-gray-600">Loading classes...</div>
                  ) : filteredClasses.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      {classSearchQuery || selectedCategoryFilter !== 'all' 
                        ? 'No classes found matching your search criteria'
                        : 'No classes available at this time'}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredClasses.map((program) => {
                        const programCategory = categories.find(c => 
                          c.id === program.categoryId || 
                          c.displayName === program.categoryDisplayName
                        )
                        return (
                          <div key={program.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="text-lg font-semibold text-black">{program.displayName}</h3>
                                  {programCategory && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                      {programCategory.displayName}
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 mb-3">
                                  {program.skillLevel && (
                                    <div>
                                      <span className="font-medium text-gray-600">Skill Level:</span> {program.skillLevel.replace('_', ' ')}
                                    </div>
                                  )}
                                  {(program.ageMin !== null || program.ageMax !== null) && (
                                    <div>
                                      <span className="font-medium text-gray-600">Age Range:</span>{' '}
                                      {program.ageMin !== null ? program.ageMin : 'Any'} - {program.ageMax !== null ? program.ageMax : 'Any'}
                                    </div>
                                  )}
                                  {program.skillRequirements && (
                                    <div className="md:col-span-2">
                                      <span className="font-medium text-gray-600">Requirements:</span> {program.skillRequirements}
                                    </div>
                                  )}
                                  {program.description && (
                                    <div className="md:col-span-2">
                                      <span className="font-medium text-gray-600">Description:</span> {program.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedClassForEnrollment(program)
                                  setShowEnrollModal(true)
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-vortex-red hover:bg-red-700 rounded text-white text-sm font-medium ml-4"
                              >
                                <UserPlus className="w-4 h-4" />
                                Enroll
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'events' && (
            <motion.div
                key="events"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Search Bar */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <div className="relative max-w-2xl">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search events by name, description, or location..."
                      value={eventSearchQuery}
                      onChange={(e) => setEventSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors"
                    />
                  </div>
                </div>

                {/* Events List */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">
                    Upcoming Events {filteredEvents.length > 0 && `(${filteredEvents.length} total)`}
                  </h2>
                  
                  {eventsLoading ? (
                    <div className="text-center py-12 text-gray-600">Loading events...</div>
                  ) : filteredEvents.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      {eventSearchQuery 
                        ? `No events found matching "${eventSearchQuery}"`
                        : 'No events at this time'}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {filteredEvents.map((event) => {
                        const Icon = getEventIcon(event.type)
                        return (
                          <div
                            key={event.id}
                            className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border-2 border-gray-200"
                          >
                            <div className="flex items-center space-x-4 mb-4">
                              <div className="w-12 h-12 bg-vortex-red/10 rounded-xl flex items-center justify-center">
                                <Icon className="w-6 h-6 text-vortex-red" />
                              </div>
                              <div>
                                <h3 className="text-2xl font-display font-bold text-black">
                                  {event.eventName}
                                </h3>
                                <p className="text-gray-600 flex items-center space-x-2 mt-1">
                                  <Calendar className="w-4 h-4" />
                                  <span>{formatDateRange(event.startDate, event.endDate)}</span>
                                </p>
                              </div>
                            </div>
                            
                            <p className="text-gray-700 mb-4 leading-relaxed">
                              {event.longDescription}
                            </p>
                            
                            {event.keyDetails && event.keyDetails.length > 0 && (
                              <div className="space-y-2 mb-4">
                                <h4 className="font-bold text-black">Key Details:</h4>
                                <ul className="space-y-1">
                                  {event.keyDetails.map((detail, detailIndex) => (
                                    <li key={detailIndex} className="flex items-start space-x-2">
                                      <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0 mt-0.5" />
                                      <span className="text-gray-700 text-sm">{detail}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {event.address && (
                              <div className="mt-4">
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-2 text-vortex-red hover:text-red-700 transition-colors text-sm"
                                >
                                  <MapPin className="w-4 h-4" />
                                  <span className="underline">{event.address}</span>
                                </a>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
            </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Enrollment Modal */}
      <AnimatePresence>
        {showEnrollModal && selectedClassForEnrollment && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
            >
              <button
                onClick={() => {
                  setShowEnrollModal(false)
                  setSelectedClassForEnrollment(null)
                  setSelectedFamilyMemberForEnrollment(null)
                  setDaysPerWeek(1)
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-2xl font-display font-bold text-black mb-4">
                Enroll in {selectedClassForEnrollment.displayName}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Family Member
                  </label>
                  <select
                    value={selectedFamilyMemberForEnrollment || ''}
                    onChange={(e) => setSelectedFamilyMemberForEnrollment(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                  >
                    <option value="">Select a family member...</option>
                    {familyMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Days Per Week
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setDaysPerWeek(Math.max(1, daysPerWeek - 1))}
                      className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="7"
                      value={daysPerWeek}
                      onChange={(e) => setDaysPerWeek(Math.max(1, Math.min(7, parseInt(e.target.value, 10) || 1)))}
                      className="w-20 px-3 py-2 text-center border border-gray-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setDaysPerWeek(Math.min(7, daysPerWeek + 1))}
                      className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleEnrollInClass}
                    className="flex-1 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                  >
                    Enroll
                  </button>
                  <button
                    onClick={() => {
                      setShowEnrollModal(false)
                      setSelectedClassForEnrollment(null)
                      setSelectedFamilyMemberForEnrollment(null)
                      setDaysPerWeek(1)
                    }}
                    className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
