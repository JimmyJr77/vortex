import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Loader2, ChevronLeft, Play, CheckCircle2, Clock, Users } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type { Workout } from '../../coach/types'

interface SavedSession {
  id: number
  program_id?: number | null
  class_iteration_id?: number | null
  workout_id?: number | null
  workout_title?: string | null
  calendar_event_key?: string | null
  session_date: string
  start_time?: string | null
  end_time?: string | null
  title?: string | null
  status: string
  notes?: string | null
}

interface ScheduledInstance {
  calendar_event_key: string
  program_id: number | null
  class_name: string
  start_time?: string | null
  end_time?: string | null
  session_date: string
  scheduled: true
}

interface AttendanceRow {
  status: string
  check_in_at?: string | null
  note?: string | null
}
interface CompletionRow {
  status: string
  reps?: number | null
  rpe?: number | null
  coach_grade?: number | null
  coach_note?: string | null
}
interface RosterEntry {
  id: number
  first_name: string
  last_name: string
  attendance: AttendanceRow | null
  completion: CompletionRow | null
}
interface SessionDetail extends SavedSession {
  workout: Workout | null
  roster: RosterEntry[]
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

interface RowState {
  attendance: AttendanceStatus
  reps: string
  rpe: string
  grade: string
  note: string
}

const ATT_STYLES: Record<AttendanceStatus, string> = {
  present: 'bg-green-600 text-white',
  late: 'bg-amber-500 text-white',
  absent: 'bg-gray-300 text-gray-700',
  excused: 'bg-sky-500 text-white',
}

export default function LiveSessionPanel() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [scheduled, setScheduled] = useState<ScheduledInstance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)

  const loadDay = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await coachFetch<{ sessions: SavedSession[]; scheduled: ScheduledInstance[] }>(`/api/coach/sessions?date=${date}`)
      setSessions(data.sessions)
      setScheduled(data.scheduled)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    void loadDay()
  }, [loadDay])

  const startScheduled = async (s: ScheduledInstance) => {
    try {
      const created = await coachFetch<SavedSession>('/api/coach/sessions', {
        method: 'POST',
        body: JSON.stringify({
          calendar_event_key: s.calendar_event_key,
          program_id: s.program_id,
          session_date: s.session_date,
          start_time: s.start_time,
          end_time: s.end_time,
          title: s.class_name,
        }),
      })
      await loadDay()
      setOpenId(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session')
    }
  }

  const createAdHoc = async () => {
    try {
      const created = await coachFetch<SavedSession>('/api/coach/sessions', {
        method: 'POST',
        body: JSON.stringify({ session_date: date, title: 'Ad-hoc session' }),
      })
      await loadDay()
      setOpenId(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    }
  }

  if (openId != null) {
    return <SessionDetailView sessionId={openId} onBack={() => { setOpenId(null); void loadDay() }} />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CalendarDays className="w-6 h-6 text-vortex-red" /> Today&apos;s Sessions</h2>
          <p className="text-sm text-gray-500">Run a class from the floor: take attendance and log the whole group.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <button type="button" onClick={() => void createAdHoc()} className="border border-gray-300 px-3 py-2 rounded-lg text-sm font-semibold">+ Ad-hoc</button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-4">
          {sessions.length === 0 && scheduled.length === 0 && (
            <div className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-6 text-center">No sessions or scheduled classes for this date.</div>
          )}

          {sessions.map((s) => (
            <button key={s.id} type="button" onClick={() => setOpenId(s.id)} className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-vortex-red hover:shadow-sm transition-all flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">{s.title || 'Session'}</div>
                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                  {(s.start_time || s.end_time) && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.start_time}{s.end_time ? `–${s.end_time}` : ''}</span>}
                  {s.workout_title && <span>· {s.workout_title}</span>}
                </div>
              </div>
              <StatusBadge status={s.status} />
            </button>
          ))}

          {scheduled.map((s) => (
            <div key={s.calendar_event_key} className="bg-white border border-dashed border-gray-300 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">{s.class_name}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> {s.start_time}{s.end_time ? `–${s.end_time}` : ''} · scheduled</div>
              </div>
              <button type="button" onClick={() => void startScheduled(s)} className="flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold"><Play className="w-4 h-4" /> Start</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    planned: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  }
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.planned}`}>{status.replace('_', ' ')}</span>
}

function SessionDetailView({ sessionId, onBack }: { sessionId: number; onBack: () => void }) {
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [rows, setRows] = useState<Record<number, RowState>>({})
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await coachFetch<SessionDetail>(`/api/coach/sessions/${sessionId}`)
      setDetail(data)
      const initial: Record<number, RowState> = {}
      for (const m of data.roster) {
        initial[m.id] = {
          attendance: (m.attendance?.status as AttendanceStatus) || 'present',
          reps: m.completion?.reps != null ? String(m.completion.reps) : '',
          rpe: m.completion?.rpe != null ? String(m.completion.rpe) : '',
          grade: m.completion?.coach_grade != null ? String(m.completion.coach_grade) : '',
          note: m.completion?.coach_note || '',
        }
      }
      setRows(initial)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void load()
    coachFetch<Workout[]>('/api/coach/workouts').then(setWorkouts).catch(() => setWorkouts([]))
  }, [load])

  const setRow = (memberId: number, patch: Partial<RowState>) => setRows((cur) => ({ ...cur, [memberId]: { ...cur[memberId], ...patch } }))
  const markAllPresent = () => setRows((cur) => Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, { ...v, attendance: 'present' as AttendanceStatus }])))

  const saveAttendance = async () => {
    if (!detail) return
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const entries = detail.roster.map((m) => ({ member_id: m.id, status: rows[m.id]?.attendance || 'present' }))
      await coachFetch(`/api/coach/sessions/${sessionId}/attendance`, { method: 'POST', body: JSON.stringify({ entries }) })
      setMessage('Attendance saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const saveLogs = async () => {
    if (!detail) return
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const entries = detail.roster
        .filter((m) => rows[m.id]?.attendance !== 'absent')
        .map((m) => {
          const r = rows[m.id]
          return {
            member_id: m.id,
            status: 'completed',
            reps: r.reps ? Number(r.reps) : null,
            rpe: r.rpe ? Number(r.rpe) : null,
            coach_grade: r.grade ? Number(r.grade) : null,
            coach_note: r.note || null,
          }
        })
      await coachFetch(`/api/coach/sessions/${sessionId}/bulk-log`, { method: 'POST', body: JSON.stringify({ entries }) })
      setMessage('Session logged for the class.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log session')
    } finally {
      setSaving(false)
    }
  }

  const patchSession = async (patch: Record<string, unknown>) => {
    try {
      const updated = await coachFetch<SavedSession>(`/api/coach/sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setDetail((cur) => (cur ? { ...cur, ...updated } : cur))
      if (patch.workout_id !== undefined) await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update session')
    }
  }

  if (loading) return <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading session…</div>
  if (!detail) return <div className="text-sm text-red-600">{error || 'Session not found.'}</div>

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronLeft className="w-4 h-4" /> Back to sessions</button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{detail.title || 'Session'}</h2>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            {(detail.start_time || detail.end_time) && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {detail.start_time}{detail.end_time ? `–${detail.end_time}` : ''}</span>}
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {detail.roster.length} athletes</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={detail.status} />
          {detail.status !== 'in_progress' && detail.status !== 'completed' && (
            <button type="button" onClick={() => void patchSession({ status: 'in_progress' })} className="flex items-center gap-1 bg-amber-500 text-white px-3 py-2 rounded-lg text-sm font-semibold"><Play className="w-4 h-4" /> Start</button>
          )}
          {detail.status !== 'completed' && (
            <button type="button" onClick={() => void patchSession({ status: 'completed' })} className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold"><CheckCircle2 className="w-4 h-4" /> Complete</button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {message && <div className="rounded-lg bg-green-50 text-green-700 px-4 py-2 text-sm">{message}</div>}

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <label className="text-sm">
          <span className="block text-xs font-semibold text-gray-500 mb-1">Assigned workout</span>
          <select
            value={detail.workout_id ?? ''}
            onChange={(e) => void patchSession({ workout_id: e.target.value ? Number(e.target.value) : null })}
            className="w-full md:w-96 border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">No workout attached</option>
            {workouts.map((w) => <option key={w.id} value={w.id}>{w.title}{w.computed_minutes ? ` (${w.computed_minutes}m)` : ''}</option>)}
          </select>
        </label>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Roster</h3>
          <button type="button" onClick={markAllPresent} className="text-xs text-vortex-red font-semibold">Mark all present</button>
        </div>
        <div className="divide-y divide-gray-50">
          {detail.roster.map((m) => {
            const r = rows[m.id]
            if (!r) return null
            return (
              <div key={m.id} className="px-4 py-3 grid gap-2 md:grid-cols-[1.4fr_auto_repeat(3,64px)_1.4fr] items-center">
                <div className="font-medium text-gray-800 text-sm">{m.first_name} {m.last_name}</div>
                <div className="flex gap-1">
                  {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setRow(m.id, { attendance: st })}
                      className={`px-2 py-1 rounded text-[11px] font-semibold capitalize ${r.attendance === st ? ATT_STYLES[st] : 'bg-gray-100 text-gray-500'}`}
                    >
                      {st[0].toUpperCase()}
                    </button>
                  ))}
                </div>
                <input type="number" value={r.reps} onChange={(e) => setRow(m.id, { reps: e.target.value })} placeholder="reps" disabled={r.attendance === 'absent'} className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                <input type="number" value={r.rpe} onChange={(e) => setRow(m.id, { rpe: e.target.value })} placeholder="rpe" disabled={r.attendance === 'absent'} className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                <input type="number" value={r.grade} onChange={(e) => setRow(m.id, { grade: e.target.value })} placeholder="grade" disabled={r.attendance === 'absent'} className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                <input value={r.note} onChange={(e) => setRow(m.id, { note: e.target.value })} placeholder="note" disabled={r.attendance === 'absent'} className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-50" />
              </div>
            )
          })}
          {detail.roster.length === 0 && <div className="px-4 py-6 text-sm text-gray-500 text-center">No athletes resolved for this class. Attach to a class with enrolled members.</div>}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100">
          <button type="button" onClick={() => void saveAttendance()} disabled={saving || detail.roster.length === 0} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold disabled:opacity-60">Save attendance</button>
          <button type="button" onClick={() => void saveLogs()} disabled={saving || detail.roster.length === 0} className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Log session for class'}</button>
        </div>
      </div>
    </div>
  )
}
