import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react'
import {
  saveSchedulingMemberEmail,
  type SchedulingSignupCompleteDetail,
} from '../utils/schedulingApi'
import { getLoggedInMemberEmail } from '../utils/portalSession'
import {
  fetchClassesOffered,
  type PublicProgramOffered,
} from '../utils/publicClassesApi'
import { getEnrollCatalogDefault } from '../utils/enrollSite'
import { getApiUrl } from '../utils/api'
import SchedulingSignupEmbed from './SchedulingSignupEmbed'
import PublicClassesOfferedEnroll from './enroll/PublicClassesOfferedEnroll'

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

const SchedulingPage = () => {
  const apiUrl = getApiUrl()
  const catalogDefault = useMemo(() => getEnrollCatalogDefault(), [])
  const [searchParams] = useSearchParams()
  const urlFormId = useMemo(
    () => parseOptionalInt(searchParams.get('form')) ?? null,
    [searchParams],
  )
  const urlProgramsId = useMemo(
    () => parseOptionalInt(searchParams.get('programsId')) ?? null,
    [searchParams],
  )
  const urlSportFilter = searchParams.get('sportFilter')
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
      .then((response) => setOfferedPrograms(response.programs))
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
    const requestedName = urlProgramName || (catalogDefault.type === 'program' ? catalogDefault.value : null)
    if (!requestedName) return null
    const normalized = normalizeFilterName(requestedName)
    return offeredPrograms.find((program) => {
      const programName = normalizeFilterName(program.displayName)
      return programName === normalized || programName.includes(normalized) || normalized.includes(programName)
    })?.id ?? null
  }, [catalogDefault, offeredPrograms, urlFormId, urlProgramName, urlProgramsId])

  const initialSportFilter =
    urlSportFilter || (catalogDefault.type === 'sport' ? catalogDefault.value : 'all')

  const handleSignupComplete = useCallback((detail: SchedulingSignupCompleteDetail) => {
    setSignupComplete(detail.completed)
    if (detail.email) saveSchedulingMemberEmail(detail.email)
  }, [])

  if (selectedFormId != null) {
    return (
      <div className="min-h-screen bg-white">
        <section className="bg-gradient-to-br from-black via-gray-900 to-black pt-below-site-header pb-12">
          <div className="container-custom text-center">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">Enroll</h1>
            <p className="text-gray-300 max-w-2xl mx-auto text-lg">Choose an offering and time to complete your signup.</p>
          </div>
        </section>
        <section className="section-padding bg-gray-50">
          <div className="container-custom max-w-3xl mx-auto space-y-6">
            <button type="button" onClick={() => { setSelectedFormId(null); setSignupComplete(false) }} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:text-black">
              <ArrowLeft className="w-4 h-4" /> {signupComplete ? 'Return to classes' : 'Back to classes'}
            </button>
            <SchedulingSignupEmbed
              key={`${selectedFormId}:${urlOfferingId ?? 'none'}:${urlSlotGroupId ?? 'none'}:${urlTimeSlotId ?? 'none'}`}
              formId={selectedFormId}
              initialOfferingId={urlOfferingId}
              initialSlotGroupId={urlSlotGroupId}
              initialTimeSlotId={urlTimeSlotId}
              initialAuthToken={urlAuthToken}
              initialEmail={urlEmail ?? getLoggedInMemberEmail()}
              onSignupComplete={handleSignupComplete}
            />
          </div>
        </section>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-vortex-red" /></div>
  }

  if (offeredPrograms.length === 0) {
    return (
      <section className="section-padding pt-below-site-header bg-white min-h-[50vh]">
        <div className="container-custom max-w-2xl mx-auto text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-3xl font-display font-bold text-black mb-4">Enroll</h1>
          <p className="text-gray-600">{error || 'No enroll options are open right now. Check back soon.'}</p>
        </div>
      </section>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-black via-gray-900 to-black pt-below-site-header pb-12">
        <div className="container-custom text-center">
          <motion.h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>Classes Offered</motion.h1>
          <p className="text-gray-300 max-w-2xl mx-auto text-lg">Choose every class time you want, review pricing, then create your family account and assign each class.</p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup/family" className="inline-flex items-center rounded-lg bg-vortex-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Create a new family account</Link>
            <Link to="/signup/family?mode=minor" className="inline-flex items-center rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Under 18? Invite a parent to finish</Link>
          </div>
        </div>
      </section>

      <section className="section-padding bg-gray-50">
        <div className="container-custom max-w-5xl mx-auto">
          <PublicClassesOfferedEnroll
            apiUrl={apiUrl}
            programs={offeredPrograms}
            initialSportFilter={initialSportFilter}
            initialProgramId={initialProgramId}
            initialFocusedFormId={urlFormId}
          />
        </div>
      </section>
    </div>
  )
}

export default SchedulingPage
