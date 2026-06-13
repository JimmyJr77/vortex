import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, Users } from 'lucide-react'
import {
  formatOfferingDates,
  formatSlotOccurrence,
  loadClassSchedulingDetail,
  type ClassSchedulingDetail,
} from '../../utils/classSchedulingSummary'

interface Props {
  classId: number
  className: string
  description?: string | null
  skillRequirements?: string | null
  skillLevelLabel?: string
  storedActiveLabel?: string
  effectiveActiveLabel?: string
  schedulingFormId?: number | null
}

const ClassSchedulingExpandPanel = ({
  classId,
  className,
  description,
  skillRequirements,
  skillLevelLabel,
  storedActiveLabel,
  effectiveActiveLabel,
  schedulingFormId,
}: Props) => {
  const [detail, setDetail] = useState<ClassSchedulingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)

    loadClassSchedulingDetail(classId, schedulingFormId)
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setError('No scheduling data found for this class.')
          return
        }
        setDetail(data)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load scheduling details')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [classId, schedulingFormId])

  const offeringCategories = detail?.categories.filter((c) => c.offerings.length > 0) ?? []

  return (
    <div className="p-6 bg-gray-50 border-t-2 border-vortex-red space-y-6 text-sm text-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className="font-semibold text-gray-900">Description</span>
          <p className="mt-1 whitespace-pre-wrap">{description || '—'}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-900">Skill requirements</span>
          <p className="mt-1 whitespace-pre-wrap">{skillRequirements || '—'}</p>
        </div>
      </div>

      {(skillLevelLabel || storedActiveLabel || effectiveActiveLabel) && (
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          {skillLevelLabel && <span>Skill level: {skillLevelLabel}</span>}
          {storedActiveLabel && <span>Stored: {storedActiveLabel}</span>}
          {effectiveActiveLabel && <span>Effective: {effectiveActiveLabel}</span>}
        </div>
      )}

      <div className="border-t border-gray-200 pt-4">
        <h4 className="font-bold text-gray-900 mb-2">Scheduling for {className}</h4>

        {loading && (
          <p className="text-gray-500 inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading offerings and slots…
          </p>
        )}

        {error && !loading && <p className="text-amber-800">{error}</p>}

        {detail && !loading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={detail.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
              >
                Sign someone up
                <ExternalLink className="w-4 h-4" />
              </a>
              <span className="text-xs text-gray-500">Costs: {detail.costsLabel}</span>
            </div>

            {offeringCategories.length === 0 ? (
              <p className="text-gray-500">No offerings configured yet.</p>
            ) : (
              <div className="space-y-3">
                {offeringCategories.map((category) => (
                  <div
                    key={`${category.categoryId ?? 'none'}`}
                    className="border border-gray-200 rounded-xl bg-white overflow-hidden"
                  >
                    <div className="px-4 py-2 bg-gray-100 font-semibold text-gray-900">
                      {category.categoryName}
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <span className="font-semibold text-gray-900 block mb-1">Offerings</span>
                        <ul className="space-y-1">
                          {category.offerings.map((offering) => (
                            <li key={offering.id} className="text-gray-700">
                              {formatOfferingDates(offering)}
                              {offering.isSelected && (
                                <span className="ml-2 text-xs font-semibold text-green-700">Selected</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {category.slotGroups.length > 0 && (
                        <div>
                          <span className="font-semibold text-gray-900 block mb-2">Time slots</span>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-gray-500 border-b">
                                  <th className="py-2 pr-3">Schedule</th>
                                  <th className="py-2 pr-3">Capacity</th>
                                  <th className="py-2">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {category.slotGroups.map((group) => (
                                  <tr key={group.id} className="border-b border-gray-100 align-top">
                                    <td className="py-2 pr-3">{formatSlotOccurrence(group)}</td>
                                    <td className="py-2 pr-3">
                                      <span className="inline-flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {group.signupCount}/{group.maxParticipants}
                                      </span>
                                    </td>
                                    <td className="py-2">
                                      {group.isActive ? (
                                        <span className="text-green-700 font-medium">Active</span>
                                      ) : (
                                        <span className="text-gray-500">Inactive</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ClassSchedulingExpandPanel
