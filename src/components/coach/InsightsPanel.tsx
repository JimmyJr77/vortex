import { useEffect, useState } from 'react'
import { BarChart3, Loader2, Sparkles } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, AreaChart, Area } from 'recharts'
import { coachFetch, getCoachToken } from '../../coach/api'
import { getApiUrl } from '../../utils/api'
import { useRosterMembers } from './useRosterMembers'
import { useCoachClasses } from './useCoachClasses'
import CoachAssistantChat from './CoachAssistantChat'
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

interface LoadData {
  series: Array<{ date: string; load: number }>
  acute: number
  chronic: number
  ratio: number | null
  flag: 'high' | 'low' | 'ok' | 'insufficient'
  readiness: number | null
  wellness: Array<{ checkin_date: string; sleep_hours?: number | null; soreness?: number | null; rpe?: number | null; mood?: number | null; energy?: number | null }>
}

interface PrRow {
  id: number
  source_type: 'assessment' | 'skill'
  metric_label?: string | null
  value_numeric?: number | null
  unit?: string | null
  achieved_at: string
  assessment_name?: string | null
  exercise_name?: string | null
}

interface GoalRow {
  id: number
  title: string
  description?: string | null
  target_date?: string | null
  status: string
}

const ACWR_FLAG: Record<LoadData['flag'], { label: string; cls: string }> = {
  high: { label: 'High load — injury risk', cls: 'bg-red-100 text-red-700 border-red-200' },
  low: { label: 'Detraining risk', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  ok: { label: 'Optimal load', cls: 'bg-green-100 text-green-700 border-green-200' },
  insufficient: { label: 'Not enough data', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export default function InsightsPanel() {
  const { members } = useRosterMembers()
  const classes = useCoachClasses()
  const [memberId, setMemberId] = useState<number | ''>('')
  const [classId, setClassId] = useState<number | ''>('')
  const [insights, setInsights] = useState<Insights | null>(null)
  const [load, setLoad] = useState<LoadData | null>(null)
  const [prs, setPrs] = useState<PrRow[]>([])
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [newGoalTitle, setNewGoalTitle] = useState('')
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
    coachFetch<LoadData>(`/api/coach/athletes/${memberId}/load`).then(setLoad).catch(() => setLoad(null))
    coachFetch<PrRow[]>(`/api/coach/athletes/${memberId}/prs`).then(setPrs).catch(() => setPrs([]))
    coachFetch<GoalRow[]>(`/api/coach/athletes/${memberId}/goals`).then(setGoals).catch(() => setGoals([]))
  }, [memberId])

  const addGoal = async () => {
    if (memberId === '' || !newGoalTitle.trim()) return
    try {
      const row = await coachFetch<GoalRow>(`/api/coach/athletes/${memberId}/goals`, {
        method: 'POST',
        body: JSON.stringify({ title: newGoalTitle.trim() }),
      })
      setGoals((prev) => [row, ...prev])
      setNewGoalTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add goal')
    }
  }

  const completeGoal = async (goalId: number) => {
    try {
      const row = await coachFetch<GoalRow>(`/api/coach/goals/${goalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      })
      setGoals((prev) => prev.map((g) => (g.id === goalId ? row : g)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update goal')
    }
  }

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
      const data = await coachFetch<{ narrative: string; narrativeSource?: string }>(
        `/api/coach/ai/progress-narrative/${memberId}`,
        { method: 'POST' },
      )
      setNarrative(data.narrative)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build narrative')
    }
  }

  const downloadPdfReport = async () => {
    if (memberId === '') return
    try {
      const token = getCoachToken()
      const res = await fetch(`${getApiUrl()}/api/coach/ai/progress-report/${memberId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Failed to generate PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vortex-progress-${memberId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF')
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
            {classes.map((c) => <option key={c.id} value={c.id}>{c.assignment_label || c.class_name || c.program_name || `Class ${c.id}`}</option>)}
          </select>
          <button type="button" onClick={() => void getNudge()} disabled={memberId === ''} className="flex items-center gap-2 bg-black text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
            <Sparkles className="w-4 h-4 text-vortex-red" /> AI Nudge
          </button>
          <button type="button" onClick={() => void getNarrative()} disabled={memberId === ''} className="flex items-center gap-2 border border-gray-300 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
            <Sparkles className="w-4 h-4 text-vortex-red" /> Parent Narrative
          </button>
          <button type="button" onClick={() => void downloadPdfReport()} disabled={memberId === ''} className="flex items-center gap-2 border border-gray-300 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
            Download PDF
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {nudge && <div className="rounded-lg bg-amber-50 text-amber-800 px-4 py-3 text-sm border border-amber-200">{nudge}</div>}
      {narrative && (
        <div className="rounded-lg bg-sky-50 text-sky-900 px-4 py-3 text-sm border border-sky-200">
          <div className="font-semibold mb-2 flex items-center justify-between gap-2">
            <span>Parent-friendly summary</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => navigator.clipboard?.writeText(narrative)} className="text-xs text-sky-700 underline">Copy</button>
              <button
                type="button"
                onClick={() => {
                  const athlete = members.find((m) => m.id === memberId)
                  const html = `<!DOCTYPE html><html><head><title>Progress Report</title><style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:720px;margin:auto;color:#111}h1{font-size:1.5rem}h2{font-size:1rem;margin-top:1.5rem;color:#444}.meta{color:#666;font-size:0.875rem}</style></head><body>
<h1>Vortex Athletics — Progress Report</h1>
<p class="meta">Athlete: ${athlete?.name ?? 'Athlete'} · ${new Date().toLocaleDateString()}</p>
<h2>Coach Summary</h2>
<p>${narrative.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
${prs.length > 0 ? `<h2>Recent Personal Records</h2><ul>${prs.map((p) => `<li>${p.metric_label || p.exercise_name || 'PR'}: ${p.value_numeric ?? ''} ${p.unit ?? ''}</li>`).join('')}</ul>` : ''}
</body></html>`
                  const w = window.open('', '_blank')
                  if (w) {
                    w.document.write(html)
                    w.document.close()
                    w.print()
                  }
                }}
                className="text-xs text-sky-700 underline"
              >
                Print report
              </button>
            </div>
          </div>
          <p className="whitespace-pre-wrap">{narrative}</p>
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

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold text-gray-800">Training Load (sRPE)</h3>
              {load && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${ACWR_FLAG[load.flag].cls}`}>
                  {load.ratio != null ? `ACWR ${load.ratio} · ` : ''}{ACWR_FLAG[load.flag].label}
                </span>
              )}
            </div>
            {!load || load.series.every((s) => s.load === 0) ? (
              <div className="text-sm text-gray-500 py-8 text-center">No logged training load yet (needs RPE on completions).</div>
            ) : (
              <>
                <div className="flex gap-4 mb-2 text-xs text-gray-500">
                  <span>Acute (7d): <strong className="text-gray-800">{load.acute}</strong></span>
                  <span>Chronic (28d avg wk): <strong className="text-gray-800">{load.chronic}</strong></span>
                  {load.readiness != null && <span>Readiness: <strong className="text-gray-800">{load.readiness}/100</strong></span>}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={load.series.map((s) => ({ ...s, date: s.date.slice(5) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={3} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="load" stroke="#dc2626" fill="#fecaca" name="Daily load" />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Wellness & Readiness</h3>
            {!load || load.wellness.length === 0 ? (
              <div className="text-sm text-gray-500 py-8 text-center">No wellness check-ins yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={load.wellness.map((w) => ({
                  date: new Date(w.checkin_date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
                  Sleep: w.sleep_hours ?? null,
                  Soreness: w.soreness ?? null,
                  RPE: w.rpe ?? null,
                  Mood: w.mood ?? null,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Sleep" stroke="#0ea5e9" dot={false} />
                  <Line type="monotone" dataKey="Soreness" stroke="#dc2626" dot={false} />
                  <Line type="monotone" dataKey="RPE" stroke="#f59e0b" dot={false} />
                  <Line type="monotone" dataKey="Mood" stroke="#16a34a" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 lg:col-span-2">
            <h3 className="font-semibold text-gray-800 mb-3">Goals</h3>
            <div className="flex gap-2 mb-3">
              <input
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                placeholder="New goal for athlete…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => void addGoal()} className="bg-vortex-red text-white px-3 py-2 rounded-lg text-sm font-semibold">
                Add
              </button>
            </div>
            {goals.length === 0 ? (
              <div className="text-sm text-gray-500">No goals yet.</div>
            ) : (
              <ul className="space-y-2">
                {goals.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{g.title}</span>
                      {g.target_date && <span className="text-xs text-gray-400 ml-2">· {new Date(g.target_date).toLocaleDateString()}</span>}
                      {g.status === 'completed' && <span className="text-xs text-green-600 ml-2">Completed</span>}
                    </div>
                    {g.status === 'active' && (
                      <button type="button" onClick={() => void completeGoal(g.id)} className="text-xs text-vortex-red font-semibold hover:underline">
                        Mark done
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 lg:col-span-2">
            <h3 className="font-semibold text-gray-800 mb-3">Personal Records</h3>
            {prs.length === 0 ? (
              <div className="text-sm text-gray-500">No personal records logged yet.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {prs.map((pr) => (
                  <div key={pr.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="text-sm font-semibold text-amber-900">
                      {pr.metric_label || pr.assessment_name || pr.exercise_name || 'PR'}
                    </div>
                    <div className="text-xs text-amber-700">
                      {pr.value_numeric}{pr.unit ? ` ${pr.unit}` : ''} · {new Date(pr.achieved_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
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

      <CoachAssistantChat
        memberId={memberId}
        athleteName={members.find((m) => m.id === memberId)?.name}
      />
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
