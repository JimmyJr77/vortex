import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  CalendarRange,
  ChevronRight,
  Dumbbell,
  Filter,
  Gauge,
  Loader2,
  Search,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react'
import { coachFetch, type CoachLibraryPage } from '../../coach/api'
import {
  ATHLETIC_AGE_BRACKETS,
  ATHLETIC_PROGRAMS,
  WEEKLY_LOADING_GUIDE,
  type AthleticAgeBracket,
  type AthleticProgram,
  type AthleticProgramCategory,
  type AthleticSessionComponent,
} from '../../coach/athleticProgramCatalog'
import type { Exercise } from '../../coach/types'
import ExerciseDetailModal from './ExerciseDetailModal'

type CategoryFilter = 'All' | AthleticProgramCategory

const KIND_STYLES: Record<AthleticSessionComponent['kind'], string> = {
  'Neural / skill': 'bg-violet-50 text-violet-800 border-violet-100',
  Speed: 'bg-sky-50 text-sky-800 border-sky-100',
  Power: 'bg-orange-50 text-orange-800 border-orange-100',
  Strength: 'bg-red-50 text-red-800 border-red-100',
  Core: 'bg-indigo-50 text-indigo-800 border-indigo-100',
  Mobility: 'bg-emerald-50 text-emerald-800 border-emerald-100',
  Carry: 'bg-amber-50 text-amber-800 border-amber-100',
}

export default function AthleticProgramLibraryPanel() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('All')
  const [age, setAge] = useState<AthleticAgeBracket>('12–14')
  const [selected, setSelected] = useState<AthleticProgram | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return ATHLETIC_PROGRAMS.filter((program) => {
      if (category !== 'All' && program.category !== category) return false
      if (!needle) return true
      return [
        program.title,
        program.summary,
        program.primaryGoal,
        ...program.tags,
        ...program.equipment,
      ].some((value) => value.toLowerCase().includes(needle))
    })
  }, [category, query])

  if (selected) {
    return (
      <ProgramDetail
        program={selected}
        age={age}
        onAgeChange={setAge}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-gradient-to-br from-gray-950 via-gray-900 to-red-950 px-5 py-6 text-white shadow-sm md:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red-300">
              <CalendarRange className="h-4 w-4" />
              Vortex Program Library
            </div>
            <h2 className="text-2xl font-bold md:text-3xl">Coach-ready 12-week athletic programs</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-300">
              Sixteen complete progressions across performance outcomes and full-body equipment tracks.
              Every workout component connects to the canonical Exercise Library for coaching, scaling,
              safety, dosage, media, and research.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat value="16" label="Programs" />
            <Stat value="48" label="Workouts" />
            <Stat value="12" label="Weeks" />
          </div>
        </div>
      </header>

      <section className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Find a program</span>
          <span className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search goals, equipment, or qualities"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-vortex-red focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Filter className="h-3.5 w-3.5" /> Category
          </span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as CategoryFilter)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option>All</option>
            <option>Performance goal</option>
            <option>Full-body equipment</option>
          </select>
        </label>
        <AgeSelect value={age} onChange={setAge} />
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <strong className="text-gray-900">{filtered.length}</strong> programs · prescriptions shown for ages {age}
        </p>
        <p className="hidden text-xs text-gray-500 sm:block">Select a card to inspect all 12 weeks and exercise research.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((program) => (
          <button
            key={program.id}
            type="button"
            onClick={() => setSelected(program)}
            className="group flex min-h-[270px] flex-col rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                program.category === 'Performance goal'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {program.category}
              </span>
              <ChevronRight className="h-5 w-5 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-vortex-red" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-gray-950">{program.shortTitle}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600">{program.summary}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {program.tags.map((tag) => (
                <span key={tag} className="rounded bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700">{tag}</span>
              ))}
            </div>
            <div className="mt-auto grid grid-cols-3 gap-2 border-t border-gray-100 pt-4 text-xs">
              <Meta label="Length" value="12 weeks" />
              <Meta label="Frequency" value="3× / week" />
              <Meta label="Age view" value={age} />
            </div>
          </button>
        ))}
      </section>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <Search className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 font-semibold text-gray-800">No programs match those filters.</p>
          <button
            type="button"
            onClick={() => { setQuery(''); setCategory('All') }}
            className="mt-2 text-sm font-semibold text-vortex-red"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}

function ProgramDetail({
  program,
  age,
  onAgeChange,
  onBack,
}: {
  program: AthleticProgram
  age: AthleticAgeBracket
  onAgeChange: (value: AthleticAgeBracket) => void
  onBack: () => void
}) {
  const [view, setView] = useState<'workouts' | 'progression' | 'coach-notes'>('workouts')

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-vortex-red">
        <ArrowLeft className="h-4 w-4" /> All programs
      </button>

      <header className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-red-950 px-5 py-6 text-white md:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-red-300">{program.category}</span>
              <h2 className="mt-2 text-2xl font-bold md:text-3xl">{program.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-300">{program.summary}</p>
            </div>
            <div className="w-full max-w-[220px]">
              <AgeSelect value={age} onChange={onAgeChange} dark />
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-5 py-5 md:grid-cols-3 md:px-7">
          <Info icon={Target} label="Primary outcome" value={program.primaryGoal} />
          <Info icon={Gauge} label="Assessment" value={program.kpi} />
          <Info icon={Dumbbell} label="Equipment" value={program.equipment.join(' · ')} />
        </div>
        <div className="border-t border-gray-100 bg-amber-50 px-5 py-4 md:px-7">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Age {age} prescription</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-950">{program.ageGuidance[age]}</p>
              {program.safetyNote && <p className="mt-1 text-xs font-medium text-amber-800">{program.safetyNote}</p>}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {([
          ['workouts', 'A/B/C Workouts'],
          ['progression', '12-Week Progression'],
          ['coach-notes', 'Coach Rules'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              view === key ? 'border-vortex-red text-vortex-red' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'workouts' && (
        <section className="grid gap-4 xl:grid-cols-3">
          {program.sessions.map((session) => (
            <article key={session.key} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <header className="border-b border-gray-100 px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-vortex-red text-sm font-black text-white">
                    {session.key}
                  </span>
                  <div>
                    <h3 className="font-bold text-gray-950">{session.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{session.intent}</p>
                  </div>
                </div>
              </header>
              <ol className="divide-y divide-gray-100">
                {session.components.map((component, index) => (
                  <li key={`${component.name}-${index}`} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-xs font-bold tabular-nums text-gray-400">{String(index + 1).padStart(2, '0')}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{component.name}</p>
                            <p className="mt-0.5 text-xs font-medium text-gray-600">{component.dose}</p>
                          </div>
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${KIND_STYLES[component.kind]}`}>
                            {component.kind}
                          </span>
                        </div>
                        <ExerciseResearchButton component={component} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      )}

      {view === 'progression' && (
        <section className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {program.blocks.map((block, index) => (
              <article key={block.weeks} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-vortex-red">Weeks {block.weeks}</span>
                  <span className="text-xs font-semibold text-gray-400">Block {index + 1}</span>
                </div>
                <h3 className="mt-2 text-lg font-bold text-gray-950">{block.name}</h3>
                <p className="mt-2 text-sm text-gray-600">{block.intent}</p>
                <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-800">{block.progression}</p>
              </article>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="font-bold text-gray-950">Week-by-week loading card</h3>
              <p className="mt-1 text-xs text-gray-500">Apply this dose to the A/B/C workouts above. Weeks 4 and 8 consolidate; Week 12 assesses.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Week</th>
                    <th className="px-4 py-3">Strength dose</th>
                    <th className="px-4 py-3">Speed / power dose</th>
                    <th className="px-4 py-3">Coach action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {WEEKLY_LOADING_GUIDE.map((row) => (
                    <tr key={row.week} className={row.week === 4 || row.week === 8 || row.week === 12 ? 'bg-amber-50/60' : ''}>
                      <td className="px-4 py-3 font-bold text-gray-900">{row.week}</td>
                      <td className="px-4 py-3 text-gray-700">{row.strength}</td>
                      <td className="px-4 py-3 text-gray-700">{row.output}</td>
                      <td className="px-4 py-3 text-gray-700">{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {view === 'coach-notes' && <CoachRules />}
    </div>
  )
}

function ExerciseResearchButton({ component }: { component: AthleticSessionComponent }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 transition hover:border-vortex-red hover:text-vortex-red"
        aria-label={`Research ${component.name} in the Exercise Library`}
      >
        <BookOpen className="h-3.5 w-3.5" /> Research exercise card
      </button>
      {open && <ExerciseResearchModal component={component} onClose={() => setOpen(false)} />}
    </>
  )
}

function ExerciseResearchModal({
  component,
  onClose,
}: {
  component: AthleticSessionComponent
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ q: component.exerciseSearch, limit: '12', offset: '0' })
    coachFetch<CoachLibraryPage<Exercise>>(`/api/coach/exercises?${params.toString()}`)
      .then((data) => {
        if (cancelled) return
        const ordered = [...data.items].sort((a, b) => matchScore(b.name, component.exerciseSearch) - matchScore(a.name, component.exerciseSearch))
        setResults(ordered)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Exercise research failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [component.exerciseSearch])

  if (selectedExercise) {
    return (
      <ExerciseDetailModal
        exerciseId={selectedExercise.id}
        preview={selectedExercise}
        onClose={() => setSelectedExercise(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-vortex-red">Exercise card research</p>
            <h3 className="mt-1 text-lg font-bold text-gray-950">{component.name}</h3>
            <p className="mt-1 text-xs text-gray-500">
              Prescribed dose: {component.dose} · Library search: “{component.exerciseSearch}”
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close research">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin" /> Finding the best canonical cards…
            </div>
          )}
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {!loading && !error && results.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 px-5 py-10 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 font-semibold text-gray-800">No published card currently matches this component.</p>
              <p className="mt-1 text-sm text-gray-500">
                Search the Exercise Library for “{component.exerciseSearch}” or create a facility card before assigning this variation.
              </p>
            </div>
          )}
          {!loading && results.length > 0 && (
            <div className="space-y-2">
              <p className="mb-3 text-xs text-gray-500">
                Select the facility card that best matches the intended variation. Results are ranked by name match.
              </p>
              {results.map((exercise, index) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => setSelectedExercise(exercise)}
                  className="group flex w-full items-start justify-between gap-3 rounded-lg border border-gray-200 p-3 text-left hover:border-red-200 hover:bg-red-50/40"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">{exercise.name}</span>
                      {index === 0 && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Best match</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                      {exercise.card_summary || exercise.description || 'Open the complete exercise card for coaching and research.'}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-300 group-hover:text-vortex-red" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function matchScore(name: string, query: string): number {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (normalizedName === normalizedQuery) return 1000
  if (normalizedName.startsWith(normalizedQuery)) return 800
  if (normalizedName.includes(normalizedQuery)) return 600
  return normalizedQuery.split(' ').filter((token) => normalizedName.includes(token)).length * 50
}

function CoachRules() {
  const rules = [
    ['Pain rule', 'Stop sharp, escalating, radiating, or joint pain. Do not train through altered mechanics.'],
    ['Quality rule', 'End a set when posture, landing, sprint mechanics, bar path, or repetition speed clearly deteriorates.'],
    ['Power order', 'Place speed, jumps, throws, and reactive work early while the athlete is fresh.'],
    ['Load selection', 'Finish most strength sets with 2–4 good repetitions in reserve. Routine training has no missed repetitions.'],
    ['Progression gate', 'Progress only after two clean sessions, no pain during or the following day, and the target RPE/RIR is maintained.'],
    ['Recovery', 'Keep at least 48 hours between demanding exposures to the same quality and account for sport practice and games.'],
    ['Youth', 'Athletes under 15 receive technique-first resistance training: no 1RM, forced repetitions, or unsupervised loaded work.'],
  ]
  return (
    <section className="grid gap-3 md:grid-cols-2">
      {rules.map(([title, body]) => (
        <article key={title} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-vortex-red" />
            <div>
              <h3 className="font-bold text-gray-900">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{body}</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}

function AgeSelect({
  value,
  onChange,
  dark = false,
}: {
  value: AthleticAgeBracket
  onChange: (value: AthleticAgeBracket) => void
  dark?: boolean
}) {
  return (
    <label className="block">
      <span className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${dark ? 'text-gray-300' : 'text-gray-500'}`}>
        Athlete age
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as AthleticAgeBracket)}
        className={`w-full rounded-lg px-3 py-2 text-sm ${
          dark ? 'border border-white/20 bg-white/10 text-white' : 'border border-gray-300 bg-white text-gray-900'
        }`}
      >
        {ATHLETIC_AGE_BRACKETS.map((bracket) => (
          <option key={bracket} value={bracket} className="text-gray-900">{bracket}</option>
        ))}
      </select>
    </label>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-[68px] rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 font-semibold text-gray-700">{value}</div>
    </div>
  )
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-vortex-red">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</div>
        <p className="mt-1 text-sm leading-relaxed text-gray-700">{value}</p>
      </div>
    </div>
  )
}
