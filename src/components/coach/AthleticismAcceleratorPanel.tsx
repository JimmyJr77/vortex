import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Activity, ArrowDownUp, ArrowLeft, ArrowRight, ArrowRightLeft, ArrowUp, ArrowUpRight, BookOpen, Check, ChevronLeft, ChevronRight, Clock3, Info, Layers, Loader2, Move, MoveHorizontal, Package, RotateCw, Search, Target, X, Zap } from 'lucide-react'
import { ACCELERATOR_PHASES, ACCELERATOR_PROGRAMS, ACCELERATOR_PLAN_GUIDANCE, EQUIPMENT_NOTES, getAcceleratorSessions, type AcceleratorExercise, type AcceleratorPlanGuidance, type AcceleratorPhase, type AcceleratorProgramId, type AcceleratorSession } from '../../coach/athleticismAccelerator'
import { ACCESS_PREPARE_PURPOSES, ACCESS_PREPARE_STANDARD, type AccessPrepareRoutineExercise } from '../../coach/accessPrepareStandard'
import { coachFetch } from '../../coach/api'
import type { Exercise } from '../../coach/types'
import ExerciseDetailModal from './ExerciseDetailModal'

function MaxAirIcon({ className }: { className?: string }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 18a8 8 0 0 1 16 0" />
    <path d="m17 15 3 3 3-3" />
    <path d="M12 21V3m-4 4 4-4 4 4" />
  </svg>
}

function ForceIcon({ className }: { className?: string }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <text x="11" y="21" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontSize="26">F</text>
  </svg>
}

function RotationalForceIcon({ className }: { className?: string }) {
  return <RotateCw className={className} aria-hidden="true">
    <text x="11.5" y="17" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontSize="16" fill="currentColor" stroke="none">F</text>
  </RotateCw>
}

function AccessPrepareIcon({ className }: { className?: string }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M5.5 3c3 2.4-3 4.7 0 7.2s-3 4.9 0 7.3S3.8 20.7 5.5 21" />
    <path d="M12 3c3 2.4-3 4.7 0 7.2s-3 4.9 0 7.3-1.7 3.2 0 3.5" />
    <path d="M18.5 3c3 2.4-3 4.7 0 7.2s-3 4.9 0 7.3-1.7 3.2 0 3.5" />
  </svg>
}

const PROGRAM_ICONS = { prepare: AccessPrepareIcon, endurance: Activity, speed: Zap, horizontal: MoveHorizontal, vertical: ArrowUp, rebound: ArrowDownUp, maxair: MaxAirIcon, mobility: Move, reactive: ArrowRightLeft, upper: RotateCw, lower: RotateCw, fullbody: ForceIcon, rotationfullbody: RotationalForceIcon }
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vortex-red focus-visible:ring-offset-2'
type Detail = { title: string; eyebrow?: string; content: ReactNode }
type LibraryExerciseTarget = { name: string; librarySlug: string }
type ProgramType = 'all' | 'individual' | 'grouped'
const timeLabel = (session: AcceleratorSession) => session.minutes ? `${session.minutes.join('–')} min + preparation` : 'Timing & delivery'
const catalogMetric = (item: (typeof ACCELERATOR_PROGRAMS)[number]) => item.kind === 'routine' ? `${item.durationMinutes}min` : `${item.classCount} Classes`

export default function AthleticismAcceleratorPanel() {
  const [programId, setProgramId] = useState<AcceleratorProgramId | null>(null)
  const [search, setSearch] = useState('')
  const [programType, setProgramType] = useState<ProgramType>('all')
  const [classIndex, setClassIndex] = useState(0)
  const [phase, setPhase] = useState<AcceleratorPhase>('E')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [libraryExercise, setLibraryExercise] = useState<Exercise | null>(null)
  const [libraryLoadingSlug, setLibraryLoadingSlug] = useState<string | null>(null)
  const selectedProgram = ACCELERATOR_PROGRAMS.find((program) => program.id === programId)
  const sessions = selectedProgram?.kind === 'program' ? getAcceleratorSessions(selectedProgram.id) : []
  const session = sessions[classIndex]
  const guidance = selectedProgram?.kind === 'program' ? ACCELERATOR_PLAN_GUIDANCE[selectedProgram.id] : undefined
  const selectProgram = (id: AcceleratorProgramId | null) => { setProgramId(id); setClassIndex(0); setPhase('E'); setDetail(null); setLibraryExercise(null) }
  const selectClass = (index: number) => { setClassIndex(index); setDetail(null); setLibraryExercise(null) }
  const openLibraryCard = async (exercise: LibraryExerciseTarget) => {
    setLibraryLoadingSlug(exercise.librarySlug)
    try {
      setLibraryExercise(await coachFetch<Exercise>(`/api/coach/exercises/by-slug/${encodeURIComponent(exercise.librarySlug)}`))
    } catch (error) {
      setDetail({
        title: 'Exercise card unavailable',
        eyebrow: exercise.name,
        content: <p>{error instanceof Error ? error.message : 'The exercise card could not be loaded.'}</p>,
      })
    } finally {
      setLibraryLoadingSlug(null)
    }
  }

  const classProgramCount = ACCELERATOR_PROGRAMS.filter((item) => item.kind === 'program').length

  return <div className="space-y-5 pb-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Session Design</p>
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">Athleticism Accelerator</h2>
        {!selectedProgram && <p className="mt-1 text-sm text-gray-500">A clear plan. A focused session.</p>}
      </div>
      {!selectedProgram && <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">1 standard routine · {classProgramCount} programs</span>}
    </header>
    {!selectedProgram ? <ProgramCards onSelect={selectProgram} search={search} onSearch={setSearch} programType={programType} onProgramTypeChange={setProgramType} /> : <>
      <button type="button" onClick={() => selectProgram(null)} className={`flex items-center gap-2 rounded-lg px-1 py-2 text-sm font-semibold text-gray-600 hover:text-vortex-red ${FOCUS_RING}`}><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back</button>
      {selectedProgram.kind === 'routine' ? <AccessPrepareRoutineView
        onOpenExercise={(exercise) => setDetail({ title: exercise.name, eyebrow: `Access & Prepare · ${exercise.order}`, content: <AccessPrepareExerciseNotes exercise={exercise} /> })}
        onOpenDelivery={() => setDetail({ title: 'Timing & delivery', eyebrow: selectedProgram.title, content: <AccessPrepareDeliveryNotes /> })}
        onOpenSetup={() => setDetail({ title: 'Equipment, space & safety', eyebrow: selectedProgram.title, content: <AccessPrepareSetupNotes /> })}
      /> : <div role="region" id={`accelerator-panel-${programId}`} aria-labelledby={`accelerator-title-${programId}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 id={`accelerator-title-${programId}`} className="text-xl font-bold text-gray-950">{selectedProgram.title} <span className="font-normal text-gray-400">{selectedProgram.classCount} Classes</span></h3><p className="mt-1 text-xs text-gray-500">{guidance?.cadence ?? `${selectedProgram.classCount} class exposures`} · Ages 12–14 · Coach-led</p></div><button type="button" className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${FOCUS_RING}`} onClick={() => setDetail({ title: `The ${selectedProgram.classCount}-class plan`, eyebrow: selectedProgram.title, content: <PlanOverview sessions={sessions} selected={classIndex} onSelect={selectClass} guidance={guidance} /> })}><Layers className="h-4 w-4" /> Plan overview</button></div>
        {guidance && <p className="mb-4 rounded-xl border border-red-100 bg-red-50/50 px-4 py-3 text-sm leading-relaxed text-gray-600">{selectedProgram.description} {guidance.overview}</p>}
        <ClassSelector sessions={sessions} selected={classIndex} onSelect={selectClass} />
        <section className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-label={`Class ${session.n} workout`}><div className="border-b border-gray-100 bg-gradient-to-r from-red-50/70 to-white px-4 py-4 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2.5"><span className="rounded-md bg-vortex-red px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Class {session.n}</span><h4 className="font-bold text-gray-950">{session.title}</h4></div><button type="button" className={`flex items-center gap-1.5 rounded text-xs text-gray-600 hover:text-vortex-red ${FOCUS_RING}`} onClick={() => setDetail({ title: 'Timing & delivery', content: <DeliveryNotes session={session} /> })}><Clock3 className="h-3.5 w-3.5" /> {timeLabel(session)} <Info className="h-3.5 w-3.5" /></button></div><p className="mt-2 text-sm leading-relaxed text-gray-600">{session.effort}</p></div>
          <div className="grid xl:grid-cols-[minmax(0,1fr)_240px]"><aside className="border-b border-gray-100 bg-gray-50/60 p-4 xl:order-2 xl:border-b-0 xl:border-l" aria-label="Equipment for the day"><h5 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><Package className="h-4 w-4 text-vortex-red" /> Equipment for the day</h5><ul className="flex flex-wrap gap-2 xl:flex-col">{session.equipment.length ? session.equipment.map((item) => <li key={item} className="flex items-center gap-2 rounded-lg border border-gray-200/80 bg-white px-2.5 py-2 text-xs font-medium text-gray-700"><Check className="h-3.5 w-3.5 shrink-0 text-gray-400" /> {item}</li>) : <li className="flex items-center gap-2 rounded-lg border border-gray-200/80 bg-white px-2.5 py-2 text-xs font-medium text-gray-700"><Check className="h-3.5 w-3.5 shrink-0 text-gray-400" /> Bodyweight</li>}<li className="flex items-center gap-2 rounded-lg border border-gray-200/80 bg-white px-2.5 py-2 text-xs font-medium text-gray-700"><Target className="h-3.5 w-3.5 shrink-0 text-gray-400" /> Clear working space</li></ul><button type="button" className={`mt-3 flex items-center gap-1.5 rounded text-xs font-semibold text-vortex-red hover:underline ${FOCUS_RING}`} onClick={() => setDetail({ title: 'Equipment & station setup', eyebrow: `Class ${session.n}`, content: <EquipmentNotes session={session} /> })}>Setup & substitutions <ArrowUpRight className="h-3.5 w-3.5" /></button><div className="mt-4 hidden border-t border-gray-200 pt-4 xl:block"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Today’s plan</p><div className="mt-2 flex gap-5"><div><p className="text-xl font-bold tabular-nums text-gray-900">14</p><p className="text-[11px] text-gray-500">exercises</p></div><div><p className="text-xl font-bold tabular-nums text-gray-900">6</p><p className="text-[11px] text-gray-500">primary lifts</p></div></div></div></aside>
            <div className="min-w-0 p-4 sm:p-5"><PhaseSelector selected={phase} onSelect={setPhase} /><div role="tabpanel" id={`accelerator-phase-panel-${phase}`} aria-labelledby={`accelerator-phase-${phase}`} className="mt-4">{phase === 'prepare' ? <PreparationView session={session} onOpen={(exercise) => setDetail({ title: exercise.name, eyebrow: `Class ${session.n} · ${exercise.id}`, content: <ExerciseNotes exercise={exercise} /> })} onOpenCard={openLibraryCard} loadingSlug={libraryLoadingSlug} /> : <><PhaseBrief phase={phase} /><div className="mt-3 divide-y divide-gray-100">{session.exercises.filter((exercise) => exercise.id.startsWith(phase)).map((exercise, index) => <div key={exercise.id}>{phase === 'E' && index % 2 === 0 && session.connections?.[index / 2] && <ConnectionBrief connection={session.connections[index / 2]} />}<ExerciseRow exercise={exercise} anchor={index === 0 && phase !== 'S'} onOpen={() => setDetail({ title: exercise.name, eyebrow: `Class ${session.n} · ${exercise.id}`, content: <ExerciseNotes exercise={exercise} /> })} onOpenCard={() => void openLibraryCard(exercise)} cardLoading={libraryLoadingSlug === exercise.librarySlug} /></div>)}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3"><button type="button" className={`flex items-center gap-1.5 rounded text-xs font-medium text-gray-500 hover:text-vortex-red ${FOCUS_RING}`} onClick={() => setDetail({ title: 'Coaching considerations', eyebrow: `Class ${session.n}`, content: <CoachingNotes session={session} phase={phase} /> })}><Info className="h-3.5 w-3.5" /> Quality, scaling & readiness</button>{phase !== 'P' && <button type="button" className={`flex items-center gap-1 rounded text-xs font-semibold text-vortex-red ${FOCUS_RING}`} onClick={() => setPhase(phase === 'E' ? 'S' : 'P')}>Next: {phase === 'E' ? 'Resilience' : 'Primary strength'} <ChevronRight className="h-4 w-4" /></button>}</div></>}</div></div>
          </div></section>
      </div>}
    </>}
    {detail && <DetailDialog detail={detail} onClose={() => setDetail(null)} />}
    {libraryExercise && <ExerciseDetailModal exerciseId={libraryExercise.id} preview={libraryExercise} onClose={() => setLibraryExercise(null)} />}
  </div>
}

function ProgramCards({ onSelect, search, onSearch, programType, onProgramTypeChange }: {
  onSelect: (id: AcceleratorProgramId) => void
  search: string
  onSearch: (value: string) => void
  programType: ProgramType
  onProgramTypeChange: (value: ProgramType) => void
}) {
  const searchId = useId()
  const programTypeId = useId()
  const suggestionsId = useId()
  const programsByType = ACCELERATOR_PROGRAMS.filter((program) => programType === 'all' || (program.kind === 'program' && program.classCount === (programType === 'individual' ? 12 : 36)))
  const query = search.trim().toLowerCase()
  const programs = programsByType.filter((program) => `${program.title} ${program.description} ${program.category} ${catalogMetric(program)}`.toLowerCase().includes(query))
  const clearFilters = () => { onSearch(''); onProgramTypeChange('all') }

  return <>
    <div className="relative overflow-hidden rounded-2xl bg-gray-950 px-5 py-6 text-white sm:px-6">
      <p className="relative text-[11px] font-bold uppercase tracking-[0.18em] text-red-300">Built around the workout</p>
      <h3 className="relative mt-2 text-xl font-semibold">Choose a quality. See the day’s plan.</h3>
      <p className="relative mt-2 max-w-xl text-sm text-gray-300">Equipment, exercise doses, and recovery in one view. Open coaching notes when you need more.</p>
    </div>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">Your program collection</h3>
        <p className="text-xs text-gray-500">Standard preparation, focused courses, and complete development plans</p>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <label htmlFor={searchId} className="mb-1.5 block text-xs font-semibold text-gray-700">Search programs</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input id={searchId} type="search" list={suggestionsId} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search by name or athletic focus…" autoComplete="off" className={`w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 ${FOCUS_RING}`} />
            <datalist id={suggestionsId}>{programsByType.map((program) => <option key={program.id} value={program.title} />)}</datalist>
          </div>
        </div>
        <div className="min-w-0">
          <label htmlFor={programTypeId} className="mb-1.5 block text-xs font-semibold text-gray-700">Program type</label>
          <select id={programTypeId} value={programType} onChange={(event) => onProgramTypeChange(event.target.value as ProgramType)} className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 ${FOCUS_RING}`}>
            <option value="all">All programs</option>
            <option value="individual">Individual athletic focal points</option>
            <option value="grouped">Grouped athletic focal points</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p role="status" className="text-xs text-gray-500">{programs.length} of {ACCELERATOR_PROGRAMS.length} collection items</p>
        {(search || programType !== 'all') && <button type="button" onClick={clearFilters} className={`rounded text-xs font-semibold text-vortex-red hover:underline ${FOCUS_RING}`}>Clear filters</button>}
      </div>
    </div>
    {programs.length ? <section aria-label="Athleticism Accelerator collection" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {programs.map((program) => {
        const Icon = PROGRAM_ICONS[program.icon]
        const featured = program.kind === 'program' && program.classCount === 36
        const metric = catalogMetric(program)
        return <button key={program.id} type="button" onClick={() => onSelect(program.id)} aria-label={`${program.title} ${metric}`} className={`group flex flex-col rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-vortex-red hover:shadow-sm ${FOCUS_RING} ${featured ? 'border-red-300 bg-red-50/50' : ''}`}>
          <div className="mb-4 flex w-full items-center justify-between gap-3">
            <span data-testid={program.kind === 'routine' ? 'access-prepare-standard-icon' : undefined} className={`rounded-xl p-2.5 ${program.kind === 'routine' ? 'bg-black text-white' : featured ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-600'}`}><Icon className={`h-5 w-5 ${program.icon === 'lower' ? 'rotate-180' : ''}`} /></span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-vortex-red">{program.kind === 'routine' ? 'View routine' : `View ${program.classCount} classes`}</span>
          </div>
          <h4 className="text-base font-bold text-gray-950">{program.title} <span data-testid={program.kind === 'routine' ? 'access-prepare-standard-metric' : undefined} className="whitespace-nowrap text-sm font-medium text-gray-400">{metric}</span></h4>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">{program.description}</p>
          <div className="mt-4 flex w-full items-center justify-between border-t border-gray-200/70 pt-3 text-xs">
            <span className="font-semibold text-vortex-red">{program.kind === 'routine' ? 'Open standard routine' : 'Open workout plan'}</span>
            <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-vortex-red" />
          </div>
        </button>
      })}
    </section> : <div className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center">
      <p className="text-sm font-semibold text-gray-800">No programs match your filters.</p>
      <p className="mt-1 text-xs text-gray-500">Try another search or choose a different program type.</p>
    </div>}
  </>
}

function AccessPrepareRoutineView({ onOpenExercise, onOpenDelivery, onOpenSetup }: {
  onOpenExercise: (exercise: AccessPrepareRoutineExercise) => void
  onOpenDelivery: () => void
  onOpenSetup: () => void
}) {
  const routine = ACCESS_PREPARE_STANDARD
  return <div role="region" id="accelerator-panel-access-prepare-standard" aria-labelledby="accelerator-title-access-prepare-standard">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 id="accelerator-title-access-prepare-standard" className="text-xl font-bold text-gray-950">{routine.title} <span className="font-normal text-gray-400">{routine.durationMinutes}min</span></h3>
        <p className="mt-1 text-xs text-gray-500">Fixed base + 2 day-specific bridge drills · Coach-led</p>
      </div>
      <button type="button" className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${FOCUS_RING}`} onClick={onOpenDelivery}><Clock3 className="h-4 w-4" /> Timing & delivery</button>
    </div>

    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-label="Access & Prepare Standard routine">
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-100 to-white px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5"><span className="rounded-md bg-black px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Standard base</span><h4 className="font-bold text-gray-950">Saved exercise sequence</h4></div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500"><Clock3 className="h-3.5 w-3.5" /> 15-minute preparation block</span>
        </div>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-gray-600">{routine.summary}</p>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_250px]">
        <aside className="border-b border-gray-100 bg-gray-50/60 p-4 xl:order-2 xl:border-b-0 xl:border-l" aria-label="Access and Prepare equipment">
          <h5 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><Package className="h-4 w-4 text-vortex-red" /> Equipment & space</h5>
          <ul className="space-y-2">{routine.equipment.map((item) => <li key={item} className="flex items-start gap-2 rounded-lg border border-gray-200/80 bg-white px-2.5 py-2 text-xs leading-relaxed text-gray-700"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" /> {item}</li>)}</ul>
          <button type="button" className={`mt-3 flex items-center gap-1.5 rounded text-xs font-semibold text-vortex-red hover:underline ${FOCUS_RING}`} onClick={onOpenSetup}>Setup, scaling & safety <ArrowUpRight className="h-3.5 w-3.5" /></button>
          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Routine at a glance</p>
            <div className="mt-2 flex gap-5"><div><p className="text-xl font-bold tabular-nums text-gray-900">{routine.exercises.length}</p><p className="text-[11px] text-gray-500">exercises</p></div><div><p className="text-xl font-bold tabular-nums text-gray-900">{routine.purposes.length}</p><p className="text-[11px] text-gray-500">purposes</p></div></div>
          </div>
        </aside>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Preparation purposes</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{ACCESS_PREPARE_PURPOSES.map((purpose) => <span key={purpose} className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700">{purpose}</span>)}</div>
            <p className="mt-3 text-xs leading-relaxed text-gray-600">{routine.memorizationNote}</p>
          </div>

          <ol aria-label="Access & Prepare Standard sequence" className="mt-4 divide-y divide-gray-100">
            {routine.exercises.map((exercise) => <RoutineExerciseRow key={exercise.id} exercise={exercise} onOpen={() => onOpenExercise(exercise)} />)}
          </ol>

          <div role="note" aria-label="Final coaching checkpoints" className="mt-4 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-vortex-red">Why hinge and squat finish the base</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-700">{routine.endCheckpointNote}</p>
          </div>

          <section aria-labelledby="day-specific-finish-title" className="mt-4 rounded-xl bg-gray-950 p-4 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-300">After the fixed 16-exercise base</p>
            <h5 id="day-specific-finish-title" className="mt-1 font-bold">Two drills specific to today’s Explosiveness work</h5>
            <p className="mt-2 text-xs leading-relaxed text-gray-300">{routine.daySpecificFinish.instruction}</p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">{routine.daySpecificFinish.drills.map((drill) => <li key={drill.order} className="rounded-lg border border-white/15 bg-white/5 p-3"><p className="text-xs font-bold text-white"><span className="mr-1.5 text-red-300">{drill.order}.</span>{drill.role}</p><p className="mt-1 text-xs leading-relaxed text-gray-300">{drill.purpose}</p></li>)}</ol>
          </section>
        </div>
      </div>
    </section>
  </div>
}

function RoutineExerciseRow({ exercise, onOpen }: { exercise: AccessPrepareRoutineExercise; onOpen: () => void }) {
  const checkpoint = exercise.order >= 15
  return <li data-routine-order={exercise.order} className="flex items-start gap-3 py-3">
    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${checkpoint ? 'bg-red-50 text-vortex-red' : 'bg-gray-100 text-gray-500'}`}>{exercise.order}</span>
    <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-2 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_170px]">
      <div className="min-w-0">
        <div className="mb-0.5 flex flex-wrap gap-1">{exercise.purposes.map((purpose) => <span key={purpose} className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{purpose}</span>)}</div>
        <button type="button" onClick={onOpen} aria-label={`Routine details for ${exercise.name}`} className={`group flex max-w-full items-start gap-1.5 rounded text-left text-sm font-semibold leading-snug text-gray-900 hover:text-vortex-red ${FOCUS_RING}`}><span>{exercise.name}</span><Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 group-hover:text-vortex-red" /></button>
        <p className="mt-1 text-[11px] text-gray-500">{exercise.equipment.join(' · ')}{checkpoint ? ' · Coaching checkpoint' : ''}{exercise.versionNote ? ' · Version defined' : ''}</p>
      </div>
      <div className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1"><span className="inline-block rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">{exercise.dose}</span><span className="mt-1 block text-[11px] text-gray-500">Flow on when spacing and quality are set.</span></div>
    </div>
  </li>
}

function DetailList({ items, ordered = false }: { items: readonly string[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul'
  return <List className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1.5 pl-5`}>{items.map((item) => <li key={item}>{item}</li>)}</List>
}

function AccessPrepareExerciseNotes({ exercise }: { exercise: AccessPrepareRoutineExercise }) {
  return <div className="space-y-5">
    <div className="rounded-xl bg-gray-50 p-4"><p className="font-semibold text-gray-900">{exercise.dose}</p><p className="mt-1 text-xs text-gray-500">Order {exercise.order} of {ACCESS_PREPARE_STANDARD.exercises.length} · {exercise.purposes.join(' · ')}</p></div>
    {exercise.versionNote && <Note title="Version note"><p>{exercise.versionNote}</p></Note>}
    <Note title="Why this exercise"><p>{exercise.whyHere}</p></Note>
    <Note title="Equipment"><p>{exercise.equipment.join(' · ')}</p></Note>
    <Note title="Setup"><DetailList items={exercise.setup} ordered /></Note>
    <Note title="Execution"><DetailList items={exercise.executionSteps} ordered /></Note>
    <Note title="Coach cues"><DetailList items={exercise.coachCues} /></Note>
    <Note title="Athlete cues"><DetailList items={exercise.athleteCues} /></Note>
    <Note title="Quality gate"><DetailList items={exercise.qualityGates} /></Note>
    <Note title="Scaling"><DetailList items={exercise.scaling} /></Note>
    <Note title="Common faults"><DetailList items={exercise.commonFaults} /></Note>
    <Note title="Stop or switch"><DetailList items={exercise.stopSigns} /></Note>
  </div>
}

function AccessPrepareDeliveryNotes() {
  const routine = ACCESS_PREPARE_STANDARD
  return <div className="space-y-5">
    <Note title="Routine intent"><p>{routine.purpose}</p></Note>
    <Note title={routine.timing.target}><DetailList items={routine.timing.delivery} /></Note>
    <Note title="Keep the base familiar"><p>{routine.memorizationNote}</p></Note>
    <Note title="Protect the final checkpoints"><p>{routine.endCheckpointNote}</p></Note>
    <Note title="Day-specific finish"><p>{routine.daySpecificFinish.instruction}</p><ol className="mt-4 space-y-5">{routine.daySpecificFinish.drills.map((drill) => <li key={drill.order} className="space-y-2"><p><strong>{drill.order}. {drill.role}.</strong> {drill.purpose}</p><p><strong>Selection:</strong> {drill.selection}</p><p className="font-semibold text-gray-900">Delivery</p><DetailList items={drill.delivery} /><p className="font-semibold text-gray-900">Quality gates</p><DetailList items={drill.qualityGates} /></li>)}</ol></Note>
  </div>
}

function AccessPrepareSetupNotes() {
  const routine = ACCESS_PREPARE_STANDARD
  return <div className="space-y-5">
    <Note title="Equipment"><DetailList items={routine.equipment} /></Note>
    <Note title="Space & group flow"><DetailList items={routine.space} /></Note>
    <Note title="Safety & adjustment"><DetailList items={routine.safety} /></Note>
  </div>
}

function moveTab(event: KeyboardEvent<HTMLDivElement>) { const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')); const index = tabs.indexOf(document.activeElement as HTMLButtonElement); const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null; if (next === null) return; event.preventDefault(); tabs[next].focus(); tabs[next].click() }
function ClassSelector({ sessions, selected, onSelect }: { sessions: AcceleratorSession[]; selected: number; onSelect: (index: number) => void }) { return <div className="rounded-xl border border-gray-200 bg-white px-3 py-3"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Select a class</p><div className="flex items-center gap-3"><span className="text-[11px] tabular-nums text-gray-500">{selected + 1} of {sessions.length}</span><button type="button" aria-label="Previous class" disabled={selected === 0} onClick={() => onSelect(selected - 1)} className={`rounded p-1 text-gray-600 disabled:opacity-25 ${FOCUS_RING}`}><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label="Next class" disabled={selected === sessions.length - 1} onClick={() => onSelect(selected + 1)} className={`rounded p-1 text-gray-600 disabled:opacity-25 ${FOCUS_RING}`}><ChevronRight className="h-4 w-4" /></button></div></div><div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">{sessions.map((item, index) => <button key={item.n} type="button" aria-label={`Class ${item.n}: ${item.title}`} aria-pressed={selected === index} onClick={() => onSelect(index)} className={`rounded-md py-2 text-sm font-semibold tabular-nums ${FOCUS_RING} ${selected === index ? 'bg-vortex-red text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-vortex-red'}`}>{String(item.n).padStart(2, '0')}</button>)}</div></div> }
function PhaseSelector({ selected, onSelect }: { selected: AcceleratorPhase; onSelect: (phase: AcceleratorPhase) => void }) { return <div role="tablist" aria-label="Workout phases" onKeyDown={moveTab} className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 sm:grid-cols-4">{ACCELERATOR_PHASES.map((item, index) => <button key={item.id} type="button" role="tab" id={`accelerator-phase-${item.id}`} aria-controls={`accelerator-phase-panel-${item.id}`} aria-selected={selected === item.id} onClick={() => onSelect(item.id)} className={`rounded-md px-2 py-2 text-left ${FOCUS_RING} ${selected === item.id ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}><span className={`block text-xs font-bold ${selected === item.id ? 'text-vortex-red' : 'text-gray-600'}`}>{index + 1}. {item.title}</span><span className="mt-1 block text-[10px] text-gray-500">{item.subtitle}</span></button>)}</div> }
function ConnectionBrief({ connection }: { connection: NonNullable<AcceleratorSession['connections']>[number] }) {
  return <div role="note" aria-label={`Connection ${connection.slots.join(' and ')}`} className="mt-4 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2.5">
    <p className="text-xs font-bold text-vortex-red">{connection.slots.join(' + ')} · {connection.title}</p>
    <p className="mt-1 text-xs leading-relaxed text-gray-700">{connection.cue}</p>
  </div>
}
function PhaseBrief({ phase }: { phase: AcceleratorPhase }) { const notes = phase === 'E' ? 'Use fast, purposeful efforts. Follow the prescribed recovery and preserve technique.' : phase === 'S' ? 'Keep work light and controlled. The goal is resilience, not fatigue.' : 'Leave 2–3 clean reps in reserve and use the prescribed load-preparation sets.'; return <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-600">{notes}</div> }
function ExerciseRow({ exercise, anchor, onOpen, onOpenCard, cardLoading = false }: { exercise: AcceleratorExercise; anchor: boolean; onOpen: () => void; onOpenCard: () => void; cardLoading?: boolean }) { return <div className="flex items-start gap-3 py-2.5"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${anchor ? 'bg-red-50 text-vortex-red' : 'bg-gray-100 text-gray-500'}`}>{exercise.id}</span><div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_24px] gap-x-2 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_190px_24px]"><div className="min-w-0">{exercise.sourceTrack && <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-vortex-red">{exercise.sourceTrack} · Source class {exercise.sourceClass}</p>}<button type="button" onClick={onOpen} className={`rounded text-left text-sm font-semibold leading-snug text-gray-900 hover:text-vortex-red ${FOCUS_RING}`}>{exercise.name}</button><p className="mt-1 text-[11px] text-gray-500">{exercise.equipment.join(' · ')}{anchor ? ' · Main focus' : ''}</p></div><div className="col-start-2 row-start-1 flex flex-col items-center gap-0.5 self-start sm:col-start-3"><button type="button" onClick={onOpen} aria-label={`Coaching notes for ${exercise.name}`} className={`rounded p-1 text-gray-400 hover:bg-red-50 hover:text-vortex-red ${FOCUS_RING}`}><Info className="h-4 w-4" /></button><button type="button" onClick={onOpenCard} disabled={cardLoading} aria-label={`Open exercise card for ${exercise.name}`} title="Open exercise library card" className={`rounded p-1 text-gray-400 hover:bg-red-50 hover:text-vortex-red disabled:cursor-wait disabled:opacity-60 ${FOCUS_RING}`}>{cardLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}</button></div><div className="col-start-1 row-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:col-start-2 sm:row-start-1 sm:block"><span className="inline-block rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">{exercise.prescription}</span><span className="flex items-start gap-1 text-[11px] text-gray-500 sm:mt-1"><Clock3 className="mt-0.5 h-3 w-3 shrink-0" /> {exercise.rest}</span></div></div></div> }
function PreparationView({ session, onOpen, onOpenCard, loadingSlug }: { session: AcceleratorSession; onOpen: (exercise: AcceleratorExercise) => void; onOpenCard: (exercise: AcceleratorExercise) => Promise<void>; loadingSlug: string | null }) { const exercises = session.prepareExercises ?? []; return <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6"><Activity className="mb-3 h-6 w-6 text-vortex-red" /><h5 className="font-semibold text-gray-900">Access & Prepare 1</h5><p className="mt-2 text-sm leading-relaxed text-gray-600">{session.preparation || 'Complete the existing predetermined sequence before explosive work.'}</p>{exercises.length > 0 && <div className="mt-4 divide-y divide-gray-100">{exercises.map((exercise) => <ExerciseRow key={exercise.id} exercise={exercise} anchor={false} onOpen={() => onOpen(exercise)} onOpenCard={() => void onOpenCard(exercise)} cardLoading={loadingSlug === exercise.librarySlug} />)}</div>}</div> }
function Note({ title, children }: { title: string; children: ReactNode }) { return <section><h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h4><div className="text-sm leading-relaxed text-gray-700">{children}</div></section> }
function ExerciseNotes({ exercise }: { exercise: AcceleratorExercise }) { return <div className="space-y-5"><div className="rounded-xl bg-gray-50 p-4"><p className="font-semibold text-gray-900">{exercise.dose}</p><p className="mt-1 text-xs text-gray-500">Recovery: {exercise.rest}</p></div>{exercise.sourceTrack && <Note title="Source plan"><p>{exercise.sourceTrack}, Class {exercise.sourceClass}, exercise {exercise.sourceExerciseId}. Use the dose, recovery and coaching prescribed for this class.</p></Note>}{exercise.preparation && <Note title="Load preparation"><p>{exercise.preparation}</p></Note>}<Note title="Why this exercise"><p>{exercise.purpose}</p></Note><Note title="Execution & scaling"><p>{exercise.instruction}</p></Note><p className="border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-400">Written prescription: {exercise.sourceName}</p></div> }
function EquipmentNotes({ session }: { session: AcceleratorSession }) { return <div className="space-y-5"><Note title="Bring for this class"><ul className="space-y-2">{session.equipment.length ? session.equipment.map((item) => <li key={item}><strong>{item}.</strong> {EQUIPMENT_NOTES[item] ?? 'Confirm safe, usable equipment before delivery.'}</li>) : <li><strong>Bodyweight.</strong> Confirm sufficient clear space for each drill.</li>}</ul></Note><Note title="Station setup"><p>{session.setup || "Confirm clear working space, stable surfaces and secure anchors before athletes begin. Follow each exercise’s written clearance and substitution conditions."}</p></Note><Note title="Group setup"><p>Equipment quantities depend on group size and supervised waves. Add any equipment required by the existing Access & Prepare 1 sequence.</p></Note></div> }
function DeliveryNotes({ session }: { session: AcceleratorSession }) { return <div className="space-y-5"><Note title={session.minutes ? `${session.minutes.join('–')} minutes of prescribed work` : 'Timing to confirm'}><p>{session.delivery || 'Use the written prescription to set the session timing. Add the actual Access & Prepare 1 duration and group queues while preserving prescribed recovery.'}</p></Note><Note title="Session order"><p>Access & Prepare 1 → 6 explosive exercises → 2 light resilience exercises → 6 primary-strength exercises.</p></Note><Note title="Schedule by readiness"><p>Class numbers describe sequence, not consecutive days. Review actual training, technique and recovery before selecting the next class.</p></Note></div> }
function CoachingNotes({ session, phase }: { session: AcceleratorSession; phase: AcceleratorPhase }) { return <div className="space-y-5">{session.quality && <Note title="Today’s quality marker"><p>{session.quality}</p></Note>}<Note title="Class-specific intent"><p>{session.explosiveNotes}</p></Note>{session.phaseNotes?.[phase]?.map((paragraph, index) => <Note key={index} title={index === 0 ? "Phase guidance" : "Recovery & execution"}><p>{paragraph}</p></Note>)}<Note title="Adjust within the dose"><p>On a technical miss, stop, recover and adjust the remaining scheduled attempts. Stop for pain or loss of control. Do not add attempts to replace misses.</p></Note><Note title="Readiness & progression"><p>{session.progression || "Advance one variable only when actual execution and recovery support it; otherwise hold or regress."}</p></Note></div> }
function PlanOverview({ sessions, selected, onSelect, guidance }: { sessions: AcceleratorSession[]; selected: number; onSelect: (index: number) => void; guidance?: AcceleratorPlanGuidance }) { return <div>{guidance && <div className="mb-4 space-y-3 rounded-xl bg-red-50 p-4 text-sm leading-relaxed text-gray-700"><p className="font-semibold text-gray-950">{guidance.cadence}</p><p>{guidance.overview}</p><p>{guidance.progression}</p></div>}<p className="mb-4 text-sm leading-relaxed text-gray-500">{guidance ? 'Class numbers match the development sequence. Choose a class to open its daily plan.' : `${sessions.length} class exposures, selected by athlete readiness. Choose a class to open its daily plan.`}</p><div className="space-y-2">{sessions.map((item, index) => <button key={item.n} type="button" onClick={() => onSelect(index)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${FOCUS_RING} ${selected === index ? 'border-red-200 bg-red-50' : 'border-gray-100 hover:bg-gray-50'}`}><span className="text-sm font-bold tabular-nums text-vortex-red">{String(item.n).padStart(2, '0')}</span><span className="flex-1"><span className="block text-sm font-semibold text-gray-900">{guidance && `Class ${item.n} · `}{item.title}</span><span className="mt-0.5 block text-xs leading-relaxed text-gray-500">{item.effort}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-gray-400" /></button>)}</div></div> }
function DetailDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) { const dialog = useRef<HTMLDialogElement>(null); const titleId = useId(); useEffect(() => { const element = dialog.current; const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null; element?.showModal(); return () => { element?.close(); focus?.focus({ preventScroll: true }) } }, []); return <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }} onKeyDown={(event) => { if (event.key !== 'Tab') return; const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []); const first = controls[0]; const last = controls.at(-1); if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus() } }} className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-gray-950/50"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white p-5"><div>{detail.eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-vortex-red">{detail.eyebrow}</p>}<h3 id={titleId} className="text-lg font-bold leading-snug">{detail.title}</h3></div><button type="button" autoFocus onClick={onClose} aria-label="Close details" className={`shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 ${FOCUS_RING}`}><X className="h-5 w-5" /></button></header><div className="p-5">{detail.content}</div></dialog> }
