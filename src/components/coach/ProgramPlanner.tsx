import { Suspense, useState } from 'react'
import { CalendarRange, Dumbbell, Layers, Loader2 } from 'lucide-react'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'

const WorkoutBuilder = lazyWithRetry(() => import('./WorkoutBuilder'))
const TrainingBlockBuilder = lazyWithRetry(() => import('./TrainingBlockBuilder'))
const RegimenBuilder = lazyWithRetry(() => import('./RegimenBuilder'))

type PlannerView = 'workout' | 'block' | 'regimen'

const PLANNER_VIEWS: Array<{
  id: PlannerView
  label: string
  description: string
  icon: typeof Dumbbell
}> = [
  {
    id: 'workout',
    label: 'Workout design',
    description: 'Select Exercise Library cards and build the sessions that power every plan.',
    icon: Dumbbell,
  },
  {
    id: 'block',
    label: 'Training blocks',
    description: 'Arrange training days and session objectives into a reusable block.',
    icon: CalendarRange,
  },
  {
    id: 'regimen',
    label: 'Regimens',
    description: 'Set the phase balance and repeatable structure for longer-term delivery.',
    icon: Layers,
  },
]

export default function ProgramPlanner() {
  const [view, setView] = useState<PlannerView>('workout')

  return (
    <div className="space-y-5 pb-5">
      <header>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Session Design</p>
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">Program Planner</h2>
        <p className="mt-1 text-sm text-gray-500">
          Build with exercise cards, organize the sessions into blocks, and define the regimen in one workspace.
        </p>
      </header>

      <div role="tablist" aria-label="Program Planner modes" className="grid gap-2 md:grid-cols-3">
        {PLANNER_VIEWS.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              id={`program-planner-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="program-planner-panel"
              onClick={() => setView(item.id)}
              className={`rounded-xl border p-4 text-left transition ${
                active
                  ? 'border-vortex-red bg-red-50 text-gray-950'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-red-200'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold"><Icon aria-hidden="true" className="h-4 w-4 text-vortex-red" /> {item.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-500">{item.description}</span>
            </button>
          )
        })}
      </div>

      <section id="program-planner-panel" role="tabpanel" aria-labelledby={`program-planner-tab-${view}`}>
        <Suspense fallback={<div role="status" className="flex items-center gap-2 py-12 text-gray-500"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> Loading planner…</div>}>
          {view === 'workout' ? <WorkoutBuilder defaultType="workout" /> : view === 'block' ? <TrainingBlockBuilder /> : <RegimenBuilder />}
        </Suspense>
      </section>
    </div>
  )
}
