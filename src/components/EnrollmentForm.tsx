import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { getApiUrl } from '../utils/api'

interface Program {
  id: number
  displayName: string
  name: string
}

interface FamilyMember {
  id: number
  first_name: string
  last_name: string
  user_id?: number | null
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

interface EnrollmentFormProps {
  program: Program
  familyMembers: FamilyMember[]
  currentUserId?: number
  currentUserName?: string
  onEnroll: (data: {
    programId: number
    familyMemberId: number
    iterationId: number
    daysPerWeek: number
    selectedDays: string[]
  }) => Promise<void>
  onCancel: () => void
  isOpen: boolean
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function EnrollmentForm({
  program,
  familyMembers,
  currentUserId,
  currentUserName,
  onEnroll,
  onCancel,
  isOpen
}: EnrollmentFormProps) {
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState<number | null>(null)
  const [selectedIterationId, setSelectedIterationId] = useState<number | null>(null)
  const [iterations, setIterations] = useState<ClassIteration[]>([])
  const [iterationsLoading, setIterationsLoading] = useState(false)
  const [daysPerWeek, setDaysPerWeek] = useState<number>(1)
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const apiUrl = getApiUrl()

  const fetchIterations = async () => {
    try {
      setIterationsLoading(true)
      const response = await fetch(`${apiUrl}/api/admin/programs/${program.id}/iterations`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          const fetchedIterations: ClassIteration[] = data.data.map((iteration: {
            id: number
            programId?: number
            program_id?: number
            iterationNumber?: number
            iteration_number?: number
            daysOfWeek?: number[]
            days_of_week?: number[]
            startTime?: string
            start_time?: string
            endTime?: string
            end_time?: string
            durationType?: string
            duration_type?: string
            startDate?: string | null
            start_date?: string | null
            endDate?: string | null
            end_date?: string | null
          }) => ({
            id: iteration.id,
            programId: iteration.programId || iteration.program_id || 0,
            iterationNumber: iteration.iterationNumber || iteration.iteration_number || 0,
            daysOfWeek: iteration.daysOfWeek || iteration.days_of_week || [],
            startTime: iteration.startTime || iteration.start_time || '',
            endTime: iteration.endTime || iteration.end_time || '',
            durationType: iteration.durationType || iteration.duration_type || 'indefinite',
            startDate: iteration.startDate || iteration.start_date || null,
            endDate: iteration.endDate || iteration.end_date || null
          }))
          setIterations(fetchedIterations)
        }
      }
    } catch (error) {
      console.error('Error fetching iterations:', error)
    } finally {
      setIterationsLoading(false)
    }
  }

  // Fetch iterations when modal opens
  useEffect(() => {
    if (isOpen && program.id) {
      fetchIterations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, program.id])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFamilyMemberId(null)
      setSelectedIterationId(null)
      setDaysPerWeek(1)
      setSelectedDays([])
      setIsSubmitting(false)
    }
  }, [isOpen])

  // Reset selected days when iteration changes
  useEffect(() => {
    setSelectedDays([])
  }, [selectedIterationId])


  const selectedIteration = iterations.find(iter => iter.id === selectedIterationId)
  const availableDays = selectedIteration ? selectedIteration.daysOfWeek.map(dayNum => dayNames[dayNum]) : []

  const handleDayToggle = (day: string) => {
    if (!selectedIteration) return
    
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day))
    } else {
      if (selectedDays.length < daysPerWeek) {
        setSelectedDays([...selectedDays, day])
      } else {
        alert(`You can only select ${daysPerWeek} day(s)`)
      }
    }
  }

  const handleDaysPerWeekChange = (newValue: number) => {
    setDaysPerWeek(newValue)
    // If current selected days exceed new days per week, remove excess
    if (selectedDays.length > newValue) {
      setSelectedDays(selectedDays.slice(0, newValue))
    }
  }

  const handleSubmit = async () => {
    if (!selectedFamilyMemberId) {
      alert('Please select a family member')
      return
    }

    if (!selectedIterationId) {
      alert('Please select a class iteration')
      return
    }

    if (selectedDays.length === 0) {
      alert('Please select at least one day of the week')
      return
    }

    if (selectedDays.length !== daysPerWeek) {
      alert(`Please select exactly ${daysPerWeek} day(s) of the week`)
      return
    }

    setIsSubmitting(true)
    try {
      await onEnroll({
        programId: program.id,
        familyMemberId: selectedFamilyMemberId,
        iterationId: selectedIterationId,
        daysPerWeek: daysPerWeek,
        selectedDays: selectedDays
      })
      // Reset form
      setSelectedFamilyMemberId(null)
      setSelectedIterationId(null)
      setDaysPerWeek(1)
      setSelectedDays([])
    } catch (error) {
      console.error('Enrollment error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Combine current user with family members for enrollment
  const allMembers: Array<{id: number, name: string, isCurrentUser: boolean}> = []
  
  // Add current member if they're not already in familyMembers
  if (currentUserId && currentUserName) {
    const currentMemberInList = familyMembers.some(fm => 
      fm.user_id === currentUserId || fm.id === currentUserId
    )
    if (!currentMemberInList) {
      allMembers.push({
        id: currentUserId,
        name: currentUserName,
        isCurrentUser: true
      })
    }
  }
  
  // Add all family members
  familyMembers.forEach(member => {
    allMembers.push({
      id: member.user_id || member.id,
      name: `${member.first_name} ${member.last_name}`.trim(),
      isCurrentUser: false
    })
  })

  const formatTime = (time: string) => {
    if (!time) return ''
    // Handle both HH:MM:SS and HH:MM formats
    const parts = time.split(':')
    return `${parts[0]}:${parts[1]}`
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 relative my-8"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-display font-bold text-black mb-4">
          Enroll in {program.displayName}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Family Member
            </label>
            <select
              value={selectedFamilyMemberId || ''}
              onChange={(e) => setSelectedFamilyMemberId(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
            >
              <option value="">Select a family member...</option>
              {allMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} {member.isCurrentUser ? '(You)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Class Iteration
            </label>
            {iterationsLoading ? (
              <div className="text-center py-4 text-gray-600">Loading iterations...</div>
            ) : iterations.length === 0 ? (
              <div className="text-center py-4 text-gray-600">No class iterations available for this program.</div>
            ) : (
              <select
                value={selectedIterationId || ''}
                onChange={(e) => setSelectedIterationId(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
              >
                <option value="">Select an iteration...</option>
                {iterations.map((iteration) => {
                  const days = iteration.daysOfWeek.map(dayNum => dayNames[dayNum].slice(0, 3)).join(', ')
                  const timeRange = `${formatTime(iteration.startTime)} - ${formatTime(iteration.endTime)}`
                  return (
                    <option key={iteration.id} value={iteration.id}>
                      Iteration {iteration.iterationNumber}: {days} ({timeRange})
                    </option>
                  )
                })}
              </select>
            )}
            {selectedIteration && (
              <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">Schedule:</span>
                  <span>{selectedIteration.daysOfWeek.map(dayNum => dayNames[dayNum]).join(', ')}</span>
                </div>
                <div className="text-sm text-gray-600">
                  Time: {formatTime(selectedIteration.startTime)} - {formatTime(selectedIteration.endTime)}
                </div>
                {selectedIteration.durationType !== 'indefinite' && (
                  <div className="text-xs text-gray-500 mt-1">
                    {selectedIteration.durationType === '3_month_block' && selectedIteration.startDate && (
                      <>3-Month Block starting {new Date(selectedIteration.startDate).toLocaleDateString()}</>
                    )}
                    {selectedIteration.durationType === 'finite' && selectedIteration.startDate && selectedIteration.endDate && (
                      <>{new Date(selectedIteration.startDate).toLocaleDateString()} - {new Date(selectedIteration.endDate).toLocaleDateString()}</>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedIteration && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Days Per Week
                </label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => handleDaysPerWeekChange(Math.max(1, daysPerWeek - 1))}
                    className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={availableDays.length}
                    value={daysPerWeek}
                    onChange={(e) => handleDaysPerWeekChange(Math.max(1, Math.min(availableDays.length, parseInt(e.target.value, 10) || 1)))}
                    className="w-20 px-3 py-2 text-center border border-gray-300 rounded"
                  />
                  <button
                    type="button"
                    onClick={() => handleDaysPerWeekChange(Math.min(availableDays.length, daysPerWeek + 1))}
                    className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Select {daysPerWeek} day(s) from available days: {availableDays.join(', ')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Days ({formatTime(selectedIteration.startTime)} - {formatTime(selectedIteration.endTime)})
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {availableDays.map((day) => {
                    const isSelected = selectedDays.includes(day)
                    const isDisabled = !isSelected && selectedDays.length >= daysPerWeek
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDayToggle(day)}
                        disabled={isDisabled}
                        className={`px-3 py-2 rounded border transition-colors ${
                          isSelected
                            ? 'bg-vortex-red text-white border-vortex-red'
                            : isDisabled
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
                {selectedDays.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600">
                      Selected: {selectedDays.join(', ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      Time: {formatTime(selectedIteration.startTime)} - {formatTime(selectedIteration.endTime)}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedIterationId}
              className="flex-1 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Enrolling...' : 'Enroll'}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
