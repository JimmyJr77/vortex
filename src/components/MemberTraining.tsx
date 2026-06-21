import { useCallback, useEffect, useState } from 'react'
import { Loader2, Dumbbell, CheckCircle2, ChevronRight, MessageSquare, Trophy, Video } from 'lucide-react'
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

interface PrRow {
  metric_label?: string | null
  value_numeric?: number | null
  unit?: string | null
  achieved_at: string
  source_type: string
  assessment_name?: string | null
  exercise_name?: string | null
}

interface ProgressData {
  results: Array<{ assessment_name: string; value_numeric: number | null; unit?: string | null; tested_at: string; tenet_name?: string | null }>
  skills: Array<{ skill_label?: string | null; exercise_name?: string | null; score: number | null; max_score: number | null; graded_at: string }>
  prs?: PrRow[]
}

export function MemberProgressTab() {
  const [data, setData] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [goals, setGoals] = useState<Array<{ id: number; title: string; description?: string | null; target_date?: string | null }>>([])
  const [achievements, setAchievements] = useState<Array<{ id: number; kind: string; label: string; description?: string | null; achieved_at: string }>>([])

  useEffect(() => {
    coachFetch<ProgressData>('/api/member/training/progress')
      .then((d) => setData(d))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load progress'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    coachFetch<Array<{ id: number; title: string; description?: string | null; target_date?: string | null }>>('/api/member/training/goals')
      .then(setGoals)
      .catch(() => {})
    coachFetch<Array<{ id: number; kind: string; label: string; description?: string | null; achieved_at: string }>>('/api/member/training/achievements')
      .then(setAchievements)
      .catch(() => {})
  }, [])

  if (loading) return <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading progress...</div>

  const trendData = (data?.results ?? []).map((r) => ({ date: new Date(r.tested_at).toLocaleDateString(), [r.assessment_name]: r.value_numeric }))
  const skillData = (data?.skills ?? []).map((s) => ({ name: s.skill_label || s.exercise_name || 'Skill', score: s.score ?? 0 }))
  const prs = data?.prs ?? []

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">My Progress</h2>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      <WellnessCheckinCard />

      <MemberFormReviewCard />

      {(goals.length > 0 || achievements.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3">My Goals</h3>
              <ul className="space-y-2">
                {goals.map((g) => (
                  <li key={g.id} className="rounded-lg border border-gray-100 px-3 py-2">
                    <div className="font-medium text-gray-900 text-sm">{g.title}</div>
                    {g.description && <div className="text-xs text-gray-600 mt-0.5">{g.description}</div>}
                    {g.target_date && (
                      <div className="text-[10px] text-gray-400 mt-1">Target: {new Date(g.target_date).toLocaleDateString()}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {achievements.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> Achievements
              </h3>
              <div className="flex flex-wrap gap-2">
                {achievements.map((a) => (
                  <div key={a.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="text-sm font-semibold text-amber-900">{a.label}</div>
                    {a.description && <div className="text-xs text-amber-700">{a.description}</div>}
                    <div className="text-[10px] text-amber-600">{new Date(a.achieved_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {prs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Personal Records</h3>
          <div className="flex flex-wrap gap-2">
            {prs.map((pr, i) => (
              <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="text-sm font-semibold text-amber-900">{pr.metric_label || pr.assessment_name || pr.exercise_name || 'PR'}</div>
                <div className="text-xs text-amber-700">{pr.value_numeric}{pr.unit ? ` ${pr.unit}` : ''} · {new Date(pr.achieved_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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

interface WellnessRow {
  checkin_date: string
  sleep_hours?: number | null
  soreness?: number | null
  rpe?: number | null
  mood?: number | null
  energy?: number | null
  note?: string | null
}

interface FormReviewRow {
  id: number
  exercise_name?: string | null
  subject?: string | null
  video_url: string
  status: string
  coach_note?: string | null
  reviewed_at?: string | null
  created_at: string
}

function MemberFormReviewCard() {
  const [exercises, setExercises] = useState<Array<{ id: number; name: string }>>([])
  const [submissions, setSubmissions] = useState<FormReviewRow[]>([])
  const [mode, setMode] = useState<'exercise' | 'free'>('exercise')
  const [exerciseId, setExerciseId] = useState<number | ''>('')
  const [subject, setSubject] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setExercises(await coachFetch<Array<{ id: number; name: string }>>('/api/member/training/form-review/exercise-options'))
      setSubmissions(await coachFetch<FormReviewRow[]>('/api/member/training/form-reviews'))
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const uploadVideo = async (file: File) => {
    setError(null)
    setSuccess(null)
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file.')
      return
    }
    const duration = await new Promise<number>((resolve, reject) => {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(v.src)
        resolve(v.duration)
      }
      v.onerror = () => reject(new Error('Could not read video metadata'))
      v.src = URL.createObjectURL(file)
    }).catch(() => null)
    if (duration != null && duration > 60) {
      setError('Video must be 60 seconds or less.')
      return
    }
    setUploading(true)
    try {
      const sig = await coachFetch<{
        configured: boolean
        uploadUrl?: string
        apiKey?: string
        timestamp?: number
        folder?: string
        signature?: string
      }>('/api/member/training/form-review/upload-signature')
      if (!sig.configured || !sig.uploadUrl) {
        setError('Video upload is not configured. Ask your coach for help.')
        return
      }
      const fd = new FormData()
      fd.append('file', file)
      fd.append('api_key', sig.apiKey!)
      fd.append('timestamp', String(sig.timestamp))
      fd.append('folder', sig.folder!)
      fd.append('signature', sig.signature!)
      const resp = await fetch(sig.uploadUrl, { method: 'POST', body: fd })
      const data = (await resp.json()) as {
        secure_url?: string
        public_id?: string
        error?: { message?: string }
      }
      if (!data.secure_url) {
        setError(data.error?.message || 'Upload failed.')
        return
      }
      if (mode === 'exercise' && exerciseId === '') {
        setError('Select an exercise or switch to general upload.')
        return
      }
      if (mode === 'free' && !subject.trim()) {
        setError('Add a short subject for your question.')
        return
      }
      await coachFetch('/api/member/training/form-reviews', {
        method: 'POST',
        body: JSON.stringify({
          exercise_id: mode === 'exercise' && exerciseId !== '' ? exerciseId : null,
          subject: mode === 'free' ? subject.trim() : null,
          video_url: data.secure_url,
          video_public_id: data.public_id,
          duration_seconds: duration != null ? Math.round(duration) : null,
        }),
      })
      setSuccess('Video submitted! Your coach will review it soon.')
      setSubject('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <Video className="w-4 h-4 text-vortex-red" /> Form check video
      </h3>
      <p className="text-xs text-gray-500 mb-3">Upload a short clip (max 60s) for your coach to review.</p>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm mb-3">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 text-green-700 px-3 py-2 text-sm mb-3">{success}</div>}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMode('exercise')}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${mode === 'exercise' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Assigned exercise
        </button>
        <button
          type="button"
          onClick={() => setMode('free')}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${mode === 'free' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          General help
        </button>
      </div>
      {mode === 'exercise' ? (
        <select
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value ? Number(e.target.value) : '')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
        >
          <option value="">Select exercise from your assignments…</option>
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      ) : (
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What do you need help with? (e.g. handstand shape)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
        />
      )}
      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
        <input
          type="file"
          accept="video/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void uploadVideo(file)
            e.target.value = ''
          }}
        />
        <span className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Choose video'}
        </span>
      </label>
      {submissions.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="text-xs font-semibold text-gray-500 mb-2">Your submissions</div>
          <ul className="space-y-2">
            {submissions.slice(0, 5).map((s) => (
              <li key={s.id} className="text-sm text-gray-700 flex justify-between gap-2">
                <span>{s.exercise_name || s.subject || 'Upload'} · {s.status}</span>
                <span className="text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function WellnessCheckinCard() {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<{ sleep_hours: string; soreness: string; rpe: string; mood: string; energy: string; note: string }>(
    { sleep_hours: '', soreness: '', rpe: '', mood: '', energy: '', note: '' },
  )
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    coachFetch<WellnessRow[]>('/api/member/training/wellness')
      .then((rows) => {
        const todayRow = rows.find((r) => String(r.checkin_date).slice(0, 10) === today)
        if (todayRow) {
          setForm({
            sleep_hours: todayRow.sleep_hours != null ? String(todayRow.sleep_hours) : '',
            soreness: todayRow.soreness != null ? String(todayRow.soreness) : '',
            rpe: todayRow.rpe != null ? String(todayRow.rpe) : '',
            mood: todayRow.mood != null ? String(todayRow.mood) : '',
            energy: todayRow.energy != null ? String(todayRow.energy) : '',
            note: todayRow.note || '',
          })
          setSaved(true)
        }
      })
      .catch(() => {})
  }, [today])

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await coachFetch('/api/member/training/wellness', {
        method: 'POST',
        body: JSON.stringify({
          checkin_date: today,
          sleep_hours: form.sleep_hours ? Number(form.sleep_hours) : null,
          soreness: form.soreness ? Number(form.soreness) : null,
          rpe: form.rpe ? Number(form.rpe) : null,
          mood: form.mood ? Number(form.mood) : null,
          energy: form.energy ? Number(form.energy) : null,
          note: form.note || null,
        }),
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save check-in')
    } finally {
      setSaving(false)
    }
  }

  const fields: Array<{ key: keyof typeof form; label: string; hint: string }> = [
    { key: 'sleep_hours', label: 'Sleep (hrs)', hint: '0-12' },
    { key: 'soreness', label: 'Soreness', hint: '1-10' },
    { key: 'rpe', label: 'Yesterday RPE', hint: '1-10' },
    { key: 'mood', label: 'Mood', hint: '1-10' },
    { key: 'energy', label: 'Energy', hint: '1-10' },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-gray-800">Daily Check-in</h3>
        {saved && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Logged for today</span>}
      </div>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm mb-3">{error}</div>}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        {fields.map((f) => (
          <label key={f.key} className="text-sm">
            <span className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</span>
            <input
              type="number"
              value={form[f.key]}
              onChange={(e) => { setForm({ ...form, [f.key]: e.target.value }); setSaved(false) }}
              placeholder={f.hint}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5"
            />
          </label>
        ))}
      </div>
      <input
        value={form.note}
        onChange={(e) => { setForm({ ...form, note: e.target.value }); setSaved(false) }}
        placeholder="Anything your coach should know? (optional)"
        className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
      <button type="button" onClick={() => void submit()} disabled={saving} className="mt-3 flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {saved ? 'Update Check-in' : 'Save Check-in'}
      </button>
    </div>
  )
}

interface MemberThread {
  id: number
  subject?: string | null
  last_message_body?: string | null
}

interface MemberMessage {
  id: number
  body: string
  sender_name?: string | null
  sender_member_id?: number | null
  created_at: string
}

export function MemberMessagesTab() {
  const [threads, setThreads] = useState<MemberThread[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MemberMessage[]>([])
  const [subject, setSubject] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coaches, setCoaches] = useState<Array<{ id: number; name: string }>>([])
  const [pickedCoachId, setPickedCoachId] = useState<number | ''>('')

  useEffect(() => {
    coachFetch<Array<{ id: number; name: string }>>('/api/member/training/coaches')
      .then(setCoaches)
      .catch(() => {})
  }, [])

  const loadThreads = useCallback(async () => {
    setLoading(true)
    try {
      setThreads(await coachFetch<MemberThread[]>('/api/member/messages'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  const openThread = async (id: number) => {
    setSelectedId(id)
    try {
      const data = await coachFetch<{ thread: MemberThread; messages: MemberMessage[] }>(`/api/member/messages/${id}`)
      setSubject(data.thread.subject ?? null)
      setMessages(data.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread')
    }
  }

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return
    setSending(true)
    try {
      const msg = await coachFetch<MemberMessage>(`/api/member/messages/${selectedId}`, {
        method: 'POST',
        body: JSON.stringify({ body: reply.trim() }),
      })
      setMessages((prev) => [...prev, msg])
      setReply('')
      void loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const startThread = async () => {
    if (!newBody.trim()) return
    setSending(true)
    try {
      const data = await coachFetch<{ thread: MemberThread; message: MemberMessage }>('/api/member/messages', {
        method: 'POST',
        body: JSON.stringify({
          subject: newSubject.trim() || null,
          body: newBody.trim(),
          coach_user_id: pickedCoachId !== '' ? pickedCoachId : null,
        }),
      })
      setNewBody('')
      setNewSubject('')
      void loadThreads()
      await openThread(data.thread.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <MessageSquare className="w-6 h-6 text-vortex-red" /> Messages
      </h2>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">Message your coach</h3>
        {coaches.length > 0 && (
          <select
            value={pickedCoachId}
            onChange={(e) => setPickedCoachId(e.target.value ? Number(e.target.value) : '')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Any coach (coaching circle)</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <input
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder="Your message…"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void startThread()}
          disabled={sending || !newBody.trim()}
          className="bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
        >
          Send
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b text-sm font-semibold">Threads</div>
          {loading ? (
            <div className="p-3 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : threads.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No conversations yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void openThread(t.id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedId === t.id ? 'bg-red-50' : ''}`}
                >
                  <div className="font-medium truncate">{t.subject || 'Conversation'}</div>
                  {t.last_message_body && <div className="text-xs text-gray-400 truncate">{t.last_message_body}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl min-h-[280px] flex flex-col">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 p-6">Select a thread.</div>
          ) : (
            <>
              <div className="px-4 py-2 border-b text-sm font-semibold">{subject || 'Conversation'}</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                      m.sender_member_id ? 'bg-vortex-red text-white ml-auto' : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div>{m.body}</div>
                    <div className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply…"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button type="button" onClick={() => void sendReply()} disabled={sending} className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm">
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
