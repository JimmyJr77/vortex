import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, Check } from 'lucide-react'
import { BUSINESS_FACILITY_PHOTO } from '../../config/contact'
import {
  JOB_AGE_GROUPS,
  JOB_CERTIFICATIONS,
  JOB_DISCIPLINES,
  JOB_EMPLOYMENT_TYPES,
  JOB_ROLES,
} from '../../config/jobApplication'
import { getApiUrl } from '../../utils/api'
import { isCompletePhoneNumber, PHONE_FORMAT_ERROR } from '../../utils/phoneUtils'
import './JobsPage.css'

const ratings = [1, 2, 3, 4, 5] as const
const getText = (data: FormData, field: string) => String(data.get(field) ?? '').trim()

export default function JobsPage() {
  const [coachingExperience, setCoachingExperience] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle')
  const [error, setError] = useState('')
  const activeRequest = useRef<AbortController | null>(null)
  const submission = useRef<{ requestId: string; details: string } | null>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const successRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => () => {
    activeRequest.current?.abort()
    activeRequest.current = null
  }, [])

  useEffect(() => {
    if (error) errorRef.current?.focus()
    if (status === 'success') successRef.current?.focus()
  }, [error, status])

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (activeRequest.current || status === 'success') return

    const data = new FormData(event.currentTarget)
    const firstName = getText(data, 'firstName')
    const lastName = getText(data, 'lastName')
    const phone = getText(data, 'phone')
    const availability = getText(data, 'availability')
    const coachedChildren = getText(data, 'coachedChildren') === 'yes'
    const ageGroups = coachedChildren ? data.getAll('ageGroup').map(String) : []
    const youthCoachingDetails = coachedChildren ? getText(data, 'youthCoachingDetails') : ''

    if (!firstName || !lastName) {
      setError('Enter your first and last name.')
      return
    }
    if (!isCompletePhoneNumber(phone)) {
      setError(PHONE_FORMAT_ERROR)
      return
    }
    if (!availability) {
      setError('Tell us what days and times you can work.')
      return
    }
    if (coachedChildren && (!ageGroups.length || !youthCoachingDetails)) {
      setError('Select the ages you’ve coached and describe the types of training you led.')
      return
    }

    const payload = {
      firstName,
      lastName,
      email: getText(data, 'email'),
      phone,
      role: getText(data, 'role'),
      availability,
      coachedChildren,
      ageGroups,
      youthCoachingDetails: youthCoachingDetails || undefined,
      ratings: Object.fromEntries(JOB_DISCIPLINES.map(({ value }) => [value, Number(data.get(value))])),
      employmentType: getText(data, 'employmentType') || undefined,
      earliestStartDate: getText(data, 'earliestStartDate') || undefined,
      workExperience: getText(data, 'workExperience') || undefined,
      certificationKeys: data.getAll('certificationKey').map(String),
      certifications: getText(data, 'certifications') || undefined,
      resumeUrl: getText(data, 'resumeUrl') || undefined,
      additionalInfo: getText(data, 'additionalInfo') || undefined,
    }
    const details = JSON.stringify(payload)
    // An unchanged submission can be retried without creating a second application.
    if (submission.current?.details !== details) {
      submission.current = { requestId: crypto.randomUUID(), details }
    }

    const controller = new AbortController()
    activeRequest.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    setError('')
    setStatus('sending')

    try {
      const response = await fetch(`${getApiUrl()}/api/public/job-applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: submission.current.requestId, ...payload }),
        signal: controller.signal,
      })
      const result: { success?: boolean; message?: string } | null = await response.json().catch(() => null)
      if (activeRequest.current !== controller) return
      if (!response.ok || result?.success !== true) {
        setError(typeof result?.message === 'string' && result.message
          ? result.message
          : 'We couldn’t confirm that your application was received. Please try again.')
        setStatus('idle')
        return
      }
      submission.current = null
      setStatus('success')
    } catch {
      if (activeRequest.current !== controller) return
      setError('We couldn’t confirm that your application was received. Check your connection and try again.')
      setStatus('idle')
    } finally {
      window.clearTimeout(timeout)
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }

  return (
    <div className="np-jobs-page">
      <section className="np-jobs-hero" aria-labelledby="np-jobs-heading">
        <div className="np-container np-jobs-hero-layout">
          <div>
            <p className="np-eyebrow">Bowie, Maryland</p>
            <h1 id="np-jobs-heading">Coaching jobs at Vortex Athletics</h1>
            <p>Apply to coach tumbling, gymnastics, or youth fitness.</p>
            {status !== 'success' && <a className="np-button" href="#job-application">
              Start application <ArrowDown size={17} aria-hidden="true" />
            </a>}
          </div>
          <img
            src={BUSINESS_FACILITY_PHOTO.src}
            srcSet={BUSINESS_FACILITY_PHOTO.srcSet}
            sizes="(max-width: 760px) calc(100vw - 44px), (max-width: 1320px) 45vw, 560px"
            width={BUSINESS_FACILITY_PHOTO.width}
            height={BUSINESS_FACILITY_PHOTO.height}
            alt={BUSINESS_FACILITY_PHOTO.alt}
          />
        </div>
      </section>

      <section id="job-application" className="np-container np-jobs-application" aria-labelledby="np-jobs-application-heading">
        {status === 'success' ? (
          <div className="np-jobs-success" role="status">
            <Check size={26} aria-hidden="true" />
            <h2 id="np-jobs-application-heading" ref={successRef} tabIndex={-1}>Application received</h2>
            <p>Thank you for applying to coach at Vortex Athletics.</p>
            <Link to="/">Back to Vortex Athletics <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        ) : (
          <>
            <h2 id="np-jobs-application-heading">Job application</h2>
            <form className="np-jobs-form" onSubmit={submitApplication} aria-labelledby="np-jobs-application-heading" aria-busy={status === 'sending'}>
              <fieldset className="np-jobs-form-fields" disabled={status === 'sending'}>
                <fieldset className="np-jobs-section">
                  <legend>Contact details</legend>
                  <div className="np-jobs-grid">
                    <label className="np-jobs-field">First name
                      <input name="firstName" autoComplete="given-name" maxLength={100} required />
                    </label>
                    <label className="np-jobs-field">Last name
                      <input name="lastName" autoComplete="family-name" maxLength={100} required />
                    </label>
                    <label className="np-jobs-field">Email
                      <input name="email" type="email" autoComplete="email" maxLength={254} required />
                    </label>
                    <label className="np-jobs-field">Phone number
                      <input name="phone" type="tel" autoComplete="tel" maxLength={30} required />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="np-jobs-section">
                  <legend>Role and availability</legend>
                  <div className="np-jobs-grid">
                    <label className="np-jobs-field">Which coaching role are you looking for?
                      <select name="role" defaultValue="" required>
                        <option value="" disabled>Select a role</option>
                        {JOB_ROLES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label className="np-jobs-field">Employment preference <span>(optional)</span>
                      <select name="employmentType" defaultValue="">
                        <option value="">Select a preference</option>
                        {JOB_EMPLOYMENT_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label className="np-jobs-field">Earliest start date <span>(optional)</span>
                      <input name="earliestStartDate" type="date" />
                    </label>
                    <label className="np-jobs-field np-jobs-wide">What days and times can you work?
                      <textarea name="availability" rows={3} maxLength={1000} required />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="np-jobs-section">
                  <legend>Coaching children</legend>
                  <fieldset className="np-jobs-choices">
                    <legend>Have you coached or trained children?</legend>
                    <div className="np-jobs-choice-list">
                      {[['yes', 'Yes'], ['no', 'No']].map(([value, label]) => <label key={value}>
                        <input
                          name="coachedChildren"
                          type="radio"
                          value={value}
                          checked={coachingExperience === value}
                          onChange={(event) => setCoachingExperience(event.target.value)}
                          required
                        />
                        {label}
                      </label>)}
                    </div>
                  </fieldset>
                  {coachingExperience === 'yes' && <>
                    <fieldset className="np-jobs-choices np-jobs-follow-up">
                      <legend>Which ages did you coach? Select all that apply.</legend>
                      <div className="np-jobs-choice-list">
                        {JOB_AGE_GROUPS.map(({ value, label }) => <label key={value}>
                          <input name="ageGroup" type="checkbox" value={value} />
                          {label}
                        </label>)}
                      </div>
                    </fieldset>
                    <label className="np-jobs-field np-jobs-follow-up">What types of training did you lead with children?
                      <textarea
                        name="youthCoachingDetails"
                        rows={4}
                        maxLength={2000}
                        placeholder="Include where you coached, how long, and the types of classes or training you led."
                        required
                      />
                    </label>
                  </>}
                </fieldset>

                <fieldset className="np-jobs-section" aria-describedby="np-jobs-rating-scale">
                  <legend>Rate your experience</legend>
                  <p id="np-jobs-rating-scale" className="np-jobs-help">Choose a rating for each discipline. 1 means no experience and 5 means expert level.</p>
                  <div className="np-jobs-ratings">
                    {JOB_DISCIPLINES.map(({ value, label }) => (
                      <fieldset key={value} className="np-jobs-rating">
                        <legend>{label}</legend>
                        <div className="np-jobs-rating-options">
                          {ratings.map(rating => <label key={rating}>
                            <input
                              type="radio"
                              name={value}
                              value={rating}
                              aria-label={rating === 1 ? '1, no experience' : rating === 5 ? '5, expert level' : String(rating)}
                              required
                            />
                            <span aria-hidden="true">{rating}</span>
                          </label>)}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="np-jobs-section">
                  <legend>Certifications and training</legend>
                  <fieldset className="np-jobs-choices">
                    <legend>Select any certifications or training you’ve completed.</legend>
                    <div className="np-jobs-certifications">
                      {JOB_CERTIFICATIONS.map(({ value, label }) => <label key={value}>
                        <input name="certificationKey" type="checkbox" value={value} />
                        {label}
                      </label>)}
                    </div>
                  </fieldset>
                  <label className="np-jobs-field np-jobs-follow-up">Other certifications <span>(optional)</span>
                    <textarea name="certifications" rows={3} maxLength={1500} placeholder="Include the issuer, level, or expiration dates if you know them." />
                  </label>
                </fieldset>

                <fieldset className="np-jobs-section">
                  <legend>Work history and résumé</legend>
                  <div className="np-jobs-grid">
                    <label className="np-jobs-field np-jobs-wide">Relevant work or volunteer experience <span>(optional)</span>
                      <textarea name="workExperience" rows={4} maxLength={3000} placeholder="Include organizations, roles, and approximate dates." />
                    </label>
                    <label className="np-jobs-field np-jobs-wide">Link to your résumé or portfolio <span>(optional)</span>
                      <input name="resumeUrl" type="url" maxLength={2048} placeholder="https://" />
                    </label>
                    <label className="np-jobs-field np-jobs-wide">Anything else you’d like us to know? <span>(optional)</span>
                      <textarea name="additionalInfo" rows={3} maxLength={1500} />
                    </label>
                  </div>
                </fieldset>

                <div className="np-jobs-submit">
                  <p>We use your information to review your application and contact you about coaching opportunities. <Link to="/privacy-policy">Privacy policy</Link></p>
                  <button className="np-button" type="submit">
                    {status === 'sending' ? 'Submitting application…' : 'Submit application'}
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </div>
              </fieldset>
              {error && <p ref={errorRef} className="np-jobs-error" role="alert" tabIndex={-1}>{error}</p>}
            </form>
          </>
        )}
      </section>
    </div>
  )
}
