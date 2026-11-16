import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Check, LoaderCircle } from 'lucide-react'
import { TEAM_EMAIL } from '../../config/contact'
import { INQUIRY_INTERESTS, SUBMITTER_ROLES } from '../../config/inquiryOptions'
import { getApiUrl } from '../../utils/api'
import { isCompletePhoneNumber, PHONE_FORMAT_ERROR } from '../../utils/phoneUtils'
import { adaptRegistrationPayloadForApi, getRegistrationApiCapabilities } from '../../utils/registrationApi'
import './NewPageInquiry.css'

interface NewPageInquiryProps {
  program?: 'gymnastics' | 'fit-flip'
  onDone?: () => void
}

type ProgramChoice = NonNullable<NewPageInquiryProps['program']> | 'undecided'

const programLabels: Record<ProgramChoice, string> = {
  gymnastics: 'Gymnastics',
  'fit-flip': 'Fit & Flip',
  undecided: 'Help me choose',
}

export default function NewPageInquiry({ program, onDone }: NewPageInquiryProps) {
  const [selectedProgram, setSelectedProgram] = useState<ProgramChoice>(program ?? 'undecided')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle')
  const [error, setError] = useState('')
  const activeRequest = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      activeRequest.current?.abort()
    }
  }, [])

  useEffect(() => {
    setSelectedProgram(program ?? 'undecided')
  }, [program])

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (activeRequest.current || status === 'success') return

    const data = new FormData(event.currentTarget)
    const firstName = String(data.get('firstName') ?? '').trim()
    const lastName = String(data.get('lastName') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    const phone = String(data.get('phone') ?? '').trim()
    const message = String(data.get('message') ?? '').trim()
    const submitterRole = String(data.get('submitterRole') ?? '')

    if (firstName.length < 2 || lastName.length < 2) {
      setError('Please enter at least two characters for both your first and last name.')
      return
    }
    if (!SUBMITTER_ROLES.some((role) => role === submitterRole)) {
      setError('Please tell us whether you are a parent or guardian, athlete, or other contact.')
      return
    }
    if (phone && !isCompletePhoneNumber(phone)) {
      setError(PHONE_FORMAT_ERROR)
      return
    }

    const controller = new AbortController()
    activeRequest.current = controller
    setError('')
    setStatus('sending')
    const timeout = window.setTimeout(() => controller.abort(), 15000)

    try {
      const interests = INQUIRY_INTERESTS.filter((interest) => selectedProgram === 'gymnastics'
        ? interest === 'Gymnastics'
        : selectedProgram === 'fit-flip' && interest !== 'Gymnastics')
      const payload = {
        firstName,
        lastName,
        email,
        ...(phone ? { phone } : {}),
        submitterRole,
        newsletter: false,
        ...(interests.length ? { interests } : {}),
        inquirySource: '/newpage',
        message: `Program interest: ${programLabels[selectedProgram]}${message ? `\n\n${message}` : ''}`,
      }
      const capabilities = await getRegistrationApiCapabilities()
      if (controller.signal.aborted) throw new Error('request-aborted')
      const response = await fetch(`${getApiUrl()}/api/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adaptRegistrationPayloadForApi(payload, capabilities.registrationInquiryOverhaul)),
        signal: controller.signal,
      })
      const result: { success?: boolean; message?: string; errors?: unknown[] } = await response.json()
      if (!response.ok || result.success !== true) {
        const details = Array.isArray(result.errors)
          ? result.errors.filter((item): item is string => typeof item === 'string').join(' ')
          : ''
        throw new Error(details || result.message || 'Your inquiry could not be saved. Please try again.')
      }
      if (mounted.current) setStatus('success')
    } catch (failure) {
      if (mounted.current) {
        setStatus('idle')
        setError(controller.signal.aborted
          ? 'We couldn’t confirm your inquiry before the connection timed out. Please email us or try again.'
          : failure instanceof TypeError || failure instanceof SyntaxError
            ? 'We couldn’t confirm your inquiry. Please check your connection and try again, or email us below.'
            : failure instanceof Error ? failure.message : 'We couldn’t confirm your inquiry. Please try again.')
      }
    } finally {
      window.clearTimeout(timeout)
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }

  if (status === 'success') {
    return (
      <div className="np-inquiry np-inquiry-success" role="status" aria-live="polite">
        <span className="np-inquiry-success-icon"><Check size={26} aria-hidden="true" /></span>
        <p className="np-inquiry-eyebrow">Your next chapter starts here</p>
        <h2 id="np-inquiry-title">You’re on our radar.</h2>
        <p>Your inquiry has been received. The Vortex team will be in touch to talk through your athlete’s goals and help find the right program.</p>
        {onDone && <button className="np-inquiry-submit" type="button" onClick={onDone}>Back to exploring <ArrowRight size={18} aria-hidden="true" /></button>}
      </div>
    )
  }

  return (
    <div className="np-inquiry">
      <p className="np-inquiry-eyebrow">Start a conversation</p>
      <h2 id="np-inquiry-title">Let’s find their next level.</h2>
      <p className="np-inquiry-intro">Tell us a little about your athlete. We’ll help you find the right place to start.</p>
      <form onSubmit={handleSubmit} aria-busy={status === 'sending'}>
        <fieldset disabled={status === 'sending'}>
          <legend className="np-inquiry-sr-only">Your contact details and program interests</legend>
          <div className="np-inquiry-grid">
            <label htmlFor="np-inquiry-first-name">First name <span aria-hidden="true">*</span>
              <input id="np-inquiry-first-name" name="firstName" autoComplete="given-name" required minLength={2} maxLength={50} />
            </label>
            <label htmlFor="np-inquiry-last-name">Last name <span aria-hidden="true">*</span>
              <input id="np-inquiry-last-name" name="lastName" autoComplete="family-name" required minLength={2} maxLength={50} />
            </label>
            <label htmlFor="np-inquiry-email">Email <span aria-hidden="true">*</span>
              <input id="np-inquiry-email" name="email" type="email" autoComplete="email" required maxLength={255} />
            </label>
            <label htmlFor="np-inquiry-phone">Phone <span className="np-inquiry-optional">(optional)</span>
              <input id="np-inquiry-phone" name="phone" type="tel" autoComplete="tel" placeholder="443-555-0123" maxLength={25} />
            </label>
            <label htmlFor="np-inquiry-role">I am a… <span aria-hidden="true">*</span>
              <select id="np-inquiry-role" name="submitterRole" required defaultValue="">
                <option value="" disabled>Select one</option>
                {SUBMITTER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label htmlFor="np-inquiry-program">I’m interested in
              <select id="np-inquiry-program" value={selectedProgram} onChange={(event) => setSelectedProgram(event.target.value as ProgramChoice)}>
                {Object.entries(programLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label htmlFor="np-inquiry-message">What would you like to work toward? <span className="np-inquiry-optional">(optional)</span>
            <textarea id="np-inquiry-message" name="message" rows={3} maxLength={800} placeholder="Their sport, experience, goals, or any questions for us." />
          </label>
          <p className="np-inquiry-note">* Required. We’ll use your details to respond to your inquiry. <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy policy</a></p>
          <button type="submit" className="np-inquiry-submit">
            {status === 'sending' ? <><LoaderCircle className="np-inquiry-spinner" size={18} aria-hidden="true" /> Sending inquiry…</> : <>Talk to our team <ArrowRight size={18} aria-hidden="true" /></>}
          </button>
        </fieldset>
        {error && <p ref={errorRef} className="np-inquiry-error" role="alert" tabIndex={-1}>{error}</p>}
      </form>
      <p className="np-inquiry-contact">Prefer email? <a href={`mailto:${TEAM_EMAIL}`}>{TEAM_EMAIL}</a></p>
    </div>
  )
}
