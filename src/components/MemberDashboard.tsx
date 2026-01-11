import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Home, Calendar, Search, Edit2, CheckCircle, MapPin, Award, Users, Trophy, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getApiUrl } from '../utils/api'
import MemberFormSection from './MemberFormSection'

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
  const [showEditModal, setShowEditModal] = useState(false)
  
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
  const [expandedFamilyMemberId, setExpandedFamilyMemberId] = useState<string | null>(null)
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null)
  const [availableParentGuardians, setAvailableParentGuardians] = useState<Array<{
    id: number
    firstName: string
    lastName: string
    email?: string
    phone?: string
  }>>([])
  
  // Classes tab state
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  
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

  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '')
    const limited = digits.slice(0, 10)
    if (limited.length <= 3) {
      return limited
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`
    } else {
      return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`
    }
  }

  const cleanPhoneNumber = (phone: string): string => {
    return phone.replace(/\D/g, '')
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
  
  // Wrapper for toggling member expand/collapse
  const handleToggleMemberExpand = useCallback((memberId: string) => {
    setExpandedFamilyMemberId(prev => prev === memberId ? null : memberId)
  }, [])
  
  const handleSectionContinue = (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'statusVerification' | 'personalData' | 'parentGuardians' | 'waivers' | 'previousClasses') => {
    setEditingFamilyMembers(prev => prev.map(member => {
      if (member.id === memberId) {
        if (section === 'contactInfo') {
          const sectionData = member.sections.contactInfo
          return {
            ...member,
            firstName: sectionData.tempData.firstName,
            lastName: sectionData.tempData.lastName,
            email: sectionData.tempData.email,
            phone: sectionData.tempData.phone,
            addressStreet: sectionData.tempData.addressStreet,
            addressCity: sectionData.tempData.addressCity,
            addressState: sectionData.tempData.addressState,
            addressZip: sectionData.tempData.addressZip,
            sections: {
              ...member.sections,
              contactInfo: { ...sectionData, isExpanded: false },
              loginSecurity: { ...member.sections.loginSecurity, isExpanded: true },
              personalData: member.sections.personalData || { isExpanded: false, tempData: { dateOfBirth: member.dateOfBirth, gender: member.gender, medicalConcerns: member.medicalConcerns, injuryHistoryDate: member.injuryHistoryDate, injuryHistoryBodyPart: member.injuryHistoryBodyPart, injuryHistoryNotes: member.injuryHistoryNotes, noInjuryHistory: member.noInjuryHistory } },
              parentGuardians: member.sections.parentGuardians || { isExpanded: false, tempData: { parentGuardians: member.parentGuardians || (member.parentGuardianIds ? member.parentGuardianIds.map(id => ({ id, relationship: '' })) : []) } },
              waivers: member.sections.waivers || { isExpanded: false, tempData: { hasCompletedWaivers: member.hasCompletedWaivers || false, waiverCompletionDate: member.waiverCompletionDate || null } },
              previousClasses: member.sections.previousClasses || { isExpanded: false, tempData: { experience: member.experience } }
            }
          }
        } else if (section === 'loginSecurity') {
          const sectionData = member.sections.loginSecurity
          return {
            ...member,
            username: sectionData.tempData.username,
            password: sectionData.tempData.password,
            sections: {
              ...member.sections,
              loginSecurity: { ...sectionData, isExpanded: false },
              personalData: { ...(member.sections.personalData || { isExpanded: false, tempData: { dateOfBirth: member.dateOfBirth, gender: member.gender, medicalConcerns: member.medicalConcerns, injuryHistoryDate: member.injuryHistoryDate, injuryHistoryBodyPart: member.injuryHistoryBodyPart, injuryHistoryNotes: member.injuryHistoryNotes, noInjuryHistory: member.noInjuryHistory } }), isExpanded: true }
            }
          }
        } else if (section === 'personalData') {
          const personalData = member.sections.personalData?.tempData || { dateOfBirth: member.dateOfBirth, gender: member.gender, medicalConcerns: member.medicalConcerns, injuryHistoryDate: member.injuryHistoryDate, injuryHistoryBodyPart: member.injuryHistoryBodyPart, injuryHistoryNotes: member.injuryHistoryNotes, noInjuryHistory: member.noInjuryHistory }
          const updatedMember = {
            ...member,
            dateOfBirth: personalData.dateOfBirth,
            gender: personalData.gender,
            medicalConcerns: personalData.medicalConcerns,
            injuryHistoryDate: personalData.injuryHistoryDate,
            injuryHistoryBodyPart: personalData.injuryHistoryBodyPart,
            injuryHistoryNotes: personalData.injuryHistoryNotes,
            noInjuryHistory: personalData.noInjuryHistory,
            sections: {
              ...member.sections,
              personalData: { ...(member.sections.personalData || { isExpanded: false, tempData: personalData }), isExpanded: false },
              parentGuardians: member.sections.parentGuardians || { isExpanded: false, tempData: { parentGuardians: member.parentGuardians || (member.parentGuardianIds ? member.parentGuardianIds.map(id => ({ id, relationship: '' })) : []) } },
              waivers: member.sections.waivers || { isExpanded: false, tempData: { hasCompletedWaivers: member.hasCompletedWaivers || false, waiverCompletionDate: member.waiverCompletionDate || null } },
              previousClasses: member.sections.previousClasses || { isExpanded: false, tempData: { experience: member.experience } }
            }
          }
          
          // Check if child - if so, expand parent/guardian section next, otherwise expand waivers
          if (personalData.dateOfBirth) {
            const birthDateObj = new Date(personalData.dateOfBirth)
            const today = new Date()
            const age = today.getFullYear() - birthDateObj.getFullYear() - 
              (today.getMonth() < birthDateObj.getMonth() || 
               (today.getMonth() === birthDateObj.getMonth() && today.getDate() < birthDateObj.getDate()) ? 1 : 0)
            
            if (age < 18) {
              updatedMember.sections.parentGuardians = { ...updatedMember.sections.parentGuardians, isExpanded: true }
            } else {
              updatedMember.sections.waivers = { ...updatedMember.sections.waivers, isExpanded: true }
            }
          } else {
            updatedMember.sections.waivers = { ...updatedMember.sections.waivers, isExpanded: true }
          }
          
          return updatedMember
        } else if (section === 'parentGuardians') {
          let parentGuardians = member.sections.parentGuardians?.tempData?.parentGuardians || []
          if (parentGuardians.length === 0 && member.parentGuardianIds) {
            parentGuardians = member.parentGuardianIds.map((id: number) => ({ id, relationship: '' }))
          }
          return {
            ...member,
            parentGuardians,
            parentGuardianIds: parentGuardians.map(pg => pg.id),
            sections: {
              ...member.sections,
              parentGuardians: { ...(member.sections.parentGuardians || { isExpanded: false, tempData: { parentGuardians: [] } }), isExpanded: false, tempData: { parentGuardians } },
              waivers: { ...(member.sections.waivers || { isExpanded: false, tempData: { hasCompletedWaivers: member.hasCompletedWaivers || false, waiverCompletionDate: member.waiverCompletionDate || null } }), isExpanded: true }
            }
          }
        } else if (section === 'waivers') {
          const waiverData = member.sections.waivers?.tempData || { hasCompletedWaivers: member.hasCompletedWaivers || false, waiverCompletionDate: member.waiverCompletionDate || null }
          return {
            ...member,
            hasCompletedWaivers: waiverData.hasCompletedWaivers,
            waiverCompletionDate: waiverData.waiverCompletionDate,
            sections: {
              ...member.sections,
              waivers: { ...(member.sections.waivers || { isExpanded: false, tempData: waiverData }), isExpanded: false },
              statusVerification: { ...member.sections.statusVerification, isExpanded: true }
            }
          }
        } else if (section === 'statusVerification') {
          return {
            ...member,
            sections: {
              ...member.sections,
              statusVerification: { isExpanded: false },
              previousClasses: { ...(member.sections.previousClasses || { isExpanded: false, tempData: { experience: member.experience } }), isExpanded: true }
            }
          }
        } else if (section === 'previousClasses') {
          const experience = member.sections.previousClasses?.tempData?.experience || member.experience
          return {
            ...member,
            experience,
            sections: {
              ...member.sections,
              previousClasses: { ...(member.sections.previousClasses || { isExpanded: false, tempData: { experience } }), isExpanded: false }
            }
          }
        } else {
          return member
        }
      }
      return member
    }))
  }
  
  const handleSectionMinimize = (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'statusVerification' | 'personalData' | 'parentGuardians' | 'waivers' | 'previousClasses') => {
    setEditingFamilyMembers(prev => prev.map(member => {
      if (member.id === memberId) {
        if (section === 'contactInfo') {
          const sectionData = member.sections.contactInfo
          return {
            ...member,
            firstName: sectionData.tempData.firstName,
            lastName: sectionData.tempData.lastName,
            email: sectionData.tempData.email,
            phone: sectionData.tempData.phone,
            addressStreet: sectionData.tempData.addressStreet,
            addressCity: sectionData.tempData.addressCity,
            addressState: sectionData.tempData.addressState,
            addressZip: sectionData.tempData.addressZip,
            sections: {
              ...member.sections,
              contactInfo: { ...sectionData, isExpanded: false }
            }
          }
        } else if (section === 'loginSecurity') {
          const sectionData = member.sections.loginSecurity
          return {
            ...member,
            username: sectionData.tempData.username,
            password: sectionData.tempData.password,
            sections: {
              ...member.sections,
              loginSecurity: { ...sectionData, isExpanded: false }
            }
          }
        } else {
          return {
            ...member,
            sections: {
              ...member.sections,
              statusVerification: { isExpanded: false }
            }
          }
        }
      }
      return member
    }))
  }
  
  const handleSectionCancel = (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'statusVerification' | 'personalData' | 'parentGuardians' | 'waivers' | 'previousClasses') => {
    setEditingFamilyMembers(prev => prev.map(member => {
      if (member.id === memberId) {
        if (section === 'contactInfo') {
          return {
            ...member,
            sections: {
              ...member.sections,
              contactInfo: {
                isExpanded: false,
                tempData: {
                  firstName: member.firstName,
                  lastName: member.lastName,
                  email: member.email,
                  phone: member.phone,
                  addressStreet: member.addressStreet,
                  addressCity: member.addressCity,
                  addressState: member.addressState,
                  addressZip: member.addressZip
                }
              }
            }
          }
        } else if (section === 'loginSecurity') {
          return {
            ...member,
            sections: {
              ...member.sections,
              loginSecurity: {
                isExpanded: false,
                tempData: {
                  username: member.username,
                  password: member.password
                }
              }
            }
          }
        } else {
          return {
            ...member,
            sections: {
              ...member.sections,
              statusVerification: {
                isExpanded: false
              }
            }
          }
        }
      }
      return member
    }))
  }
  
  const handleToggleSection = (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'statusVerification' | 'personalData' | 'parentGuardians' | 'waivers' | 'previousClasses') => {
    setEditingFamilyMembers(prev => prev.map(member => {
      if (member.id === memberId) {
        if (section === 'contactInfo') {
          const sectionData = member.sections.contactInfo
          if (!sectionData.isExpanded) {
            return {
              ...member,
              sections: {
                ...member.sections,
                contactInfo: {
                  isExpanded: true,
                  tempData: {
                    firstName: member.firstName,
                    lastName: member.lastName,
                    email: member.email,
                    phone: member.phone,
                    addressStreet: member.addressStreet,
                    addressCity: member.addressCity,
                    addressState: member.addressState,
                    addressZip: member.addressZip
                  }
                }
              }
            }
          } else {
            return {
              ...member,
              sections: {
                ...member.sections,
                contactInfo: { ...sectionData, isExpanded: false }
              }
            }
          }
        } else if (section === 'loginSecurity') {
          const sectionData = member.sections.loginSecurity
          if (!sectionData.isExpanded) {
            return {
              ...member,
              sections: {
                ...member.sections,
                loginSecurity: {
                  isExpanded: true,
                  tempData: {
                    username: member.username,
                    password: member.password
                  }
                }
              }
            }
          } else {
            return {
              ...member,
              sections: {
                ...member.sections,
                loginSecurity: { ...sectionData, isExpanded: false }
              }
            }
          }
        } else if (section === 'personalData') {
          const sectionData = member.sections.personalData || { isExpanded: false, tempData: { dateOfBirth: member.dateOfBirth, gender: member.gender, medicalConcerns: member.medicalConcerns, injuryHistoryDate: member.injuryHistoryDate, injuryHistoryBodyPart: member.injuryHistoryBodyPart, injuryHistoryNotes: member.injuryHistoryNotes, noInjuryHistory: member.noInjuryHistory } }
          return {
            ...member,
            sections: {
              ...member.sections,
              personalData: { ...sectionData, isExpanded: !sectionData.isExpanded }
            }
          }
        } else if (section === 'parentGuardians') {
          let parentGuardians = member.sections.parentGuardians?.tempData?.parentGuardians || []
          if (parentGuardians.length === 0 && member.parentGuardianIds) {
            parentGuardians = member.parentGuardianIds.map((id: number) => ({ id, relationship: '' }))
          }
          const sectionData = member.sections.parentGuardians || { isExpanded: false, tempData: { parentGuardians } }
          return {
            ...member,
            sections: {
              ...member.sections,
              parentGuardians: { ...sectionData, isExpanded: !sectionData.isExpanded }
            }
          }
        } else if (section === 'waivers') {
          const sectionData = member.sections.waivers || { isExpanded: false, tempData: { hasCompletedWaivers: member.hasCompletedWaivers || false, waiverCompletionDate: member.waiverCompletionDate || null } }
          return {
            ...member,
            sections: {
              ...member.sections,
              waivers: { ...sectionData, isExpanded: !sectionData.isExpanded }
            }
          }
        } else if (section === 'previousClasses') {
          const sectionData = member.sections.previousClasses || { isExpanded: false, tempData: { experience: member.experience } }
          return {
            ...member,
            sections: {
              ...member.sections,
              previousClasses: { ...sectionData, isExpanded: !sectionData.isExpanded }
            }
          }
        } else {
          const sectionData = member.sections.statusVerification
          return {
            ...member,
            sections: {
              ...member.sections,
              statusVerification: { ...sectionData, isExpanded: !sectionData.isExpanded }
            }
          }
        }
      }
      return member
    }))
  }
  
  const handleFinishedWithMember = (memberId: string) => {
    setEditingFamilyMembers(prev => {
      const updated = prev.map(member => {
        if (member.id === memberId) {
          return { ...member, isFinished: true }
        }
        return member
      })
      if (expandedFamilyMemberId === memberId) {
        const firstUnfinished = updated.find(m => !m.isFinished)
        if (firstUnfinished) {
          setExpandedFamilyMemberId(firstUnfinished.id)
        } else {
          setExpandedFamilyMemberId(null)
        }
      }
      return updated
    })
  }

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

  // Generate username (simplified - not used in member portal)
  const generateUsername = async (_firstName: string, _lastName: string = ''): Promise<string> => {
    return ''
  }

  // Search parent guardians (simplified - not used in member portal)
  const searchParentGuardians = useCallback(async (_query: string) => {
    setAvailableParentGuardians([])
  }, [])

  useEffect(() => {
    fetchProfileData()
  }, [])

  useEffect(() => {
    if (activeTab === 'classes') {
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
    
    // For now, we can't get category IDs from classes since we don't fetch them
    // This function will need to be updated when we can fetch classes
    const enrolledCategoryIds: number[] = []

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
                                    onClick={() => handleEditMember(member)}
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
                {enrollmentsLoading ? (
                  <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                    <div className="text-center py-12 text-gray-600">Loading enrollments...</div>
                  </div>
                ) : enrollments.length === 0 ? (
                  <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                    <div className="text-center py-12 text-gray-500">No enrollments yet.</div>
                  </div>
                ) : (
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
                      const aHasCurrentUser = enrollmentsByProgram[a].some((e: any) => e.athlete_user_id === profileData?.id)
                      const bHasCurrentUser = enrollmentsByProgram[b].some((e: any) => e.athlete_user_id === profileData?.id)
                      
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
                                      
                                      const isCurrentUser = enrollment.athlete_user_id === profileData?.id
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
                )}
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
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">
                    Calendar of Events {events.length > 0 && `(${events.length} total)`}
                  </h2>
                  
                  {eventsLoading ? (
                    <div className="text-center py-12 text-gray-600">Loading events...</div>
                  ) : filteredEvents.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      {eventSearchQuery 
                        ? `No events found matching "${eventSearchQuery}"`
                        : `No events at this time. (Total events in database: ${events.length})`}
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
                        : 'No events at this time.'}
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
                      handleEditMember(viewingMember)
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
        {showEditModal && editingFamilyMembers.length > 0 && (
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
                setEditingMemberId(null)
                setEditingFamilyMembers([])
                setExpandedFamilyMemberId(null)
              }}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">
                  Edit Member
                </h3>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingMemberId(null)
                    setEditingFamilyMembers([])
                    setExpandedFamilyMemberId(null)
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {editingFamilyMembers.map((member, memberIndex) => (
                  <MemberFormSection
                    key={member.id}
                    member={member}
                    memberIndex={memberIndex}
                    isExpanded={expandedFamilyMemberId === member.id}
                    onToggleExpand={handleToggleMemberExpand}
                    onUpdateMember={handleUpdateMember}
                    onToggleSection={handleToggleSection}
                    onSectionContinue={handleSectionContinue}
                    onSectionMinimize={handleSectionMinimize}
                    onSectionCancel={handleSectionCancel}
                    onFinishedWithMember={handleFinishedWithMember}
                    generateUsername={generateUsername}
                    formatPhoneNumber={formatPhoneNumber}
                    availableParentGuardians={availableParentGuardians}
                    onSearchParentGuardians={searchParentGuardians}
                    allFamilyMembers={editingFamilyMembers}
                  />
                ))}
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleSaveMemberEdit}
                  className="flex-1 bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingMemberId(null)
                    setEditingFamilyMembers([])
                    setExpandedFamilyMemberId(null)
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
