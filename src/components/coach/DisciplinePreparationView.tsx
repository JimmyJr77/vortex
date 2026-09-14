import { ArrowUpRight, Clock3, Info, Package } from 'lucide-react'
import type { ReactNode } from 'react'
import { PREPARATION_OPERATIONS } from '../../coach/preparation/operations'
import { preparationClock, preparationTimeline, type DisciplinePreparationRoutine, type PreparationStep } from '../../coach/preparation/types'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vortex-red focus-visible:ring-offset-2'
const stageLabels = { base: 'Preparation', rehearsal: 'Bridge 1 · Rehearse the task', progressive: 'Bridge 2 · Build toward the task' }

function Notes({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-2"><h5 className="text-sm font-bold text-gray-950">{title}</h5><div className="text-sm leading-relaxed text-gray-600">{children}</div></section>
}

function List({ items }: { items: readonly string[] }) {
  return <ul className="list-disc space-y-1.5 pl-5">{items.map((item) => <li key={item}>{item}</li>)}</ul>
}

function TimingNotes({ routine }: { routine: DisciplinePreparationRoutine }) {
  return <div className="space-y-5">
    <Notes title="Clock & capacity"><p>{routine.timeBudgetNote}</p><p className="mt-2">{PREPARATION_OPERATIONS.capacity}</p></Notes>
    <Notes title="Delivery"><List items={PREPARATION_OPERATIONS.clock} /></Notes>
    <Notes title="Minute-by-minute plan">
      <ol className="space-y-3">{preparationTimeline(routine).map((step) => <li key={step.order}>
        <p className="font-semibold text-gray-900">{preparationClock(step.start)}–{preparationClock(step.end)} · {step.exercise.name}</p>
        <p>{step.workSeconds}s movement · {step.recoverySeconds}s recovery · {step.transitionSeconds}s instruction / transition</p>
        <p className="mt-1">{step.delivery}</p>
      </li>)}</ol>
    </Notes>
    <Notes title="What this duration covers"><List items={routine.coverage} /></Notes>
    <Notes title="What still needs preparation"><List items={routine.limitations} /></Notes>
  </div>
}

function SetupNotes({ routine }: { routine: DisciplinePreparationRoutine }) {
  return <div className="space-y-5">
    <Notes title="Equipment"><List items={routine.equipment} /></Notes>
    <Notes title="Station setup"><List items={routine.setup} /></Notes>
    <Notes title="Three 10 m lanes"><p>{PREPARATION_OPERATIONS.capacity}</p><div className="mt-2"><List items={PREPARATION_OPERATIONS.laneLayout} /></div></Notes>
    <Notes title="Before starting"><List items={routine.entryCriteria} /></Notes>
    <Notes title="Scaling & readiness"><List items={PREPARATION_OPERATIONS.readiness} /></Notes>
    <Notes title="Available equipment"><p>{PREPARATION_OPERATIONS.equipment}</p></Notes>
    <Notes title="Programming references"><p>{PREPARATION_OPERATIONS.sourceNote}</p><ul className="mt-2 space-y-2">{PREPARATION_OPERATIONS.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" className={`rounded text-vortex-red underline ${focusRing}`}>{source.title}</a></li>)}</ul></Notes>
  </div>
}

function ExerciseNotes({ step, order, count }: { step: PreparationStep; order: number; count: number }) {
  const exercise = step.exercise
  return <div className="space-y-5">
    <div className="rounded-xl bg-gray-50 p-4"><p className="font-semibold text-gray-900">{step.dose}</p><p className="mt-1 text-xs text-gray-500">Order {order} of {count} · {exercise.purposes.join(' · ')}</p></div>
    <Notes title="Effort & timing"><p>{step.effort}</p><p className="mt-2">{step.workSeconds}s movement · {step.recoverySeconds}s recovery · {step.transitionSeconds}s instruction / transition</p><p className="mt-2">{step.delivery}</p></Notes>
    <Notes title="Why this exercise"><p>{exercise.whyHere}</p></Notes>
    {exercise.versionNote && <Notes title="Version note"><p>{exercise.versionNote}</p></Notes>}
    <Notes title="Equipment"><List items={exercise.equipment} /></Notes>
    <Notes title="Setup"><List items={exercise.setup} /></Notes>
    <Notes title="Execution"><ol className="list-decimal space-y-1.5 pl-5">{exercise.executionSteps.map((item) => <li key={item}>{item}</li>)}</ol></Notes>
    <Notes title="Coach cues"><List items={exercise.coachCues} /></Notes>
    <Notes title="Athlete cues"><List items={exercise.athleteCues} /></Notes>
    <Notes title="Quality gates"><List items={exercise.qualityGates} /></Notes>
    <Notes title="Common faults"><List items={exercise.commonFaults} /></Notes>
    <Notes title="Scaling"><List items={exercise.scaling} /></Notes>
    <Notes title="Stop signs"><List items={exercise.stopSigns} /></Notes>
  </div>
}

export default function DisciplinePreparationView({ routine, onOpenDetail }: {
  routine: DisciplinePreparationRoutine
  onOpenDetail: (title: string, content: ReactNode) => void
}) {
  const timeline = preparationTimeline(routine)
  return <div role="region" aria-label={`${routine.title} ${routine.durationMinutes}min routine`} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-xl font-bold text-gray-950">{routine.title} <span className="font-normal text-gray-400">{routine.durationMinutes}min</span></h3><p className="mt-1 text-xs text-gray-500">Three 10 m lanes · Coach-led · Two task-specific bridge drills included</p></div>
      <button type="button" onClick={() => onOpenDetail('Timing & delivery', <TimingNotes routine={routine} />)} className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${focusRing}`}><Clock3 className="h-4 w-4" aria-hidden="true" />Timing & delivery</button>
    </div>
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-4 sm:px-5"><p className="text-sm leading-relaxed text-gray-700">{routine.summary}</p><p className="mt-2 text-xs leading-relaxed text-gray-500">{routine.purpose}</p></div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_270px]">
        <aside className="space-y-4 border-b border-gray-100 bg-gray-50/60 p-4 xl:order-2 xl:border-b-0 xl:border-l" aria-label="Routine equipment and coverage">
          <Notes title="Equipment & space"><div className="mb-2 flex items-center gap-2 text-xs text-gray-500"><Package className="h-4 w-4" aria-hidden="true" />Stage before starting</div><List items={routine.equipment} /></Notes>
          <button type="button" onClick={() => onOpenDetail('Equipment, space & safety', <SetupNotes routine={routine} />)} className={`flex items-center gap-1 rounded text-xs font-semibold text-vortex-red hover:underline ${focusRing}`}>Setup, scaling & safety <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></button>
          <Notes title="Preparation coverage"><List items={routine.coverage} /></Notes>
          <p className="border-t border-gray-200 pt-3 text-xs leading-relaxed text-gray-500">{PREPARATION_OPERATIONS.capacity}</p>
        </aside>
        <div className="min-w-0 p-4 sm:p-5">
          <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-xs leading-relaxed text-gray-600">{routine.timeBudgetNote}</p>
          <ol aria-label={`${routine.title} ${routine.durationMinutes}min sequence`} className="mt-3 divide-y divide-gray-100">
            {timeline.map((step) => <li key={step.order} data-routine-order={step.order} className="py-4">
              <div className="flex items-center justify-between gap-3"><span className={`text-[10px] font-bold uppercase tracking-wide ${step.stage === 'base' ? 'text-gray-400' : 'text-vortex-red'}`}>{stageLabels[step.stage]}</span><span className="shrink-0 font-mono text-xs text-gray-500">{preparationClock(step.start)}–{preparationClock(step.end)}</span></div>
              <button type="button" aria-label={`Routine details for step ${step.order}: ${step.exercise.name}`} onClick={() => onOpenDetail(step.exercise.name, <ExerciseNotes step={step} order={step.order} count={timeline.length} />)} className={`mt-1.5 flex items-start gap-2 rounded text-left text-sm font-semibold text-gray-950 hover:text-vortex-red ${focusRing}`}><span className="text-gray-400">{step.order}.</span><span>{step.exercise.name}</span><Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" /></button>
              <p className="mt-2 text-sm font-medium text-gray-800">{step.dose}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{step.effort}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-600">{step.delivery}</p>
            </li>)}
          </ol>
          <section aria-label="Ready for the main session" className="mt-4 space-y-3 rounded-xl bg-gray-950 p-4 text-white"><h4 className="text-sm font-bold">Ready for the main session</h4><div className="text-xs leading-relaxed text-gray-300"><List items={routine.exitCriteria} /><p className="mt-3">{routine.progression}</p></div></section>
          <div className="mt-4 rounded-xl border border-gray-200 p-4"><Notes title="What still needs preparation"><List items={routine.limitations} /></Notes></div>
        </div>
      </div>
    </section>
  </div>
}
