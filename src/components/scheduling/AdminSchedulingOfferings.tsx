import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Loader2, Pencil, Trash2 } from 'lucide-react'
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
import { formatSetupContextLine } from './SchedulingSetupContextCard'

type DurationMode = 'session' | 'evergreen'

interface Props {
  formId: number
  classDisplayName: string
  selectedOfferingId: number | null
  onOfferingSelect: (offering: SchedulingOffering | null) => void
  onContinueToSlots?: () => void
  onOfferingSaved?: () => void | Promise<void>
}

const AdminSchedulingOfferings = ({
  formId,
  classDisplayName,
  selectedOfferingId,
  onOfferingSelect,
  onContinueToSlots,
  onOfferingSaved,
}: Props) => {
  const [offerings, setOfferings] = useState<SchedulingOffering[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
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
    setValidationError(null)
  }

  const getDraftValidation = (): string | null => {
    if (!draft.startDate) return 'Start date is required.'
    if (durationMode === 'session') {
      if (!draft.endDate) return 'End date is required for session offerings.'
      if (draft.endDate < draft.startDate) {
        return 'End date must be on or after the start date.'
      }
    }
    return null
  }

  const draftValidation = getDraftValidation()
  const endInPast =
    durationMode === 'session' &&
    Boolean(draft.endDate) &&
    draft.endDate < new Date().toISOString().slice(0, 10)

  const canSave =
    Boolean(draft.startDate) && (durationMode === 'evergreen' || Boolean(draft.endDate)) && !draftValidation

  const handleSave = async () => {
    const validation = getDraftValidation()
    if (validation) {
      setValidationError(validation)
      return
    }
    if (endInPast) {
      const ok = window.confirm(
        'This offering ends in the past. Associated timeslots may appear expired. Save anyway?',
      )
      if (!ok) return
    }
    setSaving(true)
    setError(null)
    setValidationError(null)
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
        const updated = await adminUpdateOffering(editId, payload)
        resetDraft()
        await loadOfferings()
        if (selectedOfferingId === editId) {
          onOfferingSelect(updated)
        }
        await onOfferingSaved?.()
      } else {
        const created = await adminCreateOffering(formId, payload)
        const selected = await adminSelectOffering(created.id)
        onOfferingSelect(selected)
        resetDraft()
        await loadOfferings()
        onContinueToSlots?.()
      }
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
      {validationError && <p className="text-sm text-red-600">{validationError}</p>}

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
                min={draft.startDate || undefined}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, endDate: e.target.value }))
                  setValidationError(null)
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {draft.endDate && draft.startDate && draft.endDate < draft.startDate && (
                <p className="text-xs text-red-600 mt-1">
                  End date must be on or after the start date.
                </p>
              )}
              {endInPast && !(draft.endDate && draft.startDate && draft.endDate < draft.startDate) && (
                <p className="text-xs text-amber-700 mt-1">
                  This end date is in the past — you will be asked to confirm before saving.
                </p>
              )}
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
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Click an offering to manage its timeslots.</p>
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
            {offerings.map((o) => {
              const isSelected = selectedOfferingId === o.id
              return (
                <li
                  key={o.id}
                  className={`flex items-center gap-1 px-2 py-2 ${isSelected ? 'bg-red-50' : 'bg-white'}`}
                >
                  <button
                    type="button"
                    onClick={() => void handleSelect(o)}
                    disabled={saving}
                    className="flex-1 flex items-center justify-between gap-4 min-w-0 px-2 py-1 text-left hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-black">
                        {formatSetupContextLine([
                          classDisplayName,
                          formatOfferingDateRange(o),
                        ])}
                      </p>
                      {o.label ? (
                        <p className="text-sm text-gray-600 mt-0.5">{o.label}</p>
                      ) : (
                        <p className="text-sm text-gray-400 mt-0.5 italic">No label</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                  <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={iconBtn}
                      onClick={() => startEdit(o)}
                      title="Edit"
                      disabled={saving}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className={`${iconBtn} hover:text-red-700`}
                      onClick={() => void handleDelete(o)}
                      title="Delete"
                      disabled={saving}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default AdminSchedulingOfferings
