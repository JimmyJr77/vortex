import { useCallback, useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  formatOfferingDates,
  formatSlotOccurrence,
  groupSlotsByOffering,
  loadClassSchedulingDetail,
  type ClassSchedulingDetail,
} from '../../utils/classSchedulingSummary'
import { formatDateForDisplay } from '../../utils/dateUtils'
import type { SchedulingCalendarEvent } from '../../utils/schedulingApi'

interface Props {
  event: SchedulingCalendarEvent
  onClose: () => void
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
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

const AdminCalendarEventModal = ({ event, onClose }: Props) => {
  const [detail, setDetail] = useState<ClassSchedulingDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const offeringSummary =
    event.offeringLabel ||
    (event.offeringStartDate && event.offeringEndDate
      ? `${formatDateForDisplay(event.offeringStartDate)} – ${formatDateForDisplay(event.offeringEndDate)}`
      : null)

  const categoryDetail = detail?.categories.find(
    (c) =>
      (event.categoryId == null && c.categoryId == null) ||
      c.categoryId === event.categoryId,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-display font-bold text-black">{event.className}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {formatDateForDisplay(event.date)} · {formatTime12(event.startTime)} –{' '}
              {formatTime12(event.endTime)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-6">
          <dl>
            <DetailRow label="Program" value={event.programName || '—'} />
            <DetailRow label="Category" value={event.categoryName || 'No Category'} />
            <DetailRow
              label="Status"
              value={
                event.formActive ? (
                  <span className="text-green-700 font-medium">Active on enroll pages</span>
                ) : (
                  <span className="text-gray-500">Inactive on enroll pages</span>
                )
              }
            />
            <DetailRow label="Skill level" value={formatSkillLevel(event.skillLevel)} />
            <DetailRow label="Age range" value={formatAgeRange(event.ageMin, event.ageMax)} />
            {event.weekLetter && (
              <DetailRow label="Week" value={`${event.weekLetter}-Week`} />
            )}
            {offeringSummary && <DetailRow label="Offering" value={offeringSummary} />}
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

              {categoryDetail && categoryDetail.offerings.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Offerings</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {categoryDetail.offerings.map((o) => (
                      <li key={o.id}>{formatOfferingDates(o)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {categoryDetail && categoryDetail.slotGroups.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Slots for this category</h4>
                  <ul className="text-sm text-gray-700 space-y-2">
                    {(() => {
                      const { byOffering, unassigned } = groupSlotsByOffering(
                        categoryDetail.offerings,
                        categoryDetail.slotGroups,
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
        </div>
      </div>
    </div>
  )
}

export default AdminCalendarEventModal
