import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  adminDeleteOrphanedSignup,
  adminFetchSchedulingForm,
  adminReEnrollOrphanedSignup,
  type SchedulingFormDetail,
  type SchedulingFormSummary,
  type SchedulingOrphanedSignup,
  type SchedulingSlotGroup,
} from '../../utils/schedulingApi'

interface Props {
  orphanedSignups: SchedulingOrphanedSignup[]
  forms: SchedulingFormSummary[]
  onRefresh: () => Promise<void>
}

const statusLabel = (status: SchedulingOrphanedSignup['statusAtOrphaning']) => {
  if (status === 'confirmed') return 'Enrolled'
  if (status === 'waitlisted') return 'Waitlisted'
  return 'Cancelled'
}

const statusClass = (status: SchedulingOrphanedSignup['statusAtOrphaning']) => {
  if (status === 'confirmed') return 'bg-green-100 text-green-800'
  if (status === 'waitlisted') return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-700'
}

const formatSnapshotDates = (snapshot: SchedulingOrphanedSignup['orphanedSnapshot']) => {
  if (snapshot.activeStart && snapshot.activeEnd) {
    return `${snapshot.activeStart} – ${snapshot.activeEnd}`
  }
  if (snapshot.activeStart) return `From ${snapshot.activeStart}`
  if (snapshot.activeEnd) return `Until ${snapshot.activeEnd}`
  return null
}

const OrphanedSignupsPanel = ({ orphanedSignups, forms, onRefresh }: Props) => {
  const [reEnrollTarget, setReEnrollTarget] = useState<SchedulingOrphanedSignup | null>(null)
  const [targetFormId, setTargetFormId] = useState<number | null>(null)
  const [targetDetail, setTargetDetail] = useState<SchedulingFormDetail | null>(null)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [slotGroupId, setSlotGroupId] = useState<number | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeForms = forms.filter((f) => f.isActive)

  useEffect(() => {
    if (!reEnrollTarget) return
    setTargetFormId(reEnrollTarget.formId)
    setCategoryId(null)
    setSlotGroupId(null)
    setError(null)
  }, [reEnrollTarget])

  useEffect(() => {
    if (!targetFormId || !reEnrollTarget) {
      setTargetDetail(null)
      return
    }
    setLoadingDetail(true)
    setError(null)
    adminFetchSchedulingForm(targetFormId)
      .then((detail) => {
        setTargetDetail(detail)
        setCategoryId((prev) => {
          if (prev != null && detail.categories.some((c) => c.id === prev)) return prev
          return detail.categories[0]?.id ?? null
        })
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load form'))
      .finally(() => setLoadingDetail(false))
  }, [targetFormId, reEnrollTarget])

  useEffect(() => {
    setSlotGroupId(null)
  }, [categoryId, targetFormId])

  const groupsForCategory = (detail: SchedulingFormDetail, catId: number | null): SchedulingSlotGroup[] =>
    (detail.slotGroups ?? []).filter((g) => (g.categoryId ?? null) === catId)

  const slotOptions =
    targetDetail && categoryId !== undefined
      ? groupsForCategory(targetDetail, categoryId)
      : []

  const openReEnroll = (orphan: SchedulingOrphanedSignup) => {
    setReEnrollTarget(orphan)
    setError(null)
  }

  const closeModal = () => {
    setReEnrollTarget(null)
    setTargetFormId(null)
    setTargetDetail(null)
    setCategoryId(null)
    setSlotGroupId(null)
    setError(null)
  }

  const handleDelete = async (orphan: SchedulingOrphanedSignup) => {
    const name = [orphan.firstName, orphan.lastName].filter(Boolean).join(' ') || 'this athlete'
    if (
      !confirm(
        `Remove ${name} from the orphaned list? Their member profile will be kept; only this orphaned signup record is deleted.`,
      )
    ) {
      return
    }
    setDeletingId(orphan.id)
    setError(null)
    try {
      await adminDeleteOrphanedSignup(orphan.id)
      await onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove orphaned signup')
    } finally {
      setDeletingId(null)
    }
  }

  const handleReEnroll = async () => {
    if (!reEnrollTarget || !targetFormId || !slotGroupId) return
    setSubmitting(true)
    setError(null)
    try {
      await adminReEnrollOrphanedSignup(reEnrollTarget.id, {
        targetFormId,
        categoryId,
        slotGroupId,
      })
      closeModal()
      await onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to re-enroll')
    } finally {
      setSubmitting(false)
    }
  }

  if (orphanedSignups.length === 0) return null

  return (
    <>
      <div className="mt-8 border border-amber-200 rounded-xl overflow-hidden bg-amber-50/40">
        <div className="px-4 py-3 border-b border-amber-200 bg-amber-50">
          <h4 className="font-bold text-lg text-amber-950">Orphaned signups</h4>
          <p className="text-sm text-amber-800 mt-0.5">
            Athletes whose schedule was deleted. Re-enroll them in another slot when ready.
          </p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm align-top">
            <thead className="sticky top-0 z-10 bg-amber-50/95 backdrop-blur-sm">
              <tr className="text-left text-gray-600 border-b border-amber-100">
                <th className="py-2 px-4 pr-3">Athlete</th>
                <th className="py-2 pr-3">Contact</th>
                <th className="py-2 pr-3">Event form</th>
                <th className="py-2 pr-3">Orphaned slot</th>
                <th className="py-2 pr-3">Status at deletion</th>
                <th className="py-2 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orphanedSignups.map((orphan) => {
                const snapshot = orphan.orphanedSnapshot
                const dateRange = formatSnapshotDates(snapshot)
                return (
                  <tr key={orphan.id} className="border-b border-amber-100/80">
                    <td className="py-2 px-4 pr-3 font-medium text-black">
                      {[orphan.firstName, orphan.lastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">
                      <div>{orphan.email || '—'}</div>
                      {orphan.phone && <div className="text-gray-500">{orphan.phone}</div>}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">
                      {snapshot.formTitle || orphan.formTitle}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">
                      <div>{snapshot.slotLabel || '—'}</div>
                      {snapshot.categoryName && (
                        <div className="text-gray-500 text-xs">{snapshot.categoryName}</div>
                      )}
                      {dateRange && <div className="text-gray-500 text-xs">{dateRange}</div>}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusClass(orphan.statusAtOrphaning)}`}
                      >
                        {statusLabel(orphan.statusAtOrphaning)}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openReEnroll(orphan)}
                          className="text-sm text-blue-700 hover:text-blue-900 font-medium"
                        >
                          Re-enroll
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(orphan)}
                          disabled={deletingId === orphan.id}
                          className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                        >
                          {deletingId === orphan.id ? 'Removing…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {error && !reEnrollTarget && (
          <p className="px-4 pb-3 text-sm text-red-600">{error}</p>
        )}
      </div>

      {reEnrollTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-bold text-lg text-black">Re-enroll athlete</h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 text-gray-500 hover:text-gray-800"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                {[reEnrollTarget.firstName, reEnrollTarget.lastName].filter(Boolean).join(' ')}
                {reEnrollTarget.email ? ` (${reEnrollTarget.email})` : ''}
              </p>

              <label className="block text-sm">
                <span className="font-medium text-gray-700">Scheduling form</span>
                <select
                  value={targetFormId ?? ''}
                  onChange={(e) => setTargetFormId(Number(e.target.value))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {activeForms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </label>

              {loadingDetail && (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading slots…
                </p>
              )}

              {targetDetail && !loadingDetail && (
                <>
                  <label className="block text-sm">
                    <span className="font-medium text-gray-700">Category</span>
                    <select
                      value={categoryId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setCategoryId(v === '' ? null : Number(v))
                      }}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {targetDetail.categories.map((c) => (
                        <option key={c.id ?? 'none'} value={c.id ?? ''}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-gray-700">Slot</span>
                    <select
                      value={slotGroupId ?? ''}
                      onChange={(e) => setSlotGroupId(Number(e.target.value))}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select a slot…</option>
                      {slotOptions.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.displayLabel || `Slot #${g.id}`} ({g.signupCount}/{g.maxParticipants}
                          {(g.waitlistCount ?? 0) > 0 ? `, ${g.waitlistCount} waitlisted` : ''})
                        </option>
                      ))}
                    </select>
                  </label>

                  {slotOptions.length === 0 && (
                    <p className="text-sm text-amber-700">No active slots in this category.</p>
                  )}
                </>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReEnroll}
                disabled={submitting || !slotGroupId || loadingDetail}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm enrollment
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default OrphanedSignupsPanel
