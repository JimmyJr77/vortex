import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { adminApiRequest } from '../utils/api'
import AdminCoachAssignmentDrilldown, { type CoachAssignmentTarget } from './AdminCoachAssignmentDrilldown'

interface Coach {
  id: number
  full_name: string
  email?: string | null
  phone?: string | null
  bio?: string | null
  coach_active: boolean
  assignments: Array<{
    id: number
    programsId?: number | null
    programsName?: string | null
    programId?: number | null
    programName?: string | null
    schedulingFormId?: number | null
    className?: string | null
    assignmentLabel?: string | null
  }>
}

interface UserOption {
  id: number
  full_name?: string
  email?: string | null
}

export default function AdminCoaches() {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState<number | ''>('')
  const [assignmentTarget, setAssignmentTarget] = useState<CoachAssignmentTarget | null>(null)
  const [drilldownKey, setDrilldownKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const addAssignment = async () => {
    if (!selectedCoachId || !assignmentTarget) return
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest(`/api/admin/coaches/${selectedCoachId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          targetLevel: assignmentTarget.targetLevel,
          programsId: assignmentTarget.programsId ?? null,
          classEventId: assignmentTarget.classEventId ?? null,
          schedulingFormId: assignmentTarget.schedulingFormId ?? null,
          schedulingOfferingId: assignmentTarget.schedulingOfferingId ?? null,
          schedulingTimeSlotId: assignmentTarget.schedulingTimeSlotId ?? null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to assign coach')
      }
      setAssignmentTarget(null)
      setDrilldownKey((k) => k + 1)
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
          Assign coaches from the top-level program down to a specific timeslot. Drill into the hierarchy or use quick-assign at any level.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">New Assignment</h3>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,240px)_1fr_auto] lg:items-start">
          <select
            value={selectedCoachId}
            onChange={(e) => setSelectedCoachId(Number(e.target.value) || '')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
          >
            <option value="">Select coach</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}
          </select>

          <AdminCoachAssignmentDrilldown
            key={drilldownKey}
            onTargetChange={setAssignmentTarget}
          />

          <button
            type="button"
            onClick={() => void addAssignment()}
            disabled={saving || !selectedCoachId || !assignmentTarget}
            className="inline-flex items-center justify-center gap-2 bg-vortex-red text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-60 lg:self-end"
          >
            <Plus className="w-4 h-4" /> Assign
          </button>
        </div>
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
                  <span>{assignment.assignmentLabel || assignment.className || assignment.programName || assignment.programsName || 'Assignment'}</span>
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
