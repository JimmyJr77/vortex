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
  medicalNotes: string
  isFinished: boolean
  sections: {
    contactInfo: { isExpanded: boolean; tempData: { firstName: string; lastName: string; email: string; phone: string; addressStreet: string; addressCity: string; addressState: string; addressZip: string } }
    loginSecurity: { isExpanded: boolean; tempData: { username: string; password: string } }
    statusVerification: { isExpanded: boolean }
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
  onToggleSection: (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'statusVerification') => void
  onSectionContinue: (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'statusVerification') => void
  onSectionMinimize: (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'statusVerification') => void
  onSectionCancel: (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'statusVerification') => void
  onFinishedWithMember: (memberId: string) => void
  generateUsername: (firstName: string, lastName?: string) => Promise<string>
  formatPhoneNumber: (value: string) => string
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
  formatPhoneNumber
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
    section: 'contactInfo' | 'loginSecurity' | 'statusVerification',
    updates: Record<string, string>
  ) => {
    onUpdateMember(member.id, (prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: {
          ...prev.sections[section],
          ...(section === 'statusVerification' ? {} : { tempData: { ...prev.sections[section].tempData, ...updates } })
        }
      }
    }))
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

          {/* 3. Status Verification Section */}
          <div className="mb-4 border border-gray-600 rounded">
            <button
              type="button"
              onClick={() => onToggleSection(member.id, 'statusVerification')}
              className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold flex justify-between items-center rounded-t"
            >
              <span>3. Status Verification</span>
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

