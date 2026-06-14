import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import {
  createDisciplineTag,
  deleteDisciplineTag,
  fetchDisciplineTags,
  fetchProgramDisciplineTags,
  linkProgramDisciplineTag,
  unlinkProgramDisciplineTag,
  type DisciplineTag,
} from '../../utils/programsApi'

interface Props {
  programId: number
  programDisplayName?: string | null
  showHeading?: boolean
}

const DisciplineTagPicker = ({
  programId,
  programDisplayName,
  showHeading = true,
}: Props) => {
  const [tags, setTags] = useState<DisciplineTag[]>([])
  const [assignedTags, setAssignedTags] = useState<DisciplineTag[]>([])
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const comboRef = useRef<HTMLDivElement>(null)

  const assignedIds = useMemo(
    () => new Set(assignedTags.map((t) => t.id)),
    [assignedTags],
  )

  const loadTags = useCallback(async () => {
    const data = await fetchDisciplineTags()
    setTags(data)
  }, [])

  const loadAssigned = useCallback(async () => {
    const assigned = await fetchProgramDisciplineTags(programId)
    setAssignedTags(assigned)
  }, [programId])

  useEffect(() => {
    setLoading(true)
    setSearch('')
    setDropdownOpen(false)
    Promise.all([loadTags(), loadAssigned()])
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load sport tags'))
      .finally(() => setLoading(false))
  }, [loadTags, loadAssigned])

  useEffect(() => {
    if (!dropdownOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [dropdownOpen])

  const filteredTags = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tags
    return tags.filter((t) => t.name.toLowerCase().includes(q))
  }, [tags, search])

  const canAddNew =
    search.trim().length > 0 &&
    !tags.some((t) => t.name.toLowerCase() === search.trim().toLowerCase())

  const assignTag = async (tag: DisciplineTag) => {
    setSaving(true)
    setError(null)
    try {
      await linkProgramDisciplineTag(programId, tag.id)
      setAssignedTags((prev) => [...prev, tag])
      setSearch('')
      setDropdownOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign tag')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectExisting = (tag: DisciplineTag) => {
    void assignTag(tag)
  }

  const handleAddNew = async () => {
    const name = search.trim()
    if (!name) return
    setSaving(true)
    setError(null)
    try {
      const created = await createDisciplineTag(name)
      setTags((prev) => {
        if (prev.some((t) => t.id === created.id)) return prev
        return [...prev, created]
      })
      await linkProgramDisciplineTag(programId, created.id)
      setAssignedTags((prev) => [...prev, created])
      setSearch('')
      setDropdownOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tag')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (tag: DisciplineTag) => {
    setRemovingId(tag.id)
    setError(null)
    try {
      await unlinkProgramDisciplineTag(programId, tag.id)
      setAssignedTags((prev) => prev.filter((t) => t.id !== tag.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove tag')
    } finally {
      setRemovingId(null)
    }
  }

  const handleDeleteTag = async (tag: DisciplineTag) => {
    setDeletingId(tag.id)
    setError(null)
    try {
      await deleteDisciplineTag(tag.id)
      setTags((prev) => prev.filter((t) => t.id !== tag.id))
      setAssignedTags((prev) => prev.filter((t) => t.id !== tag.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete tag')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading sport tags…</p>
  }

  return (
    <div className="space-y-2 w-full">
      {showHeading && (
        <div>
          <h3 className="text-lg font-bold text-black">Sport Tags</h3>
          <p className="text-sm text-gray-600 mt-1">
            Search and assign sport tags to{' '}
            <strong>{programDisplayName || 'this program'}</strong>. Tags are saved at the program
            level and shared by all classes under it.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 flex justify-between text-sm">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="relative" ref={comboRef}>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setDropdownOpen(true)
          }}
          onFocus={() => {
            setSearch('')
            setDropdownOpen(true)
          }}
          placeholder="Search sport tags…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        {dropdownOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredTags.length === 0 && !canAddNew ? (
              <p className="px-3 py-2 text-sm text-gray-500">
                {tags.length === 0
                  ? 'No sport tags yet. Type a name to add one.'
                  : `No tags match "${search.trim()}".`}
              </p>
            ) : (
              filteredTags.map((tag) => {
                const isAssigned = assignedIds.has(tag.id)
                return (
                  <div
                    key={tag.id}
                    className={`flex items-center gap-2 px-3 py-2 text-sm ${
                      isAssigned ? 'bg-red-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={saving || isAssigned}
                      className={`flex-1 min-w-0 text-left disabled:opacity-60 ${
                        isAssigned ? 'text-vortex-red font-medium cursor-default' : ''
                      }`}
                      onClick={() => handleSelectExisting(tag)}
                    >
                      {tag.name}
                      {isAssigned ? ' (assigned)' : ''}
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === tag.id || saving}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDeleteTag(tag)
                      }}
                      className="shrink-0 p-1 text-gray-400 hover:text-red-600 disabled:opacity-40"
                      aria-label={`Delete ${tag.name}`}
                      title="Delete tag"
                    >
                      {deletingId === tag.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )
              })
            )}
            {canAddNew && (
              <button
                type="button"
                disabled={saving}
                className="w-full text-left px-3 py-2 text-sm text-vortex-red hover:bg-red-50 inline-flex items-center gap-1 border-t border-gray-100 disabled:opacity-60"
                onClick={() => void handleAddNew()}
              >
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                Add &quot;{search.trim()}&quot;
              </button>
            )}
          </div>
        )}
      </div>

      {assignedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {assignedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-sm font-medium text-red-900"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => void handleRemove(tag)}
                disabled={removingId === tag.id}
                className="text-red-700 hover:text-red-900 disabled:opacity-40 p-0.5"
                aria-label={`Remove ${tag.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default DisciplineTagPicker
