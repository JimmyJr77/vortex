import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Save, Trash2, FolderOpen, Copy } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import type { Workout } from '../../coach/types'

interface ProgramSession {
  title?: string
  workout_id?: number | null
  day_of_week?: number | null
}
interface ProgramWeek {
  id?: number
  week_number: number
  focus?: string
  phase_label?: string | null
  target_load_pct?: number | null
  is_deload?: boolean
  sessions: ProgramSession[]
}

const PHASE_OPTIONS = ['Accumulation', 'Intensification', 'Realization', 'Deload', 'Taper', 'Testing']
interface TrainingProgram {
  id?: number
  title: string
  description?: string | null
  sport_id?: number | null
  goal_phase?: string | null
  skill_level?: string | null
  weeks?: ProgramWeek[]
}

export default function ProgramBuilder() {
  const { taxonomy } = useTaxonomy()
  const [program, setProgram] = useState<TrainingProgram>({ title: '', weeks: [{ week_number: 1, focus: '', sessions: [] }] })
  const [list, setList] = useState<TrainingProgram[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    try {
      const [progs, wkts] = await Promise.all([
        coachFetch<TrainingProgram[]>('/api/coach/training-programs'),
        coachFetch<Workout[]>('/api/coach/workouts'),
      ])
      setList(progs)
      setWorkouts(wkts)
    } catch {
      /* non-fatal */
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const body = JSON.stringify(program)
      if (program.id) await coachFetch(`/api/coach/training-programs/${program.id}`, { method: 'PUT', body })
      else await coachFetch('/api/coach/training-programs', { method: 'POST', body })
      await loadList()
      setProgram({ title: '', weeks: [{ week_number: 1, focus: '', sessions: [] }] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save program')
    } finally {
      setSaving(false)
    }
  }

  const open = async (id?: number) => {
    if (!id) return
    const data = await coachFetch<TrainingProgram>(`/api/coach/training-programs/${id}`)
    setProgram(data)
  }

  const duplicateWeek = async (weekId?: number) => {
    if (!program.id || !weekId) {
      setError('Save the program before duplicating a week.')
      return
    }
    const pct = window.prompt('Add what % progression to load? (0 = plain copy)', '5')
    if (pct === null) return
    const progressionPct = Number(pct) || 0
    try {
      const data = await coachFetch<TrainingProgram>(
        `/api/coach/training-programs/${program.id}/weeks/${weekId}/duplicate`,
        { method: 'POST', body: JSON.stringify({ progressionPct, progressWorkouts: progressionPct !== 0 }) },
      )
      setProgram(data)
      await loadList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate week')
    }
  }

  const weeks = program.weeks ?? []
  const setWeeks = (w: ProgramWeek[]) => setProgram({ ...program, weeks: w })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Training Programs</h2>
          <p className="text-sm text-gray-500">Sequence workouts into multi-week plans.</p>
        </div>
        <button type="button" onClick={() => void save()} disabled={saving || !program.title} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Program
        </button>
      </div>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm md:col-span-2">
              <span className="block font-semibold text-gray-700 mb-1">Title</span>
              <input value={program.title} onChange={(e) => setProgram({ ...program, title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Sport</span>
              <select value={program.sport_id ?? ''} onChange={(e) => setProgram({ ...program, sport_id: e.target.value ? Number(e.target.value) : null })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Universal</option>
                {taxonomy?.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Goal Phase</span>
              <select value={program.goal_phase ?? ''} onChange={(e) => setProgram({ ...program, goal_phase: e.target.value || null })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">None</option>
                <option value="off_season">Off-season</option>
                <option value="pre_season">Pre-season</option>
                <option value="in_season">In-season</option>
                <option value="pre_competition">Pre-competition</option>
                <option value="return_to_play">Return to play</option>
              </select>
            </label>
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} className={`bg-white border rounded-xl p-4 ${week.is_deload ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 flex items-center gap-2">
                  Week {week.week_number}
                  {week.is_deload && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Deload</span>}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" title="Duplicate week with progression" onClick={() => void duplicateWeek(week.id)} className="text-gray-400 hover:text-vortex-red"><Copy className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setWeeks(weeks.filter((_, j) => j !== wi))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <input value={week.focus ?? ''} onChange={(e) => setWeeks(weeks.map((w, j) => j === wi ? { ...w, focus: e.target.value } : w))} placeholder="Week focus" className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2 items-center text-sm">
                <select value={week.phase_label ?? ''} onChange={(e) => setWeeks(weeks.map((w, j) => j === wi ? { ...w, phase_label: e.target.value || null } : w))} className="border border-gray-300 rounded px-2 py-1">
                  <option value="">Phase...</option>
                  {PHASE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="number" value={week.target_load_pct ?? ''} onChange={(e) => setWeeks(weeks.map((w, j) => j === wi ? { ...w, target_load_pct: e.target.value ? Number(e.target.value) : null } : w))} placeholder="Load %" className="w-24 border border-gray-300 rounded px-2 py-1" />
                <label className="flex items-center gap-1.5 text-gray-600 whitespace-nowrap">
                  <input type="checkbox" checked={week.is_deload === true} onChange={(e) => setWeeks(weeks.map((w, j) => j === wi ? { ...w, is_deload: e.target.checked } : w))} /> Deload
                </label>
              </div>
              <div className="mt-3 space-y-2">
                {week.sessions.map((session, si) => (
                  <div key={si} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center text-sm">
                    <input value={session.title ?? ''} onChange={(e) => setWeeks(weeks.map((w, j) => j === wi ? { ...w, sessions: w.sessions.map((s, k) => k === si ? { ...s, title: e.target.value } : s) } : w))} placeholder="Session title" className="border border-gray-300 rounded px-2 py-1" />
                    <select value={session.workout_id ?? ''} onChange={(e) => setWeeks(weeks.map((w, j) => j === wi ? { ...w, sessions: w.sessions.map((s, k) => k === si ? { ...s, workout_id: e.target.value ? Number(e.target.value) : null } : s) } : w))} className="border border-gray-300 rounded px-2 py-1">
                      <option value="">Pick workout...</option>
                      {workouts.map((wk) => <option key={wk.id} value={wk.id}>{wk.title}</option>)}
                    </select>
                    <button type="button" onClick={() => setWeeks(weeks.map((w, j) => j === wi ? { ...w, sessions: w.sessions.filter((_, k) => k !== si) } : w))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setWeeks(weeks.map((w, j) => j === wi ? { ...w, sessions: [...w.sessions, { title: '', workout_id: null }] } : w))} className="flex items-center gap-1 text-sm text-vortex-red"><Plus className="w-4 h-4" /> Add session</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setWeeks([...weeks, { week_number: weeks.length + 1, focus: '', sessions: [] }])} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:border-vortex-red hover:text-vortex-red"><Plus className="w-4 h-4" /> Add week</button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 h-fit">
          <div className="flex items-center gap-2 font-semibold text-gray-700 mb-2"><FolderOpen className="w-4 h-4" /> Saved Programs</div>
          <div className="space-y-1 max-h-[420px] overflow-y-auto">
            {list.map((p) => (
              <button key={p.id} type="button" onClick={() => void open(p.id)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm">
                <div className="font-medium text-gray-800">{p.title}</div>
              </button>
            ))}
            {list.length === 0 && <div className="text-sm text-gray-500">None saved yet.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
