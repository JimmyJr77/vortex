import { useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, X } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'
import { currentMonthInput, money, monthLabel } from './format'
import type {
  BillingDiscountComponent,
  BillingTransaction,
  CustomerBillingEnrollment,
  CustomerBillingMember,
  PriceAdjustment,
  PriceAdjustmentPreview,
} from './types'

interface EnrollmentCancellationPreview {
  effectiveDate: string
  lastActiveDate: string
  mode: 'immediate' | 'end_of_month' | 'specific_date'
  className: string
  currentResolvedPriceCents: number
  postedAmountCents: number
  creditCents: number
  remainingClasses: number
  creditRatio: number
}

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-billing-dialog-title"
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-5">
          <div>
            <h2 id="customer-billing-dialog-title" className="text-xl font-bold text-gray-950">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function percentLabel(amountValue: number | null | undefined) {
  if (amountValue == null || !Number.isFinite(Number(amountValue))) return null
  const percent = Number(amountValue) / 100
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`
}

function pricingComponentLabel(component: BillingDiscountComponent, { includeCode = true } = {}) {
  const percent = component.amountType === 'percent' ? percentLabel(component.amountValue) : null
  if (component.type === 'promo_code') {
    const code = includeCode && component.promoCode ? ` (${component.promoCode})` : ''
    const expiration = component.expiresOn || component.endsAt?.slice(0, 10)
    return `${percent ? `${percent} discount` : component.name}${code}${expiration ? ` · until ${expiration}` : ''}`
  }
  if (percent && component.type === 'spend_volume' && !component.name.startsWith(percent)) {
    return `${percent} ${component.name}`
  }
  return component.name
}

async function responseBody(response: Response) {
  return response.json().catch(() => ({}))
}

function newRequestKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${suffix}`
}

function defaultAdjustmentMonth(enrollment: CustomerBillingEnrollment) {
  const currentMonth = currentMonthInput()
  const enrollmentMonth = String(
    enrollment.enrollment_start_date || enrollment.created_at || '',
  ).slice(0, 7)
  return enrollmentMonth && enrollmentMonth > currentMonth ? enrollmentMonth : currentMonth
}

export function EnrollmentMemberReassignmentModal({
  enrollment,
  members,
  onClose,
  onSaved,
}: {
  enrollment: CustomerBillingEnrollment
  members: CustomerBillingMember[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [targetMemberId, setTargetMemberId] = useState<number | ''>('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestKey] = useState(() => newRequestKey('enrollment-member-swap'))
  const targetMember = members.find((member) => member.id === targetMemberId) ?? null

  const submit = async () => {
    if (!targetMember || targetMember.id === enrollment.memberId) return
    setWorking(true)
    setError(null)
    try {
      const response = await adminApiRequest(
        `/api/admin/customer-billing/enrollments/${enrollment.id}/member-swap`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': requestKey },
          body: JSON.stringify({ targetMemberId: targetMember.id }),
        },
      )
      const body = await responseBody(response)
      if (!response.ok) throw new Error(body.message || 'The family-member reassignment could not be saved.')
      onSaved(
        `${targetMember.name} is now assigned to ${enrollment.class_name || 'this class'}. The original enrollment date and all billing records were left unchanged.`,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The family-member reassignment could not be saved.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <ModalShell
      title="Reassign family member"
      subtitle={`${enrollment.class_name || 'Class'} · currently assigned to ${enrollment.memberName}`}
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
          <div className="font-semibold">Enrollment correction only</div>
          <p className="mt-1 text-teal-900">The selected family member will be treated as having been in this class since the original enrollment date. This does not change billing, discounts, payments, memberships, or the class schedule.</p>
        </div>
        <label className="block text-sm font-medium text-gray-700">
          Assign this class to
          <select
            aria-label="Family member for class reassignment"
            value={targetMemberId}
            onChange={(event) => { setTargetMemberId(event.target.value ? Number(event.target.value) : ''); setError(null) }}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
          >
            <option value="">Choose a family member</option>
            {members.map((member) => (
              <option key={member.id} value={member.id} disabled={member.id === enrollment.memberId}>
                {member.name}{member.id === enrollment.memberId ? ' (currently assigned)' : member.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-gray-500">The change is recorded in the account activity log without creating a financial entry.</p>
        {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} disabled={working} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={working || !targetMember || targetMember.id === enrollment.memberId} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 font-semibold text-white disabled:opacity-50">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm reassignment
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

export function PriceAdjustmentModal({
  enrollment,
  members,
  onClose,
  onSaved,
  onSwap,
  onMemberSwap,
}: {
  enrollment: CustomerBillingEnrollment
  members: CustomerBillingMember[]
  onClose: () => void
  onSaved: (message: string) => void
  onSwap?: (enrollment: CustomerBillingEnrollment) => void
  onMemberSwap?: (enrollment: CustomerBillingEnrollment) => void
}) {
  const assignedPromos = enrollment.priceAdjustments.filter(
    (adjustment) =>
      adjustment.status !== 'revoked' &&
      ['promo_code', 'legacy_discount'].includes(adjustment.kind),
  )
  const hasPendingSync = enrollment.priceAdjustments.some(
    (adjustment) => ['pending_sync', 'sync_failed'].includes(adjustment.status),
  )
  const [kind, setKind] = useState<'fixed_final_price' | 'promo_code'>(assignedPromos.length > 0 ? 'promo_code' : 'fixed_final_price')
  const [finalPrice, setFinalPrice] = useState((enrollment.adjustedCostCents / 100).toFixed(2))
  const [promoCode, setPromoCode] = useState('')
  const [effectiveFromMonth, setEffectiveFromMonth] = useState(defaultAdjustmentMonth(enrollment))
  const [effectiveThroughMonth, setEffectiveThroughMonth] = useState('')
  const [indefinite, setIndefinite] = useState(true)
  const [reason, setReason] = useState('')
  const [confirmSurcharge, setConfirmSurcharge] = useState(false)
  const [preview, setPreview] = useState<PriceAdjustmentPreview | null>(null)
  const [showCancellation, setShowCancellation] = useState(false)
  const [cancellationMode, setCancellationMode] = useState<'immediate' | 'end_of_month' | 'specific_date'>('end_of_month')
  const [cancellationDate, setCancellationDate] = useState(new Date().toISOString().slice(0, 10))
  const [cancellationReason, setCancellationReason] = useState('')
  const [cancellationPreview, setCancellationPreview] = useState<EnrollmentCancellationPreview | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finalPriceCents = Math.round(Number(finalPrice) * 100)
  const aboveList = kind === 'fixed_final_price' && Number.isFinite(finalPriceCents) && finalPriceCents > enrollment.classCostCents
  const payload = () => ({
    kind,
    finalPriceCents: kind === 'fixed_final_price' ? finalPriceCents : undefined,
    promoCode: kind === 'promo_code' ? promoCode.trim() : undefined,
    effectiveFromMonth,
    effectiveThroughMonth: kind === 'promo_code' || indefinite ? null : effectiveThroughMonth,
    reason: reason.trim(),
    confirmSurcharge: aboveList ? confirmSurcharge : false,
  })
  const invalidate = () => setPreview(null)
  const invalidateCancellation = () => setCancellationPreview(null)

  const previewChange = async () => {
    setWorking(true)
    setError(null)
    try {
      const response = await adminApiRequest(
        `/api/admin/customer-billing/enrollments/${enrollment.id}/price-adjustments/preview`,
        { method: 'POST', body: JSON.stringify(payload()) },
      )
      const body = await responseBody(response)
      if (!response.ok) throw new Error(body.message || 'Price preview failed.')
      setPreview(body.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Price preview failed.')
    } finally {
      setWorking(false)
    }
  }

  const applyChange = async () => {
    if (!preview) return
    setWorking(true)
    setError(null)
    try {
      const response = await adminApiRequest(
        `/api/admin/customer-billing/enrollments/${enrollment.id}/price-adjustments`,
        { method: 'POST', body: JSON.stringify(payload()) },
      )
      const body = await responseBody(response)
      if (!response.ok) throw new Error(body.message || 'Price change failed.')
      const status = body.data?.adjustment?.status
      onSaved(
        status === 'sync_failed'
          ? 'The price change was saved but is not active because Stripe synchronization failed. It is visible for retry and review.'
          : 'Enrollment price change applied successfully.',
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Price change failed.')
    } finally {
      setWorking(false)
    }
  }

  const removePromo = async (adjustment: PriceAdjustment) => {
    if (!reason.trim()) {
      setError('Enter an administrative reason before removing the discount code.')
      return
    }
    setWorking(true)
    setError(null)
    try {
      const response = await adminApiRequest(
        `/api/admin/customer-billing/price-adjustments/${adjustment.id}/revoke`,
        { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) },
      )
      const body = await responseBody(response)
      if (!response.ok) throw new Error(body.message || 'Discount code could not be removed.')
      onSaved(`${adjustment.promoCode || 'Tuition discount code'} removed successfully.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Discount code could not be removed.')
    } finally {
      setWorking(false)
    }
  }

  const cancellationPayload = () => ({
    mode: cancellationMode,
    effectiveDate: cancellationMode === 'specific_date' ? cancellationDate : undefined,
    reason: cancellationReason.trim(),
  })

  const previewCancellation = async () => {
    setWorking(true)
    setError(null)
    try {
      const response = await adminApiRequest(
        `/api/admin/customer-billing/enrollments/${enrollment.id}/cancellation/preview`,
        { method: 'POST', body: JSON.stringify(cancellationPayload()) },
      )
      const body = await responseBody(response)
      if (!response.ok) throw new Error(body.message || 'Cancellation preview failed.')
      setCancellationPreview(body.data)
      setPreview(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Cancellation preview failed.')
    } finally {
      setWorking(false)
    }
  }

  const applyCancellation = async () => {
    if (!cancellationPreview) return
    setWorking(true)
    setError(null)
    try {
      const response = await adminApiRequest(
        `/api/admin/customer-billing/enrollments/${enrollment.id}/cancellation`,
        { method: 'POST', body: JSON.stringify(cancellationPayload()) },
      )
      const body = await responseBody(response)
      if (!response.ok) throw new Error(body.message || 'Enrollment cancellation failed.')
      const creditCents = Number(body.data?.creditCents ?? cancellationPreview.creditCents)
      onSaved(
        creditCents > 0
          ? `Enrollment cancelled. A ${money(creditCents)} prorated account credit was recorded for unused classes.`
          : 'Enrollment cancellation was recorded. No prorated credit was needed.',
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enrollment cancellation failed.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <ModalShell
      title="Modify enrollment"
      subtitle={`${enrollment.memberName} · ${enrollment.class_name || 'Class'}`}
      onClose={onClose}
      wide
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          {onSwap ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
              <div className="font-semibold">Move to another class</div>
              <p className="mt-1 text-violet-800">Choose a replacement class and schedule. The account will preview any unused-class credit and new-class prorated cost before the move is applied.</p>
              <button type="button" onClick={() => onSwap(enrollment)} className="mt-3 rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100">
                Choose replacement class
              </button>
            </div>
          ) : null}
          {onMemberSwap && members.some((member) => member.id !== enrollment.memberId) ? (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
              <div className="font-semibold">Reassign family member</div>
              <p className="mt-1 text-teal-800">Correct who this class belongs to without changing any billing. The newly assigned family member is treated as having been enrolled since the original start date.</p>
              <button type="button" onClick={() => onMemberSwap(enrollment)} className="mt-3 rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100">
                Choose family member
              </button>
            </div>
          ) : null}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Standard price</span><strong>{money(enrollment.classCostCents)}</strong></div>
            {enrollment.automaticDiscountComponents.map((component, index) => (
              <div key={`${component.ruleId ?? component.name}-${index}`} className="mt-2 flex justify-between gap-4">
                <span className="text-gray-600">{pricingComponentLabel(component)}</span>
                <span className="shrink-0 text-emerald-700">−{money(component.amountCents)}</span>
              </div>
            ))}
            <div className="mt-3 flex justify-between border-t border-gray-200 pt-3"><span className="font-semibold text-gray-700">Current adjusted price</span><strong>{money(enrollment.adjustedCostCents)}</strong></div>
          </div>

          {assignedPromos.length > 0 ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <div className="font-semibold">Applied tuition codes</div>
              <div className="mt-3 space-y-2">
                {assignedPromos.map((adjustment) => (
                  <div key={adjustment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-white p-3">
                    <div>
                      <div className="font-semibold text-blue-950">{adjustment.promoCode || 'Tuition discount code'}</div>
                      <div className="mt-0.5 text-xs text-blue-700">
                        {monthLabel(adjustment.effectiveFromMonth)} – {monthLabel(adjustment.effectiveThroughMonth)} · {adjustment.status.replaceAll('_', ' ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removePromo(adjustment)}
                      disabled={working}
                      aria-label={`Remove tuition discount code ${adjustment.promoCode || adjustment.id}`}
                      className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50"
                    >
                      Remove code
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-gray-800">Adjustment type</legend>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setKind('fixed_final_price'); invalidate() }} className={`rounded-lg border px-3 py-2 text-sm font-medium ${kind === 'fixed_final_price' ? 'border-vortex-red bg-red-50 text-vortex-red' : 'border-gray-300 text-gray-700'}`}>Final monthly price</button>
              <button type="button" onClick={() => { setKind('promo_code'); invalidate() }} className={`rounded-lg border px-3 py-2 text-sm font-medium ${kind === 'promo_code' ? 'border-vortex-red bg-red-50 text-vortex-red' : 'border-gray-300 text-gray-700'}`}>Discount code</button>
            </div>
          </fieldset>

          {kind === 'fixed_final_price' ? (
            <label className="block text-sm font-medium text-gray-700">
              Final monthly price
              <div className="mt-1 flex rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-red-100">
                <span className="px-3 py-2 text-gray-500">$</span>
                <input type="number" min="0" step="0.01" value={finalPrice} onChange={(event) => { setFinalPrice(event.target.value); invalidate() }} className="min-w-0 flex-1 rounded-r-lg px-3 py-2 outline-none" />
              </div>
            </label>
          ) : (
            <label className="block text-sm font-medium text-gray-700">
              Tuition discount code
              <input value={promoCode} onChange={(event) => { setPromoCode(event.target.value.toUpperCase()); invalidate() }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 uppercase" placeholder="CODE" />
            </label>
          )}

          <div className={`grid gap-3 ${kind === 'fixed_final_price' ? 'sm:grid-cols-2' : ''}`}>
            <label className="text-sm font-medium text-gray-700">
              First billing month
              <input type="month" value={effectiveFromMonth} onChange={(event) => { setEffectiveFromMonth(event.target.value); invalidate() }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            {kind === 'fixed_final_price' ? <label className="text-sm font-medium text-gray-700">
              Final billing month
              <input type="month" value={effectiveThroughMonth} disabled={indefinite} onChange={(event) => { setEffectiveThroughMonth(event.target.value); invalidate() }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
            </label> : null}
          </div>
          {kind === 'fixed_final_price' ? <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={indefinite} onChange={(event) => { setIndefinite(event.target.checked); invalidate() }} className="rounded border-gray-300" />
            Continue indefinitely
          </label> : <p className="text-xs text-gray-500">The discount code’s configured validity dates determine its final eligible billing month.</p>}
          <label className="block text-sm font-medium text-gray-700">
            Administrative reason
            <textarea rows={3} value={reason} onChange={(event) => { setReason(event.target.value); invalidate() }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Required for the immutable audit trail" />
          </label>

          {aboveList ? (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <input type="checkbox" checked={confirmSurcharge} onChange={(event) => { setConfirmSurcharge(event.target.checked); invalidate() }} className="mt-0.5 rounded border-amber-400" />
              Confirm this final price is above the standard class price and should be treated as a surcharge.
            </label>
          ) : null}

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          {hasPendingSync ? <p className="text-xs text-amber-700">Retry or remove the pending price change before adding another one.</p> : null}
          <button type="button" onClick={() => void previewChange()} disabled={working || hasPendingSync} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-2.5 font-semibold text-white disabled:opacity-50">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Preview billing impact
          </button>

          <div className="border-t border-gray-200 pt-4">
            <button type="button" onClick={() => { setShowCancellation((value) => !value); setError(null) }} className="text-sm font-semibold text-red-700 hover:text-red-800">
              {showCancellation ? 'Keep enrollment' : 'Cancel or remove this class enrollment'}
            </button>
            {showCancellation ? (
              <div className="mt-3 space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-gray-800">
                <p>Cancellation preserves the class and financial history in the audit. Any unused, already billed classes become a linked account credit; posted charges are never rewritten.</p>
                <fieldset>
                  <legend className="mb-2 font-semibold">When should the cancellation take effect?</legend>
                  <label className="mb-2 flex items-start gap-2"><input type="radio" checked={cancellationMode === 'immediate'} onChange={() => { setCancellationMode('immediate'); invalidateCancellation() }} /><span><strong>Immediately</strong><span className="block text-xs text-gray-600">Stop the enrollment now and credit unused scheduled classes in the current month.</span></span></label>
                  <label className="mb-2 flex items-start gap-2"><input type="radio" checked={cancellationMode === 'end_of_month'} onChange={() => { setCancellationMode('end_of_month'); invalidateCancellation() }} /><span><strong>At the end of this month</strong><span className="block text-xs text-gray-600">Keep the athlete enrolled through this billing month; no next-month tuition will bill.</span></span></label>
                  <label className="flex items-start gap-2"><input type="radio" checked={cancellationMode === 'specific_date'} onChange={() => { setCancellationMode('specific_date'); invalidateCancellation() }} /><span><strong>On a specific date</strong><span className="block text-xs text-gray-600">Stop on that date and calculate a credit for the remaining scheduled classes.</span></span></label>
                </fieldset>
                {cancellationMode === 'specific_date' ? <label className="block font-medium">Cancellation effective date<input type="date" min={new Date().toISOString().slice(0, 10)} value={cancellationDate} onChange={(event) => { setCancellationDate(event.target.value); invalidateCancellation() }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2" /></label> : null}
                <label className="block font-medium">Administrative reason<textarea rows={2} value={cancellationReason} onChange={(event) => { setCancellationReason(event.target.value); invalidateCancellation() }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2" placeholder="Required for the immutable audit trail" /></label>
                <button type="button" onClick={() => void previewCancellation()} disabled={working} className="w-full rounded-lg bg-gray-950 px-4 py-2.5 font-semibold text-white disabled:opacity-50">Review cancellation and billing impact</button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-w-0">
          {cancellationPreview ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
                <div className="font-semibold">Cancellation billing impact</div>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-red-700">Effective date</dt><dd className="mt-1 font-bold">{cancellationPreview.effectiveDate}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-red-700">Prorated account credit</dt><dd className="mt-1 text-lg font-bold">{money(cancellationPreview.creditCents)}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-red-700">Already billed for this month</dt><dd className="mt-1 font-semibold">{money(cancellationPreview.postedAmountCents)}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-red-700">Unused scheduled classes</dt><dd className="mt-1 font-semibold">{cancellationPreview.remainingClasses}</dd></div>
                </dl>
                <p className="mt-3 text-xs text-red-800">The credit is linked to the existing class charge and reduces the household’s next collection. The enrollment itself is retained in the audit as cancelled.</p>
              </div>
              <button type="button" onClick={() => void applyCancellation()} disabled={working} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-3 font-semibold text-white disabled:opacity-50">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />} Confirm cancellation
              </button>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 p-3"><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Window</div><div className="mt-1 text-sm font-bold">{monthLabel(preview.effectiveFromMonth)} – {monthLabel(preview.effectiveThroughMonth)}</div></div>
                <div className="rounded-xl border border-gray-200 p-3"><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Retro adjustment</div><div className={`mt-1 text-lg font-bold ${preview.retroactiveDifferenceCents < 0 ? 'text-emerald-700' : ''}`}>{money(preview.retroactiveDifferenceCents)}</div></div>
                <div className="rounded-xl border border-gray-200 p-3"><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resulting balance</div><div className="mt-1 text-lg font-bold">{money(preview.resultingBalanceCents)}</div></div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Billing changes occur on month boundaries with no proration. Posted charges remain unchanged; differences become linked debit or credit entries. Stripe mode: <strong>{preview.stripePlan.mode.replaceAll('_', ' ')}</strong>.
              </div>
              <div className="max-h-[390px] overflow-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left text-gray-600">
                    <tr><th className="px-3 py-2">Month</th><th className="px-3 py-2 text-right">List</th><th className="px-3 py-2 text-right">Automatic</th><th className="px-3 py-2 text-right">Final</th><th className="px-3 py-2 text-right">Household</th><th className="px-3 py-2 text-right">Posted difference</th></tr>
                  </thead>
                  <tbody>
                    {preview.months.map((month) => (
                      <tr key={month.periodKey} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium">{monthLabel(month.periodKey)}</td>
                        <td className="px-3 py-2 text-right">{money(month.standardPriceCents)}</td>
                        <td className="px-3 py-2 text-right text-emerald-700">
                          <div>−{money(month.automaticDiscountCents)}</div>
                          {month.discountComponents.map((component, index) => <div key={`${component.ruleId ?? component.name}-${index}`} className="mt-1 text-[11px] text-gray-500">{pricingComponentLabel(component)} −{money(component.amountCents)}</div>)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">{money(month.adjustedCostCents)}</td>
                        <td className="px-3 py-2 text-right">{money(month.householdNetCents)}</td>
                        <td className={`px-3 py-2 text-right ${month.retroactiveDifferenceCents < 0 ? 'text-emerald-700' : month.retroactiveDifferenceCents > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{month.postedAmountCents == null ? 'Not posted' : money(month.retroactiveDifferenceCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => void applyChange()} disabled={working} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-vortex-red px-4 py-3 font-semibold text-white disabled:opacity-50">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Apply reviewed price change
              </button>
            </div>
          ) : (
            <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
              Enter the price, billing window, and reason, then preview every affected month before applying it.
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

export function CustomChargeModal({
  familyId,
  members,
  selectedMemberId,
  savedCardAvailable,
  onClose,
  onSaved,
}: {
  familyId: number
  members: CustomerBillingMember[]
  selectedMemberId: number | null
  savedCardAvailable: boolean
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [memberId, setMemberId] = useState(selectedMemberId == null ? '' : String(selectedMemberId))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [servicePeriodStart, setServicePeriodStart] = useState('')
  const [servicePeriodEnd, setServicePeriodEnd] = useState('')
  const [collectionMethod, setCollectionMethod] = useState<'checkout' | 'saved_card' | 'ledger_only'>('checkout')
  const [authorizationSource, setAuthorizationSource] = useState('phone')
  const [authorizationDate, setAuthorizationDate] = useState(new Date().toISOString().slice(0, 10))
  const [authorizationNote, setAuthorizationNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const [requestKey] = useState(() => newRequestKey('custom-charge'))

  const submit = async () => {
    const amountCents = Math.round(Number(amount) * 100)
    setWorking(true)
    setError(null)
    setFallbackUrl(null)
    try {
      const response = await adminApiRequest(`/api/admin/customer-billing/families/${familyId}/custom-charges`, {
        method: 'POST',
        headers: { 'Idempotency-Key': requestKey },
        body: JSON.stringify({
          memberId: memberId ? Number(memberId) : null,
          description: description.trim(),
          amountCents,
          servicePeriodStart: servicePeriodStart || null,
          servicePeriodEnd: servicePeriodEnd || null,
          collectionMethod,
          authorization: collectionMethod === 'saved_card'
            ? {
                source: authorizationSource,
                date: authorizationDate,
                note: authorizationNote.trim(),
                confirmed,
                confirmedAmountCents: amountCents,
              }
            : undefined,
        }),
      })
      const body = await responseBody(response)
      if (!response.ok) {
        const fallback = body.data?.fallback?.url ?? null
        if (fallback) setFallbackUrl(fallback)
        throw new Error(body.message || 'Custom charge failed.')
      }
      const message = collectionMethod === 'checkout'
        ? `Custom charge created. Secure payment link: ${body.data?.collection?.url}`
        : collectionMethod === 'saved_card'
          ? 'Custom charge created and paid successfully with the saved card.'
          : 'Custom ledger charge created and left outstanding.'
      onSaved(message)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Custom charge failed.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <ModalShell title="Bill a custom amount" subtitle="Creates an immutable household ledger charge before collection." onClose={onClose}>
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">Applies to
          <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
            <option value="">Household</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">Description
          <input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Private lesson, equipment fee, account correction…" />
        </label>
        <label className="block text-sm font-medium text-gray-700">Exact amount
          <div className="mt-1 flex rounded-lg border border-gray-300"><span className="px-3 py-2 text-gray-500">$</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); setConfirmed(false) }} className="min-w-0 flex-1 rounded-r-lg px-3 py-2 outline-none" /></div>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Service period start<input type="date" value={servicePeriodStart} onChange={(event) => setServicePeriodStart(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
          <label className="text-sm font-medium text-gray-700">Service period end<input type="date" value={servicePeriodEnd} onChange={(event) => setServicePeriodEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-gray-800">Collection method</legend>
          <div className="space-y-2">
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3"><input type="radio" name="collection" checked={collectionMethod === 'checkout'} onChange={() => setCollectionMethod('checkout')} className="mt-1" /><span><strong className="block text-sm">Secure Checkout link</strong><span className="text-xs text-gray-500">Customer-present payment; link expires in 24 hours.</span></span></label>
            <label className={`flex items-start gap-3 rounded-lg border p-3 ${savedCardAvailable ? 'border-gray-200' : 'border-gray-100 bg-gray-50 text-gray-400'}`}><input type="radio" name="collection" disabled={!savedCardAvailable} checked={collectionMethod === 'saved_card'} onChange={() => setCollectionMethod('saved_card')} className="mt-1" /><span><strong className="block text-sm">Charge saved card</strong><span className="text-xs">Requires authorization evidence for this exact amount.</span></span></label>
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3"><input type="radio" name="collection" checked={collectionMethod === 'ledger_only'} onChange={() => setCollectionMethod('ledger_only')} className="mt-1" /><span><strong className="block text-sm">Ledger only</strong><span className="text-xs text-gray-500">Leave the amount outstanding for later collection.</span></span></label>
          </div>
        </fieldset>

        {collectionMethod === 'saved_card' ? (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-2 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Record how the customer authorized this specific off-session charge.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">Authorization source<select value={authorizationSource} onChange={(event) => setAuthorizationSource(event.target.value)} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2"><option value="phone">Phone</option><option value="email">Email</option><option value="written">Written agreement</option><option value="in_person">In person</option></select></label>
              <label className="text-sm font-medium text-gray-700">Authorization date<input type="date" value={authorizationDate} onChange={(event) => setAuthorizationDate(event.target.value)} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" /></label>
            </div>
            <label className="block text-sm font-medium text-gray-700">Authorization note<textarea rows={2} value={authorizationNote} onChange={(event) => setAuthorizationNote(event.target.value)} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" placeholder="Who authorized it and the relevant context" /></label>
            <label className="flex items-start gap-2 text-sm font-medium text-amber-950"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5" /> I confirm authorization for exactly {money(Math.round(Number(amount || 0) * 100))} on this attempt.</label>
          </div>
        ) : null}

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {fallbackUrl ? <a href={fallbackUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white">Open secure fallback link <ExternalLink className="h-4 w-4" /></a> : null}
        <button type="button" onClick={() => void submit()} disabled={working || !description.trim() || !(Number(amount) > 0) || (collectionMethod === 'saved_card' && !confirmed)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-vortex-red px-4 py-3 font-semibold text-white disabled:opacity-50">
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create charge{collectionMethod === 'saved_card' ? ' and collect' : ''}
        </button>
      </div>
    </ModalShell>
  )
}

export function ModifyChargeModal({
  familyId,
  charge,
  onClose,
  onSaved,
}: {
  familyId: number
  charge: BillingTransaction
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [amount, setAmount] = useState((charge.amountCents / 100).toFixed(2))
  const [adjustmentKind, setAdjustmentKind] = useState<'manual_price' | 'discount_code'>('manual_price')
  const [promoCode, setPromoCode] = useState('')
  const [appliesTo, setAppliesTo] = useState<'current_term' | 'renewals'>('current_term')
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestKey] = useState(() => newRequestKey('billing-charge-adjustment'))
  const finalAmountCents = Math.round(Number(amount) * 100)
  const differenceCents = finalAmountCents - charge.amountCents
  const usingManualPrice = adjustmentKind === 'manual_price'
  const existingAnnotations = Array.isArray(charge.discountAnnotations)
    ? charge.discountAnnotations
    : Array.isArray(charge.details.discountAnnotations)
      ? charge.details.discountAnnotations as Array<{ label?: string; code?: string; amountCents?: number }>
      : []

  const submit = async () => {
    setWorking(true)
    setError(null)
    try {
      const response = await adminApiRequest(`/api/admin/customer-billing/families/${familyId}/charges/${charge.refId}/adjustments`, {
        method: 'POST',
        headers: { 'Idempotency-Key': requestKey },
        body: JSON.stringify({
          finalAmountCents: usingManualPrice ? finalAmountCents : null,
          promoCode: usingManualPrice ? null : promoCode.trim(),
          appliesTo,
          reason: reason.trim(),
        }),
      })
      const body = await responseBody(response)
      if (!response.ok) throw new Error(body.message || 'Bill modification failed.')
      if (appliesTo === 'renewals') {
        onSaved(body.data?.renewal?.syncStatus === 'synced'
          ? 'Future annual membership renewal pricing was updated in Stripe.'
          : 'Future annual membership renewal pricing was saved and will apply when the athlete renews.')
      } else {
        onSaved(differenceCents < 0 ? 'Bill reduced with a linked account credit.' : differenceCents > 0 ? 'Bill increased with a linked ledger debit.' : 'Bill already has that effective amount.')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bill modification failed.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <ModalShell title="Modify bill" subtitle={`${charge.description} · original bill ${money(charge.amountCents)}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">Current-term changes preserve the original bill and post a linked credit or debit. Renewal changes do not affect today’s account balance.</p>
        {existingAnnotations.length > 0 ? <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800"><strong className="block">Existing discounts and adjustments</strong><div className="mt-2 space-y-1 text-xs">{existingAnnotations.map((annotation, index) => { const amountCents = Number(annotation.amountCents ?? 0); return <div key={`${annotation.code ?? annotation.label ?? 'adjustment'}-${index}`}>{annotation.code ?? annotation.label ?? 'Adjustment'} · {amountCents < 0 ? '−' : '+'}{money(Math.abs(amountCents))}</div> })}</div></div> : null}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-gray-800">Change</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${usingManualPrice ? 'border-gray-950 bg-gray-50' : 'border-gray-200'}`}><input type="radio" name="annual-fee-change-kind" checked={usingManualPrice} onChange={() => setAdjustmentKind('manual_price')} className="mt-1" /><span><strong className="block text-sm">Set final price</strong><span className="text-xs text-gray-500">Enter the exact annual-fee amount, including $0.</span></span></label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${!usingManualPrice ? 'border-gray-950 bg-gray-50' : 'border-gray-200'}`}><input type="radio" name="annual-fee-change-kind" checked={!usingManualPrice} onChange={() => setAdjustmentKind('discount_code')} className="mt-1" /><span><strong className="block text-sm">Tuition discount code</strong><span className="text-xs text-gray-500">Validates a code configured for annual memberships.</span></span></label>
          </div>
        </fieldset>
        {usingManualPrice ? (
          <label className="block text-sm font-medium text-gray-700">Effective annual-fee amount
            <div className="mt-1 flex rounded-lg border border-gray-300"><span className="px-3 py-2 text-gray-500">$</span><input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="min-w-0 flex-1 rounded-r-lg px-3 py-2 outline-none" /></div>
          </label>
        ) : (
          <label className="block text-sm font-medium text-gray-700">Annual membership discount code
            <input value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 uppercase" placeholder="Enter code" autoCapitalize="characters" />
          </label>
        )}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-gray-800">Apply to</legend>
          <div className="space-y-2">
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${appliesTo === 'current_term' ? 'border-gray-950 bg-gray-50' : 'border-gray-200'}`}><input type="radio" name="annual-fee-apply-to" checked={appliesTo === 'current_term'} onChange={() => setAppliesTo('current_term')} className="mt-1" /><span><strong className="block text-sm">Current term</strong><span className="text-xs text-gray-500">Adjust this year’s existing annual-fee bill now.</span></span></label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${appliesTo === 'renewals' ? 'border-gray-950 bg-gray-50' : 'border-gray-200'}`}><input type="radio" name="annual-fee-apply-to" checked={appliesTo === 'renewals'} onChange={() => setAppliesTo('renewals')} className="mt-1" /><span><strong className="block text-sm">Future renewals</strong><span className="text-xs text-gray-500">Use this price or code on this athlete’s next annual auto-renewal; the yearly Stripe subscription is updated without proration.</span></span></label>
          </div>
        </fieldset>
        <label className="block text-sm font-medium text-gray-700">Reason<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Why this bill amount is being corrected" /></label>
        {usingManualPrice && appliesTo === 'current_term' && Number.isFinite(finalAmountCents) ? <div className="rounded-lg bg-gray-50 p-3 text-sm"><span className="text-gray-500">Ledger effect: </span><strong>{differenceCents < 0 ? `${money(Math.abs(differenceCents))} future credit` : differenceCents > 0 ? `${money(differenceCents)} additional amount due` : 'No change'}</strong></div> : null}
        {!usingManualPrice ? <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">The code is validated by the server against annual-membership rules, eligibility, dates, and redemption limits before it is applied.</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <button type="button" onClick={() => void submit()} disabled={working || !reason.trim() || (usingManualPrice ? !Number.isFinite(finalAmountCents) || finalAmountCents < 0 : !promoCode.trim())} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-3 font-semibold text-white disabled:opacity-50">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{appliesTo === 'renewals' ? ' Save renewal pricing' : ' Save bill modification'}</button>
      </div>
    </ModalShell>
  )
}

interface RefundPreview {
  remainingRefundableCents: number
  amountCents: number
  currentBalanceCents: number
  resultingBalanceCents: number
  ledgerTreatment: string
  relatedCharge: null | { id: number; description: string; amountCents: number }
}

export function RefundModal({
  familyId,
  payment,
  charges,
  onClose,
  onSaved,
}: {
  familyId: number
  payment: BillingTransaction
  charges: BillingTransaction[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [amount, setAmount] = useState((Math.abs(payment.amountCents) / 100).toFixed(2))
  const [ledgerTreatment, setLedgerTreatment] = useState<'reverse_charge' | 'return_overpayment'>('reverse_charge')
  const [relatedChargeId, setRelatedChargeId] = useState('')
  const [exceptionCategory, setExceptionCategory] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<RefundPreview | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestKey] = useState(() => newRequestKey('refund'))

  const payload = () => ({
    paymentId: payment.refId,
    amountCents: Math.round(Number(amount) * 100),
    ledgerTreatment,
    relatedChargeId: ledgerTreatment === 'reverse_charge' && relatedChargeId ? Number(relatedChargeId) : null,
    exceptionCategory,
    evidenceNote: evidenceNote.trim(),
    reason: reason.trim(),
  })
  const invalidate = () => setPreview(null)

  const requestPreview = async () => {
    setWorking(true)
    setError(null)
    try {
      const response = await adminApiRequest(`/api/admin/customer-billing/families/${familyId}/refunds/preview`, { method: 'POST', body: JSON.stringify(payload()) })
      const body = await responseBody(response)
      if (!response.ok) throw new Error(body.message || 'Refund preview failed.')
      setPreview(body.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Refund preview failed.')
    } finally {
      setWorking(false)
    }
  }

  const submit = async () => {
    if (!preview) return
    setWorking(true)
    setError(null)
    try {
      const response = await adminApiRequest(`/api/admin/customer-billing/families/${familyId}/refunds`, { method: 'POST', headers: { 'Idempotency-Key': requestKey }, body: JSON.stringify(payload()) })
      const body = await responseBody(response)
      if (!response.ok) throw new Error(body.message || 'Refund failed.')
      onSaved(`Refund #${body.data?.refund?.id ?? ''} submitted successfully.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Refund failed.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <ModalShell title="Refund card payment" subtitle={`Payment #${payment.refId} · ${money(Math.abs(payment.amountCents))}`} onClose={onClose}>
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">Refund amount<div className="mt-1 flex rounded-lg border border-gray-300"><span className="px-3 py-2 text-gray-500">$</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); invalidate() }} className="min-w-0 flex-1 rounded-r-lg px-3 py-2 outline-none" /></div></label>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-gray-800">Account treatment</legend>
          <div className="space-y-2">
            <label className="flex gap-3 rounded-lg border border-gray-200 p-3"><input type="radio" checked={ledgerTreatment === 'reverse_charge'} onChange={() => { setLedgerTreatment('reverse_charge'); invalidate() }} className="mt-1" /><span><strong className="block text-sm">Reverse or waive a related charge</strong><span className="text-xs text-gray-500">Creates an equal linked account credit so the refund does not make the service amount due again.</span></span></label>
            <label className="flex gap-3 rounded-lg border border-gray-200 p-3"><input type="radio" checked={ledgerTreatment === 'return_overpayment'} onChange={() => { setLedgerTreatment('return_overpayment'); invalidate() }} className="mt-1" /><span><strong className="block text-sm">Return unapplied overpayment</strong><span className="text-xs text-gray-500">Allowed only up to the household’s current credit balance.</span></span></label>
          </div>
        </fieldset>
        {ledgerTreatment === 'reverse_charge' ? (
          <label className="block text-sm font-medium text-gray-700">Related charge<select value={relatedChargeId} onChange={(event) => { setRelatedChargeId(event.target.value); invalidate() }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"><option value="">Select a charge</option>{charges.map((charge) => <option key={`${charge.entryKind}-${charge.refId}`} value={charge.refId}>#{charge.refId} · {charge.description} · {money(charge.amountCents)}</option>)}</select></label>
        ) : null}
        <label className="block text-sm font-medium text-gray-700">Approved exception<select value={exceptionCategory} onChange={(event) => { setExceptionCategory(event.target.value); invalidate() }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"><option value="">Select exception</option><option value="duplicate_charge">Duplicate charge</option><option value="vortex_cancellation">Vortex cancellation</option><option value="medical">Documented medical issue</option><option value="relocation">Relocation</option><option value="owner_discretion">Owner discretion</option></select></label>
        <label className="block text-sm font-medium text-gray-700">Reason<input value={reason} onChange={(event) => { setReason(event.target.value); invalidate() }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
        <label className="block text-sm font-medium text-gray-700">Evidence or approval note<textarea rows={3} value={evidenceNote} onChange={(event) => { setEvidenceNote(event.target.value); invalidate() }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
        {preview ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <div className="grid grid-cols-2 gap-3"><div><span className="block text-xs uppercase text-blue-700">Remaining refundable</span><strong>{money(preview.remainingRefundableCents)}</strong></div><div><span className="block text-xs uppercase text-blue-700">Balance after refund</span><strong>{money(preview.resultingBalanceCents)}</strong></div></div>
            <p className="mt-3">Funds return to the original card. {ledgerTreatment === 'reverse_charge' ? 'A linked credit will offset the refund in the account ledger.' : 'The returned overpayment will bring the credit balance toward zero.'}</p>
          </div>
        ) : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => void requestPreview()} disabled={working || !exceptionCategory || !evidenceNote.trim()} className="rounded-lg border border-gray-300 px-4 py-2.5 font-semibold disabled:opacity-50">Preview</button>
          <button type="button" onClick={() => void submit()} disabled={working || !preview} className="inline-flex items-center justify-center gap-2 rounded-lg bg-vortex-red px-4 py-2.5 font-semibold text-white disabled:opacity-50">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Refund original card</button>
        </div>
      </div>
    </ModalShell>
  )
}
