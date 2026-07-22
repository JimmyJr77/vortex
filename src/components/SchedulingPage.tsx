import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, ChevronRight, LayoutGrid, Loader2, Search, X } from 'lucide-react'
import {
  fetchPublicSchedulingForms,
  saveSchedulingMemberEmail,
  type SchedulingFormSummary,
  type SchedulingSignupCompleteDetail,
} from '../utils/schedulingApi'
import { getLoggedInMemberEmail } from '../utils/portalSession'
import {
  fetchClassesOffered,
  type PublicClassOffered,
  type PublicProgramOffered,
} from '../utils/publicClassesApi'
import {
  CLASS_SKILL_LEVEL_FILTER_OPTIONS,
  formatAgeRange,
  formatSkillLevel,
  type ClassSkillLevelFilter,
} from '../utils/classDisplayUtils'
import { trackEvent } from '../utils/analyticsClient'
import { getEnrollCatalogDefault } from '../utils/enrollSite'
import SchedulingSignupEmbed from './SchedulingSignupEmbed'

function parseOptionalInt(raw: string | null): number | null | undefined {
  if (raw == null || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

type CatalogClass = {
  form: SchedulingFormSummary
  classInfo: PublicClassOffered | null
}

type CatalogProgram = {
  programsId: number
  displayName: string
  description: string | null
  primarySportName: string | null
  classes: CatalogClass[]
}

const UNSPECIFIED_SPORT = '__unspecified_sport__'

function resolveProgramDisplayName(
  form: SchedulingFormSummary,
  program?: PublicProgramOffered,
): string {
  return form.programDisplayName?.trim() || program?.displayName?.trim() || 'Unknown program'
}

function buildCatalog(
  forms: SchedulingFormSummary[],
  offeredPrograms: PublicProgramOffered[],
): CatalogProgram[] {
  const offeredById = new Map(offeredPrograms.map((program) => [program.id, program]))
  const byId = new Map<number, CatalogProgram>()

  for (const form of forms) {
    if (form.programsId == null) continue
    const offeredProgram = offeredById.get(form.programsId)
    const classInfo =
      offeredProgram?.classes.find((classItem) => classItem.formId === form.id) ?? null
    let program = byId.get(form.programsId)
    if (!program) {
      program = {
        programsId: form.programsId,
        displayName: resolveProgramDisplayName(form, offeredProgram),
        description: offeredProgram?.description ?? null,
        primarySportName: offeredProgram?.primarySportName ?? null,
        classes: [],
      }
      byId.set(form.programsId, program)
    }
    program.classes.push({ form, classInfo })
  }

  for (const program of byId.values()) {
    program.classes.sort((a, b) =>
      (a.classInfo?.displayName || a.form.classDisplayName || a.form.title).localeCompare(
        b.classInfo?.displayName || b.form.classDisplayName || b.form.title,
      ),
    )
  }
  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
}

function className(item: CatalogClass): string {
  return item.classInfo?.displayName || item.form.classDisplayName?.trim() || item.form.title
}

function classMatchesLevel(skillLevel: string | null, filter: ClassSkillLevelFilter): boolean {
  return filter === 'all' || skillLevel == null || skillLevel === filter
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
  const catalogDefault = useMemo(() => getEnrollCatalogDefault(), [])
  const [searchParams] = useSearchParams()
  const urlFormId = useMemo(() => parseOptionalInt(searchParams.get('form')) ?? null, [searchParams])
  const urlProgramsId = useMemo(() => parseOptionalInt(searchParams.get('programsId')), [searchParams])
  const urlSportFilter = searchParams.get('sportFilter')
  const urlProgramName = searchParams.get('program')
  const urlOfferingId = useMemo(() => parseOptionalInt(searchParams.get('offeringId')), [searchParams])
  const urlSlotGroupId = useMemo(() => parseOptionalInt(searchParams.get('slotGroupId')), [searchParams])
  const urlTimeSlotId = useMemo(() => parseOptionalInt(searchParams.get('timeSlotId')), [searchParams])
  const urlAuthToken = searchParams.get('auth')
  const urlEmail = searchParams.get('email')
  const shouldOpenSignupDirectly = Boolean(
    urlFormId != null && (urlAuthToken || urlOfferingId || urlSlotGroupId || urlTimeSlotId),
  )

  const [forms, setForms] = useState<SchedulingFormSummary[]>([])
  const [offeredPrograms, setOfferedPrograms] = useState<PublicProgramOffered[]>([])
  const [selectedFormId, setSelectedFormId] = useState<number | null>(
    shouldOpenSignupDirectly ? urlFormId : null,
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [sportFilter, setSportFilter] = useState(
    urlSportFilter || (catalogDefault.type === 'sport' ? catalogDefault.value : 'all'),
  )
  const [programFilter, setProgramFilter] = useState<number | 'all'>('all')
  const [levelFilter, setLevelFilter] = useState<ClassSkillLevelFilter>('all')
  const [focusedFormId, setFocusedFormId] = useState<number | null>(
    shouldOpenSignupDirectly ? null : urlFormId,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signupComplete, setSignupComplete] = useState(false)

  const programs = useMemo(() => buildCatalog(forms, offeredPrograms), [forms, offeredPrograms])

  useEffect(() => {
    Promise.all([fetchPublicSchedulingForms(), fetchClassesOffered()])
      .then(([formData, offered]) => {
        setForms(formData)
        setOfferedPrograms(offered.programs)
        const catalog = buildCatalog(formData, offered.programs)
        const target = urlFormId == null
          ? null
          : catalog.flatMap((program) => program.classes).find((item) => item.form.id === urlFormId)
        const targetProgram = target
          ? catalog.find((program) => program.classes.some((item) => item.form.id === urlFormId))
          : null

        if (shouldOpenSignupDirectly && target) {
          setSelectedFormId(target.form.id)
        } else if (target && targetProgram) {
          setFocusedFormId(target.form.id)
          setProgramFilter(targetProgram.programsId)
          setSearchQuery(className(target))
        } else if (
          urlProgramsId != null &&
          catalog.some((program) => program.programsId === urlProgramsId)
        ) {
          setProgramFilter(urlProgramsId)
        } else if (urlProgramName) {
          const requestedName = normalizeFilterName(urlProgramName)
          const requestedProgram = catalog.find(
            (program) => {
              const programName = normalizeFilterName(program.displayName)
              return (
                programName === requestedName ||
                programName.includes(requestedName) ||
                requestedName.includes(programName)
              )
            },
          )
          if (requestedProgram) setProgramFilter(requestedProgram.programsId)
        } else if (catalogDefault.type === 'program') {
          const defaultProgram = catalog.find(
            (program) =>
              program.displayName.trim().toLowerCase() === catalogDefault.value.toLowerCase(),
          )
          if (defaultProgram) setProgramFilter(defaultProgram.programsId)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load enroll options'))
      .finally(() => setLoading(false))
  }, [urlFormId, urlProgramsId, urlProgramName, shouldOpenSignupDirectly, catalogDefault])

  useEffect(() => {
    if (urlEmail) saveSchedulingMemberEmail(urlEmail)
  }, [urlEmail])

  const sportOptions = useMemo(() => {
    const named = new Set<string>()
    let hasUnspecified = false
    for (const program of programs) {
      if (program.primarySportName) named.add(program.primarySportName)
      else hasUnspecified = true
    }
    return { named: [...named].sort((a, b) => a.localeCompare(b)), hasUnspecified }
  }, [programs])

  const programOptions = useMemo(() => {
    if (sportFilter === 'all') return programs
    return programs.filter(
      (program) => (program.primarySportName ?? UNSPECIFIED_SPORT) === sportFilter,
    )
  }, [programs, sportFilter])

  const handleSportFilterChange = useCallback(
    (nextSport: string) => {
      setSportFilter(nextSport)
      setFocusedFormId(null)
      if (programFilter === 'all') return
      const selectedProgram = programs.find((program) => program.programsId === programFilter)
      const selectedSport = selectedProgram?.primarySportName ?? UNSPECIFIED_SPORT
      if (nextSport !== 'all' && selectedSport !== nextSport) setProgramFilter('all')
    },
    [programFilter, programs],
  )

  const filteredPrograms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return programs.flatMap((program) => {
      if (programFilter !== 'all' && program.programsId !== programFilter) return []
      const sportKey = program.primarySportName ?? UNSPECIFIED_SPORT
      if (sportFilter !== 'all' && sportKey !== sportFilter) return []
      const classes = program.classes.filter((item) => {
        const skillLevel = item.classInfo?.skillLevel ?? null
        if (!classMatchesLevel(skillLevel, levelFilter)) return false
        if (!query) return true
        return [
          className(item),
          item.classInfo?.description ?? item.form.description ?? '',
          program.displayName,
          program.primarySportName ?? '',
          skillLevel ?? '',
        ].join(' ').toLowerCase().includes(query)
      })
      return classes.length > 0 ? [{ ...program, classes }] : []
    })
  }, [programs, programFilter, sportFilter, levelFilter, searchQuery])

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setSportFilter('all')
    setProgramFilter('all')
    setLevelFilter('all')
    setFocusedFormId(null)
  }, [])

  const handleSignupComplete = useCallback((detail: SchedulingSignupCompleteDetail) => {
    setSignupComplete(detail.completed)
    if (detail.email) saveSchedulingMemberEmail(detail.email)
  }, [])

  if (loading && forms.length === 0) {
    return <div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-vortex-red" /></div>
  }

  if (!loading && programs.length === 0) {
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

  const hasFilters = searchQuery !== '' || sportFilter !== 'all' || programFilter !== 'all' || levelFilter !== 'all'

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-black via-gray-900 to-black pt-below-site-header pb-12">
        <div className="container-custom text-center">
          <motion.h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>Classes Offered</motion.h1>
          <p className="text-gray-300 max-w-2xl mx-auto text-lg">Find the right class, then choose an available day and time.</p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup/family" className="inline-flex items-center rounded-lg bg-vortex-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Create a new family account</Link>
            <Link to="/signup/family?mode=minor" className="inline-flex items-center rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Under 18? Invite a parent to finish</Link>
          </div>
        </div>
      </section>

      <section className="section-padding bg-gray-50">
        <div className="container-custom max-w-5xl mx-auto space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 space-y-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><LayoutGrid className="w-7 h-7 text-vortex-red" />Browse classes</h2>
                <p className="text-sm text-gray-600 mt-1">Search all open classes or narrow the list with any filter.</p>
              </div>
              {hasFilters && <button type="button" onClick={clearFilters} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-vortex-red"><X className="w-4 h-4" />Clear</button>}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setFocusedFormId(null) }} placeholder="Search classes…" className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <label className="flex flex-col gap-1 min-w-[10rem] flex-1 sm:max-w-[14rem]"><span className="text-xs font-semibold text-gray-600">Sport</span><select value={sportFilter} onChange={(event) => handleSportFilterChange(event.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="all">All sports</option>{sportOptions.named.map((sport) => <option key={sport} value={sport}>{sport}</option>)}{sportOptions.hasUnspecified && <option value={UNSPECIFIED_SPORT}>Unspecified sport</option>}</select></label>
              <label className="flex flex-col gap-1 min-w-[10rem] flex-1 sm:max-w-[14rem]"><span className="text-xs font-semibold text-gray-600">Program</span><select value={programFilter === 'all' ? 'all' : String(programFilter)} onChange={(event) => { setProgramFilter(event.target.value === 'all' ? 'all' : Number(event.target.value)); setFocusedFormId(null) }} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="all">All programs</option>{programOptions.map((program) => <option key={program.programsId} value={program.programsId}>{program.displayName}</option>)}</select></label>
              <label className="flex flex-col gap-1 min-w-[10rem] flex-1 sm:max-w-[14rem]"><span className="text-xs font-semibold text-gray-600">Experience level</span><select value={levelFilter} onChange={(event) => { setLevelFilter(event.target.value as ClassSkillLevelFilter); setFocusedFormId(null) }} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm">{CLASS_SKILL_LEVEL_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
          </div>

          {focusedFormId != null && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">Showing the class you selected. Adjust or clear the filters to explore other classes.</p>}
          {filteredPrograms.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-8 text-center"><p className="text-gray-600">No classes match your search or filters.</p>{hasFilters && <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-vortex-red hover:underline">Show all classes</button>}</div>}

          {filteredPrograms.map((program) => (
            <div key={program.programsId} className="rounded-xl border border-vortex-red bg-white p-5 md:p-6 shadow-sm space-y-4">
              <div><h2 className="text-xl font-display font-bold text-vortex-red">{program.displayName}</h2>{program.description && <p className="text-sm text-gray-600 mt-1">{program.description}</p>}</div>
              <div className="divide-y divide-gray-100">
                {program.classes.map((item) => {
                  const description = item.classInfo?.description ?? item.form.description
                  const skillLevel = item.classInfo?.skillLevel ?? null
                  const isFocused = item.form.id === focusedFormId
                  return (
                    <button key={item.form.id} type="button" onClick={() => { trackEvent('select_item', window.location.pathname, { properties: { item_list_name: 'enroll_classes', class_id: item.form.id, class_name: className(item), program_id: program.programsId, program_name: program.displayName } }); setSelectedFormId(item.form.id) }} className={`group flex w-full items-start justify-between gap-4 py-5 text-left first:pt-1 last:pb-1 ${isFocused ? 'rounded-lg bg-red-50 px-4 ring-1 ring-red-200' : ''}`}>
                      <div className="min-w-0 flex-1"><h3 className="text-lg font-bold text-gray-900 group-hover:text-vortex-red">{className(item)}</h3>{description && <p className="mt-1 text-sm text-gray-600 line-clamp-3">{description}</p>}<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">{item.classInfo && <span>Age: {formatAgeRange(item.classInfo.ageMin, item.classInfo.ageMax)}</span>}<span>Level: {formatSkillLevel(skillLevel)}</span></div></div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white">Select <ChevronRight className="w-4 h-4" /></span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default SchedulingPage
