import { useEffect, useRef, useState } from 'react'
import type { PublicProgramOffered } from '../../utils/publicClassesApi'
import { storeFamilyEnrollmentSubmission, type MemberEnrollmentDraft } from '../../utils/memberEnrollmentDrafts'
import { programUsesWeeklyTierPricing } from '../../utils/weeklyTierPricing'
import { createEnrollmentCheckoutSession, fetchFamilyEnrollmentPreview, loginSchedulingAuthFromMemberSession,
  storePendingEnrollmentId, type FamilyEnrollmentBatch, type SignupOrderPreview } from '../../utils/schedulingApi'
import OrderPricingSummary from '../pricing/OrderPricingSummary'
import type { EnrollableMember } from './MemberClassesOfferedEnroll'

export default function FamilyEnrollmentCheckout({ memberToken, stripeEnabled, accountMemberId, programs, orders, onEdit, onComplete }: {
  memberToken: string
  stripeEnabled: boolean
  accountMemberId: number
  programs: PublicProgramOffered[]
  orders: Array<{ member: EnrollableMember; draft: MemberEnrollmentDraft }>
  onEdit: (memberId: number) => void
  onComplete: () => void
}) {
  const [promoCodes, setPromoCodes] = useState(() => [...new Set(orders.flatMap(order => order.draft.promoCodes))])
  const [promoInput, setPromoInput] = useState('')
  const [preview, setPreview] = useState<SignupOrderPreview | null>(null)
  const [batches, setBatches] = useState<FamilyEnrollmentBatch[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const requestKey = useRef(crypto.randomUUID())
  useEffect(() => {
    let cancelled = false
    setPreview(null)
    setError(null)
    requestKey.current = crypto.randomUUID()
    void (async () => {
      const prepared: FamilyEnrollmentBatch[] = []
      for (const { member, draft } of orders) {
        const firstFormId = draft.cart.find(item => item.formId)?.formId
          ?? programs.find(program => program.id === draft.cart[0]?.programsId)?.classes.find(cls => cls.formId)?.formId
        if (!firstFormId) throw new Error(`Select a class for ${member.label}.`)
        const session = await loginSchedulingAuthFromMemberSession(firstFormId, memberToken, member.id)
        const signups = draft.cart.map(item => {
          if (item.lineType === 'multi_class_pass') return { lineType: 'multi_class_pass' as const, programsId: item.programsId, packageId: item.packageId }
          const enrollmentStartDate = item.enrollmentStartDate || draft.enrollmentStartDate
          if (!enrollmentStartDate) throw new Error(`Select a start date for ${member.label}.`)
          return { lineType: 'slot' as const, formId: item.formId, slotGroupId: item.slotGroupId, timeSlotId: item.timeSlotId,
            enrollmentStartDate, useMultiClassPass: true,
            selectedPricingOptionKey: item.programsId && !programUsesWeeklyTierPricing(programs.find(p => p.id === item.programsId) ?? {})
              ? draft.selectedPricingByProgram[item.programsId] ?? item.selectedPricingOptionKey : undefined }
        })
        prepared.push({ signupAuthToken: session.signupAuthToken, signups, responses: {} })
      }
      const priced = await fetchFamilyEnrollmentPreview(memberToken, prepared, promoCodes)
      if (!cancelled) { setBatches(prepared); setPreview(priced) }
    })().catch(caught => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to price your family order.') })
    return () => { cancelled = true }
  }, [orders, programs, memberToken, promoCodes, attempt])

  const confirm = async () => {
    if (busy || !preview) return
    setBusy(true)
    setError(null)
    try {
      const result = await createEnrollmentCheckoutSession(memberToken, { familyBatches: batches, promoCodes, idempotencyKey: requestKey.current })
      if (result.url) {
        if (result.pendingEnrollmentId) {
          storePendingEnrollmentId(result.pendingEnrollmentId)
          storeFamilyEnrollmentSubmission(result.pendingEnrollmentId, accountMemberId, orders)
        }
        window.location.assign(result.url)
      } else if (result.alreadyCompleted || result.status === 'completed' || result.status === 'already_completed') onComplete()
      else if (result.requiresReview || result.status === 'quarantined') throw new Error('Your payment was received and needs staff review. Do not submit another payment.')
      else throw new Error('Unable to complete checkout. Your family’s selections are saved.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to complete checkout.') }
    finally { setBusy(false) }
  }
  return <section className="portal-panel space-y-5" aria-label="Family checkout">
    <h2 className="text-2xl font-bold">Review and pay for your family</h2>
    <p>All selected classes are included in one order and one payment.</p>
    {orders.map(({ member, draft }) => <div key={member.id} className="portal-panel rounded-lg border bg-white p-4">
      <div className="flex justify-between gap-3"><h3 className="font-semibold">{member.label}</h3>
        <button type="button" disabled={busy} className="text-vortex-red underline" onClick={() => onEdit(member.id)}>Edit classes</button></div>
      <ul>{draft.cart.map(item => <li key={item.cartKey}>{item.classLabel || item.packageLabel} {item.scheduleLabel && `· ${item.scheduleLabel}`} {item.lineType === 'slot' && `· starts ${item.enrollmentStartDate || draft.enrollmentStartDate}`}</li>)}</ul>
    </div>)}
    {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error} {!preview && <button onClick={() => setAttempt(value => value + 1)} className="ml-2 underline">Retry</button>}</div>}
    {!preview && !error && <p role="status">Calculating your family’s order…</p>}
    {preview && <OrderPricingSummary preview={preview} emphasizeCombinedTotal promoCodeSection={<div className="space-y-2">
      <label className="block">Discount / promo code<input className="ml-2 rounded border p-2" value={promoInput} disabled={busy} onChange={event => setPromoInput(event.target.value)} /></label>
      <button type="button" disabled={busy || !promoInput.trim()} onClick={() => { setPromoCodes(current => [...new Set([...current, promoInput.trim()])]); setPromoInput('') }}>Apply</button>
      {promoCodes.map(code => <button key={code} disabled={busy} className="ml-3 underline" onClick={() => setPromoCodes(current => current.filter(value => value !== code))}>Remove {code}</button>)}
    </div>} />}
    {!stripeEnabled && <p>Online checkout is currently unavailable. Your selections are saved.</p>}
    <button type="button" className="rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={busy || !preview || !stripeEnabled} onClick={() => void confirm()}>{busy ? 'Opening checkout…' : 'Confirm & pay'}</button>
  </section>
}
