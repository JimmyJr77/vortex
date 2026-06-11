import { useCallback, useEffect, useState } from 'react'
import { Pencil, Trash2, X } from 'lucide-react'
import {
  adminCreateCategory,
  adminDeleteCategory,
  adminFetchAllCategories,
  adminUpdateCategory,
  type SchedulingCategory,
} from '../../utils/schedulingApi'

interface Props {
  onRefresh: () => Promise<void>
}

const AdminSchedulingCategories = ({ onRefresh }: Props) => {
  const [categories, setCategories] = useState<SchedulingCategory[]>([])
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadCategories = useCallback(async () => {
    const data = await adminFetchAllCategories()
    setCategories(data)
  }, [])

  useEffect(() => {
    loadCategories()
      .finally(() => setLoading(false))
  }, [loadCategories])

  const handleAdd = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await adminCreateCategory(name.trim())
      setName('')
      await loadCategories()
      await onRefresh()
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
    await adminDeleteCategory(cat.id)
    await loadCategories()
    await onRefresh()
  }

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading categories…</p>
  }

  return (
    <div className="max-w-lg space-y-4">
      <p className="text-gray-600 text-sm">
        Categories are shared across all scheduling forms (e.g. Freshmen, Sophomores, Upperclassmen).
      </p>
      <div className="flex gap-2">
        <input
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving}
          className="bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60"
        >
          Add
        </button>
      </div>
      {categories.length === 0 ? (
        <p className="text-gray-500 text-sm">No categories yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
          {categories.map((cat) => (
            <li key={cat.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-white">
              {editingId === cat.id ? (
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
                  <span className="font-semibold text-black">{cat.name}</span>
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
          ))}
        </ul>
      )}
    </div>
  )
}

export default AdminSchedulingCategories
