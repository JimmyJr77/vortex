import { useCallback, useEffect, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useRosterMembers } from './useRosterMembers'
import { useCoachClasses } from './useCoachClasses'
import type { Workout } from '../../coach/types'

interface Assignment {
  id: number
  target_type: string
  target_id: number
  assignable_type: string
  assignable_id: number
  title?: string | null
  status: string
  due_date?: string | null
}

export default function AssignPanel() {
  const { members } = useRosterMembers()
  const classes = useCoachClasses()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [programs, setPrograms] = useState<Array<{ id: number; title: string }>>([])
  const [challenges, setChallenges] = useState<Array<{ id: number; title: string }>>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [form, setForm] = useState({ assignableType: 'workout', assignableId: '', targetType: 'member', targetId: '', dueDate: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [wkts, progs, chals, asgs] = await Promise.all([
        coachFetch<Workout[]>('/api/coach/workouts'),
        coachFetch<Array<{ id: number; title: string }>>('/api/coach/training-programs'),
        coachFetch<Array<{ id: number; title: string }>>('/api/coach/challenges'),
        coachFetch<Assignment[]>('/api/coach/assignments'),
      ])
      setWorkouts(wkts)
      setPrograms(progs)
      setChallenges(chals)
      setAssignments(asgs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignment data')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const assignableOptions = form.assignableType === 'workout' ? workouts.map((w) => ({ id: w.id as number, title: w.title }))
    : form.assignableType === 'training_program' ? programs
    : challenges

  const targetOptions = form.targetType === 'member' ? members.map((m) => ({ id: m.id, label: m.name }))
    : form.targetType === 'class' ? classes.map((c) => ({ id: c.id, label: c.program_name || `Class ${c.id}` }))
    : []

  const submit = async () => {
    if (!form.assignableId || !form.targetId) return
    setSaving(true)
    setError(null)
    try {
      await coachFetch('/api/coach/assignments', {
        method: 'POST',
        body: JSON.stringify({
          assignable_type: form.assignableType,
          assignable_id: Number(form.assignableId),
          target_type: form.targetType,
          target_id: Number(form.targetId),
          due_date: form.dueDate || null,
        }),
      })
      setForm({ ...form, assignableId: '', targetId: '', dueDate: '' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Send className="w-6 h-6 text-vortex-red" /> Assign & Share</h2>
        <p className="text-sm text-gray-500">Push workouts, programs, and challenges to athletes or classes.</p>
      </div>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 h-fit">
          <label className="text-sm block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">What to assign</span>
            <select value={form.assignableType} onChange={(e) => setForm({ ...form, assignableType: e.target.value, assignableId: '' })} className="w-full border border-gray-300 rounded px-2 py-1.5">
              <option value="workout">Workout</option>
              <option value="training_program">Training Program</option>
              <option value="challenge">Challenge</option>
            </select>
          </label>
          <label className="text-sm block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">Item</span>
            <select value={form.assignableId} onChange={(e) => setForm({ ...form, assignableId: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5">
              <option value="">Select...</option>
              {assignableOptions.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </label>
          <label className="text-sm block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">Assign to</span>
            <select value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value, targetId: '' })} className="w-full border border-gray-300 rounded px-2 py-1.5">
              <option value="member">Athlete</option>
              <option value="class">Class</option>
            </select>
          </label>
          <label className="text-sm block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">Target</span>
            <select value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5">
              <option value="">Select...</option>
              {targetOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label className="text-sm block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">Due date</span>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5" />
          </label>
          <button type="button" onClick={() => void submit()} disabled={saving || !form.assignableId || !form.targetId} className="w-full flex items-center justify-center gap-2 bg-vortex-red text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Assign
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Recent Assignments</h3>
          <div className="space-y-1">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm border-b border-gray-50 py-2">
                <span className="text-gray-700">{a.title || `${a.assignable_type} #${a.assignable_id}`} → {a.target_type} #{a.target_id}</span>
                <span className={`text-xs rounded-full px-2 py-0.5 ${a.status === 'completed' ? 'bg-green-100 text-green-700' : a.status === 'cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>{a.status}</span>
              </div>
            ))}
            {assignments.length === 0 && <div className="text-sm text-gray-500">No assignments yet.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
