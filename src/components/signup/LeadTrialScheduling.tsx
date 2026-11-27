import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getApiUrl } from '../../utils/api'
import { calculateAge, formatDateForDisplay } from '../../utils/dateUtils'
import { fetchFreeTrialAvailability, type FreeTrialProgram, type FreeTrialSession, type GymnasticsTrialAnswers } from '../../utils/freeTrialApi'

export interface TrialChild {
  memberId: number
  memberIndex: number
  firstName: string
  lastName: string
  dateOfBirth: string
}

export interface LeadTrialBooking {
  id: number
  memberId: number
  status: string
  benefitType: string
  totalCents: number
  classDate: string
  className?: string
  startTime?: string
  endTime?: string
  isTrialAssessment?: boolean
}

export type TrialBookingSelection = GymnasticsTrialAnswers & { program: FreeTrialProgram; slotGroupId: number; classDate: string }

const fieldClass = 'mt-1 block w-full rounded-lg border border-slate-300 p-3'
const actionClass = 'rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white disabled:opacity-50'

function clockTime(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}

function trialDateLabel(date: string) {
  return formatDateForDisplay(date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function LeadTrialScheduling({ inviteId, token, session, facilityId, children, bookings = [] }: {
  inviteId: number
  token: string
  session: string
  facilityId: number
  children: TrialChild[]
  bookings?: LeadTrialBooking[]
}) {
  const [confirmed, setConfirmed] = useState(bookings)
  return <section className="space-y-5" aria-label="Free trial scheduling">
    <div>
      <h2 className="text-xl font-semibold">Choose your free trial dates</h2>
      <p className="mt-2 text-slate-600">Your family information and waivers are saved. Choose an available class for each child. Athletes with gymnastics experience can book a free private 30-minute evaluation with a coach instead. No payment is required.</p>
    </div>
    {children.length === 0 && <p>No children under 18 are listed on this registration. Contact Vortex to arrange the right trial.</p>}
    {children.map(child => <ChildTrialScheduling key={child.memberId} child={child} facilityId={facilityId}
      inviteId={inviteId} token={token} session={session}
      booking={confirmed.find(booking => Number(booking.memberId) === Number(child.memberId) && ['confirmed', 'attended'].includes(booking.status))}
      onBooked={booking => setConfirmed(current => [...current.filter(item => Number(item.memberId) !== Number(booking.memberId)), booking])} />)}
    <a className="inline-block font-semibold text-vortex-red underline" href="/?login=1">Visit the member portal</a>
  </section>
}

export function ChildTrialScheduling({ child, facilityId, inviteId, token, session, booking, onBooked, bookTrial, staff = false }: {
  child: TrialChild
  facilityId: number
  inviteId?: number
  token?: string
  session?: string
  booking?: LeadTrialBooking
  onBooked: (booking: LeadTrialBooking) => void
  bookTrial?: (selection: TrialBookingSelection) => Promise<LeadTrialBooking>
  staff?: boolean
}) {
  const currentAge = calculateAge(child.dateOfBirth)
  const [age, setAge] = useState(currentAge ?? -1)
  const [program, setProgram] = useState<FreeTrialProgram>('gymnastics')
  const [experience, setExperience] = useState<'' | 'none' | 'experienced'>('')
  const [pottyTrained, setPottyTrained] = useState(false)
  const [sessions, setSessions] = useState<FreeTrialSession[] | null>(null)
  const [selectedKey, setSelectedKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [bookingBusy, setBookingBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const name = `${child.firstName} ${child.lastName}`.trim()
  const headingId = `trial-child-${child.memberId}`
  const isEvaluation = program === 'gymnastics' && experience === 'experienced'
  const qualification: GymnasticsTrialAnswers = program !== 'gymnastics' ? {}
    : isEvaluation ? { gymnasticsTrack: 'experienced', experience: 'experienced' }
    : age >= 2 && age <= 3 ? { gymnasticsTrack: 'mommy-me', pottyTrained, experience: 'none' }
    : age >= 4 && age <= 5 ? { gymnasticsTrack: 'preschool', experience: 'none' }
    : age >= 6 ? { gymnasticsTrack: 'beginner', experience: experience || undefined }
    : {}
  const ready = age >= 0 && age < 18 && (program !== 'gymnastics' || (Boolean(experience) && (isEvaluation || (age >= 2 && age <= 3 ? pottyTrained : age >= 4))))
  const selected = sessions?.find(item => `${item.slotGroupId}:${item.date}` === selectedKey)

  useEffect(() => () => {
    requestRef.current?.abort()
    requestRef.current = null
  }, [])
  useEffect(() => { if (booking) statusRef.current?.focus() }, [booking])

  const clearAvailability = () => {
    requestRef.current?.abort()
    setLoading(false)
    setSessions(null)
    setSelectedKey('')
    setError(null)
  }

  const findDates = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!ready) return
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 15000)
    setLoading(true)
    setError(null)
    setSelectedKey('')
    try {
      const availability = await fetchFreeTrialAvailability(program, age, controller.signal, qualification)
      if (controller.signal.aborted) return
      setSessions(availability.sessions.filter(item => Number(item.facilityId) === Number(facilityId)
        && calculateAge(child.dateOfBirth, new Date(`${item.date}T12:00:00`)) === age))
    } catch (caught) {
      if (!controller.signal.aborted || controller.signal.reason?.name === 'TimeoutError') {
        setSessions(null)
        setError(controller.signal.aborted ? 'Trial availability is taking longer than expected. Please try again.'
          : caught instanceof Error ? caught.message : 'Unable to load trial dates. Please try again.')
      }
    } finally {
      window.clearTimeout(timeout)
      if (requestRef.current === controller) setLoading(false)
    }
  }

  const confirm = async () => {
    if (!selected || bookingBusy) return
    setBookingBusy(true)
    setError(null)
    try {
      const selection = { program, slotGroupId: selected.slotGroupId, classDate: selected.date, ...qualification }
      let saved: LeadTrialBooking
      if (bookTrial) saved = await bookTrial(selection)
      else {
        if (!inviteId || !token || !session) throw new Error('Open the registration link again before booking a trial.')
        const response = await fetch(`${getApiUrl()}/api/signup/lead/${inviteId}/trial`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, session, freeTrial: { memberIndex: child.memberIndex, ...selection } }),
        })
        const body = await response.json()
        if (!response.ok || !body.success) throw new Error(body.message || 'Unable to confirm this trial. Refresh the dates and try again.')
        saved = body.data as LeadTrialBooking
      }
      if (saved.status !== 'confirmed' || saved.benefitType !== 'free_trial' || saved.totalCents !== 0) throw new Error('We could not confirm your free trial. Contact Vortex before attending.')
      onBooked({ ...saved, className: selected.className, classDate: selected.date, startTime: selected.startTime, endTime: selected.endTime,
        isTrialAssessment: saved.isTrialAssessment ?? selected.isTrialAssessment ?? isEvaluation })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to confirm the trial.')
      setSessions(null)
      setSelectedKey('')
    } finally {
      setBookingBusy(false)
    }
  }

  return <section className="rounded-xl border border-slate-200 p-4 sm:p-5" aria-labelledby={headingId}>
    <h3 id={headingId} className="text-lg font-semibold">{name}</h3>
    {booking ? <div ref={statusRef} tabIndex={-1} role="status" className="mt-3 space-y-1 rounded-lg bg-green-50 p-4 text-green-900">
      <p className="font-semibold">{booking.isTrialAssessment ? booking.status === 'attended' ? 'Private evaluation attended' : 'Private evaluation confirmed' : booking.status === 'attended' ? 'Free trial attended' : 'Free trial confirmed'} · $0</p>
      {booking.isTrialAssessment && <p>30 minutes · 1:1 with a coach</p>}
      {booking.className && <p>{booking.className}</p>}
      <p>{trialDateLabel(booking.classDate)}{booking.startTime ? ` · ${clockTime(booking.startTime)}${booking.endTime ? `–${clockTime(booking.endTime)}` : ''}` : ''}</p>
    </div> : <>
      <form className="mt-4 space-y-4" onSubmit={findDates}>
        <fieldset disabled={loading || bookingBusy} className="grid gap-4 sm:grid-cols-2">
          <label className="font-medium">Program for {child.firstName}
            <select className={fieldClass} value={program} onChange={event => { clearAvailability(); setProgram(event.target.value as FreeTrialProgram) }}>
              <option value="gymnastics">Gymnastics</option><option value="fit-flip">Fit &amp; Flip</option>
            </select>
          </label>
          {currentAge != null && currentAge >= 0 && currentAge < 18 && <label className="font-medium">Age on the trial date
            <select className={fieldClass} value={age} onChange={event => { clearAvailability(); setAge(Number(event.target.value)); setExperience(''); setPottyTrained(false) }}>
              <option value={currentAge}>{currentAge} years old</option>
              {currentAge < 17 && <option value={currentAge + 1}>{currentAge + 1} years old · after upcoming birthday</option>}
            </select>
          </label>}
          {program === 'gymnastics' && <label className="font-medium sm:col-span-2">Gymnastics experience
            <select className={fieldClass} required value={experience} onChange={event => { clearAvailability(); setExperience(event.target.value as typeof experience) }}>
              <option value="">Choose experience</option><option value="none">New to gymnastics</option><option value="experienced">Has gymnastics experience</option>
            </select>
          </label>}
          {program === 'gymnastics' && experience === 'none' && age >= 2 && age <= 3 && <label className="flex items-start gap-2 sm:col-span-2">
            <input type="checkbox" className="mt-1" checked={pottyTrained} onChange={event => { clearAvailability(); setPottyTrained(event.target.checked) }} />{staff ? 'The family confirmed this athlete is potty trained for Mommy & Me.' : 'I confirm my child is potty trained for Mommy & Me.'}
          </label>}
        </fieldset>
        {isEvaluation && <p className="text-sm text-slate-600">Book a free private 30-minute evaluation, 1:1 with a coach, to assess your child’s skills and recommend the right class. Each time is reserved for one athlete.</p>}
        {!ready && currentAge != null && age < 2 && program === 'gymnastics' && <p className="text-sm text-slate-600">Contact Vortex to find the right gymnastics starting point for this age.</p>}
        <button className={actionClass} disabled={!ready || loading || bookingBusy}>{isEvaluation ? loading ? 'Loading evaluation times…' : sessions ? 'Refresh evaluation times' : 'Find evaluation times' : loading ? 'Loading trial dates…' : sessions ? 'Refresh trial dates' : 'Find trial dates'}</button>
      </form>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {sessions && <div className="mt-5 space-y-4">
        {sessions.length === 0 ? <p role="status">{isEvaluation ? 'No private evaluation times are available for this age right now. Contact Vortex to arrange a placement evaluation.' : 'No trial dates are available for this program and age right now. Contact Vortex for help choosing a class.'}</p> : <>
          <label className="block font-medium">{isEvaluation ? 'Private evaluation time' : 'Free trial class and date'} for {child.firstName}
            <select className={fieldClass} value={selectedKey} disabled={bookingBusy} onChange={event => setSelectedKey(event.target.value)}>
              <option value="">{isEvaluation ? 'Choose an evaluation time' : 'Choose a trial date'}</option>
              {sessions.map(item => <option key={`${item.slotGroupId}:${item.date}`} value={`${item.slotGroupId}:${item.date}`} disabled={item.isFull}>
                {item.className} · {trialDateLabel(item.date)} · {clockTime(item.startTime)}–{clockTime(item.endTime)}{item.isFull ? ' · Full' : ''}
              </option>)}
            </select>
          </label>
          <p className="text-sm text-slate-500">All times {selected?.timeZone || sessions[0]?.timeZone || 'America/New_York'}.</p>
          <button type="button" className={actionClass} disabled={!selected || selected.isFull || bookingBusy} onClick={() => void confirm()}>{bookingBusy ? 'Confirming…' : isEvaluation ? 'Confirm free evaluation · $0' : 'Confirm free trial · $0'}</button>
        </>}
      </div>}
    </>}
  </section>
}
