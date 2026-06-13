import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Users, Check, GitMerge, Trash2, X, School as SchoolIcon } from 'lucide-react'
import { schoolsApi, type School, type SchoolMember } from '../utils/adminFeaturesApi'

const LEVELS = [
  { value: 'high', label: 'High School' },
  { value: 'middle', label: 'Middle School' },
  { value: 'elementary', label: 'Elementary School' },
  { value: 'other', label: 'Other' },
]

function levelLabel(level: string | null) {
  return LEVELS.find((l) => l.value === level)?.label || 'Other'
}

export default function AdminSchools() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'verified' | 'writeins'>('verified')
  const [levelFilter, setLevelFilter] = useState<string>('all')

  const [rosterSchool, setRosterSchool] = useState<School | null>(null)
  const [roster, setRoster] = useState<SchoolMember[]>([])

  // add form
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLevel, setNewLevel] = useState('high')
  const [newLocation, setNewLocation] = useState('')

  // merge state: write-in id -> target id
  const [mergeTarget, setMergeTarget] = useState<Record<number, number>>({})

  const reload = async () => {
    try {
      setLoading(true)
      const all = await schoolsApi.list()
      setSchools(all)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schools')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const verified = useMemo(() => schools.filter((s) => s.isVerified), [schools])
  const writeIns = useMemo(() => schools.filter((s) => !s.isVerified), [schools])

  const filteredVerified = useMemo(
    () => (levelFilter === 'all' ? verified : verified.filter((s) => s.level === levelFilter)),
    [verified, levelFilter],
  )

  const openRoster = async (school: School) => {
    setRosterSchool(school)
    setRoster([])
    try {
      setRoster(await schoolsApi.members(school.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roster')
    }
  }

  const addSchool = async () => {
    if (!newName.trim()) return
    try {
      await schoolsApi.create({ name: newName.trim(), level: newLevel, location: newLocation.trim() || null })
      setNewName('')
      setNewLocation('')
      setShowAdd(false)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add school')
    }
  }

  const promote = async (school: School) => {
    try {
      await schoolsApi.verify(school.id, { level: school.level || 'other' })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to promote')
    }
  }

  const merge = async (school: School) => {
    const target = mergeTarget[school.id]
    if (!target) return
    try {
      await schoolsApi.merge(school.id, target)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to merge')
    }
  }

  const removeSchool = async (school: School) => {
    if (!confirm(`Delete "${school.name}"? This removes its student links.`)) return
    try {
      // deactivate or hard delete via merge-less path: use setActive false then DELETE not exposed; mark inactive
      await schoolsApi.setActive(school.id, false)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update school')
    }
  }

  return (
    <motion.div
      key="schools"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SchoolIcon className="w-7 h-7 text-vortex-red" />
            Schools
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Manage schools, view rosters, and resolve write-ins.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 self-start"
        >
          <Plus className="w-5 h-5" />
          Add school
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        {showAdd && (
          <div className="mx-4 md:mx-6 mt-4 p-4 border border-gray-200 rounded-lg grid grid-cols-1 md:grid-cols-[1fr_180px_1fr_auto] gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Level</label>
              <select value={newLevel} onChange={(e) => setNewLevel(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Location (optional)</label>
              <input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <button onClick={addSchool} disabled={!newName.trim()} className="px-4 py-2 rounded-lg bg-vortex-red text-white font-semibold disabled:opacity-50">
              Save
            </button>
          </div>
        )}

        <div className="px-4 md:px-6 mt-4 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('verified')}
          className={`px-4 py-2 font-semibold text-sm border-b-2 ${tab === 'verified' ? 'border-vortex-red text-black' : 'border-transparent text-gray-500'}`}
        >
          Schools ({verified.length})
        </button>
        <button
          onClick={() => setTab('writeins')}
          className={`px-4 py-2 font-semibold text-sm border-b-2 ${tab === 'writeins' ? 'border-vortex-red text-black' : 'border-transparent text-gray-500'}`}
        >
          Write-ins to review ({writeIns.length})
        </button>
      </div>

      <div className="p-4 md:p-6">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading…</div>
        ) : tab === 'verified' ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <label className="text-sm text-gray-600">Level</label>
              <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                <option value="all">All</option>
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div className="overflow-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Name</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Level</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Location</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Students</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Active</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVerified.map((s) => (
                    <tr key={s.id} className="border-t border-gray-100 even:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                      <td className="px-3 py-2 text-gray-700">{levelLabel(s.level)}</td>
                      <td className="px-3 py-2 text-gray-700">{s.location || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{s.memberCount ?? 0}</td>
                      <td className="px-3 py-2">{s.isActive ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={() => openRoster(s)} className="inline-flex items-center gap-1 text-vortex-red hover:underline mr-3">
                          <Users size={14} /> Roster
                        </button>
                        <button onClick={() => removeSchool(s)} className="text-gray-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredVerified.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-gray-500">No schools.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {writeIns.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No write-ins to review.</div>
            ) : (
              writeIns.map((s) => (
                <div key={s.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-600">{s.memberCount ?? 0} student(s) linked</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => promote(s)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold">
                      <Check size={14} /> Promote to official
                    </button>
                    <div className="flex items-center gap-1">
                      <select
                        value={mergeTarget[s.id] || ''}
                        onChange={(e) => setMergeTarget((prev) => ({ ...prev, [s.id]: Number(e.target.value) }))}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm max-w-[200px]"
                      >
                        <option value="">Merge into…</option>
                        {verified.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => merge(s)}
                        disabled={!mergeTarget[s.id]}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-semibold disabled:opacity-50"
                      >
                        <GitMerge size={14} /> Merge
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      </div>

      {/* Roster modal */}
      {rosterSchool && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRosterSchool(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold">{rosterSchool.name} — Students ({roster.length})</h3>
              <button onClick={() => setRosterSchool(null)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Name</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Email</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Phone</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Family</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((m) => (
                    <tr key={m.id} className="border-t border-gray-100 even:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900">{m.firstName} {m.lastName}</td>
                      <td className="px-3 py-2 text-gray-700">{m.email || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{m.phone || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{m.familyName || '—'}</td>
                    </tr>
                  ))}
                  {roster.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-gray-500">No students linked.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
