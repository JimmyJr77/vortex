import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  formatOfferingDates,
  formatSlotOccurrence,
  groupSlotsByOffering,
  loadClassSchedulingDetail,
  type ClassSchedulingDetail,
} from '../../utils/classSchedulingSummary'
import { formatDateForDisplay } from '../../utils/dateUtils'
import { slotGroupHasMultipleWeekLetters, type CalendarCancellationNotifications, type SchedulingCalendarEvent } from '../../utils/schedulingApi'
import { formatTime12 } from './calendarDateUtils'
import CalendarCancellationEmail from './CalendarCancellationEmail'
import { cancellationDeliveryMessage } from '../../utils/calendarCancellationMessage'

interface Props {
  event: SchedulingCalendarEvent
  canManage: boolean
  onCancellationChange: (cancelled: boolean, emailBody?: string) => Promise<CalendarCancellationNotifications | undefined>
  onClose: () => void
}

function formatAgeRange(ageMin: number | null, ageMax: number | null): string {
  if (ageMin == null && ageMax == null) return '—'
  if (ageMin != null && ageMax != null) return `${ageMin}–${ageMax}`
  if (ageMin != null) return `${ageMin}+`
  return `Up to ${ageMax}`
}

function formatSkillLevel(level: string | null): string {
  if (!level) return '—'
  const words = level.replace(/_/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="grid grid-cols-[140px_1fr] gap-3 py-2 border-b border-gray-100 last:border-b-0">
    <dt className="text-sm font-medium text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900">{value}</dd>
  </div>
)

const AdminCalendarEventModal = ({ event, canManage, onCancellationChange, onClose }: Props) => {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [detail, setDetail] = useState<ClassSchedulingDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [emailBody, setEmailBody] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  const showWeekLetter = useMemo(() => {
    if (!event.weekLetter || !detail?.slotGroups?.length) return false
    const group = detail.slotGroups.find((g) => g.id === event.slotGroupId)
    if (!group) return false
    return slotGroupHasMultipleWeekLetters(group.occurrences)
  }, [event.slotGroupId, event.weekLetter, detail?.slotGroups])

  const loadDetail = useCallback(async () => {
    if (!event.classEventId) {
      setDetail(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await loadClassSchedulingDetail(event.classEventId, event.formId)
      setDetail(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load scheduling details')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [event.classEventId, event.formId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  const saveCancellation = async (cancelled: boolean) => {
    setSaving(true)
    setSaveError(null)
    try {
      const notifications = await onCancellationChange(cancelled, cancelled ? emailBody || undefined : undefined)
      setNotice(cancelled ? cancellationDeliveryMessage(notifications) : 'Class session restored.')
      setConfirmCancel(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Unable to update this class session.')
    } finally {
      setSaving(false)
    }
  }

  const offeringSummary =
    event.offeringLabel ||
    (event.offeringStartDate && event.offeringEndDate
      ? `${formatDateForDisplay(event.offeringStartDate)} – ${formatDateForDisplay(event.offeringEndDate)}`
      : null)

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="portal-dialog m-auto w-[calc(100%_-_2rem)] max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50"
      onCancel={(e) => { e.preventDefault(); if (!saving) onClose() }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className="flex max-h-[90vh] flex-col">
        <div className="portal-dialog-header flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
          <div>
            <h3 id={titleId} className="text-xl font-display font-bold text-black">{event.className}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {formatDateForDisplay(event.date)} · {formatTime12(event.startTime)} –{' '}
              {formatTime12(event.endTime)}
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="portal-dialog-close p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="portal-dialog-body overflow-y-auto px-6 py-4 space-y-6">
          {confirmCancel ? <>
            <p className="text-sm text-gray-700">This session will be cancelled and new bookings will be blocked. Affected parents will receive the message below.</p>
            <CalendarCancellationEmail date={event.date} slotId={event.timeSlotId} onChange={setEmailBody} disabled={saving} />
          </> : <>
          <dl>
            <DetailRow label="Program" value={event.programName || '—'} />
            {event.isTrialAssessment && <DetailRow label="Class type" value="Trial assessment" />}
            <DetailRow
              label="Session status"
              value={
                <span role="status" className={`font-medium ${event.isCancelled ? 'text-red-700' : 'text-gray-900'}`}>
                  {event.isCancelled ? 'Cancelled' : event.classActive ? 'Scheduled' : 'Inactive'}
                </span>
              }
            />
            {event.isCancelledByDay && (
              <DetailRow label="Day status" value="Full day cancelled" />
            )}
            <DetailRow
              label="Class status"
              value={
                event.classActive ? (
                  <span className="text-green-700 font-medium">Active</span>
                ) : (
                  <span className="text-gray-500">Inactive</span>
                )
              }
            />
            <DetailRow
              label="Enroll pages"
              value={
                event.formActive ? (
                  <span className="text-green-700 font-medium">Visible</span>
                ) : (
                  <span className="text-gray-500">Hidden</span>
                )
              }
            />
            <DetailRow label="Skill level" value={formatSkillLevel(event.skillLevel)} />
            <DetailRow label="Age range" value={formatAgeRange(event.ageMin, event.ageMax)} />
            {showWeekLetter && (
              <DetailRow label="Week" value={`${event.weekLetter}-Week`} />
            )}
            {offeringSummary && <DetailRow label="Active dates" value={offeringSummary} />}
          </dl>

          {event.classDescription && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Description</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {event.classDescription}
              </p>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading scheduling details…
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {detail && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Scheduling costs</h4>
                <p className="text-sm text-gray-700">{detail.costsLabel}</p>
              </div>

              {detail.offerings.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Active dates</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {detail.offerings.map((o) => (
                      <li key={o.id}>{formatOfferingDates(o)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.slotGroups.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Slots</h4>
                  <ul className="text-sm text-gray-700 space-y-2">
                    {(() => {
                      const { byOffering, unassigned } = groupSlotsByOffering(
                        detail.offerings,
                        detail.slotGroups,
                      )
                      const rows = [
                        ...byOffering.map(({ offering, slotGroups }) => ({
                          key: String(offering.id),
                          label: formatOfferingDates(offering),
                          slots: slotGroups.map((g) => formatSlotOccurrence(g)).join('; '),
                        })),
                        ...(unassigned.length > 0
                          ? [
                              {
                                key: 'unassigned',
                                label: 'Unassigned offering',
                                slots: unassigned.map((g) => formatSlotOccurrence(g)).join('; '),
                              },
                            ]
                          : []),
                      ]
                      return rows.map((row) => (
                        <li key={row.key}>
                          <span className="font-medium text-gray-800">{row.label}: </span>
                          {row.slots}
                        </li>
                      ))
                    })()}
                  </ul>
                </div>
              )}
            </div>
          )}
          </>}
        </div>
        {canManage && !event.isCancelledByDay && (
          <div className="portal-dialog-footer shrink-0 space-y-3 border-t border-gray-200 px-6 py-4">
            {confirmCancel && (
              <p className="text-sm text-gray-700">
                Cancel this session on {formatDateForDisplay(event.date)}? Existing registrations stay on file.
              </p>
            )}
            {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
            {notice && <p role="status" className="text-sm text-gray-700">{notice}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {confirmCancel && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => { setConfirmCancel(false); setSaveError(null) }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  Keep scheduled
                </button>
              )}
              <button
                type="button"
                disabled={saving || (confirmCancel && !emailBody?.trim())}
                onClick={() => {
                  if (event.isCancelled || confirmCancel) {
                    void saveCancellation(!event.isCancelled)
                  } else {
                    setEmailBody(null)
                    setNotice(null)
                    setConfirmCancel(true)
                  }
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                  event.isCancelled
                    ? 'border border-gray-300 text-gray-900 hover:bg-gray-50'
                    : 'bg-vortex-red text-white hover:bg-red-700'
                }`}
              >
                {event.isCancelled
                  ? (saving ? 'Restoring…' : 'Restore class')
                  : (saving ? 'Cancelling…' : confirmCancel ? 'Confirm cancellation' : 'Cancel class')}
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  )
}

export default AdminCalendarEventModal
