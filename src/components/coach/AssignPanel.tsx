import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import ClassDrilldownTarget, { type AssignGroupTarget } from './ClassDrilldownTarget'
import { fetchCoachMemberOptions } from './fetchCoachMemberOptions'
import SearchCombobox, { type SearchComboboxOption } from './SearchCombobox'
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
type AudienceType = 'member' | 'group'
type MemberScope = 'my_classes' | 'all'
type VideoItemMode = 'exercise' | 'custom'

const TARGET_LABELS: Record<string, string> = {
  member: 'Athlete',
  class: 'Class',
  primary_sport: 'Sport',
  program: 'Program',
  offering: 'Offering',
  scheduling_class: 'Class session',
}

export default function AssignPanel() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [programs, setPrograms] = useState<Array<{ id: number; title: string }>>([])
  const [challenges, setChallenges] = useState<Array<{ id: number; title: string }>>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [noteTemplates, setNoteTemplates] = useState<NoteTemplate[]>([])
  const [allExercises, setAllExercises] = useState<ExerciseOption[]>([])
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [exercisesLoading, setExercisesLoading] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [membersLoading, setMembersLoading] = useState(false)

  const [assignableType, setAssignableType] = useState<AssignableType>('workout')
  const [assignableId, setAssignableId] = useState('')
  const [videoItemMode, setVideoItemMode] = useState<VideoItemMode>('exercise')
  const [customTitle, setCustomTitle] = useState('')
  const [audienceType, setAudienceType] = useState<AudienceType>('member')
  const [memberScope, setMemberScope] = useState<MemberScope>('my_classes')
  const [targetType, setTargetType] = useState('member')
  const [targetId, setTargetId] = useState('')
  const [targetLabel, setTargetLabel] = useState('')
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
    setMembersLoading(true)
    try {
      setMembers(await fetchCoachMemberOptions(scope))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load athletes')
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [])

  const loadAllExercises = useCallback(async () => {
    setExercisesLoading(true)
    try {
      const rows = await coachFetch<ExerciseOption[]>(`/api/coach/exercises`)
      setAllExercises(rows.map((e) => ({ id: Number(e.id), name: e.name })))
    } catch {
      setAllExercises([])
    } finally {
      setExercisesLoading(false)
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
    if (audienceType === 'member') void loadMembers(memberScope)
  }, [audienceType, memberScope, loadMembers])

  useEffect(() => {
    if (assignableType === 'video_submission' && videoItemMode === 'exercise' && allExercises.length === 0 && !exercisesLoading) {
      void loadAllExercises()
    }
  }, [assignableType, videoItemMode, allExercises.length, exercisesLoading, loadAllExercises])

  const filteredExercises = useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase()
    const list = q ? allExercises.filter((e) => e.name.toLowerCase().includes(q)) : allExercises
    return list.slice(0, 40)
  }, [allExercises, exerciseSearch])

  const exerciseComboboxOptions = useMemo<SearchComboboxOption[]>(
    () => filteredExercises.map((e) => ({ key: String(e.id), label: e.name })),
    [filteredExercises],
  )

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => m.name.toLowerCase().includes(q))
  }, [members, memberSearch])

  const memberComboboxOptions = useMemo<SearchComboboxOption[]>(
    () => filteredMembers.map((m) => ({ key: String(m.id), label: m.name })),
    [filteredMembers],
  )

  const assignableOptions = assignableType === 'workout' ? workouts.map((w) => ({ id: w.id as number, title: w.title }))
    : assignableType === 'training_program' ? programs
    : assignableType === 'challenge' ? challenges
    : []

  const resetForm = () => {
    setAssignableId('')
    setCustomTitle('')
    setTargetId('')
    setTargetLabel('')
    setTargetType('member')
    setDueDate('')
    setNotes('')
    setSelectedTemplateId('')
    setExerciseSearch('')
    setMemberSearch('')
  }

  const selectExercise = (exercise: ExerciseOption) => {
    setAssignableId(String(exercise.id))
    setExerciseSearch(exercise.name)
  }

  const selectMember = (member: MemberOption) => {
    setTargetType('member')
    setTargetId(String(member.id))
    setTargetLabel(member.name)
    setMemberSearch(member.name)
  }

  const onGroupTargetChange = (target: AssignGroupTarget | null) => {
    if (!target) {
      setTargetId('')
      setTargetLabel('')
      return
    }
    setTargetType(target.target_type)
    setTargetId(String(target.target_id))
    setTargetLabel(target.label)
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
        setError('Select who to assign to.')
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
    const targetLabel = TARGET_LABELS[a.target_type] || a.target_type
    return `${label} → ${targetLabel} #${a.target_id}`
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
                  onClick={() => {
                    setVideoItemMode('exercise')
                    setCustomTitle('')
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${videoItemMode === 'exercise' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Library exercise
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVideoItemMode('custom')
                    setAssignableId('')
                    setExerciseSearch('')
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${videoItemMode === 'custom' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Custom name
                </button>
              </div>
              {videoItemMode === 'exercise' ? (
                <SearchCombobox
                  value={exerciseSearch}
                  onChange={(value) => {
                    setExerciseSearch(value)
                    setAssignableId('')
                  }}
                  onSelect={(opt) => {
                    const exercise = allExercises.find((e) => String(e.id) === opt.key)
                    if (exercise) selectExercise(exercise)
                  }}
                  options={exerciseComboboxOptions}
                  loading={exercisesLoading}
                  placeholder="Search library exercises…"
                  emptyMessage="No exercises match your search."
                  onFocus={() => {
                    if (allExercises.length === 0) void loadAllExercises()
                  }}
                />
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
              value={audienceType}
              onChange={(e) => {
                const next = e.target.value as AudienceType
                setAudienceType(next)
                setTargetId('')
                setTargetLabel('')
                setTargetType(next === 'member' ? 'member' : 'primary_sport')
                setMemberSearch('')
              }}
              className="w-full border border-gray-300 rounded px-2 py-1.5"
            >
              <option value="member">Individual athlete</option>
              <option value="group">Class</option>
            </select>
          </label>

          {audienceType === 'member' ? (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMemberScope('my_classes')
                    setTargetId('')
                    setTargetLabel('')
                    setMemberSearch('')
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${memberScope === 'my_classes' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  My athletes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMemberScope('all')
                    setTargetId('')
                    setTargetLabel('')
                    setMemberSearch('')
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${memberScope === 'all' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Any athlete
                </button>
              </div>
              <label className="text-sm block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">Athlete</span>
                <SearchCombobox
                  value={memberSearch}
                  onChange={(value) => {
                    setMemberSearch(value)
                    setTargetId('')
                    setTargetLabel('')
                  }}
                  onSelect={(opt) => {
                    const member = members.find((m) => String(m.id) === opt.key)
                    if (member) selectMember(member)
                  }}
                  options={memberComboboxOptions}
                  loading={membersLoading}
                  placeholder="Search athletes…"
                  emptyMessage="No athletes match your search."
                  loadingMessage="Loading athletes…"
                />
              </label>
            </>
          ) : (
            <ClassDrilldownTarget onTargetChange={onGroupTargetChange} />
          )}

          {targetLabel && (
            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              Target: <span className="font-semibold">{targetLabel}</span>
            </p>
          )}

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
