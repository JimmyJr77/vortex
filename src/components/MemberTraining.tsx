import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import RecipientPicker, { recipientsToPayload } from './messaging/RecipientPicker'
import ThreadHeaderMenu from './messaging/ThreadHeaderMenu'
import MessageReplyComposer from './messaging/MessageReplyComposer'
import MessagingMessageThread from './messaging/MessagingMessageThread'
import MessagingThreadListSortMenu, {
  defaultSortDir,
  type ThreadListSortDir,
  type ThreadListSortField,
} from './messaging/MessagingThreadListSortMenu'
import { buildReplyQuote } from './messaging/messageFormatting'
import { prepareMessageBodyForSend, type MessageMentionPayload } from './messaging/messageMentions'
import MessagingThreadListShell from './messaging/MessagingThreadListShell'
import MessagingMobileShell from './messaging/MessagingMobileShell'
import MessagingInboxTabs, { type MessagingInboxTab } from './messaging/MessagingInboxTabs'
import MessagingThreadRow from './messaging/MessagingThreadRow'
import MessagingContextBanner from './messaging/MessagingContextBanner'
import MessagingInfoCard from './messaging/MessagingInfoCard'
import { getMessageViewer } from './messaging/messageBubbleStyle'
import { uploadMessageAttachment, type UploadedAttachment } from './messaging/messageAttachmentUpload'
import { markThreadRead } from './messaging/messagingApi'
import MessagingThreadFaq from './messaging/MessagingThreadFaq'
import MessagingThreadDetailShell from './messaging/MessagingThreadDetailShell'
import MessagingMaximizeToggle from './messaging/MessagingMaximizeToggle'
import MessagePinSelectionBar from './messaging/MessagePinSelectionBar'
import { useThreadPinGroups } from './messaging/useThreadPinGroups'
import {
  countThreadsByInboxTab,
  filterMessageThreads,
  filterThreadsByInboxTab,
  messagingWorkspaceRoot,
  messagingWorkspaceShell,
  messagingWorkspaceThreadOpen,
  sortMessageThreads,
  defaultLandingThreadId,
  threadListTitle,
} from './messaging/messagingLayout'
import type {
  EnrollmentGroup,
  MessageRow,
  MessageThread,
  RecipientOption,
  ThreadParticipant,
} from './messaging/types'
import { mergeRecipientOptions, participantKey } from './messaging/types'
import { useMessageRealtime } from '../hooks/useMessageRealtime'
import { Loader2, Dumbbell, CheckCircle2, ChevronRight, MessageSquare, Trophy, Video, X } from 'lucide-react'
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
  assignment_id?: number | null
  exercise_name?: string | null
  subject?: string | null
  display_label?: string | null
  video_url: string
  status: string
  coach_note?: string | null
  reviewed_at?: string | null
  due_date?: string | null
  created_at: string
  athlete_comment?: string | null
  self_critique?: string | null
  athlete_questions?: string | null
}

interface VideoSubmissionAssignment {
  id: number
  label: string
  coach_notes?: string | null
  request_date: string
  due_date?: string | null
  assignment_status: string
  submission_id?: number | null
  submission_status?: string | null
  exercise_name?: string | null
}

function MemberFormReviewCard() {
  const [assignedRequests, setAssignedRequests] = useState<VideoSubmissionAssignment[]>([])
  const [exercises, setExercises] = useState<Array<{ id: number; name: string }>>([])
  const [submissions, setSubmissions] = useState<FormReviewRow[]>([])
  const [portalMode, setPortalMode] = useState<'assigned' | 'request'>('assigned')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | ''>('')
  const [exerciseId, setExerciseId] = useState<number | ''>('')
  const [subject, setSubject] = useState('')
  const [athleteComment, setAthleteComment] = useState('')
  const [selfCritique, setSelfCritique] = useState('')
  const [athleteQuestions, setAthleteQuestions] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [assigned, subs, exOpts] = await Promise.all([
        coachFetch<VideoSubmissionAssignment[]>('/api/member/training/video-submission-assignments'),
        coachFetch<FormReviewRow[]>('/api/member/training/form-reviews'),
        coachFetch<Array<{ id: number; name: string }>>('/api/member/training/form-review/exercise-options'),
      ])
      setAssignedRequests(assigned)
      setSubmissions(subs)
      setExercises(exOpts)
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedAssignment = assignedRequests.find((a) => a.id === selectedAssignmentId)

  const uploadAndSubmit = async () => {
    setError(null)
    setSuccess(null)
    if (!pendingFile) {
      setError('Choose a video to upload.')
      return
    }
    const file = pendingFile
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file.')
      return
    }
    if (portalMode === 'assigned') {
      if (selectedAssignmentId === '') {
        setError('Select an assigned submission request.')
        return
      }
      if (selectedAssignment?.submission_id) {
        setError('You already have a pending submission for this request.')
        return
      }
    } else {
      if (exerciseId === '' && !subject.trim()) {
        setError('Select an exercise or describe what you want reviewed.')
        return
      }
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

      const body: Record<string, unknown> = {
        video_url: data.secure_url,
        video_public_id: data.public_id,
        duration_seconds: duration != null ? Math.round(duration) : null,
        athlete_comment: athleteComment.trim() || null,
        self_critique: selfCritique.trim() || null,
        athlete_questions: athleteQuestions.trim() || null,
      }

      if (portalMode === 'assigned') {
        body.assignment_id = selectedAssignmentId
      } else {
        body.exercise_id = exerciseId !== '' ? exerciseId : null
        body.subject = subject.trim() || null
      }

      await coachFetch('/api/member/training/form-reviews', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setSuccess('Video submitted! Your coach will review it soon.')
      setPendingFile(null)
      setAthleteComment('')
      setSelfCritique('')
      setAthleteQuestions('')
      setSubject('')
      setExerciseId('')
      setSelectedAssignmentId('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const formatDate = (d?: string | null) => d ? new Date(d).toLocaleDateString() : '—'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
        <Video className="w-4 h-4 text-vortex-red" /> Video Submission Portal
      </h3>
      <p className="text-xs text-gray-500 mb-3">Upload short clips (max 60s) for coach review.</p>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm mb-3">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 text-green-700 px-3 py-2 text-sm mb-3">{success}</div>}

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setPortalMode('assigned')}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${portalMode === 'assigned' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Assigned Submissions
        </button>
        <button
          type="button"
          onClick={() => setPortalMode('request')}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${portalMode === 'request' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Request Review
        </button>
      </div>

      {portalMode === 'assigned' ? (
        <>
          <select
            value={selectedAssignmentId}
            onChange={(e) => setSelectedAssignmentId(e.target.value ? Number(e.target.value) : '')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
          >
            <option value="">Select coach request…</option>
            {assignedRequests.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} · requested {formatDate(a.request_date)} · due {formatDate(a.due_date)}
                {a.submission_id ? ' · pending' : ''}
              </option>
            ))}
          </select>
          {selectedAssignment?.coach_notes && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
              <div className="text-xs font-semibold text-gray-500 mb-1">Coach notes</div>
              {selectedAssignment.coach_notes}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2 mb-3">
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value ? Number(e.target.value) : '')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Optional: exercise from assignments…</option>
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What do you want reviewed? (e.g. handstand shape)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="space-y-2 mb-3">
        <label className="text-xs font-semibold text-gray-500 block">Comment</label>
        <textarea
          value={athleteComment}
          onChange={(e) => setAthleteComment(e.target.value)}
          rows={2}
          placeholder="Comment with your video…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <label className="text-xs font-semibold text-gray-500 block">Self-critique</label>
        <textarea
          value={selfCritique}
          onChange={(e) => setSelfCritique(e.target.value)}
          rows={2}
          placeholder="What do you think went well or needs work?"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <label className="text-xs font-semibold text-gray-500 block">Other comments / questions</label>
        <textarea
          value={athleteQuestions}
          onChange={(e) => setAthleteQuestions(e.target.value)}
          rows={2}
          placeholder="Anything else for your coach?"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setPendingFile(file)
              e.target.value = ''
            }}
          />
          <span className="inline-flex items-center gap-2 bg-gray-100 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold">
            <Video className="w-4 h-4" />
            {pendingFile ? pendingFile.name : 'Choose video'}
          </span>
        </label>
        <button
          type="button"
          onClick={() => void uploadAndSubmit()}
          disabled={uploading || !pendingFile}
          className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
          {uploading ? 'Submitting…' : 'Submit video'}
        </button>
      </div>

      {submissions.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="text-xs font-semibold text-gray-500 mb-2">Submission history</div>
          <ul className="space-y-3">
            {submissions.slice(0, 8).map((s) => (
              <li key={s.id} className="text-sm border border-gray-100 rounded-lg p-3">
                <div className="flex justify-between gap-2 mb-1">
                  <span className="font-medium text-gray-800">
                    {s.display_label || s.exercise_name || s.subject || 'Upload'}
                    {s.assignment_id ? ' · assigned' : ' · self-initiated'}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{formatDate(s.created_at)}</span>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  Status: {s.status}
                  {s.due_date ? ` · due ${formatDate(s.due_date)}` : ''}
                </div>
                {s.status === 'reviewed' && s.coach_note && (
                  <p className="text-xs text-gray-600 mb-2">Coach: {s.coach_note}</p>
                )}
                <a href={s.video_url} target="_blank" rel="noopener noreferrer" className="text-xs text-vortex-red font-semibold">
                  View your video
                </a>
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

export function MemberMessagesTab({
  initialThreadId = null,
  onInitialThreadOpened,
  maximized = false,
  onMaximizedChange,
}: {
  initialThreadId?: number | null
  onInitialThreadOpened?: () => void
  maximized?: boolean
  onMaximizedChange?: (maximized: boolean) => void
} = {}) {
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [subject, setSubject] = useState<string | null>(null)
  const [subjectLocked, setSubjectLocked] = useState(false)
  const [threadParticipants, setThreadParticipants] = useState<ThreadParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [replyTarget, setReplyTarget] = useState<MessageRow | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newBody, setNewBody] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newRecipients, setNewRecipients] = useState<RecipientOption[]>([])
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([])
  const [recipientsLoading, setRecipientsLoading] = useState(true)
  const [enrollmentGroups, setEnrollmentGroups] = useState<EnrollmentGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [threadFavorite, setThreadFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [threadSearch, setThreadSearch] = useState('')
  const [listSort, setListSort] = useState<ThreadListSortField>('recent')
  const [listSortDir, setListSortDir] = useState<ThreadListSortDir>(() => defaultSortDir('recent'))
  const [inboxTab, setInboxTab] = useState<MessagingInboxTab>('all')
  const [threadInfoJson, setThreadInfoJson] = useState<Record<string, unknown> | null>(null)
  const [linkedThreadId, setLinkedThreadId] = useState<number | null>(null)
  const [faqPanelOpen, setFaqPanelOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const autoOpenedRef = useRef(false)
  const viewer = useMemo(() => getMessageViewer('member'), [])
  const pins = useThreadPinGroups(selectedId, 'member', coachFetch)
  const inboxCounts = useMemo(() => countThreadsByInboxTab(threads), [threads])
  const tabFilteredThreads = useMemo(
    () => filterThreadsByInboxTab(threads, inboxTab),
    [threads, inboxTab],
  )
  const filteredThreads = useMemo(
    () => sortMessageThreads(filterMessageThreads(tabFilteredThreads, threadSearch), listSort, listSortDir),
    [tabFilteredThreads, threadSearch, listSort, listSortDir],
  )
  const existingParticipantKeys = useMemo(
    () => threadParticipants.map((p) => participantKey(p)).filter((k): k is string => k != null),
    [threadParticipants],
  )

  useEffect(() => {
    setRecipientsLoading(true)
    coachFetch<RecipientOption[]>('/api/member/messages/recipient-options')
      .then(setRecipientOptions)
      .catch(() => {})
      .finally(() => setRecipientsLoading(false))
  }, [])

  useEffect(() => {
    setGroupsLoading(true)
    coachFetch<EnrollmentGroup[]>('/api/member/messages/enrollment-groups')
      .then(setEnrollmentGroups)
      .catch(() => setEnrollmentGroups([]))
      .finally(() => setGroupsLoading(false))
  }, [])

  const resolveEnrollmentGroup = useCallback(async (group: EnrollmentGroup) => {
    const params = new URLSearchParams({ type: group.groupType, id: String(group.id) })
    return coachFetch<RecipientOption[]>(`/api/member/messages/group-members?${params.toString()}`)
  }, [])

  const addEnrollmentGroupToNew = useCallback(async (group: EnrollmentGroup) => {
    const added = await resolveEnrollmentGroup(group)
    setNewRecipients((prev) => mergeRecipientOptions(prev, added))
  }, [resolveEnrollmentGroup])

  const loadThreads = useCallback(async () => {
    setLoading(true)
    try {
      setThreads(await coachFetch<MessageThread[]>('/api/member/messages'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useMessageRealtime({
    role: 'member',
    threadId: selectedId,
    onMessageCreated: (payload) => {
      if (payload.threadId === selectedId && payload.data) {
        setMessages((prev) => {
          const next = payload.data as MessageRow
          if (prev.some((m) => m.id === next.id)) return prev
          return [...prev, next]
        })
      }
      void loadThreads()
    },
    onReadUpdated: () => {
      void loadThreads()
    },
    onNotificationCreated: () => {
      void loadThreads()
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedId])

  const openThread = async (id: number) => {
    setSelectedId(id)
    const listRow = threads.find((t) => t.id === id)
    setThreadFavorite(Boolean(listRow?.is_favorite))
    try {
      const data = await coachFetch<{ thread: MessageThread; messages: MessageRow[] }>(`/api/member/messages/${id}`)
      setSubject(data.thread.subject ?? null)
      setSubjectLocked(Boolean(data.thread.subject_locked))
      setThreadParticipants(Array.isArray(data.thread.participants) ? data.thread.participants : [])
      setThreadInfoJson(data.thread.info_json ?? null)
      setLinkedThreadId(data.thread.linked_thread_id ?? null)
      setFaqPanelOpen(false)
      setMessages(data.messages)
      const lastId = data.messages[data.messages.length - 1]?.id
      void markThreadRead('member', id, coachFetch, lastId)
      void loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread')
    }
  }

  useEffect(() => {
    if (initialThreadId == null) return
    autoOpenedRef.current = true
    void openThread(initialThreadId).finally(() => onInitialThreadOpened?.())
  }, [initialThreadId])

  useEffect(() => {
    if (loading || autoOpenedRef.current || initialThreadId != null || selectedId != null) return
    const landingId = defaultLandingThreadId(filteredThreads)
    if (landingId == null) return
    autoOpenedRef.current = true
    void openThread(landingId)
  }, [loading, filteredThreads, initialThreadId, selectedId])

  const replyToMessage = useCallback((message: MessageRow) => {
    setReplyTarget(message)
    setReply(buildReplyQuote(message))
  }, [])

  const sendReply = async (mentions: MessageMentionPayload[] = []) => {
    if (!selectedId || (!reply.trim() && !pendingAttachment)) return
    setSending(true)
    try {
      let attachmentPayload: Partial<UploadedAttachment> = {}
      if (pendingAttachment) {
        attachmentPayload = await uploadMessageAttachment(pendingAttachment, 'member', coachFetch)
      }
      const replyText = reply.trim()
      const { body, mentions: resolvedMentions } = prepareMessageBodyForSend(
        replyText,
        mentions,
        replyTarget,
        threadParticipants,
      )
      const msg = await coachFetch<MessageRow>(`/api/member/messages/${selectedId}`, {
        method: 'POST',
        body: JSON.stringify({
          body,
          mentions: resolvedMentions,
          ...attachmentPayload,
        }),
      })
      setMessages((prev) => [...prev, msg])
      setReply('')
      setReplyTarget(null)
      setPendingAttachment(null)
      void loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const updateThreadSubject = async (update: { subject: string | null }) => {
    if (!selectedId) return
    const updated = await coachFetch<MessageThread>(`/api/member/messages/${selectedId}/subject`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    })
    setSubject(updated.subject ?? null)
    setSubjectLocked(Boolean(updated.subject_locked))
    void loadThreads()
  }

  const addRecipients = async (recipients: RecipientOption[]) => {
    if (!selectedId || recipients.length === 0) return
    const updated = await coachFetch<MessageThread>(`/api/member/messages/${selectedId}/recipients`, {
      method: 'PATCH',
      body: JSON.stringify(recipientsToPayload(recipients)),
    })
    setThreadParticipants(Array.isArray(updated.participants) ? updated.participants : [])
  }

  const toggleFavorite = async (favorite: boolean) => {
    if (!selectedId) return
    setFavoriteLoading(true)
    try {
      await coachFetch(`/api/member/messages/${selectedId}/favorite`, {
        method: 'PATCH',
        body: JSON.stringify({ favorite }),
      })
      setThreadFavorite(favorite)
      void loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favorite')
    } finally {
      setFavoriteLoading(false)
    }
  }

  const hideFromInbox = async () => {
    if (!selectedId) return
    await coachFetch(`/api/member/messages/${selectedId}/inbox`, {
      method: 'PATCH',
      body: JSON.stringify({ hidden: true }),
    })
    setSelectedId(null)
    setMessages([])
    void loadThreads()
  }

  const startThread = async () => {
    if (!newBody.trim() || newRecipients.length === 0) return
    setSending(true)
    try {
      const data = await coachFetch<{ thread: MessageThread; message: MessageRow }>('/api/member/messages', {
        method: 'POST',
        body: JSON.stringify({
          subject: newSubject.trim() || null,
          body: newBody.trim(),
          ...recipientsToPayload(newRecipients),
        }),
      })
      setNewBody('')
      setNewSubject('')
      setNewRecipients([])
      setNewOpen(false)
      void loadThreads()
      await openThread(data.thread.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className={`${messagingWorkspaceRoot} ${selectedId != null ? messagingWorkspaceThreadOpen : ''} ${maximized ? 'messaging-workspace--maximized' : ''}`}
    >
      <div className={`shrink-0 items-center justify-between flex-wrap gap-3 ${selectedId != null && !maximized ? 'hidden lg:flex' : maximized ? 'hidden' : 'flex'}`}>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-vortex-red" /> Messages
        </h2>
        <div className="flex items-center gap-2">
          {onMaximizedChange && (
            <MessagingMaximizeToggle
              maximized={maximized}
              onToggle={() => onMaximizedChange(!maximized)}
            />
          )}
          <button
            type="button"
            onClick={() => setNewOpen((v) => !v)}
            className="bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700"
          >
            {newOpen ? 'Cancel' : 'New thread'}
          </button>
        </div>
      </div>
      {error && <div className="shrink-0 rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      {newOpen && !maximized && (
        <div className="shrink-0 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">Start a conversation</h3>
          <RecipientPicker
            options={recipientOptions}
            selected={newRecipients}
            onChange={setNewRecipients}
            loading={recipientsLoading}
            placeholder="Search coaches, admins, members…"
            enrollmentGroups={enrollmentGroups}
            onAddEnrollmentGroup={addEnrollmentGroupToNew}
            groupsLoading={groupsLoading}
            groupActionLabel="Add everyone in your class"
          />
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="Thread name (optional)"
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
            disabled={sending || !newBody.trim() || newRecipients.length === 0}
            className="bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            Send
          </button>
        </div>
      )}

      <div className={messagingWorkspaceShell}>
      <MessagingMobileShell
        selectedThreadId={selectedId}
        onSelectThread={setSelectedId}
        onBack={() => setSelectedId(null)}
        maximized={maximized}
        listPanel={
          <MessagingThreadListShell
            maximized={maximized}
            title="Threads"
            titleAction={
              <div className="flex items-center gap-1 shrink-0">
                {maximized && onMaximizedChange && (
                  <MessagingMaximizeToggle
                    maximized={maximized}
                    onToggle={() => onMaximizedChange(false)}
                  />
                )}
                <MessagingThreadListSortMenu
                  sort={listSort}
                  sortDir={listSortDir}
                  onChange={(sort, sortDir) => {
                    setListSort(sort)
                    setListSortDir(sortDir)
                  }}
                />
              </div>
            }
            search={threadSearch}
            onSearchChange={setThreadSearch}
            searchPlaceholder="Search threads…"
            headerExtra={
              <MessagingInboxTabs activeTab={inboxTab} onChange={setInboxTab} counts={inboxCounts} />
            }
          >
            {loading ? (
              <div className="p-3 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">
                {threads.length === 0 ? 'No conversations yet.' : 'No threads match your filters.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredThreads.map((t) => (
                  <MessagingThreadRow
                    key={t.id}
                    thread={t}
                    selected={selectedId === t.id}
                    onSelect={(id) => void openThread(id)}
                  />
                ))}
              </div>
            )}
          </MessagingThreadListShell>
        }
        detailPanel={
          !selectedId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 p-6">Select a thread or start a new one.</div>
          ) : (
            <MessagingThreadDetailShell
              header={
                <div className="px-4 py-2 border-b flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold truncate">{subject || 'Conversation'}</span>
                    {subjectLocked && (
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 shrink-0">Locked</span>
                    )}
                  </div>
                  {faqPanelOpen ? (
                    <button
                      type="button"
                      aria-label="Close FAQ"
                      onClick={() => setFaqPanelOpen(false)}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  ) : (
                  <ThreadHeaderMenu
                    subject={subject}
                    subjectLocked={subjectLocked}
                    canEdit={!subjectLocked}
                    onUpdateSubject={updateThreadSubject}
                    recipientOptions={recipientOptions}
                    existingParticipantKeys={existingParticipantKeys}
                    recipientsLoading={recipientsLoading}
                    onAddRecipients={addRecipients}
                    enrollmentGroups={enrollmentGroups}
                    resolveEnrollmentGroup={resolveEnrollmentGroup}
                    groupsLoading={groupsLoading}
                    canHideFromInbox
                    onHideFromInbox={hideFromInbox}
                    isFavorite={threadFavorite}
                    onToggleFavorite={toggleFavorite}
                    favoriteLoading={favoriteLoading}
                    canAttach
                    onAttachmentPick={setPendingAttachment}
                    pinFilter={pins.pinFilter}
                    onPinFilterChange={pins.togglePinFilter}
                    importantFilterActive={pins.importantFilterActive}
                    onImportantFilterChange={pins.toggleImportantFilter}
                    pinControlsDisabled={pins.pinSelectionActive}
                    onOpenFaq={() => setFaqPanelOpen(true)}
                  />
                  )}
                </div>
              }
              footer={
                faqPanelOpen ? undefined : (
                <MessageReplyComposer
                  reply={reply}
                  onReplyChange={setReply}
                  onSend={(mentions) => void sendReply(mentions)}
                  sending={sending}
                  placeholder="Reply… (@ to mention)"
                  participants={threadParticipants}
                  viewer={viewer}
                  pendingAttachment={pendingAttachment}
                  onClearAttachment={() => setPendingAttachment(null)}
                />
                )
              }
            >
              {faqPanelOpen ? (
                <MessagingThreadFaq
                  role="member"
                  threadId={selectedId}
                  fetcher={coachFetch}
                  canEdit={false}
                  variant="panel"
                />
              ) : (
              <>
              {pins.pinFilter === 'off' && !pins.importantFilterActive && (
                <>
                  <MessagingContextBanner
                    linkedThreadId={linkedThreadId}
                    linkedThreadTitle={
                      linkedThreadId != null
                        ? threadListTitle(threads.find((t) => t.id === linkedThreadId) ?? { id: linkedThreadId })
                        : null
                    }
                    onJump={(id) => void openThread(id)}
                  />
                  <MessagingInfoCard infoJson={threadInfoJson} />
                </>
              )}
              {pins.pinSelection && (
                <MessagePinSelectionBar
                  selectedCount={pins.pinSelection.size}
                  saving={pins.saving}
                  onSave={() => void pins.savePinSelection()}
                  onCancel={pins.cancelPinSelection}
                />
              )}
              <MessagingMessageThread
                messages={messages}
                viewer={viewer}
                threadId={selectedId}
                role="member"
                fetcher={coachFetch}
                participants={threadParticipants}
                messagesEndRef={messagesEndRef}
                showSenderName={false}
                onReply={replyToMessage}
                onPinComment={(message) => pins.startPinSelection(message.id)}
                canUnpinMessage={(message) =>
                  pins.pinFilter === 'mine' && Boolean(pins.findOwnedGroupForMessage(message.id))
                }
                onUnpin={(message) => void pins.unpinMessage(message.id)}
                pinSelectionActive={pins.pinSelectionActive}
                pinSelectedIds={pins.pinSelection ?? undefined}
                onPinSelectionToggle={(message) => pins.togglePinSelectionMessage(message.id)}
                displayGroups={pins.displayGroups}
                pinFilterActive={pins.pinFilter !== 'off'}
                importantFilterActive={pins.importantFilterActive}
                onReactionsUpdated={(messageId, reactions) => {
                  setMessages((prev) =>
                    prev.map((row) => (row.id === messageId ? { ...row, reactions } : row)),
                  )
                }}
                className="p-4 space-y-2"
              />
              </>
              )}
            </MessagingThreadDetailShell>
          )
        }
      />
      </div>
    </div>
  )
}
