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
import { getPublicBookingProgramName, getPublicBookingPrograms } from '../utils/publicBookingPrograms'
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

function EnrollmentHero({ signup = false }: { signup?: boolean }) {
  return (
    <section className="np-enrollment-hero">
      <div className="np-enrollment-wrap">
        <p className="np-enrollment-eyebrow">Your next chapter starts here</p>
        <h1>{signup ? 'Enroll' : 'Classes Offered'}</h1>
        <p className="np-enrollment-intro">
          {signup
            ? 'Choose an offering and time to complete your signup.'
            : 'Choose every class time you want, review pricing, then create your family account and assign each class.'}
        </p>
        {!signup && (
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

  const [offeredPrograms, setOfferedPrograms] = useState<PublicProgramOffered[]>([])
  const [selectedFormId, setSelectedFormId] = useState<number | null>(
    shouldOpenSignupDirectly ? urlFormId : null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signupComplete, setSignupComplete] = useState(false)

  useEffect(() => {
    fetchClassesOffered()
      .then((response) => setOfferedPrograms(getPublicBookingPrograms(response.programs)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load enroll options'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (urlEmail) saveSchedulingMemberEmail(urlEmail)
  }, [urlEmail])

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

  if (selectedFormId != null) {
    return (
      <div className="np-enrollment-page">
        <EnrollmentHero signup />
        <section className="np-enrollment-content">
          <div className="np-enrollment-wrap np-enrollment-signup space-y-6">
            <button type="button" onClick={() => { setSelectedFormId(null); setSignupComplete(false) }} className="np-enrollment-button np-enrollment-button-secondary">
              <ArrowLeft className="w-4 h-4" /> {signupComplete ? 'Return to classes' : 'Back to classes'}
            </button>
            <SchedulingSignupEmbed
              key={`${selectedFormId}:${urlOfferingId ?? 'none'}:${urlSlotGroupId ?? 'none'}:${urlTimeSlotId ?? 'none'}:${urlEnrollmentStartDate ?? 'none'}`}
              formId={selectedFormId}
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

  if (loading) {
    return (
      <div className="np-enrollment-page np-enrollment-state" role="status">
        <Loader2 className="w-8 h-8 animate-spin text-vortex-red" aria-hidden="true" />
        <p>Loading classes…</p>
      </div>
    )
  }

  if (offeredPrograms.length === 0) {
    return (
      <div className="np-enrollment-page">
        <EnrollmentHero signup />
        <section className="np-enrollment-state">
          <Calendar className="w-9 h-9 text-vortex-red" aria-hidden="true" />
          <p>{error || 'No enroll options are open right now. Check back soon.'}</p>
        </section>
      </div>
    )
  }

  return (
    <div className="np-enrollment-page">
      <EnrollmentHero />
      <section className="np-enrollment-content">
        <div className="np-enrollment-wrap space-y-6">
          <EnrollmentOrderEditor onSaved={async () => {
            const response = await fetchClassesOffered()
            setOfferedPrograms(getPublicBookingPrograms(response.programs))
          }} />
          <PublicClassesOfferedEnroll
            apiUrl={apiUrl}
            programs={offeredPrograms}
            initialProgramId={initialProgramId}
            initialFocusedFormId={urlFormId}
          />
        </div>
      </section>
    </div>
  )
}

export default SchedulingPage
