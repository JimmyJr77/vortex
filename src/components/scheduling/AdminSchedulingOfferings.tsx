import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  adminCreateOffering,
  adminDeleteOffering,
  adminFetchAllCategories,
  adminFetchOfferings,
  adminSelectOffering,
  adminUpdateOffering,
  type CategorySelection,
  type SchedulingCategory,
  type SchedulingOffering,
} from '../../utils/schedulingApi'
import { dateInputValue } from '../../utils/dateUtils'

interface Props {
  formId: number
  selectedCategory: CategorySelection
  selectedOfferingId: number | null
  onOfferingSelect: (offering: SchedulingOffering | null) => void
}

const categoryApiId = (selection: CategorySelection): number | null | undefined => {
  if (selection === null) return undefined
  if (selection === 'none') return null
  return selection
}

const AdminSchedulingOfferings = ({
  formId,
  selectedCategory,
  selectedOfferingId,
  onOfferingSelect,
}: Props) => {
  const [categories, setCategories] = useState<SchedulingCategory[]>([])
  const [offerings, setOfferings] = useState<SchedulingOffering[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState({ startDate: '', endDate: '', label: '' })

  const loadCategories = useCallback(async () => {
    const data = await adminFetchAllCategories()
    setCategories(data.filter((c) => c.isActive))
  }, [])

  const apiCategoryId = categoryApiId(selectedCategory)

  const loadOfferings = useCallback(async () => {
    if (selectedCategory === null) {
      setOfferings([])
      return
    }
    const data = await adminFetchOfferings(formId, apiCategoryId ?? null)
    setOfferings(data)
  }, [formId, selectedCategory, apiCategoryId])

  useEffect(() => {
    loadCategories()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load categories'))
      .finally(() => setLoading(false))
  }, [loadCategories])

  useEffect(() => {
    if (selectedCategory === null) return
    setLoading(true)
    loadOfferings()
      .then(() => {
        if (selectedOfferingId) return
        adminFetchOfferings(formId, apiCategoryId ?? null).then((data) => {
          const sel = data.find((o) => o.isSelected)
          if (sel) onOfferingSelect(sel)
        })
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load offerings'))
      .finally(() => setLoading(false))
  }, [selectedCategory, apiCategoryId, loadOfferings, formId, selectedOfferingId, onOfferingSelect])

  const iconBtn =
    'p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 disabled:opacity-40'

  const resetDraft = () => {
    setDraft({ startDate: '', endDate: '', label: '' })
    setShowAdd(false)
    setEditId(null)
  }

  const handleSave = async () => {
    if (selectedCategory === null || !draft.startDate || !draft.endDate) return
    setSaving(true)
    setError(null)
    try {
      if (editId) {
        await adminUpdateOffering(editId, {
          startDate: draft.startDate,
          endDate: draft.endDate,
          label: draft.label || null,
        })
      } else {
        await adminCreateOffering(formId, {
          categoryId: apiCategoryId ?? null,
          startDate: draft.startDate,
          endDate: draft.endDate,
          label: draft.label || null,
        })
      }
      resetDraft()
      await loadOfferings()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save offering')
    } finally {
      setSaving(false)
    }
  }

  const handleSelect = async (offering: SchedulingOffering) => {
    setSaving(true)
    try {
      const updated = await adminSelectOffering(offering.id)
      onOfferingSelect(updated)
      await loadOfferings()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select offering')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (offering: SchedulingOffering) => {
    if (!confirm(`Delete offering "${offering.label || `${offering.startDate} – ${offering.endDate}`}"?`)) {
      return
    }
    setSaving(true)
    try {
      await adminDeleteOffering(offering.id)
      if (selectedOfferingId === offering.id) onOfferingSelect(null)
      await loadOfferings()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (offering: SchedulingOffering) => {
    setEditId(offering.id)
    setDraft({
      startDate: dateInputValue(offering.startDate) || offering.startDate,
      endDate: dateInputValue(offering.endDate) || offering.endDate,
      label: offering.label || '',
    })
    setShowAdd(true)
  }

  const selectedCategoryName =
    selectedCategory === 'none'
      ? 'No Category'
      : typeof selectedCategory === 'number'
        ? categories.find((c) => c.id === selectedCategory)?.name
        : undefined

  if (loading && categories.length === 0 && selectedCategory !== 'none') {
    return <p className="text-gray-500 text-sm">Loading…</p>
  }

  if (selectedCategory === null) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div>
          <h3 className="text-lg font-bold text-black">Offerings</h3>
          <p className="text-sm text-gray-600 mt-1">
            Date ranges per category. Select a category in the <strong>Categories</strong> tab first.
          </p>
        </div>
        <p className="text-gray-600 py-4">
          No category selected. Go to <strong>Categories</strong>, search or pick one from the list, then return here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-bold text-black">Offerings</h3>
        <p className="text-sm text-gray-600 mt-1">
          Date ranges for <strong>{selectedCategoryName ?? 'selected category'}</strong>. Select one offering to build slots.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                resetDraft()
                setShowAdd(true)
              }}
              className="p-2 rounded-lg bg-vortex-red text-white hover:bg-red-700"
              title="Add offering dates"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {showAdd && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Start date</label>
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">End date</label>
                  <input
                    type="date"
                    value={draft.endDate}
                    onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={draft.label}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                  placeholder="e.g. Summer 2026"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={resetDraft} className="px-3 py-1.5 text-sm text-gray-600">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !draft.startDate || !draft.endDate}
                  className="px-4 py-1.5 text-sm bg-vortex-red text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editId ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : offerings.length === 0 ? (
            <p className="text-sm text-gray-500">No offerings yet for this category.</p>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="py-2 px-4 font-medium w-8" />
                    <th className="py-2 px-4 font-medium">Dates</th>
                    <th className="py-2 px-4 font-medium">Label</th>
                    <th className="py-2 px-4 font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {offerings.map((o) => (
                    <tr
                      key={o.id}
                      className={`border-t border-gray-100 ${o.isSelected ? 'bg-red-50' : ''}`}
                    >
                      <td className="py-2 px-4">
                        <input
                          type="radio"
                          name="selected-offering"
                          checked={o.isSelected}
                          onChange={() => handleSelect(o)}
                          disabled={saving}
                          title="Select for slot building"
                        />
                      </td>
                      <td className="py-2 px-4">
                        {o.startDate} – {o.endDate}
                      </td>
                      <td className="py-2 px-4 text-gray-600">{o.label || '—'}</td>
                      <td className="py-2 px-4">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className={iconBtn}
                            onClick={() => startEdit(o)}
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className={`${iconBtn} hover:text-red-700`}
                            onClick={() => handleDelete(o)}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
    </div>
  )
}

export default AdminSchedulingOfferings
