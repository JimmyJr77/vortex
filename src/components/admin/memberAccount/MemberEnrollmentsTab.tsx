import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { adminFetchMemberPricingSummary, type MemberPricingSummary } from '../../../utils/schedulingApi'
import { formatTimeSince } from '../../../utils/dateUtils'
import type { MemberEnrollment } from './types'

function parseSelectedDays(value: MemberEnrollment['selectedDays'] | MemberEnrollment['selected_days']) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function money(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function MemberEnrollmentsTab({
  memberId,
  enrollments,
}: {
  memberId: number
  enrollments: MemberEnrollment[]
}) {
  const [pricing, setPricing] = useState<MemberPricingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const summary = await adminFetchMemberPricingSummary(memberId)
      setPricing(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduling enrollments')
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    void load()
  }, [load])

  const programEnrollments = enrollments ?? []
  const signupRows = pricing?.signupRows ?? []
  const preview = pricing?.preview

  return (
    <div className="space-y-6">
      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Program enrollments</h4>
        <p className="text-xs text-gray-500 mb-3">Classes and programs from the member portal enrollment system.</p>
        {programEnrollments.length === 0 ? (
          <p className="text-sm text-gray-400">No program enrollments on record.</p>
        ) : (
          <div className="space-y-2">
            {programEnrollments.map((enrollment) => {
              const days = parseSelectedDays(enrollment.selectedDays ?? enrollment.selected_days)
              const enrolledAt = enrollment.createdAt ?? enrollment.created_at
              return (
                <div key={enrollment.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                  <div className="font-medium text-gray-900">
                    {enrollment.programDisplayName ?? enrollment.program_display_name ?? 'Unknown program'}
                  </div>
                  <div className="text-gray-600 mt-0.5">
                    {(enrollment.daysPerWeek ?? enrollment.days_per_week ?? 0)} day
                    {(enrollment.daysPerWeek ?? enrollment.days_per_week) === 1 ? '' : 's'}/week
                    {days.length > 0 && ` · ${days.join(', ')}`}
                  </div>
                  {enrolledAt && (
                    <div className="text-xs text-gray-500 mt-1">Enrolled {formatTimeSince(enrolledAt)}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Scheduling registrations</h4>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading registrations…
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <>
            {preview?.existingClasses && preview.existingClasses.length > 0 && (
              <div className="space-y-2 mb-4">
                {preview.existingClasses.map((item) => (
                  <div key={item.id ?? `${item.formId}-${item.slotLabel}`} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                    <div className="font-medium text-gray-900">{item.formTitle}</div>
                    {item.slotLabel && <div className="text-gray-600">{item.slotLabel}</div>}
                    <div className="text-xs text-gray-500 mt-1 capitalize">{item.status || 'registered'}</div>
                  </div>
                ))}
              </div>
            )}

            {signupRows.length > 0 && (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Form / class</th>
                      <th className="px-3 py-2 font-semibold">Schedule</th>
                      <th className="px-3 py-2 font-semibold">Est. cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signupRows.map((row) => {
                      const totalCents = row.pricingBreakdown?.totals?.totalCents
                      return (
                        <tr key={row.id} className="border-t border-gray-100">
                          <td className="px-3 py-2">{row.formTitle || 'Registration'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.slotLabel || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {totalCents != null ? money(totalCents / 100) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!preview?.existingClasses?.length && signupRows.length === 0 && (
              <p className="text-sm text-gray-400">No scheduling registrations on record.</p>
            )}

            {preview?.hasPricing && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                <div className="flex justify-between font-semibold text-gray-900">
                  <span>Estimated monthly total</span>
                  <span>{money(preview.estimatedMonthlyTotal)}/mo</span>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <p className="text-xs text-gray-400 italic">
        Historical enrollments that were removed from the system are not retained separately. Active and scheduling records are shown above.
      </p>
    </div>
  )
}
