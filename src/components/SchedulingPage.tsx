import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, ChevronRight, Loader2 } from 'lucide-react'
import {
  fetchPublicSchedulingForms,
  saveSchedulingMemberEmail,
  type SchedulingFormSummary,
  type SchedulingSignupCompleteDetail,
} from '../utils/schedulingApi'
import { fetchClassesOffered } from '../utils/publicClassesApi'
import SchedulingSignupEmbed from './SchedulingSignupEmbed'

function parseOptionalInt(raw: string | null): number | null | undefined {
  if (raw == null || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

type EnrollProgramGroup = {
  programsId: number
  displayName: string
  forms: SchedulingFormSummary[]
}

function resolveProgramDisplayName(
  form: SchedulingFormSummary,
  programNames: Map<number, string>,
): string {
  const fromForm = form.programDisplayName?.trim()
  if (fromForm) return fromForm
  const programsId = form.programsId
  if (programsId != null) {
    const fromLookup = programNames.get(programsId)?.trim()
    if (fromLookup) return fromLookup
  }
  return 'Unknown program'
}

function groupFormsByProgram(
  forms: SchedulingFormSummary[],
  programNames: Map<number, string>,
): EnrollProgramGroup[] {
  const byId = new Map<number, EnrollProgramGroup>()
  for (const form of forms) {
    const programsId = form.programsId
    if (programsId == null) continue
    let group = byId.get(programsId)
    const displayName = resolveProgramDisplayName(form, programNames)
    if (!group) {
      group = {
        programsId,
        displayName,
        forms: [],
      }
      byId.set(programsId, group)
    } else if (
      group.displayName === 'Unknown program' &&
      displayName !== 'Unknown program'
    ) {
      group.displayName = displayName
    }
    group.forms.push(form)
  }
  for (const group of byId.values()) {
    group.forms.sort((a, b) => a.title.localeCompare(b.title))
  }
  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
}

const cardClass =
  'text-left rounded-2xl border p-6 shadow-sm transition-all bg-white border-gray-200 hover:border-vortex-red hover:shadow-md group w-full'

const SchedulingPage = () => {
  const [searchParams] = useSearchParams()
  const urlFormId = useMemo(() => {
    const parsed = parseOptionalInt(searchParams.get('form'))
    return parsed ?? null
  }, [searchParams])
  const urlProgramsId = useMemo(
    () => parseOptionalInt(searchParams.get('programsId')),
    [searchParams],
  )
  const urlCategoryId = useMemo(
    () => parseOptionalInt(searchParams.get('categoryId')),
    [searchParams],
  )
  const urlAuthToken = searchParams.get('auth')
  const urlEmail = searchParams.get('email')

  const [forms, setForms] = useState<SchedulingFormSummary[]>([])
  const [programNames, setProgramNames] = useState<Map<number, string>>(() => new Map())
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null)
  const [selectedFormId, setSelectedFormId] = useState<number | null>(urlFormId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signupComplete, setSignupComplete] = useState(false)

  const programs = useMemo(
    () => groupFormsByProgram(forms, programNames),
    [forms, programNames],
  )

  const selectedProgram = useMemo(
    () => programs.find((program) => program.programsId === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  )

  const step = selectedFormId != null ? 'signup' : selectedProgramId != null ? 'class' : 'program'

  useEffect(() => {
    Promise.all([fetchPublicSchedulingForms(), fetchClassesOffered()])
      .then(([data, offered]) => {
        const names = new Map<number, string>()
        for (const program of offered.programs) {
          const label = program.displayName?.trim()
          if (label) names.set(program.id, label)
        }
        setProgramNames(names)
        setForms(data)
        const grouped = groupFormsByProgram(data, names)

        if (urlFormId != null) {
          const match = data.find((form) => form.id === urlFormId)
          if (match?.programsId != null) {
            setSelectedProgramId(match.programsId)
            setSelectedFormId(match.id)
            return
          }
        }

        if (urlProgramsId != null && grouped.some((program) => program.programsId === urlProgramsId)) {
          setSelectedProgramId(urlProgramsId)
          return
        }

        if (urlFormId != null && data.some((form) => form.id === urlFormId)) {
          setSelectedFormId(urlFormId)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load enroll options'))
      .finally(() => setLoading(false))
  }, [urlFormId, urlProgramsId])

  const handleSignupComplete = useCallback((detail: SchedulingSignupCompleteDetail) => {
    setSignupComplete(detail.completed)
    if (detail.email) {
      saveSchedulingMemberEmail(detail.email)
    }
  }, [])

  const backToPrograms = useCallback(() => {
    setSelectedProgramId(null)
    setSelectedFormId(null)
    setSignupComplete(false)
  }, [])

  const backToClasses = useCallback(() => {
    setSelectedFormId(null)
    setSignupComplete(false)
  }, [])

  useEffect(() => {
    if (urlEmail) saveSchedulingMemberEmail(urlEmail)
  }, [urlEmail])

  const heroSubtitle =
    step === 'program'
      ? 'Choose a program to get started.'
      : step === 'class'
        ? `Choose a class in ${selectedProgram?.displayName ?? 'this program'}.`
        : 'Choose a category, offering, and time slot to complete your signup.'

  if (loading && forms.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-vortex-red" />
      </div>
    )
  }

  if (programs.length === 0) {
    return (
      <section className="section-padding pt-below-site-header bg-white min-h-[50vh]">
        <div className="container-custom max-w-2xl mx-auto text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-3xl font-display font-bold text-black mb-4">Enroll</h1>
          <p className="text-gray-600">
            {error || 'No enroll options are open right now. Check back soon.'}
          </p>
        </div>
      </section>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-black via-gray-900 to-black pt-below-site-header pb-12">
        <div className="container-custom text-center">
          <motion.h1
            className="text-4xl md:text-5xl font-display font-bold text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Enroll
          </motion.h1>
          <p className="text-gray-300 max-w-2xl mx-auto text-lg">{heroSubtitle}</p>
        </div>
      </section>

      <section className="section-padding bg-gray-50">
        <div className="container-custom max-w-3xl mx-auto">
          {step === 'program' && (
            <div className="space-y-4">
              <h2 className="text-xl font-display font-bold text-black">Program</h2>
              <div className="grid grid-cols-1 gap-4">
                {programs.map((program) => (
                  <button
                    key={program.programsId}
                    type="button"
                    onClick={() => setSelectedProgramId(program.programsId)}
                    className={cardClass}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-display font-bold text-black group-hover:text-vortex-red transition-colors">
                          {program.displayName}
                        </h3>
                        <p className="text-sm text-gray-600 mt-2">
                          {program.forms.length} class{program.forms.length === 1 ? '' : 'es'} available
                        </p>
                      </div>
                      <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-vortex-red shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'class' && selectedProgram && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={backToPrograms}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:text-black transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to programs
              </button>
              <h2 className="text-xl font-display font-bold text-black">Classes</h2>
              <div className="grid grid-cols-1 gap-4">
                {selectedProgram.forms.map((form) => (
                  <button
                    key={form.id}
                    type="button"
                    onClick={() => setSelectedFormId(form.id)}
                    className={cardClass}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-display font-bold text-black group-hover:text-vortex-red transition-colors">
                          {form.classDisplayName?.trim() || form.title}
                        </h3>
                        {form.description && (
                          <p className="text-sm mb-3 line-clamp-3 text-gray-600 mt-2">
                            {form.description}
                          </p>
                        )}
                        {(form.startDate || form.endDate) && (
                          <p className="text-sm flex items-center gap-2 text-gray-500">
                            <Calendar className="w-4 h-4 shrink-0" />
                            {form.startDate && `Opens ${form.startDate}`}
                            {form.startDate && form.endDate && ' · '}
                            {form.endDate && `Closes ${form.endDate}`}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-vortex-red shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'signup' && selectedFormId != null && (
            <div className="space-y-6">
              <button
                type="button"
                onClick={backToClasses}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:text-black transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {signupComplete ? 'Return to classes' : 'Back to classes'}
              </button>
              <SchedulingSignupEmbed
                key={`${selectedFormId}:${urlCategoryId ?? 'none'}`}
                formId={selectedFormId}
                initialCategoryId={urlCategoryId}
                initialAuthToken={urlAuthToken}
                initialEmail={urlEmail}
                onSignupComplete={handleSignupComplete}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default SchedulingPage
