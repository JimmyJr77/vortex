import { ChevronDown, ChevronUp } from 'lucide-react'

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

interface MemberFormSectionProps {
  member: FamilyMemberData
  memberIndex: number
  isExpanded: boolean
  onToggleExpand: (memberId: string) => void
  onUpdateMember: (memberId: string, updates: Partial<FamilyMemberData> | ((prev: FamilyMemberData) => FamilyMemberData)) => void
  onToggleSection: (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'enrollment') => void
  onSectionContinue: (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'enrollment') => void
  onSectionMinimize: (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'enrollment') => void
  onSectionCancel: (memberId: string, section: 'contactInfo' | 'loginSecurity' | 'enrollment') => void
  onFinishedWithMember: (memberId: string) => void
  onToggleEnrollment: (memberId: string, enrollmentId: string) => void
  programs: Program[]
  getActiveClassesByCategory: (programs: Program[]) => { groupedByCategory: Record<string, Program[]>, sortedCategories: string[] }
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
  onToggleEnrollment,
  programs,
  getActiveClassesByCategory,
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
  const updateSectionTempData = (section: 'contactInfo' | 'loginSecurity' | 'enrollment', updates: any) => {
    onUpdateMember(member.id, (prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: {
          ...prev.sections[section],
          tempData: {
            ...prev.sections[section].tempData,
            ...updates
          }
        }
      }
    }))
  }

  // Handle contact info changes with username generation
  const handleContactInfoChange = async (field: string, value: string) => {
    const updates: any = { [field]: value }
    
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

  // Handle enrollment program change
  const handleEnrollmentProgramChange = (programId: number | null) => {
    const selectedProgram = programs.find(p => p.id === programId)
    updateSectionTempData('enrollment', {
      programId,
      program: selectedProgram?.displayName || 'Non-Participant',
      daysPerWeek: 1,
      selectedDays: []
    })
  }

  // Handle enrollment days per week change
  const handleEnrollmentDaysChange = (daysPerWeek: number) => {
    updateSectionTempData('enrollment', {
      daysPerWeek,
      selectedDays: member.sections.enrollment.tempData.selectedDays.length !== daysPerWeek 
        ? [] 
        : member.sections.enrollment.tempData.selectedDays
    })
  }

  // Handle enrollment day selection
  const handleEnrollmentDayToggle = (day: string) => {
    const dayIndex = member.sections.enrollment.tempData.selectedDays.indexOf(day)
    if (dayIndex > -1) {
      updateSectionTempData('enrollment', {
        selectedDays: member.sections.enrollment.tempData.selectedDays.filter(d => d !== day)
      })
    } else {
      if (member.sections.enrollment.tempData.selectedDays.length < member.sections.enrollment.tempData.daysPerWeek) {
        updateSectionTempData('enrollment', {
          selectedDays: [...member.sections.enrollment.tempData.selectedDays, day]
        })
      } else {
        alert(`Please select exactly ${member.sections.enrollment.tempData.daysPerWeek} day(s)`)
      }
    }
  }

  // Handle add another enrollment
  const handleAddAnotherEnrollment = () => {
    const sectionData = member.sections.enrollment
    
    // If there's a valid enrollment in tempData, save it first
    if (sectionData.tempData.programId) {
      // Validate days selection if program is selected
      if (sectionData.tempData.selectedDays.length !== sectionData.tempData.daysPerWeek) {
        alert(`Please select exactly ${sectionData.tempData.daysPerWeek} day(s) before adding another enrollment`)
        return
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
      
      onUpdateMember(member.id, (prev) => ({
        ...prev,
        enrollments: [...prev.enrollments, newEnrollment],
        sections: {
          ...prev.sections,
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
      }))
    } else {
      // Just reset the form
      onUpdateMember(member.id, (prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
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
      }))
    }
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

          {/* 3. Class Enrollments Section */}
          <div className="mb-4 border border-gray-600 rounded">
            <button
              type="button"
              onClick={() => onToggleSection(member.id, 'enrollment')}
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
                          onClick={() => onToggleEnrollment(member.id, enrollment.id)}
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
                        handleEnrollmentProgramChange(programId)
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
                          onChange={(e) => handleEnrollmentDaysChange(parseInt(e.target.value))}
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
                              onClick={() => handleEnrollmentDayToggle(day)}
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
                    onClick={handleAddAnotherEnrollment}
                    className="w-full text-white font-semibold py-2 hover:bg-gray-700 rounded transition-colors"
                  >
                    Add Another Program / Class
                  </button>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => onSectionContinue(member.id, 'enrollment')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionMinimize(member.id, 'enrollment')}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
                  >
                    Minimize
                  </button>
                  <button
                    type="button"
                    onClick={() => onSectionCancel(member.id, 'enrollment')}
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

