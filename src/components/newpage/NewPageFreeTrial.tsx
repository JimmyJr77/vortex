import { trackEvent } from '../../utils/analyticsClient'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, LoaderCircle, RefreshCw, Users } from 'lucide-react'
import { TEAM_EMAIL, TEAM_PHONE, TEAM_PHONE_E164 } from '../../config/contact'
import { fetchFreeTrialAvailability, type FreeTrialAvailability, type FreeTrialProgram, type FreeTrialSession, type GymnasticsTrialAnswers } from '../../utils/freeTrialApi'
import NewPageTrialRegistration from './NewPageTrialRegistration'
import './NewPageFreeTrial.css'

type TrialStep = 'program' | 'age' | 'qualification' | 'classes' | 'review' | 'registration'

const PROGRAMS = [
  { id: 'gymnastics' as const, name: 'Gymnastics', description: 'Build a foundation in gymnastics, with purposeful skill development.', image: '/gymnastics-card.webp' },
  { id: 'fit-flip' as const, name: 'Fit & Flip', description: 'Develop strength, explosiveness, and body control for your sport.', image: '/fit-and-flip-card.webp' },
]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const STEP_LABELS = ['Program', 'Age', 'Class', 'Register']

function formatTrialDate(date: string, weekday = false) {
  return new Intl.DateTimeFormat('en-US', {
    ...(weekday ? { weekday: 'long' as const } : {}),
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

function formatTrialTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
}

function weekdayFor(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

export default function NewPageFreeTrial({
  initialProgram,
  onDone,
}: {
  initialProgram?: FreeTrialProgram
  onDone: () => void
}) {
  const [step, setStep] = useState<TrialStep>(initialProgram ? 'age' : 'program')
  const [program, setProgram] = useState<FreeTrialProgram | null>(initialProgram ?? null)
  const [ageInput, setAgeInput] = useState('')
  const [age, setAge] = useState<number | null>(null)
  const [availability, setAvailability] = useState<FreeTrialAvailability | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [classFilter, setClassFilter] = useState('all')
  const [dayFilter, setDayFilter] = useState<number | null>(null)
  const [visibleCount, setVisibleCount] = useState(8)
  const [selected, setSelected] = useState<FreeTrialSession | null>(null)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [gymnasticsAnswers, setGymnasticsAnswers] = useState<GymnasticsTrialAnswers>({})
  const [pottyNotReady, setPottyNotReady] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  const programName = PROGRAMS.find(option => option.id === program)?.name ?? ''
  const activeStep = step === 'program' ? 0 : step === 'age' || step === 'qualification' ? 1 : step === 'registration' ? 3 : 2
  const gymnasticsRouting = availability?.gymnasticsRouting

  useEffect(() => {
    if (previousStep.current !== step) {
      headingRef.current?.focus({ preventScroll: true })
      headingRef.current?.closest('dialog')?.scrollTo({ top: 0, behavior: 'instant' })
      previousStep.current = step
    }
  }, [step])

  useEffect(() => {
    if (step !== 'classes' || !program || age === null) return
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    setLoading(true)
    setError('')
    void fetchFreeTrialAvailability(program, age, controller.signal, gymnasticsAnswers).then(data => {
      if (!active) return
      setAvailability(data)
      setLoadedAt(new Date())
      if (program === 'gymnastics' && !gymnasticsAnswers.gymnasticsTrack) {
        if (data.gymnasticsRouting?.track === 'preschool') setGymnasticsAnswers({ gymnasticsTrack: 'preschool' })
        else {
          setStep('qualification')
          return
        }
      } else {
        const outcome = data.sessions.some(session => !session.isFull) ? 'available' : 'empty'
        trackEvent('trial_availability', '/', { properties: { program_slug: program, outcome } })
      }
    }).catch((failure: unknown) => {
      if (!active) return
      setAvailability(null)
      trackEvent('trial_availability', '/', { properties: { program_slug: program, outcome: 'error' } })
      setError(controller.signal.aborted
        ? 'Class availability is taking longer than expected. Please try again.'
        : failure instanceof Error ? failure.message : 'We couldn’t load trial classes. Please try again.')
    }).finally(() => {
      window.clearTimeout(timeout)
      if (active) setLoading(false)
    })
    return () => { active = false; window.clearTimeout(timeout); controller.abort() }
  }, [step, program, age, refresh, gymnasticsAnswers])

  const sessions = useMemo(() => [...(availability?.sessions ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.className.localeCompare(b.className),
  ), [availability])

  const offeredClasses = useMemo(() => [...new Map(sessions.map(session => [session.classId, session.className])).entries()], [sessions])
  const days = useMemo(() => [1, 2, 3, 4, 5, 6, 0].filter(day => sessions.some(session =>
    weekdayFor(session.date) === day && (classFilter === 'all' || String(session.classId) === classFilter),
  )), [sessions, classFilter])
  const filteredSessions = sessions.filter(session =>
    (classFilter === 'all' || String(session.classId) === classFilter)
    && (dayFilter === null || weekdayFor(session.date) === dayFilter),
  )

  function chooseProgram(nextProgram: FreeTrialProgram) {
    trackEvent('program_interest', '/', { properties: { program_slug: nextProgram, target: 'trial_program' } })
    setProgram(nextProgram)
    setAvailability(null)
    setSelected(null)
    setError('')
    setGymnasticsAnswers({})
    setPottyNotReady(false)
    setStep('age')
  }

  function submitAge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextAge = Number(ageInput)
    if (!ageInput.trim() || !Number.isInteger(nextAge) || nextAge < 1 || nextAge > 17) {
      setError('Enter your child’s age in years, from 1 to 17.')
      return
    }
    setAge(nextAge)
    setAvailability(null)
    setSelected(null)
    setClassFilter('all')
    setDayFilter(null)
    setVisibleCount(8)
    setError('')
    setGymnasticsAnswers({})
    setPottyNotReady(false)
    setStep('classes')
  }

  function back() {
    setError('')
    if (step === 'age') setStep('program')
    if (step === 'qualification') setStep('age')
    if (step === 'classes') setStep(program === 'gymnastics' && gymnasticsRouting?.track !== 'preschool' ? 'qualification' : 'age')
    if (step === 'review' || step === 'registration') setStep('classes')
  }

  function chooseGymnasticsPath(answers: GymnasticsTrialAnswers) {
    setGymnasticsAnswers(answers)
    setPottyNotReady(false)
    setClassFilter('all')
    setDayFilter(null)
    setVisibleCount(8)
    setSelected(null)
    setStep('classes')
  }

  const title = step === 'program' ? 'Find their first class.'
    : step === 'age' ? 'How old is your athlete?'
    : step === 'qualification' ? gymnasticsRouting?.track === 'mommy-me' ? 'Is your child potty trained?' : gymnasticsRouting?.track === 'school-age' ? 'Where are they starting?' : 'Let’s find their starting point.'
    : step === 'classes' ? 'Pick a day to try it.'
    : step === 'review' ? 'Ready to give it a try?'
    : confirmed ? 'Their first day is booked.' : 'Make it their first day.'

  return <div className="np-trial-flow">
    <div className="np-trial-topline"><p className="np-eyebrow">THEIR FIRST CLASS. ON US.</p><span className="np-trial-price-badge">$0 trial</span></div>
    <ol className="np-trial-steps" aria-label="Free trial signup progress">{STEP_LABELS.map((label, index) =>
      <li key={label} aria-current={index === activeStep ? 'step' : undefined} className={index <= activeStep ? 'is-active' : ''}><span>{index < activeStep ? <Check size={12} /> : index + 1}</span>{label}</li>,
    )}</ol>
    {step !== 'program' && step !== 'registration' && <button className="np-trial-back" onClick={back}><ArrowLeft size={16} />{step === 'age' ? 'Change program' : step === 'qualification' ? 'Change age' : step === 'classes' ? 'Change your answers' : 'Choose another class'}</button>}
    <h2 ref={headingRef} tabIndex={-1} id="np-trial-title">{title}</h2>

    {step === 'program' && <>
      <p className="np-trial-intro">Choose the program your child would like to try. We’ll help you find the right class.</p>
      <div className="np-trial-programs">{PROGRAMS.map(option => <button key={option.id} onClick={() => chooseProgram(option.id)}>
        <img src={option.image} alt="" width="900" height="675" />
        <span className="np-trial-program-copy"><strong>{option.name}</strong><span>{option.description}</span><span className="np-trial-program-action">Choose {option.name}<ArrowUpRight size={18} /></span></span>
      </button>)}</div>
      <p className="np-trial-footnote">One free trial per athlete. A parent or legal guardian completes registration and waivers before the class is confirmed.</p>
    </>}

    {step === 'age' && <>
      <p className="np-trial-intro"><strong>{programName}</strong> · Find a class that fits their age.</p>
      <form className="np-trial-age-form" onSubmit={submitAge}>
        <label htmlFor="np-trial-age">Your child’s age</label>
        <div className="np-trial-age-input"><input id="np-trial-age" type="number" inputMode="numeric" min="1" max="17" step="1" required value={ageInput} onChange={event => { setAgeInput(event.target.value); setError('') }} aria-describedby="np-trial-age-help" autoComplete="off" placeholder="e.g. 10" /><span>years old</span></div>
        <p id="np-trial-age-help">{program === 'fit-flip' ? 'Cyclones classes are grouped into ages 8–11 and 12–15.' : 'We’ll show the gymnastics classes available for their age.'} We’ll confirm their eligibility using the date of birth entered at registration.</p>
        {error && <p className="np-trial-error" role="alert">{error}</p>}
        <button className="np-button" type="submit">Find available classes <ArrowRight size={18} /></button>
      </form>
    </>}

    {step === 'qualification' && <>
      <p className="np-trial-intro"><strong>Gymnastics</strong> · Age {age}</p>
      {gymnasticsRouting?.track === 'mommy-me' ? <>
        <p className="np-trial-review-help">Mommy & Me athletes must be potty trained to join a trial class.</p>
        <div className="np-trial-answer-options">
          <button onClick={() => chooseGymnasticsPath({ gymnasticsTrack: 'mommy-me', pottyTrained: true })}><strong>Yes, potty trained</strong><span>See available Mommy & Me classes.</span><ArrowRight size={19} /></button>
          <button aria-pressed={pottyNotReady} onClick={() => setPottyNotReady(true)}><strong>Not yet</strong><span>Talk with our team about the next step.</span><ArrowRight size={19} /></button>
        </div>
        {pottyNotReady && <div className="np-trial-empty" role="status"><h3>A little more time to get ready.</h3><p>Potty training is required before booking Mommy & Me. We’d be happy to help you plan their first class when they’re ready.</p><a className="np-button" href={`tel:${TEAM_PHONE_E164}`}>Call {TEAM_PHONE} <ArrowUpRight size={17} /></a></div>}
      </> : gymnasticsRouting?.track === 'school-age' ? <>
        <p className="np-trial-review-help">Has your child taken gymnastics before? We’ll guide them to the right first class.</p>
        <div className="np-trial-answer-options">
          <button onClick={() => chooseGymnasticsPath({ gymnasticsTrack: 'beginner', experience: 'none' })}><strong>No gymnastics experience</strong><span>Try a Tornadoes class and build the foundations.</span><ArrowRight size={19} /></button>
          <button onClick={() => chooseGymnasticsPath({ gymnasticsTrack: 'experienced', experience: 'experienced' })}><strong>Has gymnastics experience</strong><span>Choose a Trial Assessment to find the right class, or call for placement.</span><ArrowRight size={19} /></button>
        </div>
      </> : <div className="np-trial-empty"><h3>Let’s choose the right class together.</h3><p>{gymnasticsRouting?.reason || 'Our team can help find the right gymnastics starting point for this age.'}</p><a className="np-button" href={`tel:${TEAM_PHONE_E164}`}>Call for placement <ArrowUpRight size={17} /></a><span>{TEAM_PHONE}</span></div>}
    </>}

    {step === 'classes' && <>
      <div className="np-trial-results-heading"><p className="np-trial-intro"><strong>{programName}</strong> · Age {age}{availability?.ageBand && <> · Ages {availability.ageBand.min}–{availability.ageBand.max} group</>}</p><button className="np-trial-refresh" aria-label="Refresh class availability" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} /></button></div>
      {gymnasticsAnswers.gymnasticsTrack === 'experienced' && <div className="np-trial-placement-note"><p>Experienced athletes start with a Trial Assessment so our coaches can find the right class. Choose from the current assessment schedule below, or call to arrange a trial.</p><a href={`tel:${TEAM_PHONE_E164}`}>Call for placement · {TEAM_PHONE}<ArrowUpRight size={16} /></a></div>}
      {loading ? <div className="np-trial-loading" role="status"><LoaderCircle size={27} /><p>Finding their next opportunity…</p></div> : error ? <div className="np-trial-empty"><p className="np-trial-error" role="alert">{error}</p><button className="np-button" onClick={() => setRefresh(value => value + 1)}>Try again <RefreshCw size={16} /></button></div> : sessions.length === 0 ? <div className="np-trial-empty"><CalendarDays size={30} /><h3>No trial dates available right now.</h3><p>{program === 'fit-flip' && age !== null && (age < 8 || age > 15) ? 'The Cyclones trial groups cover ages 8–11 and 12–15. Our team can help find an option for your athlete.' : `There aren’t any published ${programName} trial dates for this age in the current schedule. Contact us and we’ll help you find their starting point.`}</p><a className="np-button" href={`mailto:${TEAM_EMAIL}?subject=${encodeURIComponent(`${programName} free trial for age ${age}`)}`}>Ask about a trial <ArrowUpRight size={17} /></a><a className="np-trial-phone" href={`tel:${TEAM_PHONE_E164}`}>{TEAM_PHONE}</a></div> : <>
        {offeredClasses.length > 1 && <label className="np-trial-class-filter">Class<select value={classFilter} onChange={event => { setClassFilter(event.target.value); setDayFilter(null); setVisibleCount(8) }}><option value="all">All age-appropriate classes</option>{offeredClasses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
        <div className="np-trial-days" aria-label="Filter classes by day"><button aria-pressed={dayFilter === null} onClick={() => { setDayFilter(null); setVisibleCount(8) }}>All days</button>{days.map(day => <button key={day} aria-pressed={dayFilter === day} onClick={() => { setDayFilter(day); setVisibleCount(8) }}>{WEEKDAYS[day]}</button>)}</div>
        <p className="np-trial-availability-note">All times Eastern. Enrollment counts are current as of {loadedAt?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET.</p>
        <div className="np-trial-sessions">{filteredSessions.slice(0, visibleCount).map(session => <button key={`${session.slotGroupId}:${session.date}:${session.startTime}`} className="np-trial-session" disabled={session.isFull} onClick={() => { trackEvent('trial_class_select', '/', { properties: { program_slug: program } }); setSelected(session); setStep('review') }}>
          <span className="np-trial-session-date"><span>{WEEKDAYS[weekdayFor(session.date)]}</span><strong>{formatTrialDate(session.date)}</strong></span>
          <span className="np-trial-session-body"><strong>{session.className}</strong><span><Clock3 size={14} />{formatTrialTime(session.startTime)}–{formatTrialTime(session.endTime)}</span><span><Users size={14} />{session.enrolledCount} {session.enrolledCount === 1 ? 'athlete' : 'athletes'} enrolled</span></span>
          <span className={`np-trial-session-places${session.isFull ? ' is-full' : ''}`}>{session.isFull ? 'Class full' : `${session.spotsRemaining} ${session.spotsRemaining === 1 ? 'spot' : 'spots'} available`}{!session.isFull && <ArrowRight size={17} />}</span>
        </button>)}</div>
        {filteredSessions.length === 0 && <p className="np-trial-footnote">No dates match this day. Choose another day or class.</p>}
        {filteredSessions.length > visibleCount && <button className="np-trial-more" onClick={() => setVisibleCount(count => count + 8)}>Show more dates <ChevronDown size={17} /></button>}
        <p className="np-trial-footnote">Places are confirmed after registration and waivers are complete. Pending reservations may also use available places.</p>
      </>}
    </>}

    {step === 'review' && selected && <>
      <p className="np-trial-intro">Try the training. Meet the coaches. Find their next level.</p>
      <div className="np-trial-review-card"><p className="np-eyebrow">YOUR FIRST CLASS</p><h3>{selected.className}</h3><p><CalendarDays size={18} />{formatTrialDate(selected.date, true)}</p><p><Clock3 size={18} />{formatTrialTime(selected.startTime)}–{formatTrialTime(selected.endTime)} Eastern</p><p><Users size={18} />{selected.enrolledCount} {selected.enrolledCount === 1 ? 'athlete currently enrolled' : 'athletes currently enrolled'}</p><div className="np-trial-review-total"><span>One-time free trial<strong>No payment or card required.</strong></span><strong>$0</strong></div></div>
      <p className="np-trial-review-help">Would you like to sign up? Next, a parent or legal guardian will create or sign in to a family account, add the athlete’s details, and complete the required waivers.</p>
      <button className="np-button np-trial-continue" onClick={() => { trackEvent('trial_registration_start', '/', { properties: { program_slug: program } }); setStep('registration') }}>Yes, use our free trial <ArrowRight size={18} /></button>
      <p className="np-trial-footnote">Available once per athlete. We’ll check eligibility and availability before confirming. This does not enroll your child in a paid recurring program.</p>
    </>}

    {step === 'registration' && selected && program && age !== null && <NewPageTrialRegistration selection={{ program, age, slotGroupId: selected.slotGroupId, classDate: selected.date, className: selected.className, startTime: selected.startTime, endTime: selected.endTime, ...(program === 'gymnastics' ? gymnasticsAnswers : {}) }} onBack={() => setStep('classes')} onComplete={() => setConfirmed(true)} />}
    {confirmed && <button className="np-button np-trial-continue" onClick={onDone}>Back to exploring <ArrowRight size={18} /></button>}
  </div>
}
