import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useCoachClasses } from './useCoachClasses'
import type { Workout } from '../../coach/types'

interface Assignment {
  id: number
  target_type: string
  target_id: number
  assignable_type: string
  assignable_id: number | null
  title?: string | null
  status: string
  due_date?: string | null
  assignable_title?: string | null
}

interface MemberOption {
  id: number
  name: string
}

interface TargetOption {
  id: number
  label: string
}

interface NoteTemplate {
  id: number
  label: string
  body: string
}

interface ExerciseOption {
  id: number
  name: string
}

type AssignableType = 'workout' | 'training_program' | 'challenge' | 'video_submission'
type TargetType = 'member' | 'class' | 'primary_sport' | 'program' | 'offering' | 'category' | 'scheduling_class'
type MemberScope = 'my_classes' | 'all'
type VideoItemMode = 'exercise' | 'custom'

const TARGET_LABELS: Record<TargetType, string> = {
  member: 'Athlete',
  class: 'Class',
  primary_sport: 'Sport',
  program: 'Program',
  offering: 'Offering',
  category: 'Category',
  scheduling_class: 'Specific class',
}

export default function AssignPanel() {
  const classes = useCoachClasses()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [programs, setPrograms] = useState<Array<{ id: number; title: string }>>([])
  const [challenges, setChallenges] = useState<Array<{ id: number; title: string }>>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [targetOptions, setTargetOptions] = useState<TargetOption[]>([])
  const [noteTemplates, setNoteTemplates] = useState<NoteTemplate[]>([])
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([])
  const [targetSearch, setTargetSearch] = useState('')

  const [assignableType, setAssignableType] = useState<AssignableType>('workout')
  const [assignableId, setAssignableId] = useState('')
  const [videoItemMode, setVideoItemMode] = useState<VideoItemMode>('exercise')
  const [customTitle, setCustomTitle] = useState('')
  const [targetType, setTargetType] = useState<TargetType>('member')
  const [memberScope, setMemberScope] = useState<MemberScope>('my_classes')
  const [targetId, setTargetId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [saveTemplateLabel, setSaveTemplateLabel] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAssignments = useCallback(async () => {
    try {
      setAssignments(await coachFetch<Assignment[]>('/api/coach/assignments'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments')
    }
  }, [])

  const loadNoteTemplates = useCallback(async () => {
    try {
      setNoteTemplates(await coachFetch<NoteTemplate[]>('/api/coach/note-templates'))
    } catch {
      setNoteTemplates([])
    }
  }, [])

  const loadMembers = useCallback(async (scope: MemberScope) => {
    try {
      setMembers(await coachFetch<MemberOption[]>(`/api/coach/members?scope=${scope}`))
    } catch {
      setMembers([])
    }
  }, [])

  const loadTargetOptions = useCallback(async (type: TargetType) => {
    if (type === 'member' || type === 'class') {
      setTargetOptions([])
      return
    }
    try {
      setTargetOptions(await coachFetch<TargetOption[]>(`/api/coach/assign/target-options?type=${type}`))
    } catch {
      setTargetOptions([])
    }
  }, [])

  const loadExercises = useCallback(async (q: string) => {
    try {
      const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
      const rows = await coachFetch<ExerciseOption[]>(`/api/coach/exercises${params}`)
      setExerciseOptions(rows.map((e) => ({ id: Number(e.id), name: e.name })))
    } catch {
      setExerciseOptions([])
    }
  }, [])

  const loadLibrary = useCallback(async () => {
    try {
      const [wkts, progs, chals] = await Promise.all([
        coachFetch<Workout[]>('/api/coach/workouts'),
        coachFetch<Array<{ id: number; title: string }>>('/api/coach/training-programs'),
        coachFetch<Array<{ id: number; title: string }>>('/api/coach/challenges'),
      ])
      setWorkouts(wkts)
      setPrograms(progs)
      setChallenges(chals)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignment data')
    }
  }, [])

  useEffect(() => {
    void loadLibrary()
    void loadAssignments()
    void loadNoteTemplates()
  }, [loadLibrary, loadAssignments, loadNoteTemplates])

  useEffect(() => {
    if (targetType === 'member') void loadMembers(memberScope)
    else if (targetType === 'class') setTargetOptions(classes.map((c) => ({
      id: c.id,
      label: c.program_name || c.class_iteration_label || `Class ${c.id}`,
    })))
    else void loadTargetOptions(targetType)
    setTargetId('')
    setTargetSearch('')
  }, [targetType, memberScope, classes, loadMembers, loadTargetOptions])

  useEffect(() => {
    if (assignableType !== 'video_submission') return
    const t = window.setTimeout(() => void loadExercises(exerciseSearch), assignableType === 'video_submission' && !exerciseSearch ? 0 : 250)
    return () => window.clearTimeout(t)
  }, [assignableType, exerciseSearch, loadExercises])

  const assignableOptions = assignableType === 'workout' ? workouts.map((w) => ({ id: w.id as number, title: w.title }))
    : assignableType === 'training_program' ? programs
    : assignableType === 'challenge' ? challenges
    : []

  const filteredTargetOptions = useMemo(() => {
    const q = targetSearch.trim().toLowerCase()
    const base = targetType === 'member'
      ? members.map((m) => ({ id: m.id, label: m.name }))
      : targetOptions
    if (!q) return base
    return base.filter((o) => o.label.toLowerCase().includes(q))
  }, [targetType, members, targetOptions, targetSearch])

  const resetForm = () => {
    setAssignableId('')
    setCustomTitle('')
    setTargetId('')
    setDueDate('')
    setNotes('')
    setSelectedTemplateId('')
    setExerciseSearch('')
  }

  const saveNoteTemplate = async () => {
    if (!notes.trim() || !saveTemplateLabel.trim()) return
    try {
      await coachFetch('/api/coach/note-templates', {
        method: 'POST',
        body: JSON.stringify({ label: saveTemplateLabel.trim(), body: notes.trim() }),
      })
      setSaveTemplateLabel('')
      await loadNoteTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note template')
    }
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        assignable_type: assignableType,
        target_type: targetType,
        target_id: Number(targetId),
        due_date: dueDate || null,
        notes: notes.trim() || null,
      }

      if (assignableType === 'video_submission') {
        if (videoItemMode === 'exercise' && assignableId) {
          body.assignable_id = Number(assignableId)
        } else if (videoItemMode === 'custom' && customTitle.trim()) {
          body.title = customTitle.trim()
        } else {
          setError('Select an exercise or enter a custom name for the video request.')
          setSaving(false)
          return
        }
      } else {
        body.assignable_id = Number(assignableId)
      }

      if (!targetId) {
        setError('Select a target.')
        setSaving(false)
        return
      }

      await coachFetch('/api/coach/assignments', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      resetForm()
      await loadAssignments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = assignableType === 'video_submission'
    ? targetId !== '' && (videoItemMode === 'exercise' && assignableId !== '' || videoItemMode === 'custom' && customTitle.trim())
    : assignableId !== '' && targetId !== ''

  const formatAssignmentRow = (a: Assignment) => {
    const label = a.assignable_title || a.title || `${a.assignable_type} #${a.assignable_id ?? 'custom'}`
  const targetLabel = `${TARGET_LABELS[a.target_type as TargetType] || a.target_type} #${a.target_id}`
    return `${label} → ${targetLabel}`
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Send className="w-6 h-6 text-vortex-red" /> Assign & Share</h2>
        <p className="text-sm text-gray-500">Push workouts, programs, challenges, or video submission requests to athletes or groups.</p>
      </div>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 h-fit">
          <label className="text-sm block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">What to assign</span>
            <select
              value={assignableType}
              onChange={(e) => {
                setAssignableType(e.target.value as AssignableType)
                setAssignableId('')
                setCustomTitle('')
              }}
              className="w-full border border-gray-300 rounded px-2 py-1.5"
            >
              <option value="workout">Workout</option>
              <option value="training_program">Training Program</option>
              <option value="challenge">Challenge</option>
              <option value="video_submission">Form Check (video only)</option>
            </select>
          </label>

          {assignableType === 'video_submission' ? (
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-vortex-red bg-red-50 px-2 py-1 rounded">
                Video submission only
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVideoItemMode('exercise')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${videoItemMode === 'exercise' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Library exercise
                </button>
                <button
                  type="button"
                  onClick={() => setVideoItemMode('custom')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${videoItemMode === 'custom' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Custom name
                </button>
              </div>
              {videoItemMode === 'exercise' ? (
                <>
                  <input
                    type="search"
                    value={exerciseSearch}
                    onChange={(e) => setExerciseSearch(e.target.value)}
                    placeholder="Search exercises…"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                  <select
                    value={assignableId}
                    onChange={(e) => setAssignableId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5"
                  >
                    <option value="">Select exercise…</option>
                    {exerciseOptions.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </>
              ) : (
                <input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Custom submission name (e.g. Handstand shape)"
                  className="w-full border border-gray-300 rounded px-2 py-1.5"
                />
              )}
            </div>
          ) : (
            <label className="text-sm block">
              <span className="block text-xs font-semibold text-gray-500 mb-1">Item</span>
              <select value={assignableId} onChange={(e) => setAssignableId(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5">
                <option value="">Select…</option>
                {assignableOptions.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
            </label>
          )}

          <label className="text-sm block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">Assign to</span>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as TargetType)}
              className="w-full border border-gray-300 rounded px-2 py-1.5"
            >
              <option value="member">Individual athlete</option>
              <option value="class">Class</option>
              <option value="primary_sport">Sport</option>
              <option value="program">Program</option>
              <option value="offering">Offering</option>
              <option value="category">Category</option>
              <option value="scheduling_class">Specific class</option>
            </select>
          </label>

          {targetType === 'member' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMemberScope('my_classes')}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${memberScope === 'my_classes' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                My athletes
              </button>
              <button
                type="button"
                onClick={() => setMemberScope('all')}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${memberScope === 'all' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Any athlete
              </button>
            </div>
          )}

          <label className="text-sm block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">Target</span>
            <input
              type="search"
              value={targetSearch}
              onChange={(e) => setTargetSearch(e.target.value)}
              placeholder="Search target…"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mb-1"
            />
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5">
              <option value="">Select…</option>
              {filteredTargetOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">Due date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5" />
          </label>

          <div className="text-sm block space-y-2">
            <span className="block text-xs font-semibold text-gray-500">Notes</span>
            {noteTemplates.length > 0 && (
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  const id = e.target.value
                  setSelectedTemplateId(id)
                  const t = noteTemplates.find((n) => String(n.id) === id)
                  if (t) setNotes(t.body)
                }}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">Saved notes…</option>
                {noteTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            )}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Instructions for the athlete…"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
            <div className="flex gap-2 items-center">
              <input
                value={saveTemplateLabel}
                onChange={(e) => setSaveTemplateLabel(e.target.value)}
                placeholder="Label to save note"
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => void saveNoteTemplate()}
                disabled={!notes.trim() || !saveTemplateLabel.trim()}
                className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
              >
                Save note
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !canSubmit}
            className="w-full flex items-center justify-center gap-2 bg-vortex-red text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Assign
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Recent Assignments</h3>
          <div className="space-y-1">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm border-b border-gray-50 py-2">
                <span className="text-gray-700">{formatAssignmentRow(a)}</span>
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
