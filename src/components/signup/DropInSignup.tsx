import { trackConfirmation, trackEvent } from '../../utils/analyticsClient'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import FamilySignupWizard from './FamilySignupWizard'
import DropInAthletePicker from './DropInAthletePicker'
import { checkoutDropIn, fetchDropIns, registerDropIn, type DropInBenefits, type DropInSession } from '../../utils/dropInApi'
import { confirmAnnualMembershipCheckoutSession, createAnnualMembershipCheckoutSession, fetchAnnualMembershipOffer, type AnnualMembershipOffer } from '../../utils/schedulingApi'
import { getMemberSessionToken, persistMemberSession, PORTAL_SESSION_CHANGED, type PortalAccount } from '../../utils/portalSession'
import { ADULT_BOOKING_PROGRAM, getScopedDropInProgram, isAdultBookingProgram } from '../../utils/publicBookingPrograms'

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const membershipSettled = (status?: string) => status === 'completed' || status === 'already_active'

interface SignupResult {
  dropInMemberId?: number
  token?: string
  member?: PortalAccount
}

export default function DropInSignup({ session, onCancel }: { session: DropInSession; onCancel: () => void }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const memberId = Number(params.get('athlete'))
  const hasAthlete = Number.isSafeInteger(memberId) && memberId > 0
  const [{ token, version }, setSession] = useState(() => ({ token: getMemberSessionToken(), version: 0 }))
  const [accountCreated, setAccountCreated] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
  const signInUrl = `?${new URLSearchParams({ ...Object.fromEntries(params), login: '1' })}`

  useEffect(() => {
    const changed = () => {
      const nextToken = getMemberSessionToken()
      setSession(current => nextToken === current.token ? current : { token: nextToken, version: current.version + 1 })
    }
    window.addEventListener(PORTAL_SESSION_CHANGED, changed)
    return () => window.removeEventListener(PORTAL_SESSION_CHANGED, changed)
  }, [])

  const chooseAthlete = (id: number, dropInOnly = false) => {
    setParams(current => {
      const next = new URLSearchParams(current)
      next.set('athlete', String(id))
      next.delete('login')
      return next
    }, { replace: true, state: { dropInOnly } })
  }

  const completedAccount = (value: unknown) => {
    const result = value as SignupResult
    setAccountCreated(true)
    const selectedMemberId = Number(result.dropInMemberId)
    if (!Number.isSafeInteger(selectedMemberId) || selectedMemberId <= 0) {
      setAccountError('Your account was created, but the athlete could not be selected. Sign in to finish booking.')
      return
    }
    chooseAthlete(selectedMemberId)
    if (result.token && result.member) {
      persistMemberSession(result.token, result.member)
    }
  }

  if (token && !hasAthlete) return <DropInAthletePicker key={version} token={token} session={session} signInUrl={signInUrl}
    onChoose={id => chooseAthlete(id, true)} onCancel={onCancel} />
  if (!hasAthlete && !accountCreated && params.get('login') !== '1') return <FamilySignupWizard mode="waivers-memberships" dropInSignup onComplete={completedAccount} onCancel={onCancel} />

  if (!token || !hasAthlete) return <section className="space-y-4">
    <h2 className="text-2xl font-bold">Continue your drop-in signup</h2>
    <p>Sign in to review your athlete’s membership options and finish booking.</p>
    {accountError && <p role="alert" className="text-red-700">{accountError}</p>}
    <div className="flex flex-wrap gap-3">
      <Link to={signInUrl} className="inline-block rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white">Sign in to continue</Link>
      <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-3 font-semibold">Back to classes</button>
    </div>
  </section>

  return <DropInCheckout key={`${version}:${memberId}`} memberId={memberId} token={token} session={session} onCancel={onCancel}
    allowMembershipPurchase={location.state?.dropInOnly !== true}
    onChangeAthlete={() => {
      setParams(current => {
        const next = new URLSearchParams(current)
        next.delete('athlete')
        next.delete('trial')
        return next
      }, { replace: true })
    }} />
}

function DropInCheckout({ memberId, token, session, onCancel, onChangeAthlete, allowMembershipPurchase }: {
  memberId: number
  token: string
  session: DropInSession
  onCancel: () => void
  onChangeAthlete: () => void
  allowMembershipPurchase: boolean
}) {
  const [params, setParams] = useSearchParams()
  const membershipReturn = params.get('membership')
  const membershipSessionId = params.get('session_id')
  const [offer, setOffer] = useState<AnnualMembershipOffer | null>(null)
  const [benefits, setBenefits] = useState<DropInBenefits | null>(null)
  const [currentSession, setCurrentSession] = useState<DropInSession | null>(null)
  const [includeMembership, setIncludeMembership] = useState(false)
  const [useFreeTrial, setUseFreeTrial] = useState(params.get('trial') !== '0')
  const [promoCode, setPromoCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [booking, setBooking] = useState<Awaited<ReturnType<typeof registerDropIn>> | null>(null)
  const actionPending = useRef(false)
  const [membershipVerified, setMembershipVerified] = useState(membershipReturn !== 'paid')

  useEffect(() => {
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
        allowMembershipPurchase ? fetchAnnualMembershipOffer(token, memberId) : null, fetchDropIns(memberId),
      ])
      if (!active) return
      if (membershipReturn === 'review' && !membership?.active) {
        throw new Error('Your membership payment needs staff review before this drop-in can continue.')
      }
      if (membershipReturn === 'paid' && !membership?.active) {
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
  }, [token, memberId, membershipReturn, membershipSessionId, session.slotGroupId, session.date, reload, allowMembershipPurchase])

  const trialAvailable = Boolean(currentSession && currentSession.allowsFreeTrial !== false && benefits?.trialAvailable)
  const trialSelected = trialAvailable && useFreeTrial
  const dueCents = benefits && currentSession && (trialSelected || benefits.annualCreditsRemaining > 0 || benefits.adminCreditsRemaining > 0)
    ? 0 : currentSession?.totalCents ?? session.totalCents
  const unavailable = !currentSession || currentSession.isFull
  const ready = Boolean(benefits && (!allowMembershipPurchase || offer) && !loading && membershipVerified)
  const purchasingMembership = allowMembershipPurchase && includeMembership && !offer?.active

  const pay = async (registration: Awaited<ReturnType<typeof registerDropIn>>) => {
    trackEvent('drop_in_checkout_start', '/drop-in')
    const checkout = await checkoutDropIn(registration.id)
    if (checkout.status === 'confirmed') {
      trackConfirmation('drop_in_confirmed', '/drop-in', registration.id)
      setBooking({ ...registration, status: 'confirmed' })
    }
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
    if (!ready || actionPending.current) return
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
      if (trialSelected && (available.allowsFreeTrial === false || !catalog.benefits.trialAvailable)) {
        setUseFreeTrial(false)
        setError(available.allowsFreeTrial === false
          ? 'Free trials are no longer available for this class time. Review the updated total before continuing.'
          : 'This athlete’s free trial is no longer available. Review the updated total before continuing.')
        return
      }
      if (purchasingMembership) {
        const returnUrl = new URL('/drop-in', window.location.origin)
        returnUrl.searchParams.set('signupSlot', String(session.slotGroupId))
        returnUrl.searchParams.set('signupDate', session.date)
        returnUrl.searchParams.set('athlete', String(memberId))
        returnUrl.searchParams.set('trial', '0')
        const program = getScopedDropInProgram(params.get('program')) ?? (isAdultBookingProgram(session.programName) ? ADULT_BOOKING_PROGRAM : null)
        if (program) returnUrl.searchParams.set('program', program)
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
        useFreeTrial: trialSelected, promoCode: trialSelected ? undefined : promoCode.trim() || undefined })
      if (registration.accountRequired) throw new Error('Please sign in again before completing this drop-in.')
      setBooking(registration)
      if (registration.status === 'confirmed') trackConfirmation('drop_in_confirmed', '/drop-in', registration.id)
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

  if (booking?.status === 'confirmed') return <section className="space-y-4 text-center" aria-live="polite">
    <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
    <h2 className="text-2xl font-bold">Drop-in confirmed</h2>
    <p>{booking.benefitType === 'annual_credit' ? 'One annual member credit was applied. No payment is due for this class.'
      : booking.benefitType === 'free_trial' ? 'Your one-time free trial is confirmed. No payment is due.' : 'Your class registration is complete.'}</p>
    <button type="button" onClick={onCancel} className="rounded-lg border px-5 py-3 font-semibold">Back to classes</button>
  </section>

  return <section className="space-y-5" aria-busy={busy || loading}>
    <div><h2 className="text-2xl font-bold">Review your drop-in</h2><p className="mt-2 text-sm text-gray-600">Review your athlete’s price and membership options. Booking requires current waivers and payment or an eligible free credit.</p></div>
    {membershipReturn === 'cancelled' && <p className="rounded-lg bg-amber-50 p-3 text-sm">Membership checkout was cancelled. You can try again or continue with the drop-in only.</p>}
    {membershipReturn === 'paid' && membershipVerified && offer?.active && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Your yearly membership is active. Your member benefits are included below.</p>}
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
      {error}
      {/required waivers must be signed/i.test(error) && <>{' '}<a href="/waivers-memberships" target="_blank" rel="noopener" className="font-semibold underline">Review and sign waivers</a>, then return here to continue.</>}
    </div>}
    {loading && <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {membershipReturn === 'paid' ? 'Verifying membership and loading your benefits…' : 'Loading your payment options…'}</p>}
    {!loading && !ready && <button type="button" onClick={() => setReload(current => current + 1)} className="font-semibold text-vortex-red underline">Check again</button>}
    {!booking && !membershipReturn && <button type="button" disabled={busy} onClick={onChangeAthlete} className="font-semibold text-vortex-red underline">Change athlete</button>}
    {ready && <>
      {!booking && <>
        {allowMembershipPurchase && <fieldset className="space-y-3 rounded-xl border border-gray-200 p-4" disabled={busy}>
          <legend className="px-1 font-bold">Yearly membership (optional)</legend>
          <p className="text-sm text-gray-600">Each athlete’s yearly membership includes 4 free drop-ins per membership year and member pricing on eligible classes. Membership lasts one year and renews annually. Class enrollments are purchased separately.</p>
          {offer?.active ? <p className="font-semibold text-green-700">Membership active · {benefits?.annualCreditsRemaining ?? 0} annual drop-in credits remaining</p>
            : <>
              <label className="flex gap-3 rounded-lg border p-3"><input type="radio" name="drop-in-membership" checked={!includeMembership} onChange={() => setIncludeMembership(false)} /><span><strong>Drop-in only</strong><span className="block text-sm text-gray-600">No yearly membership required.</span></span></label>
              {offer?.available ? <label className="flex gap-3 rounded-lg border p-3"><input type="radio" name="drop-in-membership" checked={includeMembership} onChange={() => { setIncludeMembership(true); setUseFreeTrial(false) }} /><span><strong>Add yearly membership</strong><span className="block text-sm text-gray-600">{money(offer.amountCents)} per year for this athlete. Pay for membership first, then apply an available credit to this drop-in.</span></span></label>
                : <p className="text-sm text-gray-600">Yearly membership is not available online right now. You can still book this drop-in.</p>}
            </>}
        </fieldset>}
        {!purchasingMembership && trialAvailable && <label className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4"><input type="checkbox" checked={trialSelected} disabled={busy} onChange={event => setUseFreeTrial(event.target.checked)} /><span><strong>Use my one-time free trial</strong><span className="block text-sm text-gray-600">Available once per athlete. No yearly membership required.</span></span></label>}
        {!purchasingMembership && !trialSelected && <label className="block text-sm font-semibold">Free-day code (optional)<input value={promoCode} disabled={busy} onChange={event => setPromoCode(event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>}
      </>}
      {unavailable && !booking && <p className="rounded-lg bg-amber-50 p-3 text-sm">{currentSession && !purchasingMembership
        ? 'This class currently shows as full. Check for an existing booking or choose another date or time.'
        : 'This class is no longer available. Choose another date or time.'}</p>}
      <div className="rounded-xl bg-gray-50 p-4 text-sm">
        {purchasingMembership ? <><div className="flex justify-between gap-3"><span>Yearly membership due today</span><strong>{money(offer?.amountCents ?? 0)}</strong></div><p className="mt-2 text-gray-600">Your drop-in will use a membership credit after membership payment is verified. Availability is checked again before the class is confirmed.</p></>
          : <><div className="flex justify-between gap-3"><span>Drop-in total</span><strong>{money(booking?.totalCents ?? dueCents)}</strong></div>{!trialSelected && !booking && (benefits?.annualCreditsRemaining ?? 0) > 0 && <p className="mt-2 text-gray-600">One annual member credit will be applied.</p>}{!trialSelected && promoCode.trim() && <p className="mt-2 text-gray-600">Your free-day code will be validated before checkout.</p>}</>}
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
