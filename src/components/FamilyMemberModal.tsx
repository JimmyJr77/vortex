import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { getApiUrl } from '../utils/api'

// Import types from AdminMembers (we'll need to export these or duplicate them)
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

interface Guardian {
  id: number
  email: string
  fullName: string
  phone?: string | null
  isPrimary: boolean
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
  createdAt: string
  updatedAt: string
}

interface FamilyMemberModalProps {
  isOpen: boolean
  mode: 'create-new' | 'add-to-existing' | 'edit'
  onClose: () => void
  onSubmit: (data: {
    familyMembers: FamilyMemberData[]
    billingInfo: { firstName: string; lastName: string; billingAddress: string }
  }) => Promise<void>
  // For edit mode
  editingFamily?: Family | null
  editingMemberUserId?: number | null
  // For add-to-existing mode
  existingFamily?: Family | null
  // Programs for enrollment selection
  programs: Program[]
  // Helper functions passed from parent
  generateUsername?: (firstName: string, lastName: string) => Promise<string>
  formatPhoneNumber?: (phone: string) => string
  parseAddress?: (address: string) => { street: string; city: string; state: string; zip: string }
  combineAddress?: (street: string, city: string, state: string, zip: string) => string
  cleanPhoneNumber?: (phone: string) => string
  getActiveClassesByCategory?: (programs: Program[]) => { groupedByCategory: Record<string, Program[]>, sortedCategories: string[] }
}

export default function FamilyMemberModal(props: FamilyMemberModalProps) {
  // Destructure only what we use, keep rest for future implementation
  const {
    isOpen,
    mode,
    onClose,
    onSubmit,
    editingFamily,
    editingMemberUserId,
    existingFamily,
    parseAddress = () => ({ street: '', city: '', state: '', zip: '' }),
    // These props are reserved for future implementation when modal is completed
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    programs: _programs,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generateUsername: _generateUsername,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    formatPhoneNumber: _formatPhoneNumber,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    combineAddress: _combineAddress,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    cleanPhoneNumber: _cleanPhoneNumber,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getActiveClassesByCategory: _getActiveClassesByCategory
  } = props
  
  // Internal state
  const [memberModalMode, setMemberModalMode] = useState<'search' | 'new-family'>('search')
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
  const [, setExpandedFamilyMemberId] = useState<string | number | null>(null)
  const [billingInfo, setBillingInfo] = useState({
    firstName: '',
    lastName: '',
    billingAddress: ''
  })
  const [, setIsBillingExpanded] = useState(true)

  const populateFormFromFamily = async (family: Family, editingUserId?: number | null) => {
    const apiUrl = getApiUrl()
    const populatedMembers: FamilyMemberData[] = []
    
    // Get all guardians and athletes from the family
    const allMembers: Array<{type: 'guardian' | 'athlete', data: Guardian | Athlete, userId?: number | null}> = []
    
    // Add guardians
    if (family.guardians) {
      for (const guardian of family.guardians) {
        allMembers.push({ type: 'guardian', data: guardian, userId: guardian.id })
      }
    }
    
    // Add athletes
    if (family.athletes) {
      for (const athlete of family.athletes) {
        allMembers.push({ type: 'athlete', data: athlete, userId: athlete.user_id || null })
      }
    }
    
    // Populate each member
    for (let i = 0; i < allMembers.length; i++) {
      const member = allMembers[i]
      let email = ''
      let username = ''
      let address = ''
      
      // Fetch user details if userId exists
      if (member.userId) {
        try {
          const userResponse = await fetch(`${apiUrl}/api/admin/users/${member.userId}`)
          if (userResponse.ok) {
            const userData = await userResponse.json()
            if (userData.success && userData.data) {
              email = userData.data.email || ''
              username = userData.data.username || ''
              address = userData.data.address || ''
            }
          }
        } catch (error) {
          console.error('Error fetching user details:', error)
        }
      }
      
      // Get enrollments for athletes
      const enrollments: EnrollmentData[] = []
      if (member.type === 'athlete' && 'id' in member.data) {
        try {
          const enrollmentsResponse = await fetch(`${apiUrl}/api/admin/athletes/${member.data.id}/enrollments`)
          if (enrollmentsResponse.ok) {
            const enrollmentsData = await enrollmentsResponse.json()
            if (enrollmentsData.success && enrollmentsData.data) {
              for (const enrollment of enrollmentsData.data) {
                enrollments.push({
                  id: `enrollment-${enrollment.id}`,
                  programId: enrollment.program_id || null,
                  program: enrollment.program_display_name || 'Unknown Program',
                  daysPerWeek: enrollment.days_per_week || 1,
                  selectedDays: enrollment.selected_days || [],
                  isCompleted: true,
                  isExpanded: false
                })
              }
            }
          }
        } catch (error) {
          console.error('Error fetching enrollments:', error)
        }
      }
      
      const parsedAddress = parseAddress(address)
      const isEditingThisMember = editingUserId === member.userId
      
      // Determine name
      let firstName = ''
      let lastName = ''
      if (member.type === 'guardian') {
        const nameParts = (member.data as Guardian).fullName.split(' ')
        firstName = nameParts[0] || ''
        lastName = nameParts.slice(1).join(' ') || ''
      } else {
        firstName = (member.data as Athlete).first_name
        lastName = (member.data as Athlete).last_name
      }
      
      populatedMembers.push({
        id: `member-${i + 1}`,
        firstName,
        lastName,
        email: email || (member.type === 'guardian' ? (member.data as Guardian).email || '' : ''),
        phone: member.type === 'guardian' ? (member.data as Guardian).phone || '' : '',
        addressStreet: parsedAddress.street,
        addressCity: parsedAddress.city,
        addressState: parsedAddress.state,
        addressZip: parsedAddress.zip,
        username: username || '',
        password: 'vortex',
        enrollments,
        dateOfBirth: member.type === 'athlete' ? (member.data as Athlete).date_of_birth || '' : '',
        medicalNotes: member.type === 'athlete' ? (member.data as Athlete).medical_notes || '' : '',
        isFinished: true,
        sections: {
          contactInfo: { 
            isExpanded: isEditingThisMember,
            tempData: { 
              firstName, 
              lastName, 
              email: email || (member.type === 'guardian' ? (member.data as Guardian).email || '' : ''),
              phone: member.type === 'guardian' ? (member.data as Guardian).phone || '' : '',
              addressStreet: parsedAddress.street,
              addressCity: parsedAddress.city,
              addressState: parsedAddress.state,
              addressZip: parsedAddress.zip
            } 
          },
          loginSecurity: { 
            isExpanded: isEditingThisMember && username ? true : false,
            tempData: { username: username || '', password: 'vortex' } 
          },
          enrollment: { 
            isExpanded: isEditingThisMember && enrollments.length > 0,
            tempData: { programId: null, program: 'Non-Participant', daysPerWeek: 1, selectedDays: [] } 
          }
        }
      })
    }
    
    // Set billing info from primary guardian
    const primaryGuardian = family.guardians?.find(g => g.id === family.primary_user_id) || family.guardians?.[0]
    let billingFirstName = ''
    let billingLastName = ''
    let billingAddress = ''
    
    if (primaryGuardian) {
      const nameParts = primaryGuardian.fullName.split(' ')
      billingFirstName = nameParts[0] || ''
      billingLastName = nameParts.slice(1).join(' ') || ''
      
      if (primaryGuardian.id) {
        try {
          const userResponse = await fetch(`${apiUrl}/api/admin/users/${primaryGuardian.id}`)
          if (userResponse.ok) {
            const userData = await userResponse.json()
            if (userData.success && userData.data && userData.data.address) {
              billingAddress = userData.data.address
            }
          }
        } catch (error) {
          console.error('Error fetching primary guardian address:', error)
        }
      }
    }
    
    setFamilyMembers(populatedMembers)
    setBillingInfo({
      firstName: billingFirstName,
      lastName: billingLastName,
      billingAddress
    })
    
    // Expand the member being edited, or first member if no specific member
    if (editingUserId !== null && editingUserId !== undefined) {
      const editingMemberIndex = populatedMembers.findIndex(m => {
        const memberData = allMembers.find((_am, idx) => idx === populatedMembers.indexOf(m))
        return memberData?.userId === editingUserId
      })
      if (editingMemberIndex >= 0) {
        setExpandedFamilyMemberId(populatedMembers[editingMemberIndex].id)
      }
    } else if (populatedMembers.length > 0) {
      setExpandedFamilyMemberId(populatedMembers[0].id)
    }
  }

  // Initialize based on mode
  useEffect(() => {
    if (!isOpen) return

    if (mode === 'edit' && editingFamily) {
      // Populate from editing family
      populateFormFromFamily(editingFamily, editingMemberUserId || null)
      setMemberModalMode('new-family')
    } else if (mode === 'add-to-existing' && existingFamily) {
      // Populate from existing family, then add blank member
      populateFormFromFamily(existingFamily, null).then(() => {
        setFamilyMembers(prev => {
          const newMember: FamilyMemberData = {
            id: `member-${prev.length + 1}`,
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
          const updated = [...prev, newMember]
          setExpandedFamilyMemberId(newMember.id)
          return updated
        })
      })
      setMemberModalMode('new-family')
    } else if (mode === 'create-new') {
      // Start with blank form
      setMemberModalMode('search')
      resetForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, editingFamily?.id, existingFamily?.id, editingMemberUserId])

  const resetForm = () => {
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

  const handleSubmit = async () => {
    await onSubmit({ familyMembers, billingInfo })
  }
  

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
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
                {mode === 'create-new' && memberModalMode === 'search' && 'Create Member - Search or New'}
                {mode === 'create-new' && memberModalMode === 'new-family' && 'Create New Family'}
                {mode === 'add-to-existing' && 'Add Member to Existing Family'}
                {mode === 'edit' && 'Edit Family Member'}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal content - simplified for now as this modal is legacy */}
            <div className="text-white space-y-4">
              <div className="text-gray-300">
                {mode === 'edit' && 'Editing family member information'}
                {mode === 'add-to-existing' && 'Adding member to existing family'}
                {mode === 'create-new' && 'Creating new family member'}
              </div>
              <div className="bg-gray-700 p-4 rounded">
                <p className="text-sm text-gray-300 mb-4">
                  This modal is currently a placeholder. Please use the main member creation flow in the Members tab.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmit}
                    className="flex-1 bg-vortex-red hover:bg-red-700 text-white px-4 py-2 rounded font-semibold transition-colors"
                  >
                    Submit
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

