import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  Activity, ArrowDownUp, ArrowRight, ArrowUp, ArrowUpRight, Check, ChevronLeft, ChevronRight,
  CircleDot, Clock3, Footprints, Info, Layers, LayoutGrid, Move, MoveHorizontal,
  Package, RotateCw, Sparkles, Target, X, Zap,
} from 'lucide-react'
import {
  ACCELERATOR_PHASES, ACCELERATOR_PROGRAMS, EQUIPMENT_NOTES, ROTATIONAL_UPPER_SESSIONS,
  type AcceleratorExercise, type AcceleratorPhase, type AcceleratorProgram, type AcceleratorProgramId,
  type AcceleratorSession,
} from '../../coach/athleticismAccelerator'

const PROGRAM_ICONS = {
  endurance: Activity, speed: Zap, horizontal: MoveHorizontal, vertical: ArrowUp,
  rebound: ArrowDownUp, mobility: Move, reactive: Sparkles, upper: RotateCw, lower: Footprints, catch: CircleDot,
}
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vortex-red focus-visible:ring-offset-2'
type Detail = { title: string; eyebrow?: string; content: ReactNode }

export default function AthleticismAcceleratorPanel() {
  const [programId, setProgramId] = useState<AcceleratorProgramId | null>(null)
  const [classIndex, setClassIndex] = useState(0)
  const [phase, setPhase] = useState<AcceleratorPhase>('E')
  const [detail, setDetail] = useState<Detail | null>(null)
  const selectedProgram = ACCELERATOR_PROGRAMS.find((program) => program.id === programId)
  const session = ROTATIONAL_UPPER_SESSIONS[classIndex]

  function selectClass(index: number) {
    setClassIndex(index)
    setDetail(null)
  }

  return (
    <div className="space-y-5 pb-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Session Design</p>
          <h2 className="text-2xl font-bold tracking-tight text-gray-950">Athleticism Accelerator</h2>
          {!selectedProgram && <p className="mt-1 text-sm text-gray-500">A clear plan. A focused session.</p>}
        </div>
        {!selectedProgram && <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">10 programs · 12wk</span>}
      </header>

      {selectedProgram ? (
        <>
          <ProgramTabs selected={programId!} onSelect={setProgramId} />
          <div role="tabpanel" id={`accelerator-panel-${programId}`} aria-labelledby={`accelerator-tab-${programId}`}>
            {programId === 'rotation-upper' ? (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-950">Rotational Force: Upper Body <span className="font-normal text-gray-400">12wk</span></h3>
                    <p className="mt-1 text-xs text-gray-500">12 class exposures · Ages 12–14 · Coach-led</p>
                  </div>
                  <button type="button" className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${FOCUS_RING}`}
                    onClick={() => setDetail({ title: 'The 12-class plan', eyebrow: 'Rotational Force: Upper Body', content: <PlanOverview selected={classIndex} onSelect={selectClass} /> })}>
                    <Layers className="h-4 w-4" /> Plan overview
                  </button>
                </div>
                <ClassSelector selected={classIndex} onSelect={selectClass} />
                <section className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-label={`Class ${session.n} workout`}>
                  <div className="border-b border-gray-100 bg-gradient-to-r from-red-50/70 to-white px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-md bg-vortex-red px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Class {session.n}</span>
                        <h4 className="font-bold text-gray-950">{session.title}</h4>
                      </div>
                      <button type="button" className={`flex items-center gap-1.5 rounded text-xs text-gray-600 hover:text-vortex-red ${FOCUS_RING}`}
                        onClick={() => setDetail({ title: 'Timing & delivery', content: <DeliveryNotes session={session} /> })}>
                        <Clock3 className="h-3.5 w-3.5" /> {session.minutes.join('–')} min + preparation <Info className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">{session.effort}</p>
                  </div>

                  <div className="grid xl:grid-cols-[minmax(0,1fr)_240px]">
                    <aside className="border-b border-gray-100 bg-gray-50/60 p-4 xl:order-2 xl:border-b-0 xl:border-l" aria-label="Equipment for the day">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h5 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Package className="h-4 w-4 text-vortex-red" /> Equipment for the day</h5>
                      </div>
                      <ul className="flex flex-wrap gap-2 xl:flex-col">
                        {session.equipment.map((item) => (
                          <li key={item} className="flex items-center gap-2 rounded-lg border border-gray-200/80 bg-white px-2.5 py-2 text-xs font-medium text-gray-700">
                            <Check className="h-3.5 w-3.5 shrink-0 text-gray-400" /> {item}
                          </li>
                        ))}
                        <li className="flex items-center gap-2 rounded-lg border border-gray-200/80 bg-white px-2.5 py-2 text-xs font-medium text-gray-700"><Target className="h-3.5 w-3.5 shrink-0 text-gray-400" /> Cones · clear 10 m lane</li>
                      </ul>
                      <button type="button" className={`mt-3 flex items-center gap-1.5 rounded text-xs font-semibold text-vortex-red hover:underline ${FOCUS_RING}`}
                        onClick={() => setDetail({ title: 'Equipment & station setup', eyebrow: `Class ${session.n}`, content: <EquipmentNotes session={session} /> })}>
                        Setup & substitutions <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                      <div className="mt-4 hidden border-t border-gray-200 pt-4 xl:block">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Today’s volume</p>
                        <div className="mt-2 flex gap-5">
                          <div><p className="text-xl font-bold tabular-nums text-gray-900">{session.releases}</p><p className="text-[11px] text-gray-500">ball releases</p></div>
                          <div><p className="text-xl font-bold tabular-nums text-gray-900">{session.strengthReps}</p><p className="text-[11px] text-gray-500">strength reps</p></div>
                        </div>
                        {session.fastActions > 0 && <p className="mt-2 text-[11px] text-gray-500">+ {session.fastActions} other fast actions</p>}
                      </div>
                    </aside>

                    <div className="min-w-0 p-4 sm:p-5">
                      <PhaseSelector selected={phase} onSelect={setPhase} />
                      <div role="tabpanel" id={`accelerator-phase-panel-${phase}`} aria-labelledby={`accelerator-phase-${phase}`} className="mt-4">
                        {phase === 'prepare' ? <PreparationView session={session} /> : (
                          <>
                            <PhaseBrief phase={phase} session={session} />
                            <div className="mt-3 divide-y divide-gray-100">
                              {session.exercises.filter((exercise) => exercise.phase === phase).map((exercise, index) => (
                                <ExerciseRow key={exercise.id} exercise={exercise} anchor={index === 0 && phase !== 'S'} onOpen={() => setDetail({
                                  title: exercise.name, eyebrow: `Class ${session.n} · ${exercise.id}`,
                                  content: <ExerciseNotes exercise={exercise} />,
                                })} />
                              ))}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                              <button type="button" className={`flex items-center gap-1.5 rounded text-xs font-medium text-gray-500 hover:text-vortex-red ${FOCUS_RING}`}
                                onClick={() => setDetail({ title: 'Coaching considerations', eyebrow: `Class ${session.n}`, content: <CoachingNotes session={session} /> })}>
                                <Info className="h-3.5 w-3.5" /> Quality, scaling & readiness
                              </button>
                              {phase !== 'P' && <button type="button" className={`flex items-center gap-1 rounded text-xs font-semibold text-vortex-red ${FOCUS_RING}`} onClick={() => setPhase(phase === 'E' ? 'S' : 'P')}>
                                Next: {phase === 'E' ? 'Resilience' : 'Primary strength'} <ChevronRight className="h-4 w-4" />
                              </button>}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : <UpcomingProgram program={selectedProgram} onOpenUpper={() => setProgramId('rotation-upper')} />}
          </div>
        </>
      ) : <ProgramCards onSelect={setProgramId} />}
      {detail && <DetailDialog detail={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function ProgramCards({ onSelect }: { onSelect: (id: AcceleratorProgramId) => void }) {
  return <>
    <div className="relative overflow-hidden rounded-2xl bg-gray-950 px-5 py-6 text-white sm:px-6">
      <div className="absolute -right-8 -top-16 h-56 w-56 rounded-full border-[30px] border-white/5" aria-hidden="true" />
      <p className="relative text-[11px] font-bold uppercase tracking-[0.18em] text-red-300">Built around the workout</p>
      <h3 className="relative mt-2 text-xl font-semibold">Choose a quality. See the day’s plan.</h3>
      <p className="relative mt-2 max-w-xl text-sm text-gray-300">Equipment, exercise doses, and recovery in one view. Open coaching notes when you need more.</p>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-gray-800">Your program collection</h3>
      <p className="text-xs text-gray-500">Starting with Rotational Force: Upper Body</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {ACCELERATOR_PROGRAMS.map((program) => {
        const Icon = PROGRAM_ICONS[program.icon]
        const ready = program.id === 'rotation-upper'
        return <button key={program.id} type="button" onClick={() => onSelect(program.id)} aria-label={`${program.title} 12wk`}
          className={`group flex flex-col rounded-xl border p-4 text-left transition hover:border-vortex-red hover:shadow-sm ${FOCUS_RING} ${ready ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-white'}`}>
          <div className="mb-4 flex w-full items-center justify-between gap-3">
            <span className={`rounded-xl p-2.5 ${ready ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-600'}`}><Icon className="h-5 w-5" /></span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${ready ? 'text-vortex-red' : 'text-gray-400'}`}>{ready ? 'View 12 classes' : program.category}</span>
          </div>
          <h4 className="text-base font-bold text-gray-950">{program.title} <span className="whitespace-nowrap text-sm font-medium text-gray-400">12wk</span></h4>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">{program.description}</p>
          <div className="mt-4 flex w-full items-center justify-between border-t border-gray-200/70 pt-3 text-xs">
            <span className={ready ? 'font-semibold text-vortex-red' : 'text-gray-400'}>{ready ? 'Open workout plan' : 'Plan to follow'}</span>
            <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-vortex-red" />
          </div>
        </button>
      })}
    </div>
  </>
}

function moveTab(event: KeyboardEvent<HTMLDivElement>) {
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  const index = tabs.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
  if (next === null) return
  event.preventDefault()
  tabs[next].focus()
  tabs[next].click()
}

function ProgramTabs({ selected, onSelect }: { selected: AcceleratorProgramId; onSelect: (id: AcceleratorProgramId | null) => void }) {
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = list.current
    if (!container) return
    const centerSelected = () => {
      const active = container.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!active) return
      const offset = active.getBoundingClientRect().left - container.getBoundingClientRect().left
      container.scrollLeft += offset - (container.clientWidth - active.clientWidth) / 2
    }
    centerSelected()
    const observer = new ResizeObserver(centerSelected)
    observer.observe(container)
    return () => observer.disconnect()
  }, [selected])
  return <div className="flex min-w-0 gap-3 border-b border-gray-200 pb-2">
    <button type="button" onClick={() => onSelect(null)} aria-label="All programs" title="All programs" className={`shrink-0 self-start rounded-lg border border-gray-200 bg-white p-2.5 text-gray-600 hover:text-vortex-red ${FOCUS_RING}`}><LayoutGrid className="h-4 w-4" /></button>
    <div ref={list} role="tablist" aria-label="Accelerator programs" onKeyDown={moveTab} className="flex min-w-0 gap-1 overflow-x-auto pb-1">
      {ACCELERATOR_PROGRAMS.map((program) => <button key={program.id} type="button" role="tab" id={`accelerator-tab-${program.id}`} aria-controls={`accelerator-panel-${program.id}`} aria-selected={selected === program.id} tabIndex={selected === program.id ? 0 : -1}
        onClick={() => onSelect(program.id)} className={`shrink-0 rounded-lg px-3 py-2.5 text-xs font-semibold ${FOCUS_RING} ${selected === program.id ? 'bg-gray-950 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
        {program.title} <span className="text-gray-400">12wk</span>
      </button>)}
    </div>
  </div>
}

function ClassSelector({ selected, onSelect }: { selected: number; onSelect: (index: number) => void }) {
  return <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
    <div className="mb-2 flex items-center justify-between">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Select a class</p>
      <div className="flex items-center gap-3">
        <span className="text-[11px] tabular-nums text-gray-500">{selected + 1} of 12</span>
        <button type="button" aria-label="Previous class" disabled={selected === 0} onClick={() => onSelect(selected - 1)} className={`rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-25 ${FOCUS_RING}`}><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" aria-label="Next class" disabled={selected === 11} onClick={() => onSelect(selected + 1)} className={`rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-25 ${FOCUS_RING}`}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
      {ROTATIONAL_UPPER_SESSIONS.map((session, index) => <button key={session.n} type="button" aria-label={`Class ${session.n}: ${session.title}`} aria-pressed={selected === index} title={session.title}
        onClick={() => onSelect(index)} className={`rounded-md py-2 text-sm font-semibold tabular-nums ${FOCUS_RING} ${selected === index ? 'bg-vortex-red text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-vortex-red'}`}>
        {String(session.n).padStart(2, '0')}
      </button>)}
    </div>
  </div>
}

function PhaseSelector({ selected, onSelect }: { selected: AcceleratorPhase; onSelect: (phase: AcceleratorPhase) => void }) {
  return <div role="tablist" aria-label="Workout phases" onKeyDown={moveTab} className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 sm:grid-cols-4">
    {ACCELERATOR_PHASES.map((phase, index) => <button key={phase.id} type="button" role="tab" id={`accelerator-phase-${phase.id}`} aria-controls={`accelerator-phase-panel-${phase.id}`} aria-selected={selected === phase.id} tabIndex={selected === phase.id ? 0 : -1}
      onClick={() => onSelect(phase.id)} className={`rounded-md px-2 py-2 text-left ${FOCUS_RING} ${selected === phase.id ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}>
      <span className={`block text-xs font-bold ${selected === phase.id ? 'text-vortex-red' : 'text-gray-600'}`}>{index + 1}. {phase.title}</span>
      <span className="mt-1 block text-[10px] text-gray-500">{phase.subtitle}</span>
    </button>)}
  </div>
}

function PhaseBrief({ phase, session }: { phase: AcceleratorPhase; session: AcceleratorSession }) {
  const notes = phase === 'E'
    ? `Light implements, fast intent. Reset 10–15 s between efforts; ${session.n === 1 ? '90 s between sides, sets and exercises' : 'rest as listed; at least 60 s between exercises'}.`
    : phase === 'S' ? 'Keep it light: 4+ clean reps in reserve. Rest 30–45 s between sides; 45–60 s between exercises.'
      : 'Leave 2–3 clean reps in reserve. Complete each lift’s easy preparation set first. Rest 90 s between exercises.'
  return <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-600">
    <p>{notes}</p>
    {phase === 'E' && <p className="mt-1 font-medium text-gray-800">{[7, 11, 12].includes(session.n) ? 'Supplied-ball drills use controlled handoffs. Clear the lane before every release.' : 'Floor-target throws into a cleared lane. No rebound catches.'}</p>}
    {phase === 'P' && <p className="mt-1 text-gray-500">Easy sets: 30–45 s to change sides, then 60–90 s before working.</p>}
  </div>
}

function ExerciseRow({ exercise, anchor, onOpen }: { exercise: AcceleratorExercise; anchor: boolean; onOpen: () => void }) {
  const label = exercise.name
    .replace(/^Med Ball /, '')
    .replace(/; floor-target adaptation|, floor-target adaptation/g, '')
    .replace(' — paused standing start', ' · paused start')
    .replace(' — non-rebounding slam-ball execution', '')
  return <div className="flex items-start gap-3 py-2.5">
    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${anchor ? 'bg-red-50 text-vortex-red' : 'bg-gray-100 text-gray-500'}`}>{exercise.id}</span>
    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_24px] gap-x-2 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_190px_24px]">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className={`rounded text-left text-sm font-semibold leading-snug text-gray-900 hover:text-vortex-red ${FOCUS_RING}`}>{label}</button>
          <p className="mt-1 text-[11px] text-gray-500">{exercise.equipment.join(' · ')}{anchor ? ' · Main focus' : ''}</p>
        </div>
        <button type="button" onClick={onOpen} aria-label={`Coaching notes for ${exercise.name}`} className={`col-start-2 row-start-1 self-start rounded p-1 text-gray-400 hover:bg-red-50 hover:text-vortex-red sm:col-start-3 ${FOCUS_RING}`}><Info className="h-4 w-4" /></button>
      <div className="col-start-1 row-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:col-start-2 sm:row-start-1 sm:block">
        <span className="inline-block rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">{exercise.prescription}</span>
        <span className="flex items-start gap-1 text-[11px] text-gray-500 sm:mt-1"><Clock3 className="mt-0.5 h-3 w-3 shrink-0" /> {exercise.rest}</span>
      </div>
      {exercise.preparation && <p className="col-span-full text-[11px] text-gray-500">Prepare: {exercise.preparation}, lighter load</p>}
    </div>
  </div>
}

function PreparationView({ session }: { session: AcceleratorSession }) {
  return <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6">
    <Activity className="mb-3 h-6 w-6 text-vortex-red" />
    <h5 className="font-semibold text-gray-900">Access & Prepare 1</h5>
    <p className="mt-2 text-sm leading-relaxed text-gray-600">Complete the existing predetermined sequence before the explosive work. Its exercises and duration have not been supplied with this plan.</p>
    <p className="mt-3 text-xs leading-relaxed text-gray-500">Review the sequence’s actual shoulder and trunk demands. Add its equipment and time to this day’s {session.minutes.join('–')}-minute work estimate.</p>
  </div>
}

function UpcomingProgram({ program, onOpenUpper }: { program: AcceleratorProgram; onOpenUpper: () => void }) {
  const Icon = PROGRAM_ICONS[program.icon]
  return <section className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center">
    <Icon className="mx-auto h-9 w-9 text-gray-300" />
    <h3 className="mt-4 text-xl font-bold text-gray-900">{program.title} 12wk</h3>
    <p className="mt-2 text-sm text-gray-500">This workout view is next in the collection.</p>
    <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">We’re refining the Upper Body plan first, then bringing the same daily view to this program.</p>
    <button type="button" onClick={onOpenUpper} className={`mt-6 inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 ${FOCUS_RING}`}>View Rotational Force: Upper Body <ArrowRight className="h-4 w-4" /></button>
  </section>
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return <section><h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h4><div className="text-sm leading-relaxed text-gray-700">{children}</div></section>
}

function ExerciseNotes({ exercise }: { exercise: AcceleratorExercise }) {
  return <div className="space-y-5">
    <div className="rounded-xl bg-gray-50 p-4"><p className="font-semibold text-gray-900">{exercise.dose}</p><p className="mt-1 text-xs text-gray-500">Rest: {exercise.rest}</p></div>
    <Note title="Why this exercise"><p>{exercise.purpose}</p></Note>
    <Note title="Execution & scaling"><p>{exercise.instruction}</p></Note>
    {exercise.preparation && <Note title="Before working sets"><p>{exercise.preparation} with lighter resistance. Allow 30–45 s between sides, then 60–90 s before working.</p></Note>}
    <p className="border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-400">Written prescription: {exercise.sourceName}</p>
  </div>
}

function EquipmentNotes({ session }: { session: AcceleratorSession }) {
  return <div className="space-y-5">
    <Note title="Bring for this class"><ul className="space-y-2">{session.equipment.map((item) => <li key={item}><strong>{item}.</strong> {EQUIPMENT_NOTES[item]}</li>)}</ul></Note>
    <Note title="Ball station"><p>Use cones to mark a low floor target about 2–3 m beyond the release point in a cleared 10 m lane. Verify floor impact permission, ball rebound and roll containment, and side clearance. Keep waiting athletes and lifting stations outside the ball path.</p></Note>
    <Note title="If a station does not work"><p>Use a verified, compatible throwing wall only after checking rebound clearance. If neither surface contains the ball safely, resolve the throwing area before delivery. For an unsuitable minimum landmine load, use the same-dose standing two-hand band rotation or one-arm rotational band press, and record the replacement.</p></Note>
    <Note title="Group setup"><p>Equipment quantities depend on group size and supervised waves. Confirm secure anchors, manageable grips and loads, and add any equipment required by the existing Access & Prepare 1 sequence.</p></Note>
  </div>
}

function DeliveryNotes({ session }: { session: AcceleratorSession }) {
  return <div className="space-y-5">
    <Note title={`${session.minutes.join('–')} minutes of prescribed work`}><p>Includes easy load-preparation sets, demonstrations, rest and transitions. Add the actual Access & Prepare 1 duration and group queues. This is not a confirmed whole-class booking; preserve the prescribed recovery.</p></Note>
    <Note title="Session order"><p>Access & Prepare 1 → 6 explosive exercises → 2 light resilience exercises → 6 primary-strength exercises. All athletes finish the explosive section before moving to strength. Clear the ball area before lifting.</p></Note>
    <Note title="Schedule by readiness"><p>The 12wk collection contains 12 numbered class exposures, not 12 consecutive days or a booked calendar. Review actual training, technique and recovery before selecting the next class. Class number alone does not establish readiness.</p></Note>
  </div>
}

function CoachingNotes({ session }: { session: AcceleratorSession }) {
  return <div className="space-y-5">
    {session.quality && <Note title="Today’s quality marker"><p>{session.quality}</p></Note>}
    <Note title="Class-specific intent"><p>{session.explosiveNotes}</p></Note>
    <Note title="Adjust within the dose"><p>On a technical miss, stop, recover and adjust the remaining scheduled attempts. If the fault persists after one adjustment or speed declines despite full rest, end that slot. Stop for pain, unsafe ball paths or loss of control. Do not add attempts to replace misses.</p></Note>
    <Note title="Readiness & progression"><p>Baseline: ages 12–14 with established basic lifting and landing technique, qualified supervision and demonstrated readiness. Advance one variable only when actual execution and recovery support it; otherwise hold or regress. Attendance, loads and athlete responses are not recorded in this view.</p></Note>
  </div>
}

function PlanOverview({ selected, onSelect }: { selected: number; onSelect: (index: number) => void }) {
  return <div>
    <p className="mb-4 text-sm leading-relaxed text-gray-500">Twelve exposures, selected by athlete readiness. Choose a class to open its daily plan.</p>
    <div className="space-y-2">{ROTATIONAL_UPPER_SESSIONS.map((session, index) => <button key={session.n} type="button" onClick={() => onSelect(index)}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${FOCUS_RING} ${selected === index ? 'border-red-200 bg-red-50' : 'border-gray-100 hover:bg-gray-50'}`}>
      <span className="text-sm font-bold tabular-nums text-vortex-red">{String(session.n).padStart(2, '0')}</span>
      <span className="flex-1"><span className="block text-sm font-semibold text-gray-900">{session.title}</span><span className="mt-0.5 block text-xs leading-relaxed text-gray-500">{session.effort}</span></span>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
    </button>)}</div>
  </div>
}

function DetailDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element?.showModal()
    return () => {
      element?.close()
      previouslyFocused?.focus({ preventScroll: true })
    }
  }, [])
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose() } }}
    className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-gray-950/50">
    <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white p-5">
      <div>{detail.eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-vortex-red">{detail.eyebrow}</p>}<h3 id={titleId} className="text-lg font-bold leading-snug">{detail.title}</h3></div>
      <button type="button" autoFocus onClick={onClose} aria-label="Close details" className={`shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 ${FOCUS_RING}`}><X className="h-5 w-5" /></button>
    </header>
    <div className="p-5">{detail.content}</div>
  </dialog>
}
