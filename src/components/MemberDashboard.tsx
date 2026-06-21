import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Search, Edit2, CheckCircle, MapPin, Award, Users, Trophy, Eye, X, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react'
import { getApiUrl } from '../utils/api'
import { formatDateForDisplay, parseDateOnly } from '../utils/dateUtils'
import ClassesOfferedList from './classes/ClassesOfferedList'
import { fetchClassesOffered, type PublicProgramOffered } from '../utils/publicClassesApi'
import EventAttachedSignup from './EventAttachedSignup'
import { MemberTrainingTab, MemberProgressTab, MemberMessagesTab } from './MemberTraining'
import PortalNavButtons from './PortalNavButtons'
import NotificationBell from './NotificationBell'
import type { PortalId } from '../utils/portalSession'

interface MemberDashboardProps {
  member: any
  onLogout: () => void
  onReturnToWebsite?: () => void
  availablePortals?: PortalId[]
  onSwitchPortal?: (portal: 'admin' | 'coach' | 'member' | 'website') => void
}

type MemberTab = 'profile' | 'classes' | 'events' | 'billing' | 'waivers' | 'training' | 'progress' | 'messages'

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
  relationshipLabel?: string | null
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
  images?: string[]
  address?: string
  archived?: boolean
  tagType?: 'all_classes_and_parents' | 'specific_classes' | 'specific_categories' | 'all_parents' | 'boosters' | 'volunteers'
  tagClassIds?: number[]
  tagCategoryIds?: number[]
  tagAllParents?: boolean
  tagBoosters?: boolean
  tagVolunteers?: boolean
  schedulingFormId?: number | null
  schedulingFormTitle?: string | null
}

interface BillingStatement {
  id: number
  statementDate: string
  dueDate: string | null
  totalCents: number
  status: string
  lines: Array<{
    id?: number
    description: string
    amount_cents?: number
    amountCents?: number
    member_id?: number | null
  }>
}

interface BillingPayment {
  id: number
  amountCents: number
  paidAt: string
  method?: string | null
  note?: string | null
  externalReference?: string | null
  externalStatus?: string | null
}

interface MemberWaiver {
  id: number
  name: string
  version: string
  body: string
  acceptance_id?: number | null
  accepted_at?: string | null
  signature_name?: string | null
}

export default function MemberDashboard({
  onLogout,
  availablePortals = ['member'],
  onSwitchPortal,
}: MemberDashboardProps) {
  const [activeTab, setActiveTab] = useState<MemberTab>('profile')
  const [profileData, setProfileData] = useState<any>(null)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [members, setMembers] = useState<UnifiedMember[]>([]) // Combined members list for display
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingMember, setViewingMember] = useState<UnifiedMember | null>(null)
  const [viewingMemberFamilyData, setViewingMemberFamilyData] = useState<any>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddFamilyMember, setShowAddFamilyMember] = useState(false)
  const [addFamilyMemberData, setAddFamilyMemberData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    relationshipLabel: '',
  })
  const [addingFamilyMember, setAddingFamilyMember] = useState(false)
  
  // Edit modal state (for MemberFormSection)
  type FamilyMemberData = {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string
    addressStreet: string
    addressCity: string
    addressState: string
    addressZip: string
    username: string
    password: string
    enrollments?: Array<{
      id: number | string
      program_id: number
      program_display_name: string
      days_per_week: number
      selected_days: string[] | string
    }>
    dateOfBirth: string
    gender: string
    medicalNotes: string
    medicalConcerns: string
    injuryHistoryDate: string
    injuryHistoryBodyPart: string
    injuryHistoryNotes: string
    noInjuryHistory: boolean
    experience: string
    previousClasses?: Array<{
      id: number | string
      program_id: number
      program_display_name: string
      completed_date?: string | null
    }>
    isFinished: boolean
    parentGuardianIds?: number[]
    parentGuardians?: Array<{ id: number; relationship: string; relationshipOther?: string }>
    hasCompletedWaivers?: boolean
    waiverCompletionDate?: string | null
    sections: {
      contactInfo: { isExpanded: boolean; tempData: { firstName: string; lastName: string; email: string; phone: string; addressStreet: string; addressCity: string; addressState: string; addressZip: string } }
      loginSecurity: { isExpanded: boolean; tempData: { username: string; password: string } }
      statusVerification: { isExpanded: boolean }
      personalData?: { isExpanded: boolean; tempData: { dateOfBirth: string; gender: string; medicalConcerns: string; injuryHistoryDate: string; injuryHistoryBodyPart: string; injuryHistoryNotes: string; noInjuryHistory: boolean } }
      parentGuardians?: { isExpanded: boolean; tempData: { parentGuardians: Array<{ id: number; relationship: string; relationshipOther?: string }> } }
      waivers?: { isExpanded: boolean; tempData: { hasCompletedWaivers: boolean; waiverCompletionDate: string | null } }
      previousClasses?: { isExpanded: boolean; tempData: { experience: string } }
    }
    athleteId?: number | null
    userId?: number | null
    user_id?: number | null
    isActive?: boolean
  }
  
  const [editingFamilyMembers, setEditingFamilyMembers] = useState<FamilyMemberData[]>([])
  const [, setExpandedFamilyMemberId] = useState<string | null>(null)
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null)
  
  // Classes tab state
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const [enrollmentView, setEnrollmentView] = useState<'class' | 'member'>('class')
  const [classesOffered, setClassesOffered] = useState<PublicProgramOffered[]>([])
  const [classesOfferedLoading, setClassesOfferedLoading] = useState(false)
  const [classesOfferedError, setClassesOfferedError] = useState<string | null>(null)
  
  // Events tab state
  const [events, setEvents] = useState<Event[]>([])
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [eventsLoading, setEventsLoading] = useState(false)
  const [showAllEvents, setShowAllEvents] = useState(true)
  const [selectedFamilyMembersForFilter, setSelectedFamilyMembersForFilter] = useState<number[]>([])
  const [eventView, setEventView] = useState<'upcoming' | 'past'>('upcoming') // Toggle between past and upcoming events
  const [billingStatements, setBillingStatements] = useState<BillingStatement[]>([])
  const [billingPayments, setBillingPayments] = useState<BillingPayment[]>([])
  const [billingLoading, setBillingLoading] = useState(false)
  const [waivers, setWaivers] = useState<MemberWaiver[]>([])
  const [waiversLoading, setWaiversLoading] = useState(false)
  const [waiverSignature, setWaiverSignature] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const apiUrl = getApiUrl()
  const token = localStorage.getItem('vortex_member_token')

  const formatMoney = (cents: number): string =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

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

  // Helper functions for edit modal (matching AdminMembers)
  const parseAddress = (address: string | null | undefined): { street: string; city: string; state: string; zip: string } => {
    if (!address) return { street: '', city: '', state: '', zip: '' }
    
    const parts = address.split(',').map(p => p.trim()).filter(p => p)
    
    if (parts.length >= 3) {
      const street = parts[0]
      const city = parts[1]
      const stateZip = parts[2] || ''
      const stateZipParts = stateZip.split(/\s+/).filter(p => p)
      
      if (stateZipParts.length >= 2) {
        const state = stateZipParts[0]
        const zip = stateZipParts.slice(1).join(' ')
        return { street, city, state, zip }
      } else if (stateZipParts.length === 1) {
        const value = stateZipParts[0]
        if (value.length === 2) {
          return { street, city, state: value, zip: '' }
        } else {
          return { street, city, state: '', zip: value }
        }
      } else {
        return { street, city, state: '', zip: '' }
      }
    } else if (parts.length === 2) {
      const first = parts[0]
      const second = parts[1]
      const secondParts = second.split(/\s+/).filter(p => p)
      
      if (secondParts.length >= 2 && secondParts[0].length === 2) {
        return { street: first, city: '', state: secondParts[0], zip: secondParts.slice(1).join(' ') }
      } else {
        return { street: first, city: second, state: '', zip: '' }
      }
    } else if (parts.length === 1) {
      return { street: parts[0], city: '', state: '', zip: '' }
    } else {
      return { street: '', city: '', state: '', zip: '' }
    }
  }

  const combineAddress = (street: string, city: string, state: string, zip: string): string => {
    const parts: string[] = []
    const normalizedStreet = (street || '').trim()
    const normalizedCity = (city || '').trim()
    const normalizedState = (state || '').trim()
    const normalizedZip = (zip || '').trim()
    
    if (normalizedStreet) parts.push(normalizedStreet)
    if (normalizedCity) parts.push(normalizedCity)
    
    const stateZip = [normalizedState, normalizedZip].filter(p => p).join(' ')
    if (stateZip) parts.push(stateZip)
    
    return parts.join(', ') || ''
  }


  const cleanPhoneNumber = (phone: string): string => {
    return phone.replace(/\D/g, '')
  }

  // Check if current member is an adult (can edit family members).
  // Logged-in member/athlete accounts are treated as adults — youth athletes
  // are added as family members without their own login — and the backend
  // re-checks adulthood by date of birth on every mutation.
  const isAdult = () => {
    const roles = profileData?.roles || (profileData?.role ? [profileData.role] : [])
    if (roles.length === 0) return true
    return roles.some((r: any) => ['MEMBER_ATHLETE', 'ADMIN', 'MASTER_ADMIN'].includes(typeof r === 'string' ? r : r?.role))
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

  // Handle edit member - populate form with member data
  const handleEditMember = async (member: UnifiedMember) => {
    try {
      setEditingMemberId(member.id)
      
      // Parse address
      const addressParts = parseAddress(member.address || '')
      
      // Create FamilyMemberData from UnifiedMember
      const populatedMember: FamilyMemberData = {
        id: `member-${member.id}`,
        athleteId: member.id,
        userId: member.id,
        user_id: member.id,
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        email: member.email || '',
        phone: member.phone || '',
        addressStreet: addressParts.street,
        addressCity: addressParts.city,
        addressState: addressParts.state,
        addressZip: addressParts.zip,
        username: member.username || '',
        password: 'vortex',
        enrollments: (member.enrollments || []).map(e => ({
          id: e.id,
          program_id: e.program_id,
          program_display_name: e.program_display_name,
          days_per_week: e.days_per_week,
          selected_days: e.selected_days
        })),
        dateOfBirth: member.dateOfBirth || '',
        gender: '',
        medicalNotes: member.medicalNotes || '',
        medicalConcerns: '',
        injuryHistoryDate: '',
        injuryHistoryBodyPart: '',
        injuryHistoryNotes: '',
        noInjuryHistory: true,
        experience: '',
        previousClasses: [],
        isFinished: false,
        isActive: member.isActive,
        parentGuardians: [],
        hasCompletedWaivers: false,
        waiverCompletionDate: null,
        sections: {
          contactInfo: {
            isExpanded: true,
            tempData: {
              firstName: member.firstName || '',
              lastName: member.lastName || '',
              email: member.email || '',
              phone: member.phone || '',
              addressStreet: addressParts.street,
              addressCity: addressParts.city,
              addressState: addressParts.state,
              addressZip: addressParts.zip
            }
          },
          loginSecurity: {
            isExpanded: false,
            tempData: {
              username: member.username || '',
              password: 'vortex'
            }
          },
          statusVerification: { isExpanded: false },
          personalData: {
            isExpanded: false,
            tempData: {
              dateOfBirth: member.dateOfBirth || '',
              gender: '',
              medicalConcerns: '',
              injuryHistoryDate: '',
              injuryHistoryBodyPart: '',
              injuryHistoryNotes: '',
              noInjuryHistory: true
            }
          },
          waivers: {
            isExpanded: false,
            tempData: {
              hasCompletedWaivers: false,
              waiverCompletionDate: null
            }
          }
        }
      }
      
      setEditingFamilyMembers([populatedMember])
      setExpandedFamilyMemberId(populatedMember.id)
      
      setShowEditModal(true)
    } catch (error) {
      console.error('Error editing member:', error)
      alert('Failed to load member data')
    }
  }

  // Wrapper function for updating a member (used by MemberFormSection component)
  const handleUpdateMember = useCallback((memberId: string, updates: Partial<FamilyMemberData> | ((prev: FamilyMemberData) => FamilyMemberData)) => {
    setEditingFamilyMembers(prev => prev.map(member => {
      if (member.id === memberId) {
        if (typeof updates === 'function') {
          return updates(member)
        } else {
          return { ...member, ...updates }
        }
      }
      return member
    }))
  }, [])
  

  // Light edit-form field updater (writes into contactInfo.tempData consumed by handleSaveMemberEdit)
  const updateEditContact = useCallback((memberId: string, field: string, value: string) => {
    handleUpdateMember(memberId, (prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        contactInfo: {
          ...prev.sections.contactInfo,
          tempData: { ...prev.sections.contactInfo.tempData, [field]: value },
        },
      },
    }))
  }, [handleUpdateMember])
  
  // Handle save member edit - adapted for member endpoints
  const handleSaveMemberEdit = async () => {
    if (editingFamilyMembers.length === 0) {
      alert('No member data to save')
      return
    }
    
    try {
      const member = editingFamilyMembers[0]
      const firstName = member.sections.contactInfo.tempData.firstName ?? member.firstName
      const lastName = member.sections.contactInfo.tempData.lastName ?? member.lastName
      const email = member.sections.contactInfo.tempData.email ?? member.email
      const phone = member.sections.contactInfo.tempData.phone ?? member.phone
      const addressStreet = member.sections.contactInfo.tempData.addressStreet ?? member.addressStreet ?? ''
      const addressCity = member.sections.contactInfo.tempData.addressCity ?? member.addressCity ?? ''
      const addressState = member.sections.contactInfo.tempData.addressState ?? member.addressState ?? ''
      const addressZip = member.sections.contactInfo.tempData.addressZip ?? member.addressZip ?? ''
      
      const address = combineAddress(addressStreet, addressCity, addressState, addressZip)
      
      // Determine if editing current member or family member
      const isCurrentMember = editingMemberId === profileData?.id
      const currentToken = localStorage.getItem('vortex_member_token')
      if (!currentToken) {
        alert('No authentication token found')
        return
      }
      
      if (isCurrentMember) {
        // Use /api/members/me endpoint
        const response = await fetch(`${apiUrl}/api/members/me`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email: email || null,
            phone: phone ? cleanPhoneNumber(phone) : null,
            address: address || null
          })
        })
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.message || 'Failed to update member')
        }
      } else {
        // Use /api/members/family/:id endpoint
        const response = await fetch(`${apiUrl}/api/members/family/${editingMemberId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email: email || null,
            phone: phone ? cleanPhoneNumber(phone) : null
          })
        })
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.message || 'Failed to update family member')
        }
      }
      
      // Refresh profile data
      await fetchProfileData()
      
      // Close modal
      setShowEditModal(false)
      setEditingMemberId(null)
      setEditingFamilyMembers([])
      setExpandedFamilyMemberId(null)
      
      alert('Member updated successfully!')
    } catch (error: any) {
      console.error('Error saving member edit:', error)
      alert(error.message || 'Failed to save member changes')
    }
  }


  useEffect(() => {
    fetchProfileData()
  }, [])

  useEffect(() => {
    if (activeTab === 'classes') {
      fetchEnrollments()
      loadClassesOffered()
    } else if (activeTab === 'events') {
      fetchEvents()
      fetchEnrollments() // Need enrollments for filtering
    } else if (activeTab === 'profile') {
      fetchEnrollments() // Need enrollments to display on profile
    } else if (activeTab === 'billing') {
      fetchBillingStatements()
    } else if (activeTab === 'waivers') {
      fetchWaivers()
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
        relationshipLabel: member.relationshipLabel || member.relationship_label || null,
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
          is_adult: fm.is_adult ?? (fm.athlete_type ? fm.athlete_type === 'adult' : false)
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
            relationshipLabel: fm.relationshipLabel || fm.relationship_label || null,
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

  const handleAddFamilyMember = async () => {
    if (!addFamilyMemberData.firstName.trim() || !addFamilyMemberData.lastName.trim()) {
      setError('First and last name are required')
      return
    }
    setAddingFamilyMember(true)
    setError(null)
    try {
      const response = await fetch(`${apiUrl}/api/members/family`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: addFamilyMemberData.firstName,
          lastName: addFamilyMemberData.lastName,
          email: addFamilyMemberData.email || null,
          phone: addFamilyMemberData.phone || null,
          dateOfBirth: addFamilyMemberData.dateOfBirth || null,
          relationshipLabel: addFamilyMemberData.relationshipLabel || null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Failed to add family member')
      }
      setAddFamilyMemberData({ firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', relationshipLabel: '' })
      setShowAddFamilyMember(false)
      await fetchProfileData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add family member')
    } finally {
      setAddingFamilyMember(false)
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
        // Convert date strings to Date objects using dateUtils to avoid timezone issues
        const eventsWithDates = activeEvents.map((e: Event) => {
          const startDateStr = e.startDate instanceof Date 
            ? `${e.startDate.getFullYear()}-${String(e.startDate.getMonth() + 1).padStart(2, '0')}-${String(e.startDate.getDate()).padStart(2, '0')}`
            : e.startDate
          const endDateStr = e.endDate instanceof Date
            ? `${e.endDate.getFullYear()}-${String(e.endDate.getMonth() + 1).padStart(2, '0')}-${String(e.endDate.getDate()).padStart(2, '0')}`
            : e.endDate
          const startDate = parseDateOnly(startDateStr)
          const endDate = endDateStr ? parseDateOnly(endDateStr) : undefined
          return {
            ...e,
            startDate: startDate || new Date(e.startDate), // Fallback if parsing fails
            endDate: endDate || (e.endDate ? new Date(e.endDate) : undefined)
          }
        })
        setEvents(eventsWithDates)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setEventsLoading(false)
    }
  }

  const fetchBillingStatements = async () => {
    if (!token) return
    try {
      setBillingLoading(true)
      const [statementsResponse, paymentsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/members/billing/statements`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${apiUrl}/api/members/billing/payments`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      ])
      if (!statementsResponse.ok) throw new Error(`Backend returned ${statementsResponse.status}`)
      if (!paymentsResponse.ok) throw new Error(`Backend returned ${paymentsResponse.status}`)
      const statementsData = await statementsResponse.json()
      const paymentsData = await paymentsResponse.json()
      setBillingStatements(statementsData.data ?? [])
      setBillingPayments(paymentsData.data ?? [])
    } catch (error) {
      console.error('Error fetching billing statements:', error)
      setBillingStatements([])
      setBillingPayments([])
    } finally {
      setBillingLoading(false)
    }
  }

  const fetchWaivers = async () => {
    if (!token) return
    try {
      setWaiversLoading(true)
      const response = await fetch(`${apiUrl}/api/members/waivers`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) throw new Error(`Backend returned ${response.status}`)
      const data = await response.json()
      setWaivers(data.data ?? [])
    } catch (error) {
      console.error('Error fetching waivers:', error)
      setWaivers([])
    } finally {
      setWaiversLoading(false)
    }
  }

  const acceptWaiver = async (templateId: number) => {
    if (!token) return
    try {
      const response = await fetch(`${apiUrl}/api/members/waivers/${templateId}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signatureName:
            waiverSignature ||
            [profileData?.firstName ?? profileData?.first_name, profileData?.lastName ?? profileData?.last_name]
              .filter(Boolean)
              .join(' '),
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || `Backend returned ${response.status}`)
      }
      setWaiverSignature('')
      await fetchWaivers()
      await fetchProfileData()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to accept waiver')
    }
  }

  const submitPasswordChange = async () => {
    if (!token) return
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordMessage('Current and new password are required.')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage('New password must be at least 8 characters.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage('New password and confirmation must match.')
      return
    }
    setChangingPassword(true)
    setPasswordMessage(null)
    try {
      const response = await fetch(`${apiUrl}/api/members/change-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Unable to change password')
      }
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordMessage('Password updated successfully.')
      await fetchProfileData()
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : 'Unable to change password')
    } finally {
      setChangingPassword(false)
    }
  }


  const fetchEnrollments = async () => {
    try {
      setEnrollmentsLoading(true)
      // Enrollments are already included in profile data from /api/members/me
      // Combine enrollments from current user and all family members
      const allEnrollments: any[] = []
      
      // Add current user's enrollments
      if (profileData?.enrollments && Array.isArray(profileData.enrollments)) {
        profileData.enrollments.forEach((enrollment: any) => {
          allEnrollments.push({
            ...enrollment,
            member_id: profileData.id,
            member_first_name: profileData.firstName || profileData.first_name,
            member_last_name: profileData.lastName || profileData.last_name
          })
        })
      }
      
      // Add family members' enrollments
      members.forEach((member) => {
        if (member.enrollments && Array.isArray(member.enrollments) && member.id !== profileData?.id) {
          member.enrollments.forEach((enrollment: any) => {
            allEnrollments.push({
              ...enrollment,
              member_id: member.id,
              member_first_name: member.firstName,
              member_last_name: member.lastName
            })
          })
        }
      })
      
      console.log('Combined enrollments:', allEnrollments)
      setEnrollments(allEnrollments)
    } catch (error) {
      console.error('Error processing enrollments:', error)
    } finally {
      setEnrollmentsLoading(false)
    }
  }

  const loadClassesOffered = async () => {
    try {
      setClassesOfferedLoading(true)
      setClassesOfferedError(null)
      const data = await fetchClassesOffered()
      setClassesOffered(data.programs)
    } catch (error) {
      setClassesOffered([])
      setClassesOfferedError(error instanceof Error ? error.message : 'Failed to load classes')
    } finally {
      setClassesOfferedLoading(false)
    }
  }

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
      familyMemberIds.includes(e.member_id)
    )
    const enrolledClassIds = relevantEnrollments.map(e => e.program_id).filter((id): id is number => id !== null && id !== undefined)
    
    // For now, we can't get category IDs from classes since we don't fetch them
    // This function will need to be updated when we can fetch classes
    const enrolledCategoryIds: number[] = []

    // Family reps / adults can act on behalf of the family (re-checked server-side).
    const isParent = isAdult()

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

  // Separate events into past and upcoming based on today's date
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Set to start of day for accurate comparison
  
  const upcomingEvents = events.filter(event => {
    const eventEndDate = event.endDate || event.startDate
    const eventEnd = eventEndDate instanceof Date 
      ? new Date(eventEndDate)
      : (parseDateOnly(eventEndDate) || new Date(eventEndDate))
    eventEnd.setHours(0, 0, 0, 0)
    return eventEnd >= today
  })

  const pastEvents = events.filter(event => {
    const eventEndDate = event.endDate || event.startDate
    const eventEnd = eventEndDate instanceof Date 
      ? new Date(eventEndDate)
      : (parseDateOnly(eventEndDate) || new Date(eventEndDate))
    eventEnd.setHours(0, 0, 0, 0)
    return eventEnd < today
  })

  // Get events based on current view (upcoming or past)
  const currentEvents = eventView === 'upcoming' ? upcomingEvents : pastEvents

  // Filter events based on search and relevance
  const filteredEvents = currentEvents.filter(event => {
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
      // Use parseDateOnly to avoid timezone issues
      const aDate = a.startDate instanceof Date 
        ? a.startDate 
        : (parseDateOnly(a.startDate) || new Date(a.startDate))
      const bDate = b.startDate instanceof Date 
        ? b.startDate 
        : (parseDateOnly(b.startDate) || new Date(b.startDate))
      const aTime = aDate.getTime()
      const bTime = bDate.getTime()
      // Sort upcoming events ascending, past events descending
      return eventView === 'upcoming' ? aTime - bTime : bTime - aTime
    } catch {
      return 0
    }
  })

  const formatDate = (date: Date | string) => {
    // Convert Date to YYYY-MM-DD string for dateUtils
    if (date instanceof Date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return formatDateForDisplay(`${year}-${month}-${day}`)
    }
    return formatDateForDisplay(date)
  }

  const formatDateRange = (start: Date | string, end?: Date | string) => {
    const startStr = start instanceof Date 
      ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
      : start
    const endStr = end instanceof Date
      ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      : end
    
    if (!endStr || startStr === endStr) {
      return formatDateForDisplay(startStr)
    }
    return `${formatDateForDisplay(startStr)} - ${formatDateForDisplay(endStr)}`
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

  // Image Slider Component
  const ImageSlider = ({ images }: { images: string[] }) => {
    const [currentIndex, setCurrentIndex] = useState(0)

    if (images.length === 0) return null

    if (images.length === 1) {
      return (
        <div className="w-full">
          <img
            src={images[0]}
            alt="Event"
            className="w-full h-64 md:h-96 object-cover rounded-lg"
          />
        </div>
      )
    }

    const nextImage = () => {
      setCurrentIndex((prev) => (prev + 1) % images.length)
    }

    const prevImage = () => {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
    }

    return (
      <div className="relative w-full">
        <div className="relative overflow-hidden rounded-lg">
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {images.map((image, index) => (
              <div key={index} className="w-full flex-shrink-0">
                <img
                  src={image}
                  alt={`Event ${index + 1}`}
                  className="w-full h-64 md:h-96 object-cover"
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* Navigation buttons */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            
            {/* Dots indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
            
            {/* Image counter */}
            <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>
    )
  }

  // Format date/time entry helper
  const formatDateTimeEntry = (entry: any) => {
    const dateStr = formatDate(entry.date)
    
    if (entry.allDay) {
      return `${dateStr}: All Day Event`
    } else if (entry.startTime && entry.endTime) {
      return `${dateStr}: ${entry.startTime} - ${entry.endTime}`
    } else if (entry.startTime) {
      return `${dateStr}: ${entry.startTime}`
    } else if (entry.description) {
      return `${dateStr}: ${entry.description}`
    } else {
      return dateStr
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Member Portal Header Section - Dark Background */}
      <div className="bg-gradient-to-br from-black via-gray-900 to-black pt-4 pb-0">
        <div className="container-admin">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white text-center md:text-left">
              VORTEX <span className="text-vortex-red">MEMBER</span> PORTAL
            </h1>
            <div className="flex items-center gap-2 flex-wrap justify-center md:justify-end">
              <NotificationBell apiPrefix="member" />
              <PortalNavButtons
                activePortal="member"
                availablePortals={availablePortals}
                onSwitchPortal={onSwitchPortal}
                onLogout={onLogout}
              />
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-t border-gray-700 mt-6">
            <div className="flex flex-wrap gap-2 md:gap-0">
              {[
                ['profile', 'Profile'],
                ['classes', 'Classes'],
                ['training', 'Training'],
                ['progress', 'Progress'],
                ['messages', 'Messages'],
                ['events', 'Events'],
                ['billing', 'Billing'],
                ['waivers', 'Waivers'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as MemberTab)}
                  className={`px-8 py-4 font-semibold text-base transition-all duration-300 relative ${
                    activeTab === id
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {label}
                  {activeTab === id && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                      layoutId="activeTab"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section - White Background */}
      <div className="bg-white p-4 md:p-8">
        <div className="container-admin">
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
                {profileData?.profileComplete === false && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
                    <strong>Complete your profile</strong> to unlock all member portal features.
                    Add your contact details, personal information, and medical info in your profile below.
                  </div>
                )}
                {(profileData?.profileComplete === false || profileData?.mustChangePassword) && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <h3 className="text-lg font-bold text-gray-900">First Login Setup</h3>
                    <div className="text-sm text-gray-700 space-y-1">
                      <p>1. Update your profile and household details.</p>
                      <p>2. Complete all required waivers in the Waivers tab.</p>
                      <p>3. Review billing statements and payment history.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('profile')}
                        className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm"
                      >
                        Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('waivers')}
                        className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm"
                      >
                        Waivers
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('billing')}
                        className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm"
                      >
                        Billing
                      </button>
                    </div>
                  </div>
                )}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200 space-y-3">
                  <h3 className="text-xl font-bold text-black">Account Security</h3>
                  <p className="text-sm text-gray-600">
                    Change your password anytime. {profileData?.mustChangePassword ? 'A password change is required for this account.' : ''}
                  </p>
                  {passwordMessage && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{passwordMessage}</div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Current password"
                      className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                    />
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="New password"
                      className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                    />
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                      className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void submitPasswordChange()}
                    disabled={changingPassword}
                    className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {changingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
                {/* Members Section - Matching AdminMembers Format */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <h3 className="text-xl font-bold text-black">
                      Family Members ({members.length})
                    </h3>
                    {isAdult() && (
                      <button
                        type="button"
                        onClick={() => setShowAddFamilyMember((value) => !value)}
                        className="inline-flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
                      >
                        <UserPlus className="w-4 h-4" />
                        Add family member
                      </button>
                    )}
                  </div>

                  {showAddFamilyMember && (
                    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={addFamilyMemberData.firstName}
                          onChange={(e) => setAddFamilyMemberData((prev) => ({ ...prev, firstName: e.target.value }))}
                          placeholder="First name"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={addFamilyMemberData.lastName}
                          onChange={(e) => setAddFamilyMemberData((prev) => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Last name"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={addFamilyMemberData.relationshipLabel}
                          onChange={(e) => setAddFamilyMemberData((prev) => ({ ...prev, relationshipLabel: e.target.value }))}
                          placeholder="Relationship"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          type="email"
                          value={addFamilyMemberData.email}
                          onChange={(e) => setAddFamilyMemberData((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="Email"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          type="tel"
                          value={addFamilyMemberData.phone}
                          onChange={(e) => setAddFamilyMemberData((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="Phone"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          type="date"
                          value={addFamilyMemberData.dateOfBirth}
                          onChange={(e) => setAddFamilyMemberData((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => setShowAddFamilyMember(false)}
                          className="px-4 py-2 rounded-lg border border-gray-300 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAddFamilyMember()}
                          disabled={addingFamilyMember}
                          className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60"
                        >
                          {addingFamilyMember ? 'Adding...' : 'Add member'}
                        </button>
                      </div>
                    </div>
                  )}

                  {loading ? (
                    <div className="text-center py-12 text-gray-600">Loading members...</div>
                  ) : error ? (
                    <div className="text-center py-12 text-red-600">{error}</div>
                  ) : members.length === 0 ? (
                    <div className="py-12 text-center text-gray-500 border border-dashed border-gray-300 rounded-xl">No family members found</div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                      <table className="w-full text-sm border-collapse min-w-[820px]">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                            <th className="py-3 px-4 font-semibold whitespace-nowrap">Member</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap">Contact</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap">Age</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap">Relationship</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap">Enrolled In</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap">Status</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap w-0 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((member) => {
                            const isCurrent = member.id === profileData?.id
                            const isFamilyRep = (member as any).is_family_rep === true || (member as any).is_primary === true
                            const athleteType = (member as any).athlete_type as ('youth' | 'adult' | undefined)
                            const isGuardian = isFamilyRep
                            const hasEnrollments = !!(member.enrollments && member.enrollments.length > 0)
                            const relationship =
                              member.relationshipLabel ||
                              (isFamilyRep
                                ? 'Family Rep'
                                : athleteType === 'youth'
                                  ? 'Youth Athlete'
                                  : athleteType === 'adult'
                                    ? 'Athlete'
                                    : hasEnrollments
                                      ? 'Athlete'
                                      : 'Member')
                            return (
                              <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                                <td className="py-3 px-4 align-middle">
                                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                                    {member.firstName} {member.lastName}
                                    {isCurrent && (
                                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">You</span>
                                    )}
                                  </div>
                                  {member.username && (
                                    <div className="text-xs text-gray-500 mt-0.5">@{member.username}</div>
                                  )}
                                </td>
                                <td className="py-3 px-4 align-middle text-gray-700">
                                  {member.email ? <div>{member.email}</div> : <span className="text-gray-400">—</span>}
                                  {member.phone && <div className="text-xs text-gray-500">{member.phone}</div>}
                                </td>
                                <td className="py-3 px-4 align-middle text-gray-700">
                                  {member.age ?? '—'}
                                </td>
                                <td className="py-3 px-4 align-middle">
                                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${isGuardian ? 'bg-vortex-red/10 text-vortex-red' : 'bg-gray-100 text-gray-700'}`}>
                                    {relationship}
                                  </span>
                                </td>
                                <td className="py-3 px-4 align-middle text-gray-700 max-w-[220px]">
                                  {hasEnrollments ? (
                                    <span className="text-xs">{member.enrollments.map((e) => e.program_display_name).join(', ')}</span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 align-middle">
                                  <div className="flex flex-wrap gap-1">
                                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Active</span>
                                    {hasEnrollments && (
                                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">Athlete</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 align-middle">
                                  <div className="flex items-center justify-end gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleViewMember(member)}
                                      title="View member"
                                      className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    {(isAdult() || member.id === profileData?.id) && (
                                      <button
                                        type="button"
                                        onClick={() => handleEditMember(member)}
                                        title="Edit member"
                                        className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <h3 className="text-xl font-bold text-black mb-2">
                    Payment History
                  </h3>
                  <p className="text-gray-600 text-sm mb-6">
                    Family payment history is visible to the billing payer and guardian accounts.
                  </p>
                  <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                    Card collection is currently handled externally. Reconciled payment records appear below.
                  </div>
                  {billingLoading ? (
                    <div className="text-center py-8 text-gray-600">Loading payment history...</div>
                  ) : billingPayments.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 border border-dashed border-gray-300 rounded-xl">No payments recorded yet.</div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                      <table className="w-full text-sm border-collapse min-w-[640px]">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                            <th className="py-3 px-4 font-semibold whitespace-nowrap">Date</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap">Method</th>
                            <th className="py-3 px-4 font-semibold">Reference / Note</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap">Status</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billingPayments.map((payment) => (
                            <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                              <td className="py-3 px-4 align-middle whitespace-nowrap text-gray-700">
                                {new Date(payment.paidAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 align-middle text-gray-900 font-medium">
                                {payment.method || 'Payment'}
                              </td>
                              <td className="py-3 px-4 align-middle text-gray-600">
                                {payment.externalReference && <span>Ref {payment.externalReference}</span>}
                                {payment.note && <span>{payment.externalReference ? ' · ' : ''}{payment.note}</span>}
                                {!payment.externalReference && !payment.note && <span className="text-gray-400">—</span>}
                              </td>
                              <td className="py-3 px-4 align-middle">
                                {payment.externalStatus ? (
                                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{payment.externalStatus}</span>
                                ) : (
                                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Reconciled</span>
                                )}
                              </td>
                              <td className="py-3 px-4 align-middle text-right font-bold text-gray-900 whitespace-nowrap">
                                {formatMoney(payment.amountCents)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
                      Current Enrollments
                    </h2>
                    {enrollments.length > 0 && (
                      <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setEnrollmentView('class')}
                          className={`px-4 py-2 text-sm font-semibold transition-colors ${enrollmentView === 'class' ? 'bg-vortex-red text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                          By Class
                        </button>
                        <button
                          type="button"
                          onClick={() => setEnrollmentView('member')}
                          className={`px-4 py-2 text-sm font-semibold transition-colors ${enrollmentView === 'member' ? 'bg-vortex-red text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                          By Family Member
                        </button>
                      </div>
                    )}
                  </div>

                  {enrollmentsLoading ? (
                    <div className="text-center py-12 text-gray-600">Loading enrollments...</div>
                  ) : enrollments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No enrollments yet. Sign up for a class from the offerings below.</div>
                  ) : enrollmentView === 'class' ? (
                  (() => {
                    // Group enrollments by program_id
                    const enrollmentsByProgram = enrollments.reduce((acc, enrollment) => {
                      const programId = enrollment.program_id
                      if (!acc[programId]) {
                        acc[programId] = []
                      }
                      acc[programId].push(enrollment)
                      return acc
                    }, {} as Record<number, typeof enrollments>)

                    // Get unique programs from enrollments and sort by member's enrollments first
                    const programIds = Object.keys(enrollmentsByProgram).map(Number)
                    const sortedProgramIds = programIds.sort((a, b) => {
                      const aHasCurrentUser = enrollmentsByProgram[a].some((e: any) => e.member_id === profileData?.id)
                      const bHasCurrentUser = enrollmentsByProgram[b].some((e: any) => e.member_id === profileData?.id)
                      
                      // Programs with current user enrollments come first
                      if (aHasCurrentUser && !bHasCurrentUser) return -1
                      if (!aHasCurrentUser && bHasCurrentUser) return 1
                      
                      // Then sort by program display name
                      const aName = enrollmentsByProgram[a][0]?.program_display_name || ''
                      const bName = enrollmentsByProgram[b][0]?.program_display_name || ''
                      return aName.localeCompare(bName)
                    })

                    return (
                      <div className="space-y-6">
                        {sortedProgramIds.map((programId) => {
                          const programEnrollments = enrollmentsByProgram[programId]
                          const firstEnrollment = programEnrollments[0]
                          const programDisplayName = firstEnrollment.program_display_name || firstEnrollment.program_name || 'Unknown Class'

                          return (
                            <div key={programId} className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                              {/* Red top section with white text (title) */}
                              <div className="bg-vortex-red p-4 md:p-6">
                                <h3 className="text-2xl font-display font-bold text-white">
                                  {programDisplayName}
                                </h3>
                              </div>
                              {/* White bottom section with enrolled members */}
                              <div className="p-4 md:p-6">
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                  <h4 className="text-lg font-display font-semibold text-black mb-4">
                                    Enrolled Members ({programEnrollments.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {programEnrollments.map((enrollment: any) => {
                                      // Find member - check familyMembers first, then check if it's the current user
                                      // enrollment.member_id is the member table ID
                                      let member = familyMembers.find(fm => 
                                        fm.id === enrollment.member_id
                                      )
                                      
                                      // If not found in familyMembers, check if it's the current user
                                      if (!member && enrollment.member_id === profileData?.id) {
                                        member = {
                                          id: profileData.id,
                                          first_name: profileData.firstName || '',
                                          last_name: profileData.lastName || '',
                                          user_id: profileData.id
                                        }
                                      }
                                      
                                      // Fallback to member name from enrollment if available
                                      const memberName = member 
                                        ? `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'You'
                                        : (enrollment.member_first_name && enrollment.member_last_name
                                            ? `${enrollment.member_first_name} ${enrollment.member_last_name}`
                                            : 'Unknown Member')
                                      
                                      const isCurrentUser = enrollment.member_id === profileData?.id
                                      const selectedDaysArray = Array.isArray(enrollment.selected_days) 
                                        ? enrollment.selected_days 
                                        : (typeof enrollment.selected_days === 'string' 
                                            ? JSON.parse(enrollment.selected_days || '[]') 
                                            : [])

                                      return (
                                        <div key={enrollment.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <h5 className="font-semibold text-black mb-1">
                                                {memberName} {isCurrentUser && '(You)'}
                                              </h5>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                                                <div>
                                                  <span className="font-medium">Days Per Week:</span> {enrollment.days_per_week || 'N/A'}
                                                </div>
                                                {selectedDaysArray.length > 0 && (
                                                  <div>
                                                    <span className="font-medium">Selected Days:</span> {selectedDaysArray.join(', ')}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()
                ) : (
                  (() => {
                    // Group enrollments by member
                    const enrollmentsByMember = enrollments.reduce((acc, enrollment) => {
                      const memberId = enrollment.member_id
                      if (!acc[memberId]) {
                        acc[memberId] = []
                      }
                      acc[memberId].push(enrollment)
                      return acc
                    }, {} as Record<number, typeof enrollments>)

                    const memberIds = Object.keys(enrollmentsByMember).map(Number).sort((a, b) => {
                      // Current user first
                      if (a === profileData?.id) return -1
                      if (b === profileData?.id) return 1
                      const aFirst = enrollmentsByMember[a][0]
                      const bFirst = enrollmentsByMember[b][0]
                      const aName = `${aFirst?.member_first_name || ''} ${aFirst?.member_last_name || ''}`.trim()
                      const bName = `${bFirst?.member_first_name || ''} ${bFirst?.member_last_name || ''}`.trim()
                      return aName.localeCompare(bName)
                    })

                    return (
                      <div className="space-y-6">
                        {memberIds.map((memberId) => {
                          const memberEnrollments = enrollmentsByMember[memberId]
                          const firstEnrollment = memberEnrollments[0]
                          const isCurrentUser = memberId === profileData?.id
                          const memberName = (firstEnrollment.member_first_name && firstEnrollment.member_last_name)
                            ? `${firstEnrollment.member_first_name} ${firstEnrollment.member_last_name}`
                            : (isCurrentUser ? 'You' : 'Member')

                          return (
                            <div key={memberId} className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                              {/* Red top section with member name */}
                              <div className="bg-vortex-red p-4 md:p-6">
                                <h3 className="text-2xl font-display font-bold text-white">
                                  {memberName}{isCurrentUser && ' (You)'}
                                </h3>
                              </div>
                              {/* White bottom section with this member's classes */}
                              <div className="p-4 md:p-6">
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                  <h4 className="text-lg font-display font-semibold text-black mb-4">
                                    Enrolled Classes ({memberEnrollments.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {memberEnrollments.map((enrollment: any) => {
                                      const programDisplayName = enrollment.program_display_name || enrollment.program_name || 'Unknown Class'
                                      const selectedDaysArray = Array.isArray(enrollment.selected_days)
                                        ? enrollment.selected_days
                                        : (typeof enrollment.selected_days === 'string'
                                            ? JSON.parse(enrollment.selected_days || '[]')
                                            : [])

                                      return (
                                        <div key={enrollment.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                          <h5 className="font-semibold text-black mb-1">
                                            {programDisplayName}
                                          </h5>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                                            <div>
                                              <span className="font-medium">Days Per Week:</span> {enrollment.days_per_week || 'N/A'}
                                            </div>
                                            {selectedDaysArray.length > 0 && (
                                              <div>
                                                <span className="font-medium">Selected Days:</span> {selectedDaysArray.join(', ')}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()
                )}
                </div>

                {/* Classes Offered */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-2">
                    Classes <span className="text-vortex-red">Offered</span>
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Browse the classes offered at your facility and sign up. Availability is managed through your facility's classes and schedule.
                  </p>

                  {classesOfferedLoading && (
                    <div className="text-center py-12 text-gray-600">Loading classes…</div>
                  )}
                  {classesOfferedError && (
                    <div className="text-center py-8 text-red-600">{classesOfferedError}</div>
                  )}
                  {!classesOfferedLoading && !classesOfferedError && classesOffered.length === 0 && (
                    <div className="text-center py-12 text-gray-500">No classes are listed at this time.</div>
                  )}
                  {!classesOfferedLoading && !classesOfferedError && classesOffered.length > 0 && (
                    <ClassesOfferedList programs={classesOffered} animate={false} className="space-y-8" />
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'training' && (
              <motion.div
                key="training"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <MemberTrainingTab />
              </motion.div>
            )}

            {activeTab === 'progress' && (
              <motion.div
                key="progress"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <MemberProgressTab />
              </motion.div>
            )}

            {activeTab === 'messages' && (
              <motion.div
                key="messages"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <MemberMessagesTab />
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

                {/* Calendar of Events */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  {/* Event View Toggle - Rotator Style */}
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <button
                      onClick={() => setEventView(eventView === 'upcoming' ? 'past' : 'upcoming')}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      aria-label="Previous view"
                    >
                      <ChevronLeft className="w-6 h-6 text-vortex-red" />
                    </button>
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-black text-center">
                      Calendar of <span className="text-vortex-red">
                        {eventView === 'upcoming' ? 'Upcoming' : 'Past'} Events
                      </span>
                    </h2>
                    <button
                      onClick={() => setEventView(eventView === 'upcoming' ? 'past' : 'upcoming')}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      aria-label="Next view"
                    >
                      <ChevronRight className="w-6 h-6 text-vortex-red" />
                    </button>
                  </div>
                  
                  {eventsLoading ? (
                    <div className="text-center py-12 text-gray-600">Loading events...</div>
                  ) : filteredEvents.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      {eventSearchQuery 
                        ? `No events found matching "${eventSearchQuery}"`
                        : eventView === 'upcoming' 
                          ? `No upcoming events at this time. (Total events in database: ${events.length})`
                          : 'No past events found.'}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start justify-between space-x-4 py-3 border-b border-gray-200 last:border-b-0"
                        >
                          <div className="flex items-start space-x-4 flex-1">
                            <div className="flex-shrink-0 w-32">
                              <p className="text-sm font-semibold text-vortex-red">
                                {formatDateRange(event.startDate, event.endDate)}
                              </p>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-display font-bold text-black mb-1">
                                {event.eventName}
                              </h3>
                              <p className="text-gray-600 text-sm leading-relaxed">
                                {event.shortDescription}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Event Details */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">
                    Event Details
                  </h2>
                  
                  {eventsLoading ? (
                    <div className="text-center py-12 text-gray-600">Loading events...</div>
                  ) : filteredEvents.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      {eventSearchQuery 
                        ? `No events found matching "${eventSearchQuery}"`
                        : eventView === 'upcoming' 
                          ? 'No upcoming events at this time.'
                          : 'No past events found.'}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {filteredEvents.map((event) => {
                        const Icon = getEventIcon(event.type || 'event')
                        
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
                            
                            {event.images && event.images.length > 0 && (
                              <div className="mb-4">
                                <ImageSlider images={event.images} />
                              </div>
                            )}
                            
                            {event.datesAndTimes && event.datesAndTimes.length > 0 && (
                              <div className="mb-4 space-y-2">
                                <h4 className="font-bold text-black mb-2">Dates & Times:</h4>
                                <ul className="space-y-1">
                                  {event.datesAndTimes.map((entry: any, entryIndex: number) => (
                                    <li key={entryIndex} className="flex items-start space-x-2 text-gray-700 text-sm">
                                      <Calendar className="w-4 h-4 text-vortex-red flex-shrink-0 mt-1" />
                                      <span>{formatDateTimeEntry(entry)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {event.keyDetails && event.keyDetails.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-bold text-black mb-2">Key Details:</h4>
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

                            {event.schedulingFormId != null && (
                              <EventAttachedSignup formId={event.schedulingFormId} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
            </motion.div>
            )}

            {activeTab === 'billing' && (
              <motion.div
                key="billing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-2">
                    Billing Statements
                  </h2>
                  <p className="text-gray-600 text-sm mb-6">
                    Family payers and guardians can see family statements. Athlete accounts see their individual statement lines.
                  </p>
                  {billingLoading ? (
                    <div className="text-center py-12 text-gray-600">Loading billing statements...</div>
                  ) : billingStatements.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No billing statements yet.</div>
                  ) : (
                    <div className="space-y-4">
                      {billingStatements.map((statement) => (
                        <div key={statement.id} className="rounded-xl border border-gray-200 p-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-gray-900">
                                Statement #{statement.id} · {statement.status}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {new Date(statement.statementDate).toLocaleDateString()}
                                {statement.dueDate ? ` · Due ${new Date(statement.dueDate).toLocaleDateString()}` : ''}
                              </p>
                            </div>
                            <div className="text-xl font-bold text-gray-900">{formatMoney(statement.totalCents)}</div>
                          </div>
                          <div className="mt-4 divide-y divide-gray-100">
                            {statement.lines.map((line, idx) => (
                              <div key={line.id ?? idx} className="py-2 flex justify-between gap-3 text-sm">
                                <span className="text-gray-700">{line.description}</span>
                                <span className="font-semibold text-gray-900">
                                  {formatMoney(Number(line.amount_cents ?? line.amountCents ?? 0))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'waivers' && (
              <motion.div
                key="waivers"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-2">
                    Athlete Waivers
                  </h2>
                  <p className="text-gray-600 text-sm mb-6">
                    Every athlete must have current waivers on file. Accepted waivers are stored with signature history.
                  </p>
                  <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    Read each waiver in full before signing. Your signature is stored with timestamped acceptance history.
                  </div>
                  <div className="mb-5">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Signature name</label>
                    <input
                      className="w-full max-w-md h-10 rounded-lg border border-gray-300 px-3 text-sm"
                      value={waiverSignature}
                      onChange={(e) => setWaiverSignature(e.target.value)}
                      placeholder="Legal name for waiver signature"
                    />
                  </div>
                  {waiversLoading ? (
                    <div className="text-center py-12 text-gray-600">Loading waivers...</div>
                  ) : waivers.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No waiver templates are currently required.</div>
                  ) : (
                    <div className="space-y-4">
                      {waivers.map((waiver) => {
                        const accepted = waiver.acceptance_id != null
                        return (
                          <div key={waiver.id} className="rounded-xl border border-gray-200 p-4">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                              <div>
                                <h3 className="font-bold text-gray-900">
                                  {waiver.name} v{waiver.version}
                                </h3>
                                {accepted ? (
                                  <p className="text-xs text-green-700 mt-1">
                                    Accepted {waiver.accepted_at ? new Date(waiver.accepted_at).toLocaleDateString() : ''}
                                    {waiver.signature_name ? ` by ${waiver.signature_name}` : ''}
                                  </p>
                                ) : (
                                  <p className="text-xs text-red-700 mt-1">Signature required</p>
                                )}
                              </div>
                              {!accepted && (
                                <button
                                  type="button"
                                  onClick={() => void acceptWaiver(waiver.id)}
                                  className="px-4 py-2 bg-vortex-red text-white rounded-lg font-semibold text-sm"
                                >
                                  Accept Waiver
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-3">Version: {waiver.version}</p>
                            <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{waiver.body}</p>
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
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowViewModal(false)
              setViewingMember(null)
              setViewingMemberFamilyData(null)
            }}
          />
            <motion.div
              className="relative bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">
                  {viewingMember.firstName} {viewingMember.lastName}
                </h3>
                <button
                  onClick={() => {
                    setShowViewModal(false)
                    setViewingMember(null)
                    setViewingMemberFamilyData(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
                {/* Family Information */}
                {viewingMember.familyId && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Family Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs font-semibold text-gray-500">Family Name:</span>
                        <div className="text-gray-900">{viewingMember.familyName || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Member Basic Information */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-semibold text-gray-500">First Name:</span>
                      <div className="text-gray-900">{viewingMember.firstName}</div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Last Name:</span>
                      <div className="text-gray-900">{viewingMember.lastName}</div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Email:</span>
                      <div className="text-gray-900">{viewingMember.email || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Phone:</span>
                      <div className="text-gray-900">{viewingMember.phone || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Username:</span>
                      <div className="text-gray-900">{viewingMember.username || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Date of Birth:</span>
                      <div className="text-gray-900">
                        {viewingMember.dateOfBirth 
                          ? formatDateForDisplay(viewingMember.dateOfBirth)
                          : 'N/A'}
                      </div>
                    </div>
                    {viewingMember.age !== null && viewingMember.age !== undefined && (
                      <div>
                        <span className="text-xs font-semibold text-gray-500">Age:</span>
                        <div className="text-gray-900">{viewingMember.age}</div>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Address:</span>
                      <div className="text-gray-900">{viewingMember.address || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {/* Status and Roles */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Status and Roles</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Status:</span>
                      <div className="mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          viewingMember.isActive 
                            ? 'bg-green-50 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {viewingMember.isActive ? 'Active' : 'Archived'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Enrollment Status:</span>
                      <div className="mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          viewingMember.status === 'athlete' || viewingMember.status === 'enrolled'
                            ? 'bg-blue-50 text-blue-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {viewingMember.status || 'Non-Participant'}
                        </span>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-xs font-semibold text-gray-500">Roles:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {viewingMember.roles && viewingMember.roles.length > 0 ? (
                          viewingMember.roles.map((role, idx) => (
                            <span key={idx} className="px-2 py-1 rounded text-xs font-semibold bg-purple-50 text-purple-700">
                              {typeof role === 'string' ? role : role.role}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-sm">No roles assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enrollments */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Active Enrollments</h4>
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
                          <div key={enrollment.id} className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="text-gray-900 font-medium">
                              {enrollment.program_display_name || enrollment.programDisplayName || 'Unknown Class'}
                            </div>
                            <div className="text-gray-500 text-sm mt-1">
                              {enrollment.days_per_week || enrollment.daysPerWeek} day{(enrollment.days_per_week || enrollment.daysPerWeek) !== 1 ? 's' : ''}/week
                              {selectedDaysArray.length > 0 && ` • ${selectedDaysArray.join(', ')}`}
                            </div>
                            {enrollmentDate && (
                              <div className="text-gray-500 text-xs mt-1">
                                Enrolled: {formatTimeSince(enrollmentDate)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm">No active enrollments</div>
                  )}
                  {viewingMember.enrollments && viewingMember.enrollments.length > 0 && (
                    <div className="mt-3 text-sm text-gray-600">
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
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                      Family Members ({viewingMemberFamilyData.members.length})
                    </h4>
                    <div className="space-y-3">
                      {viewingMemberFamilyData.members.map((familyMember: any) => {
                        const isCurrentMember = familyMember.id === viewingMember.id
                        return (
                          <div 
                            key={familyMember.id} 
                            className={`bg-white border rounded-lg p-4 ${isCurrentMember ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'}`}
                          >
                            {isCurrentMember && (
                              <div className="text-xs text-blue-700 font-semibold mb-2">(Current Member)</div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <span className="text-xs font-semibold text-gray-500">Name:</span>
                                <div className="text-gray-900">{familyMember.firstName} {familyMember.lastName}</div>
                              </div>
                              {familyMember.email && (
                                <div>
                                  <span className="text-xs font-semibold text-gray-500">Email:</span>
                                  <div className="text-gray-900">{familyMember.email}</div>
                                </div>
                              )}
                              {familyMember.phone && (
                                <div>
                                  <span className="text-xs font-semibold text-gray-500">Phone:</span>
                                  <div className="text-gray-900">{familyMember.phone}</div>
                                </div>
                              )}
                              {familyMember.dateOfBirth && (
                                <div>
                                  <span className="text-xs font-semibold text-gray-500">Date of Birth:</span>
                                  <div className="text-gray-900">
                                    {formatDateForDisplay(familyMember.dateOfBirth)}
                                  </div>
                                </div>
                              )}
                              {familyMember.age !== null && familyMember.age !== undefined && (
                                <div>
                                  <span className="text-xs font-semibold text-gray-500">Age:</span>
                                  <div className="text-gray-900">{familyMember.age}</div>
                                </div>
                              )}
                              <div>
                                <span className="text-xs font-semibold text-gray-500">Status:</span>
                                <div className="mt-1">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    familyMember.isActive 
                                      ? 'bg-green-50 text-green-700' 
                                      : 'bg-gray-100 text-gray-600'
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
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Additional Information</h4>
                    {viewingMember.medicalNotes && (
                      <div className="mb-3">
                        <span className="text-xs font-semibold text-gray-500">Medical Notes:</span>
                        <div className="text-gray-900 mt-1">{viewingMember.medicalNotes}</div>
                      </div>
                    )}
                    {viewingMember.internalFlags && (
                      <div>
                        <span className="text-xs font-semibold text-gray-500">Internal Flags:</span>
                        <div className="text-gray-900 mt-1">{viewingMember.internalFlags}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    setShowViewModal(false)
                    setViewingMember(null)
                    setViewingMemberFamilyData(null)
                  }}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg font-semibold"
                >
                  Close
                </button>
                {(isAdult() || viewingMember.id === profileData?.id) && (
                  <button
                    onClick={() => {
                      setShowViewModal(false)
                      handleEditMember(viewingMember)
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-vortex-red text-white rounded-lg font-semibold hover:bg-red-700"
                  >
                    <Edit2 className="w-4 h-4" />
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
        {showEditModal && editingFamilyMembers.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          >
            <motion.div
              className="absolute inset-0"
              onClick={() => {
                setShowEditModal(false)
                setEditingMemberId(null)
                setEditingFamilyMembers([])
                setExpandedFamilyMemberId(null)
              }}
            />
            <motion.div
              className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">
                  Edit {editingFamilyMembers[0].firstName || 'Member'}
                </h3>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingMemberId(null)
                    setEditingFamilyMembers([])
                    setExpandedFamilyMemberId(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {(() => {
                const member = editingFamilyMembers[0]
                const contact = member.sections.contactInfo.tempData
                const isCurrentMember = editingMemberId === profileData?.id
                const field = (key: string, fallback?: string | null) =>
                  (contact as Record<string, string | undefined>)[key] ?? fallback ?? ''
                return (
                  <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                        <input
                          type="text"
                          value={field('firstName', member.firstName)}
                          onChange={(e) => updateEditContact(member.id, 'firstName', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                        <input
                          type="text"
                          value={field('lastName', member.lastName)}
                          onChange={(e) => updateEditContact(member.id, 'lastName', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={field('email', member.email)}
                          onChange={(e) => updateEditContact(member.id, 'email', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={field('phone', member.phone)}
                          onChange={(e) => updateEditContact(member.id, 'phone', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                        />
                      </div>
                    </div>

                    {isCurrentMember && (
                      <div className="border-t border-gray-100 pt-4 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Street address</label>
                          <input
                            type="text"
                            value={field('addressStreet', member.addressStreet)}
                            onChange={(e) => updateEditContact(member.id, 'addressStreet', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="sm:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                            <input
                              type="text"
                              value={field('addressCity', member.addressCity)}
                              onChange={(e) => updateEditContact(member.id, 'addressCity', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                            <input
                              type="text"
                              value={field('addressState', member.addressState)}
                              onChange={(e) => updateEditContact(member.id, 'addressState', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                            <input
                              type="text"
                              value={field('addressZip', member.addressZip)}
                              onChange={(e) => updateEditContact(member.id, 'addressZip', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      To change a member's family relationship or move them between families, contact your facility administrator.
                    </p>
                  </div>
                )
              })()}

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingMemberId(null)
                    setEditingFamilyMembers([])
                    setExpandedFamilyMemberId(null)
                  }}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMemberEdit}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-vortex-red text-white rounded-lg font-semibold hover:bg-red-700"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
