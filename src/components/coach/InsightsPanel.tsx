import { useEffect, useState } from 'react'
import { BarChart3, Loader2, Sparkles } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { coachFetch } from '../../coach/api'
import { useRosterMembers } from './useRosterMembers'
import { useCoachClasses } from './useCoachClasses'
import type { RosterMember } from './useCoachClasses'

interface CompletionRow {
  id: number
  exercise_name?: string | null
  workout_title?: string | null
  status: string
  reps?: number | null
  rpe?: number | null
  coach_grade?: number | null
  coach_note?: string | null
  athlete_note?: string | null
  logged_at: string
}

interface Insights {
  tenetCoverage: Array<{ tenet_name: string; load_score: number }>
  assessmentTrends: Array<{ assessment_name: string; unit?: string | null; value_numeric: number | null; tested_at: string }>
  recentActivity: CompletionRow[]
}

export default function InsightsPanel() {
  const { members } = useRosterMembers()
  const classes = useCoachClasses()
  const [memberId, setMemberId] = useState<number | ''>('')
  const [classId, setClassId] = useState<number | ''>('')
  const [insights, setInsights] = useState<Insights | null>(null)
  const [cohort, setCohort] = useState<{ tenetCoverage: Array<{ tenet_name: string; load_score: number }>; memberCount: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [nudge, setNudge] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (classId === '') { setCohort(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const roster = await coachFetch<RosterMember[]>(`/api/coach/classes/${classId}/roster`)
        const memberIds = roster.map((r) => r.id)
        const data = await coachFetch<{ tenetCoverage: Array<{ tenet_name: string; load_score: number }>; memberCount: number }>(
          '/api/coach/insights/cohort', { method: 'POST', body: JSON.stringify({ memberIds }) },
        )
        if (!cancelled) setCohort(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load class analytics')
      }
    })()
    return () => { cancelled = true }
  }, [classId])

  useEffect(() => {
    if (memberId === '' && members.length > 0) setMemberId(members[0].id)
  }, [members, memberId])

  useEffect(() => {
    if (memberId === '') return
    setLoading(true)
    setNudge(null)
    coachFetch<Insights>(`/api/coach/insights/athlete/${memberId}`)
      .then(setInsights)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load insights'))
      .finally(() => setLoading(false))
  }, [memberId])

  const getNudge = async () => {
    if (memberId === '') return
    try {
      const data = await coachFetch<{ message: string }>(`/api/coach/ai/coverage-nudge/${memberId}`, { method: 'POST' })
      setNudge(data.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get nudge')
    }
  }

  const [narrative, setNarrative] = useState<string | null>(null)
  const getNarrative = async () => {
    if (memberId === '') return
    try {
      const data = await coachFetch<{ narrative: string }>(`/api/coach/ai/progress-narrative/${memberId}`, { method: 'POST' })
      setNarrative(data.narrative)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build narrative')
    }
  }

  const trendData = (insights?.assessmentTrends ?? []).map((t) => ({
    date: new Date(t.tested_at).toLocaleDateString(),
    [t.assessment_name]: t.value_numeric,
  }))

  const gradeCompletion = async (row: CompletionRow, grade: string, note: string) => {
    try {
      await coachFetch(`/api/coach/completions/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ coach_grade: grade ? Number(grade) : null, coach_note: note || null }),
      })
      setInsights((cur) => cur ? { ...cur, recentActivity: cur.recentActivity.map((r) => r.id === row.id ? { ...r, coach_grade: grade ? Number(grade) : r.coach_grade, coach_note: note || r.coach_note } : r) } : cur)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save grade')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-vortex-red" /> Insights</h2>
          <p className="text-sm text-gray-500">Tenet coverage and development trends per athlete.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={memberId} onChange={(e) => setMemberId(e.target.value ? Number(e.target.value) : '')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Select athlete...</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={classId} onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : '')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Class analytics...</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.program_name || c.class_iteration_label || `Class ${c.id}`}</option>)}
          </select>
          <button type="button" onClick={() => void getNudge()} disabled={memberId === ''} className="flex items-center gap-2 bg-black text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
            <Sparkles className="w-4 h-4 text-vortex-red" /> AI Nudge
          </button>
          <button type="button" onClick={() => void getNarrative()} disabled={memberId === ''} className="flex items-center gap-2 border border-gray-300 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
            <Sparkles className="w-4 h-4 text-vortex-red" /> Parent Narrative
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {nudge && <div className="rounded-lg bg-amber-50 text-amber-800 px-4 py-3 text-sm border border-amber-200">{nudge}</div>}
      {narrative && (
        <div className="rounded-lg bg-sky-50 text-sky-900 px-4 py-3 text-sm border border-sky-200">
          <div className="font-semibold mb-1 flex items-center justify-between">
            <span>Parent-friendly summary</span>
            <button type="button" onClick={() => navigator.clipboard?.writeText(narrative)} className="text-xs text-sky-700 underline">Copy</button>
          </div>
          {narrative}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading insights...</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Tenet Coverage (trained load)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={insights?.tenetCoverage ?? []} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="tenet_name" width={90} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="load_score" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Assessment Trends</h3>
            {trendData.length === 0 ? (
              <div className="text-sm text-gray-500 py-8 text-center">No assessment results yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {[...new Set((insights?.assessmentTrends ?? []).map((t) => t.assessment_name))].map((name, i) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={['#dc2626', '#0ea5e9', '#16a34a', '#f59e0b'][i % 4]} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {cohort && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 lg:col-span-2">
              <h3 className="font-semibold text-gray-800 mb-3">Class Tenet Coverage <span className="text-xs font-normal text-gray-400">({cohort.memberCount} athletes)</span></h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={cohort.tenetCoverage} layout="vertical" margin={{ left: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="tenet_name" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="load_score" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-4 lg:col-span-2">
            <h3 className="font-semibold text-gray-800 mb-2">Recent Activity & Grading</h3>
            <div className="space-y-2">
              {(insights?.recentActivity ?? []).map((a) => (
                <CompletionGradeRow key={a.id} row={a} onGrade={gradeCompletion} />
              ))}
              {(insights?.recentActivity ?? []).length === 0 && <div className="text-sm text-gray-500">No logged activity yet.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CompletionGradeRow({ row, onGrade }: { row: CompletionRow; onGrade: (row: CompletionRow, grade: string, note: string) => void }) {
  const [grade, setGrade] = useState(row.coach_grade != null ? String(row.coach_grade) : '')
  const [note, setNote] = useState(row.coach_note ?? '')
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_auto] items-center border-b border-gray-50 py-2">
      <div className="text-sm">
        <span className="text-gray-700 font-medium">{row.exercise_name ?? row.workout_title ?? 'Logged session'}</span>
        <span className="text-xs text-gray-500 ml-2">
          {row.status}
          {row.reps != null ? ` · ${row.reps} reps` : ''}
          {row.rpe != null ? ` · RPE ${row.rpe}` : ''}
          {` · ${new Date(row.logged_at).toLocaleDateString()}`}
        </span>
        {row.athlete_note && <span className="block text-xs text-gray-400 italic">"{row.athlete_note}"</span>}
      </div>
      <div className="flex items-center gap-2">
        <input type="number" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="grade" className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="coach note" className="w-40 border border-gray-300 rounded px-2 py-1 text-sm" />
        <button type="button" onClick={() => onGrade(row, grade, note)} className="px-3 py-1 rounded bg-gray-900 text-white text-xs">Save</button>
      </div>
    </div>
  )
}
