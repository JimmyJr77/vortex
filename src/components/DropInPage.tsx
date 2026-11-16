import { trackConfirmation, trackEvent } from '../utils/analyticsClient'
import TextInput from './common/TextInput'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, LayoutGrid, Loader2, Search, X } from 'lucide-react'
import { checkoutDropIn, fetchDropIns, registerDropIn, type DropInBenefits, type DropInClass, type DropInSession } from '../utils/dropInApi'
import { fetchClassesOffered, type PublicProgramOffered } from '../utils/publicClassesApi'
import { getPublicBookingPrograms } from '../utils/publicBookingPrograms'
import { getDropInDateOptions } from '../utils/dropInDateOptions'
import { getLoggedInMemberAccount, getMemberSessionToken } from '../utils/portalSession'
import { formatPhoneForDisplay } from '../utils/phoneUtils'
import { CLASS_SKILL_LEVEL_FILTER_OPTIONS, formatAgeRange, formatSkillLevel, type ClassSkillLevelFilter } from '../utils/classDisplayUtils'
import { DROP_IN_FAQS } from '../config/localSeoFaqs'
import EnrollmentStartDateField from './enroll/EnrollmentStartDateField'
import './DropInPage.css'

const DropInSignup = lazy(() => import('./signup/DropInSignup'))

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
const prettyDate = (date: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
const prettyTime = (time: string) => new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

function DropInSessionOption({ session, alternative = false, onSelect }: {
  session: DropInSession
  alternative?: boolean
  onSelect: (session: DropInSession) => void
}) {
  return <button type="button" disabled={session.isFull} onClick={() => onSelect(session)} className={`np-drop-in-session-option${alternative ? ' np-drop-in-session-alternative' : ''} min-h-24 w-full touch-manipulation rounded-xl border border-gray-200 p-4 text-left hover:border-vortex-red disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60`}>
    {alternative && <span className="np-drop-in-different-date">Different date</span>}
    <div className="flex items-start justify-between gap-3">
      <div><div className="flex items-center gap-2 font-bold"><CalendarDays className="h-4 w-4 shrink-0 text-vortex-red" /> {prettyDate(session.date)}</div><p className="mt-1 text-sm text-gray-600">{prettyTime(session.startTime)}–{prettyTime(session.endTime)}</p></div>
      <strong className="shrink-0 text-vortex-red">{money(session.totalCents)}</strong>
    </div>
    <p className="mt-3 text-xs font-semibold text-gray-600">{session.isFull ? 'Class full' : `${session.spotsRemaining} spots available`}</p>
    <p className="mt-1 text-xs text-gray-500">{session.monthlyEnrolled} monthly + {session.dropInEnrolled} drop-in · maximum {session.maxParticipants}</p>
  </button>
}

export default function DropInPage() {
  const [params, setParams] = useSearchParams()
  const signupSlotGroupId = Number(params.get('signupSlot'))
  const signupDate = params.get('signupDate')
  const bookingId = Number(params.get('booking'))
  const checkoutSessionId = params.get('checkout') === 'paid' ? params.get('session_id') : null
  const [paymentStatus, setPaymentStatus] = useState<'payment_pending' | 'confirmed'>('payment_pending')
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const memberToken = getMemberSessionToken()
  const loggedInAccount = memberToken ? getLoggedInMemberAccount() : null
  const loggedInName = loggedInAccount?.fullName?.trim() ||
    `${loggedInAccount?.firstName || ''} ${loggedInAccount?.lastName || ''}`.trim()
  const [sessions, setSessions] = useState<DropInSession[]>([])
  const [classes, setClasses] = useState<DropInClass[]>([])
  const [programOptions, setProgramOptions] = useState<PublicProgramOffered[]>([])
  const [benefits, setBenefits] = useState<DropInBenefits | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [selected, setSelected] = useState<DropInSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [catalogVersion, setCatalogVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [programFilter, setProgramFilter] = useState<number | 'all'>('all')
  const [levelFilter, setLevelFilter] = useState<ClassSkillLevelFilter>('all')
  const [result, setResult] = useState<Awaited<ReturnType<typeof registerDropIn>> | null>(null)
  const [dropInDate, setDropInDate] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    firstName: loggedInAccount?.firstName?.trim() ?? '',
    lastName: loggedInAccount?.lastName?.trim() ?? '',
    email: loggedInAccount?.email?.trim() ?? '',
    phone: formatPhoneForDisplay(loggedInAccount?.phone),
    useFreeTrial: true,
    promoCode: '',
  })

  useEffect(() => {
    if (bookingId <= 0 || !checkoutSessionId || !memberToken) return
    let active = true
    void checkoutDropIn(bookingId, checkoutSessionId).then((checkout) => {
      if (active) {
        setPaymentStatus(checkout.status)
        if (checkout.status === 'confirmed') trackConfirmation('drop_in_confirmed', '/drop-in', bookingId)
      }
    }).catch((error) => { if (active) setPaymentError(error.message) })
    return () => { active = false }
  }, [bookingId, checkoutSessionId, memberToken])

  const payForBooking = async (id: number) => {
    setPaymentBusy(true)
    setPaymentError(null)
    try {
      if (!checkoutSessionId) trackEvent('drop_in_checkout_start', '/drop-in')
      const checkout = await checkoutDropIn(id, checkoutSessionId ?? undefined)
      setPaymentStatus(checkout.status)
      if (checkout.url) window.location.assign(checkout.url)
      else if (checkout.status === 'confirmed') {
        trackConfirmation('drop_in_confirmed', '/drop-in', id)
        setResult((current) => current ? { ...current, status: 'confirmed' } : null)
      }
      else setPaymentError('Payment is still being confirmed. Check again in a moment.')
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to open checkout.')
    } finally {
      setPaymentBusy(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchClassesOffered(), fetchDropIns()]).then(([catalog, data]) => {
      const dropInClassById = new Map((data.classes ?? []).map((row) => [row.classId, row]))
      const publicPrograms = getPublicBookingPrograms(catalog.programs)
      setProgramOptions(publicPrograms)
      setClasses(publicPrograms.flatMap((program) => program.classes
        .filter((classItem) => classItem.formId != null && !(classItem.excludeFromDropIns ?? program.excludeFromDropIns))
        .map((classItem): DropInClass => ({
          ...(dropInClassById.get(classItem.id) ?? {
            formId: Number(classItem.formId), classId: classItem.id,
            className: classItem.displayName, classDescription: classItem.description,
            programId: program.id, programName: program.displayName,
            programDescription: program.description, sportName: program.primarySportName ?? null,
            skillLevel: classItem.skillLevel, ageMin: classItem.ageMin, ageMax: classItem.ageMax,
            monthlyCents: 0, baseCents: 0, discountPercent: 0, discountCents: 0, totalCents: 0,
          }),
          programName: program.displayName,
        }))))
      setSessions(data.sessions)
      setBenefits(data.benefits)
      setForm((current) => ({ ...current, useFreeTrial: data.benefits.trialAvailable }))
    }).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load classes')).finally(() => setLoading(false))
    // Refresh after account/membership checkout; typed emails never resolve account benefits.
  }, [catalogVersion])

  const programSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = classes.filter((row) =>
      (programFilter === 'all' || row.programId === programFilter) &&
      (levelFilter === 'all' || row.skillLevel == null || row.skillLevel === levelFilter) &&
      (!dropInDate || sessions.some(
        (session) => session.classId === row.classId && session.date === dropInDate,
      )) &&
      (!query || [row.sportName, row.programName, row.className, row.skillLevel, row.classDescription].filter(Boolean).join(' ').toLowerCase().includes(query)),
    )
    const grouped = new Map<number, DropInClass[]>()
    for (const row of filtered) grouped.set(row.programId, [...(grouped.get(row.programId) ?? []), row])
    return [...grouped.values()]
  }, [classes, dropInDate, levelFilter, programFilter, searchQuery, sessions])

  const { onSelectedDate, alternatives } = useMemo(
    () => getDropInDateOptions(sessions, selectedClassId, dropInDate),
    [dropInDate, selectedClassId, sessions],
  )

  const selectedClass = classes.find((row) => row.classId === selectedClassId) ?? null
  const selectedProgram = programOptions.find((program) => program.id === programFilter)
  const hasFilters = searchQuery !== '' || programFilter !== 'all' || levelFilter !== 'all'
  const clearFilters = () => { setSearchQuery(''); setProgramFilter('all'); setLevelFilter('all') }
  const selectSession = (session: DropInSession) => {
    trackEvent('drop_in_start', '/drop-in')
    setResult(null)
    setError(null)
    if (!memberToken) {
      setParams({ signupSlot: String(session.slotGroupId), signupDate: session.date })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSelected(session)
  }

  const closeSignup = () => {
    setParams({})
    setSelectedClassId(null)
    setError(null)
    setCatalogVersion(current => current + 1)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setSubmitting(true); setError(null)
    try {
      const booking = await registerDropIn({ slotGroupId: selected.slotGroupId, classDate: selected.date, ...form })
      if (booking.status === 'confirmed') trackConfirmation('drop_in_confirmed', '/drop-in', booking.id)
      setResult(booking)
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Registration failed') }
    finally { setSubmitting(false) }
  }

  if (signupSlotGroupId > 0 && signupDate) {
    const signupSession = sessions.find((session) => session.slotGroupId === signupSlotGroupId && session.date === signupDate)
    return <div className="np-drop-in-page min-h-screen">
      <section className="np-drop-in-hero">
        <div className="np-drop-in-container">
          <p className="np-drop-in-eyebrow">Your next class starts here</p>
          <h1>Drop-in registration.</h1>
          <p className="np-drop-in-intro">Complete your account and waivers, explore yearly membership benefits, then finish with payment.</p>
        </div>
      </section>
      <section className="np-drop-in-container np-drop-in-content">
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          {signupSession && <div className="mb-6 rounded-xl bg-gray-50 p-4">
            <p className="font-bold">{signupSession.className}</p>
            <p className="text-sm text-gray-600">{prettyDate(signupSession.date)} · {prettyTime(signupSession.startTime)}–{prettyTime(signupSession.endTime)}</p>
          </div>}
          {loading ? <div role="status" className="flex items-center gap-3"><Loader2 className="h-6 w-6 animate-spin" />Loading your class…</div>
            : signupSession ? <Suspense fallback={<p role="status">Loading registration…</p>}>
              <DropInSignup key={`${signupSession.slotGroupId}:${signupSession.date}`} session={signupSession} onCancel={closeSignup} />
            </Suspense> : <div role="alert" className="space-y-4">
              <p>{error || 'This drop-in is no longer available. Choose another class or date to continue.'}</p>
              <button type="button" onClick={closeSignup} className="rounded-lg bg-vortex-red px-4 py-3 font-semibold text-white">Browse drop-in classes</button>
            </div>}
        </div>
      </section>
    </div>
  }

  return <div className="np-drop-in-page min-h-screen">
    <section className="np-drop-in-hero">
      <div className="np-drop-in-container">
        <p className="np-drop-in-eyebrow">Gymnastics &amp; athletic development · Bowie, MD</p>
        <h1>Drop-in classes.</h1>
        <p className="np-drop-in-intro">
          Keep growing, one class at a time. Find an available drop-in or schedule a make-up class that fits your week.
        </p>
        <p className="np-drop-in-hero-note">First class for non-members is free. Member discounts apply, and all members get 4 free drop-ins per year.</p>
      </div>
    </section>

    <section className="np-drop-in-container np-drop-in-content" data-prerender-dynamic="">
      {bookingId > 0 && (
        <div className="mb-8 rounded-xl border bg-white p-5" aria-live="polite">
          <h2 className="text-lg font-bold">{paymentStatus === 'confirmed' ? 'Drop-in confirmed' : 'Drop-in payment'}</h2>
          {paymentStatus === 'payment_pending' && <>
            <p className="mt-1 text-sm text-gray-600">Your drop-in is confirmed once payment is received.</p>
            {loggedInAccount ? (
              <button type="button" disabled={paymentBusy} onClick={() => void payForBooking(bookingId)} className="mt-3 rounded-lg bg-vortex-red px-4 py-2 font-semibold text-white disabled:opacity-60">
                {paymentBusy ? 'Checking booking…' : checkoutSessionId ? 'Check payment status' : 'Pay by credit card'}
              </button>
            ) : <Link className="mt-3 inline-block font-semibold text-vortex-red underline" to={`?${new URLSearchParams({ ...Object.fromEntries(params), login: '1' })}`}>Sign in to pay</Link>}
            {paymentError && <p className="mt-2 text-sm text-red-700" role="alert">{paymentError}</p>}
          </>}
        </div>
      )}
      {benefits && <div className="np-drop-in-benefits mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4"><div className="text-sm text-gray-500">Your rate</div><div className="font-bold">{benefits.annualMember ? `Member pricing${benefits.discountPercent ? ` · ${benefits.discountPercent.toFixed(0)}% discount` : ''}` : 'Non-member pricing'}</div></div>
        <div className="rounded-xl border bg-white p-4"><div className="text-sm text-gray-500">Free trial</div><div className="font-bold">{benefits.trialAvailable ? 'Available' : 'Already used'}</div></div>
        <div className="rounded-xl border bg-white p-4"><div className="text-sm text-gray-500">Annual member credits</div><div className="font-bold">{benefits.annualCreditsRemaining} remaining</div></div>
        <div className="rounded-xl border bg-white p-4"><div className="text-sm text-gray-500">Additional free passes</div><div className="font-bold">{(benefits.adminCreditsRemaining ?? 0) + (benefits.freePassesRemaining ?? 0)} remaining</div></div>
      </div>}

      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-vortex-red" /></div> : <div className={`grid items-start gap-6 ${selectedClassId ? 'lg:grid-cols-[minmax(0,1fr)_24rem]' : ''}`}>
        <div className="space-y-6">
          <div className="np-drop-in-filters rounded-xl border border-gray-200 bg-white p-4 md:p-5 space-y-4 shadow-sm">
            <div className="flex items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><LayoutGrid className="h-7 w-7 text-vortex-red" /> Browse classes</h2><p className="mt-1 text-sm text-gray-600">Select a class to see its upcoming single-day openings.</p></div>{hasFilters && <button type="button" onClick={clearFilters} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-vortex-red"><X className="h-4 w-4" /> Clear</button>}</div>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input type="search" aria-label="Search drop-in classes" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search classes…" className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm" /></div>
            <EnrollmentStartDateField
              id="drop-in-date"
              label="Drop-in date"
              value={dropInDate}
              onChange={(value) => {
                setDropInDate(value)
                setSelectedClassId(null)
                setSelected(null)
                if (value) setDateError(null)
              }}
              error={dateError}
              inputRef={dateInputRef}
              className="max-w-sm"
              helpText="Choose the date you want to attend this drop-in class."
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 sm:max-w-[14rem]"><span className="text-xs font-semibold text-gray-600">Program</span><select aria-label="Program" value={programFilter} onChange={(event) => setProgramFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="all">All programs</option>{programOptions.map((program) => <option key={program.id} value={program.id}>{program.displayName}</option>)}</select></label>
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 sm:max-w-[14rem]"><span className="text-xs font-semibold text-gray-600">Experience level</span><select aria-label="Experience level" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as ClassSkillLevelFilter)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm">{CLASS_SKILL_LEVEL_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
          </div>

          {programSections.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">{error || (selectedProgram && selectedProgram.classes.every(classItem => classItem.excludeFromDropIns ?? selectedProgram.excludeFromDropIns)
            ? <>{selectedProgram.displayName} does not offer drop-in classes. <Link className="font-semibold text-vortex-red underline" to={`/enroll?programsId=${selectedProgram.id}`}>View enrollment options</Link></>
            : 'No classes match your search or filters.')}</div>}
          {programSections.map((rows) => <div key={rows[0].programId} className="np-drop-in-program space-y-4 rounded-xl border border-vortex-red bg-white p-4 shadow-sm md:p-5">
            <div><h2 className="text-lg font-bold text-vortex-red">{rows[0].programName}</h2>{rows[0].programDescription && <p className="mt-1 text-sm text-gray-600">{rows[0].programDescription}</p>}</div>
            {rows.map((row) => <button type="button" key={row.classId} onClick={() => {
              if (!dropInDate) {
                setDateError('Select a drop-in date before choosing a class.')
                dateInputRef.current?.focus()
                return
              }
              setSelectedClassId(row.classId)
            }} className={`np-drop-in-class block w-full rounded-xl border p-4 text-left transition-colors ${selectedClassId === row.classId ? 'border-vortex-red bg-red-50 ring-1 ring-red-200' : 'border-gray-100 bg-gray-50 hover:border-gray-300'}`}>
              <h3 className="text-base font-bold text-gray-900">{row.className}</h3><div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span>Age: {formatAgeRange(row.ageMin, row.ageMax)}</span><span>Level: {formatSkillLevel(row.skillLevel)}</span></div>{row.classDescription && <p className="mt-1 text-sm text-gray-600">{row.classDescription}</p>}<p className="mt-3 text-sm font-semibold text-vortex-red">View drop-in times →</p>
            </button>)}
          </div>)}
        </div>

        {selectedClassId && <button type="button" aria-label="Close upcoming classes" onClick={() => setSelectedClassId(null)} className="fixed inset-0 z-40 bg-black/45 lg:hidden" />}
        {selectedClassId && <aside className="np-drop-in-sessions fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-hidden rounded-t-2xl border border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl md:p-5 lg:sticky lg:inset-auto lg:top-[calc(var(--site-header-height,0px)+1rem)] lg:z-auto lg:max-h-none lg:rounded-xl lg:pb-5 lg:shadow-sm">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-300 lg:hidden" />
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-vortex-red">Upcoming classes</p><h2 className="mt-1 text-xl font-bold text-gray-900">{selectedClass?.className}</h2><p className="mt-1 text-sm text-gray-600">Choose one day, date, and time.</p></div><button type="button" onClick={() => setSelectedClassId(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close upcoming classes"><X className="h-5 w-5" /></button></div>
          <div className="mt-5 max-h-[58dvh] overflow-y-auto overscroll-contain pr-1 lg:max-h-[65vh]">
            <section aria-labelledby="drop-in-selected-date-heading" className="space-y-3">
              <div className="np-drop-in-date-heading">
                <h3 id="drop-in-selected-date-heading">Your selected date</h3>
                <p>{prettyDate(dropInDate)}</p>
              </div>
              {onSelectedDate.map((session) => <DropInSessionOption key={`${session.slotGroupId}:${session.date}:${session.startTime}`} session={session} onSelect={selectSession} />)}
              {onSelectedDate.length === 0 && <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">No times are available for this class on your selected date.</p>}
            </section>
            {alternatives.length > 0 && <section aria-labelledby="drop-in-alternatives-heading" className="np-drop-in-alternatives space-y-3">
              <div className="np-drop-in-date-heading">
                <h3 id="drop-in-alternatives-heading">Other dates &amp; times</h3>
                <p>These options are on a different date from {prettyDate(dropInDate)}.</p>
              </div>
              {alternatives.map((session) => <DropInSessionOption key={`${session.slotGroupId}:${session.date}:${session.startTime}`} session={session} alternative onSelect={selectSession} />)}
            </section>}
          </div>
        </aside>}
      </div>}
    </section>

    <section className="np-drop-in-faq border-t border-gray-200 bg-white py-14">
      <div className="np-drop-in-container">
        <p className="np-drop-in-eyebrow">Before you join us</p>
        <h2>Drop-in questions, answered.</h2>
        <p className="mt-3 max-w-2xl text-gray-600">
          Try one available class in Bowie without committing to monthly enrollment.
        </p>
        <div className="mt-8 space-y-4">
          {DROP_IN_FAQS.map((faq) => (
            <details key={faq.question} className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <summary className="cursor-pointer text-lg font-bold text-gray-950">
                {faq.question}
              </summary>
              <p className="mt-4 leading-relaxed text-gray-700">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>

    {selected && <div className="np-drop-in-modal fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null) }}><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      {result ? <div className="text-center">
        {result.status === 'confirmed' && <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />}
        <h2 className="mt-4 text-2xl font-bold">{result.accountRequired ? 'Finish creating your family account' : result.status === 'payment_pending' ? 'Payment required' : 'Drop-in confirmed'}</h2>
        <p className="mt-3 font-semibold">{selected.className}<br />{prettyDate(selected.date)} · {prettyTime(selected.startTime)}–{prettyTime(selected.endTime)}</p>
        <p className="mt-2 text-gray-600">{result.accountRequired ? 'Create your family account and add this athlete to continue with your drop-in.'
          : result.status === 'payment_pending' ? `Pay ${money(result.totalCents)} to confirm this drop-in.`
          : result.benefitType === 'free_trial' ? 'Your one-time free trial is confirmed.'
          : result.benefitType === 'annual_credit' ? 'One annual member credit was applied.'
          : result.benefitType === 'paid' ? 'Your spot is confirmed.' : 'Your free-day pass was applied.'}</p>
        {result.accountRequired && <Link className="mt-5 inline-flex rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white" to={result.signupUrl ?? '/signup/family'}>Create your family account</Link>}
        {result.status === 'payment_pending' && <button type="button" disabled={paymentBusy} onClick={() => void payForBooking(result.id)} className="mt-5 rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white disabled:opacity-60">{paymentBusy ? 'Opening checkout…' : 'Pay by credit card'}</button>}
        {paymentError && <p className="mt-2 text-sm text-red-700" role="alert">{paymentError}</p>}
        <button type="button" className="mt-4 block w-full text-sm font-semibold" onClick={() => { setSelected(null); setPaymentError(null) }}>Close</button>
      </div> : <><h2 className="text-2xl font-bold">Register for one day</h2><p className="mt-1 text-sm text-gray-600">{selected.className} · {prettyDate(selected.date)} · {prettyTime(selected.startTime)}–{prettyTime(selected.endTime)}</p>{selected.date !== dropInDate && <p className="np-drop-in-alternate-notice">You selected an alternate date: <strong>{prettyDate(selected.date)}</strong>, instead of {prettyDate(dropInDate)}.</p>}<form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">First name<input required className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label><label className="text-sm font-semibold">Last name<input required className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label></div>
        {loggedInAccount ? <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><strong>Signed in{loggedInName ? ` as ${loggedInName}` : ''}</strong>{loggedInAccount.email && <span className="block">{loggedInAccount.email}</span>}<span className="mt-1 block text-green-700">This registration will use your logged-in account.</span></div> : <label className="block text-sm font-semibold">Email<input required type="email" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>}<label className="block text-sm font-semibold">Phone<TextInput type="tel" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        {benefits?.trialAvailable && <label className="flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4"><input type="checkbox" checked={form.useFreeTrial} onChange={(event) => setForm({ ...form, useFreeTrial: event.target.checked })} /><span><strong>Use my one-time free trial</strong><span className="block text-sm text-gray-600">No annual membership is required. Available once per athlete, for life.</span></span></label>}
        {!form.useFreeTrial && <label className="block text-sm font-semibold">Free-day code (optional)<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal uppercase" value={form.promoCode} onChange={(event) => setForm({ ...form, promoCode: event.target.value.toUpperCase() })} placeholder="Enter code" /></label>}
        <div className="rounded-xl bg-gray-50 p-4 text-sm"><div className="flex justify-between"><span>Single-day price</span><strong>{form.useFreeTrial || Boolean(form.promoCode.trim()) || (benefits?.annualCreditsRemaining ?? 0) > 0 || (benefits?.adminCreditsRemaining ?? 0) > 0 ? '$0.00' : money(selected.totalCents)}</strong></div></div>{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="flex gap-3"><button type="button" onClick={() => setSelected(null)} className="flex-1 rounded-lg border px-4 py-3 font-semibold">Cancel</button><button disabled={submitting} className="flex-1 rounded-lg bg-vortex-red px-4 py-3 font-semibold text-white disabled:opacity-60">{submitting ? 'Registering…' : 'Reserve class'}</button></div>
      </form></>}
    </div></div>}
  </div>
}
