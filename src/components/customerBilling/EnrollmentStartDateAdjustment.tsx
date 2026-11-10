import { useState } from 'react'
import { adminApiRequest } from '../../utils/api'
import { money } from './format'
import type { CustomerBillingEnrollment } from './types'

type Preview = {
  previousDate: string
  firstBillingDate: string
  previewHash: string
  totalDifferenceCents: number
  nextFullBillingDate: string
  months: Array<{ periodKey: string; monthlyCents: number; remainingClasses: number | null; postedCents: number; amountCents: number; differenceCents: number }>
}

export default function EnrollmentStartDateAdjustment({ enrollment, working, setWorking, onSaved }: {
  enrollment: CustomerBillingEnrollment
  working: boolean
  setWorking: (working: boolean) => void
  onSaved: (message: string) => void
}) {
  const [date, setDate] = useState(enrollment.enrollment_start_date?.slice(0, 10) ?? '')
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | null>(null)
  const invalidate = () => { setPreview(null); setRequestKey(crypto.randomUUID()); setError(null) }
  const run = async (apply: boolean) => {
    setWorking(true)
    setError(null)
    try {
      const response = await adminApiRequest(`/api/admin/customer-billing/enrollments/${enrollment.id}/start-date${apply ? '' : '/preview'}`, {
        method: 'POST', headers: apply ? { 'Idempotency-Key': requestKey } : undefined,
        body: JSON.stringify({ firstBillingDate: date, reason: reason.trim(), ...(apply ? { previewHash: preview?.previewHash } : {}) }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || 'Start-date adjustment failed.')
      if (apply) onSaved(`First billing date updated. Account tuition adjusted by ${money(body.data.totalDifferenceCents)}.`)
      else setPreview(body.data)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Start-date adjustment failed.') }
    finally { setWorking(false) }
  }
  return <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
    <h3 className="font-semibold text-blue-950">Adjust enrollment start and first billing date</h3>
    <p className="text-blue-900">Correct a late start using the class’s scheduled sessions. This recalculates tuition owed and records an account credit or debit. Payments already made stay on the account.</p>
    <label className="block font-medium text-gray-700">First billing date
      <input type="date" value={date} disabled={working} onChange={event => { setDate(event.target.value); invalidate() }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2" />
    </label>
    <label className="block font-medium text-gray-700">Reason for start-date correction
      <textarea value={reason} disabled={working} onChange={event => { setReason(event.target.value); invalidate() }} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2" />
    </label>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <button type="button" disabled={working || !date || !reason.trim()} onClick={() => void run(false)} className="rounded-lg bg-gray-950 px-3 py-2 font-semibold text-white disabled:opacity-50">Review prorated amount</button>
    {preview && <div className="space-y-3 rounded-lg border border-blue-200 bg-white p-3">
      <p>Start: <strong>{preview.previousDate}</strong> → <strong>{preview.firstBillingDate}</strong></p>
      {preview.months.map(month => <div key={month.periodKey} className="border-t pt-2">
        <p className="font-semibold">{month.periodKey}</p>
        <p>Monthly tuition: {money(month.monthlyCents)}{month.remainingClasses == null ? '' : ` · ${month.remainingClasses} remaining scheduled classes`}</p>
        <p>Previously billed: {money(month.postedCents)} → Recalculated: <strong>{money(month.amountCents)}</strong></p>
      </div>)}
      <p className="font-semibold">{preview.totalDifferenceCents < 0 ? 'Account credit' : 'Additional tuition owed'}: {money(Math.abs(preview.totalDifferenceCents))}</p>
      <p className="text-xs text-gray-600">Proration uses up to four scheduled sessions per month. Existing overpayments become account credit; this action does not collect or refund a payment.</p>
      <button type="button" disabled={working} onClick={() => void run(true)} className="rounded-lg bg-vortex-red px-3 py-2 font-semibold text-white disabled:opacity-50">Apply reviewed date and tuition adjustment</button>
    </div>}
  </section>
}
