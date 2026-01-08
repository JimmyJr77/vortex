import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronDown, ChevronUp } from 'lucide-react'

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

interface EnrollmentFormProps {
  program: Program
  familyMembers: FamilyMember[]
  currentUserId?: number
  currentUserName?: string
  onEnroll: (data: {
    programId: number
    familyMemberId: number
    daysPerWeek: number
    selectedDays: string[]
  }) => Promise<void>
  onCancel: () => void
  isOpen: boolean
}

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
  const [daysPerWeek, setDaysPerWeek] = useState<number>(1)
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFamilyMemberId(null)
      setDaysPerWeek(1)
      setSelectedDays([])
      setIsSubmitting(false)
    }
  }, [isOpen])

  const handleDayToggle = (day: string) => {
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
        daysPerWeek: daysPerWeek,
        selectedDays: selectedDays
      })
      // Reset form
      setSelectedFamilyMemberId(null)
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

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative"
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
                max="7"
                value={daysPerWeek}
                onChange={(e) => handleDaysPerWeekChange(Math.max(1, Math.min(7, parseInt(e.target.value, 10) || 1)))}
                className="w-20 px-3 py-2 text-center border border-gray-300 rounded"
              />
              <button
                type="button"
                onClick={() => handleDaysPerWeekChange(Math.min(7, daysPerWeek + 1))}
                className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Select {daysPerWeek} day(s) below</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Days
            </label>
            <div className="grid grid-cols-5 gap-2">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayToggle(day)}
                  className={`px-3 py-2 rounded border transition-colors ${
                    selectedDays.includes(day)
                      ? 'bg-vortex-red text-white border-vortex-red'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  disabled={!selectedDays.includes(day) && selectedDays.length >= daysPerWeek}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
            {selectedDays.length > 0 && (
              <p className="text-xs text-gray-600 mt-2">
                Selected: {selectedDays.join(', ')}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
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


