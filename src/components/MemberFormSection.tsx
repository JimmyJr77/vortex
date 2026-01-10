import { ChevronDown, ChevronUp } from 'lucide-react'

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
  parentGuardianIds?: number[] // Array of parent/guardian member IDs (for children)
  hasCompletedWaivers?: boolean // Waiver completion status
  waiverCompletionDate?: string | null // Date when waivers were completed
  sections: {
    contactInfo: { isExpanded: boolean; tempData: { firstName: string; lastName: string; email: string; phone: string; addressStreet: string; addressCity: string; addressState: string; addressZip: string } }
    loginSecurity: { isExpanded: boolean; tempData: { username: string; password: string } }
    statusVerification: { isExpanded: boolean }
    personalData?: { isExpanded: boolean; tempData: { dateOfBirth: string; gender: string; medicalConcerns: string; injuryHistoryDate: string; injuryHistoryBodyPart: string; injuryHistoryNotes: string; noInjuryHistory: boolean } }
    parentGuardians?: { isExpanded: boolean; tempData: { parentGuardianIds: number[] } }
    waivers?: { isExpanded: boolean; tempData: { hasCompletedWaivers: boolean; waiverCompletionDate: string | null } }
    previousClasses?: { isExpanded: boolean; tempData: { experience: string } }
  }
  athleteId?: number | null
  userId?: number | null
  user_id?: number | null
  isActive?: boolean
}

interface MemberFormSectionProps {
  member: FamilyMemberData
  memberIndex: number
  isExpanded: boolean
  onToggleExpand: (memberId: string) => void
  onUpdateMember: (memberId: string, updates: Partial<FamilyMemberData> | ((prev: FamilyMemberData) => FamilyMemberData)) => void
  onToggleSection: (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'statusVerification' | 'personalData' | 'parentGuardians' | 'waivers' | 'previousClasses') => void
  onSectionContinue: (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'statusVerification' | 'personalData' | 'parentGuardians' | 'waivers' | 'previousClasses') => void
  onSectionMinimize: (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'statusVerification' | 'personalData' | 'parentGuardians' | 'waivers' | 'previousClasses') => void
  onSectionCancel: (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'statusVerification' | 'personalData' | 'parentGuardians' | 'waivers' | 'previousClasses') => void
  onFinishedWithMember: (memberId: string) => void
  generateUsername: (firstName: string, lastName?: string) => Promise<string>
  formatPhoneNumber: (value: string) => string
  // New props for parent/guardian selection
  availableParentGuardians?: Array<{ id: number; firstName: string; lastName: string; email?: string; phone?: string }>
  onSearchParentGuardians?: (query: string) => void
}

export default function MemberFormSection({
  member,
  memberIndex,
  isExpanded,
  onToggleExpand,
  onUpdateMember,
  onToggleSection,
  onSectionContinue,
  onSectionMinimize,
  onSectionCancel,
  onFinishedWithMember,
  generateUsername,
  formatPhoneNumber,
  availableParentGuardians = [],
  onSearchParentGuardians
}: MemberFormSectionProps) {
  // Get member display name - use actual name if available, otherwise show placeholder
  const memberDisplayName = member.firstName || member.lastName 
    ? `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'New Member'
    : `Family Member ${memberIndex + 1}`
  
  const memberTitle = memberIndex === 0 
    ? `${memberDisplayName} (Must be an Adult) *`
    : memberDisplayName

  // Helper to update member's section tempData
  const updateSectionTempData = (
    section: 'contactInfo' | 'loginSecurity' | 'statusVerification' | 'personalData' | 'parentGuardians' | 'waivers' | 'previousClasses',
    updates: Record<string, unknown>
  ) => {
    onUpdateMember(member.id, (prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: {
          ...prev.sections[section],
          ...(section === 'statusVerification' ? {} : { tempData: { ...(prev.sections[section]?.tempData || {}), ...updates } })
        }
      }
    }))
  }
  
  // Calculate age from date of birth
  const calculateAge = (dateOfBirth: string): number | null => {
    if (!dateOfBirth) return null
    const birthDate = new Date(dateOfBirth)
    if (isNaN(birthDate.getTime())) return null
    const today = new Date()
    const age = today.getFullYear() - birthDate.getFullYear() - 
      (today.getMonth() < birthDate.getMonth() || 
       (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
    return age
  }
  
  // Check if member is a child (< 18)
  const isChild = (): boolean => {
    if (!member.dateOfBirth) return false
    const age = calculateAge(member.dateOfBirth)
    return age !== null && age < 18
  }
  
  // Get parent/guardian IDs from member
  const getParentGuardianIds = (): number[] => {
    if (member.sections.parentGuardians?.tempData?.parentGuardianIds) {
      return member.sections.parentGuardians.tempData.parentGuardianIds
    }
    return member.parentGuardianIds || []
  }

  // Handle contact info changes with username generation
  const handleContactInfoChange = async (field: string, value: string) => {
    const updates: Record<string, string> = { [field]: value }
    
    // If firstName or lastName changed, regenerate username
    if (field === 'firstName' || field === 'lastName') {
      const firstName = field === 'firstName' ? value : member.sections.contactInfo.tempData.firstName
      const lastName = field === 'lastName' ? value : member.sections.contactInfo.tempData.lastName
      const username = await generateUsername(firstName, lastName)
      
      updateSectionTempData('contactInfo', updates)
      updateSectionTempData('loginSecurity', { username })
    } else {
      updateSectionTempData('contactInfo', updates)
    }
  }

  // Determine enrollment status based on enrollments
  const getEnrollmentStatus = (): 'non-participant' | 'athlete' => {
    const enrollments = member.enrollments || []
    return enrollments.length > 0 ? 'athlete' : 'non-participant'
  }

  // Get active/idle status
  const getActiveStatus = (): 'active' | 'idle' => {
    return member.isActive !== false ? 'active' : 'idle'
  }

  return (
    <div className="bg-gray-700 p-4 rounded">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-white">
          {memberTitle}
        </h4>
        <button
          type="button"
          onClick={() => onToggleExpand(member.id)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
      </div>
      
      {isExpanded && (
        <>
          {/* 1. Contact Information Section */}
          <div className="mb-4 border border-gray-600 rounded">
            <button
              type="button"
              onClick={() => onToggleSection(member.id, 'contactInfo')}
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
                      onChange={(e) => handleContactInfoChange('firstName', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                    <input
                      type="text"
                      value={member.sections.contactInfo.tempData.lastName}
                      onChange={(e) => handleContactInfoChange('lastName', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                    <input
                      type="email"
                      value={member.sections.contactInfo.tempData.email}
                      onChange={(e) => handleContactInfoChange('email', e.target.value)}
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
                        handleContactInfoChange('phone', formatted)
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
                      onChange={(e) => handleContactInfoChange('addressStreet', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                      placeholder="Street address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">City</label>
                    <input
                      type="text"
                      value={member.sections.contactInfo.tempData.addressCity}
                      onChange={(e) => handleContactInfoChange('addressCity', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">State</label>
                    <input
                      type="text"
                      value={member.sections.contactInfo.tempData.addressState}
                      onChange={(e) => handleContactInfoChange('addressState', e.target.value)}
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
                      onChange={(e) => handleContactInfoChange('addressZip', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                      placeholder="ZIP code"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => onSectionContinue(member.id, 'contactInfo')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionMinimize(member.id, 'contactInfo')}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Minimize
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionCancel(member.id, 'contactInfo')}
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
              onClick={() => onToggleSection(member.id, 'loginSecurity')}
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
                      onChange={(e) => updateSectionTempData('loginSecurity', { username: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                    <input
                      type="password"
                      value={member.sections.loginSecurity.tempData.password}
                      onChange={(e) => updateSectionTempData('loginSecurity', { password: e.target.value })}
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
                    onClick={() => onSectionContinue(member.id, 'loginSecurity')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionMinimize(member.id, 'loginSecurity')}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Minimize
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionCancel(member.id, 'loginSecurity')}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Personal Data Section */}
          <div className="mb-4 border border-gray-600 rounded">
            <button
              type="button"
              onClick={() => onToggleSection(member.id, 'personalData')}
              className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded-t"
            >
              <span>3. Personal Data <span className="text-red-400">*</span></span>
              <span>{member.sections.personalData?.isExpanded ? '−' : '+'}</span>
            </button>
            {member.sections.personalData?.isExpanded && (
              <div className="p-4 bg-gray-800">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Gender *
                    </label>
                    <select
                      value={member.sections.personalData?.tempData?.gender || member.gender || ''}
                      onChange={(e) => {
                        onUpdateMember(member.id, (prev) => ({
                          ...prev,
                          gender: e.target.value
                        }))
                        updateSectionTempData('personalData', { gender: e.target.value })
                      }}
                      className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      value={member.sections.personalData?.tempData?.dateOfBirth || member.dateOfBirth || ''}
                      onChange={(e) => {
                        onUpdateMember(member.id, (prev) => ({
                          ...prev,
                          dateOfBirth: e.target.value
                        }))
                        updateSectionTempData('personalData', { dateOfBirth: e.target.value })
                      }}
                      className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                      max={new Date().toISOString().split('T')[0]} // Can't be in the future
                      required
                    />
                    {member.dateOfBirth && calculateAge(member.dateOfBirth) !== null && (
                      <p className="text-xs text-gray-400 mt-1">
                        Age: {calculateAge(member.dateOfBirth)} years old
                        {isChild() && <span className="text-yellow-400 ml-2">(Child - Parent/Guardian required)</span>}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Medical Concerns *
                    </label>
                    <textarea
                      value={member.sections.personalData?.tempData?.medicalConcerns || member.medicalConcerns || ''}
                      onChange={(e) => {
                        onUpdateMember(member.id, (prev) => ({
                          ...prev,
                          medicalConcerns: e.target.value
                        }))
                        updateSectionTempData('personalData', { medicalConcerns: e.target.value })
                      }}
                      className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                      rows={3}
                      placeholder="Enter any medical concerns or conditions (enter 'None' if none)"
                      required
                    />
                  </div>
                  <div className="border-t border-gray-600 pt-4">
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      History of Injury *
                    </label>
                    <div className="mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={member.sections.personalData?.tempData?.noInjuryHistory || member.noInjuryHistory || false}
                          onChange={(e) => {
                            onUpdateMember(member.id, (prev) => ({
                              ...prev,
                              noInjuryHistory: e.target.checked,
                              injuryHistoryDate: e.target.checked ? '' : prev.injuryHistoryDate,
                              injuryHistoryBodyPart: e.target.checked ? '' : prev.injuryHistoryBodyPart,
                              injuryHistoryNotes: e.target.checked ? '' : prev.injuryHistoryNotes
                            }))
                            updateSectionTempData('personalData', { 
                              noInjuryHistory: e.target.checked,
                              injuryHistoryDate: e.target.checked ? '' : (member.sections.personalData?.tempData?.injuryHistoryDate || ''),
                              injuryHistoryBodyPart: e.target.checked ? '' : (member.sections.personalData?.tempData?.injuryHistoryBodyPart || ''),
                              injuryHistoryNotes: e.target.checked ? '' : (member.sections.personalData?.tempData?.injuryHistoryNotes || '')
                            })
                          }}
                          className="w-4 h-4 text-vortex-red bg-gray-600 border-gray-500 rounded focus:ring-vortex-red"
                        />
                        <span className="text-sm font-semibold text-gray-300">
                          No history of injury *
                        </span>
                      </label>
                    </div>
                    {!member.sections.personalData?.tempData?.noInjuryHistory && !member.noInjuryHistory && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Injury Date *
                          </label>
                          <input
                            type="date"
                            value={member.sections.personalData?.tempData?.injuryHistoryDate || member.injuryHistoryDate || ''}
                            onChange={(e) => {
                              onUpdateMember(member.id, (prev) => ({
                                ...prev,
                                injuryHistoryDate: e.target.value
                              }))
                              updateSectionTempData('personalData', { injuryHistoryDate: e.target.value })
                            }}
                            className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                            max={new Date().toISOString().split('T')[0]}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Body Part *
                          </label>
                          <input
                            type="text"
                            value={member.sections.personalData?.tempData?.injuryHistoryBodyPart || member.injuryHistoryBodyPart || ''}
                            onChange={(e) => {
                              onUpdateMember(member.id, (prev) => ({
                                ...prev,
                                injuryHistoryBodyPart: e.target.value
                              }))
                              updateSectionTempData('personalData', { injuryHistoryBodyPart: e.target.value })
                            }}
                            className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                            placeholder="e.g., Left knee, Right shoulder"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Injury Notes *
                          </label>
                          <textarea
                            value={member.sections.personalData?.tempData?.injuryHistoryNotes || member.injuryHistoryNotes || ''}
                            onChange={(e) => {
                              onUpdateMember(member.id, (prev) => ({
                                ...prev,
                                injuryHistoryNotes: e.target.value
                              }))
                              updateSectionTempData('personalData', { injuryHistoryNotes: e.target.value })
                            }}
                            className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                            rows={3}
                            placeholder="Describe the injury and any relevant details"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => onSectionContinue(member.id, 'personalData')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionMinimize(member.id, 'personalData')}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Minimize
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionCancel(member.id, 'personalData')}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Parent/Guardian Selection (for children) */}
          {isChild() && (
            <div className="mb-4 border-2 border-yellow-600 rounded">
              <button
                type="button"
                onClick={() => onToggleSection(member.id, 'parentGuardians')}
                className="w-full px-4 py-3 bg-yellow-700 hover:bg-yellow-600 text-white font-semibold flex justify-between items-center rounded-t"
              >
                <span>4. Parent/Guardian Selection <span className="text-red-400">* (Required for children)</span></span>
                <span>{member.sections.parentGuardians?.isExpanded ? '−' : '+'}</span>
              </button>
              {member.sections.parentGuardians?.isExpanded && (
                <div className="p-4 bg-gray-800">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Search for Parent/Guardian (must be 18+)
                      </label>
                      <input
                        type="text"
                        placeholder="Search by name, email, or phone..."
                        onChange={(e) => {
                          const query = e.target.value
                          if (onSearchParentGuardians && query.length >= 2) {
                            onSearchParentGuardians(query)
                          }
                        }}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                      />
                      {availableParentGuardians.length > 0 && (
                        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                          {availableParentGuardians.map((parent) => {
                            const isSelected = getParentGuardianIds().includes(parent.id)
                            return (
                              <div
                                key={parent.id}
                                onClick={() => {
                                  const currentIds = getParentGuardianIds()
                                  const newIds = isSelected
                                    ? currentIds.filter(id => id !== parent.id)
                                    : [...currentIds, parent.id]
                                  
                                  onUpdateMember(member.id, (prev) => ({
                                    ...prev,
                                    parentGuardianIds: newIds
                                  }))
                                  updateSectionTempData('parentGuardians', { parentGuardianIds: newIds })
                                }}
                                className={`p-3 rounded cursor-pointer transition-colors ${
                                  isSelected 
                                    ? 'bg-green-700 hover:bg-green-600 border-2 border-green-500' 
                                    : 'bg-gray-600 hover:bg-gray-500 border-2 border-transparent'
                                }`}
                              >
                                <div className="font-semibold text-white">
                                  {parent.firstName} {parent.lastName}
                                  {isSelected && <span className="ml-2 text-green-300">✓ Selected</span>}
                                </div>
                                {parent.email && (
                                  <div className="text-sm text-gray-300">{parent.email}</div>
                                )}
                                {parent.phone && (
                                  <div className="text-sm text-gray-300">{parent.phone}</div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    {getParentGuardianIds().length > 0 && (
                      <div className="bg-green-900/30 p-3 rounded border border-green-600">
                        <p className="text-sm text-green-300 font-semibold mb-2">
                          Selected Parent/Guardian(s): {getParentGuardianIds().length}
                        </p>
                      </div>
                    )}
                    {isChild() && getParentGuardianIds().length === 0 && (
                      <div className="bg-red-900/30 p-3 rounded border border-red-600">
                        <p className="text-sm text-red-300">
                          ⚠️ Children under 18 must have at least one parent/guardian selected
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => onSectionContinue(member.id, 'parentGuardians')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                      disabled={getParentGuardianIds().length === 0}
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={() => onSectionMinimize(member.id, 'parentGuardians')}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                    >
                      Minimize
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Waiver Status Section */}
          <div className="mb-4 border border-gray-600 rounded">
            <button
              type="button"
              onClick={() => onToggleSection(member.id, 'waivers')}
              className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded-t"
            >
              <span>4. Waiver Status</span>
              <span>{member.sections.waivers?.isExpanded ? '−' : '+'}</span>
            </button>
            {member.sections.waivers?.isExpanded && (
              <div className="p-4 bg-gray-800">
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={member.hasCompletedWaivers || false}
                        onChange={(e) => {
                          onUpdateMember(member.id, (prev) => ({
                            ...prev,
                            hasCompletedWaivers: e.target.checked,
                            waiverCompletionDate: e.target.checked ? new Date().toISOString().split('T')[0] : null
                          }))
                          updateSectionTempData('waivers', {
                            hasCompletedWaivers: e.target.checked,
                            waiverCompletionDate: e.target.checked ? new Date().toISOString().split('T')[0] : null
                          })
                        }}
                        className="w-4 h-4 text-vortex-red bg-gray-600 border-gray-500 rounded focus:ring-vortex-red"
                      />
                      <span className="text-sm font-semibold text-gray-300">
                        Has Completed Waivers
                      </span>
                    </label>
                  </div>
                  {member.hasCompletedWaivers && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Waiver Completion Date
                      </label>
                      <input
                        type="date"
                        value={member.waiverCompletionDate || new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          onUpdateMember(member.id, (prev) => ({
                            ...prev,
                            waiverCompletionDate: e.target.value
                          }))
                          updateSectionTempData('waivers', { waiverCompletionDate: e.target.value })
                        }}
                        className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  )}
                  <p className="text-xs text-gray-400">
                    Note: Athlete status requires both enrollment and completed waivers
                  </p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => onSectionContinue(member.id, 'waivers')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionMinimize(member.id, 'waivers')}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Minimize
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 5. Status Verification Section */}
          <div className="mb-4 border border-gray-600 rounded">
            <button
              type="button"
              onClick={() => onToggleSection(member.id, 'statusVerification')}
              className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded-t"
            >
              <span>5. Status Verification</span>
              <span>{member.sections.statusVerification.isExpanded ? '−' : '+'}</span>
            </button>
            {!member.sections.statusVerification.isExpanded && (
              <div className="p-4 bg-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-semibold text-gray-300">Enrollment Status:</span>
                    <div className="mt-1">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        getEnrollmentStatus() === 'athlete' 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-600 text-white'
                      }`}>
                        {getEnrollmentStatus() === 'athlete' ? 'Athlete' : 'Non-Participant'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-300">Activity Status:</span>
                    <div className="mt-1">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        getActiveStatus() === 'active' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-yellow-600 text-white'
                      }`}>
                        {getActiveStatus() === 'active' ? 'Active' : 'Idle'}
                      </span>
                    </div>
                  </div>
                </div>
                {member.enrollments && member.enrollments.length > 0 && (
                  <div className="mt-4">
                    <span className="text-sm font-semibold text-gray-300">Enrolled Classes: {member.enrollments.length}</span>
                  </div>
                )}
              </div>
            )}
            {member.sections.statusVerification.isExpanded && (
              <div className="p-4 bg-gray-800">
                <div className="space-y-4">
                  {/* Enrollment Status */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Enrollment Status</label>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-2 rounded font-semibold ${
                        getEnrollmentStatus() === 'athlete' 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-600 text-white'
                      }`}>
                        {getEnrollmentStatus() === 'athlete' ? 'Athlete' : 'Non-Participant'}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {getEnrollmentStatus() === 'athlete' 
                          ? '(Member has enrolled in at least one class)' 
                          : '(Member has not enrolled in any classes)'}
                      </span>
                    </div>
                  </div>

                  {/* Activity Status */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Activity Status</label>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-2 rounded font-semibold ${
                        getActiveStatus() === 'active' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-yellow-600 text-white'
                      }`}>
                        {getActiveStatus() === 'active' ? 'Active' : 'Idle'}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {getActiveStatus() === 'active' 
                          ? '(Member account is active)' 
                          : '(Member account is inactive)'}
                      </span>
                    </div>
                  </div>

                  {/* Enrolled Classes */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Enrolled Classes ({member.enrollments?.length || 0})
                    </label>
                    {!member.enrollments || member.enrollments.length === 0 ? (
                      <div className="text-gray-400 text-sm">No classes enrolled. Members can enroll through the member portal or admin can enroll them in the Enrollments tab.</div>
                    ) : (
                      <div className="space-y-2">
                        {member.enrollments.map((enrollment) => {
                          const selectedDaysArray = Array.isArray(enrollment.selected_days) 
                            ? enrollment.selected_days 
                            : (typeof enrollment.selected_days === 'string' 
                                ? JSON.parse(enrollment.selected_days || '[]') 
                                : [])
                          
                          return (
                            <div key={enrollment.id} className="bg-gray-700 p-3 rounded">
                              <div className="text-white font-medium">
                                {enrollment.program_display_name || 'Unknown Class'}
                              </div>
                              <div className="text-gray-400 text-sm mt-1">
                                {enrollment.days_per_week} day{enrollment.days_per_week !== 1 ? 's' : ''}/week
                                {selectedDaysArray.length > 0 && ` • ${selectedDaysArray.join(', ')}`}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => onSectionContinue(member.id, 'statusVerification')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionMinimize(member.id, 'statusVerification')}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Minimize
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionCancel(member.id, 'statusVerification')}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 6. Previous Classes Section */}
          <div className="mb-4 border border-gray-600 rounded">
            <button
              type="button"
              onClick={() => onToggleSection(member.id, 'previousClasses')}
              className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded-t"
            >
              <span>6. Previous Classes</span>
              <span>{member.sections.previousClasses?.isExpanded ? '−' : '+'}</span>
            </button>
            {member.sections.previousClasses?.isExpanded && (
              <div className="p-4 bg-gray-800">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Experience
                    </label>
                    <textarea
                      value={member.sections.previousClasses?.tempData?.experience || member.experience || ''}
                      onChange={(e) => {
                        onUpdateMember(member.id, (prev) => ({
                          ...prev,
                          experience: e.target.value
                        }))
                        updateSectionTempData('previousClasses', { experience: e.target.value })
                      }}
                      className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
                      rows={4}
                      placeholder="Describe your previous experience with gymnastics, athletics, or related activities"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Previous Classes
                    </label>
                    {!member.previousClasses || member.previousClasses.length === 0 ? (
                      <div className="text-gray-400 text-sm p-4 bg-gray-700 rounded">
                        No previous history
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {member.previousClasses.map((previousClass) => (
                          <div key={previousClass.id} className="bg-gray-700 p-3 rounded">
                            <div className="text-white font-medium">
                              {previousClass.program_display_name || 'Unknown Class'}
                            </div>
                            {previousClass.completed_date && (
                              <div className="text-gray-400 text-sm mt-1">
                                Completed: {new Date(previousClass.completed_date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => onSectionContinue(member.id, 'previousClasses')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionMinimize(member.id, 'previousClasses')}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Minimize
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionCancel(member.id, 'previousClasses')}
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
                onClick={() => onFinishedWithMember(member.id)}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
              >
                Finished with Member
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

