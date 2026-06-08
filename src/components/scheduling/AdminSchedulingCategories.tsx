import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  adminCreateCategory,
  adminDeleteCategory,
  adminFetchAllCategories,
  type SchedulingCategory,
} from '../../utils/schedulingApi'

interface Props {
  onRefresh: () => Promise<void>
}

const AdminSchedulingCategories = ({ onRefresh }: Props) => {
  const [categories, setCategories] = useState<SchedulingCategory[]>([])
  const [name, setName] = useState('')
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

  const handleDelete = async (cat: SchedulingCategory) => {
    if (!confirm(`Delete "${cat.name}" globally? This removes it from all forms and deletes associated slots.`)) {
      return
    }
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
            <li key={cat.id} className="flex items-center justify-between px-4 py-3 bg-white">
              <span className="font-semibold text-black">{cat.name}</span>
              <button
                type="button"
                onClick={() => handleDelete(cat)}
                className="text-red-600 hover:text-red-800 p-1"
                aria-label={`Delete ${cat.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default AdminSchedulingCategories
