import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Home, Calendar, Search, Edit2, UserPlus, CheckCircle, MapPin, Award, Users, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getApiUrl } from '../utils/api'
import EnrollmentForm from './EnrollmentForm'

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
  tagType?: 'all_classes_and_parents' | 'specific_classes' | 'specific_categories' | 'all_parents' | 'boosters' | 'volunteers'
  tagClassIds?: number[]
  tagCategoryIds?: number[]
  tagAllParents?: boolean
  tagBoosters?: boolean
  tagVolunteers?: boolean
}

export default function MemberDashboard({ member: _member, onLogout, onReturnToWebsite }: MemberDashboardProps) {
  const [activeTab, setActiveTab] = useState<MemberTab>('profile')
  const [profileData, setProfileData] = useState<any>(null)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Classes tab state
  const [classes, setClasses] = useState<Program[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [classSearchQuery, setClassSearchQuery] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | 'all'>('all')
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [selectedClassForEnrollment, setSelectedClassForEnrollment] = useState<Program | null>(null)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const [classesLoading, setClassesLoading] = useState(false)
  
  // Events tab state
  const [events, setEvents] = useState<Event[]>([])
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [eventsLoading, setEventsLoading] = useState(false)
  const [showAllEvents, setShowAllEvents] = useState(true)
  const [selectedFamilyMembersForFilter, setSelectedFamilyMembersForFilter] = useState<number[]>([])

  const apiUrl = getApiUrl()
  const token = localStorage.getItem('vortex_member_token')

  // Check if current member is an adult (can edit family members)
  const isAdult = () => {
    // Check if user has PARENT_GUARDIAN role (support both single role and multiple roles)
    const roles = profileData?.roles || (profileData?.role ? [profileData.role] : [])
    return roles.includes('PARENT_GUARDIAN')
  }

  useEffect(() => {
    fetchProfileData()
  }, [])

  useEffect(() => {
    if (activeTab === 'classes') {
      fetchClasses()
      fetchCategories()
      fetchEnrollments()
    } else if (activeTab === 'events') {
      fetchEvents()
      fetchEnrollments() // Need enrollments for filtering
    } else if (activeTab === 'profile') {
      fetchEnrollments() // Need enrollments to display on profile
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
        // Also set family members from the response
        if (data.familyMembers && Array.isArray(data.familyMembers)) {
          // Convert to FamilyMember format
          setFamilyMembers(data.familyMembers.map((fm: any) => ({
            id: fm.id,
            first_name: fm.firstName || fm.first_name,
            last_name: fm.lastName || fm.last_name,
            email: fm.email,
            phone: fm.phone,
            date_of_birth: fm.dateOfBirth || fm.date_of_birth,
            age: fm.age,
            user_id: fm.id,
            is_adult: fm.roles?.some((r: any) => typeof r === 'string' ? r === 'PARENT_GUARDIAN' : r.role === 'PARENT_GUARDIAN') || false
          })))
        }
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


  const fetchEnrollments = async () => {
    try {
      setEnrollmentsLoading(true)
      const response = await fetch(`${apiUrl}/api/members/enrollments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setEnrollments(data.enrollments || [])
      }
    } catch (error) {
      console.error('Error fetching enrollments:', error)
    } finally {
      setEnrollmentsLoading(false)
    }
  }

  const handleEnrollInClass = async (enrollmentData: {
    programId: number
    familyMemberId: number
    daysPerWeek: number
    selectedDays: string[]
  }) => {
    try {
      const response = await fetch(`${apiUrl}/api/members/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(enrollmentData)
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(data.message || 'Successfully enrolled in class!')
        setShowEnrollModal(false)
        setSelectedClassForEnrollment(null)
        // Refresh enrollments and profile data (which includes family members)
        await fetchEnrollments()
        await fetchProfileData()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to enroll in class')
        throw new Error(data.message || 'Failed to enroll in class')
      }
    } catch (error) {
      console.error('Error enrolling in class:', error)
      throw error
    }
  }


  // Filter classes based on search and category
  const filteredClasses = classes.filter(program => {
    // Category filter
    if (selectedCategoryFilter !== 'all') {
      // Match by categoryId (handle both number and string comparisons)
      if (program.categoryId != null) {
        if (program.categoryId !== selectedCategoryFilter && String(program.categoryId) !== String(selectedCategoryFilter)) {
          // Also check categoryDisplayName as fallback
          const selectedCategory = categories.find(c => c.id === selectedCategoryFilter)
          if (selectedCategory) {
            if (program.categoryDisplayName !== selectedCategory.displayName) {
              return false
            }
          } else {
            return false
          }
        }
      } else {
        // If categoryId is null, try to match by categoryDisplayName
        const selectedCategory = categories.find(c => c.id === selectedCategoryFilter)
        if (selectedCategory && program.categoryDisplayName !== selectedCategory.displayName) {
          return false
        } else if (!selectedCategory) {
          return false
        }
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

  // Helper function to check if an event should be shown based on tags and family member enrollments
  const isEventRelevant = (event: Event): boolean => {
    // If no tags or tagType is all_classes_and_parents (default), show all events
    if (!event.tagType || event.tagType === 'all_classes_and_parents') {
      return true
    }

    // Get enrolled class IDs for selected family members (or all if none selected)
    const familyMemberIds = selectedFamilyMembersForFilter.length > 0 
      ? selectedFamilyMembersForFilter 
      : familyMembers.map(fm => fm.user_id || fm.id).filter((id): id is number => id !== null && id !== undefined)
    
    // Get enrollments for selected family members
    const relevantEnrollments = enrollments.filter(e => 
      familyMemberIds.includes(e.athlete_user_id)
    )
    const enrolledClassIds = relevantEnrollments.map(e => e.program_id).filter((id): id is number => id !== null && id !== undefined)
    
    // Get classes for enrolled programs to check categories
    const enrolledClasses = classes.filter(c => enrolledClassIds.includes(c.id))
    const enrolledCategoryIds = enrolledClasses
      .map(c => c.categoryId)
      .filter((id): id is number => id !== null && id !== undefined)

    // Check if current user is a parent
    // Check if user has PARENT_GUARDIAN role (support both single role and multiple roles)
    const roles = profileData?.roles || (profileData?.role ? [profileData.role] : [])
    const isParent = roles.includes('PARENT_GUARDIAN')

    // Check event tags
    switch (event.tagType) {
      case 'all_parents':
        return isParent
      
      case 'specific_classes':
        if (!event.tagClassIds || event.tagClassIds.length === 0) return true
        return event.tagClassIds.some(classId => enrolledClassIds.includes(classId))
      
      case 'specific_categories':
        if (!event.tagCategoryIds || event.tagCategoryIds.length === 0) return true
        return event.tagCategoryIds.some(categoryId => enrolledCategoryIds.includes(categoryId))
      
      case 'boosters':
      case 'volunteers':
        // Not applicable yet, but return false for now
        return false
      
      default:
        return true
    }
  }

  // Filter events based on search and relevance
  const filteredEvents = events.filter(event => {
    // Search filter
    if (eventSearchQuery.trim()) {
      const query = eventSearchQuery.toLowerCase()
      const searchableText = [
        event.eventName,
        event.shortDescription,
        event.longDescription,
        event.address || ''
      ].join(' ').toLowerCase()
      
      if (!searchableText.includes(query)) {
        return false
      }
    }
    
    // Relevance filter (only apply if showing related events)
    if (!showAllEvents) {
      return isEventRelevant(event)
    }
    
    return true
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
                {/* Profile Information - Matching Admin Format */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
                      Your Profile
                    </h2>
                    {profileData && (
                      <motion.button
                        onClick={() => alert('Edit functionality coming soon - will use the same form as admin portal')}
                        className="flex items-center space-x-2 px-3 py-2 rounded-lg font-semibold text-sm transition-colors bg-green-600 text-white hover:bg-green-700"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Edit</span>
                      </motion.button>
                    )}
                  </div>

                  {loading ? (
                    <div className="text-center py-12 text-gray-600">Loading profile...</div>
                  ) : error ? (
                    <div className="text-center py-12 text-red-600">{error}</div>
                  ) : profileData ? (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-black font-semibold text-lg">
                              {profileData.firstName || profileData.first_name || (profileData.full_name ? profileData.full_name.split(' ')[0] : '')} {profileData.lastName || profileData.last_name || (profileData.full_name ? profileData.full_name.split(' ').slice(1).join(' ') : '')}
                            </div>
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-green-600 text-white">
                              Active
                            </span>
                            {enrollments && enrollments.length > 0 && (
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-600 text-white">
                                Athlete
                              </span>
                            )}
                          </div>
                          {profileData.email && (
                            <div className="text-gray-600 text-sm mt-1">{profileData.email}</div>
                          )}
                          {profileData.phone && (
                            <div className="text-gray-600 text-sm">{profileData.phone}</div>
                          )}
                          {profileData.age !== null && profileData.age !== undefined && (
                            <div className="text-gray-600 text-sm">Age: {profileData.age}</div>
                          )}
                          <div className="text-gray-500 text-xs mt-1">
                            Roles: {(profileData.roles && profileData.roles.length > 0) 
                              ? (Array.isArray(profileData.roles) 
                                  ? profileData.roles.map((r: any) => typeof r === 'string' ? r : r.role).join(', ')
                                  : profileData.roles)
                              : (profileData.role || 'No roles')} • Status: {profileData.status || 'Active'}
                            {profileData.familyName && ` • Family: ${profileData.familyName}`}
                            {profileData.familyId && ` (ID: ${profileData.familyId})`}
                          </div>
                          {enrollments && enrollments.length > 0 && (
                            <div className="text-gray-500 text-xs mt-1">
                              Enrolled in: {enrollments.map((e: any) => e.program_display_name || e.program_name || 'Unknown').join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Family Members - Matching Admin Format */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">
                    Family Members
                  </h2>
                  
                  {familyMembers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No family members found</div>
                  ) : (
                    <div className="space-y-4">
                      {familyMembers.map((member) => {
                        // Get enrollments for this family member
                        const memberEnrollments = enrollments.filter((e: any) => 
                          (e.athlete_user_id === (member.user_id || member.id))
                        )
                        const hasEnrollments = memberEnrollments.length > 0
                        const enrollmentStatus = hasEnrollments ? 'Athlete' : 'Non-Participant'
                        
                        return (
                          <div 
                            key={member.id} 
                            className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                          >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-black font-semibold text-lg">
                                    {member.first_name} {member.last_name}
                                  </div>
                                  <span className="px-2 py-1 rounded text-xs font-semibold bg-green-600 text-white">
                                    Active
                                  </span>
                                  {hasEnrollments && (
                                    <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-600 text-white">
                                      {enrollmentStatus}
                                    </span>
                                  )}
                                </div>
                                {member.email && (
                                  <div className="text-gray-600 text-sm mt-1">{member.email}</div>
                                )}
                                {member.phone && (
                                  <div className="text-gray-600 text-sm">{member.phone}</div>
                                )}
                                {member.age !== null && member.age !== undefined && (
                                  <div className="text-gray-600 text-sm">Age: {member.age}</div>
                                )}
                                <div className="text-gray-500 text-xs mt-1">
                                  Status: Active
                                  {profileData?.familyName && ` • Family: ${profileData.familyName}`}
                                </div>
                                {hasEnrollments && (
                                  <div className="text-gray-500 text-xs mt-1">
                                    Enrolled in: {memberEnrollments.map((e: any) => e.program_display_name || e.program_name || 'Unknown').join(', ')}
                                  </div>
                                )}
                                {member.marked_for_removal && (
                                  <div className="mt-2 text-sm text-yellow-600 font-medium">
                                    Marked for removal by administrator
                                  </div>
                                )}
                              </div>
                              {isAdult() && (
                                <div className="flex gap-2">
                                  <motion.button
                                    onClick={() => alert('Edit functionality coming soon - will use the same form as admin portal')}
                                    className="flex items-center space-x-2 px-3 py-2 rounded-lg font-semibold text-sm transition-colors bg-green-600 text-white hover:bg-green-700"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    <span>Edit</span>
                                  </motion.button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
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
                {/* Current Enrollments */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">
                    Current Enrollments
                  </h2>
                  
                  {enrollmentsLoading ? (
                    <div className="text-center py-12 text-gray-600">Loading enrollments...</div>
                  ) : enrollments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No enrollments yet. Browse classes below to enroll.</div>
                  ) : (
                    <div className="space-y-4">
                      {enrollments.map((enrollment) => {
                        const program = classes.find(c => c.id === enrollment.program_id)
                        // Find member - check familyMembers first, then check if it's the current user
                        let member = familyMembers.find(fm => 
                          (fm.user_id || fm.id) === enrollment.athlete_user_id
                        )
                        
                        // If not found in familyMembers, check if it's the current user
                        if (!member && enrollment.athlete_user_id === profileData?.id) {
                          member = {
                            id: profileData.id,
                            first_name: profileData.firstName || '',
                            last_name: profileData.lastName || '',
                            user_id: profileData.id
                          }
                        }
                        
                        // Fallback to athlete name from enrollment if available
                        const memberName = member 
                          ? `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'You'
                          : (enrollment.athlete_first_name && enrollment.athlete_last_name
                              ? `${enrollment.athlete_first_name} ${enrollment.athlete_last_name}`
                              : 'Unknown Member')
                        
                        return (
                          <div key={enrollment.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-black mb-2">
                                  {program?.displayName || enrollment.program_display_name || enrollment.program_name || 'Unknown Class'}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                                  <div>
                                    <span className="font-medium">Member:</span> {memberName}
                                  </div>
                                  <div>
                                    <span className="font-medium">Days Per Week:</span> {enrollment.days_per_week || 'N/A'}
                                  </div>
                                  {enrollment.selected_days && enrollment.selected_days.length > 0 && (
                                    <div className="md:col-span-2">
                                      <span className="font-medium">Days:</span> {Array.isArray(enrollment.selected_days) 
                                        ? enrollment.selected_days.join(', ')
                                        : (typeof enrollment.selected_days === 'string' 
                                            ? enrollment.selected_days 
                                            : JSON.parse(enrollment.selected_days).join(', '))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

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
                {/* Search Bar and Filters */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200 space-y-4">
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

                  {/* Toggle between All Events and Related Events */}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="eventFilter"
                        checked={showAllEvents}
                        onChange={() => setShowAllEvents(true)}
                        className="w-4 h-4 text-vortex-red focus:ring-vortex-red"
                      />
                      <span className="text-sm font-semibold text-gray-700">All Events</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="eventFilter"
                        checked={!showAllEvents}
                        onChange={() => setShowAllEvents(false)}
                        className="w-4 h-4 text-vortex-red focus:ring-vortex-red"
                      />
                      <span className="text-sm font-semibold text-gray-700">Related Events</span>
                    </label>
                  </div>

                  {/* Family Member Selector (only show when filtering related events) */}
                  {!showAllEvents && familyMembers.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Filter by Family Members (leave empty to include all)
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {familyMembers.map((member) => {
                          const memberId = member.user_id || member.id
                          return (
                            <label key={member.id} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={selectedFamilyMembersForFilter.includes(memberId)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedFamilyMembersForFilter([...selectedFamilyMembersForFilter, memberId])
                                  } else {
                                    setSelectedFamilyMembersForFilter(selectedFamilyMembersForFilter.filter(id => id !== memberId))
                                  }
                                }}
                                className="w-4 h-4 text-vortex-red focus:ring-vortex-red border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-700">
                                {member.first_name} {member.last_name}
                              </span>
                            </label>
                          )
                        })}
                        {/* Include current user if they're not in familyMembers */}
                        {profileData && !familyMembers.some(fm => (fm.user_id || fm.id) === profileData.id) && (
                          <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={selectedFamilyMembersForFilter.includes(profileData.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFamilyMembersForFilter([...selectedFamilyMembersForFilter, profileData.id])
                                } else {
                                  setSelectedFamilyMembersForFilter(selectedFamilyMembersForFilter.filter(id => id !== profileData.id))
                                }
                              }}
                              className="w-4 h-4 text-vortex-red focus:ring-vortex-red border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700">
                              {profileData.firstName || profileData.first_name} {profileData.lastName || profileData.last_name} (You)
                            </span>
                          </label>
                        )}
                      </div>
                      {selectedFamilyMembersForFilter.length === 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                          No family members selected - showing events for all family members
                        </p>
                      )}
                    </div>
                  )}
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
      {showEnrollModal && selectedClassForEnrollment && (
        <EnrollmentForm
          program={selectedClassForEnrollment}
          familyMembers={familyMembers}
          currentUserId={profileData?.id}
          currentUserName={profileData ? `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || profileData.email : undefined}
          onEnroll={handleEnrollInClass}
          onCancel={() => {
            setShowEnrollModal(false)
            setSelectedClassForEnrollment(null)
          }}
          isOpen={showEnrollModal}
        />
      )}
    </div>
  )
}
