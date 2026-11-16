import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import FamilySignupWizard from './FamilySignupWizard'
import { checkoutDropIn, fetchDropIns, registerDropIn, type DropInBenefits, type DropInSession } from '../../utils/dropInApi'
import { confirmAnnualMembershipCheckoutSession, createAnnualMembershipCheckoutSession, fetchAnnualMembershipOffer, type AnnualMembershipOffer } from '../../utils/schedulingApi'
import { getMemberSessionToken, persistMemberSession, PORTAL_SESSION_CHANGED, type PortalAccount } from '../../utils/portalSession'

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const membershipSettled = (status?: string) => status === 'completed' || status === 'already_active'

interface SignupResult {
  dropInMemberId?: number
  token?: string
  member?: PortalAccount
}

export default function DropInSignup({ session, onCancel }: { session: DropInSession; onCancel: () => void }) {
  const [params, setParams] = useSearchParams()
  const memberId = Number(params.get('athlete'))
  const hasAthlete = Number.isSafeInteger(memberId) && memberId > 0
  const membershipReturn = params.get('membership')
  const membershipSessionId = params.get('session_id')
  const [token, setToken] = useState(getMemberSessionToken)
  const [offer, setOffer] = useState<AnnualMembershipOffer | null>(null)
  const [benefits, setBenefits] = useState<DropInBenefits | null>(null)
  const [currentSession, setCurrentSession] = useState<DropInSession | null>(null)
  const [includeMembership, setIncludeMembership] = useState(false)
  const [useFreeTrial, setUseFreeTrial] = useState(params.get('trial') !== '0')
  const [promoCode, setPromoCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountCreated, setAccountCreated] = useState(false)
  const [reload, setReload] = useState(0)
  const [booking, setBooking] = useState<Awaited<ReturnType<typeof registerDropIn>> | null>(null)
  const actionPending = useRef(false)
  const [membershipVerified, setMembershipVerified] = useState(membershipReturn !== 'paid')

  useEffect(() => {
    const changed = () => setToken(getMemberSessionToken())
    window.addEventListener(PORTAL_SESSION_CHANGED, changed)
    return () => window.removeEventListener(PORTAL_SESSION_CHANGED, changed)
  }, [])

  useEffect(() => {
    if (!token || !hasAthlete) return
    let active = true
    setLoading(true)
    setBenefits(null)
    setMembershipVerified(membershipReturn !== 'paid')
    setError(null)
    const load = async () => {
      if (membershipReturn === 'paid') {
        if (!membershipSessionId) throw new Error('The membership payment reference is missing. Sign in to your billing account to check the payment before continuing.')
        const confirmed = await confirmAnnualMembershipCheckoutSession(token, { checkoutSessionId: membershipSessionId })
        if (!membershipSettled(confirmed.status)) throw new Error('Your membership payment is still being verified. Check again before completing this drop-in.')
      }
      const [membership, catalog] = await Promise.all([
        fetchAnnualMembershipOffer(token, memberId), fetchDropIns(memberId),
      ])
      if (!active) return
      if (membershipReturn === 'review' && !membership.active) {
        throw new Error('Your membership payment needs staff review before this drop-in can continue.')
      }
      if (membershipReturn === 'paid' && !membership.active) {
        throw new Error('This athlete’s membership is not active yet. Check again before completing this drop-in.')
      }
      setOffer(membership)
      setBenefits(catalog.benefits)
      setUseFreeTrial(current => current && catalog.benefits.trialAvailable)
      setCurrentSession(catalog.sessions.find(row => row.slotGroupId === session.slotGroupId && row.date === session.date) ?? null)
      setMembershipVerified(true)
    }
    void load().catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load your drop-in checkout.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, hasAthlete, memberId, membershipReturn, membershipSessionId, session.slotGroupId, session.date, reload])

  const completedAccount = (value: unknown) => {
    const result = value as SignupResult
    setAccountCreated(true)
    const selectedMemberId = Number(result.dropInMemberId)
    if (!Number.isSafeInteger(selectedMemberId) || selectedMemberId <= 0) {
      setError('Your account was created, but the athlete could not be selected. Sign in to your account to finish booking.')
      return
    }
    setParams(current => {
      const next = new URLSearchParams(current)
      next.set('athlete', String(selectedMemberId))
      return next
    }, { replace: true })
    if (result.token && result.member) {
      persistMemberSession(result.token, result.member)
      setToken(result.token)
    }
  }

  const dueCents = benefits && currentSession && (useFreeTrial || benefits.annualCreditsRemaining > 0 || benefits.adminCreditsRemaining > 0)
    ? 0 : currentSession?.totalCents ?? session.totalCents
  const unavailable = !currentSession || currentSession.isFull
  const ready = Boolean(benefits && offer && !loading && membershipVerified)
  const purchasingMembership = includeMembership && !offer?.active

  const pay = async (registration: Awaited<ReturnType<typeof registerDropIn>>) => {
    const checkout = await checkoutDropIn(registration.id)
    if (checkout.status === 'confirmed') setBooking({ ...registration, status: 'confirmed' })
    else if (checkout.url) window.location.assign(checkout.url)
    else throw new Error('Payment is still being confirmed. Check again in a moment.')
  }

  const holdMembershipForReview = () => {
    setMembershipVerified(false)
    setParams(current => {
      const next = new URLSearchParams(current)
      next.set('membership', 'review')
      next.set('trial', '0')
      return next
    }, { replace: true })
  }

  const completeDropIn = async () => {
    if (!token || !hasAthlete || !ready || actionPending.current) return
    actionPending.current = true
    setBusy(true)
    setError(null)
    try {
      if (booking?.status === 'payment_pending') {
        await pay(booking)
        return
      }
      // Check capacity immediately before any membership purchase or booking.
      const catalog = await fetchDropIns(memberId)
      const available = catalog.sessions.find(row => row.slotGroupId === session.slotGroupId && row.date === session.date)
      setBenefits(catalog.benefits)
      setCurrentSession(available ?? null)
      if (!available || (purchasingMembership && available.isFull)) throw new Error('This class is no longer available. Choose another date or time.')
      if (useFreeTrial && !catalog.benefits.trialAvailable) {
        setUseFreeTrial(false)
        setError('This athlete’s free trial is no longer available. Review the updated total before continuing.')
        return
      }
      if (purchasingMembership) {
        const returnUrl = new URL('/drop-in', window.location.origin)
        returnUrl.search = new URLSearchParams({ signupSlot: String(session.slotGroupId), signupDate: session.date, athlete: String(memberId), trial: '0' }).toString()
        const checkout = await createAnnualMembershipCheckoutSession(token, {
          memberId,
          successUrl: `${returnUrl.href}&membership=paid&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${returnUrl.href}&membership=cancelled`,
        })
        if (checkout.requiresReview || checkout.status === 'quarantined') {
          holdMembershipForReview()
          throw new Error('Your membership payment needs staff review before this drop-in can continue.')
        }
        if (checkout.url) {
          window.location.assign(checkout.url)
          return
        }
        if (!(checkout.free || checkout.alreadyCompleted || membershipSettled(checkout.status))) {
          holdMembershipForReview()
          throw new Error('Your membership has not been confirmed. Please try again.')
        }
        // A waived or already completed purchase still needs a fresh, verified offer.
        const activeOffer = await fetchAnnualMembershipOffer(token, memberId)
        if (!activeOffer.active) throw new Error('Your membership is not active yet. Please check again.')
        setOffer(activeOffer)
        setIncludeMembership(false)
        setUseFreeTrial(false)
        setReload(current => current + 1)
        return
      }
      const registration = await registerDropIn({ memberId, slotGroupId: session.slotGroupId, classDate: session.date,
        useFreeTrial, promoCode: useFreeTrial ? undefined : promoCode.trim() || undefined })
      if (registration.accountRequired) throw new Error('Please sign in again before completing this drop-in.')
      setBooking(registration)
      if (registration.status === 'payment_pending') {
        if (registration.totalCents > dueCents) {
          setError(`The updated drop-in total is ${money(registration.totalCents)}. Review it before paying.`)
          return
        }
        await pay(registration)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to finish your drop-in registration.')
    } finally {
      actionPending.current = false
      setBusy(false)
    }
  }

  if (!hasAthlete && !accountCreated) return <FamilySignupWizard mode="waivers-memberships" dropInSignup onComplete={completedAccount} onCancel={onCancel} />

  if (!token || !hasAthlete) return <section className="space-y-4">
    <h2 className="text-2xl font-bold">Continue your drop-in signup</h2>
    <p>Your account details and waivers are saved. Sign in to review membership options and finish payment.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <Link to={`?${new URLSearchParams({ ...Object.fromEntries(params), login: '1' })}`} className="inline-block rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white">Sign in to continue</Link>
  </section>

  if (booking?.status === 'confirmed') return <section className="space-y-4 text-center" aria-live="polite">
    <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
    <h2 className="text-2xl font-bold">Drop-in confirmed</h2>
    <p>{booking.benefitType === 'annual_credit' ? 'One annual member credit was applied. No payment is due for this class.'
      : booking.benefitType === 'free_trial' ? 'Your one-time free trial is confirmed. No payment is due.' : 'Your class registration is complete.'}</p>
    <button type="button" onClick={onCancel} className="rounded-lg border px-5 py-3 font-semibold">Back to classes</button>
  </section>

  return <section className="space-y-5" aria-busy={busy || loading}>
    <div><h2 className="text-2xl font-bold">Review your drop-in</h2><p className="mt-2 text-sm text-gray-600">Your account and waivers are complete. Choose your membership option, then finish payment. Your class is confirmed after payment or an eligible free credit is applied.</p></div>
    {membershipReturn === 'cancelled' && <p className="rounded-lg bg-amber-50 p-3 text-sm">Membership checkout was cancelled. You can try again or continue with the drop-in only.</p>}
    {membershipReturn === 'paid' && membershipVerified && offer?.active && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Your yearly membership is active. Your member benefits are included below.</p>}
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {loading && <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {membershipReturn === 'paid' ? 'Verifying membership and loading your benefits…' : 'Loading your payment options…'}</p>}
    {!loading && !ready && <button type="button" onClick={() => setReload(current => current + 1)} className="font-semibold text-vortex-red underline">Check again</button>}
    {ready && <>
      {!booking && <>
        <fieldset className="space-y-3 rounded-xl border border-gray-200 p-4" disabled={busy}>
          <legend className="px-1 font-bold">Yearly membership (optional)</legend>
          <p className="text-sm text-gray-600">Each athlete’s yearly membership includes 4 free drop-ins per membership year and member pricing on eligible classes. Membership lasts one year and renews annually. Class enrollments are purchased separately.</p>
          {offer?.active ? <p className="font-semibold text-green-700">Membership active · {benefits?.annualCreditsRemaining ?? 0} annual drop-in credits remaining</p>
            : <>
              <label className="flex gap-3 rounded-lg border p-3"><input type="radio" name="drop-in-membership" checked={!includeMembership} onChange={() => setIncludeMembership(false)} /><span><strong>Drop-in only</strong><span className="block text-sm text-gray-600">No yearly membership required.</span></span></label>
              {offer?.available ? <label className="flex gap-3 rounded-lg border p-3"><input type="radio" name="drop-in-membership" checked={includeMembership} onChange={() => { setIncludeMembership(true); setUseFreeTrial(false) }} /><span><strong>Add yearly membership</strong><span className="block text-sm text-gray-600">{money(offer.amountCents)} per year for this athlete. Pay for membership first, then apply an available credit to this drop-in.</span></span></label>
                : <p className="text-sm text-gray-600">Yearly membership is not available online right now. You can still book this drop-in.</p>}
            </>}
        </fieldset>
        {!purchasingMembership && benefits?.trialAvailable && <label className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4"><input type="checkbox" checked={useFreeTrial} disabled={busy} onChange={event => setUseFreeTrial(event.target.checked)} /><span><strong>Use my one-time free trial</strong><span className="block text-sm text-gray-600">Available once per athlete. No yearly membership required.</span></span></label>}
        {!purchasingMembership && !useFreeTrial && <label className="block text-sm font-semibold">Free-day code (optional)<input value={promoCode} disabled={busy} onChange={event => setPromoCode(event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>}
      </>}
      {unavailable && !booking && <p className="rounded-lg bg-amber-50 p-3 text-sm">{currentSession && !purchasingMembership
        ? 'This class currently shows as full. Check for an existing booking or choose another date or time.'
        : 'This class is no longer available. Choose another date or time.'}</p>}
      <div className="rounded-xl bg-gray-50 p-4 text-sm">
        {purchasingMembership ? <><div className="flex justify-between gap-3"><span>Yearly membership due today</span><strong>{money(offer?.amountCents ?? 0)}</strong></div><p className="mt-2 text-gray-600">Your drop-in will use a membership credit after membership payment is verified. Availability is checked again before the class is confirmed.</p></>
          : <><div className="flex justify-between gap-3"><span>Drop-in total</span><strong>{money(booking?.totalCents ?? dueCents)}</strong></div>{!useFreeTrial && !booking && (benefits?.annualCreditsRemaining ?? 0) > 0 && <p className="mt-2 text-gray-600">One annual member credit will be applied.</p>}{promoCode.trim() && <p className="mt-2 text-gray-600">Your free-day code will be validated before checkout.</p>}</>}
      </div>
      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border px-4 py-3 font-semibold">Back to classes</button>
        <button type="button" disabled={busy || (!booking && (!currentSession || (purchasingMembership && unavailable)))} onClick={() => void completeDropIn()} className="rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white disabled:opacity-60">
          {busy ? 'Processing…' : purchasingMembership ? 'Continue to payment' : !booking && currentSession?.isFull ? 'Check existing booking' : (booking?.totalCents ?? dueCents) > 0 ? `Pay ${money(booking?.totalCents ?? dueCents)}` : 'Confirm drop-in · $0'}
        </button>
      </div>
    </>}
  </section>
}
