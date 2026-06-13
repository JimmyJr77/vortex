import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Search, Trash2, X } from 'lucide-react'
import {
  adminCreateCategory,
  adminDeleteCategory,
  adminFetchAllCategories,
  adminUpdateCategory,
  type CategorySelection,
  type SchedulingCategory,
} from '../../utils/schedulingApi'

interface Props {
  selectedCategory: CategorySelection
  onSelectCategory: (selection: CategorySelection) => void
  onRefresh: () => Promise<void>
}

const NO_CATEGORY_LABEL = 'No Category'

const AdminSchedulingCategories = ({ selectedCategory, onSelectCategory, onRefresh }: Props) => {
  const [categories, setCategories] = useState<SchedulingCategory[]>([])
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadCategories = useCallback(async () => {
    const data = await adminFetchAllCategories()
    setCategories(data)
  }, [])

  useEffect(() => {
    loadCategories().finally(() => setLoading(false))
  }, [loadCategories])

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, search])

  const selectedCategoryName =
    selectedCategory === 'none'
      ? NO_CATEGORY_LABEL
      : typeof selectedCategory === 'number'
        ? (categories.find((c) => c.id === selectedCategory)?.name ?? null)
        : null

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const created = await adminCreateCategory(newName.trim())
      setNewName('')
      await loadCategories()
      await onRefresh()
      onSelectCategory(created.id)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (cat: SchedulingCategory) => {
    setEditingId(cat.id)
    setEditName(cat.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const handleSaveEdit = async () => {
    if (editingId == null || !editName.trim()) return
    setSaving(true)
    try {
      await adminUpdateCategory(editingId, editName.trim())
      cancelEdit()
      await loadCategories()
      await onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cat: SchedulingCategory) => {
    if (!confirm(`Delete "${cat.name}" globally? This removes it from all forms and deletes associated slots.`)) {
      return
    }
    if (editingId === cat.id) cancelEdit()
    if (selectedCategory === cat.id) onSelectCategory(null)
    await adminDeleteCategory(cat.id)
    await loadCategories()
    await onRefresh()
  }

  const handleSelectNone = () => {
    onSelectCategory(selectedCategory === 'none' ? null : 'none')
  }

  const handleSelect = (cat: SchedulingCategory) => {
    if (editingId === cat.id) return
    onSelectCategory(selectedCategory === cat.id ? null : cat.id)
  }

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading categories…</p>
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <h3 className="text-lg font-bold text-black">Categories</h3>
        <p className="text-sm text-gray-600 mt-1">
          Search, edit, and select a category — or choose <strong>No Category</strong>. Your selection is used in Offerings and Slots.
        </p>
      </div>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          selectedCategoryName
            ? 'border-red-200 bg-red-50 text-red-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
      >
        {selectedCategoryName ? (
          <span>
            Selected: <strong>{selectedCategoryName}</strong>
          </span>
        ) : (
          <span>Select <strong>No Category</strong> or a category below to use in Offerings and Slots.</span>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          placeholder="Search categories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5"
        />
      </div>

      <div className="flex gap-2">
        <input
          placeholder="New category name"
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
        <li
          className={`flex items-center gap-3 px-4 py-3 transition-colors ${
            selectedCategory === 'none' ? 'bg-red-50' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <button
            type="button"
            onClick={handleSelectNone}
            className="flex-1 flex items-center gap-2 text-left min-w-0"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                selectedCategory === 'none'
                  ? 'border-vortex-red bg-vortex-red text-white'
                  : 'border-gray-300 bg-white'
              }`}
              aria-hidden
            >
              {selectedCategory === 'none' && <Check className="w-3 h-3" />}
            </span>
            <span
              className={`font-semibold truncate ${
                selectedCategory === 'none' ? 'text-vortex-red' : 'text-gray-700'
              }`}
            >
              {NO_CATEGORY_LABEL}
            </span>
          </button>
        </li>

        {categories.length === 0 ? (
          <li className="px-4 py-3 text-gray-500 text-sm bg-white">No named categories yet. Add one above.</li>
        ) : filteredCategories.length === 0 ? (
          <li className="px-4 py-3 text-gray-500 text-sm bg-white">
            No categories match &ldquo;{search.trim()}&rdquo;.
          </li>
        ) : (
          filteredCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id
            const isEditing = editingId === cat.id

            return (
              <li
                key={cat.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                  isSelected ? 'bg-red-50' : 'bg-white hover:bg-gray-50'
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
                      onClick={() => handleSelect(cat)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-vortex-red bg-vortex-red text-white'
                            : 'border-gray-300 bg-white'
                        }`}
                        aria-hidden
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </span>
                      <span className={`font-semibold truncate ${isSelected ? 'text-vortex-red' : 'text-black'}`}>
                        {cat.name}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="text-gray-600 hover:text-black p-1"
                        aria-label={`Edit ${cat.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        className="text-red-600 hover:text-red-800 p-1"
                        aria-label={`Delete ${cat.name}`}
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

export default AdminSchedulingCategories
