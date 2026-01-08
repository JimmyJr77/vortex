import { useState, useEffect } from 'react'
import { Search, UserPlus, Users, Clock } from 'lucide-react'
import { getApiUrl } from '../utils/api'
import EnrollmentForm from './EnrollmentForm'

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
}

interface Enrollment {
  id: number
  athlete_id: number
  program_id: number
  days_per_week: number
  selected_days: string[] | string
  athlete_user_id: number
  athlete_first_name: string
  athlete_last_name: string
  program_display_name: string
  program_name: string
}

interface ClassOffering {
  id?: number
  day_of_week: number
  start_time: string
  end_time: string
  name?: string
}

export default function AdminEnrollments() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [classOfferings, setClassOfferings] = useState<ClassOffering[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [allFamilyMembers, setAllFamilyMembers] = useState<Array<{
    id?: number
    user_id?: number
    first_name?: string
    firstName?: string
    last_name?: string
    lastName?: string
    family_id?: number
  }>>([])

  const apiUrl = getApiUrl()
  const adminToken = localStorage.getItem('adminToken')

  useEffect(() => {
    fetchPrograms()
    fetchAllFamilies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedProgram) {
      fetchEnrollmentsForProgram(selectedProgram.id)
      fetchClassOfferings()
    } else {
      setEnrollments([])
      setClassOfferings([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram])

  const fetchPrograms = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/programs?archived=false`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setPrograms((data.programs || data.data || []).filter((p: Program) => !p.archived && p.isActive))
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
    }
  }

  const fetchAllFamilies = async () => {
    try {
      // Fetch all athletes directly - they include all the data we need for enrollment
      const athletesResponse = await fetch(`${apiUrl}/api/admin/athletes`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      
      if (athletesResponse.ok) {
        const athletesData = await athletesResponse.json()
        const athletes = athletesData.data || athletesData.athletes || []
        
        // Convert athletes to family member format for enrollment
        const allMembers: Array<{
          id?: number
          user_id?: number
          first_name?: string
          firstName?: string
          last_name?: string
          lastName?: string
          family_id?: number
        }> = athletes.map((athlete: {
          id: number
          user_id?: number | null
          linked_user_id?: number | null
          first_name: string
          last_name: string
          family_id?: number | null
        }) => ({
          id: athlete.id,
          user_id: athlete.user_id || athlete.linked_user_id || undefined,
          first_name: athlete.first_name,
          last_name: athlete.last_name,
          family_id: athlete.family_id || undefined
        }))
        
        setAllFamilyMembers(allMembers)
      }
    } catch (error) {
      console.error('Error fetching athletes for enrollment:', error)
    }
  }

  const fetchEnrollmentsForProgram = async (programId: number) => {
    try {
      setEnrollmentsLoading(true)
      // For now, we'll need to fetch all enrollments and filter
      // TODO: Create backend endpoint to get enrollments by program
      const response = await fetch(`${apiUrl}/api/admin/athletes`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const athletes = data.data || data.athletes || []
        
        // Get enrollments for each athlete
        const allEnrollments: Enrollment[] = []
        for (const athlete of athletes) {
          try {
            const enrollmentsResponse = await fetch(`${apiUrl}/api/admin/athletes/${athlete.id}/enrollments`, {
              headers: {
                'Authorization': `Bearer ${adminToken}`
              }
            })
            if (enrollmentsResponse.ok) {
              const enrollmentsData = await enrollmentsResponse.json()
              const athleteEnrollments = enrollmentsData.data || []
              const programEnrollments = athleteEnrollments.filter((e: {
                program_id: number
                [key: string]: unknown
              }) => e.program_id === programId)
              allEnrollments.push(...programEnrollments.map((e: {
                id: number
                program_id: number
                days_per_week: number
                selected_days: string[] | string
                [key: string]: unknown
              }) => ({
                ...e,
                athlete_user_id: athlete.user_id,
                athlete_first_name: athlete.first_name,
                athlete_last_name: athlete.last_name
              })) as Enrollment[])
            }
          } catch (error) {
            console.error(`Error fetching enrollments for athlete ${athlete.id}:`, error)
          }
        }
        setEnrollments(allEnrollments)
      }
    } catch (error) {
      console.error('Error fetching enrollments:', error)
    } finally {
      setEnrollmentsLoading(false)
    }
  }

  const fetchClassOfferings = async () => {
    try {
      // TODO: Create backend endpoint to get class offerings for a program
      // For now, we'll show a placeholder or use enrollment days
      // The user mentioned they'll set up course offerings later
      setClassOfferings([])
    } catch (error) {
      console.error('Error fetching class offerings:', error)
    }
  }

  const handleEnroll = async (enrollmentData: {
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
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(enrollmentData)
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(data.message || 'Successfully enrolled member!')
        setShowEnrollModal(false)
        if (selectedProgram) {
          await fetchEnrollmentsForProgram(selectedProgram.id)
        }
        await fetchAllFamilies()
      } else {
        const errorData = await response.json()
        alert(errorData.message || 'Failed to enroll member')
      }
    } catch (error) {
      console.error('Error enrolling member:', error)
      alert('Failed to enroll member')
    }
  }

  const filteredPrograms = programs.filter(program => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
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

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-display font-bold text-black mb-6">
        Class Enrollments
      </h2>

      {/* Search Bar */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search classes by name, description, or requirements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent"
          />
        </div>
      </div>

      {/* Program Dropdown */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Select Class
        </label>
        <select
          value={selectedProgram?.id || ''}
          onChange={(e) => {
            const programId = parseInt(e.target.value, 10)
            const program = programs.find(p => p.id === programId)
            setSelectedProgram(program || null)
          }}
          className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
        >
          <option value="">Select a class...</option>
          {filteredPrograms.map(program => (
            <option key={program.id} value={program.id}>
              {program.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Class Details and Enrollments */}
      {selectedProgram && (
        <div className="space-y-6">
          {/* Class Information */}
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
            <h3 className="text-2xl font-display font-bold text-black mb-4">
              {selectedProgram.displayName}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              {selectedProgram.description && (
                <div className="md:col-span-2">
                  <span className="font-medium">Description:</span> {selectedProgram.description}
                </div>
              )}
              {selectedProgram.skillLevel && (
                <div>
                  <span className="font-medium">Skill Level:</span> {selectedProgram.skillLevel.replace('_', ' ')}
                </div>
              )}
              {(selectedProgram.ageMin !== null || selectedProgram.ageMax !== null) && (
                <div>
                  <span className="font-medium">Age Range:</span>{' '}
                  {selectedProgram.ageMin !== null ? selectedProgram.ageMin : 'Any'} - {selectedProgram.ageMax !== null ? selectedProgram.ageMax : 'Any'}
                </div>
              )}
              {selectedProgram.skillRequirements && (
                <div className="md:col-span-2">
                  <span className="font-medium">Requirements:</span> {selectedProgram.skillRequirements}
                </div>
              )}
            </div>
          </div>

          {/* Class Offerings (Days and Times) */}
          {classOfferings.length > 0 ? (
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
              <h3 className="text-xl font-display font-bold text-black mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Class Schedule
              </h3>
              <div className="space-y-2">
                {classOfferings.map((offering, index) => (
                  <div key={offering.id || index} className="bg-gray-50 p-3 rounded border border-gray-200">
                    <div className="font-medium">{dayNames[offering.day_of_week]}</div>
                    <div className="text-sm text-gray-600">
                      {offering.start_time} - {offering.end_time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
              <h3 className="text-xl font-display font-bold text-black mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Class Schedule
              </h3>
              <p className="text-gray-600">
                Class schedule details will be available once course offerings are configured.
              </p>
            </div>
          )}

          {/* Enrolled Members */}
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-display font-bold text-black flex items-center gap-2">
                <Users className="w-5 h-5" />
                Enrolled Members ({enrollments.length})
              </h3>
              <button
                onClick={() => setShowEnrollModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-vortex-red text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Enroll Member
              </button>
            </div>

            {enrollmentsLoading ? (
              <div className="text-center py-12 text-gray-600">Loading enrollments...</div>
            ) : enrollments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No members enrolled in this class yet.</div>
            ) : (
              <div className="space-y-3">
                {enrollments.map((enrollment) => {
                  const selectedDaysArray = Array.isArray(enrollment.selected_days) 
                    ? enrollment.selected_days 
                    : (typeof enrollment.selected_days === 'string' 
                        ? JSON.parse(enrollment.selected_days || '[]') 
                        : [])
                  
                  return (
                    <div key={enrollment.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-black mb-2">
                            {enrollment.athlete_first_name} {enrollment.athlete_last_name}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                            <div>
                              <span className="font-medium">Days Per Week:</span> {enrollment.days_per_week}
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
            )}
          </div>
        </div>
      )}

      {/* Enrollment Modal */}
      {showEnrollModal && selectedProgram && (
        <EnrollmentForm
          program={selectedProgram}
          familyMembers={allFamilyMembers
            .filter(m => (m.user_id || m.id) !== undefined)
            .map(m => ({
              id: (m.user_id || m.id) as number,
              first_name: m.first_name || m.firstName || '',
              last_name: m.last_name || m.lastName || '',
              user_id: m.user_id || m.id || undefined
            }))}
          onEnroll={handleEnroll}
          onCancel={() => setShowEnrollModal(false)}
          isOpen={showEnrollModal}
        />
      )}
    </div>
  )
}



