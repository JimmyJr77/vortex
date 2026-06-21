import { useCallback, useEffect, useState } from 'react'
import { Loader2, Dumbbell, CheckCircle2, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { coachFetch } from '../coach/api'
import type { Workout } from '../coach/types'

interface Assignment {
  id: number
  assignable_type: 'workout' | 'training_program' | 'challenge'
  assignable_id: number
  assignable_title?: string | null
  title?: string | null
  status: string
  start_date?: string | null
  due_date?: string | null
}

interface ProgramSession {
  title?: string | null
  workout_title?: string | null
  day_of_week?: number | null
}
interface ProgramWeek {
  week_number: number
  focus?: string | null
  sessions: ProgramSession[]
}
interface ProgramDetail {
  title: string
  description?: string | null
  weeks: ProgramWeek[]
}

interface ChallengeDetail {
  title: string
  description?: string | null
  scoring_type: string
  unit?: string | null
  entries: Array<{ first_name: string; last_name: string; value_numeric: number | null }>
}

export function MemberTrainingTab() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openWorkout, setOpenWorkout] = useState<{ assignment: Assignment; workout: Workout } | null>(null)
  const [openProgram, setOpenProgram] = useState<ProgramDetail | null>(null)
  const [openChallenge, setOpenChallenge] = useState<ChallengeDetail | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAssignments(await coachFetch<Assignment[]>('/api/member/training/assignments'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load training')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openAssignment = async (assignment: Assignment) => {
    try {
      if (assignment.assignable_type === 'workout') {
        const workout = await coachFetch<Workout>(`/api/member/training/workout/${assignment.assignable_id}`)
        setOpenWorkout({ assignment, workout })
      } else if (assignment.assignable_type === 'training_program') {
        setOpenProgram(await coachFetch<ProgramDetail>(`/api/member/training/program/${assignment.assignable_id}`))
      } else if (assignment.assignable_type === 'challenge') {
        setOpenChallenge(await coachFetch<ChallengeDetail>(`/api/member/training/challenge/${assignment.assignable_id}`))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open assignment')
    }
  }

  const logComplete = async (assignment: Assignment, workout: Workout) => {
    try {
      await coachFetch('/api/member/training/log', {
        method: 'POST',
        body: JSON.stringify({ assignment_id: assignment.id, workout_id: workout.id, status: 'completed' }),
      })
      setOpenWorkout(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log completion')
    }
  }

  if (loading) return <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading your training...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Dumbbell className="w-6 h-6 text-vortex-red" /> My Training</h2>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {assignments.length === 0 && <div className="text-gray-500">No assigned plans yet. Your coach will share workouts here.</div>}
      <div className="grid gap-3 md:grid-cols-2">
        {assignments.map((a) => (
          <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-gray-400">{a.assignable_type.replace('_', ' ')}</span>
              <span className={`text-xs rounded-full px-2 py-0.5 ${a.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{a.status}</span>
            </div>
            <h3 className="font-bold text-gray-900 mt-1">{a.title || a.assignable_title || 'Assigned plan'}</h3>
            {a.due_date && <p className="text-xs text-gray-500 mt-1">Due {new Date(a.due_date).toLocaleDateString()}</p>}
            <button type="button" onClick={() => void openAssignment(a)} className="mt-3 flex items-center gap-1 text-sm text-vortex-red font-medium">
              {a.assignable_type === 'workout' ? 'View workout' : a.assignable_type === 'training_program' ? 'View program' : 'View challenge'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {openWorkout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-bold text-lg">{openWorkout.workout.title}</h3>
              <button type="button" onClick={() => setOpenWorkout(null)} className="text-gray-400">Close</button>
            </div>
            <div className="p-5 space-y-4">
              {openWorkout.workout.blocks.map((block, bi) => (
                <div key={bi}>
                  <div className="font-semibold text-gray-800">{block.label} <span className="text-xs text-gray-400">({block.rounds} round{block.rounds > 1 ? 's' : ''})</span></div>
                  <ul className="mt-1 space-y-1">
                    {block.items.map((item, ii) => (
                      <li key={ii} className="text-sm text-gray-700 flex justify-between">
                        <span>{item.exercise_name}</span>
                        <span className="text-gray-400">{item.sets ?? '-'}x{item.reps ?? '-'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button type="button" onClick={() => void logComplete(openWorkout.assignment, openWorkout.workout)} className="w-full flex items-center justify-center gap-2 bg-vortex-red text-white py-2.5 rounded-lg font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {openProgram && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-bold text-lg">{openProgram.title}</h3>
              <button type="button" onClick={() => setOpenProgram(null)} className="text-gray-400">Close</button>
            </div>
            <div className="p-5 space-y-4">
              {openProgram.description && <p className="text-sm text-gray-600">{openProgram.description}</p>}
              {openProgram.weeks.map((week) => (
                <div key={week.week_number}>
                  <div className="font-semibold text-gray-800">Week {week.week_number}{week.focus ? ` - ${week.focus}` : ''}</div>
                  <ul className="mt-1 space-y-1">
                    {week.sessions.map((s, si) => (
                      <li key={si} className="text-sm text-gray-700">{s.title || s.workout_title || 'Session'}</li>
                    ))}
                    {week.sessions.length === 0 && <li className="text-xs text-gray-400">No sessions.</li>}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {openChallenge && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-bold text-lg">{openChallenge.title}</h3>
              <button type="button" onClick={() => setOpenChallenge(null)} className="text-gray-400">Close</button>
            </div>
            <div className="p-5 space-y-3">
              {openChallenge.description && <p className="text-sm text-gray-600">{openChallenge.description}</p>}
              <p className="text-xs text-gray-500">Scoring: {openChallenge.scoring_type.replace('_', ' ')}{openChallenge.unit ? ` (${openChallenge.unit})` : ''}</p>
              <div>
                <div className="font-semibold text-gray-800 text-sm mb-1">Leaderboard</div>
                <ol className="space-y-1">
                  {openChallenge.entries.map((e, i) => (
                    <li key={i} className="flex justify-between text-sm border-b border-gray-50 py-1">
                      <span><span className="text-gray-400 mr-2">{i + 1}.</span>{e.first_name} {e.last_name}</span>
                      <span className="font-semibold text-vortex-red">{e.value_numeric ?? '-'}</span>
                    </li>
                  ))}
                  {openChallenge.entries.length === 0 && <li className="text-xs text-gray-400">No entries yet.</li>}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function MemberProgressTab() {
  const [data, setData] = useState<{ results: Array<{ assessment_name: string; value_numeric: number | null; unit?: string | null; tested_at: string; tenet_name?: string | null }>; skills: Array<{ skill_label?: string | null; exercise_name?: string | null; score: number | null; max_score: number | null; graded_at: string }> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    coachFetch<typeof data>('/api/member/training/progress')
      .then((d) => setData(d))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load progress'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading progress...</div>

  const trendData = (data?.results ?? []).map((r) => ({ date: new Date(r.tested_at).toLocaleDateString(), [r.assessment_name]: r.value_numeric }))
  const skillData = (data?.skills ?? []).map((s) => ({ name: s.skill_label || s.exercise_name || 'Skill', score: s.score ?? 0 }))

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">My Progress</h2>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Assessment Trends</h3>
          {trendData.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">No results recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {[...new Set((data?.results ?? []).map((r) => r.assessment_name))].map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={['#dc2626', '#0ea5e9', '#16a34a', '#f59e0b'][i % 4]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Skill Grades</h3>
          {skillData.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">No skill grades yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={skillData} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="score" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
