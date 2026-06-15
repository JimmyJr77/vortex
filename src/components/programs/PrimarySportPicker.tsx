import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { createDisciplineTag, fetchDisciplineTags, type DisciplineTag } from '../../utils/programsApi'

function normalizeTagId(id: number | string | null | undefined): number | null {
  if (id == null) return null
  const n = Number(id)
  return Number.isFinite(n) ? n : null
}

interface Props {
  value: number | null
  onChange: (tagId: number | null) => void
  disabled?: boolean
  /** Shown when value is set but the tag list has not resolved it yet (e.g. stale id). */
  selectedLabel?: string | null
}

const PrimarySportPicker = ({ value, onChange, disabled = false, selectedLabel = null }: Props) => {
  const [tags, setTags] = useState<DisciplineTag[]>([])
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const comboRef = useRef<HTMLDivElement>(null)

  const normalizedValue = useMemo(() => normalizeTagId(value), [value])

  const selectedTag = useMemo(
    () => tags.find((t) => t.id === normalizedValue) ?? null,
    [tags, normalizedValue],
  )

  const loadTags = useCallback(async () => {
    const data = await fetchDisciplineTags()
    setTags(data)
  }, [])

  useEffect(() => {
    setLoading(true)
    loadTags()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load sport tags'))
      .finally(() => setLoading(false))
  }, [loadTags])

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

  const handleSelect = (tag: DisciplineTag) => {
    onChange(tag.id)
    setSearch('')
    setDropdownOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setSearch('')
    setDropdownOpen(false)
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
      onChange(created.id)
      setSearch('')
      setDropdownOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tag')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading sports…</p>
  }

  const displayValue = dropdownOpen
    ? search
    : selectedTag?.name ?? selectedLabel ?? (normalizedValue == null ? 'No primary sport' : '')

  return (
    <div className="space-y-2 w-full">
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
          value={displayValue}
          disabled={disabled}
          onChange={(e) => {
            setSearch(e.target.value)
            setDropdownOpen(true)
          }}
          onFocus={() => {
            setSearch(selectedTag?.name ?? '')
            setDropdownOpen(true)
          }}
          placeholder="Search sports…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
        />
        {dropdownOpen && !disabled && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            <button
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                normalizedValue == null ? 'bg-red-50 text-vortex-red font-medium' : ''
              }`}
              onClick={handleClear}
            >
              No primary sport
            </button>
            {filteredTags.length === 0 && !canAddNew ? (
              <p className="px-3 py-2 text-sm text-gray-500">
                {tags.length === 0
                  ? 'No sports yet. Type a name to add one.'
                  : `No sports match "${search.trim()}".`}
              </p>
            ) : (
              filteredTags.map((tag) => {
                const isSelected = normalizedValue === tag.id
                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={saving}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60 ${
                      isSelected ? 'bg-red-50 text-vortex-red font-medium' : ''
                    }`}
                    onClick={() => handleSelect(tag)}
                  >
                    {tag.name}
                  </button>
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
    </div>
  )
}

export default PrimarySportPicker
