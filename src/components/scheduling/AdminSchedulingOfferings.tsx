import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import {
  adminCreateOffering,
  adminDeleteOffering,
  adminFetchOfferings,
  adminSelectOffering,
  adminUpdateOffering,
  type SchedulingOffering,
} from '../../utils/schedulingApi'
import { dateInputValue } from '../../utils/dateUtils'

interface Props {
  formId: number
  selectedOfferingId: number | null
  onOfferingSelect: (offering: SchedulingOffering | null) => void
  onContinueToSlots?: () => void
}

const AdminSchedulingOfferings = ({
  formId,
  selectedOfferingId,
  onOfferingSelect,
  onContinueToSlots,
}: Props) => {
  const [offerings, setOfferings] = useState<SchedulingOffering[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState({ startDate: '', endDate: '', label: '' })

  const loadOfferings = useCallback(async () => {
    const data = await adminFetchOfferings(formId)
    setOfferings(data)
  }, [formId])

  useEffect(() => {
    setLoading(true)
    loadOfferings()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load offerings'))
      .finally(() => setLoading(false))
  }, [loadOfferings])

  // Default to the selected (or first) offering when nothing is selected yet.
  useEffect(() => {
    if (selectedOfferingId) return
    if (offerings.length === 0) return
    const fallback = offerings.find((o) => o.isSelected) ?? offerings[0]
    if (fallback) onOfferingSelect(fallback)
  }, [offerings, selectedOfferingId, onOfferingSelect])

  const iconBtn =
    'p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 disabled:opacity-40'

  const resetDraft = () => {
    setDraft({ startDate: '', endDate: '', label: '' })
    setEditId(null)
  }

  const handleSave = async () => {
    if (!draft.startDate || !draft.endDate) return
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
      onContinueToSlots?.()
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
  }

  return (
    <div className="space-y-6 w-full">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
        {editId != null && (
          <p className="text-sm font-semibold text-gray-800">Editing offering</p>
        )}
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
          {editId != null && (
            <button type="button" onClick={resetDraft} className="px-3 py-1.5 text-sm text-gray-600">
              Cancel
            </button>
          )}
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

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : offerings.length === 0 ? (
        <p className="text-sm text-gray-500">No offerings yet for this class.</p>
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
              {offerings.map((o) => {
                const isChecked = selectedOfferingId === o.id
                return (
                  <tr
                    key={o.id}
                    className={`border-t border-gray-100 ${isChecked ? 'bg-red-50' : ''}`}
                  >
                    <td className="py-2 px-4">
                      <input
                        type="radio"
                        name="selected-offering"
                        checked={isChecked}
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AdminSchedulingOfferings
