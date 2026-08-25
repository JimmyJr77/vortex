import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  Filter,
  Layers3,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { coachFetch } from '../../coach/api'
import {
  FLIP_FIT_AGE_BANDS,
  FLIP_FIT_ATHLETE_SETS,
  FLIP_FIT_EQUIPMENT_POLICY,
  FLIP_FIT_TENETS,
  generateFlipFitProgram,
  nextMondayIso,
  validateFlipFitProgram,
  type FlipFitAgeBand,
  type FlipFitCardMatchStatus,
  type FlipFitExerciseCard,
  type FlipFitPhaseKey,
  type FlipFitScheduledExercise,
  type FlipFitTrainingDay,
} from '../../coach/flipFitProgram'
import {
  effectiveFlipFitCardStatus,
  flipFitReferenceCounts,
  type FlipFitCardReconciliationResult,
  type FlipFitCardReference,
} from '../../coach/flipFitCardReferences'
import {
  applyFlipFitSessionOverrides,
  flipFitCoachNotes,
  normalizeFlipFitSessionOverrides,
  type FlipFitSessionOverrides,
} from '../../coach/flipFitOverrides'
import {
  buildFlipFitScheduledPrescription,
  validateFlipFitPrescriptionFit,
} from '../../coach/flipFitPrescription'
import FlipFitExerciseModal from './FlipFitExerciseModal'

const STORAGE_KEY = 'vortex_flip_fit_schedule_v1'

interface StoredSchedule {
  startDate: string
  endDate?: string
  settings?: Record<string, unknown> & { ageBand?: FlipFitAgeBand }
  sessionOverrides?: Record<string, unknown>
  updatedAt?: string | null
}

interface ScheduleFilters {
  week: string
  date: string
  day: string
  athleteSet: string
  phase: string
  movementFunction: string
  methodology: string
  tenet: string
  bodyRegion: string
  equipment: string
}

const EMPTY_FILTERS: ScheduleFilters = {
  week: '',
  date: '',
  day: '',
  athleteSet: '',
  phase: '',
  movementFunction: '',
  methodology: '',
  tenet: '',
  bodyRegion: '',
  equipment: '',
}

const MATCH_LABELS: Record<FlipFitCardMatchStatus, string> = {
  reused: 'Library card',
  alias: 'Alias match',
  new: 'New draft',
  review: 'Review flag',
}

const AGE_LABELS: Record<FlipFitAgeBand, { title: string; detail: string }> = {
  '9-11': { title: 'Ages 9–11', detail: 'Regression path' },
  '12-14': { title: 'Ages 12–14', detail: 'Foundation' },
  '15-18': { title: 'Ages 15–18', detail: 'Progression path' },
}

const PHASE_ACCENTS: Record<FlipFitPhaseKey | 'tumbling', { border: string; badge: string; dot: string }> = {
  prepare_and_access: { border: 'border-amber-200', badge: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500' },
  movement_intelligence: { border: 'border-blue-200', badge: 'bg-blue-100 text-blue-900', dot: 'bg-blue-500' },
  output: { border: 'border-red-200', badge: 'bg-red-100 text-red-900', dot: 'bg-vortex-red' },
  capacity: { border: 'border-gray-300', badge: 'bg-gray-900 text-white', dot: 'bg-gray-900' },
  sustained_capacity: { border: 'border-violet-200', badge: 'bg-violet-100 text-violet-900', dot: 'bg-violet-500' },
  resilience: { border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-900', dot: 'bg-emerald-500' },
  restore: { border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-900', dot: 'bg-cyan-500' },
  tumbling: { border: 'border-fuchsia-200', badge: 'bg-fuchsia-100 text-fuchsia-900', dot: 'bg-fuchsia-500' },
}

function readDeviceSchedule(): StoredSchedule | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSchedule
    if (typeof parsed?.startDate !== 'string') return null
    generateFlipFitProgram(parsed.startDate)
    return parsed
  } catch {
    return null
  }
}

function writeDeviceSchedule(schedule: StoredSchedule) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule))
  } catch {
    // Device storage can be disabled or full; the facility save remains authoritative.
  }
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(new Date(`${value}T12:00:00Z`))
}

function allExercises(session: FlipFitTrainingDay) {
  return [...session.phases.flatMap((phase) => phase.exercises), ...session.tumbling.exercises]
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-vortex-red focus:outline-none focus:ring-2 focus:ring-red-100"
      >
        <option value="">All</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function ProgramMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  )
}

function AgeBandSelector({ value, onChange }: { value: FlipFitAgeBand; onChange: (value: FlipFitAgeBand) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-gray-500">View prescriptions for</legend>
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-100 p-1.5">
        {FLIP_FIT_AGE_BANDS.map((band) => {
          const active = value === band
          return (
            <button
              key={band}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(band)}
              className={`rounded-lg px-2 py-2 text-center transition focus:outline-none focus:ring-2 focus:ring-vortex-red ${active ? 'bg-black text-white shadow-sm' : 'text-gray-600 hover:bg-white'}`}
            >
              <span className="block text-sm font-bold">{band}</span>
              <span className={`hidden text-[10px] font-semibold uppercase tracking-wide sm:block ${active ? 'text-gray-300' : 'text-gray-500'}`}>{AGE_LABELS[band].detail}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function AthleteSetTimeline({ selectedSet }: { selectedSet: string }) {
  return (
    <section aria-labelledby="athlete-sets-title" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-vortex-red">Facility flow</p>
          <h3 id="athlete-sets-title" className="text-lg font-bold text-gray-950">Two athlete sets, one shared tumbling period</h3>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">120 minutes per athlete</span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {FLIP_FIT_ATHLETE_SETS.map((set) => {
          const highlighted = !selectedSet || selectedSet === set.id
          return (
            <div key={set.id} className={`rounded-xl border p-3 transition ${highlighted ? 'border-gray-300 bg-gray-50' : 'border-gray-100 bg-white opacity-50'}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-bold text-gray-950">{set.name}</span>
                <span className="text-xs font-semibold text-gray-500">{set.totalMinutes} min</span>
              </div>
              <div className="flex min-h-12 overflow-hidden rounded-lg text-xs font-bold text-white">
                {set.blocks.map((block) => (
                  <div
                    key={block.label}
                    style={{ flexGrow: block.minutes }}
                    className={`flex min-w-0 items-center justify-center px-2 text-center ${block.label === 'Shared tumbling' ? 'bg-vortex-red' : 'bg-gray-900'}`}
                  >
                    <span>{block.label}<span className="block font-medium opacity-80">{block.minutes} min</span></span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-gray-500">Set 1 finishes its athletic workout as Set 2 arrives. Both share the same 30-minute tumbling period; neither athletic workout is divided or reordered.</p>
    </section>
  )
}

function ExerciseTile({
  exercise,
  ageBand,
  status,
  statusIsLive,
  onOpen,
}: {
  exercise: FlipFitScheduledExercise
  ageBand: FlipFitAgeBand
  status: FlipFitCardMatchStatus
  statusIsLive: boolean
  onOpen: (exercise: FlipFitScheduledExercise) => void
}) {
  const avenue = exercise.card.ageScaling[ageBand]
  const prescription = buildFlipFitScheduledPrescription(exercise, ageBand)
  return (
    <button
      type="button"
      onClick={() => onOpen(exercise)}
      aria-label={`Open exercise card for ${exercise.card.name}`}
      className="group w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-vortex-red"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{exercise.allocationMinutes} min · {statusIsLive ? MATCH_LABELS[status] : `Planned ${status} candidate`}</p>
          <h4 className="mt-1 font-bold leading-snug text-gray-950 group-hover:text-vortex-red">{exercise.card.name}</h4>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-vortex-red" />
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug text-gray-800">{avenue.variation}</p>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">{prescription.display} · {prescription.workDisplay} · {prescription.restDisplay}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {avenue.equipment.slice(0, 3).map((item) => <span key={item} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{item}</span>)}
        {exercise.card.tenets.slice(0, 2).map((tenet) => <span key={tenet} className="rounded-full bg-black px-2 py-0.5 text-[11px] font-medium text-white">{tenet}</span>)}
      </div>
    </button>
  )
}

export default function FlipFitSchedulePanel() {
  const defaultStartDate = useMemo(() => nextMondayIso(), [])
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [draftStartDate, setDraftStartDate] = useState(defaultStartDate)
  const [ageBand, setAgeBand] = useState<FlipFitAgeBand>('12-14')
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_FILTERS)
  const [selectedSessionId, setSelectedSessionId] = useState('flip-fit-w01-d1')
  const [selectedExercise, setSelectedExercise] = useState<FlipFitScheduledExercise | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [storageState, setStorageState] = useState<'facility' | 'device' | 'error'>('device')
  const [storageMessage, setStorageMessage] = useState('Loading saved schedule…')
  const [persistedSettings, setPersistedSettings] = useState<Record<string, unknown>>({})
  const [sessionOverrides, setSessionOverrides] = useState<FlipFitSessionOverrides>({})
  const [scheduleUpdatedAt, setScheduleUpdatedAt] = useState<string | null>(null)
  const [draftObjective, setDraftObjective] = useState('')
  const [draftCoachNotes, setDraftCoachNotes] = useState('')
  const [cardReferences, setCardReferences] = useState<FlipFitCardReference[]>([])
  const [cardReferencesLoaded, setCardReferencesLoaded] = useState(false)
  const [reconcilingCards, setReconcilingCards] = useState(false)
  const [cardReferenceMessage, setCardReferenceMessage] = useState('Loading facility card references…')

  const baseProgram = useMemo(() => generateFlipFitProgram(startDate), [startDate])
  const program = useMemo(
    () => applyFlipFitSessionOverrides(baseProgram, sessionOverrides),
    [baseProgram, sessionOverrides],
  )
  const validation = useMemo(() => validateFlipFitProgram(program), [program])
  const prescriptionErrors = useMemo(() => validateFlipFitPrescriptionFit(program), [program])
  const referenceMap = useMemo(
    () => new Map(cardReferences.map((reference) => [reference.programCardKey, reference])),
    [cardReferences],
  )
  const inventoryCounts = useMemo(
    () => flipFitReferenceCounts(program.exerciseCards, referenceMap),
    [program.exerciseCards, referenceMap],
  )

  useEffect(() => {
    let active = true
    const local = readDeviceSchedule()
    if (local) {
      setStartDate(local.startDate)
      setDraftStartDate(local.startDate)
      if (local.settings?.ageBand && FLIP_FIT_AGE_BANDS.includes(local.settings.ageBand)) setAgeBand(local.settings.ageBand)
      setPersistedSettings(local.settings ?? {})
      setSessionOverrides(normalizeFlipFitSessionOverrides(local.sessionOverrides))
      setScheduleUpdatedAt(local.updatedAt ?? null)
    }

    coachFetch<StoredSchedule | null>('/api/coach/flip-fit-schedule')
      .then((saved) => {
        if (!active) return
        if (saved?.startDate) {
          setStartDate(saved.startDate)
          setDraftStartDate(saved.startDate)
          if (saved.settings?.ageBand && FLIP_FIT_AGE_BANDS.includes(saved.settings.ageBand)) setAgeBand(saved.settings.ageBand)
          setPersistedSettings(saved.settings ?? {})
          setSessionOverrides(normalizeFlipFitSessionOverrides(saved.sessionOverrides))
          setScheduleUpdatedAt(saved.updatedAt ?? null)
          writeDeviceSchedule(saved)
          setStorageState('facility')
          setStorageMessage('Facility schedule loaded')
        } else {
          setStorageState('device')
          setStorageMessage(local ? 'Using saved device copy' : 'Ready to save the facility schedule')
        }
      })
      .catch(() => {
        if (!active) return
        setStorageState('device')
        setStorageMessage(local ? 'Facility unavailable — using saved device copy' : 'Facility unavailable — changes will stay on this device')
      })
      .finally(() => {
        if (active) setLoadingSchedule(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    coachFetch<FlipFitCardReference[]>('/api/coach/flip-fit-card-references')
      .then((references) => {
        if (!active) return
        setCardReferences(Array.isArray(references) ? references : [])
        setCardReferenceMessage(
          references.length > 0
            ? `${references.length} facility card references loaded`
            : 'No facility reconciliation has been run yet',
        )
      })
      .catch(() => {
        if (!active) return
        setCardReferenceMessage('Facility references unavailable — showing planned generator statuses')
      })
      .finally(() => {
        if (active) setCardReferencesLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  const persistSchedule = async (
    nextDate: string,
    nextAgeBand: FlipFitAgeBand,
    confirmRemap: boolean,
    nextOverrides: FlipFitSessionOverrides = sessionOverrides,
  ) => {
    const nextSettings = { ...persistedSettings, ageBand: nextAgeBand }
    const deviceValue: StoredSchedule = {
      startDate: nextDate,
      settings: nextSettings,
      sessionOverrides: nextOverrides,
      updatedAt: scheduleUpdatedAt,
    }
    writeDeviceSchedule(deviceValue)
    setSavingSchedule(true)
    try {
      const saved = await coachFetch<StoredSchedule>('/api/coach/flip-fit-schedule', {
        method: 'PUT',
        body: JSON.stringify({
          startDate: nextDate,
          settings: nextSettings,
          sessionOverrides: nextOverrides,
          confirmRemap,
          expectedUpdatedAt: scheduleUpdatedAt,
        }),
      })
      writeDeviceSchedule(saved)
      setPersistedSettings(saved.settings ?? nextSettings)
      setSessionOverrides(normalizeFlipFitSessionOverrides(saved.sessionOverrides ?? nextOverrides))
      setScheduleUpdatedAt(saved.updatedAt ?? null)
      setStorageState('facility')
      setStorageMessage(`Saved for the facility${saved.updatedAt ? ` · ${formatDate(saved.updatedAt.slice(0, 10))}` : ''}`)
    } catch (error) {
      const apiError = error as Error & { status?: number; details?: { code?: string } }
      const status = apiError.status
      const conflictCode = apiError.details?.code
      setStorageState(status === 409 ? 'error' : 'device')
      setStorageMessage(
        conflictCode === 'flip_fit_schedule_conflict'
          ? 'Another coach changed this schedule — reload before saving'
          : status === 409
            ? 'Date remap still needs confirmation'
            : 'Facility save unavailable — saved on this device',
      )
    } finally {
      setSavingSchedule(false)
    }
  }

  const changeAgeBand = (nextAgeBand: FlipFitAgeBand) => {
    setAgeBand(nextAgeBand)
    void persistSchedule(startDate, nextAgeBand, false)
  }

  const applyStartDate = () => {
    try {
      generateFlipFitProgram(draftStartDate)
    } catch (error) {
      setStorageState('error')
      setStorageMessage(error instanceof Error ? error.message : 'Choose a valid Monday.')
      return
    }
    const changed = draftStartDate !== startDate
    if (changed) {
      const confirmed = window.confirm(
        `Remap all 60 Flip & Fit dates from ${formatDate(startDate)} to ${formatDate(draftStartDate)}? Stable week/day identities and saved session overrides will be preserved.`,
      )
      if (!confirmed) {
        setDraftStartDate(startDate)
        return
      }
    }
    setStartDate(draftStartDate)
    void persistSchedule(draftStartDate, ageBand, changed)
  }

  const optionSets = useMemo(() => {
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
    return {
      movementFunctions: unique(program.weeks.map((week) => week.movementFunction)),
      methodologies: unique(program.exerciseCards.map((card) => card.methodology)),
      bodyRegions: unique(program.exerciseCards.flatMap((card) => card.bodyRegions)),
      equipment: unique(program.exerciseCards.flatMap((card) => card.ageScaling[ageBand].equipment)),
    }
  }, [ageBand, program])

  const filteredSessions = useMemo(() => program.sessions.filter((session) => {
    if (filters.week && session.weekNumber !== Number(filters.week)) return false
    if (filters.date && session.date !== filters.date) return false
    if (filters.day && session.dayName !== filters.day) return false
    if (filters.movementFunction && session.movementFunction !== filters.movementFunction) return false
    const cardFiltersActive = filters.phase || filters.methodology || filters.tenet || filters.bodyRegion || filters.equipment
    if (!cardFiltersActive) return true
    return allExercises(session).some((exercise) => {
      const card = exercise.card
      if (filters.phase && card.phase !== filters.phase) return false
      if (filters.methodology && card.methodology !== filters.methodology) return false
      if (filters.tenet && !card.tenets.includes(filters.tenet as (typeof FLIP_FIT_TENETS)[number])) return false
      if (filters.bodyRegion && !card.bodyRegions.includes(filters.bodyRegion)) return false
      if (filters.equipment && !card.ageScaling[ageBand].equipment.includes(filters.equipment)) return false
      return true
    })
  }), [ageBand, filters, program])

  useEffect(() => {
    if (filteredSessions.some((session) => session.id === selectedSessionId)) return
    if (filteredSessions[0]) setSelectedSessionId(filteredSessions[0].id)
  }, [filteredSessions, selectedSessionId])

  const selectedSession = filteredSessions.find((session) => session.id === selectedSessionId) ?? filteredSessions[0] ?? null
  const selectedWeek = selectedSession ? program.weeks[selectedSession.weekNumber - 1] : null
  const selectedCoachNotes = selectedSession ? flipFitCoachNotes(selectedSession) : ''
  const selectedAthleteSet = FLIP_FIT_ATHLETE_SETS.find((set) => set.id === filters.athleteSet) ?? null
  const selectedWeekSessionIds = new Set(selectedWeek?.days.map((day) => day.id) ?? [])
  const selectedWeekWarnings = validation.warnings.filter((issue) => issue.sessionId && selectedWeekSessionIds.has(issue.sessionId))
  const selectedSessionWarnings = validation.warnings.filter((issue) => issue.sessionId === selectedSession?.id)
  const maxWeeklyRegionLoad = Math.max(1, ...(selectedWeek?.coverage.stress.bodyRegions.map((region) => region.load) ?? []))
  const selectedWeekEquipment = selectedWeek
    ? [...new Set(selectedWeek.days.flatMap(allExercises).flatMap((exercise) => exercise.card.ageScaling[ageBand].equipment))].sort((left, right) => left.localeCompare(right))
    : []
  const reviewCards = program.exerciseCards.filter((card) => effectiveFlipFitCardStatus(card, referenceMap) === 'review')
  const reconciledCount = program.exerciseCards.filter((card) => referenceMap.has(card.id)).length
  const scheduledExerciseCount = program.sessions.reduce((sum, session) => sum + allExercises(session).length, 0)
  const totalChecks = validation.checks + scheduledExerciseCount * FLIP_FIT_AGE_BANDS.length
  const guardrailsValid = validation.valid && prescriptionErrors.length === 0

  useEffect(() => {
    setDraftObjective(selectedSession?.objective ?? '')
    setDraftCoachNotes(selectedCoachNotes)
  }, [selectedCoachNotes, selectedSession?.id, selectedSession?.objective])

  const saveSessionEdits = () => {
    if (!selectedSession) return
    const baseObjective = baseProgram.sessions.find((session) => session.id === selectedSession.id)?.objective ?? ''
    const objective = draftObjective.trim()
    const coachNotes = draftCoachNotes.trim()
    const nextOverrides = normalizeFlipFitSessionOverrides({
      ...sessionOverrides,
      [selectedSession.id]: {
        ...(objective && objective !== baseObjective ? { objective } : {}),
        ...(coachNotes ? { coachNotes } : {}),
      },
    })
    setSessionOverrides(nextOverrides)
    void persistSchedule(startDate, ageBand, false, nextOverrides)
  }

  const reconcileCards = async () => {
    const confirmed = window.confirm(
      `Reconcile all ${program.exerciseCards.length} Flip & Fit cards with the facility library? Exact semantic matches will be linked, unmatched cards will be created as drafts, and uncertain identities will stay in coach review. Nothing will be auto-published.`,
    )
    if (!confirmed) return

    const movementFunctionsByCard = new Map<string, Set<string>>()
    for (const session of program.sessions) {
      for (const exercise of allExercises(session)) {
        const functions = movementFunctionsByCard.get(exercise.cardId) ?? new Set<string>()
        functions.add(exercise.movementFunction)
        movementFunctionsByCard.set(exercise.cardId, functions)
      }
    }
    const cards = program.exerciseCards.map((card): FlipFitExerciseCard & { movementFunctions: string[] } => ({
      ...card,
      movementFunctions: [...(movementFunctionsByCard.get(card.id) ?? [])].sort((left, right) => left.localeCompare(right)),
    }))

    setReconcilingCards(true)
    setCardReferenceMessage('Reconciling program cards with the facility library…')
    try {
      const result = await coachFetch<FlipFitCardReconciliationResult>('/api/coach/flip-fit-card-references/reconcile', {
        method: 'POST',
        body: JSON.stringify({ cards }),
      })
      setCardReferences(result.cards)
      setCardReferencesLoaded(true)
      setCardReferenceMessage(`${result.cards.length} cards reconciled atomically; new cards remain drafts until reviewed`)
    } catch (error) {
      const apiError = error as Error & { status?: number }
      setCardReferenceMessage(
        apiError.status === 403
          ? 'Library-manage permission is required to reconcile cards'
          : `Reconciliation failed without changing the reference set: ${apiError.message}`,
      )
    } finally {
      setReconcilingCards(false)
    }
  }

  const setFilter = (key: keyof ScheduleFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const exerciseMatchesFilters = (exercise: FlipFitScheduledExercise) => {
    const card = exercise.card
    if (filters.methodology && card.methodology !== filters.methodology) return false
    if (filters.tenet && !card.tenets.includes(filters.tenet as (typeof FLIP_FIT_TENETS)[number])) return false
    if (filters.bodyRegion && !card.bodyRegions.includes(filters.bodyRegion)) return false
    if (filters.equipment && !card.ageScaling[ageBand].equipment.includes(filters.equipment)) return false
    return true
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-black via-gray-950 to-gray-900 text-white shadow-xl">
        <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red-400">
              <Sparkles className="h-4 w-4" /> Coach-ready athletic development
            </div>
            <h2 className="mt-3 text-3xl font-display font-bold leading-none sm:text-5xl">Flip &amp; Fit <span className="text-vortex-red">Schedule</span></h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-300 sm:text-base">
              A 12-week, Monday–Friday curriculum built on ages 12–14. Every exercise includes a direct regression for ages 9–11 and a readiness-gated progression for ages 15–18.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ProgramMetric value="12 weeks" label="Course length" />
              <ProgramMetric value="60" label="Dated sessions" />
              <ProgramMetric value="90 + 30" label="Athletic + tumbling" />
              <ProgramMetric value="120 min" label="Athlete time" />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 text-gray-950 shadow-lg sm:p-5">
            <AgeBandSelector value={ageBand} onChange={changeAgeBand} />
            <div className="mt-4 border-t border-gray-200 pt-4">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Program start · Monday</span>
                <input
                  type="date"
                  value={draftStartDate}
                  onChange={(event) => setDraftStartDate(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-vortex-red focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </label>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                <span>Ends {formatDate(program.endDate)}</span>
                <button
                  type="button"
                  onClick={applyStartDate}
                  disabled={savingSchedule || loadingSchedule}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-vortex-red px-3 py-2 font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingSchedule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save schedule
                </button>
              </div>
              <p className={`mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium ${storageState === 'facility' ? 'bg-emerald-50 text-emerald-800' : storageState === 'error' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`} role="status">
                {storageState === 'facility' ? <CheckCircle2 className="h-3.5 w-3.5" /> : storageState === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {storageMessage}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <AthleteSetTimeline selectedSet={filters.athleteSet} />
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-vortex-red">Program guardrails</p>
              <h3 className="text-lg font-bold text-gray-950">Week A / Week B rotation</h3>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${guardrailsValid && validation.warnings.length === 0 ? 'bg-emerald-100 text-emerald-900' : guardrailsValid ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'}`}>
              {guardrailsValid ? `${totalChecks} checks passed · ${validation.warnings.length} warnings` : `${validation.errors.length + prescriptionErrors.length} errors`}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-gray-950 p-3 text-white"><strong className="block">Odd weeks</strong><span className="text-xs text-gray-300">Capacity Mon/Tue · Sustained Wed–Fri</span></div>
            <div className="rounded-xl bg-red-700 p-3 text-white"><strong className="block">Even weeks</strong><span className="text-xs text-red-100">Sustained Mon/Tue · Capacity Wed–Fri</span></div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">Every day keeps the exact 10 / 20 / 20 / 25 / 10 / 5 athletic phase order. Normal water, explanation, and station transitions stay inside those windows.</p>
          {(validation.errors.length > 0 || prescriptionErrors.length > 0 || validation.warnings.length > 0) && (
            <div className="mt-3 space-y-2" role="alert">
              {prescriptionErrors.slice(0, 2).map((issue) => (
                <div key={`${issue.sessionId}-${issue.exerciseId}-${issue.ageBand}`} className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-900"><strong>{issue.message}</strong> Adjust the scheduled dose before coaching this station.</div>
              ))}
              {[...validation.errors, ...validation.warnings].slice(0, 3).map((issue) => (
                <div key={`${issue.code}-${issue.sessionId ?? ''}`} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><strong>{issue.message}</strong> {issue.resolution}</div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="schedule-filters-title" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-vortex-red" />
            <div><h3 id="schedule-filters-title" className="font-bold text-gray-950">Schedule filters</h3><p className="text-xs text-gray-500">{filteredSessions.length} of 60 sessions match</p></div>
          </div>
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-gray-400 hover:text-gray-950">
            <RotateCcw className="h-3.5 w-3.5" /> Reset filters
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <FilterSelect label="Week" value={filters.week} onChange={(value) => setFilter('week', value)} options={program.weeks.map((week) => ({ value: String(week.weekNumber), label: `Week ${week.weekNumber}` }))} />
          <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Date</span><input type="date" value={filters.date} onChange={(event) => setFilter('date', event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-vortex-red focus:outline-none focus:ring-2 focus:ring-red-100" /></label>
          <FilterSelect label="Day" value={filters.day} onChange={(value) => setFilter('day', value)} options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => ({ value: day, label: day }))} />
          <FilterSelect label="Athlete set" value={filters.athleteSet} onChange={(value) => setFilter('athleteSet', value)} options={FLIP_FIT_ATHLETE_SETS.map((set) => ({ value: set.id, label: set.name }))} />
          <FilterSelect label="Session phase" value={filters.phase} onChange={(value) => setFilter('phase', value)} options={[
            ['prepare_and_access', 'Prepare & Access'], ['movement_intelligence', 'Movement Intelligence'], ['output', 'Output'], ['capacity', 'Capacity'], ['sustained_capacity', 'Sustained Capacity'], ['resilience', 'Resilience'], ['restore', 'Restore'], ['tumbling', 'Tumbling'],
          ].map(([value, label]) => ({ value, label }))} />
          <FilterSelect label="Movement function" value={filters.movementFunction} onChange={(value) => setFilter('movementFunction', value)} options={optionSets.movementFunctions.map((value) => ({ value, label: value }))} />
          <FilterSelect label="Methodology" value={filters.methodology} onChange={(value) => setFilter('methodology', value)} options={optionSets.methodologies.map((value) => ({ value, label: value }))} />
          <FilterSelect label="Athletic tenet" value={filters.tenet} onChange={(value) => setFilter('tenet', value)} options={FLIP_FIT_TENETS.map((value) => ({ value, label: value }))} />
          <FilterSelect label="Body region" value={filters.bodyRegion} onChange={(value) => setFilter('bodyRegion', value)} options={optionSets.bodyRegions.map((value) => ({ value, label: value }))} />
          <FilterSelect label="Equipment" value={filters.equipment} onChange={(value) => setFilter('equipment', value)} options={optionSets.equipment.map((value) => ({ value, label: value }))} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="px-1 pb-2"><p className="text-xs font-bold uppercase tracking-[0.16em] text-vortex-red">12-week curriculum</p><h3 className="font-bold text-gray-950">Choose a week</h3></div>
            <div className="max-h-[34rem] space-y-1.5 overflow-y-auto pr-1">
              {program.weeks.map((week) => {
                const active = selectedWeek?.weekNumber === week.weekNumber
                return (
                  <button
                    key={week.weekNumber}
                    type="button"
                    onClick={() => {
                      setFilter('week', String(week.weekNumber))
                      setSelectedSessionId(week.days[0].id)
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-vortex-red bg-red-50' : 'border-transparent hover:border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between gap-2"><span className={`text-xs font-bold uppercase tracking-wide ${active ? 'text-vortex-red' : 'text-gray-500'}`}>Week {week.weekNumber}</span><span className="text-[11px] text-gray-400">{formatDate(week.dateRange.start, { month: 'short', day: 'numeric' })}</span></div>
                    <p className="mt-1 text-sm font-bold leading-snug text-gray-900">{week.movementFunction}</p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-vortex-red">Exercise-card workflow</p>
            <h3 className="mt-0.5 font-bold text-gray-950">{reconciledCount} of {program.exerciseCards.length} cards reconciled</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500">Live references take precedence; unreconciled cards retain the generator’s planned status.</p>
            <div className="mt-3 space-y-2">
              {(['reused', 'alias', 'new', 'review'] as const).map((status) => (
                <div key={status} className="flex items-center justify-between text-sm"><span className="text-gray-600">{status === 'reused' ? 'Reused / candidate' : status === 'alias' ? 'Alias / candidate' : status === 'new' ? 'New / candidate' : 'Coach review'}</span><span className="rounded-full bg-gray-100 px-2 py-0.5 font-bold text-gray-900">{inventoryCounts[status]}</span></div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void reconcileCards()}
              disabled={!cardReferencesLoaded || reconcilingCards}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reconcilingCards ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers3 className="h-3.5 w-3.5" />}
              Reconcile facility cards
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500" role="status">{cardReferenceMessage}</p>
            {reviewCards.length ? (
              <details className="mt-3 border-t border-gray-100 pt-3">
                <summary className="cursor-pointer text-xs font-semibold text-amber-800">Cards flagged for coach review</summary>
                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                  {reviewCards.slice(0, 8).map((card) => <li key={card.id}>• {card.name}</li>)}
                  {reviewCards.length > 8 && <li>• +{reviewCards.length - 8} more in the implementation report</li>}
                </ul>
              </details>
            ) : null}
          </section>
        </aside>

        <main className="min-w-0 space-y-5">
          {!selectedSession || !selectedWeek ? (
            <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
              <CalendarDays className="mx-auto h-10 w-10 text-gray-300" />
              <h3 className="mt-3 text-lg font-bold text-gray-900">No sessions match these filters</h3>
              <p className="mt-1 text-sm text-gray-500">Reset one or more filters to return to the 60-session schedule.</p>
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="mt-4 rounded-lg bg-vortex-red px-4 py-2 text-sm font-bold text-white">Reset filters</button>
            </section>
          ) : (
            <>
              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-vortex-red">Week {selectedWeek.weekNumber} · {formatDate(selectedWeek.dateRange.start, { month: 'short', day: 'numeric' })}–{formatDate(selectedWeek.dateRange.end, { month: 'short', day: 'numeric' })}</p>
                    <h3 className="mt-1 text-2xl font-bold text-gray-950">{selectedWeek.movementFunction}</h3>
                    <p className="mt-1 text-sm font-semibold text-gray-700">Capacity pairing: {selectedWeek.capacityFocus}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    {Object.entries(selectedWeek.coverage.performanceBalance).map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-gray-100 px-3 py-2 text-center"><strong className="block text-base text-gray-950">{value}%</strong><span className="text-gray-500">{key}</span></div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-bold uppercase text-gray-500">Weekly objective</p><p className="mt-1 text-sm leading-relaxed text-gray-700">{selectedWeek.coachingObjective}</p></div>
                  <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-bold uppercase text-gray-500">Progression</p><p className="mt-1 text-sm leading-relaxed text-gray-700">{selectedWeek.progression}</p></div>
                </div>
                <div className="mt-4 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                  {FLIP_FIT_TENETS.map((tenet) => (
                    <div key={tenet}>
                      <div className="flex items-center justify-between gap-2 text-[11px]"><span className="truncate font-semibold text-gray-600">{tenet}</span><span className="text-gray-400">{selectedWeek.coverage.tenets[tenet]}%</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-vortex-red" style={{ width: `${selectedWeek.coverage.tenets[tenet]}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-3 border-t border-gray-100 pt-4 xl:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Weekly body-region stress</h4>
                    <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                      {selectedWeek.coverage.stress.bodyRegions.slice(0, 8).map((region) => (
                        <div key={region.region}>
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="truncate font-semibold text-gray-700">{region.region}</span>
                            <span className="whitespace-nowrap text-gray-400">{region.load.toFixed(1)} load · {region.days}d</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
                            <div className="h-full rounded-full bg-vortex-red" style={{ width: `${Math.max(4, (region.load / maxWeeklyRegionLoad) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-gray-500">Weighted load distributes each exercise’s scheduled time across its listed body regions and adjusts for the phase’s working density.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Impact &amp; recovery</h4>
                      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                        <div className="rounded-lg bg-white p-2"><strong className="block text-lg text-gray-950">{selectedWeek.coverage.stress.impact.highDays}</strong><span className="text-[10px] text-gray-500">high-impact days</span></div>
                        <div className="rounded-lg bg-white p-2"><strong className="block text-lg text-gray-950">{selectedWeek.coverage.stress.recovery.highVolumeDays}</strong><span className="text-[10px] text-gray-500">high-volume days</span></div>
                        <div className="rounded-lg bg-white p-2"><strong className="block text-lg text-gray-950">{selectedWeek.coverage.stress.recovery.restoreMinutes}</strong><span className="text-[10px] text-gray-500">restore min</span></div>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-gray-500">{selectedWeek.coverage.stress.impact.moderateDays} moderate-impact day{selectedWeek.coverage.stress.impact.moderateDays === 1 ? '' : 's'} · {selectedWeek.coverage.stress.recovery.highEccentricDays} high-eccentric day{selectedWeek.coverage.stress.recovery.highEccentricDays === 1 ? '' : 's'} · {selectedWeek.coverage.stress.recovery.highFreshnessDays} high-freshness day{selectedWeek.coverage.stress.recovery.highFreshnessDays === 1 ? '' : 's'}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Equipment requirements</h4>
                      <div className="mt-3 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                        {selectedWeekEquipment.map((item) => <span key={item} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600">{item}</span>)}
                      </div>
                      <p className="mt-2 text-[11px] text-gray-500">Active {AGE_LABELS[ageBand].title.toLowerCase()} avenue</p>
                    </div>
                  </div>
                </div>
                <div className={`mt-3 rounded-xl border p-3 ${selectedWeekWarnings.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                  <h4 className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${selectedWeekWarnings.length > 0 ? 'text-amber-900' : 'text-emerald-800'}`}>
                    {selectedWeekWarnings.length > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {selectedWeekWarnings.length > 0 ? `${selectedWeekWarnings.length} weekly stress warning${selectedWeekWarnings.length === 1 ? '' : 's'}` : 'No consecutive-day stress conflict detected'}
                  </h4>
                  {selectedWeekWarnings.length > 0 && (
                    <ul className="mt-2 space-y-2 text-xs text-amber-950">
                      {selectedWeekWarnings.map((issue) => <li key={`${issue.code}-${issue.sessionId}`}><strong>{issue.message}</strong> {issue.resolution}</li>)}
                    </ul>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectedWeek.days.map((day) => {
                    const available = filteredSessions.some((session) => session.id === day.id)
                    const active = day.id === selectedSession.id
                    return (
                      <button
                        key={day.id}
                        type="button"
                        disabled={!available}
                        onClick={() => setSelectedSessionId(day.id)}
                        className={`min-w-[8.5rem] flex-1 rounded-xl border px-3 py-3 text-left transition ${active ? 'border-vortex-red bg-vortex-red text-white shadow-sm' : available ? 'border-gray-200 bg-white text-gray-900 hover:border-gray-400' : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'}`}
                      >
                        <span className={`block text-[11px] font-bold uppercase tracking-wide ${active ? 'text-red-100' : 'text-gray-500'}`}>{day.dayName}</span>
                        <span className="mt-0.5 block font-bold">{formatDate(day.date, { month: 'short', day: 'numeric' })}</span>
                        <span className={`mt-1 block text-[11px] ${active ? 'text-red-100' : 'text-gray-500'}`}>{day.phases[3].name}</span>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-vortex-red">Week {selectedSession.weekNumber} · Day {selectedSession.dayNumber}</p>
                    <h3 className="mt-1 text-2xl font-bold text-gray-950">{selectedSession.dayName}, {formatDate(selectedSession.date)}</h3>
                    <p className="mt-2 max-w-4xl text-sm leading-relaxed text-gray-600">{selectedSession.objective}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-xl bg-gray-950 px-4 py-3 text-white"><span className="block text-xs uppercase tracking-wide text-gray-400">Active scale</span><strong>{AGE_LABELS[ageBand].title} · {AGE_LABELS[ageBand].detail}</strong></div>
                    {selectedAthleteSet && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-950">
                        <span className="block font-bold">{selectedAthleteSet.name} facility order</span>
                        <span className="mt-0.5 block">{selectedAthleteSet.blocks.map((block) => `${block.label} ${block.minutes} min`).join(' → ')}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 lg:grid-cols-6">
                  {selectedSession.phases.map((phase, index) => {
                    const accent = PHASE_ACCENTS[phase.key]
                    return (
                      <div key={phase.key} className={`rounded-lg border ${accent.border} p-2`}>
                        <span className={`mb-1 block h-1.5 w-6 rounded-full ${accent.dot}`} />
                        <span className="block text-[10px] font-bold uppercase text-gray-500">{index + 1}</span>
                        <span className="block text-xs font-bold leading-tight text-gray-900">{phase.name}</span>
                        <span className="text-[11px] text-gray-500">{phase.durationMinutes} min</span>
                      </div>
                    )
                  })}
                </div>
                <details className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <summary className="cursor-pointer text-sm font-bold text-gray-900">Edit this session’s coaching plan</summary>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Session objective</span>
                      <textarea
                        value={draftObjective}
                        maxLength={2000}
                        rows={4}
                        onChange={(event) => setDraftObjective(event.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-vortex-red focus:outline-none focus:ring-2 focus:ring-red-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Coach notes</span>
                      <textarea
                        value={draftCoachNotes}
                        maxLength={4000}
                        rows={4}
                        placeholder="Add station setup, athlete-specific reminders, or facility logistics."
                        onChange={(event) => setDraftCoachNotes(event.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-vortex-red focus:outline-none focus:ring-2 focus:ring-red-100"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={saveSessionEdits}
                      disabled={savingSchedule}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-vortex-red px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingSchedule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save session edits
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftObjective(baseProgram.sessions.find((session) => session.id === selectedSession.id)?.objective ?? '')
                        setDraftCoachNotes('')
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:border-gray-500"
                    >
                      Restore generated text
                    </button>
                    <span className="text-[11px] text-gray-500">Stored against stable ID {selectedSession.id}; date remaps preserve it.</span>
                  </div>
                </details>
              </section>

              <div className="space-y-4">
                {selectedSession.phases
                  .filter((phase) => !filters.phase || phase.key === filters.phase)
                  .map((phase) => {
                    const exercises = phase.exercises.filter(exerciseMatchesFilters)
                    if (exercises.length === 0) return null
                    const accent = PHASE_ACCENTS[phase.key]
                    return (
                      <section key={phase.key} className={`rounded-2xl border ${accent.border} bg-white p-4 shadow-sm sm:p-5`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${accent.badge}`}>{phase.durationMinutes} minutes</span><h3 className="mt-2 text-xl font-bold text-gray-950">{phase.name}</h3><p className="mt-1 text-sm text-gray-600">{phase.objective}</p></div>
                          <span className="text-xs font-semibold text-gray-500">{exercises.length} exercise card{exercises.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                          {exercises.map((exercise) => <ExerciseTile key={exercise.id} exercise={exercise} ageBand={ageBand} status={effectiveFlipFitCardStatus(exercise.card, referenceMap)} statusIsLive={referenceMap.has(exercise.cardId)} onOpen={setSelectedExercise} />)}
                        </div>
                      </section>
                    )
                  })}

                {(!filters.phase || filters.phase === 'tumbling') && (() => {
                  const tumblingExercises = selectedSession.tumbling.exercises.filter(exerciseMatchesFilters)
                  if (tumblingExercises.length === 0) return null
                  const accent = PHASE_ACCENTS.tumbling
                  return (
                    <section className={`rounded-2xl border ${accent.border} bg-white p-4 shadow-sm sm:p-5`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${accent.badge}`}>30 minutes · separate block</span><h3 className="mt-2 text-xl font-bold text-gray-950">Tumbling</h3><p className="mt-1 text-sm text-gray-600">{selectedSession.tumbling.objective}</p></div>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600"><Users className="h-3.5 w-3.5" /> Shared by Set 1 + Set 2</span>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                        {tumblingExercises.map((exercise) => <ExerciseTile key={exercise.id} exercise={exercise} ageBand={ageBand} status={effectiveFlipFitCardStatus(exercise.card, referenceMap)} statusIsLive={referenceMap.has(exercise.cardId)} onOpen={setSelectedExercise} />)}
                      </div>
                    </section>
                  )
                })()}
              </div>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 font-bold text-gray-950"><Layers3 className="h-4 w-4 text-vortex-red" /> Daily stress snapshot</h3>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-gray-50 p-2"><dt className="text-xs text-gray-500">Primary region</dt><dd className="font-bold text-gray-900">{selectedSession.stress.primaryRegion}</dd></div>
                    <div className="rounded-lg bg-gray-50 p-2"><dt className="text-xs text-gray-500">Impact</dt><dd className="font-bold text-gray-900">{selectedSession.stress.impact}/3</dd></div>
                    <div className="rounded-lg bg-gray-50 p-2"><dt className="text-xs text-gray-500">Freshness</dt><dd className="font-bold text-gray-900">{selectedSession.stress.freshness}/3</dd></div>
                    <div className="rounded-lg bg-gray-50 p-2"><dt className="text-xs text-gray-500">Eccentric demand</dt><dd className="font-bold text-gray-900">{selectedSession.stress.eccentricDemand}/3</dd></div>
                  </dl>
                  {selectedSessionWarnings.length === 0 ? (
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> No consecutive-day stress conflict ends on this session.</p>
                  ) : (
                    <div className="mt-3 space-y-2" role="alert">
                      {selectedSessionWarnings.map((issue) => (
                        <p key={`${issue.code}-${issue.sessionId}`} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-relaxed text-amber-950"><strong>{issue.message}</strong> {issue.resolution}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 font-bold text-gray-950"><Dumbbell className="h-4 w-4 text-vortex-red" /> Equipment policy</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{FLIP_FIT_EQUIPMENT_POLICY.foundation}</p>
                  <details className="mt-3 text-xs text-gray-600"><summary className="cursor-pointer font-semibold text-gray-900">Younger-athlete equipment note</summary><p className="mt-2 leading-relaxed">{FLIP_FIT_EQUIPMENT_POLICY.under9}</p></details>
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      <footer className="rounded-2xl border border-gray-200 bg-gray-950 p-4 text-gray-300 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-vortex-red" /><p className="text-sm"><strong className="text-white">Every athlete: 120 minutes.</strong> Athletic work remains 90 minutes; tumbling remains a separate 30-minute shared block.</p></div>
          <span className="text-xs font-semibold text-gray-500">Program v{program.version} · deterministic from {program.startDate}</span>
        </div>
      </footer>

      {selectedExercise && (
        <FlipFitExerciseModal
          exercise={selectedExercise}
          ageBand={ageBand}
          matchStatus={effectiveFlipFitCardStatus(selectedExercise.card, referenceMap)}
          canonicalReference={referenceMap.get(selectedExercise.cardId) ?? null}
          onAgeBandChange={changeAgeBand}
          onClose={() => setSelectedExercise(null)}
        />
      )}
    </div>
  )
}
