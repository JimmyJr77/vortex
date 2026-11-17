import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Calendar, Loader2 } from 'lucide-react'
import {
  saveSchedulingMemberEmail,
  type SchedulingSignupCompleteDetail,
} from '../utils/schedulingApi'
import { getLoggedInMemberEmail } from '../utils/portalSession'
import {
  fetchClassesOffered,
  type PublicProgramOffered,
} from '../utils/publicClassesApi'
import {
  ADULT_BOOKING_HREF,
  ADULT_BOOKING_PROGRAM,
  getPublicBookingProgramName,
  getPublicBookingPrograms,
} from '../utils/publicBookingPrograms'
import { getApiUrl } from '../utils/api'
import SchedulingSignupEmbed from './SchedulingSignupEmbed'
import PublicClassesOfferedEnroll from './enroll/PublicClassesOfferedEnroll'
import EnrollmentOrderEditor from './enroll/EnrollmentOrderEditor'
import './enroll/PublicEnrollment.css'

function parseOptionalInt(raw: string | null): number | null | undefined {
  if (raw == null || raw === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function normalizeFilterName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/trampoline/g, 'tramp')
    .replace(/tumbling/g, 'tumble')
    .replace(/[^a-z0-9]+/g, '')
}

const adultProgramName = normalizeFilterName(ADULT_BOOKING_PROGRAM)

const enrollmentHeroCopy = {
  browse: {
    heading: 'Classes Offered',
    intro: 'Explore youth gymnastics, Fit & Flip, and adult gymnastics in Bowie, MD. See class times and pricing, then enroll through your Vortex account.',
  },
  signup: {
    heading: 'Enroll',
    intro: 'Choose an offering and time to complete your signup.',
  },
  adult: {
    heading: 'Adult gymnastics classes',
    intro: 'Find current Typhoons fitness and acrobatics classes for adults 18 and up in Bowie, MD.',
  },
}

function EnrollmentHero({ mode = 'browse' }: { mode?: keyof typeof enrollmentHeroCopy }) {
  const { heading, intro } = enrollmentHeroCopy[mode]
  return (
    <section className="np-enrollment-hero">
      <div className="np-enrollment-wrap">
        <p className="np-enrollment-eyebrow">Your next chapter starts here</p>
        <h1>{heading}</h1>
        <p className="np-enrollment-intro">
          {intro}
          {mode === 'browse' && <>
            {' '}For ages 18 and up,{' '}
            <Link to={ADULT_BOOKING_HREF} className="font-semibold text-vortex-red underline underline-offset-4"
              data-analytics-cta="browse_classes" data-analytics-section="adult_enrollment_entry">
              see adult gymnastics class times
            </Link>.
          </>}
        </p>
        {mode === 'browse' && (
          <div className="np-enrollment-actions">
            <Link to="/signup/family" className="np-enrollment-button">
              Create a new family account <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link to="/signup/family?mode=minor" className="np-enrollment-button np-enrollment-button-secondary">
              Under 18? Invite a parent to finish <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

const SchedulingPage = () => {
  const apiUrl = getApiUrl()
  const [searchParams] = useSearchParams()
  const urlFormId = useMemo(
    () => parseOptionalInt(searchParams.get('form')) ?? null,
    [searchParams],
  )
  const urlProgramsId = useMemo(
    () => parseOptionalInt(searchParams.get('programsId')) ?? null,
    [searchParams],
  )
  const urlProgramName = searchParams.get('program')
  const urlOfferingId = useMemo(
    () => parseOptionalInt(searchParams.get('offeringId')),
    [searchParams],
  )
  const urlSlotGroupId = useMemo(
    () => parseOptionalInt(searchParams.get('slotGroupId')),
    [searchParams],
  )
  const urlTimeSlotId = useMemo(
    () => parseOptionalInt(searchParams.get('timeSlotId')),
    [searchParams],
  )
  const urlAuthToken = searchParams.get('auth')
  const urlEmail = searchParams.get('email')
  const urlEnrollmentStartDate = searchParams.get('enrollmentStartDate')
  const shouldOpenSignupDirectly = Boolean(
    urlFormId != null && (urlAuthToken || urlOfferingId || urlSlotGroupId || urlTimeSlotId),
  )

  const [catalogPrograms, setCatalogPrograms] = useState<PublicProgramOffered[]>([])
  const [selectedFormId, setSelectedFormId] = useState<number | null>(
    shouldOpenSignupDirectly ? urlFormId : null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signupComplete, setSignupComplete] = useState(false)

  useEffect(() => {
    fetchClassesOffered()
      .then((response) => setCatalogPrograms(response.programs))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load enroll options'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (urlEmail) saveSchedulingMemberEmail(urlEmail)
  }, [urlEmail])

  const offeredPrograms = useMemo(() => getPublicBookingPrograms(catalogPrograms), [catalogPrograms])
  const wantsAdultClasses = urlProgramName !== null && normalizeFilterName(urlProgramName) === adultProgramName
  const adultClasses = catalogPrograms
    .find((program) => normalizeFilterName(program.displayName) === adultProgramName)
    ?.classes.filter((classItem) => classItem.enrollVisible === true && classItem.formId != null) ?? []
  const linkedAdultClass = urlFormId != null
    ? adultClasses.find((classItem) => classItem.formId === urlFormId)
    : wantsAdultClasses && adultClasses.length === 1 ? adultClasses[0] : undefined
  const signupFormId = shouldOpenSignupDirectly ? selectedFormId : linkedAdultClass?.formId ?? null

  const initialProgramId = useMemo(() => {
    if (urlProgramsId != null && offeredPrograms.some((program) => program.id === urlProgramsId)) {
      return urlProgramsId
    }
    if (urlFormId != null) {
      const matchingProgram = offeredPrograms.find((program) =>
        program.classes.some((classItem) => classItem.formId === urlFormId),
      )
      if (matchingProgram) return matchingProgram.id
    }
    const requestedName = urlProgramName && (getPublicBookingProgramName(urlProgramName) ?? urlProgramName)
    if (!requestedName) return null
    const normalized = normalizeFilterName(requestedName)
    return offeredPrograms.find((program) => {
      const programName = normalizeFilterName(program.displayName)
      return programName === normalized || programName.includes(normalized) || normalized.includes(programName)
    })?.id ?? null
  }, [offeredPrograms, urlFormId, urlProgramName, urlProgramsId])

  const handleSignupComplete = useCallback((detail: SchedulingSignupCompleteDetail) => {
    setSignupComplete(detail.completed)
    if (detail.email) saveSchedulingMemberEmail(detail.email)
  }, [])

  if (signupFormId != null) {
    const backLabel = signupComplete ? 'Return to classes' : 'Back to classes'
    return (
      <div className="np-enrollment-page">
        <EnrollmentHero mode="signup" />
        <section className="np-enrollment-content">
          <div className="np-enrollment-wrap np-enrollment-signup space-y-6">
            {linkedAdultClass ? (
              <Link to={adultClasses.length > 1 ? ADULT_BOOKING_HREF : '/adult-gymnastics'} className="np-enrollment-button np-enrollment-button-secondary" onClick={() => { setSelectedFormId(null); setSignupComplete(false) }}>
                <ArrowLeft className="w-4 h-4" /> {backLabel}
              </Link>
            ) : (
              <button type="button" onClick={() => { setSelectedFormId(null); setSignupComplete(false) }} className="np-enrollment-button np-enrollment-button-secondary">
                <ArrowLeft className="w-4 h-4" /> {backLabel}
              </button>
            )}
            <SchedulingSignupEmbed
              key={`${signupFormId}:${urlOfferingId ?? 'none'}:${urlSlotGroupId ?? 'none'}:${urlTimeSlotId ?? 'none'}:${urlEnrollmentStartDate ?? 'none'}`}
              formId={signupFormId}
              initialOfferingId={urlOfferingId}
              initialSlotGroupId={urlSlotGroupId}
              initialTimeSlotId={urlTimeSlotId}
              initialAuthToken={urlAuthToken}
              initialEmail={urlEmail ?? getLoggedInMemberEmail()}
              initialEnrollmentStartDate={urlEnrollmentStartDate}
              onSignupComplete={handleSignupComplete}
            />
          </div>
        </section>
      </div>
    )
  }

  if (wantsAdultClasses) {
    return (
      <div className="np-enrollment-page">
        <EnrollmentHero mode="adult" />
        <section className="np-enrollment-content" data-prerender-dynamic="">
          {loading ? (
            <div className="np-enrollment-state" role="status">
              <Loader2 className="w-8 h-8 animate-spin text-vortex-red" aria-hidden="true" />
              <p>Loading classes…</p>
            </div>
          ) : (
            <div className="np-enrollment-wrap space-y-6">
              {adultClasses.length ? (
                <ul className="space-y-3" aria-label="Available adult classes">
                  {adultClasses.map((classItem) => (
                    <li key={classItem.id}>
                      <Link to={`/enroll?form=${classItem.formId}`} className="np-enrollment-button">
                        {classItem.displayName} <ArrowUpRight size={17} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{error ? 'We couldn’t load the current adult schedule.' : 'There are no adult classes open for online enrollment right now.'}</p>
              )}
              <Link to="/contact" className="np-enrollment-button np-enrollment-button-secondary">
                Contact us about adult classes <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="np-enrollment-page">
      <EnrollmentHero />
      {!urlProgramName && urlProgramsId == null && urlFormId == null && (
        <section className="np-enrollment-wrap np-enrollment-class-selection" aria-labelledby="enrollment-class-selection">
          <h2 id="enrollment-class-selection">Find a class by age and experience</h2>
          <ul>
            <li>
              <Link to="/gymnastics">Youth gymnastics</Link>
              <p>Look for parent-and-child or preschool gymnastics for younger children, or Tornadoes for school-age beginners.</p>
            </li>
            <li>
              <Link to="/fit-and-flip">Fit &amp; Flip youth fitness</Link>
              <p>Build strength, power, and body control with coached training for kids starting out or conditioning for a sport.</p>
            </li>
            <li>
              <Link to="/adult-gymnastics">Typhoons adult gymnastics</Link>
              <p>Work on strength and mobility and learn introductory acrobatics. Beginners and returning gymnasts are welcome.</p>
            </li>
          </ul>
        </section>
      )}
      <section className="np-enrollment-content" data-prerender-dynamic="">
        {loading ? (
          <div className="np-enrollment-state" role="status">
            <Loader2 className="w-8 h-8 animate-spin text-vortex-red" aria-hidden="true" />
            <p>Loading classes…</p>
          </div>
        ) : offeredPrograms.length ? (
          <div className="np-enrollment-wrap space-y-6">
            <EnrollmentOrderEditor onSaved={async () => {
              const response = await fetchClassesOffered()
              setCatalogPrograms(response.programs)
            }} />
            <PublicClassesOfferedEnroll
              apiUrl={apiUrl}
              programs={offeredPrograms}
              initialProgramId={initialProgramId}
              initialFocusedFormId={urlFormId}
            />
          </div>
        ) : (
          <div className="np-enrollment-state">
            <Calendar className="w-9 h-9 text-vortex-red" aria-hidden="true" />
            <p>{error || 'No enroll options are open right now. Check back soon.'}</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default SchedulingPage
