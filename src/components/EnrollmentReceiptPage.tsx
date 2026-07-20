import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'
import { getApiUrl } from '../utils/api'
import { trackEvent } from '../utils/analyticsClient'

type Status = 'loading' | 'success' | 'error'

type ReceiptPricing = {
  billingType?: 'recurring' | 'one_time' | null
  billingLabel?: string | null
  costUnit?: string | null
  totalSlots?: number | null
  nonDiscountedCents?: number | null
  discountCents?: number | null
  netCents?: number | null
  hoursPerSlotMonthly?: number | null
}

type ReceiptData = {
  athleteName?: string | null
  programName?: string | null
  slotLabel?: string | null
  status?: string | null
  selectedDays?: string[]
  pricing?: ReceiptPricing | null
}

function formatCents(cents?: number | null): string {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`
}

export default function EnrollmentReceiptPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const apiUrl = getApiUrl()

  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  const loadReceipt = useCallback(async () => {
    if (!token) {
      setStatus('error')
      setMessage('Missing registration receipt link.')
      return
    }
    try {
      const res = await fetch(`${apiUrl}/api/enrollment-receipt/${encodeURIComponent(token)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success !== true) {
        throw new Error(data.message || 'This registration receipt link is invalid or has expired.')
      }
      setReceipt(data.data || null)
      setStatus('success')
      trackEvent('registration_receipt_view', window.location.pathname, {
        properties: {
          program_name: data.data?.programName ?? undefined,
          enrollment_status: data.data?.status ?? undefined,
        },
      })
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Failed to load registration receipt.')
    }
  }, [apiUrl, token])

  useEffect(() => {
    void loadReceipt()
  }, [loadReceipt])

  const enrollmentStatus = receipt?.status === 'waitlisted' ? 'Waitlisted' : 'Confirmed'
  const selectedDays =
    receipt?.selectedDays && receipt.selectedDays.length > 0
      ? receipt.selectedDays.join(', ')
      : null
  const pricing = receipt?.pricing ?? null
  const priceSuffix = pricing?.billingType === 'recurring' ? '/mo' : ''

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full rounded-2xl bg-white border border-gray-200 p-8 space-y-5">
        {status === 'loading' && (
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 text-red-600 animate-spin mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Loading your registration receipt…</h1>
          </div>
        )}

        {status === 'success' && receipt && (
          <>
            <div className="text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
              <h1 className="text-2xl font-bold text-gray-900">Registration receipt</h1>
              <p className="text-sm text-gray-500">This page confirms your class enrollment details.</p>
            </div>

            <dl className="rounded-xl border border-gray-100 bg-gray-50/80 divide-y divide-gray-100 text-sm">
              {receipt.athleteName && (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500 shrink-0">Athlete</dt>
                  <dd className="font-medium text-gray-900 text-right">{receipt.athleteName}</dd>
                </div>
              )}
              {receipt.programName && (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500 shrink-0">Program</dt>
                  <dd className="font-medium text-gray-900 text-right">{receipt.programName}</dd>
                </div>
              )}
              {selectedDays && (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500 shrink-0">Days</dt>
                  <dd className="font-medium text-gray-900 text-right">{selectedDays}</dd>
                </div>
              )}
              {receipt.slotLabel && (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500 shrink-0">Schedule</dt>
                  <dd className="font-medium text-gray-900 text-right">{receipt.slotLabel}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-gray-500 shrink-0">Status</dt>
                <dd className="font-medium text-gray-900 text-right flex items-center justify-end gap-1.5">
                  {receipt.status === 'waitlisted' ? (
                    <Clock className="w-4 h-4 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  )}
                  {enrollmentStatus}
                </dd>
              </div>
            </dl>

            {pricing && (
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 text-sm">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Cost summary</span>
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                    {pricing.billingLabel || (pricing.billingType === 'recurring' ? 'Monthly (recurring)' : 'One-time')}
                  </span>
                </div>
                <dl className="divide-y divide-gray-100">
                  {pricing.totalSlots != null && pricing.totalSlots > 0 && (
                    <div className="flex justify-between gap-4 px-4 py-3">
                      <dt className="text-gray-500 shrink-0">Classes</dt>
                      <dd className="font-medium text-gray-900 text-right">{pricing.totalSlots}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-gray-500 shrink-0">Base cost</dt>
                    <dd className="font-medium text-gray-900 text-right">
                      {formatCents(pricing.nonDiscountedCents)}
                      {priceSuffix}
                    </dd>
                  </div>
                  {pricing.discountCents != null && pricing.discountCents > 0 && (
                    <div className="flex justify-between gap-4 px-4 py-3">
                      <dt className="text-gray-500 shrink-0">Discount</dt>
                      <dd className="font-medium text-green-700 text-right">
                        -{formatCents(pricing.discountCents)}
                        {priceSuffix}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-gray-700 font-semibold shrink-0">Total</dt>
                    <dd className="font-bold text-gray-900 text-right">
                      {formatCents(pricing.netCents)}
                      {priceSuffix}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <p className="text-xs text-center text-gray-500">
              If you did not authorize this registration, please contact Vortex Athletics right away.
            </p>
          </>
        )}

        {status === 'error' && (
          <div className="text-center space-y-4">
            <XCircle className="w-12 h-12 text-red-600 mx-auto" />
            <h1 className="text-2xl font-bold text-red-800">Receipt unavailable</h1>
            <p className="text-sm text-gray-600">{message}</p>
            <p className="text-xs text-gray-500">
              If your link expired, contact Vortex Athletics and we can resend your registration details.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
