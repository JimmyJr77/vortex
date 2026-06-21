import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserPlus, Users } from 'lucide-react'
import {
  formatOfferingDates,
  formatSlotOccurrence,
  groupSlotsByOffering,
  loadClassSchedulingDetail,
  type ClassSchedulingDetail,
} from '../../utils/classSchedulingSummary'
import type { SchedulingOffering, SchedulingSlotGroup } from '../../utils/schedulingApi'
import AdminClassOfferingSignupModal from './AdminClassOfferingSignupModal'

interface Props {
  classId: number
  className: string
  description?: string | null
  skillRequirements?: string | null
  skillLevelLabel?: string
  ageRangeLabel?: string
  storedActiveLabel?: string
  effectiveActiveLabel?: string
  schedulingFormId?: number | null
}

interface SignupTarget {
  offering: SchedulingOffering | null
  slotGroup: SchedulingSlotGroup
}

const SlotGroupsTable = ({
  slotGroups,
  onSignup,
}: {
  slotGroups: SchedulingSlotGroup[]
  onSignup: (group: SchedulingSlotGroup) => void
}) => {
  if (slotGroups.length === 0) {
    return <p className="text-gray-500 text-sm">No slots for this offering.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="py-2 pr-3">Schedule</th>
            <th className="py-2 pr-3">Capacity</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 w-10" />
          </tr>
        </thead>
        <tbody>
          {slotGroups.map((group) => (
            <tr key={group.id} className="border-b border-gray-100 align-top">
              <td className="py-2 pr-3">{formatSlotOccurrence(group)}</td>
              <td className="py-2 pr-3">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {group.signupCount}/{group.maxParticipants}
                </span>
              </td>
              <td className="py-2 pr-3">
                {group.isActive ? (
                  <span className="text-green-700 font-medium">Active</span>
                ) : (
                  <span className="text-gray-500">Inactive</span>
                )}
              </td>
              <td className="py-2">
                <button
                  type="button"
                  title="Sign someone up"
                  disabled={!group.isActive}
                  onClick={() => onSignup(group)}
                  className="p-1.5 rounded-lg text-vortex-red hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ClassSchedulingExpandPanel = ({
  classId,
  className,
  description,
  skillRequirements,
  skillLevelLabel,
  ageRangeLabel,
  storedActiveLabel,
  effectiveActiveLabel,
  schedulingFormId,
}: Props) => {
  const [detail, setDetail] = useState<ClassSchedulingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signupTarget, setSignupTarget] = useState<SignupTarget | null>(null)

  const reloadDetail = useCallback(() => {
    setLoading(true)
    setError(null)
    return loadClassSchedulingDetail(classId, schedulingFormId)
      .then((data) => {
        if (!data) {
          setError('No scheduling data found for this class.')
          setDetail(null)
          return
        }
        setDetail(data)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load scheduling details')
      })
      .finally(() => setLoading(false))
  }, [classId, schedulingFormId])

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

  const { byOffering, unassigned } = detail
    ? groupSlotsByOffering(detail.offerings, detail.slotGroups)
    : { byOffering: [], unassigned: [] }
  const hasSchedule = byOffering.length > 0 || unassigned.length > 0

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

      {(skillLevelLabel || ageRangeLabel || storedActiveLabel || effectiveActiveLabel) && (
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          {ageRangeLabel && <span>Age range: {ageRangeLabel}</span>}
          {skillLevelLabel && <span>Skill level: {skillLevelLabel}</span>}
          {storedActiveLabel && <span>Stored: {storedActiveLabel}</span>}
          {effectiveActiveLabel && <span>Effective: {effectiveActiveLabel}</span>}
        </div>
      )}

      <div className="border-t border-gray-200 pt-4">
        <div className="flex flex-wrap items-baseline gap-3 mb-2">
          <h4 className="font-bold text-gray-900">Offerings</h4>
          {detail && <span className="text-xs text-gray-500">Costs: {detail.costsLabel}</span>}
        </div>

        {loading && (
          <p className="text-gray-500 inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading offerings and slots…
          </p>
        )}

        {error && !loading && <p className="text-amber-800">{error}</p>}

        {detail && !loading && (
          <div className="space-y-4">
            {!hasSchedule ? (
              <p className="text-gray-500">No offerings configured yet.</p>
            ) : (
              <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                <div className="p-4 space-y-5">
                  {byOffering.map(({ offering, slotGroups }) => (
                    <div key={offering.id}>
                      <div className="font-semibold text-gray-900 mb-2">
                        {formatOfferingDates(offering)}
                        {offering.isSelected && (
                          <span className="ml-2 text-xs font-semibold text-green-700">
                            Selected
                          </span>
                        )}
                      </div>
                      <SlotGroupsTable
                        slotGroups={slotGroups}
                        onSignup={(group) =>
                          setSignupTarget({
                            offering,
                            slotGroup: group,
                          })
                        }
                      />
                    </div>
                  ))}

                  {unassigned.length > 0 && (
                    <div>
                      <div className="font-semibold text-gray-900 mb-2">Unassigned slots</div>
                      <SlotGroupsTable
                        slotGroups={unassigned}
                        onSignup={(group) =>
                          setSignupTarget({
                            offering: null,
                            slotGroup: group,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {signupTarget && detail && (
        <AdminClassOfferingSignupModal
          open={Boolean(signupTarget)}
          onClose={() => setSignupTarget(null)}
          onSuccess={() => reloadDetail()}
          formId={detail.formId}
          className={className}
          offering={signupTarget.offering}
          slotGroup={signupTarget.slotGroup}
        />
      )}
    </div>
  )
}

export default ClassSchedulingExpandPanel
