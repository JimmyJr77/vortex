import { useState, useEffect } from 'react'
import { UserPlus, Users, Clock } from 'lucide-react'
import { getApiUrl } from '../utils/api'
import EnrollmentForm from './EnrollmentForm'
import ClassDropdown, { type Program } from './ClassDropdown'

// Program interface is now imported from ClassDropdown

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

interface ClassIteration {
  id: number
  programId: number
  iterationNumber: number
  daysOfWeek: number[]
  startTime: string
  endTime: string
  durationType: string
  startDate?: string | null
  endDate?: string | null
}

export default function AdminEnrollments() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [classIterations, setClassIterations] = useState<ClassIteration[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const [iterationsLoading, setIterationsLoading] = useState(false)
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
    console.log('useEffect triggered, selectedProgram:', selectedProgram)
    if (selectedProgram) {
      console.log('Selected program ID:', selectedProgram.id)
      fetchEnrollmentsForProgram(selectedProgram.id)
      fetchClassOfferings()
    } else {
      console.log('No program selected, clearing data')
      setEnrollments([])
      setClassIterations([])
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
        const fetchedPrograms = (data.programs || data.data || []).filter((p: Program) => !p.archived && p.isActive)
        setPrograms(fetchedPrograms)
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
    if (!selectedProgram) {
      setClassIterations([])
      return
    }
    
    try {
      setIterationsLoading(true)
      console.log('Fetching iterations for program:', selectedProgram.id)
      
      // Note: AdminClasses doesn't use Authorization header for this endpoint
      const response = await fetch(`${apiUrl}/api/admin/programs/${selectedProgram.id}/iterations`)
      
      console.log('Iterations response status:', response.status, response.ok)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched iterations data:', data)
        
        if (data.success) {
          const fetchedIterations = data.data || []
          console.log('Fetched iterations array:', fetchedIterations)
          
          // Store full iteration data
          const iterations: ClassIteration[] = fetchedIterations.map((iteration: any) => ({
            id: iteration.id,
            programId: iteration.programId || iteration.program_id,
            iterationNumber: iteration.iterationNumber || iteration.iteration_number,
            daysOfWeek: iteration.daysOfWeek || iteration.days_of_week || [],
            startTime: iteration.startTime || iteration.start_time,
            endTime: iteration.endTime || iteration.end_time,
            durationType: iteration.durationType || iteration.duration_type,
            startDate: iteration.startDate || iteration.start_date || null,
            endDate: iteration.endDate || iteration.end_date || null
          }))
          
          console.log('Processed iterations:', iterations)
          setClassIterations(iterations)
        } else {
          console.log('API returned success: false:', data)
          setClassIterations([])
        }
      } else {
        // If we get a 500 error, it might mean the table doesn't exist yet
        // But iterations might still exist, so try to parse the response
        try {
          const errorData = await response.json()
          console.error('Failed to fetch iterations:', response.status, errorData)
        } catch {
          const errorText = await response.text()
          console.error('Failed to fetch iterations (non-JSON):', response.status, errorText)
        }
        setClassIterations([])
      }
    } catch (error) {
      console.error('Error fetching class offerings:', error)
      setClassIterations([])
    } finally {
      setIterationsLoading(false)
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

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-display font-bold text-black mb-6">
        Class Enrollments
      </h2>

      {/* Program Dropdown */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Select Class
        </label>
        <ClassDropdown
          value={selectedProgram?.id || null}
          onChange={(_programId, program) => {
            setSelectedProgram(program)
          }}
          programs={programs}
          filterActiveOnly={true}
          placeholder="Select a class..."
          className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
        />
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

          {/* Class Offerings (Iterations) */}
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
            <h3 className="text-xl font-display font-bold text-black mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Class Schedule
            </h3>
            {/* Debug info - remove in production */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mb-2 text-xs text-gray-500">
                Debug: Loading={iterationsLoading.toString()}, Count={classIterations.length}, ProgramID={selectedProgram.id}
              </div>
            )}
            {iterationsLoading ? (
              <div className="text-center py-8 text-gray-600">Loading class schedule...</div>
            ) : classIterations.length > 0 ? (
              <div className="space-y-4">
                {classIterations.map((iteration) => {
                  const days = iteration.daysOfWeek.map(day => dayNames[day]).join(', ')
                  const startTime = iteration.startTime.substring(0, 5) // Format HH:MM:SS to HH:MM
                  const endTime = iteration.endTime.substring(0, 5)
                  
                  let durationText = ''
                  if (iteration.durationType === 'indefinite') {
                    durationText = 'Indefinite'
                  } else if (iteration.durationType === '3_month_block') {
                    durationText = iteration.startDate 
                      ? `3-Month Block starting ${new Date(iteration.startDate).toLocaleDateString()}`
                      : '3-Month Block'
                  } else if (iteration.durationType === 'finite') {
                    if (iteration.startDate && iteration.endDate) {
                      durationText = `${new Date(iteration.startDate).toLocaleDateString()} - ${new Date(iteration.endDate).toLocaleDateString()}`
                    } else if (iteration.startDate) {
                      durationText = `Starting ${new Date(iteration.startDate).toLocaleDateString()}`
                    } else {
                      durationText = 'Finite duration'
                    }
                  }
                  
                  return (
                    <div key={iteration.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-black">
                          Iteration {iteration.iterationNumber}
                        </h4>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {iteration.durationType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-700">
                        <div>
                          <span className="font-medium">Days:</span> {days}
                        </div>
                        <div>
                          <span className="font-medium">Time:</span> {startTime} - {endTime}
                        </div>
                        {durationText && (
                          <div>
                            <span className="font-medium">Duration:</span> {durationText}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-600">
                No Class Offerings for this Class Found.
              </p>
            )}
          </div>

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



