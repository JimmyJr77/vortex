import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { adminApiRequest } from '../utils/api'

interface Coach {
  id: number
  full_name: string
  email?: string | null
  phone?: string | null
  bio?: string | null
  coach_active: boolean
  assignments: Array<{
    id: number
    programId?: number | null
    programName?: string | null
    schedulingFormId?: number | null
    className?: string | null
    assignmentLabel?: string | null
  }>
}

interface ProgramOption {
  id: number
  display_name: string
  programs_id?: number | null
}

interface ClassOption {
  id: number
  label: string
  program_id?: number | null
  programs_id?: number | null
}

interface UserOption {
  id: number
  full_name?: string
  email?: string | null
}

export default function AdminCoaches() {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [programs, setPrograms] = useState<ProgramOption[]>([])
  const [schedulingClasses, setSchedulingClasses] = useState<ClassOption[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState<number | ''>('')
  const [programId, setProgramId] = useState<number | ''>('')
  const [schedulingFormId, setSchedulingFormId] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)
  const [classesLoading, setClassesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedProgram = useMemo(
    () => programs.find((p) => Number(p.id) === Number(programId)),
    [programs, programId],
  )

  const loadClassesForProgram = useCallback(async (pid: number | '') => {
    if (!pid) {
      setSchedulingClasses([])
      return
    }
    setClassesLoading(true)
    try {
      const res = await adminApiRequest(`/api/admin/coaches/options?programId=${pid}`)
      if (!res.ok) throw new Error('Failed to load classes for program')
      const json = await res.json()
      setSchedulingClasses(json.data?.schedulingClasses ?? [])
    } catch (err) {
      setSchedulingClasses([])
      setError(err instanceof Error ? err.message : 'Failed to load classes for program')
    } finally {
      setClassesLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [coachesRes, optionsRes] = await Promise.all([
        adminApiRequest('/api/admin/coaches'),
        adminApiRequest('/api/admin/coaches/options'),
      ])
      if (!coachesRes.ok || !optionsRes.ok) throw new Error('Failed to load coach management')
      const coachesJson = await coachesRes.json()
      const optionsJson = await optionsRes.json()
      setCoaches(coachesJson.data ?? [])
      setUsers(optionsJson.data?.users ?? [])
      setPrograms(optionsJson.data?.programs ?? [])
      setSelectedCoachId((current) => current || optionsJson.data?.users?.[0]?.id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coach management')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadClassesForProgram(programId)
    setSchedulingFormId('')
  }, [programId, loadClassesForProgram])

  const addAssignment = async () => {
    if (!selectedCoachId || (!programId && !schedulingFormId)) return
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest(`/api/admin/coaches/${selectedCoachId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          programId: programId || null,
          schedulingFormId: schedulingFormId || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to assign coach')
      }
      setProgramId('')
      setSchedulingFormId('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign coach')
    } finally {
      setSaving(false)
    }
  }

  const removeAssignment = async (assignmentId: number) => {
    setSaving(true)
    try {
      const res = await adminApiRequest(`/api/admin/coaches/assignments/${assignmentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove assignment')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove assignment')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading coaches...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Coach Management</h2>
        <p className="text-sm text-gray-600">
          Assign coaches to a program or a specific scheduling class. Rosters use enrollments from scheduling signups for that program or class.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">New Assignment</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <select value={selectedCoachId} onChange={(e) => setSelectedCoachId(Number(e.target.value) || '')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Select coach</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}
          </select>
          <select
            value={programId}
            onChange={(e) => setProgramId(Number(e.target.value) || '')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select program…</option>
            {programs.map((program) => <option key={program.id} value={program.id}>{program.display_name}</option>)}
          </select>
          <select
            value={schedulingFormId}
            onChange={(e) => setSchedulingFormId(Number(e.target.value) || '')}
            disabled={!programId || classesLoading}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">
              {!programId ? 'Select program first…' : classesLoading ? 'Loading classes…' : 'All classes in program'}
            </option>
            {schedulingClasses.map((cls) => <option key={cls.id} value={cls.id}>{cls.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => void addAssignment()}
            disabled={saving || !selectedCoachId || !programId}
            className="inline-flex items-center justify-center gap-2 bg-vortex-red text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
          >
            <Plus className="w-4 h-4" /> Assign
          </button>
        </div>
        <p className="text-xs text-gray-500">
          {programId && !classesLoading && schedulingClasses.length === 0
            ? `No scheduling classes found for “${selectedProgram?.display_name ?? 'this program'}”. Link a class in Scheduling admin first.`
            : 'Select a program, then optionally pick a specific scheduling class. Leave class as “All classes in program” to cover every enrollment in that program.'}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {coaches.map((coach) => (
          <div key={coach.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900">{coach.full_name}</h3>
                <p className="text-sm text-gray-500">{coach.email}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs ${coach.coach_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {coach.coach_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {coach.assignments.length === 0 ? (
                <p className="text-sm text-gray-500">No assignments yet.</p>
              ) : coach.assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span>{assignment.assignmentLabel || assignment.className || assignment.programName || 'Assignment'}</span>
                  <button type="button" onClick={() => void removeAssignment(assignment.id)} className="text-red-600 hover:text-red-700" aria-label="Remove assignment">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
