import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Search, Trash2, X } from 'lucide-react'
import {
  createDisciplineTag,
  deleteDisciplineTag,
  fetchDisciplineTags,
  fetchProgramDisciplineTags,
  linkProgramDisciplineTag,
  unlinkProgramDisciplineTag,
  updateDisciplineTag,
  type DisciplineTag,
} from '../../utils/programsApi'

interface Props {
  programId: number
  programDisplayName?: string | null
}

const AdminSchedulingDisciplineTags = ({ programId, programDisplayName }: Props) => {
  const [tags, setTags] = useState<DisciplineTag[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTags = useCallback(async () => {
    const data = await fetchDisciplineTags()
    setTags(data)
  }, [])

  const loadAssigned = useCallback(async () => {
    const assigned = await fetchProgramDisciplineTags(programId)
    setAssignedIds(new Set(assigned.map((t) => t.id)))
  }, [programId])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadTags(), loadAssigned()])
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load discipline tags'))
      .finally(() => setLoading(false))
  }, [loadTags, loadAssigned])

  const filteredTags = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tags
    return tags.filter((t) => t.name.toLowerCase().includes(q))
  }, [tags, search])

  const assignedCount = useMemo(
    () => tags.filter((t) => assignedIds.has(t.id)).length,
    [tags, assignedIds],
  )

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const created = await createDisciplineTag(newName.trim())
      setNewName('')
      await loadTags()
      await linkProgramDisciplineTag(programId, created.id)
      setAssignedIds((prev) => new Set(prev).add(created.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tag')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (tag: DisciplineTag) => {
    if (editingId === tag.id) return
    const isAssigned = assignedIds.has(tag.id)
    setTogglingId(tag.id)
    setError(null)
    try {
      if (isAssigned) {
        await unlinkProgramDisciplineTag(programId, tag.id)
        setAssignedIds((prev) => {
          const next = new Set(prev)
          next.delete(tag.id)
          return next
        })
      } else {
        await linkProgramDisciplineTag(programId, tag.id)
        setAssignedIds((prev) => new Set(prev).add(tag.id))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update tag')
    } finally {
      setTogglingId(null)
    }
  }

  const startEdit = (tag: DisciplineTag) => {
    setEditingId(tag.id)
    setEditName(tag.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const handleSaveEdit = async () => {
    if (editingId == null || !editName.trim()) return
    setSaving(true)
    setError(null)
    try {
      await updateDisciplineTag(editingId, editName.trim())
      cancelEdit()
      await loadTags()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update tag')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tag: DisciplineTag) => {
    if (!confirm(`Delete "${tag.name}" globally? This removes it from all programs.`)) {
      return
    }
    if (editingId === tag.id) cancelEdit()
    setError(null)
    try {
      await deleteDisciplineTag(tag.id)
      setAssignedIds((prev) => {
        const next = new Set(prev)
        next.delete(tag.id)
        return next
      })
      await loadTags()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete tag')
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading discipline tags…</p>
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <h3 className="text-lg font-bold text-black">Discipline Tags</h3>
        <p className="text-sm text-gray-600 mt-1">
          Search, create, edit, and assign discipline tags to{' '}
          <strong>{programDisplayName || 'this program'}</strong>. Tags help organize classes
          across sport disciplines and are saved at the program level.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 flex justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          assignedCount > 0
            ? 'border-red-200 bg-red-50 text-red-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
      >
        {assignedCount > 0 ? (
          <span>
            <strong>{assignedCount}</strong> discipline tag{assignedCount === 1 ? '' : 's'} assigned
            to this program.
          </span>
        ) : (
          <span>Select one or more tags below to associate them with this program.</span>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          placeholder="Search discipline tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5"
        />
      </div>

      <div className="flex gap-2">
        <input
          placeholder="New discipline tag name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !newName.trim()}
          className="bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60 shrink-0"
        >
          Add
        </button>
      </div>

      <ul className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
        {tags.length === 0 ? (
          <li className="px-4 py-3 text-gray-500 text-sm bg-white">
            No discipline tags yet. Add one above.
          </li>
        ) : filteredTags.length === 0 ? (
          <li className="px-4 py-3 text-gray-500 text-sm bg-white">
            No tags match &ldquo;{search.trim()}&rdquo;.
          </li>
        ) : (
          filteredTags.map((tag) => {
            const isAssigned = assignedIds.has(tag.id)
            const isEditing = editingId === tag.id

            return (
              <li
                key={tag.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                  isAssigned ? 'bg-red-50' : 'bg-white hover:bg-gray-50'
                }`}
              >
                {isEditing ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      autoFocus
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-black font-semibold"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={saving || !editName.trim()}
                        className="text-green-700 hover:text-green-900 px-2 py-1 text-sm font-semibold disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-gray-500 hover:text-gray-700 p-1"
                        aria-label="Cancel edit"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggle(tag)}
                      disabled={togglingId === tag.id}
                      className="flex-1 flex items-center gap-2 text-left min-w-0 disabled:opacity-60"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          isAssigned
                            ? 'border-vortex-red bg-vortex-red text-white'
                            : 'border-gray-300 bg-white'
                        }`}
                        aria-hidden
                      >
                        {isAssigned && <Check className="w-3 h-3" />}
                      </span>
                      <span
                        className={`font-semibold truncate ${isAssigned ? 'text-vortex-red' : 'text-black'}`}
                      >
                        {tag.name}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(tag)}
                        className="text-gray-600 hover:text-black p-1"
                        aria-label={`Edit ${tag.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tag)}
                        className="text-red-600 hover:text-red-800 p-1"
                        aria-label={`Delete ${tag.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

export default AdminSchedulingDisciplineTags
