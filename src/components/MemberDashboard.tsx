import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Home, Calendar, Search, Edit2, UserPlus, CheckCircle, MapPin, Award, Users, Trophy, Eye, X } from 'lucide-react'
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

// Unified Member interface (matching AdminMembers format)
interface UnifiedMember {
  id: number
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  address?: string | null
  dateOfBirth?: string | null
  age?: number | null
  medicalNotes?: string | null
  internalFlags?: string | null
  status: string
  isActive: boolean
  familyIsActive?: boolean
  familyId?: number | null
  familyName?: string | null
  username?: string | null
  roles: Array<{ id: string; role: string }> | string[]
  enrollments: Array<{
    id: number
    program_id: number
    program_display_name: string
    days_per_week: number
    selected_days: string[] | string
  }>
  createdAt?: string
  updatedAt?: string
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
  const [members, setMembers] = useState<UnifiedMember[]>([]) // Combined members list for display
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingMember, setViewingMember] = useState<UnifiedMember | null>(null)
  const [viewingMemberFamilyData, setViewingMemberFamilyData] = useState<any>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [editingMember, setEditingMember] = useState<UnifiedMember | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  
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

  // Helper function to format time since a date
  const formatTimeSince = (date: string | null | undefined): string => {
    if (!date) return 'Never'
    try {
      const enrollmentDate = new Date(date)
      const now = new Date()
      const diffMs = now.getTime() - enrollmentDate.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const diffMonths = Math.floor(diffDays / 30)
      const diffYears = Math.floor(diffDays / 365)
      
      if (diffYears > 0) {
        return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`
      } else if (diffMonths > 0) {
        return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`
      } else if (diffDays > 0) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
      } else {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
        if (diffHours > 0) {
          return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
        } else {
          const diffMinutes = Math.floor(diffMs / (1000 * 60))
          return diffMinutes > 0 ? `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago` : 'Just now'
        }
      }
    } catch (error) {
      return 'Invalid date'
    }
  }
  
  // Helper function to get most recent enrollment date
  const getMostRecentEnrollmentDate = (enrollments: Array<{ created_at?: string; createdAt?: string }>): string | null => {
    if (!enrollments || enrollments.length === 0) return null
    const dates = enrollments
      .map(e => e.created_at || e.createdAt)
      .filter(d => d != null)
      .map(d => new Date(d!).getTime())
    if (dates.length === 0) return null
    const mostRecent = new Date(Math.max(...dates))
    return mostRecent.toISOString()
  }

  // Check if current member is an adult (can edit family members)
  const isAdult = () => {
    // Check if user has PARENT_GUARDIAN role (support both single role and multiple roles)
    const roles = profileData?.roles || (profileData?.role ? [profileData.role] : [])
    return roles.includes('PARENT_GUARDIAN')
  }

  // Handle view member - similar to AdminMembers
  const handleViewMember = async (member: UnifiedMember) => {
    try {
      // Use the member from the list directly (data already fetched)
      setViewingMember(member)
      
      // If member has a family, set family data from existing members
      if (member.familyId && members.length > 1) {
        const familyMembersList = members.filter(m => m.familyId === member.familyId)
        setViewingMemberFamilyData({ members: familyMembersList })
      } else {
        setViewingMemberFamilyData(null)
      }
      
      setShowViewModal(true)
    } catch (error) {
      console.error('Error viewing member:', error)
      alert('Failed to load member data')
    }
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
      setError(null)
      
      if (!token) {
        setError('No authentication token found. Please log in again.')
        setLoading(false)
        return
      }
      
      console.log('[MemberDashboard] Fetching profile data from:', `${apiUrl}/api/members/me`)
      console.log('[MemberDashboard] Token exists:', !!token, 'Token length:', token?.length)
      
      const response = await fetch(`${apiUrl}/api/members/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('[MemberDashboard] Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
        console.error('[MemberDashboard] Error response:', errorData)
        setError(errorData.message || `Failed to load profile data (${response.status})`)
        setLoading(false)
        return
      }
      
      const data = await response.json()
      console.log('[MemberDashboard] Profile data received:', data)
      
      const member = data.data || data.member
      if (!member) {
        setError('No member data received from server')
        setLoading(false)
        return
      }
      
      setProfileData(member)
      
      // Convert current member to UnifiedMember format
      const currentMember: UnifiedMember = {
        id: member.id,
        firstName: member.firstName || member.first_name,
        lastName: member.lastName || member.last_name,
        email: member.email,
        phone: member.phone,
        address: member.address,
        dateOfBirth: member.dateOfBirth || member.date_of_birth,
        age: member.age,
        medicalNotes: member.medicalNotes || member.medical_notes,
        internalFlags: member.internalFlags || member.internal_flags,
        status: member.status || 'Active',
        isActive: member.isActive !== undefined ? member.isActive : true,
        familyIsActive: member.familyIsActive || member.family_is_active,
        familyId: member.familyId || member.family_id,
        familyName: member.familyName || member.family_name,
        username: member.username,
        roles: member.roles || [],
        enrollments: member.enrollments || [],
        createdAt: member.createdAt || member.created_at,
        updatedAt: member.updatedAt || member.updated_at
      }
      
      // Also set family members from the response
      const membersList: UnifiedMember[] = [currentMember]
      
      if (data.familyMembers && Array.isArray(data.familyMembers)) {
        // Convert to FamilyMember format
        const convertedFamilyMembers = data.familyMembers.map((fm: any) => ({
          id: fm.id,
          first_name: fm.firstName || fm.first_name,
          last_name: fm.lastName || fm.last_name,
          email: fm.email,
          phone: fm.phone,
          date_of_birth: fm.dateOfBirth || fm.date_of_birth,
          age: fm.age,
          user_id: fm.id,
          is_adult: fm.roles?.some((r: any) => typeof r === 'string' ? r === 'PARENT_GUARDIAN' : r.role === 'PARENT_GUARDIAN') || false
        }))
        setFamilyMembers(convertedFamilyMembers)
        
        // Convert family members to UnifiedMember format
        data.familyMembers.forEach((fm: any) => {
          const unifiedMember: UnifiedMember = {
            id: fm.id,
            firstName: fm.firstName || fm.first_name,
            lastName: fm.lastName || fm.last_name,
            email: fm.email,
            phone: fm.phone,
            address: fm.address,
            dateOfBirth: fm.dateOfBirth || fm.date_of_birth,
            age: fm.age,
            medicalNotes: fm.medicalNotes || fm.medical_notes,
            internalFlags: fm.internalFlags || fm.internal_flags,
            status: fm.status || 'Active',
            isActive: fm.isActive !== undefined ? fm.isActive : true,
            familyIsActive: fm.familyIsActive || fm.family_is_active,
            familyId: fm.familyId || fm.family_id,
            familyName: fm.familyName || fm.family_name,
            username: fm.username,
            roles: fm.roles || [],
            enrollments: fm.enrollments || [],
            createdAt: fm.createdAt || fm.created_at,
            updatedAt: fm.updatedAt || fm.updated_at
          }
          membersList.push(unifiedMember)
        })
      }
      
      setMembers(membersList)
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
                {/* Members Section - Matching AdminMembers Format */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
                      Family Members ({members.length})
                    </h2>
                  </div>

                  {loading ? (
                    <div className="text-center py-12 text-gray-600">Loading members...</div>
                  ) : error ? (
                    <div className="text-center py-12 text-red-600">{error}</div>
                  ) : members.length === 0 ? (
                    <div className="text-center py-12 text-gray-600">No members found</div>
                  ) : (
                    <div className="space-y-4">
                      {members.map((member) => {
                        const hasEnrollments = member.enrollments && member.enrollments.length > 0
                        const enrollmentStatus = hasEnrollments ? 'Athlete' : 'Non-Participant'
                        const rolesList = Array.isArray(member.roles)
                          ? member.roles.map(r => typeof r === 'string' ? r : r.role).join(', ')
                          : 'No roles'
                        
                        return (
                          <div 
                            key={member.id}
                            className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                          >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-black font-semibold text-lg">
                                    {member.firstName} {member.lastName}
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
                                  Roles: {rolesList} • Status: {member.status}
                                  {member.familyName && ` • Family: ${member.familyName}`}
                                  {member.familyId && ` (ID: ${member.familyId})`}
                                </div>
                                {hasEnrollments && (
                                  <div className="text-gray-500 text-xs mt-1">
                                    Enrolled in: {member.enrollments.map(e => e.program_display_name).join(', ')}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <motion.button
                                  onClick={() => handleViewMember(member)}
                                  className="flex items-center space-x-2 px-3 py-2 rounded-lg font-semibold text-sm transition-colors bg-blue-600 text-white hover:bg-blue-700"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <Eye className="w-4 h-4" />
                                  <span>View</span>
                                </motion.button>
                                {(isAdult() || member.id === profileData?.id) && (
                                  <motion.button
                                    onClick={() => {
                                      setEditingMember(member)
                                      setShowEditModal(true)
                                    }}
                                    className="flex items-center space-x-2 px-3 py-2 rounded-lg font-semibold text-sm transition-colors bg-green-600 text-white hover:bg-green-700"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    <span>Edit</span>
                                  </motion.button>
                                )}
                              </div>
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

      {/* View Member Modal - Matching AdminMembers */}
      <AnimatePresence>
        {showViewModal && viewingMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setShowViewModal(false)
                setViewingMember(null)
                setViewingMemberFamilyData(null)
              }}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-6xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">
                  View Member: {viewingMember.firstName} {viewingMember.lastName}
                </h3>
                <button
                  onClick={() => {
                    setShowViewModal(false)
                    setViewingMember(null)
                    setViewingMemberFamilyData(null)
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Family Information */}
                {viewingMember.familyId && (
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="text-lg font-semibold text-white mb-3">Family Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-semibold text-gray-300">Family Name:</span>
                        <div className="text-white">{viewingMember.familyName || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Member Basic Information */}
                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="text-lg font-semibold text-white mb-3">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-semibold text-gray-300">First Name:</span>
                      <div className="text-white">{viewingMember.firstName}</div>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-300">Last Name:</span>
                      <div className="text-white">{viewingMember.lastName}</div>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-300">Email:</span>
                      <div className="text-white">{viewingMember.email || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-300">Phone:</span>
                      <div className="text-white">{viewingMember.phone || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-300">Username:</span>
                      <div className="text-white">{viewingMember.username || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-300">Date of Birth:</span>
                      <div className="text-white">
                        {viewingMember.dateOfBirth 
                          ? new Date(viewingMember.dateOfBirth).toLocaleDateString()
                          : 'N/A'}
                      </div>
                    </div>
                    {viewingMember.age !== null && viewingMember.age !== undefined && (
                      <div>
                        <span className="text-sm font-semibold text-gray-300">Age:</span>
                        <div className="text-white">{viewingMember.age}</div>
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-semibold text-gray-300">Address:</span>
                      <div className="text-white">{viewingMember.address || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {/* Status and Roles */}
                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="text-lg font-semibold text-white mb-3">Status and Roles</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-semibold text-gray-300">Status:</span>
                      <div className="mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          viewingMember.isActive 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-500 text-white'
                        }`}>
                          {viewingMember.isActive ? 'Active' : 'Archived'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-300">Enrollment Status:</span>
                      <div className="mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          viewingMember.status === 'athlete' || viewingMember.status === 'enrolled'
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-500 text-white'
                        }`}>
                          {viewingMember.status || 'Non-Participant'}
                        </span>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-sm font-semibold text-gray-300">Roles:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {viewingMember.roles && viewingMember.roles.length > 0 ? (
                          viewingMember.roles.map((role, idx) => (
                            <span key={idx} className="px-2 py-1 rounded text-xs font-semibold bg-purple-600 text-white">
                              {typeof role === 'string' ? role : role.role}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-sm">No roles assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enrollments */}
                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="text-lg font-semibold text-white mb-3">Active Enrollments</h4>
                  {viewingMember.enrollments && viewingMember.enrollments.length > 0 ? (
                    <div className="space-y-2">
                      {viewingMember.enrollments.map((enrollment: any) => {
                        const selectedDaysArray = Array.isArray(enrollment.selected_days) 
                          ? enrollment.selected_days 
                          : (typeof enrollment.selected_days === 'string' 
                              ? JSON.parse(enrollment.selected_days || '[]') 
                              : [])
                        const enrollmentDate = enrollment.createdAt || enrollment.created_at
                        return (
                          <div key={enrollment.id} className="bg-gray-600 p-3 rounded">
                            <div className="text-white font-medium">
                              {enrollment.program_display_name || enrollment.programDisplayName || 'Unknown Class'}
                            </div>
                            <div className="text-gray-400 text-sm mt-1">
                              {enrollment.days_per_week || enrollment.daysPerWeek} day{(enrollment.days_per_week || enrollment.daysPerWeek) !== 1 ? 's' : ''}/week
                              {selectedDaysArray.length > 0 && ` • ${selectedDaysArray.join(', ')}`}
                            </div>
                            {enrollmentDate && (
                              <div className="text-gray-400 text-xs mt-1">
                                Enrolled: {formatTimeSince(enrollmentDate)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">No active enrollments</div>
                  )}
                  {viewingMember.enrollments && viewingMember.enrollments.length > 0 && (
                    <div className="mt-3 text-sm text-gray-300">
                      <span className="font-semibold">Last Enrollment:</span> {formatTimeSince(
                        getMostRecentEnrollmentDate(viewingMember.enrollments.map((e: any) => ({ 
                          created_at: e.created_at, 
                          createdAt: e.createdAt 
                        })))
                      )}
                    </div>
                  )}
                </div>

                {/* Family Members */}
                {viewingMemberFamilyData && viewingMemberFamilyData.members && viewingMemberFamilyData.members.length > 0 && (
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="text-lg font-semibold text-white mb-3">
                      Family Members ({viewingMemberFamilyData.members.length})
                    </h4>
                    <div className="space-y-3">
                      {viewingMemberFamilyData.members.map((familyMember: any) => {
                        const isCurrentMember = familyMember.id === viewingMember.id
                        return (
                          <div 
                            key={familyMember.id} 
                            className={`bg-gray-600 p-4 rounded ${isCurrentMember ? 'ring-2 ring-blue-500' : ''}`}
                          >
                            {isCurrentMember && (
                              <div className="text-xs text-blue-400 font-semibold mb-2">(Current Member)</div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <span className="text-sm font-semibold text-gray-300">Name:</span>
                                <div className="text-white">{familyMember.firstName} {familyMember.lastName}</div>
                              </div>
                              {familyMember.email && (
                                <div>
                                  <span className="text-sm font-semibold text-gray-300">Email:</span>
                                  <div className="text-white">{familyMember.email}</div>
                                </div>
                              )}
                              {familyMember.phone && (
                                <div>
                                  <span className="text-sm font-semibold text-gray-300">Phone:</span>
                                  <div className="text-white">{familyMember.phone}</div>
                                </div>
                              )}
                              {familyMember.dateOfBirth && (
                                <div>
                                  <span className="text-sm font-semibold text-gray-300">Date of Birth:</span>
                                  <div className="text-white">
                                    {new Date(familyMember.dateOfBirth).toLocaleDateString()}
                                  </div>
                                </div>
                              )}
                              {familyMember.age !== null && familyMember.age !== undefined && (
                                <div>
                                  <span className="text-sm font-semibold text-gray-300">Age:</span>
                                  <div className="text-white">{familyMember.age}</div>
                                </div>
                              )}
                              <div>
                                <span className="text-sm font-semibold text-gray-300">Status:</span>
                                <div className="mt-1">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    familyMember.isActive 
                                      ? 'bg-green-600 text-white' 
                                      : 'bg-gray-500 text-white'
                                  }`}>
                                    {familyMember.isActive ? 'Active' : 'Archived'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Additional Information */}
                {(viewingMember.medicalNotes || viewingMember.internalFlags) && (
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="text-lg font-semibold text-white mb-3">Additional Information</h4>
                    {viewingMember.medicalNotes && (
                      <div className="mb-3">
                        <span className="text-sm font-semibold text-gray-300">Medical Notes:</span>
                        <div className="text-white mt-1">{viewingMember.medicalNotes}</div>
                      </div>
                    )}
                    {viewingMember.internalFlags && (
                      <div>
                        <span className="text-sm font-semibold text-gray-300">Internal Flags:</span>
                        <div className="text-white mt-1">{viewingMember.internalFlags}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowViewModal(false)
                    setViewingMember(null)
                    setViewingMemberFamilyData(null)
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
                {(isAdult() || viewingMember.id === profileData?.id) && (
                  <button
                    onClick={() => {
                      setShowViewModal(false)
                      setEditingMember(viewingMember)
                      setShowEditModal(true)
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Edit Member
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Member Modal */}
      <AnimatePresence>
        {showEditModal && editingMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setShowEditModal(false)
                setEditingMember(null)
              }}
            />
            <motion.div
              className="relative bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-black">
                  Edit Member
                </h3>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingMember(null)
                  }}
                  className="text-gray-400 hover:text-black"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="text-center py-12 text-gray-600">
                Edit functionality will use the same form as the admin portal. 
                <br />
                Coming soon!
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
