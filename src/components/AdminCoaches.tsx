import { useCallback, useEffect, useState } from 'react'
import { Archive, Edit2, Loader2, Plus, Trash2 } from 'lucide-react'
import { adminApiRequest } from '../utils/api'
import AdminCoachAssignmentDrilldown, { type CoachAssignmentTarget } from './AdminCoachAssignmentDrilldown'

interface Coach {
  id: number
  full_name: string
  email?: string | null
  phone?: string | null
  bio?: string | null
  coach_active: boolean
  account_active?: boolean
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

interface AdminCoachesProps {
  isMasterAdmin?: boolean
}

export default function AdminCoaches({ isMasterAdmin = false }: AdminCoachesProps) {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState<number | ''>('')
  const [assignmentTarget, setAssignmentTarget] = useState<CoachAssignmentTarget | null>(null)
  const [drilldownKey, setDrilldownKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null)
  const [editBio, setEditBio] = useState('')
  const [deleteCoach, setDeleteCoach] = useState<Coach | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

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

  const saveCoachProfile = async () => {
    if (!editingCoach) return
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest(`/api/admin/coaches/${editingCoach.id}/profile`, {
        method: 'PUT',
        body: JSON.stringify({ bio: editBio, isActive: editingCoach.coach_active }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to update coach profile')
      }
      setEditingCoach(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update coach profile')
    } finally {
      setSaving(false)
    }
  }

  const archiveCoach = async (coach: Coach) => {
    const isActive = coach.account_active === false
    if (isActive && !confirm(`Archive ${coach.full_name}? They will lose login access.`)) return
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest(`/api/admin/access/users/${coach.id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to archive coach')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive coach')
    } finally {
      setSaving(false)
    }
  }

  const deleteCoachAccount = async () => {
    if (!deleteCoach || deleteConfirmText.toLowerCase().trim() !== 'delete') {
      alert('Please type "delete" to confirm')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest(`/api/admin/access/users/${deleteCoach.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to delete coach')
      }
      setDeleteCoach(null)
      setDeleteConfirmText('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete coach')
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
          Assign coaches from the top-level program down to a specific timeslot. Master admins can edit, archive, and permanently delete coach accounts.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">New Assignment</h3>
        <AdminCoachAssignmentDrilldown
          key={drilldownKey}
          onTargetChange={setAssignmentTarget}
          coachControl={
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(Number(e.target.value) || '')}
              className="border border-gray-300 rounded-lg px-3 text-sm w-full h-10 bg-white"
            >
              <option value="">Select coach</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
              ))}
            </select>
          }
          actionControl={
            <button
              type="button"
              onClick={() => void addAssignment()}
              disabled={saving || !selectedCoachId || !assignmentTarget}
              className="inline-flex items-center justify-center gap-2 h-10 bg-vortex-red text-white rounded-lg px-4 font-semibold disabled:opacity-60 whitespace-nowrap w-full lg:w-auto"
            >
              <Plus className="w-4 h-4" /> Assign
            </button>
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {coaches.map((coach) => {
          const accountActive = coach.account_active !== false
          return (
            <div key={coach.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">{coach.full_name}</h3>
                  <p className="text-sm text-gray-500">{coach.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-1 text-xs ${coach.coach_active && accountActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {coach.coach_active && accountActive ? 'Active' : 'Archived'}
                  </span>
                  {isMasterAdmin && (
                    <div className="flex gap-1 mt-1">
                      <button
                        type="button"
                        title="Edit coach"
                        onClick={() => {
                          setEditingCoach(coach)
                          setEditBio(coach.bio || '')
                        }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title={accountActive ? 'Archive coach' : 'Unarchive coach'}
                        onClick={() => void archiveCoach(coach)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete coach permanently"
                        onClick={() => {
                          setDeleteCoach(coach)
                          setDeleteConfirmText('')
                        }}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {coach.bio && <p className="text-sm text-gray-600 mt-2">{coach.bio}</p>}
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
          )
        })}
      </section>

      {editingCoach && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Edit Coach — {editingCoach.full_name}</h3>
            <p className="text-xs text-gray-500">
              Update coach bio here. For name, email, or password changes, use the Access tab.
            </p>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              rows={4}
              placeholder="Coach bio"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => void saveCoachProfile()} disabled={saving} className="flex-1 bg-vortex-red text-white rounded-lg py-2 font-semibold">
                Save
              </button>
              <button type="button" onClick={() => setEditingCoach(null)} className="flex-1 bg-gray-200 rounded-lg py-2 font-semibold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCoach && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-red-600">Delete Coach</h3>
            <p className="text-sm text-gray-700">
              Permanently delete <strong>{deleteCoach.full_name}</strong> and all assignments?
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type delete to confirm"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void deleteCoachAccount()}
                disabled={deleteConfirmText.toLowerCase().trim() !== 'delete' || saving}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 font-semibold disabled:opacity-50"
              >
                Delete
              </button>
              <button type="button" onClick={() => setDeleteCoach(null)} className="flex-1 bg-gray-200 rounded-lg py-2 font-semibold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
