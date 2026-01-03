import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit2, Archive, X, ChevronDown, ChevronUp, UserPlus, Eye, Plus } from 'lucide-react'
import { getApiUrl } from '../utils/api'

// Member-related interfaces
interface EmergencyContact {
  id: number
  name: string
  relationship?: string | null
  phone: string
  email?: string | null
}

interface Athlete {
  id: number
  first_name: string
  last_name: string
  date_of_birth: string
  age?: number
  medical_notes?: string | null
  internal_flags?: string | null
  family_id: number
  user_id?: number | null
  linked_user_id?: number | null
  linked_user_email?: string | null
  linked_user_name?: string | null
  linked_user_role?: string | null
  created_at: string
  updated_at: string
  emergency_contacts?: EmergencyContact[]
}

interface Guardian {
  id: number
  email: string
  fullName: string
  phone?: string | null
  isPrimary: boolean
}

interface Family {
  id: number
  family_name?: string | null
  primary_user_id?: number | null
  primary_email?: string | null
  primary_name?: string | null
  primary_phone?: string | null
  guardians?: Guardian[]
  athletes?: Athlete[]
  created_at: string
  updated_at: string
  archived?: boolean
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

type EnrollmentData = {
  id: string
  programId: number | null
  program: string
  daysPerWeek: number
  selectedDays: string[]
  isCompleted: boolean
  isExpanded?: boolean
}

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
  enrollments: EnrollmentData[]
  dateOfBirth: string
  medicalNotes: string
  isFinished: boolean
  sections: {
    contactInfo: { isExpanded: boolean; tempData: { firstName: string; lastName: string; email: string; phone: string; addressStreet: string; addressCity: string; addressState: string; addressZip: string } }
    loginSecurity: { isExpanded: boolean; tempData: { username: string; password: string } }
    enrollment: { isExpanded: boolean; tempData: { programId: number | null; program: string; daysPerWeek: number; selectedDays: string[] } }
  }
}

export default function AdminMembers() {
  // State
  const [families, setFamilies] = useState<Family[]>([])
  const [familiesLoading, setFamiliesLoading] = useState(false)
  const [familySearchQuery, setFamilySearchQuery] = useState('')
  const [showArchivedFamilies, setShowArchivedFamilies] = useState(false)
  
  // Member modal state
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [memberSearchResults, setMemberSearchResults] = useState<Family[]>([])
  const [selectedFamilyForMember, setSelectedFamilyForMember] = useState<Family | null>(null)
  const [memberModalMode, setMemberModalMode] = useState<'search' | 'new-family' | 'existing-family'>('search')
  
  // Family member creation state
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberData[]>([
    {
      id: 'member-1',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      addressStreet: '',
      addressCity: '',
      addressState: '',
      addressZip: '',
      username: '',
      password: 'vortex',
      enrollments: [],
      dateOfBirth: '',
      medicalNotes: '',
      isFinished: false,
      sections: {
        contactInfo: { isExpanded: true, tempData: { firstName: '', lastName: '', email: '', phone: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '' } },
        loginSecurity: { isExpanded: false, tempData: { username: '', password: 'vortex' } },
        enrollment: { isExpanded: false, tempData: { programId: null, program: 'Non-Participant', daysPerWeek: 1, selectedDays: [] } }
      }
    }
  ])
  
  const [expandedFamilyMemberId, setExpandedFamilyMemberId] = useState<string | number | null>(null)
  const [billingInfo, setBillingInfo] = useState({
    firstName: '',
    lastName: '',
    billingAddress: ''
  })
  const [isBillingExpanded, setIsBillingExpanded] = useState(true)
  
  // For new family creation with primary adult
  const [newPrimaryAdult, setNewPrimaryAdult] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
    username: '',
    password: 'vortex',
    program: 'Non-Participant',
    programId: null as number | null,
    daysPerWeek: 1,
    selectedDays: [] as string[]
  })
  
  const [newChildren, setNewChildren] = useState<Array<{
    firstName: string
    lastName: string
    dateOfBirth: string
    email: string
    password: string
    username: string
    medicalNotes: string
    internalFlags: string
    program: string
    programId: number | null
    daysPerWeek: number
    selectedDays: string[]
    userId: number | null
  }>>([])
  
  const [currentChild, setCurrentChild] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    password: '',
    username: '',
    medicalNotes: '',
    internalFlags: '',
    program: 'Non-Participant',
    programId: null as number | null,
    daysPerWeek: 1,
    selectedDays: [] as string[],
    userId: null as number | null
  })
  
  // View/Edit member state
  const [selectedFamilyForView, setSelectedFamilyForView] = useState<Family | null>(null)
  const [showFamilyViewModal, setShowFamilyViewModal] = useState(false)
  const [editingMember, setEditingMember] = useState<{guardian: Guardian, family: Family} | null>(null)
  const [viewingMember, setViewingMember] = useState<{guardian: Guardian, family: Family} | null>(null)
  const [showMemberEditModal, setShowMemberEditModal] = useState(false)
  const [showMemberViewModal, setShowMemberViewModal] = useState(false)
  
  const [editingMemberData, setEditingMemberData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
    username: '',
    password: ''
  })
  
  const [editingFamilyMembers, setEditingFamilyMembers] = useState<Array<{
    id?: number,
    firstName: string,
    lastName: string,
    dateOfBirth: string,
    email: string,
    username: string,
    password: string,
    medicalNotes: string,
    internalFlags: string,
    enrollments: Array<{
      id?: number,
      programId: number | null,
      program: string,
      daysPerWeek: number,
      selectedDays: string[]
    }>,
    userId: number | null
  }>>([])
  
  const [newFamilyMemberInEdit, setNewFamilyMemberInEdit] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    username: '',
    password: 'vortex',
    medicalNotes: '',
    internalFlags: '',
    enrollments: [] as Array<{
      id?: number,
      programId: number | null,
      program: string,
      daysPerWeek: number,
      selectedDays: string[]
    }>,
    address: ''
  })
  
  const [expandedViewFamilyMemberId, setExpandedViewFamilyMemberId] = useState<number | null>(null)
  
  // Programs for enrollment
  const [programs, setPrograms] = useState<Program[]>([])
  
  // Helper function to get active classes grouped by category
  const getActiveClassesByCategory = (programsList: Program[]) => {
    const activeClasses = programsList.filter(p => {
      if (!p.isActive || p.archived) return false
      const hasCategory = (p.categoryDisplayName && p.categoryDisplayName.trim()) || (p.categoryName && p.categoryName.trim())
      return hasCategory
    })
    
    const groupedByCategory = activeClasses.reduce((acc, program) => {
      const categoryName = program.categoryDisplayName || program.categoryName || 'Uncategorized'
      if (!acc[categoryName]) {
        acc[categoryName] = []
      }
      acc[categoryName].push(program)
      return acc
    }, {} as Record<string, Program[]>)
    
    Object.keys(groupedByCategory).forEach(category => {
      groupedByCategory[category].sort((a, b) => a.displayName.localeCompare(b.displayName))
    })
    
    const sortedCategories = Object.keys(groupedByCategory).sort()
    
    return { groupedByCategory, sortedCategories }
  }
  
  // Fetch functions
  const fetchFamilies = useCallback(async () => {
    try {
      setFamiliesLoading(true)
      const apiUrl = getApiUrl()
      const params = new URLSearchParams()
      if (familySearchQuery) {
        params.append('search', familySearchQuery)
      }
      const response = await fetch(`${apiUrl}/api/admin/families?${params.toString()}`)
      if (!response.ok) {
        setFamilies([])
        const errorText = await response.text().catch(() => response.statusText)
        console.error('Error fetching families:', response.status, errorText)
        if (response.status !== 500) {
          // Only show error for non-500 errors
        }
        return
      }
      const data = await response.json()
      if (data.success) {
        setFamilies(data.data)
      } else {
        setFamilies([])
      }
    } catch (error) {
      console.error('Error fetching families:', error)
      setFamilies([])
    } finally {
      setFamiliesLoading(false)
    }
  }, [familySearchQuery])
  
  const fetchAllPrograms = useCallback(async () => {
    try {
      // Loading state handled by programs array
      const apiUrl = getApiUrl()
      
      const [activeResponse, archivedResponse] = await Promise.all([
        fetch(`${apiUrl}/api/admin/programs?archived=false`),
        fetch(`${apiUrl}/api/admin/programs?archived=true`)
      ])
      
      if (!activeResponse.ok || !archivedResponse.ok) {
        throw new Error(`Backend returned error`)
      }
      
      const [activeData, archivedData] = await Promise.all([
        activeResponse.json(),
        archivedResponse.json()
      ])
      
      if (activeData.success && archivedData.success) {
        setPrograms([...activeData.data, ...archivedData.data])
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
    } finally {
      // Loading complete
    }
  }, [])
  
  // Helper functions
  const generateUsername = async (firstName: string, lastName: string = ''): Promise<string> => {
    if (!firstName) return ''
    
    const cleanFirstName = firstName.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    if (!cleanFirstName) return ''
    
    const cleanLastName = lastName.toLowerCase().trim().replace(/[^a-z0-9]/g, '').substring(0, 2)
    
    const baseUsername = cleanFirstName + cleanLastName
    if (!baseUsername) return ''
    
    let username = baseUsername
    let counter = 1
    
    try {
      const apiUrl = getApiUrl()
      let found = false
      do {
        const response = await fetch(`${apiUrl}/api/admin/users?search=${encodeURIComponent(username)}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            const existingUser = data.data.find((u: { username?: string }) => u.username?.toLowerCase() === username.toLowerCase())
            if (existingUser) {
              found = true
              username = `${baseUsername}${counter}`
              counter++
            } else {
              found = false
            }
          } else {
            found = false
          }
        } else {
          found = false
        }
      } while (found && counter < 100)
    } catch (error) {
      console.error('Error checking username:', error)
    }
    
    return username
  }
  
  const combineAddress = (street: string, city: string, state: string, zip: string): string => {
    const parts = [street, city, state, zip].filter(part => part && part.trim())
    return parts.join(', ') || ''
  }
  
  const parseAddress = (address: string): { street: string; city: string; state: string; zip: string } => {
    if (!address) return { street: '', city: '', state: '', zip: '' }
    
    const parts = address.split(',').map(p => p.trim())
    
    if (parts.length >= 3) {
      const street = parts[0]
      const city = parts[1]
      const stateZip = parts[2] || ''
      const stateZipParts = stateZip.split(/\s+/)
      if (stateZipParts.length >= 2) {
        const state = stateZipParts[0]
        const zip = stateZipParts.slice(1).join(' ')
        return { street, city, state, zip }
      } else {
        return { street, city, state: stateZip, zip: '' }
      }
    } else if (parts.length === 2) {
      return { street: parts[0], city: parts[1], state: '', zip: '' }
    } else {
      return { street: address, city: '', state: '', zip: '' }
    }
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
  
  // Handler functions
  const handleArchiveFamily = async (id: number, archived: boolean) => {
    if (!confirm(archived ? 'Are you sure you want to archive this family?' : 'Are you sure you want to unarchive this family?')) {
      return
    }
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/families/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived })
      })
      if (response.ok) {
        await fetchFamilies()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to archive/unarchive family')
      }
    } catch (error) {
      console.error('Error archiving family:', error)
      alert('Failed to archive/unarchive family')
    }
  }
  
  const handleDeleteFamily = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this family? This will also delete all associated athletes. This action cannot be undone.')) {
      return
    }
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/families/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await fetchFamilies()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to delete family')
      }
    } catch (error) {
      console.error('Error deleting family:', error)
      alert('Failed to delete family')
    }
  }
  
  const handleViewFamily = (family: Family) => {
    setSelectedFamilyForView(family)
    setShowFamilyViewModal(true)
  }
  
  const handleEditFamily = (family: Family) => {
    handleViewFamily(family)
  }
  
  const handleViewMember = (guardian: Guardian, family: Family) => {
    setViewingMember({ guardian, family })
    setShowMemberViewModal(true)
  }
  
  const handleEditMember = async (guardian: Guardian, family: Family) => {
    setEditingMember({ guardian, family })
    
    const apiUrl = getApiUrl()
    
    let username = ''
    let address = ''
    try {
      const userResponse = await fetch(`${apiUrl}/api/admin/users/${guardian.id}`)
      if (userResponse.ok) {
        const userData = await userResponse.json()
        if (userData.success && userData.data) {
          username = userData.data.username || ''
          address = userData.data.address || ''
        }
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
    }
    
    const nameParts = guardian.fullName.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    
    const parsedAddress = parseAddress(address)
    
    setEditingMemberData({
      firstName,
      lastName,
      email: guardian.email || '',
      phone: guardian.phone || '',
      addressStreet: parsedAddress.street,
      addressCity: parsedAddress.city,
      addressState: parsedAddress.state,
      addressZip: parsedAddress.zip,
      username,
      password: ''
    })
    
    const familyMembers: Array<{
      id?: number,
      firstName: string,
      lastName: string,
      dateOfBirth: string,
      email: string,
      username: string,
      password: string,
      medicalNotes: string,
      internalFlags: string,
      enrollments: Array<{
        id?: number,
        programId: number | null,
        program: string,
        daysPerWeek: number,
        selectedDays: string[]
      }>,
      userId: number | null
    }> = []
    
    if (family.athletes) {
      for (const athlete of family.athletes) {
        const enrollments: Array<{
          id?: number,
          programId: number | null,
          program: string,
          daysPerWeek: number,
          selectedDays: string[]
        }> = []
        
        try {
          const enrollmentsResponse = await fetch(`${apiUrl}/api/admin/athletes/${athlete.id}/enrollments`)
          if (enrollmentsResponse.ok) {
            const enrollmentsData = await enrollmentsResponse.json()
            if (enrollmentsData.success && enrollmentsData.data && enrollmentsData.data.length > 0) {
              for (const enrollment of enrollmentsData.data) {
                enrollments.push({
                  id: enrollment.id,
                  programId: enrollment.program_id || null,
                  program: enrollment.program_display_name || 'Unknown Program',
                  daysPerWeek: enrollment.days_per_week || 1,
                  selectedDays: enrollment.selected_days || []
                })
              }
            }
          }
        } catch (error) {
          console.error('Error fetching enrollments:', error)
        }
        
        let email = ''
        let username = ''
        if (athlete.user_id) {
          try {
            const userResponse = await fetch(`${apiUrl}/api/admin/users/${athlete.user_id}`)
            if (userResponse.ok) {
              const userData = await userResponse.json()
              if (userData.success && userData.data) {
                email = userData.data.email || ''
                username = userData.data.username || ''
              }
            }
          } catch (error) {
            console.error('Error fetching athlete user details:', error)
          }
        }
        
        familyMembers.push({
          id: athlete.id,
          firstName: athlete.first_name,
          lastName: athlete.last_name,
          dateOfBirth: athlete.date_of_birth || '',
          email,
          username,
          password: '',
          medicalNotes: athlete.medical_notes || '',
          internalFlags: athlete.internal_flags || '',
          enrollments,
          userId: athlete.user_id || null
        })
      }
    }
    
    setEditingFamilyMembers(familyMembers)
    setShowMemberEditModal(true)
  }
  
  const handleSaveMemberEdit = async () => {
    if (!editingMember) return
    
    try {
      const apiUrl = getApiUrl()
      
      const response = await fetch(`${apiUrl}/api/admin/users/${editingMember.guardian.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: `${editingMemberData.firstName} ${editingMemberData.lastName}`,
          email: editingMemberData.email,
          phone: editingMemberData.phone ? cleanPhoneNumber(editingMemberData.phone) : null,
          address: combineAddress(editingMemberData.addressStreet, editingMemberData.addressCity, editingMemberData.addressState, editingMemberData.addressZip) || null,
          username: editingMemberData.username,
          ...(editingMemberData.password && { password: editingMemberData.password })
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to update user')
      }
      
      for (const member of editingFamilyMembers) {
        if (member.id) {
          await fetch(`${apiUrl}/api/admin/athletes/${member.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: member.firstName,
              lastName: member.lastName,
              dateOfBirth: member.dateOfBirth,
              medicalNotes: member.medicalNotes || null,
              internalFlags: member.internalFlags || null
            })
          })
          
          const birthDate = member.dateOfBirth ? new Date(member.dateOfBirth) : null
          const today = new Date()
          const age = birthDate ? today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0) : null
          if (age !== null && age >= 18 && member.userId) {
            await fetch(`${apiUrl}/api/admin/users/${member.userId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: member.email,
                username: member.username,
                ...(member.password && { password: member.password })
              })
            })
          }
          
          const existingEnrollments = await fetch(`${apiUrl}/api/admin/athletes/${member.id}/enrollments`)
          if (existingEnrollments.ok) {
            const enrollmentsData = await existingEnrollments.json()
            if (enrollmentsData.success && enrollmentsData.data) {
              for (const enrollment of enrollmentsData.data) {
                await fetch(`${apiUrl}/api/admin/enrollments/${enrollment.id}`, {
                  method: 'DELETE'
                })
              }
            }
          }
          
          for (const enrollment of (member.enrollments || [])) {
            if (enrollment.programId) {
              await fetch(`${apiUrl}/api/members/enroll`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({
                  programId: enrollment.programId,
                  familyMemberId: member.id,
                  daysPerWeek: enrollment.daysPerWeek,
                  selectedDays: enrollment.selectedDays
                })
              })
            }
          }
        } else {
          const birthDate = member.dateOfBirth ? new Date(member.dateOfBirth) : null
          const today = new Date()
          const age = birthDate ? today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0) : null
          const isAdult = age !== null && age >= 18
          
          let userId = null
          if (isAdult) {
            const userResponse = await fetch(`${apiUrl}/api/admin/users`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fullName: `${member.firstName} ${member.lastName}`,
                email: member.email,
                username: member.username,
                password: member.password || 'vortex',
                role: 'ATHLETE',
                address: combineAddress(editingMemberData.addressStreet, editingMemberData.addressCity, editingMemberData.addressState, editingMemberData.addressZip) || null
              })
            })
            if (userResponse.ok) {
              const userData = await userResponse.json()
              if (userData.success && userData.data) {
                userId = userData.data.id
              }
            }
          }
          
          const athleteResponse = await fetch(`${apiUrl}/api/admin/athletes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              familyId: editingMember.family.id,
              firstName: member.firstName,
              lastName: member.lastName,
              dateOfBirth: member.dateOfBirth,
              medicalNotes: member.medicalNotes || null,
              internalFlags: member.internalFlags || null,
              userId: userId
            })
          })
          
          if (athleteResponse.ok) {
            const athleteData = await athleteResponse.json()
            if (athleteData.success && athleteData.data) {
              for (const enrollment of (member.enrollments || [])) {
                if (enrollment.programId) {
                  await fetch(`${apiUrl}/api/members/enroll`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                    },
                    body: JSON.stringify({
                      programId: enrollment.programId,
                      familyMemberId: athleteData.data.id,
                      daysPerWeek: enrollment.daysPerWeek,
                      selectedDays: enrollment.selectedDays
                    })
                  })
                }
              }
            }
          }
        }
      }
      
      await fetchFamilies()
      setShowMemberEditModal(false)
      setEditingMember(null)
      alert('Member updated successfully!')
    } catch (error) {
      console.error('Error updating member:', error)
      alert(error instanceof Error ? error.message : 'Failed to update member')
    }
  }
  
  const searchFamiliesForMember = async (query: string) => {
    if (!query || query.length < 2) {
      setMemberSearchResults([])
      return
    }
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/families?search=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setMemberSearchResults(data.data)
        }
      }
    } catch (error) {
      console.error('Error searching families:', error)
    }
  }
  
  const handleSelectFamilyForMember = (family: Family) => {
    setSelectedFamilyForMember(family)
    setMemberModalMode('existing-family')
    setMemberSearchQuery('')
    setMemberSearchResults([])
    // Initialize familyMembers for adding to existing family
    setFamilyMembers([{
      id: 'member-1',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      addressStreet: '',
      addressCity: '',
      addressState: '',
      addressZip: '',
      username: '',
      password: 'vortex',
      enrollments: [],
      dateOfBirth: '',
      medicalNotes: '',
      isFinished: false,
      sections: {
        contactInfo: { isExpanded: true, tempData: { firstName: '', lastName: '', email: '', phone: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '' } },
        loginSecurity: { isExpanded: false, tempData: { username: '', password: 'vortex' } },
        enrollment: { isExpanded: false, tempData: { programId: null, program: 'Non-Participant', daysPerWeek: 1, selectedDays: [] } }
      }
    }])
    setExpandedFamilyMemberId('member-1')
    setBillingInfo({ firstName: '', lastName: '', billingAddress: '' })
    setIsBillingExpanded(true)
  }
  
  const handleCreateFamilyWithPrimaryAdult = async () => {
    try {
      // Validate all family members have required fields
      for (const member of familyMembers) {
        if (!member.sections.contactInfo.tempData.firstName || 
            !member.sections.contactInfo.tempData.lastName || 
            !member.sections.contactInfo.tempData.email || 
            !member.sections.contactInfo.tempData.phone) {
          alert(`Please complete contact information for all family members`)
          return
        }
        if (member.id === familyMembers[0].id && (!member.sections.loginSecurity.tempData.username || !member.sections.loginSecurity.tempData.password)) {
          alert(`Please complete login information for the primary adult`)
          return
        }
      }
      
      // Validate days selection for all enrollments
      for (const member of familyMembers) {
        for (const enrollment of member.enrollments) {
          if (enrollment.programId && enrollment.selectedDays.length !== enrollment.daysPerWeek) {
            alert(`Please select exactly ${enrollment.daysPerWeek} day(s) for ${member.firstName} ${member.lastName}'s enrollment in ${enrollment.program}`)
            return
          }
        }
      }
      
      const apiUrl = getApiUrl()
      
      // Create primary user account
      const primaryMember = familyMembers[0]
      const primaryUserResponse = await fetch(`${apiUrl}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: `${primaryMember.sections.contactInfo.tempData.firstName} ${primaryMember.sections.contactInfo.tempData.lastName}`,
          email: primaryMember.sections.contactInfo.tempData.email,
          phone: cleanPhoneNumber(primaryMember.sections.contactInfo.tempData.phone),
          username: primaryMember.sections.loginSecurity.tempData.username,
          password: primaryMember.sections.loginSecurity.tempData.password || 'vortex',
          role: 'PARENT_GUARDIAN',
          address: combineAddress(
            primaryMember.sections.contactInfo.tempData.addressStreet,
            primaryMember.sections.contactInfo.tempData.addressCity,
            primaryMember.sections.contactInfo.tempData.addressState,
            primaryMember.sections.contactInfo.tempData.addressZip
          ) || null
        })
      })
      
      if (!primaryUserResponse.ok) {
        const data = await primaryUserResponse.json()
        throw new Error(data.message || 'Failed to create primary user account')
      }
      
      const primaryUserData = await primaryUserResponse.json()
      const primaryUserId = primaryUserData.success ? primaryUserData.data.id : null
      
      if (!primaryUserId) {
        throw new Error('Failed to get primary user ID')
      }
      
      // Create family
      const familyResponse = await fetch(`${apiUrl}/api/admin/families`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyName: billingInfo.firstName && billingInfo.lastName 
            ? `${billingInfo.firstName} ${billingInfo.lastName} Family`
            : null,
          primaryUserId: primaryUserId,
          guardianIds: [primaryUserId]
        })
      })
      
      if (!familyResponse.ok) {
        const data = await familyResponse.json()
        throw new Error(data.message || 'Failed to create family')
      }
      
      const familyData = await familyResponse.json()
      const familyId = familyData.success ? familyData.data.id : null
      
      if (!familyId) {
        throw new Error('Failed to get family ID')
      }
      
      // Create additional user accounts and athletes for all family members
      for (const member of familyMembers) {
        const birthDate = member.dateOfBirth ? new Date(member.dateOfBirth) : null
        const today = new Date()
        const age = birthDate ? today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0) : null
        const isAdult = age !== null && age >= 18
        
        let userId = null
        if (isAdult && member.id !== familyMembers[0].id) {
          // Create user account for additional adults
          const userResponse = await fetch(`${apiUrl}/api/admin/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: `${member.sections.contactInfo.tempData.firstName} ${member.sections.contactInfo.tempData.lastName}`,
              email: member.sections.contactInfo.tempData.email,
              phone: cleanPhoneNumber(member.sections.contactInfo.tempData.phone),
              username: member.sections.loginSecurity.tempData.username,
              password: member.sections.loginSecurity.tempData.password || 'vortex',
              role: 'PARENT_GUARDIAN',
              address: combineAddress(
                member.sections.contactInfo.tempData.addressStreet,
                member.sections.contactInfo.tempData.addressCity,
                member.sections.contactInfo.tempData.addressState,
                member.sections.contactInfo.tempData.addressZip
              ) || null
            })
          })
          
          if (userResponse.ok) {
            const userData = await userResponse.json()
            if (userData.success && userData.data) {
              userId = userData.data.id
              
              // Add as guardian
              const updateResponse = await fetch(`${apiUrl}/api/admin/families/${familyId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  familyName: familyData.data.family_name,
                  primaryUserId: primaryUserId,
                  guardianIds: [
                    ...(familyData.data.guardians?.map((g: Guardian) => g.id) || []),
                    userId
                  ]
                })
              })
              
              if (!updateResponse.ok) {
                console.warn('Failed to add guardian to family')
              }
            }
          }
        } else if (member.id === familyMembers[0].id) {
          userId = primaryUserId
        }
        
        // Create athlete record for all members
        const athleteResponse = await fetch(`${apiUrl}/api/admin/athletes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            familyId: familyId,
            firstName: member.sections.contactInfo.tempData.firstName,
            lastName: member.sections.contactInfo.tempData.lastName,
            dateOfBirth: member.dateOfBirth,
            medicalNotes: member.medicalNotes || null,
            internalFlags: null,
            userId: userId
          })
        })
        
        if (athleteResponse.ok) {
          const athleteData = await athleteResponse.json()
          if (athleteData.success && athleteData.data) {
            // Create enrollments
            for (const enrollment of member.enrollments) {
              if (enrollment.programId) {
                await fetch(`${apiUrl}/api/members/enroll`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                  },
                  body: JSON.stringify({
                    programId: enrollment.programId,
                    familyMemberId: athleteData.data.id,
                    daysPerWeek: enrollment.daysPerWeek,
                    selectedDays: enrollment.selectedDays
                  })
                })
              }
            }
          }
        }
      }
      
      await fetchFamilies()
      setShowMemberModal(false)
      setMemberModalMode('search')
      setSelectedFamilyForMember(null)
      setFamilyMembers([{
        id: 'member-1',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        addressStreet: '',
        addressCity: '',
        addressState: '',
        addressZip: '',
        username: '',
        password: 'vortex',
        enrollments: [],
        dateOfBirth: '',
        medicalNotes: '',
        isFinished: false,
        sections: {
          contactInfo: { isExpanded: true, tempData: { firstName: '', lastName: '', email: '', phone: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '' } },
          loginSecurity: { isExpanded: false, tempData: { username: '', password: 'vortex' } },
          enrollment: { isExpanded: false, tempData: { programId: null, program: 'Non-Participant', daysPerWeek: 1, selectedDays: [] } }
        }
      }])
      setBillingInfo({ firstName: '', lastName: '', billingAddress: '' })
      alert('Family created successfully!')
    } catch (error) {
      console.error('Error creating family:', error)
      alert(error instanceof Error ? error.message : 'Failed to create family')
    }
  }
  
  // Handler for adding members to existing family
  const handleAddMembersToExistingFamily = async () => {
    if (!selectedFamilyForMember) return
    
    try {
      // Validate all family members have required fields
      for (const member of familyMembers) {
        if (!member.sections.contactInfo.tempData.firstName || 
            !member.sections.contactInfo.tempData.lastName) {
          alert(`Please complete contact information for all family members`)
          return
        }
      }
      
      // Validate days selection for all enrollments
      for (const member of familyMembers) {
        for (const enrollment of member.enrollments) {
          if (enrollment.programId && enrollment.selectedDays.length !== enrollment.daysPerWeek) {
            alert(`Please select exactly ${enrollment.daysPerWeek} day(s) for ${member.firstName} ${member.lastName}'s enrollment in ${enrollment.program}`)
            return
          }
        }
      }
      
      const apiUrl = getApiUrl()
      const familyId = selectedFamilyForMember.id
      
      // Create user accounts and athletes for all family members
      for (const member of familyMembers) {
        const birthDate = member.dateOfBirth ? new Date(member.dateOfBirth) : null
        const today = new Date()
        const age = birthDate ? today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0) : null
        const isAdult = age !== null && age >= 18
        
        let userId = null
        if (isAdult) {
          // Check if email and username are provided for adults
          if (!member.sections.contactInfo.tempData.email || !member.sections.loginSecurity.tempData.username) {
            alert(`Adults must have email and username. Please complete login information for ${member.sections.contactInfo.tempData.firstName} ${member.sections.contactInfo.tempData.lastName}`)
            return
          }
          
          // Create user account for adults
          const userResponse = await fetch(`${apiUrl}/api/admin/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: `${member.sections.contactInfo.tempData.firstName} ${member.sections.contactInfo.tempData.lastName}`,
              email: member.sections.contactInfo.tempData.email,
              phone: cleanPhoneNumber(member.sections.contactInfo.tempData.phone),
              username: member.sections.loginSecurity.tempData.username,
              password: member.sections.loginSecurity.tempData.password || 'vortex',
              role: 'PARENT_GUARDIAN',
              address: combineAddress(
                member.sections.contactInfo.tempData.addressStreet,
                member.sections.contactInfo.tempData.addressCity,
                member.sections.contactInfo.tempData.addressState,
                member.sections.contactInfo.tempData.addressZip
              ) || null
            })
          })
          
          if (userResponse.ok) {
            const userData = await userResponse.json()
            if (userData.success && userData.data) {
              userId = userData.data.id
              
              // Add as guardian
              const updateResponse = await fetch(`${apiUrl}/api/admin/families/${familyId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  familyName: selectedFamilyForMember.family_name,
                  primaryUserId: selectedFamilyForMember.primary_user_id || userId,
                  guardianIds: [
                    ...(selectedFamilyForMember.guardians?.map((g: Guardian) => g.id) || []),
                    userId
                  ]
                })
              })
              
              if (!updateResponse.ok) {
                console.warn('Failed to add guardian to family')
              }
            }
          } else {
            const errorData = await userResponse.json()
            throw new Error(errorData.message || 'Failed to create user account')
          }
        }
        
        // Create athlete record for all members
        const athleteResponse = await fetch(`${apiUrl}/api/admin/athletes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            familyId: familyId,
            firstName: member.sections.contactInfo.tempData.firstName,
            lastName: member.sections.contactInfo.tempData.lastName,
            dateOfBirth: member.dateOfBirth || null,
            medicalNotes: member.medicalNotes || null,
            internalFlags: null,
            userId: userId
          })
        })
        
        if (athleteResponse.ok) {
          const athleteData = await athleteResponse.json()
          if (athleteData.success && athleteData.data) {
            // Create enrollments
            for (const enrollment of member.enrollments) {
              if (enrollment.programId) {
                await fetch(`${apiUrl}/api/members/enroll`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                  },
                  body: JSON.stringify({
                    programId: enrollment.programId,
                    familyMemberId: athleteData.data.id,
                    daysPerWeek: enrollment.daysPerWeek,
                    selectedDays: enrollment.selectedDays
                  })
                })
              }
            }
          }
        } else {
          const errorData = await athleteResponse.json()
          throw new Error(errorData.message || 'Failed to create athlete record')
        }
      }
      
      await fetchFamilies()
      setShowMemberModal(false)
      setMemberModalMode('search')
      setSelectedFamilyForMember(null)
      setFamilyMembers([{
        id: 'member-1',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        addressStreet: '',
        addressCity: '',
        addressState: '',
        addressZip: '',
        username: '',
        password: 'vortex',
        enrollments: [],
        dateOfBirth: '',
        medicalNotes: '',
        isFinished: false,
        sections: {
          contactInfo: { isExpanded: true, tempData: { firstName: '', lastName: '', email: '', phone: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '' } },
          loginSecurity: { isExpanded: false, tempData: { username: '', password: 'vortex' } },
          enrollment: { isExpanded: false, tempData: { programId: null, program: 'Non-Participant', daysPerWeek: 1, selectedDays: [] } }
        }
      }])
      setExpandedFamilyMemberId(null)
      alert('Member(s) added to family successfully!')
    } catch (error) {
      console.error('Error adding members to family:', error)
      alert(error instanceof Error ? error.message : 'Failed to add members to family')
    }
  }
  
  // Family member form handlers
  const handleFinishedWithMember = (memberId: string) => {
    setFamilyMembers(prev => {
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
  
  const handleAddFamilyMember = () => {
    const newMemberId = `member-${Date.now()}`
    setFamilyMembers(prev => [...prev, {
      id: newMemberId,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      addressStreet: '',
      addressCity: '',
      addressState: '',
      addressZip: '',
      username: '',
      password: 'vortex',
      enrollments: [],
      dateOfBirth: '',
      medicalNotes: '',
      isFinished: false,
      sections: {
        contactInfo: { isExpanded: true, tempData: { firstName: '', lastName: '', email: '', phone: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '' } },
        loginSecurity: { isExpanded: false, tempData: { username: '', password: 'vortex' } },
        enrollment: { isExpanded: false, tempData: { programId: null, program: 'Non-Participant', daysPerWeek: 1, selectedDays: [] } }
      }
    }])
    setExpandedFamilyMemberId(newMemberId)
  }
  
  const handleToggleEnrollment = (memberId: string, enrollmentId: string) => {
    setFamilyMembers(prev => prev.map(member => {
      if (member.id === memberId) {
        return {
          ...member,
          enrollments: member.enrollments.map(enrollment => 
            enrollment.id === enrollmentId
              ? { ...enrollment, isExpanded: !(enrollment.isExpanded ?? false) }
              : enrollment
          )
        }
      }
      return member
    }))
  }
  
  const handleRemoveEnrollmentClick = () => {
    // Enrollment removal functionality removed - not used in UI
  }
  
  const handleAddChildToArray = async () => {
    if (!currentChild.firstName || !currentChild.lastName || !currentChild.dateOfBirth) {
      alert('Please fill in at least first name, last name, and date of birth')
      return
    }
    
    if (currentChild.programId && currentChild.selectedDays.length !== currentChild.daysPerWeek) {
      alert(`Please select exactly ${currentChild.daysPerWeek} day(s)`)
      return
    }
    
    const username = currentChild.username || await generateUsername(currentChild.firstName, currentChild.lastName)
    const password = currentChild.password || 'vortex'
    
    setNewChildren([...newChildren, { ...currentChild, username, password }])
    setCurrentChild({ firstName: '', lastName: '', dateOfBirth: '', email: '', password: 'vortex', username: '', medicalNotes: '', internalFlags: '', program: 'Non-Participant', programId: null, daysPerWeek: 1, selectedDays: [], userId: null })
  }
  
  const handleRemoveChildFromArray = (index: number) => {
    setNewChildren(newChildren.filter((_, i) => i !== index))
  }
  
  const handleSectionContinue = (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'enrollment') => {
    setFamilyMembers(prev => prev.map(member => {
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
              loginSecurity: { ...member.sections.loginSecurity, isExpanded: true }
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
              enrollment: { ...member.sections.enrollment, isExpanded: true }
            }
          }
        } else {
          const sectionData = member.sections.enrollment
          if (sectionData.tempData.programId && sectionData.tempData.selectedDays.length !== sectionData.tempData.daysPerWeek) {
            alert(`Please select exactly ${sectionData.tempData.daysPerWeek} day(s)`)
            return member
          }
          const newEnrollment: EnrollmentData = {
            id: `enrollment-${Date.now()}`,
            programId: sectionData.tempData.programId,
            program: sectionData.tempData.program,
            daysPerWeek: sectionData.tempData.daysPerWeek,
            selectedDays: sectionData.tempData.selectedDays,
            isCompleted: true,
            isExpanded: false
          }
          return {
            ...member,
            enrollments: [...member.enrollments, newEnrollment],
            sections: {
              ...member.sections,
              enrollment: { isExpanded: false, tempData: { programId: null, program: 'Non-Participant', daysPerWeek: 1, selectedDays: [] } }
            }
          }
        }
      }
      return member
    }))
  }
  
  const handleSectionMinimize = (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'enrollment') => {
    setFamilyMembers(prev => prev.map(member => {
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
          const sectionData = member.sections.enrollment
          if (sectionData.tempData.programId && sectionData.tempData.selectedDays.length !== sectionData.tempData.daysPerWeek) {
            alert(`Please select exactly ${sectionData.tempData.daysPerWeek} day(s)`)
            return member
          }
          const newEnrollment: EnrollmentData = {
            id: `enrollment-${Date.now()}`,
            programId: sectionData.tempData.programId,
            program: sectionData.tempData.program,
            daysPerWeek: sectionData.tempData.daysPerWeek,
            selectedDays: sectionData.tempData.selectedDays,
            isCompleted: true,
            isExpanded: false
          }
          return {
            ...member,
            enrollments: [...member.enrollments, newEnrollment],
            sections: {
              ...member.sections,
              enrollment: { isExpanded: false, tempData: { programId: null, program: 'Non-Participant', daysPerWeek: 1, selectedDays: [] } }
            }
          }
        }
      }
      return member
    }))
  }
  
  const handleSectionCancel = (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'enrollment') => {
    setFamilyMembers(prev => prev.map(member => {
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
              enrollment: {
                isExpanded: false,
                tempData: {
                  programId: null,
                  program: 'Non-Participant',
                  daysPerWeek: 1,
                  selectedDays: []
                }
              }
            }
          }
        }
      }
      return member
    }))
  }
  
  const handleToggleSection = (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'enrollment') => {
    setFamilyMembers(prev => prev.map(member => {
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
        } else {
          const sectionData = member.sections.enrollment
          if (!sectionData.isExpanded) {
            return {
              ...member,
              sections: {
                ...member.sections,
                enrollment: {
                  isExpanded: true,
                  tempData: {
                    programId: null,
                    program: 'Non-Participant',
                    daysPerWeek: 1,
                    selectedDays: []
                  }
                }
              }
            }
          } else {
            return {
              ...member,
              sections: {
                ...member.sections,
                enrollment: { ...sectionData, isExpanded: false }
              }
            }
          }
        }
      }
      return member
    }))
  }
  
  // Effects
  useEffect(() => {
    fetchFamilies()
  }, [fetchFamilies])
  
  useEffect(() => {
    if (showMemberModal && programs.length === 0) {
      fetchAllPrograms()
    }
  }, [showMemberModal, programs.length, fetchAllPrograms])
  
  useEffect(() => {
    if (memberModalMode === 'new-family' && familyMembers.length > 0 && expandedFamilyMemberId === null) {
      const firstUnfinished = familyMembers.find(m => !m.isFinished)
      if (firstUnfinished) {
        setExpandedFamilyMemberId(firstUnfinished.id)
      }
    }
  }, [memberModalMode, familyMembers, expandedFamilyMemberId])
  
  useEffect(() => {
    if (memberModalMode === 'new-family' && familyMembers.length > 0) {
      const member1 = familyMembers[0]
      const addressParts = [
        member1.sections.contactInfo.tempData.addressStreet,
        member1.sections.contactInfo.tempData.addressCity,
        member1.sections.contactInfo.tempData.addressState,
        member1.sections.contactInfo.tempData.addressZip
      ].filter(part => part && part.trim())
      const address = addressParts.join(', ') || ''
      setBillingInfo({
        firstName: member1.sections.contactInfo.tempData.firstName,
        lastName: member1.sections.contactInfo.tempData.lastName,
        billingAddress: address
      })
    }
  }, [memberModalMode, familyMembers])
  
  useEffect(() => {
    if (memberSearchQuery.length >= 2) {
      const timeoutId = setTimeout(() => {
        searchFamiliesForMember(memberSearchQuery)
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setMemberSearchResults([])
    }
  }, [memberSearchQuery])
  
  // Render function - this is a very large component, so I'll include the main structure
  // Due to size limitations, I'll need to continue with the JSX in the next part
  
  return (
    <>
      <motion.div
        key="membership"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Members Section */}
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
              Members ({families.filter(f => showArchivedFamilies ? f.archived : !f.archived).reduce((sum, f) => sum + (f.guardians?.length || 0) + (f.athletes?.length || 0), 0)})
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search Members"
                value={familySearchQuery}
                onChange={(e) => {
                  setFamilySearchQuery(e.target.value)
                  fetchFamilies()
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <motion.button
                onClick={() => setShowArchivedFamilies(!showArchivedFamilies)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                  showArchivedFamilies
                    ? 'bg-gray-600 text-white hover:bg-gray-700'
                    : 'bg-gray-500 text-white hover:bg-gray-600'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Archive className="w-4 h-4" />
                <span>{showArchivedFamilies ? 'Show Active' : 'Show Archives'}</span>
              </motion.button>
              <motion.button
                onClick={() => {
                  setShowMemberModal(true)
                  setMemberModalMode('search')
                  setSelectedFamilyForMember(null)
                  setMemberSearchQuery('')
                  setMemberSearchResults([])
                }}
                className="flex items-center space-x-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Member</span>
              </motion.button>
            </div>
          </div>

          {familiesLoading ? (
            <div className="text-center py-12 text-gray-600">Loading members...</div>
          ) : (() => {
            const filteredFamilies = families.filter(f => showArchivedFamilies ? f.archived : !f.archived)
            const allMembers: Array<{family: Family, member: Guardian | Athlete, type: 'guardian' | 'athlete'}> = []
            
            filteredFamilies.forEach(family => {
              if (family.guardians) {
                family.guardians.forEach(guardian => {
                  allMembers.push({ family, member: guardian, type: 'guardian' })
                })
              }
              if (family.athletes) {
                family.athletes.forEach(athlete => {
                  allMembers.push({ family, member: athlete, type: 'athlete' })
                })
              }
            })

            if (allMembers.length === 0) {
              return <div className="text-center py-12 text-gray-600">No {showArchivedFamilies ? 'archived' : ''} members yet</div>
            }

            return (
              <div className="space-y-4">
                {allMembers.map(({ family, member, type }) => {
                  const isGuardian = type === 'guardian'
                  const memberName = isGuardian 
                    ? (member as Guardian).fullName 
                    : `${(member as Athlete).first_name} ${(member as Athlete).last_name}`
                  const memberEmail = isGuardian ? (member as Guardian).email : null
                  const memberPhone = isGuardian ? (member as Guardian).phone : null
                  const memberAge = !isGuardian ? (member as Athlete).age : null

                  return (
                    <div 
                      key={`${family.id}-${type}-${isGuardian ? (member as Guardian).id : (member as Athlete).id}`}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="text-black font-semibold text-lg">
                            {memberName}
                          </div>
                          {memberEmail && (
                            <div className="text-gray-600 text-sm mt-1">{memberEmail}</div>
                          )}
                          {memberPhone && (
                            <div className="text-gray-600 text-sm">{memberPhone}</div>
                          )}
                          {memberAge !== null && (
                            <div className="text-gray-600 text-sm">Age: {memberAge}</div>
                          )}
                          <div className="text-gray-500 text-xs mt-1">
                            {isGuardian ? 'Guardian' : 'Athlete'} • Family ID: {family.id}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {isGuardian ? (
                            <>
                              <motion.button
                                onClick={() => handleViewMember(member as Guardian, family)}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </motion.button>
                              <motion.button
                                onClick={() => handleEditMember(member as Guardian, family)}
                                className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center gap-2"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </motion.button>
                            </>
                          ) : (
                            <>
                              <motion.button
                                onClick={() => {
                                  const primaryGuardian = family.guardians?.find(g => g.id === family.primary_user_id) || family.guardians?.[0]
                                  if (primaryGuardian) {
                                    handleViewMember(primaryGuardian, family)
                                  } else {
                                    handleViewFamily(family)
                                  }
                                }}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Eye className="w-4 h-4" />
                                View Family
                              </motion.button>
                              <motion.button
                                onClick={() => {
                                  const primaryGuardian = family.guardians?.find(g => g.id === family.primary_user_id) || family.guardians?.[0]
                                  if (primaryGuardian) {
                                    handleEditMember(primaryGuardian, family)
                                  } else {
                                    handleEditFamily(family)
                                  }
                                }}
                                className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center gap-2"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit Family
                              </motion.button>
                            </>
                          )}
                          {showArchivedFamilies ? (
                            <>
                              <motion.button
                                onClick={() => handleArchiveFamily(family.id, false)}
                                className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center gap-2"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Archive className="w-4 h-4" />
                                Unarchive
                              </motion.button>
                              <motion.button
                                onClick={() => handleDeleteFamily(family.id)}
                                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 flex items-center gap-2"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <X className="w-4 h-4" />
                                Delete
                              </motion.button>
                            </>
                          ) : (
                            <motion.button
                              onClick={() => handleArchiveFamily(family.id, true)}
                              className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 flex items-center gap-2"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Archive className="w-4 h-4" />
                              Archive
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </motion.div>

      {/* Comprehensive Create Member Modal */}
      <AnimatePresence>
        {showMemberModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setShowMemberModal(false)
                setMemberModalMode('search')
                setSelectedFamilyForMember(null)
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
                  {memberModalMode === 'search' && 'Create Member - Search or New'}
                  {memberModalMode === 'new-family' && 'Create New Family'}
                  {memberModalMode === 'existing-family' && 'Add to Existing Family'}
                </h3>
                <button
                  onClick={() => {
                    setShowMemberModal(false)
                    setMemberModalMode('search')
                    setSelectedFamilyForMember(null)
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Search Mode */}
              {memberModalMode === 'search' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Search for Existing Family (by name or email)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={memberSearchQuery}
                        onChange={(e) => {
                          setMemberSearchQuery(e.target.value)
                          searchFamiliesForMember(e.target.value)
                        }}
                        placeholder="Type to search..."
                        className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      />
                    </div>
                    {memberSearchResults.length > 0 && (
                      <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                        {memberSearchResults.map((family) => (
                          <div
                            key={family.id}
                            onClick={() => handleSelectFamilyForMember(family)}
                            className="p-3 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                          >
                            <div className="font-semibold text-white">
                              {family.family_name || `${family.primary_name || 'Unnamed'} Family`}
                            </div>
                            {family.primary_email && (
                              <div className="text-sm text-gray-300">{family.primary_email}</div>
                            )}
                            {family.guardians && family.guardians.length > 0 && (
                              <div className="text-xs text-gray-400 mt-1">
                                {family.guardians.length} guardian(s), {family.athletes?.length || 0} athlete(s)
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-600 pt-4">
                    <button
                      onClick={() => {
                        setMemberModalMode('new-family')
                        if (familyMembers.length > 0) {
                          setExpandedFamilyMemberId(familyMembers[0].id)
                        }
                        setBillingInfo({ firstName: '', lastName: '', billingAddress: '' })
                        setIsBillingExpanded(true)
                      }}
                      className="w-full bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Create New Family Instead
                    </button>
                  </div>
                </div>
              )}

              {/* New Family Mode */}
              {memberModalMode === 'new-family' && (
                <div className="space-y-6">
                  {familyMembers.map((member, memberIndex) => (
                    <div key={member.id} className="bg-gray-700 p-4 rounded">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-white">
                          Family Member {memberIndex + 1}{memberIndex === 0 ? ' (Must be an Adult) *' : ''}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setExpandedFamilyMemberId(expandedFamilyMemberId === member.id ? null : member.id)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          {expandedFamilyMemberId === member.id ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      
                      {expandedFamilyMemberId === member.id && (
                        <>
                      {/* 1. Contact Information Section */}
                      <div className="mb-4 border border-gray-600 rounded">
                        <button
                          type="button"
                          onClick={() => handleToggleSection(member.id, 'contactInfo')}
                          className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded-t"
                        >
                          <span>1. Contact Information</span>
                          <span>{member.sections.contactInfo.isExpanded ? '−' : '+'}</span>
                        </button>
                        {member.sections.contactInfo.isExpanded && (
                          <div className="p-4 bg-gray-800">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                                <input
                                  type="text"
                                  value={member.sections.contactInfo.tempData.firstName}
                                  onChange={async (e) => {
                                    const firstName = e.target.value
                                    const username = await generateUsername(firstName, member.sections.contactInfo.tempData.lastName)
                                    setFamilyMembers(prev => prev.map(m => 
                                      m.id === member.id 
                                        ? {
                                            ...m,
                                            sections: {
                                              ...m.sections,
                                              contactInfo: {
                                                ...m.sections.contactInfo,
                                                tempData: { ...m.sections.contactInfo.tempData, firstName }
                                              },
                                              loginSecurity: {
                                                ...m.sections.loginSecurity,
                                                tempData: { ...m.sections.loginSecurity.tempData, username }
                                              }
                                            }
                                          }
                                        : m
                                    ))
                                  }}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                                <input
                                  type="text"
                                  value={member.sections.contactInfo.tempData.lastName}
                                  onChange={async (e) => {
                                    const lastName = e.target.value
                                    const username = await generateUsername(member.sections.contactInfo.tempData.firstName, lastName)
                                    setFamilyMembers(prev => prev.map(m => 
                                      m.id === member.id 
                                        ? {
                                            ...m,
                                            sections: {
                                              ...m.sections,
                                              contactInfo: {
                                                ...m.sections.contactInfo,
                                                tempData: { ...m.sections.contactInfo.tempData, lastName }
                                              },
                                              loginSecurity: {
                                                ...m.sections.loginSecurity,
                                                tempData: { ...m.sections.loginSecurity.tempData, username }
                                              }
                                            }
                                          }
                                        : m
                                    ))
                                  }}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                                <input
                                  type="email"
                                  value={member.sections.contactInfo.tempData.email}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            contactInfo: {
                                              ...m.sections.contactInfo,
                                              tempData: { ...m.sections.contactInfo.tempData, email: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Phone *</label>
                                <input
                                  type="tel"
                                  value={member.sections.contactInfo.tempData.phone}
                                  onChange={(e) => {
                                    const formatted = formatPhoneNumber(e.target.value)
                                    setFamilyMembers(prev => prev.map(m => 
                                      m.id === member.id 
                                        ? {
                                            ...m,
                                            sections: {
                                              ...m.sections,
                                              contactInfo: {
                                                ...m.sections.contactInfo,
                                                tempData: { ...m.sections.contactInfo.tempData, phone: formatted }
                                              }
                                            }
                                          }
                                        : m
                                    ))
                                  }}
                                  placeholder="###-###-####"
                                  maxLength={12}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  autoComplete="off"
                                  required
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Street</label>
                                <input
                                  type="text"
                                  value={member.sections.contactInfo.tempData.addressStreet}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            contactInfo: {
                                              ...m.sections.contactInfo,
                                              tempData: { ...m.sections.contactInfo.tempData, addressStreet: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  placeholder="Street address"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">City</label>
                                <input
                                  type="text"
                                  value={member.sections.contactInfo.tempData.addressCity}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            contactInfo: {
                                              ...m.sections.contactInfo,
                                              tempData: { ...m.sections.contactInfo.tempData, addressCity: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  placeholder="City"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">State</label>
                                <input
                                  type="text"
                                  value={member.sections.contactInfo.tempData.addressState}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            contactInfo: {
                                              ...m.sections.contactInfo,
                                              tempData: { ...m.sections.contactInfo.tempData, addressState: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  placeholder="State"
                                  maxLength={2}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Zip</label>
                                <input
                                  type="text"
                                  value={member.sections.contactInfo.tempData.addressZip}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            contactInfo: {
                                              ...m.sections.contactInfo,
                                              tempData: { ...m.sections.contactInfo.tempData, addressZip: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  placeholder="ZIP code"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <button
                                type="button"
                                onClick={() => handleSectionContinue(member.id, 'contactInfo')}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Continue
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSectionMinimize(member.id, 'contactInfo')}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Minimize
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSectionCancel(member.id, 'contactInfo')}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Login & Security Section */}
                      <div className="mb-4 border border-gray-600 rounded">
                        <button
                          type="button"
                          onClick={() => handleToggleSection(member.id, 'loginSecurity')}
                          className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded-t"
                        >
                          <span>2. Login & Security</span>
                          <span>{member.sections.loginSecurity.isExpanded ? '−' : '+'}</span>
                        </button>
                        {member.sections.loginSecurity.isExpanded && (
                          <div className="p-4 bg-gray-800">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Username *</label>
                                <input
                                  type="text"
                                  value={member.sections.loginSecurity.tempData.username}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            loginSecurity: {
                                              ...m.sections.loginSecurity,
                                              tempData: { ...m.sections.loginSecurity.tempData, username: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                                <input
                                  type="password"
                                  value={member.sections.loginSecurity.tempData.password}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            loginSecurity: {
                                              ...m.sections.loginSecurity,
                                              tempData: { ...m.sections.loginSecurity.tempData, password: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  required
                                  minLength={6}
                                  autoComplete="new-password"
                                />
                                <p className="text-xs text-gray-400 mt-1">Default: vortex</p>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <button
                                type="button"
                                onClick={() => handleSectionContinue(member.id, 'loginSecurity')}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Continue
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSectionMinimize(member.id, 'loginSecurity')}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Minimize
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSectionCancel(member.id, 'loginSecurity')}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3. Class Enrollments Section */}
                      <div className="mb-4 border border-gray-600 rounded">
                        <button
                          type="button"
                          onClick={() => handleToggleSection(member.id, 'enrollment')}
                          className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded-t"
                        >
                          <span>3. Class Enrollments {member.enrollments.length > 0 && `(${member.enrollments.length})`}</span>
                          <span>{member.sections.enrollment.isExpanded ? '−' : '+'}</span>
                        </button>
                        {!member.sections.enrollment.isExpanded && member.enrollments.length > 0 && (
                          <div className="p-4 bg-gray-800 space-y-2">
                            {member.enrollments.map((enrollment) => (
                              <div key={enrollment.id} className="bg-gray-700 p-3 rounded">
                                <div className="text-white font-medium">
                                  {enrollment.programId ? enrollment.program : 'Non-Participant'}
                                </div>
                                {enrollment.programId && (
                                  <>
                                    <div className="text-gray-400 text-sm mt-1">
                                      {enrollment.daysPerWeek} day{enrollment.daysPerWeek !== 1 ? 's' : ''}/week
                                    </div>
                                    {enrollment.selectedDays && enrollment.selectedDays.length > 0 && (
                                      <div className="text-gray-400 text-sm mt-1">
                                        Days: {enrollment.selectedDays.join(', ')}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {member.sections.enrollment.isExpanded && (
                          <div className="p-4 bg-gray-800">
                            {/* List of completed enrollments */}
                            {member.enrollments.length > 0 && (
                              <div className="mb-4 space-y-2">
                                <p className="text-sm text-gray-300 font-semibold mb-2">Enrolled Classes ({member.enrollments.length}):</p>
                                {member.enrollments.map((enrollment) => (
                                  <div key={enrollment.id} className="border border-gray-600 rounded">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleEnrollment(member.id, enrollment.id)}
                                      className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold flex justify-between items-center rounded-t"
                                    >
                                      <div className="text-left">
                                        <span className="text-white font-medium">
                                          {enrollment.programId ? enrollment.program : 'Non-Participant'}
                                        </span>
                                        {enrollment.programId && (
                                          <span className="text-gray-400 text-sm ml-2">
                                            ({enrollment.daysPerWeek} day{enrollment.daysPerWeek !== 1 ? 's' : ''}/week)
                                          </span>
                                        )}
                                      </div>
                                      <span>{(enrollment.isExpanded ?? false) ? '−' : '+'}</span>
                                    </button>
                                    {(enrollment.isExpanded ?? false) && (
                                      <div className="p-4 bg-gray-800">
                                        <div className="space-y-3">
                                          <div>
                                            <label className="block text-sm font-semibold text-gray-300 mb-1">Program/Class</label>
                                            <div className="text-white">{enrollment.programId ? enrollment.program : 'Non-Participant'}</div>
                                          </div>
                                          {enrollment.programId && (
                                            <>
                                              <div>
                                                <label className="block text-sm font-semibold text-gray-300 mb-1">Days Per Week</label>
                                                <div className="text-white">{enrollment.daysPerWeek} day{enrollment.daysPerWeek !== 1 ? 's' : ''}/week</div>
                                              </div>
                                              {enrollment.selectedDays.length > 0 && (
                                                <div>
                                                  <label className="block text-sm font-semibold text-gray-300 mb-1">Selected Days</label>
                                                  <div className="text-white">{enrollment.selectedDays.join(', ')}</div>
                                                </div>
                                              )}
                                            </>
                                          )}
                                          <button
                                            type="button"
                                            onClick={handleRemoveEnrollmentClick}
                                            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
                                          >
                                            Remove Enrollment
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Current enrollment form */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Program/Class</label>
                                <select
                                  value={member.sections.enrollment.tempData.programId || ''}
                                  onChange={(e) => {
                                    const programId = e.target.value ? parseInt(e.target.value) : null
                                    const selectedProgram = programs.find(p => p.id === programId)
                                    setFamilyMembers(prev => prev.map(m => 
                                      m.id === member.id 
                                        ? {
                                            ...m,
                                            sections: {
                                              ...m.sections,
                                              enrollment: {
                                                ...m.sections.enrollment,
                                                tempData: {
                                                  programId,
                                                  program: selectedProgram?.displayName || 'Non-Participant',
                                                  daysPerWeek: 1,
                                                  selectedDays: []
                                                }
                                              }
                                            }
                                          }
                                        : m
                                    ))
                                  }}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                >
                                  <option value="">Non-Participant</option>
                                  {(() => {
                                    const { groupedByCategory, sortedCategories } = getActiveClassesByCategory(programs)
                                    return sortedCategories.map(categoryName => (
                                      <optgroup key={categoryName} label={categoryName}>
                                        {groupedByCategory[categoryName].map((program) => (
                                          <option key={program.id} value={program.id}>
                                            {program.displayName}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ))
                                  })()}
                                </select>
                              </div>
                              {member.sections.enrollment.tempData.programId && (
                                <>
                                  <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Days Per Week *</label>
                                    <select
                                      value={member.sections.enrollment.tempData.daysPerWeek}
                                      onChange={(e) => {
                                        const daysPerWeek = parseInt(e.target.value)
                                        setFamilyMembers(prev => prev.map(m => 
                                          m.id === member.id 
                                            ? {
                                                ...m,
                                                sections: {
                                                  ...m.sections,
                                                  enrollment: {
                                                    ...m.sections.enrollment,
                                                    tempData: {
                                                      ...m.sections.enrollment.tempData,
                                                      daysPerWeek,
                                                      selectedDays: m.sections.enrollment.tempData.selectedDays.length !== daysPerWeek ? [] : m.sections.enrollment.tempData.selectedDays
                                                    }
                                                  }
                                                }
                                              }
                                            : m
                                        ))
                                      }}
                                      className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                      required
                                    >
                                      <option value={1}>1 day</option>
                                      <option value={2}>2 days</option>
                                      <option value={3}>3 days</option>
                                      <option value={4}>4 days</option>
                                      <option value={5}>5 days</option>
                                      <option value={6}>6 days</option>
                                      <option value={7}>7 days</option>
                                    </select>
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                                      Select Days * ({member.sections.enrollment.tempData.selectedDays.length} of {member.sections.enrollment.tempData.daysPerWeek} selected)
                                    </label>
                                    <div className="grid grid-cols-7 gap-2">
                                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                        <button
                                          key={day}
                                          type="button"
                                          onClick={() => {
                                            const dayIndex = member.sections.enrollment.tempData.selectedDays.indexOf(day)
                                            if (dayIndex > -1) {
                                              setFamilyMembers(prev => prev.map(m => 
                                                m.id === member.id 
                                                  ? {
                                                      ...m,
                                                      sections: {
                                                        ...m.sections,
                                                        enrollment: {
                                                          ...m.sections.enrollment,
                                                          tempData: {
                                                            ...m.sections.enrollment.tempData,
                                                            selectedDays: m.sections.enrollment.tempData.selectedDays.filter(d => d !== day)
                                                          }
                                                        }
                                                      }
                                                    }
                                                  : m
                                              ))
                                            } else {
                                              if (member.sections.enrollment.tempData.selectedDays.length < member.sections.enrollment.tempData.daysPerWeek) {
                                                setFamilyMembers(prev => prev.map(m => 
                                                  m.id === member.id 
                                                    ? {
                                                        ...m,
                                                        sections: {
                                                          ...m.sections,
                                                          enrollment: {
                                                            ...m.sections.enrollment,
                                                            tempData: {
                                                              ...m.sections.enrollment.tempData,
                                                              selectedDays: [...m.sections.enrollment.tempData.selectedDays, day]
                                                            }
                                                          }
                                                        }
                                                      }
                                                    : m
                                                ))
                                              } else {
                                                alert(`Please select exactly ${member.sections.enrollment.tempData.daysPerWeek} day(s)`)
                                              }
                                            }
                                          }}
                                          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                            member.sections.enrollment.tempData.selectedDays.includes(day)
                                              ? 'bg-vortex-red text-white'
                                              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                          }`}
                                        >
                                          {day.substring(0, 3)}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                            
                            {/* Add Another Program / Class Option */}
                            <div className="mt-4 border-2 border-dashed border-gray-500 rounded p-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setFamilyMembers(prev => prev.map(m => {
                                    if (m.id !== member.id) return m
                                    
                                    const sectionData = m.sections.enrollment
                                    let newEnrollments = [...m.enrollments]
                                    
                                    // If there's a valid enrollment in tempData, save it first
                                    if (sectionData.tempData.programId) {
                                      // Validate days selection if program is selected
                                      if (sectionData.tempData.selectedDays.length !== sectionData.tempData.daysPerWeek) {
                                        alert(`Please select exactly ${sectionData.tempData.daysPerWeek} day(s) before adding another enrollment`)
                                        return m
                                      }
                                      
                                      // Add current enrollment to enrollments array
                                      const newEnrollment: EnrollmentData = {
                                        id: `enrollment-${Date.now()}`,
                                        programId: sectionData.tempData.programId,
                                        program: sectionData.tempData.program,
                                        daysPerWeek: sectionData.tempData.daysPerWeek,
                                        selectedDays: sectionData.tempData.selectedDays,
                                        isCompleted: true,
                                        isExpanded: false
                                      }
                                      newEnrollments = [...newEnrollments, newEnrollment]
                                    }
                                    
                                    // Reset form for new enrollment
                                    return {
                                      ...m,
                                      enrollments: newEnrollments,
                                      sections: {
                                        ...m.sections,
                                        enrollment: {
                                          isExpanded: true,
                                          tempData: {
                                            programId: null,
                                            program: 'Non-Participant',
                                            daysPerWeek: 1,
                                            selectedDays: []
                                          }
                                        }
                                      }
                                    }
                                  }))
                                }}
                                className="w-full text-white font-semibold py-2 hover:bg-gray-700 rounded transition-colors"
                              >
                                Add Another Program / Class
                              </button>
                            </div>
                            
                            <div className="flex gap-2 mt-4">
                              <button
                                type="button"
                                onClick={() => handleSectionContinue(member.id, 'enrollment')}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Continue
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSectionMinimize(member.id, 'enrollment')}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Minimize
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSectionCancel(member.id, 'enrollment')}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Finished with Member Button */}
                      {!member.isFinished && (
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => handleFinishedWithMember(member.id)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                          >
                            Finished with Member
                          </button>
                        </div>
                      )}
                        </>
                      )}
                    </div>
                  ))}

                  <div className="border-2 border-dashed border-gray-600 rounded p-4">
                    <button
                      type="button"
                      onClick={handleAddFamilyMember}
                      className="w-full text-white font-semibold py-3 hover:bg-gray-600 rounded transition-colors"
                    >
                      Add a Family Member
                    </button>
                  </div>

                  <div className="bg-gray-700 p-4 rounded">
                    <button
                      type="button"
                      onClick={() => setIsBillingExpanded(!isBillingExpanded)}
                      className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded"
                    >
                      <span>Billing</span>
                      <span>{isBillingExpanded ? '−' : '+'}</span>
                    </button>
                    {isBillingExpanded && (
                      <div className="p-4 bg-gray-800 mt-4 rounded">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                            <input
                              type="text"
                              value={billingInfo.firstName}
                              onChange={(e) => setBillingInfo(prev => ({ ...prev, firstName: e.target.value }))}
                              className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                            <input
                              type="text"
                              value={billingInfo.lastName}
                              onChange={(e) => setBillingInfo(prev => ({ ...prev, lastName: e.target.value }))}
                              className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                              required
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-300 mb-2">Billing Address *</label>
                            <textarea
                              value={billingInfo.billingAddress}
                              onChange={(e) => setBillingInfo(prev => ({ ...prev, billingAddress: e.target.value }))}
                              className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                              rows={3}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateFamilyWithPrimaryAdult}
                      className="flex-1 bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Create Member or Family
                    </button>
                    <button
                      onClick={() => {
                        setMemberModalMode('search')
                        setFamilyMembers([{
                          id: 'member-1',
                          firstName: '',
                          lastName: '',
                          email: '',
                          phone: '',
                          addressStreet: '',
                          addressCity: '',
                          addressState: '',
                          addressZip: '',
                          username: '',
                          password: 'vortex',
                          enrollments: [],
                          dateOfBirth: '',
                          medicalNotes: '',
                          isFinished: false,
                          sections: {
                            contactInfo: { isExpanded: true, tempData: { firstName: '', lastName: '', email: '', phone: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '' } },
                            loginSecurity: { isExpanded: false, tempData: { username: '', password: 'vortex' } },
                            enrollment: { isExpanded: false, tempData: { programId: null, program: 'Non-Participant', daysPerWeek: 1, selectedDays: [] } }
                          }
                        }])
                        setExpandedFamilyMemberId('member-1')
                        setBillingInfo({ firstName: '', lastName: '', billingAddress: '' })
                        setIsBillingExpanded(true)
                        setNewPrimaryAdult({ firstName: '', lastName: '', email: '', phone: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '', username: '', password: 'vortex', program: 'Non-Participant', programId: null, daysPerWeek: 1, selectedDays: [] })
                        setNewChildren([])
                        setCurrentChild({ firstName: '', lastName: '', dateOfBirth: '', email: '', password: 'vortex', username: '', medicalNotes: '', internalFlags: '', program: 'Non-Participant', programId: null, daysPerWeek: 1, selectedDays: [], userId: null })
                      }}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Existing Family Mode */}
              {memberModalMode === 'existing-family' && selectedFamilyForMember && (
                <div className="space-y-6">
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-2">Family: {selectedFamilyForMember.family_name || 'Unnamed Family'}</h4>
                    <div className="text-sm text-gray-300">
                      {selectedFamilyForMember.guardians && selectedFamilyForMember.guardians.length > 0 && (
                        <div>Guardians: {selectedFamilyForMember.guardians.map(g => g.fullName).join(', ')}</div>
                      )}
                      {selectedFamilyForMember.athletes && selectedFamilyForMember.athletes.length > 0 && (
                        <div>Athletes: {selectedFamilyForMember.athletes.map(a => `${a.first_name} ${a.last_name}`).join(', ')}</div>
                      )}
                    </div>
                  </div>

                  {familyMembers.map((member, memberIndex) => (
                    <div key={member.id} className="bg-gray-700 p-4 rounded">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-white">
                          Family Member {memberIndex + 1}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setExpandedFamilyMemberId(expandedFamilyMemberId === member.id ? null : member.id)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          {expandedFamilyMemberId === member.id ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      
                      {expandedFamilyMemberId === member.id && (
                        <>
                      {/* 1. Contact Information Section */}
                      <div className="mb-4 border border-gray-600 rounded">
                        <button
                          type="button"
                          onClick={() => handleToggleSection(member.id, 'contactInfo')}
                          className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded-t"
                        >
                          <span>1. Contact Information</span>
                          <span>{member.sections.contactInfo.isExpanded ? '−' : '+'}</span>
                        </button>
                        {member.sections.contactInfo.isExpanded && (
                          <div className="p-4 bg-gray-800">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                                <input
                                  type="text"
                                  value={member.sections.contactInfo.tempData.firstName}
                                  onChange={async (e) => {
                                    const firstName = e.target.value
                                    const username = await generateUsername(firstName, member.sections.contactInfo.tempData.lastName)
                                    setFamilyMembers(prev => prev.map(m => 
                                      m.id === member.id 
                                        ? {
                                            ...m,
                                            sections: {
                                              ...m.sections,
                                              contactInfo: {
                                                ...m.sections.contactInfo,
                                                tempData: { ...m.sections.contactInfo.tempData, firstName }
                                              },
                                              loginSecurity: {
                                                ...m.sections.loginSecurity,
                                                tempData: { ...m.sections.loginSecurity.tempData, username }
                                              }
                                            }
                                          }
                                        : m
                                    ))
                                  }}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                                <input
                                  type="text"
                                  value={member.sections.contactInfo.tempData.lastName}
                                  onChange={async (e) => {
                                    const lastName = e.target.value
                                    const username = await generateUsername(member.sections.contactInfo.tempData.firstName, lastName)
                                    setFamilyMembers(prev => prev.map(m => 
                                      m.id === member.id 
                                        ? {
                                            ...m,
                                            sections: {
                                              ...m.sections,
                                              contactInfo: {
                                                ...m.sections.contactInfo,
                                                tempData: { ...m.sections.contactInfo.tempData, lastName }
                                              },
                                              loginSecurity: {
                                                ...m.sections.loginSecurity,
                                                tempData: { ...m.sections.loginSecurity.tempData, username }
                                              }
                                            }
                                          }
                                        : m
                                    ))
                                  }}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                                <input
                                  type="email"
                                  value={member.sections.contactInfo.tempData.email}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            contactInfo: {
                                              ...m.sections.contactInfo,
                                              tempData: { ...m.sections.contactInfo.tempData, email: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Phone *</label>
                                <input
                                  type="tel"
                                  value={member.sections.contactInfo.tempData.phone}
                                  onChange={(e) => {
                                    const formatted = formatPhoneNumber(e.target.value)
                                    setFamilyMembers(prev => prev.map(m => 
                                      m.id === member.id 
                                        ? {
                                            ...m,
                                            sections: {
                                              ...m.sections,
                                              contactInfo: {
                                                ...m.sections.contactInfo,
                                                tempData: { ...m.sections.contactInfo.tempData, phone: formatted }
                                              }
                                            }
                                          }
                                        : m
                                    ))
                                  }}
                                  placeholder="###-###-####"
                                  maxLength={12}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  autoComplete="off"
                                  required
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Street</label>
                                <input
                                  type="text"
                                  value={member.sections.contactInfo.tempData.addressStreet}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            contactInfo: {
                                              ...m.sections.contactInfo,
                                              tempData: { ...m.sections.contactInfo.tempData, addressStreet: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  placeholder="Street address"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">City</label>
                                <input
                                  type="text"
                                  value={member.sections.contactInfo.tempData.addressCity}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            contactInfo: {
                                              ...m.sections.contactInfo,
                                              tempData: { ...m.sections.contactInfo.tempData, addressCity: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  placeholder="City"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">State</label>
                                <input
                                  type="text"
                                  value={member.sections.contactInfo.tempData.addressState}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            contactInfo: {
                                              ...m.sections.contactInfo,
                                              tempData: { ...m.sections.contactInfo.tempData, addressState: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  placeholder="State"
                                  maxLength={2}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Zip</label>
                                <input
                                  type="text"
                                  value={member.sections.contactInfo.tempData.addressZip}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            contactInfo: {
                                              ...m.sections.contactInfo,
                                              tempData: { ...m.sections.contactInfo.tempData, addressZip: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  placeholder="ZIP code"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <button
                                type="button"
                                onClick={() => handleSectionContinue(member.id, 'contactInfo')}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Continue
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSectionMinimize(member.id, 'contactInfo')}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Minimize
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSectionCancel(member.id, 'contactInfo')}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Login & Security Section */}
                      <div className="mb-4 border border-gray-600 rounded">
                        <button
                          type="button"
                          onClick={() => handleToggleSection(member.id, 'loginSecurity')}
                          className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded-t"
                        >
                          <span>2. Login & Security</span>
                          <span>{member.sections.loginSecurity.isExpanded ? '−' : '+'}</span>
                        </button>
                        {member.sections.loginSecurity.isExpanded && (
                          <div className="p-4 bg-gray-800">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Username *</label>
                                <input
                                  type="text"
                                  value={member.sections.loginSecurity.tempData.username}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            loginSecurity: {
                                              ...m.sections.loginSecurity,
                                              tempData: { ...m.sections.loginSecurity.tempData, username: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                                <input
                                  type="password"
                                  value={member.sections.loginSecurity.tempData.password}
                                  onChange={(e) => setFamilyMembers(prev => prev.map(m => 
                                    m.id === member.id 
                                      ? {
                                          ...m,
                                          sections: {
                                            ...m.sections,
                                            loginSecurity: {
                                              ...m.sections.loginSecurity,
                                              tempData: { ...m.sections.loginSecurity.tempData, password: e.target.value }
                                            }
                                          }
                                        }
                                      : m
                                  ))}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                  required
                                  minLength={6}
                                  autoComplete="new-password"
                                />
                                <p className="text-xs text-gray-400 mt-1">Default: vortex</p>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <button
                                type="button"
                                onClick={() => handleSectionContinue(member.id, 'loginSecurity')}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Continue
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSectionMinimize(member.id, 'loginSecurity')}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Minimize
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSectionCancel(member.id, 'loginSecurity')}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3. Class Enrollments Section */}
                      <div className="mb-4 border border-gray-600 rounded">
                        <button
                          type="button"
                          onClick={() => handleToggleSection(member.id, 'enrollment')}
                          className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded-t"
                        >
                          <span>3. Class Enrollments {member.enrollments.length > 0 && `(${member.enrollments.length})`}</span>
                          <span>{member.sections.enrollment.isExpanded ? '−' : '+'}</span>
                        </button>
                        {!member.sections.enrollment.isExpanded && member.enrollments.length > 0 && (
                          <div className="p-4 bg-gray-800 space-y-2">
                            {member.enrollments.map((enrollment) => (
                              <div key={enrollment.id} className="bg-gray-700 p-3 rounded">
                                <div className="text-white font-medium">
                                  {enrollment.programId ? enrollment.program : 'Non-Participant'}
                                </div>
                                {enrollment.programId && (
                                  <>
                                    <div className="text-gray-400 text-sm mt-1">
                                      {enrollment.daysPerWeek} day{enrollment.daysPerWeek !== 1 ? 's' : ''}/week
                                    </div>
                                    {enrollment.selectedDays && enrollment.selectedDays.length > 0 && (
                                      <div className="text-gray-400 text-sm mt-1">
                                        Days: {enrollment.selectedDays.join(', ')}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {member.sections.enrollment.isExpanded && (
                          <div className="p-4 bg-gray-800">
                            {/* List of completed enrollments */}
                            {member.enrollments.length > 0 && (
                              <div className="mb-4 space-y-2">
                                <p className="text-sm text-gray-300 font-semibold mb-2">Enrolled Classes ({member.enrollments.length}):</p>
                                {member.enrollments.map((enrollment) => (
                                  <div key={enrollment.id} className="border border-gray-600 rounded">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleEnrollment(member.id, enrollment.id)}
                                      className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold flex justify-between items-center rounded-t"
                                    >
                                      <div className="text-left">
                                        <span className="text-white font-medium">
                                          {enrollment.programId ? enrollment.program : 'Non-Participant'}
                                        </span>
                                        {enrollment.programId && (
                                          <span className="text-gray-400 text-sm ml-2">
                                            ({enrollment.daysPerWeek} day{enrollment.daysPerWeek !== 1 ? 's' : ''}/week)
                                          </span>
                                        )}
                                      </div>
                                      <span>{(enrollment.isExpanded ?? false) ? '−' : '+'}</span>
                                    </button>
                                    {(enrollment.isExpanded ?? false) && (
                                      <div className="p-4 bg-gray-800">
                                        <div className="space-y-3">
                                          <div>
                                            <label className="block text-sm font-semibold text-gray-300 mb-1">Program/Class</label>
                                            <div className="text-white">{enrollment.programId ? enrollment.program : 'Non-Participant'}</div>
                                          </div>
                                          {enrollment.programId && (
                                            <>
                                              <div>
                                                <label className="block text-sm font-semibold text-gray-300 mb-1">Days Per Week</label>
                                                <div className="text-white">{enrollment.daysPerWeek} day{enrollment.daysPerWeek !== 1 ? 's' : ''}/week</div>
                                              </div>
                                              {enrollment.selectedDays.length > 0 && (
                                                <div>
                                                  <label className="block text-sm font-semibold text-gray-300 mb-1">Selected Days</label>
                                                  <div className="text-white">{enrollment.selectedDays.join(', ')}</div>
                                                </div>
                                              )}
                                            </>
                                          )}
                                          <button
                                            type="button"
                                            onClick={handleRemoveEnrollmentClick}
                                            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
                                          >
                                            Remove Enrollment
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Current enrollment form */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Program/Class</label>
                                <select
                                  value={member.sections.enrollment.tempData.programId || ''}
                                  onChange={(e) => {
                                    const programId = e.target.value ? parseInt(e.target.value) : null
                                    const selectedProgram = programs.find(p => p.id === programId)
                                    setFamilyMembers(prev => prev.map(m => 
                                      m.id === member.id 
                                        ? {
                                            ...m,
                                            sections: {
                                              ...m.sections,
                                              enrollment: {
                                                ...m.sections.enrollment,
                                                tempData: {
                                                  programId,
                                                  program: selectedProgram?.displayName || 'Non-Participant',
                                                  daysPerWeek: 1,
                                                  selectedDays: []
                                                }
                                              }
                                            }
                                          }
                                        : m
                                    ))
                                  }}
                                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                >
                                  <option value="">Non-Participant</option>
                                  {(() => {
                                    const { groupedByCategory, sortedCategories } = getActiveClassesByCategory(programs)
                                    return sortedCategories.map(categoryName => (
                                      <optgroup key={categoryName} label={categoryName}>
                                        {groupedByCategory[categoryName].map((program) => (
                                          <option key={program.id} value={program.id}>
                                            {program.displayName}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ))
                                  })()}
                                </select>
                              </div>
                              {member.sections.enrollment.tempData.programId && (
                                <>
                                  <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Days Per Week *</label>
                                    <select
                                      value={member.sections.enrollment.tempData.daysPerWeek}
                                      onChange={(e) => {
                                        const daysPerWeek = parseInt(e.target.value)
                                        setFamilyMembers(prev => prev.map(m => 
                                          m.id === member.id 
                                            ? {
                                                ...m,
                                                sections: {
                                                  ...m.sections,
                                                  enrollment: {
                                                    ...m.sections.enrollment,
                                                    tempData: {
                                                      ...m.sections.enrollment.tempData,
                                                      daysPerWeek,
                                                      selectedDays: m.sections.enrollment.tempData.selectedDays.length !== daysPerWeek ? [] : m.sections.enrollment.tempData.selectedDays
                                                    }
                                                  }
                                                }
                                              }
                                            : m
                                        ))
                                      }}
                                      className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                                      required
                                    >
                                      <option value={1}>1 day</option>
                                      <option value={2}>2 days</option>
                                      <option value={3}>3 days</option>
                                      <option value={4}>4 days</option>
                                      <option value={5}>5 days</option>
                                      <option value={6}>6 days</option>
                                      <option value={7}>7 days</option>
                                    </select>
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                                      Select Days * ({member.sections.enrollment.tempData.selectedDays.length} of {member.sections.enrollment.tempData.daysPerWeek} selected)
                                    </label>
                                    <div className="grid grid-cols-7 gap-2">
                                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                        <button
                                          key={day}
                                          type="button"
                                          onClick={() => {
                                            const dayIndex = member.sections.enrollment.tempData.selectedDays.indexOf(day)
                                            if (dayIndex > -1) {
                                              setFamilyMembers(prev => prev.map(m => 
                                                m.id === member.id 
                                                  ? {
                                                      ...m,
                                                      sections: {
                                                        ...m.sections,
                                                        enrollment: {
                                                          ...m.sections.enrollment,
                                                          tempData: {
                                                            ...m.sections.enrollment.tempData,
                                                            selectedDays: m.sections.enrollment.tempData.selectedDays.filter(d => d !== day)
                                                          }
                                                        }
                                                      }
                                                    }
                                                  : m
                                              ))
                                            } else {
                                              if (member.sections.enrollment.tempData.selectedDays.length < member.sections.enrollment.tempData.daysPerWeek) {
                                                setFamilyMembers(prev => prev.map(m => 
                                                  m.id === member.id 
                                                    ? {
                                                        ...m,
                                                        sections: {
                                                          ...m.sections,
                                                          enrollment: {
                                                            ...m.sections.enrollment,
                                                            tempData: {
                                                              ...m.sections.enrollment.tempData,
                                                              selectedDays: [...m.sections.enrollment.tempData.selectedDays, day]
                                                            }
                                                          }
                                                        }
                                                      }
                                                    : m
                                                ))
                                              } else {
                                                alert(`Please select exactly ${member.sections.enrollment.tempData.daysPerWeek} day(s)`)
                                              }
                                            }
                                          }}
                                          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                            member.sections.enrollment.tempData.selectedDays.includes(day)
                                              ? 'bg-vortex-red text-white'
                                              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                          }`}
                                        >
                                          {day.substring(0, 3)}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                            
                            {/* Add Another Program / Class Option */}
                            <div className="mt-4 border-2 border-dashed border-gray-500 rounded p-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setFamilyMembers(prev => prev.map(m => {
                                    if (m.id !== member.id) return m
                                    
                                    const sectionData = m.sections.enrollment
                                    let newEnrollments = [...m.enrollments]
                                    
                                    // If there's a valid enrollment in tempData, save it first
                                    if (sectionData.tempData.programId) {
                                      // Validate days selection if program is selected
                                      if (sectionData.tempData.selectedDays.length !== sectionData.tempData.daysPerWeek) {
                                        alert(`Please select exactly ${sectionData.tempData.daysPerWeek} day(s) before adding another enrollment`)
                                        return m
                                      }
                                      
                                      // Add current enrollment to enrollments array
                                      const newEnrollment: EnrollmentData = {
                                        id: `enrollment-${Date.now()}`,
                                        programId: sectionData.tempData.programId,
                                        program: sectionData.tempData.program,
                                        daysPerWeek: sectionData.tempData.daysPerWeek,
                                        selectedDays: sectionData.tempData.selectedDays,
                                        isCompleted: true,
                                        isExpanded: false
                                      }
                                      newEnrollments = [...newEnrollments, newEnrollment]
                                    }
                                    
                                    // Reset form for new enrollment
                                    return {
                                      ...m,
                                      enrollments: newEnrollments,
                                      sections: {
                                        ...m.sections,
                                        enrollment: {
                                          isExpanded: true,
                                          tempData: {
                                            programId: null,
                                            program: 'Non-Participant',
                                            daysPerWeek: 1,
                                            selectedDays: []
                                          }
                                        }
                                      }
                                    }
                                  }))
                                }}
                                className="w-full text-white font-semibold py-2 hover:bg-gray-700 rounded transition-colors"
                              >
                                Add Another Program / Class
                              </button>
                            </div>
                            
                            <div className="flex gap-2 mt-4">
                              <button
                                type="button"
                                onClick={() => handleSectionContinue(member.id, 'enrollment')}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Continue
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSectionMinimize(member.id, 'enrollment')}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Minimize
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSectionCancel(member.id, 'enrollment')}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Finished with Member Button */}
                      {!member.isFinished && (
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => handleFinishedWithMember(member.id)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                          >
                            Finished with Member
                          </button>
                        </div>
                      )}
                        </>
                      )}
                    </div>
                  ))}

                  <div className="border-2 border-dashed border-gray-600 rounded p-4">
                    <button
                      type="button"
                      onClick={handleAddFamilyMember}
                      className="w-full text-white font-semibold py-3 hover:bg-gray-600 rounded transition-colors"
                    >
                      Add a Family Member
                    </button>
                  </div>

                  <div className="bg-gray-700 p-4 rounded">
                    <button
                      type="button"
                      onClick={() => setIsBillingExpanded(!isBillingExpanded)}
                      className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded"
                    >
                      <span>Billing</span>
                      <span>{isBillingExpanded ? '−' : '+'}</span>
                    </button>
                    {isBillingExpanded && (
                      <div className="p-4 bg-gray-800 mt-4 rounded">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                            <input
                              type="text"
                              value={billingInfo.firstName}
                              onChange={(e) => setBillingInfo(prev => ({ ...prev, firstName: e.target.value }))}
                              className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                            <input
                              type="text"
                              value={billingInfo.lastName}
                              onChange={(e) => setBillingInfo(prev => ({ ...prev, lastName: e.target.value }))}
                              className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                              required
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-300 mb-2">Billing Address *</label>
                            <textarea
                              value={billingInfo.billingAddress}
                              onChange={(e) => setBillingInfo(prev => ({ ...prev, billingAddress: e.target.value }))}
                              className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                              rows={3}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAddMembersToExistingFamily}
                      className="flex-1 bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Add Member(s) to Family
                    </button>
                    <button
                      onClick={() => {
                        setMemberModalMode('search')
                        setFamilyMembers([{
                          id: 'member-1',
                          firstName: '',
                          lastName: '',
                          email: '',
                          phone: '',
                          addressStreet: '',
                          addressCity: '',
                          addressState: '',
                          addressZip: '',
                          username: '',
                          password: 'vortex',
                          enrollments: [],
                          dateOfBirth: '',
                          medicalNotes: '',
                          isFinished: false,
                          sections: {
                            contactInfo: { isExpanded: true, tempData: { firstName: '', lastName: '', email: '', phone: '', addressStreet: '', addressCity: '', addressState: '', addressZip: '' } },
                            loginSecurity: { isExpanded: false, tempData: { username: '', password: 'vortex' } },
                            enrollment: { isExpanded: false, tempData: { programId: null, program: 'Non-Participant', daysPerWeek: 1, selectedDays: [] } }
                          }
                        }])
                        setExpandedFamilyMemberId('member-1')
                        setBillingInfo({ firstName: '', lastName: '', billingAddress: '' })
                        setIsBillingExpanded(true)
                        setSelectedFamilyForMember(null)
                      }}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Family View Modal */}
      <AnimatePresence>
        {showFamilyViewModal && selectedFamilyForView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowFamilyViewModal(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">Family Details</h3>
                <button
                  onClick={() => setShowFamilyViewModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="font-semibold text-white mb-4">Family Information</h4>
                  <div className="text-sm text-gray-300 space-y-2">
                    <div>Family ID: {selectedFamilyForView.id}</div>
                    {selectedFamilyForView.family_name && (
                      <div>Family Name: {selectedFamilyForView.family_name}</div>
                    )}
                    <div>Created: {new Date(selectedFamilyForView.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {selectedFamilyForView.guardians && selectedFamilyForView.guardians.length > 0 && (
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-4">Guardians ({selectedFamilyForView.guardians.length})</h4>
                    <div className="space-y-3">
                      {selectedFamilyForView.guardians.map((guardian) => (
                        <div key={guardian.id} className="bg-gray-600 p-3 rounded">
                          <div className="text-white font-medium">{guardian.fullName}</div>
                          <div className="text-gray-300 text-sm mt-1">{guardian.email}</div>
                          {guardian.phone && (
                            <div className="text-gray-300 text-sm">{guardian.phone}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedFamilyForView.athletes && selectedFamilyForView.athletes.length > 0 && (
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-4">Athletes ({selectedFamilyForView.athletes.length})</h4>
                    <div className="space-y-3">
                      {selectedFamilyForView.athletes.map((athlete) => (
                        <div key={athlete.id} className="bg-gray-600 p-3 rounded">
                          <div className="text-white font-medium">{athlete.first_name} {athlete.last_name}</div>
                          <div className="text-gray-300 text-sm mt-1">
                            Date of Birth: {new Date(athlete.date_of_birth).toLocaleDateString()}
                            {athlete.age !== undefined && ` (Age ${athlete.age})`}
                          </div>
                          {athlete.medical_notes && (
                            <div className="text-gray-300 text-sm mt-1">Medical Notes: {athlete.medical_notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowFamilyViewModal(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member View Modal */}
      <AnimatePresence>
        {showMemberViewModal && viewingMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMemberViewModal(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">Member Details</h3>
                <button
                  onClick={() => setShowMemberViewModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="font-semibold text-white mb-4 text-lg">User Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">First Name:</span>
                      <div className="text-white font-medium">{viewingMember.guardian.fullName.split(' ')[0]}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Last Name:</span>
                      <div className="text-white font-medium">{viewingMember.guardian.fullName.split(' ').slice(1).join(' ')}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Email:</span>
                      <div className="text-white font-medium">{viewingMember.guardian.email || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Phone:</span>
                      <div className="text-white font-medium">{viewingMember.guardian.phone || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">User ID:</span>
                      <div className="text-white font-medium">{viewingMember.guardian.id}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="font-semibold text-white mb-4 text-lg">Family Information</h4>
                  <div className="text-sm text-gray-300 space-y-2">
                    <div>Family ID: {viewingMember.family.id}</div>
                    {viewingMember.family.family_name && (
                      <div>Family Name: {viewingMember.family.family_name}</div>
                    )}
                    <div>Created: {new Date(viewingMember.family.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {viewingMember.family.athletes && viewingMember.family.athletes.length > 0 && (
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-4 text-lg">Family Members ({viewingMember.family.athletes.length})</h4>
                    <div className="space-y-3">
                      {viewingMember.family.athletes.map((athlete) => (
                        <div key={athlete.id} className="bg-gray-600 p-4 rounded">
                          <div 
                            className="flex justify-between items-center cursor-pointer"
                            onClick={() => setExpandedViewFamilyMemberId(expandedViewFamilyMemberId === athlete.id ? null : athlete.id)}
                          >
                            <div className="flex-1">
                              <div className="text-white font-medium text-lg">
                                {athlete.first_name} {athlete.last_name}
                              </div>
                              <div className="text-gray-300 text-sm mt-1">
                                Date of Birth: {athlete.date_of_birth ? new Date(athlete.date_of_birth).toLocaleDateString() : 'N/A'}
                                {athlete.age !== undefined && ` (Age ${athlete.age})`}
                              </div>
                            </div>
                            <button className="text-gray-400 hover:text-white">
                              {expandedViewFamilyMemberId === athlete.id ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {expandedViewFamilyMemberId === athlete.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-4 pt-4 border-t border-gray-500"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                {athlete.user_id && (
                                  <div>
                                    <span className="text-gray-400">User ID:</span>
                                    <div className="text-white">{athlete.user_id}</div>
                                  </div>
                                )}
                                {athlete.medical_notes && (
                                  <div className="md:col-span-2">
                                    <span className="text-gray-400">Medical Notes:</span>
                                    <div className="text-white mt-1">{athlete.medical_notes}</div>
                                  </div>
                                )}
                                {athlete.internal_flags && (
                                  <div className="md:col-span-2">
                                    <span className="text-gray-400">Internal Flags:</span>
                                    <div className="text-white mt-1">{athlete.internal_flags}</div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingMember.family.guardians && viewingMember.family.guardians.length > 1 && (
                  <div className="bg-gray-700 p-4 rounded">
                    <h4 className="font-semibold text-white mb-4 text-lg">Other Guardians ({viewingMember.family.guardians.length - 1})</h4>
                    <div className="space-y-3">
                      {viewingMember.family.guardians
                        .filter(g => g.id !== viewingMember.guardian.id)
                        .map((guardian) => (
                          <div key={guardian.id} className="bg-gray-600 p-3 rounded">
                            <div className="text-white font-medium">{guardian.fullName}</div>
                            <div className="text-gray-300 text-sm mt-1">{guardian.email}</div>
                            {guardian.phone && (
                              <div className="text-gray-300 text-sm">{guardian.phone}</div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowMemberViewModal(false)
                    handleEditMember(viewingMember.guardian, viewingMember.family)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Edit Member
                </button>
                <button
                  onClick={() => setShowMemberViewModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member Edit Modal - Simplified version, full implementation in Admin.tsx lines 6600-7441 */}
      <AnimatePresence>
        {showMemberEditModal && editingMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMemberEditModal(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">Edit Member</h3>
                <button
                  onClick={() => setShowMemberEditModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="font-semibold text-white mb-4 text-lg">User Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                      <input
                        type="text"
                        value={editingMemberData.firstName}
                        onChange={(e) => setEditingMemberData({ ...editingMemberData, firstName: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                      <input
                        type="text"
                        value={editingMemberData.lastName}
                        onChange={(e) => setEditingMemberData({ ...editingMemberData, lastName: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                      <input
                        type="email"
                        value={editingMemberData.email}
                        onChange={(e) => setEditingMemberData({ ...editingMemberData, email: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Phone *</label>
                      <input
                        type="tel"
                        value={editingMemberData.phone}
                        onChange={(e) => {
                          const formatted = formatPhoneNumber(e.target.value)
                          setEditingMemberData({ ...editingMemberData, phone: formatted })
                        }}
                        placeholder="###-###-####"
                        maxLength={12}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        autoComplete="off"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Family Members - Editable */}
                <div className="bg-gray-700 p-4 rounded">
                  <h4 className="font-semibold text-white mb-4 text-lg">Family Members ({editingFamilyMembers.length})</h4>
                  <div className="space-y-4">
                    {editingFamilyMembers.map((member, index) => (
                      <div key={member.id || index} className="bg-gray-600 p-4 rounded">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="text-white font-medium">
                            {member.firstName} {member.lastName}
                          </h5>
                          <button
                            onClick={() => setExpandedFamilyMemberId(expandedFamilyMemberId === (member.id || index) ? null : (member.id || index))}
                            className="text-gray-400 hover:text-white"
                          >
                            {expandedFamilyMemberId === (member.id || index) ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        {expandedFamilyMemberId === (member.id || index) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-500"
                          >
                            <div>
                              <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                              <input
                                type="text"
                                value={member.firstName}
                                onChange={(e) => {
                                  const updated = [...editingFamilyMembers]
                                  updated[index].firstName = e.target.value
                                  setEditingFamilyMembers(updated)
                                }}
                                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                              <input
                                type="text"
                                value={member.lastName}
                                onChange={(e) => {
                                  const updated = [...editingFamilyMembers]
                                  updated[index].lastName = e.target.value
                                  setEditingFamilyMembers(updated)
                                }}
                                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-300 mb-2">Date of Birth *</label>
                              <input
                                type="date"
                                value={member.dateOfBirth}
                                onChange={(e) => {
                                  const updated = [...editingFamilyMembers]
                                  updated[index].dateOfBirth = e.target.value
                                  setEditingFamilyMembers(updated)
                                }}
                                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                required
                              />
                            </div>
                            {(() => {
                              const birthDate = member.dateOfBirth ? new Date(member.dateOfBirth) : null
                              const today = new Date()
                              const age = birthDate ? today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0) : null
                              const isAdult = age !== null && age >= 18
                              
                              return (
                                <>
                                  {isAdult && (
                                    <>
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                                        <input
                                          type="email"
                                          value={member.email}
                                          onChange={(e) => {
                                            const updated = [...editingFamilyMembers]
                                            updated[index].email = e.target.value
                                            setEditingFamilyMembers(updated)
                                          }}
                                          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-300 mb-2">Username *</label>
                                        <input
                                          type="text"
                                          value={member.username}
                                          onChange={(e) => {
                                            const updated = [...editingFamilyMembers]
                                            updated[index].username = e.target.value
                                            setEditingFamilyMembers(updated)
                                          }}
                                          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-300 mb-2">Password</label>
                                        <input
                                          type="password"
                                          value={member.password}
                                          onChange={(e) => {
                                            const updated = [...editingFamilyMembers]
                                            updated[index].password = e.target.value
                                            setEditingFamilyMembers(updated)
                                          }}
                                          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                          placeholder="Leave blank to keep current"
                                          minLength={6}
                                        />
                                      </div>
                                    </>
                                  )}
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Enrollment</label>
                                    <div className="space-y-3">
                                      {(member.enrollments || []).map((enrollment, enrollmentIndex) => {
                                        const selectedProgramIds = (member.enrollments || []).map(e => e.programId).filter(Boolean)
                                        return (
                                          <div key={enrollmentIndex} className="bg-gray-600 p-4 rounded border border-gray-500">
                                            <div className="flex justify-between items-center mb-3">
                                              <span className="text-white font-medium">Enrollment {enrollmentIndex + 1}</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updated = [...editingFamilyMembers]
                                                  if (!updated[index].enrollments) {
                                                    updated[index].enrollments = []
                                                  }
                                                  updated[index].enrollments = updated[index].enrollments.filter((_, i) => i !== enrollmentIndex)
                                                  setEditingFamilyMembers(updated)
                                                }}
                                                className="text-red-400 hover:text-red-300"
                                              >
                                                <X className="w-4 h-4" />
                                              </button>
                                            </div>
                                            <div className="space-y-3">
                                              <div>
                                                <label className="block text-sm font-semibold text-gray-300 mb-2">Class *</label>
                                                <select
                                                  value={enrollment.programId || ''}
                                                  onChange={(e) => {
                                                    const updated = [...editingFamilyMembers]
                                                    if (!updated[index].enrollments) {
                                                      updated[index].enrollments = []
                                                    }
                                                    const programId = e.target.value ? parseInt(e.target.value) : null
                                                    const selectedProgram = programs.find(p => p.id === programId)
                                                    updated[index].enrollments[enrollmentIndex].programId = programId
                                                    updated[index].enrollments[enrollmentIndex].program = selectedProgram?.displayName || ''
                                                    setEditingFamilyMembers(updated)
                                                  }}
                                                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                                  required
                                                >
                                                  <option value="">Select a class</option>
                                                  {(() => {
                                                    const { groupedByCategory, sortedCategories } = getActiveClassesByCategory(programs)
                                                    return sortedCategories.map(categoryName => (
                                                      <optgroup key={categoryName} label={categoryName}>
                                                        {groupedByCategory[categoryName].map((program) => {
                                                          const isSelected = selectedProgramIds.includes(program.id) && (member.enrollments || [])[enrollmentIndex].programId !== program.id
                                                          return (
                                                            <option 
                                                              key={program.id} 
                                                              value={program.id}
                                                              disabled={isSelected}
                                                            >
                                                              {program.displayName}
                                                            </option>
                                                          )
                                                        })}
                                                      </optgroup>
                                                    ))
                                                  })()}
                                                </select>
                                              </div>
                                              {enrollment.programId && (
                                                <>
                                                  <div>
                                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Days Per Week *</label>
                                                    <select
                                                      value={enrollment.daysPerWeek}
                                                      onChange={(e) => {
                                                        const updated = [...editingFamilyMembers]
                                                        if (!updated[index].enrollments) {
                                                          updated[index].enrollments = []
                                                        }
                                                        const daysPerWeek = parseInt(e.target.value)
                                                        updated[index].enrollments[enrollmentIndex].daysPerWeek = daysPerWeek
                                                        if (updated[index].enrollments[enrollmentIndex].selectedDays.length !== daysPerWeek) {
                                                          updated[index].enrollments[enrollmentIndex].selectedDays = []
                                                        }
                                                        setEditingFamilyMembers(updated)
                                                      }}
                                                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                                      required
                                                    >
                                                      <option value={1}>1 day</option>
                                                      <option value={2}>2 days</option>
                                                      <option value={3}>3 days</option>
                                                      <option value={4}>4 days</option>
                                                      <option value={5}>5 days</option>
                                                      <option value={6}>6 days</option>
                                                      <option value={7}>7 days</option>
                                                    </select>
                                                  </div>
                                                  <div>
                                                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                                                      Select Days * ({enrollment.selectedDays.length} of {enrollment.daysPerWeek} selected)
                                                    </label>
                                                    <div className="grid grid-cols-7 gap-2">
                                                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                                        <button
                                                          key={day}
                                                          type="button"
                                                          onClick={() => {
                                                            const updated = [...editingFamilyMembers]
                                                            if (!updated[index].enrollments) {
                                                              updated[index].enrollments = []
                                                            }
                                                            const dayIndex = updated[index].enrollments[enrollmentIndex].selectedDays.indexOf(day)
                                                            if (dayIndex > -1) {
                                                              updated[index].enrollments[enrollmentIndex].selectedDays.splice(dayIndex, 1)
                                                            } else {
                                                              if (updated[index].enrollments[enrollmentIndex].selectedDays.length < updated[index].enrollments[enrollmentIndex].daysPerWeek) {
                                                                updated[index].enrollments[enrollmentIndex].selectedDays.push(day)
                                                              } else {
                                                                alert(`Please select exactly ${updated[index].enrollments[enrollmentIndex].daysPerWeek} day(s)`)
                                                                return
                                                              }
                                                            }
                                                            setEditingFamilyMembers(updated)
                                                          }}
                                                          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                                            enrollment.selectedDays.includes(day)
                                                              ? 'bg-vortex-red text-white'
                                                              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                                          }`}
                                                        >
                                                          {day.substring(0, 3)}
                                                        </button>
                                                      ))}
                                                    </div>
                                                  </div>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...editingFamilyMembers]
                                          if (!updated[index].enrollments) {
                                            updated[index].enrollments = []
                                          }
                                          updated[index].enrollments = [...(updated[index].enrollments || []), {
                                            programId: null,
                                            program: '',
                                            daysPerWeek: 1,
                                            selectedDays: []
                                          }]
                                          setEditingFamilyMembers(updated)
                                        }}
                                        className="w-full px-4 py-2 bg-gray-600 text-white rounded border border-gray-500 hover:bg-gray-500 flex items-center justify-center gap-2"
                                      >
                                        <Plus className="w-4 h-4" />
                                        Add Enrollment
                                      </button>
                                    </div>
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Medical Notes</label>
                                    <textarea
                                      value={member.medicalNotes}
                                      onChange={(e) => {
                                        const updated = [...editingFamilyMembers]
                                        updated[index].medicalNotes = e.target.value
                                        setEditingFamilyMembers(updated)
                                      }}
                                      rows={2}
                                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Internal Flags</label>
                                    <input
                                      type="text"
                                      value={member.internalFlags}
                                      onChange={(e) => {
                                        const updated = [...editingFamilyMembers]
                                        updated[index].internalFlags = e.target.value
                                        setEditingFamilyMembers(updated)
                                      }}
                                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                    />
                                  </div>
                                </>
                              )
                            })()}
                          </motion.div>
                        )}
                      </div>
                    ))}
                    
                    {/* Add New Family Member Section */}
                    <div className="bg-gray-600 p-4 rounded border-2 border-dashed border-gray-500">
                      <h5 className="text-white font-medium mb-4">Add New Family Member</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">First Name</label>
                          <input
                            type="text"
                            value={newFamilyMemberInEdit.firstName}
                            onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, firstName: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name</label>
                          <input
                            type="text"
                            value={newFamilyMemberInEdit.lastName}
                            onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, lastName: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Date of Birth</label>
                          <input
                            type="date"
                            value={newFamilyMemberInEdit.dateOfBirth}
                            onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, dateOfBirth: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                          />
                        </div>
                        {(() => {
                          const birthDate = newFamilyMemberInEdit.dateOfBirth ? new Date(newFamilyMemberInEdit.dateOfBirth) : null
                          const today = new Date()
                          const age = birthDate ? today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0) : null
                          const isAdult = age !== null && age >= 18
                          const existingAddresses = Array.from(new Set([
                            combineAddress(editingMemberData.addressStreet, editingMemberData.addressCity, editingMemberData.addressState, editingMemberData.addressZip),
                            ...editingFamilyMembers.map(() => '').filter(Boolean)
                          ])).filter(Boolean)
                          
                          return (
                            <>
                              {isAdult && (
                                <>
                                  <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                                    <input
                                      type="email"
                                      value={newFamilyMemberInEdit.email}
                                      onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, email: e.target.value })}
                                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Username *</label>
                                    <input
                                      type="text"
                                      value={newFamilyMemberInEdit.username}
                                      onChange={async (e) => {
                                        const username = e.target.value
                                        if (!username) {
                                          const generated = await generateUsername(newFamilyMemberInEdit.firstName, newFamilyMemberInEdit.lastName)
                                          setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, username: generated })
                                        } else {
                                          setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, username })
                                        }
                                      }}
                                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                                    <input
                                      type="password"
                                      value={newFamilyMemberInEdit.password}
                                      onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, password: e.target.value })}
                                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                      required
                                      minLength={6}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Default: vortex</p>
                                  </div>
                                </>
                              )}
                              {existingAddresses.length > 0 && (
                                <div className="md:col-span-2">
                                  <label className="block text-sm font-semibold text-gray-300 mb-2">Mailing Address (Select from family or enter new)</label>
                                  <select
                                    value={newFamilyMemberInEdit.address}
                                    onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, address: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500 mb-2"
                                  >
                                    <option value="">Select existing address or enter new below</option>
                                    {existingAddresses.map((addr, idx) => (
                                      <option key={idx} value={addr}>{addr}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    value={newFamilyMemberInEdit.address}
                                    onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, address: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                    placeholder="Or enter new address"
                                  />
                                </div>
                              )}
                            </>
                          )
                        })()}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Enrollment</label>
                          <div className="space-y-3">
                            {newFamilyMemberInEdit.enrollments && newFamilyMemberInEdit.enrollments.length > 0 && newFamilyMemberInEdit.enrollments.map((enrollment, enrollmentIndex) => {
                              const selectedProgramIds = newFamilyMemberInEdit.enrollments.map(e => e.programId).filter(Boolean)
                              return (
                                <div key={enrollmentIndex} className="bg-gray-600 p-4 rounded border border-gray-500">
                                  <div className="flex justify-between items-center mb-3">
                                    <span className="text-white font-medium">Enrollment {enrollmentIndex + 1}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNewFamilyMemberInEdit({
                                          ...newFamilyMemberInEdit,
                                          enrollments: newFamilyMemberInEdit.enrollments.filter((_, i) => i !== enrollmentIndex)
                                        })
                                      }}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="space-y-3">
                                    <div>
                                      <label className="block text-sm font-semibold text-gray-300 mb-2">Class *</label>
                                      <select
                                        value={enrollment.programId || ''}
                                        onChange={(e) => {
                                          const programId = e.target.value ? parseInt(e.target.value) : null
                                          const selectedProgram = programs.find(p => p.id === programId)
                                          const updatedEnrollments = [...newFamilyMemberInEdit.enrollments]
                                          updatedEnrollments[enrollmentIndex].programId = programId
                                          updatedEnrollments[enrollmentIndex].program = selectedProgram?.displayName || ''
                                          setNewFamilyMemberInEdit({
                                            ...newFamilyMemberInEdit,
                                            enrollments: updatedEnrollments
                                          })
                                        }}
                                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                        required
                                      >
                                        <option value="">Select a class</option>
                                        {(() => {
                                          const { groupedByCategory, sortedCategories } = getActiveClassesByCategory(programs)
                                          return sortedCategories.map(categoryName => (
                                            <optgroup key={categoryName} label={categoryName}>
                                              {groupedByCategory[categoryName].map((program) => {
                                                const isSelected = selectedProgramIds.includes(program.id) && (newFamilyMemberInEdit.enrollments || [])[enrollmentIndex].programId !== program.id
                                                return (
                                                  <option 
                                                    key={program.id} 
                                                    value={program.id}
                                                    disabled={isSelected}
                                                  >
                                                    {program.displayName}
                                                  </option>
                                                )
                                              })}
                                            </optgroup>
                                          ))
                                        })()}
                                      </select>
                                    </div>
                                    {enrollment.programId && (
                                      <>
                                        <div>
                                          <label className="block text-sm font-semibold text-gray-300 mb-2">Days Per Week *</label>
                                          <select
                                            value={enrollment.daysPerWeek}
                                            onChange={(e) => {
                                              const daysPerWeek = parseInt(e.target.value)
                                              const updatedEnrollments = [...newFamilyMemberInEdit.enrollments]
                                              updatedEnrollments[enrollmentIndex].daysPerWeek = daysPerWeek
                                              if (updatedEnrollments[enrollmentIndex].selectedDays.length !== daysPerWeek) {
                                                updatedEnrollments[enrollmentIndex].selectedDays = []
                                              }
                                              setNewFamilyMemberInEdit({
                                                ...newFamilyMemberInEdit,
                                                enrollments: updatedEnrollments
                                              })
                                            }}
                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                                            required
                                          >
                                            <option value={1}>1 day</option>
                                            <option value={2}>2 days</option>
                                            <option value={3}>3 days</option>
                                            <option value={4}>4 days</option>
                                            <option value={5}>5 days</option>
                                            <option value={6}>6 days</option>
                                            <option value={7}>7 days</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                                            Select Days * ({enrollment.selectedDays.length} of {enrollment.daysPerWeek} selected)
                                          </label>
                                          <div className="grid grid-cols-7 gap-2">
                                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                              <button
                                                key={day}
                                                type="button"
                                                onClick={() => {
                                                  const dayIndex = enrollment.selectedDays.indexOf(day)
                                                  const updatedEnrollments = [...newFamilyMemberInEdit.enrollments]
                                                  if (dayIndex > -1) {
                                                    updatedEnrollments[enrollmentIndex].selectedDays = updatedEnrollments[enrollmentIndex].selectedDays.filter(d => d !== day)
                                                  } else {
                                                    if (updatedEnrollments[enrollmentIndex].selectedDays.length < updatedEnrollments[enrollmentIndex].daysPerWeek) {
                                                      updatedEnrollments[enrollmentIndex].selectedDays.push(day)
                                                    } else {
                                                      alert(`Please select exactly ${updatedEnrollments[enrollmentIndex].daysPerWeek} day(s)`)
                                                      return
                                                    }
                                                  }
                                                  setNewFamilyMemberInEdit({
                                                    ...newFamilyMemberInEdit,
                                                    enrollments: updatedEnrollments
                                                  })
                                                }}
                                                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                                                  enrollment.selectedDays.includes(day)
                                                    ? 'bg-vortex-red text-white'
                                                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                                }`}
                                              >
                                                {day.substring(0, 3)}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                            <button
                              type="button"
                              onClick={() => {
                                if (!newFamilyMemberInEdit.enrollments) {
                                  setNewFamilyMemberInEdit({
                                    ...newFamilyMemberInEdit,
                                    enrollments: []
                                  })
                                }
                                setNewFamilyMemberInEdit({
                                  ...newFamilyMemberInEdit,
                                  enrollments: [
                                    ...(newFamilyMemberInEdit.enrollments || []),
                                    {
                                      programId: null,
                                      program: '',
                                      daysPerWeek: 1,
                                      selectedDays: []
                                    }
                                  ]
                                })
                              }}
                              className="w-full px-4 py-2 bg-gray-600 text-white rounded border border-gray-500 hover:bg-gray-500 flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Add Enrollment
                            </button>
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Medical Notes</label>
                          <textarea
                            value={newFamilyMemberInEdit.medicalNotes}
                            onChange={(e) => setNewFamilyMemberInEdit({ ...newFamilyMemberInEdit, medicalNotes: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <button
                            onClick={() => {
                              if (!newFamilyMemberInEdit.firstName || !newFamilyMemberInEdit.lastName || !newFamilyMemberInEdit.dateOfBirth) {
                                alert('Please fill in first name, last name, and date of birth')
                                return
                              }
                              const birthDate = new Date(newFamilyMemberInEdit.dateOfBirth)
                              const today = new Date()
                              const age = today.getFullYear() - birthDate.getFullYear() - (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
                              if (age >= 18 && (!newFamilyMemberInEdit.email || !newFamilyMemberInEdit.username)) {
                                alert('Adults must have email and username')
                                return
                              }
                              if (newFamilyMemberInEdit.enrollments && newFamilyMemberInEdit.enrollments.length > 0) {
                                for (const enrollment of newFamilyMemberInEdit.enrollments) {
                                  if (!enrollment.programId) {
                                    alert('Please select a class for all enrollments')
                                    return
                                  }
                                  if (enrollment.selectedDays.length !== enrollment.daysPerWeek) {
                                    alert(`Please select exactly ${enrollment.daysPerWeek} day(s) for ${enrollment.program || 'enrollment'}`)
                                    return
                                  }
                                }
                              }
                              setEditingFamilyMembers([...editingFamilyMembers, {
                                firstName: newFamilyMemberInEdit.firstName,
                                lastName: newFamilyMemberInEdit.lastName,
                                dateOfBirth: newFamilyMemberInEdit.dateOfBirth,
                                email: newFamilyMemberInEdit.email,
                                username: newFamilyMemberInEdit.username,
                                password: newFamilyMemberInEdit.password,
                                medicalNotes: newFamilyMemberInEdit.medicalNotes,
                                internalFlags: newFamilyMemberInEdit.internalFlags,
                                enrollments: newFamilyMemberInEdit.enrollments || [],
                                userId: null
                              }])
                              setNewFamilyMemberInEdit({
                                firstName: '',
                                lastName: '',
                                dateOfBirth: '',
                                email: '',
                                username: '',
                                password: 'vortex',
                                medicalNotes: '',
                                internalFlags: '',
                                enrollments: [],
                                address: ''
                              })
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                          >
                            Finished with Member
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowMemberEditModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMemberEdit}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

