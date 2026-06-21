import { useMemo, useState } from 'react'
import { Clock, Loader2, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatAgeRange, formatSkillLevel } from '../../utils/classDisplayUtils'
import { schedulingEnrollPath } from '../../utils/schedulingApi'
import type { ClassScheduleProgramGroup } from './classScheduleGroups'

interface ClassScheduleByClassPanelProps {
  groups: ClassScheduleProgramGroup[]
  loading: boolean
  mode: 'admin' | 'public'
  showFormActiveFilter?: boolean
  classFilterId: number | 'none'
}

const ClassScheduleByClassPanel = ({
  groups,
  loading,
  mode,
  showFormActiveFilter = false,
  classFilterId,
}: ClassScheduleByClassPanelProps) => {
  const [selectedOfferingKey, setSelectedOfferingKey] = useState<string | null>(null)

  const selectedOffering = useMemo(() => {
    if (!selectedOfferingKey) return null
    for (const program of groups) {
      for (const classGroup of program.classes) {
        const match = classGroup.offerings.find((offering) => offering.key === selectedOfferingKey)
        if (match) return match
      }
    }
    return null
  }, [groups, selectedOfferingKey])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading class schedule…
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">
          {classFilterId === 'none'
            ? 'No classes with signup times are available for this period.'
            : 'No scheduled offerings for this class in this period.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 w-full">
      {groups.map((program) => (
        <div
          key={program.key}
          className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 md:p-8 border-2 border-gray-200 w-full"
        >
          {program.programName && (
            <h3 className="text-2xl font-display font-bold text-vortex-red mb-6">
              {program.programName}
            </h3>
          )}

          <div className="space-y-8">
            {program.classes.map((classGroup) => {
              const selectedInClass = classGroup.offerings.some(
                (offering) => offering.key === selectedOfferingKey,
              )

              return (
                <div
                  key={classGroup.key}
                  className="border-l-4 border-vortex-red pl-4 md:pl-6 space-y-4"
                >
                  <div>
                    <h4 className="text-lg font-semibold text-black mb-2">{classGroup.className}</h4>
                    {classGroup.classDescription && (
                      <p className="text-gray-700 leading-relaxed mb-3">{classGroup.classDescription}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span>
                        <span className="font-medium text-gray-800">Age: </span>
                        {formatAgeRange(classGroup.ageMin, classGroup.ageMax)}
                      </span>
                      <span>
                        <span className="font-medium text-gray-800">Skill level: </span>
                        {formatSkillLevel(classGroup.skillLevel)}
                      </span>
                    </div>
                    {classGroup.skillRequirements && (
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium text-gray-800">Requirements: </span>
                        {classGroup.skillRequirements}
                      </p>
                    )}
                  </div>

                  <div>
                    <h5 className="text-sm font-semibold text-black mb-3">Class offerings:</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {classGroup.offerings.map((offering) => {
                        const isSelected = selectedOfferingKey === offering.key
                        const disabled = offering.inactive || (mode === 'public' && !offering.enrollVisible)
                        return (
                          <button
                            key={offering.key}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              if (disabled) return
                              setSelectedOfferingKey((current) =>
                                current === offering.key ? null : offering.key,
                              )
                            }}
                            className={`text-left rounded-xl border-2 p-3 transition-all ${
                              disabled
                                ? 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
                                : isSelected
                                  ? 'border-vortex-red bg-red-50'
                                  : 'border-gray-200 bg-white hover:border-gray-400'
                            }`}
                          >
                            {offering.offeringLabel && (
                              <p className="text-xs text-gray-500 mb-1">{offering.offeringLabel}</p>
                            )}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 font-bold text-black text-sm">
                                <Clock className="w-4 h-4 text-vortex-red shrink-0" />
                                {offering.occurrenceLabel}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                              <Users className="w-4 h-4" />
                              {offering.inactive && showFormActiveFilter
                                ? 'Inactive'
                                : offering.isFull
                                  ? `Full — join waitlist${offering.waitlistCount > 0 ? ` (${offering.waitlistCount} waiting)` : ''}`
                                  : `${offering.spotsRemaining} of ${offering.maxParticipants} spots left`}
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {mode === 'public' && selectedInClass && selectedOffering && (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Link
                          to={schedulingEnrollPath({
                            formId: selectedOffering.formId,
                            offeringId: selectedOffering.offeringId,
                            slotGroupId: selectedOffering.slotGroupId,
                            timeSlotId: selectedOffering.timeSlotId,
                          })}
                          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold text-sm text-white bg-vortex-red hover:bg-red-700 transition-colors"
                        >
                          Sign Up
                        </Link>
                        <button
                          type="button"
                          onClick={() => setSelectedOfferingKey(null)}
                          className="text-sm font-semibold text-vortex-red hover:underline"
                        >
                          Clear selection
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default ClassScheduleByClassPanel
