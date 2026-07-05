import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Search, Edit2, CheckCircle, MapPin, Award, Users, Trophy, Eye, X, ChevronLeft, ChevronRight, UserPlus, Home, LayoutGrid, Dumbbell, TrendingUp, MessageSquare, CreditCard, FileText, Menu, Settings } from 'lucide-react'
import { getApiUrl } from '../utils/api'
import { formatDateForDisplay, parseDateOnly } from '../utils/dateUtils'
import { cleanPhoneNumber, formatPhoneNumber, PHONE_INPUT_MAX_LENGTH, PHONE_INPUT_PLACEHOLDER } from '../utils/phoneUtils'
import { fetchClassesOffered, fetchMemberMultiClassPasses, type PublicProgramOffered, type MemberMultiClassPassBalance } from '../utils/publicClassesApi'
import { confirmEnrollmentCheckoutSession, clearPendingEnrollmentId, readPendingEnrollmentId } from '../utils/schedulingApi'
import MemberClassesOfferedEnroll, { type EnrollableMember } from './member/MemberClassesOfferedEnroll'
import EventAttachedSignup from './EventAttachedSignup'
import { MemberTrainingTab, MemberProgressTab, MemberMessagesTab } from './MemberTraining'
import MemberEnrollmentsPanel, { type MemberEnrollmentRow } from './member/MemberEnrollmentsPanel'
import { enrollmentClassHeading } from '../utils/enrollmentDisplayLine'
import MemberHomePanel from './member/MemberHomePanel'
import MemberBillingPanel from './member/MemberBillingPanel'
import PortalNavButtons from './PortalNavButtons'
import NotificationBell from './NotificationBell'
import { NOTIFICATION_NAV_EVENT, type NotificationNavigateDetail } from '../utils/notificationNavigation'
import { coachFetch } from '../coach/api'
import { fetchEventMessageThreads, pickEventDiscussionThreadId } from './messaging/messagingApi'
import PortalPreferencesPanel from './messaging/PortalPreferencesPanel'
import WaiverSigningBlock, { validateWaiverSigning } from './signup/WaiverSigningBlock'
import type { PortalId } from '../utils/portalSession'
import { firstVisiblePortalTab, isPortalTabVisible, orderPortalItems } from '../utils/portalTabConfig'

interface MemberDashboardProps {
  member: any
  onLogout: () => void
  onReturnToWebsite?: () => void
  availablePortals?: PortalId[]
  onSwitchPortal?: (portal: 'admin' | 'coach' | 'member' | 'website') => void
}

export type MemberTab = 'home' | 'profile' | 'classes' | 'events' | 'billing' | 'waivers' | 'training' | 'progress' | 'messages' | 'preferences'

const NAV: Array<{ tab: MemberTab; label: string; icon: typeof Home }> = [
  { tab: 'home', label: 'Home', icon: Home },
  { tab: 'profile', label: 'Profile', icon: Users },
  { tab: 'classes', label: 'Classes', icon: LayoutGrid },
  { tab: 'training', label: 'Training', icon: Dumbbell },
  { tab: 'progress', label: 'Progress', icon: TrendingUp },
  { tab: 'messages', label: 'Messages', icon: MessageSquare },
  { tab: 'events', label: 'Events', icon: Calendar },
  { tab: 'billing', label: 'Billing', icon: CreditCard },
  { tab: 'waivers', label: 'Waivers', icon: FileText },
  { tab: 'preferences', label: 'Preferences', icon: Settings },
]

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
  schedulingFormId?: number | null
  schedulingFormTitle?: string | null
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

interface BillingCharge {
  id: number
  memberId: number | null
  memberName: string | null
  sourceType: string
  description: string
  amountCents: number
  grossAmountCents?: number
  discountAmountCents?: number
  chargeType?: string
  billingInterval?: string
  createdAt: string
}

interface BillingSubscriptionSummary {
  id: number
  memberName: string | null
  description: string
  monthlyAmountCents: number
  discountAmountCents: number
  netMonthlyCents: number
  status: string
  nextBillDate: string | null
}

interface BillingBundlePass {
  id: number
  memberName: string | null
  packageLabel: string | null
  classCountPurchased: number
  classesRemaining: number
  status: string
  expiresAt: string | null
}

interface BillingBundleUsage {
  id: number
  entryType: string
  creditDelta: number | null
  classesRemainingAfter: number
  reason: string | null
  packageLabel: string | null
  createdAt: string
}

interface BillingAccountSummary {
  charges: BillingCharge[]
  payments: BillingPayment[]
  chargesCents: number
  paymentsCents: number
  refundsCents?: number
  balanceCents: number
  canSeeFamily: boolean
  stripeEnabled?: boolean
  subscriptions?: BillingSubscriptionSummary[]
  monthlyTotals?: { grossCents: number; discountCents: number; netCents: number }
  bundlePasses?: BillingBundlePass[]
  bundleUsage?: BillingBundleUsage[]
  currentPeriod?: import('./member/MemberBillingPanel').BillingCurrentPeriod | null
  billingHistory?: import('./member/MemberBillingPanel').BillingHistoryMonth[]
}

interface MemberWaiver {
  id: number
  name: string
  version: string
  body: string
  waiver_type?: string | null
  is_required?: boolean
  acceptance_id?: number | null
  accepted_at?: string | null
  signature_name?: string | null
}

export default function MemberDashboard({
  onLogout,
  availablePortals = ['member'],
  onSwitchPortal,
}: MemberDashboardProps) {
  const [activeTab, setActiveTab] = useState<MemberTab>('home')
  const [openMessageThreadId, setOpenMessageThreadId] = useState<number | null>(null)
  const [eventMessagesLoadingId, setEventMessagesLoadingId] = useState<number | null>(null)
  const [navOpen, setNavOpen] = useState(false)
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
  const [enrollments, setEnrollments] = useState<MemberEnrollmentRow[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const [classesOffered, setClassesOffered] = useState<PublicProgramOffered[]>([])
  const [classesOfferedLoading, setClassesOfferedLoading] = useState(false)
  const [classesOfferedError, setClassesOfferedError] = useState<string | null>(null)
  const [multiClassPasses, setMultiClassPasses] = useState<MemberMultiClassPassBalance[]>([])
  
  // Events tab state
  const [events, setEvents] = useState<Event[]>([])
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [eventsLoading, setEventsLoading] = useState(false)
  const [showAllEvents, setShowAllEvents] = useState(true)
  const [selectedFamilyMembersForFilter, setSelectedFamilyMembersForFilter] = useState<number[]>([])
  const [eventView, setEventView] = useState<'upcoming' | 'past'>('upcoming') // Toggle between past and upcoming events
  const [billingPayments, setBillingPayments] = useState<BillingPayment[]>([])
  const [billingAccount, setBillingAccount] = useState<BillingAccountSummary | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [waivers, setWaivers] = useState<MemberWaiver[]>([])
  const [waiversLoading, setWaiversLoading] = useState(false)
  const [waiverSignature, setWaiverSignature] = useState('')
  const [waiverComments, setWaiverComments] = useState('')
  const [waiverAgreeAll, setWaiverAgreeAll] = useState(false)
  const [waiverCheckedIds, setWaiverCheckedIds] = useState<number[]>([])
  const [paymentPolicyAcknowledged, setPaymentPolicyAcknowledged] = useState(false)
  const [waiverSubmitting, setWaiverSubmitting] = useState(false)
  const [waiverError, setWaiverError] = useState<string | null>(null)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [enrollmentConfirmMessage, setEnrollmentConfirmMessage] = useState<string | null>(null)
  const [enrollmentConfirmError, setEnrollmentConfirmError] = useState<string | null>(null)
  const [enrollmentConfirming, setEnrollmentConfirming] = useState(false)
  const [hiddenMemberTabs, setHiddenMemberTabs] = useState<MemberTab[]>([])
  const [memberTabOrder, setMemberTabOrder] = useState<MemberTab[]>(NAV.map((item) => item.tab))

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
  const getMostRecentEnrollmentDate = (enrollments: Array<{ created_at?: string | null; createdAt?: string | null }>): string | null => {
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
    const nextValue = field === 'phone' ? formatPhoneNumber(value) : value
    handleUpdateMember(memberId, (prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        contactInfo: {
          ...prev.sections.contactInfo,
          tempData: { ...prev.sections.contactInfo.tempData, [field]: nextValue },
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

  const openEventMessages = async (eventId: number | string) => {
    const id = Number(eventId)
    if (!Number.isFinite(id) || id <= 0) return
    setEventMessagesLoadingId(id)
    try {
      const threads = await fetchEventMessageThreads('member', id, coachFetch)
      const threadId = pickEventDiscussionThreadId(threads)
      if (threadId != null) {
        setOpenMessageThreadId(threadId)
        setActiveTab('messages')
      } else {
        alert('No message threads are available for this event yet.')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not open event messages')
    } finally {
      setEventMessagesLoadingId(null)
    }
  }

  useEffect(() => {
    fetchProfileData()
  }, [])

  useEffect(() => {
    const onNavigateNotification = (evt: globalThis.Event) => {
      const detail = (evt as CustomEvent<NotificationNavigateDetail>).detail
      if (!detail || detail.portal !== 'member') return
      if (detail.tab) setActiveTab(detail.tab as MemberTab)
      if (detail.threadId != null) setOpenMessageThreadId(detail.threadId)
      setNavOpen(false)
    }
    window.addEventListener(NOTIFICATION_NAV_EVENT, onNavigateNotification)
    return () => window.removeEventListener(NOTIFICATION_NAV_EVENT, onNavigateNotification)
  }, [])

  useEffect(() => {
    if (token) {
      void fetchBillingStatements()
    }
  }, [token])

  useEffect(() => {
    if (activeTab === 'home') {
      fetchEnrollments()
      loadClassesOffered()
    } else if (activeTab === 'classes') {
      fetchEnrollments()
      loadClassesOffered()
      void fetchBillingStatements()
      if (token) {
        void fetchMemberMultiClassPasses(token)
          .then(setMultiClassPasses)
          .catch(() => setMultiClassPasses([]))
      }
    } else if (activeTab === 'events') {
      fetchEvents()
      fetchEnrollments() // Need enrollments for filtering
    } else if (activeTab === 'profile') {
      fetchEnrollments() // Need enrollments to display on profile
      fetchBillingStatements() // Profile shows Payment History; load billing data here too
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
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Failed to add family member')
      }
      setAddFamilyMemberData({ firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '' })
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
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
      const [accountResponse, paymentsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/members/billing/account`, { headers }),
        fetch(`${apiUrl}/api/members/billing/payments`, { headers }),
      ])
      if (!paymentsResponse.ok) throw new Error(`Backend returned ${paymentsResponse.status}`)
      const paymentsData = await paymentsResponse.json()
      setBillingPayments(paymentsData.data ?? [])
      if (accountResponse.ok) {
        const accountData = await accountResponse.json()
        setBillingAccount(accountData.data ?? null)
      } else {
        setBillingAccount(null)
      }
    } catch (error) {
      console.error('Error fetching billing data:', error)
      setBillingPayments([])
      setBillingAccount(null)
    } finally {
      setBillingLoading(false)
    }
  }

  const visibleNav = useMemo(
    () =>
      orderPortalItems(NAV, memberTabOrder, (item) => item.tab).filter((item) =>
        isPortalTabVisible(item.tab, hiddenMemberTabs),
      ),
    [hiddenMemberTabs, memberTabOrder],
  )

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${apiUrl}/api/members/portal-config`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok || cancelled) return
        const json = await res.json()
        if (cancelled) return
        setHiddenMemberTabs(Array.isArray(json.data?.hiddenTabs) ? json.data.hiddenTabs : [])
        setMemberTabOrder(Array.isArray(json.data?.tabOrder) ? json.data.tabOrder : NAV.map((item) => item.tab))
      } catch {
        if (!cancelled) setHiddenMemberTabs([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiUrl, token])

  useEffect(() => {
    if (isPortalTabVisible(activeTab, hiddenMemberTabs)) return
    setActiveTab(firstVisiblePortalTab(visibleNav.map((item) => item.tab), hiddenMemberTabs, 'home'))
  }, [activeTab, hiddenMemberTabs, visibleNav])

  useEffect(() => {
    if (!token) return

    const params = new URLSearchParams(window.location.search)
    const enrollmentStatus = params.get('enrollment')

    if (enrollmentStatus === 'cancelled') {
      clearPendingEnrollmentId()
      const url = new URL(window.location.href)
      url.searchParams.delete('enrollment')
      window.history.replaceState({}, '', url.pathname + url.search + url.hash)
      return
    }

    if (enrollmentStatus !== 'paid') return

    const checkoutSessionId = params.get('session_id') ?? undefined
    const pendingEnrollmentId = readPendingEnrollmentId() ?? undefined
    const clearEnrollmentReturnParams = () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('enrollment')
      url.searchParams.delete('session_id')
      window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    }

    let cancelled = false
    ;(async () => {
      try {
        setEnrollmentConfirming(true)
        setEnrollmentConfirmError(null)
        setEnrollmentConfirmMessage(null)
        const result = await confirmEnrollmentCheckoutSession(token, {
          checkoutSessionId,
          pendingEnrollmentId,
        })
        if (cancelled) return

        clearPendingEnrollmentId()
        clearEnrollmentReturnParams()

        if (result.status === 'none') {
          await fetchEnrollments(true)
          await fetchBillingStatements()
          return
        }

        setActiveTab('classes')
        setEnrollmentConfirmMessage(
          result.status === 'already_completed'
            ? 'Your enrollment is already active.'
            : 'Enrollment complete. Your classes and billing have been updated.',
        )
        await fetchEnrollments(true)
        await fetchBillingStatements()
      } catch (err) {
        if (!cancelled) {
          clearEnrollmentReturnParams()
          setEnrollmentConfirmError(
            err instanceof Error ? err.message : 'Failed to confirm enrollment after payment.',
          )
        }
      } finally {
        if (!cancelled) setEnrollmentConfirming(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  const [payNowLoading, setPayNowLoading] = useState(false)
  const handlePayNow = async () => {
    if (!token) return
    setPayNowLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/members/billing/checkout-session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok && data.data?.url) {
        window.location.href = data.data.url
      } else {
        alert(data.message || 'Online payments are not available right now.')
      }
    } catch {
      alert('Failed to start checkout.')
    } finally {
      setPayNowLoading(false)
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

  const acceptAllWaivers = async () => {
    if (!token) return
    const validationError = validateWaiverSigning({
      waivers,
      checkedTemplateIds: waiverCheckedIds,
      agreeAll: waiverAgreeAll,
      signatureName: waiverSignature,
      paymentPolicyAcknowledged,
    })
    if (validationError) {
      setWaiverError(validationError)
      return
    }
    setWaiverSubmitting(true)
    setWaiverError(null)
    try {
      const unsignedIds = waivers.filter((w) => !w.acceptance_id).map((w) => w.id)
      const response = await fetch(`${apiUrl}/api/members/waivers/accept-all`, {
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
          comments: waiverComments,
          acceptedTemplateIds: unsignedIds.length > 0 ? unsignedIds : waiverCheckedIds,
          paymentPolicyAcknowledged,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || `Backend returned ${response.status}`)
      }
      setWaiverSignature('')
      setWaiverComments('')
      setWaiverAgreeAll(false)
      setWaiverCheckedIds([])
      setPaymentPolicyAcknowledged(false)
      await fetchWaivers()
    } catch (error) {
      setWaiverError(error instanceof Error ? error.message : 'Failed to submit waivers')
    } finally {
      setWaiverSubmitting(false)
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


  const fetchEnrollments = async (preserveOnError = false) => {
    if (!token) return
    try {
      setEnrollmentsLoading(true)
      const response = await fetch(`${apiUrl}/api/members/enrollments`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) {
        throw new Error(`Failed to load enrollments (${response.status})`)
      }
      const data = await response.json()
      setEnrollments(Array.isArray(data.enrollments) ? data.enrollments : [])
    } catch (error) {
      console.error('Error fetching enrollments:', error)
      if (!preserveOnError) setEnrollments([])
    } finally {
      setEnrollmentsLoading(false)
    }
  }
  const enrollmentSummaryForMember = (memberId: number) => {
    const rows = enrollments.filter((e) => e.member_id === memberId)
    if (rows.length === 0) return null
    const byClass = new Map<string, number>()
    for (const row of rows) {
      const name = row.class_name || 'Class'
      byClass.set(name, (byClass.get(name) || 0) + 1)
    }
    return [...byClass.entries()]
      .map(([name, count]) => (count > 1 ? `${name} (${count} slots)` : name))
      .join(', ')
  }

  const enrollableMembers: EnrollableMember[] = (() => {
    const out: EnrollableMember[] = []
    const seen = new Set<number>()
    if (profileData?.id != null) {
      const id = Number(profileData.id)
      const first = profileData.firstName || profileData.first_name || ''
      const last = profileData.lastName || profileData.last_name || ''
      out.push({ id, label: `${first} ${last} (You)`.trim() })
      seen.add(id)
    }
    for (const fm of familyMembers) {
      const id = fm.id != null ? Number(fm.id) : null
      if (id != null && !Number.isNaN(id) && !seen.has(id)) {
        out.push({ id, label: `${fm.first_name} ${fm.last_name}`.trim() })
        seen.add(id)
      }
    }
    return out
  })()

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

  const dismissEnrollmentBanner = () => {
    setEnrollmentConfirmMessage(null)
    setEnrollmentConfirmError(null)
  }

  return (
    <div className="min-h-screen h-dvh max-h-dvh bg-gray-50 flex flex-col overflow-hidden">
      {/* Member Portal Header Section - Dark Background */}
      <div className="bg-gradient-to-br from-black via-gray-900 to-black shrink-0">
        <div className="container-admin py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" className="lg:hidden text-white" onClick={() => setNavOpen((o) => !o)}>
              {navOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white">
              VORTEX <span className="text-vortex-red">MEMBER</span> PORTAL
            </h1>
          </div>
          <PortalNavButtons
            activePortal="member"
            availablePortals={availablePortals}
            onSwitchPortal={onSwitchPortal}
            onLogout={onLogout}
            notifications={<NotificationBell apiPrefix="member" />}
          />
        </div>
      </div>

      {(enrollmentConfirming || enrollmentConfirmMessage || enrollmentConfirmError) && (
        <div className="container-admin pt-4">
          <div
            className={`rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
              enrollmentConfirming
                ? 'border-blue-200 bg-blue-50 text-blue-900'
                : enrollmentConfirmError
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : enrollmentConfirmMessage?.includes('complete')
                    ? 'border-green-200 bg-green-50 text-green-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <span className="min-w-0">
              {enrollmentConfirming
                ? 'Confirming your enrollment payment…'
                : enrollmentConfirmError ?? enrollmentConfirmMessage}
            </span>
            {!enrollmentConfirming && (
              <button
                type="button"
                onClick={dismissEnrollmentBanner}
                className="shrink-0 rounded p-0.5 text-current opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Workspace: sidebar nav + main content */}
      <div className="container-admin pt-6 pb-6 grid gap-6 lg:grid-cols-[220px_1fr] flex-1 min-h-0 overflow-hidden">
        <nav className={`${navOpen ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-white border border-gray-200 rounded-xl p-2 sticky top-4">
            {visibleNav.map((item) => {
              const Icon = item.icon
              const active = activeTab === item.tab
              return (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.tab)
                    setNavOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-vortex-red text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <Icon className="w-4 h-4" /> {item.label}
                </button>
              )
            })}
          </div>
        </nav>
        <main className={`min-w-0 flex flex-col min-h-0 flex-1 ${activeTab === 'messages' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className="flex flex-col flex-1 min-h-0 h-full">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <MemberHomePanel
                  onNavigate={setActiveTab}
                  firstName={profileData?.firstName}
                  hiddenTabs={hiddenMemberTabs}
                  tabOrder={memberTabOrder}
                />
              </motion.div>
            )}

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
                          type="email"
                          value={addFamilyMemberData.email}
                          onChange={(e) => setAddFamilyMemberData((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="Email"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          type="tel"
                          value={addFamilyMemberData.phone}
                          onChange={(e) =>
                            setAddFamilyMemberData((prev) => ({
                              ...prev,
                              phone: formatPhoneNumber(e.target.value),
                            }))
                          }
                          placeholder={PHONE_INPUT_PLACEHOLDER}
                          maxLength={PHONE_INPUT_MAX_LENGTH}
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
                            <th className="py-3 px-4 font-semibold whitespace-nowrap">Enrolled In</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap">Status</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap w-0 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((member) => {
                            const isCurrent = member.id === profileData?.id
                            const enrollmentSummary = enrollmentSummaryForMember(member.id)
                            const hasEnrollments = !!enrollmentSummary
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
                                <td className="py-3 px-4 align-middle text-gray-700 max-w-[220px]">
                                  {hasEnrollments ? (
                                    <span className="text-xs">{enrollmentSummary}</span>
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
                <MemberEnrollmentsPanel
                  enrollments={enrollments}
                  loading={enrollmentsLoading}
                  currentMemberId={profileData?.id != null ? Number(profileData.id) : undefined}
                  memberToken={token}
                  onEnrollmentsChanged={async (result) => {
                    if (result?.immediate) {
                      setEnrollments((prev) => prev.filter((e) => e.id !== result.signupId))
                    } else if (result?.effectiveDate) {
                      setEnrollments((prev) =>
                        prev.map((e) =>
                          e.id === result.signupId
                            ? { ...e, cancel_effective_date: result.effectiveDate }
                            : e,
                        ),
                      )
                    }
                    void fetchEnrollments(true)
                  }}
                  classesOffered={classesOffered}
                  multiClassPasses={multiClassPasses.map((p) => ({
                    id: p.id,
                    programsId: p.programsId,
                    packageLabel: p.packageLabel,
                    classesRemaining: p.classesRemaining,
                    classCountPurchased: p.classCountPurchased,
                  }))}
                />

                {/* Classes Offered */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
                  {classesOfferedLoading && (
                    <div className="text-center py-12 text-gray-600">Loading classes…</div>
                  )}
                  {classesOfferedError && (
                    <div className="text-center py-8 text-red-600">{classesOfferedError}</div>
                  )}
                  {!classesOfferedLoading && !classesOfferedError && classesOffered.length === 0 && (
                    <div className="text-center py-12 text-gray-500">No classes are listed at this time.</div>
                  )}
                  {!classesOfferedLoading && !classesOfferedError && classesOffered.length > 0 && token && profileData?.id != null && (
                    <MemberClassesOfferedEnroll
                      apiUrl={apiUrl}
                      memberToken={token}
                      stripeEnabled={Boolean(billingAccount?.stripeEnabled)}
                      programs={classesOffered}
                      members={enrollableMembers}
                      defaultMemberId={Number(profileData.id)}
                      enrollments={enrollments}
                      onEnrolled={() => {
                        void fetchEnrollments()
                        if (token) {
                          void fetchMemberMultiClassPasses(token)
                            .then(setMultiClassPasses)
                            .catch(() => setMultiClassPasses([]))
                        }
                      }}
                    />
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
                className="flex flex-col flex-1 min-h-0 h-full"
              >
                <MemberMessagesTab
                  initialThreadId={openMessageThreadId}
                  onInitialThreadOpened={() => setOpenMessageThreadId(null)}
                />
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

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void openEventMessages(event.id)}
                                disabled={eventMessagesLoadingId === Number(event.id)}
                                className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 min-h-[44px]"
                              >
                                <MessageSquare className="w-4 h-4" />
                                {eventMessagesLoadingId === Number(event.id) ? 'Opening…' : 'Event messages'}
                              </button>
                            </div>

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
              >
                <MemberBillingPanel
                  billingAccount={billingAccount}
                  billingLoading={billingLoading}
                  payNowLoading={payNowLoading}
                  onPayNow={handlePayNow}
                  formatMoney={formatMoney}
                />
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
                    Every athlete must have current waivers on file. Check each waiver, then sign once at the bottom.
                  </p>
                  {waiverError && (
                    <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{waiverError}</div>
                  )}
                  {waiversLoading ? (
                    <div className="text-center py-12 text-gray-600">Loading waivers...</div>
                  ) : waivers.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No waiver templates are currently required.</div>
                  ) : waivers.every((w) => w.acceptance_id != null) ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        All required waivers are signed.
                      </div>
                      <WaiverSigningBlock
                        waivers={waivers}
                        checkedTemplateIds={[]}
                        onToggleTemplate={() => {}}
                        agreeAll={false}
                        onAgreeAllChange={() => {}}
                        signatureName=""
                        onSignatureNameChange={() => {}}
                        comments=""
                        onCommentsChange={() => {}}
                        paymentPolicyAcknowledged={false}
                        onPaymentPolicyAcknowledgedChange={() => {}}
                        readOnly
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <WaiverSigningBlock
                        waivers={waivers}
                        checkedTemplateIds={waiverCheckedIds}
                        onToggleTemplate={(id, checked) =>
                          setWaiverCheckedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))
                        }
                        agreeAll={waiverAgreeAll}
                        onAgreeAllChange={setWaiverAgreeAll}
                        signatureName={waiverSignature}
                        onSignatureNameChange={setWaiverSignature}
                        comments={waiverComments}
                        onCommentsChange={setWaiverComments}
                        paymentPolicyAcknowledged={paymentPolicyAcknowledged}
                        onPaymentPolicyAcknowledgedChange={setPaymentPolicyAcknowledged}
                      />
                      <button
                        type="button"
                        disabled={waiverSubmitting}
                        onClick={() => void acceptAllWaivers()}
                        className="px-6 py-3 bg-vortex-red text-white rounded-lg font-semibold text-sm disabled:opacity-60"
                      >
                        {waiverSubmitting ? 'Submitting…' : 'Submit all waivers'}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'preferences' && (
              <motion.div
                key="preferences"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <PortalPreferencesPanel role="member" fetcher={coachFetch} />
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </main>
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
                  {(() => {
                    const memberEnrollmentRows = viewingMember
                      ? enrollments.filter((e) => e.member_id === viewingMember.id)
                      : []
                    if (memberEnrollmentRows.length === 0) {
                      return <div className="text-gray-500 text-sm">No active enrollments</div>
                    }
                    return (
                      <>
                        <div className="space-y-2">
                          {memberEnrollmentRows.map((enrollment) => (
                            <div key={`${enrollment.source || 'row'}-${enrollment.id}`} className="bg-white border border-gray-200 rounded-lg p-3">
                              <div className="text-gray-900 font-medium">{enrollmentClassHeading(enrollment)}</div>
                              <div className="text-gray-500 text-sm mt-1">{enrollment.slot_label}</div>
                              {enrollment.created_at && (
                                <div className="text-gray-500 text-xs mt-1">
                                  Enrolled: {formatTimeSince(enrollment.created_at)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 text-sm text-gray-600">
                          <span className="font-semibold">Last Enrollment:</span>{' '}
                          {formatTimeSince(
                            getMostRecentEnrollmentDate(
                              memberEnrollmentRows.map((e) => ({ created_at: e.created_at })),
                            ),
                          )}
                        </div>
                      </>
                    )
                  })()}
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
                          placeholder={PHONE_INPUT_PLACEHOLDER}
                          maxLength={PHONE_INPUT_MAX_LENGTH}
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
                      To move a member between families, contact your facility administrator.
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
