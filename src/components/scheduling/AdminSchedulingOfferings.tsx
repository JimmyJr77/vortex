import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import {
  adminCreateOffering,
  adminDeleteOffering,
  adminFetchOfferings,
  adminSelectOffering,
  adminUpdateOffering,
  formatOfferingDateRange,
  type SchedulingOffering,
} from '../../utils/schedulingApi'
import { dateInputValue } from '../../utils/dateUtils'

type DurationMode = 'session' | 'evergreen'

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
  const [durationMode, setDurationMode] = useState<DurationMode>('session')
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
    setDurationMode('session')
    setEditId(null)
  }

  const canSave =
    Boolean(draft.startDate) && (durationMode === 'evergreen' || Boolean(draft.endDate))

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const payload: {
        startDate: string
        label: string | null
        evergreen?: boolean
        endDate?: string
      } = {
        startDate: draft.startDate,
        label: draft.label || null,
      }
      if (durationMode === 'evergreen') {
        payload.evergreen = true
      } else {
        payload.endDate = draft.endDate
      }
      if (editId) {
        await adminUpdateOffering(editId, payload)
      } else {
        await adminCreateOffering(formId, payload)
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
    const datesLabel = formatOfferingDateRange(offering)
    if (!confirm(`Delete offering "${offering.label || datesLabel}"?`)) {
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
    const evergreen = offering.evergreen || !offering.endDate
    setEditId(offering.id)
    setDurationMode(evergreen ? 'evergreen' : 'session')
    setDraft({
      startDate: dateInputValue(offering.startDate) || offering.startDate,
      endDate: evergreen ? '' : dateInputValue(offering.endDate ?? '') || offering.endDate || '',
      label: offering.label || '',
    })
  }

  const durationBtn = (mode: DurationMode, label: string, hint: string) => {
    const active = durationMode === mode
    return (
      <button
        type="button"
        onClick={() => setDurationMode(mode)}
        className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
          active
            ? 'border-vortex-red bg-red-50 text-gray-900 ring-1 ring-vortex-red'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span className="font-semibold block">{label}</span>
        <span className="text-xs text-gray-500">{hint}</span>
      </button>
    )
  }

  return (
    <div className="space-y-6 w-full">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
        {editId != null && (
          <p className="text-sm font-semibold text-gray-800">Editing offering</p>
        )}
        <div>
          <label className="block text-xs font-semibold mb-2">Offering type</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {durationBtn('session', 'Session dates', 'Fixed start and end dates')}
            {durationBtn('evergreen', 'Evergreen class', 'No end date — runs ongoing')}
          </div>
        </div>
        <div className={`grid gap-3 ${durationMode === 'session' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div>
            <label className="block text-xs font-semibold mb-1">
              {durationMode === 'evergreen' ? 'Starts on' : 'Start date'}
            </label>
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {durationMode === 'session' && (
            <div>
              <label className="block text-xs font-semibold mb-1">End date</label>
              <input
                type="date"
                value={draft.endDate}
                onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Label (optional)</label>
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder={durationMode === 'evergreen' ? 'e.g. Year-round enrollment' : 'e.g. Summer 2026'}
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
            onClick={() => void handleSave()}
            disabled={saving || !canSave}
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
                        onChange={() => void handleSelect(o)}
                        disabled={saving}
                        title="Select for slot building"
                      />
                    </td>
                    <td className="py-2 px-4">{formatOfferingDateRange(o)}</td>
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
                          onClick={() => void handleDelete(o)}
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
