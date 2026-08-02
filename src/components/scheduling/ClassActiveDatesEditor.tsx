import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { adminUpdateFormActiveDates } from '../../utils/schedulingApi'
import { dateInputValue } from '../../utils/dateUtils'

type DurationMode = 'session' | 'evergreen'

interface Props {
  formId: number
  startDate: string | null | undefined
  endDate: string | null | undefined
  onSaved: (next: { startDate: string; endDate: string | null }) => void | Promise<void>
  /** Compact layout for embedding above timeslots */
  embedded?: boolean
}

const ClassActiveDatesEditor = ({
  formId,
  startDate,
  endDate,
  onSaved,
  embedded = false,
}: Props) => {
  const [durationMode, setDurationMode] = useState<DurationMode>(endDate ? 'session' : 'evergreen')
  const [draftStart, setDraftStart] = useState(dateInputValue(startDate) || '')
  const [draftEnd, setDraftEnd] = useState(dateInputValue(endDate) || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDurationMode(endDate ? 'session' : 'evergreen')
    setDraftStart(dateInputValue(startDate) || '')
    setDraftEnd(dateInputValue(endDate) || '')
    setError(null)
  }, [formId, startDate, endDate])

  const validationError = (() => {
    if (!draftStart) return 'Start date is required.'
    if (durationMode === 'session') {
      if (!draftEnd) return 'End date is required for session dates.'
      if (draftEnd < draftStart) return 'End date must be on or after the start date.'
    }
    return null
  })()

  const endInPast =
    durationMode === 'session' &&
    Boolean(draftEnd) &&
    draftEnd < new Date().toISOString().slice(0, 10)

  const dirty =
    draftStart !== (dateInputValue(startDate) || '') ||
    (durationMode === 'evergreen'
      ? Boolean(endDate)
      : draftEnd !== (dateInputValue(endDate) || '')) ||
    (durationMode === 'session') !== Boolean(endDate)

  const canSave = Boolean(draftStart) && !validationError && (dirty || !startDate)

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
        <span className="block font-semibold">{label}</span>
        <span className="text-xs text-gray-500">{hint}</span>
      </button>
    )
  }

  const handleSave = async () => {
    if (validationError) {
      setError(validationError)
      return
    }
    if (endInPast) {
      const ok = window.confirm(
        'These active dates end in the past. Associated timeslots may appear expired. Save anyway?',
      )
      if (!ok) return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await adminUpdateFormActiveDates(
        formId,
        durationMode === 'evergreen'
          ? { startDate: draftStart, evergreen: true }
          : { startDate: draftStart, endDate: draftEnd },
      )
      await onSaved({
        startDate: result.form.startDate || draftStart,
        endDate: result.form.endDate ?? null,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save active dates')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={
        embedded
          ? 'space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4'
          : 'space-y-3'
      }
    >
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Active dates</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          When this class runs. Timeslots inherit these dates.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-gray-700">Offering type</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {durationBtn('session', 'Session dates', 'Fixed start and end dates')}
          {durationBtn('evergreen', 'Evergreen class', 'Start date only — runs ongoing')}
        </div>
      </div>

      <div className={`grid gap-3 ${durationMode === 'session' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">
            {durationMode === 'evergreen' ? 'Starts on' : 'Start date'}
          </label>
          <input
            type="date"
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        {durationMode === 'session' && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">End date</label>
            <input
              type="date"
              value={draftEnd}
              min={draftStart || undefined}
              onChange={(e) => setDraftEnd(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {(error || validationError) && (
        <p className="text-sm text-red-600">{error || validationError}</p>
      )}
      {endInPast && !validationError && (
        <p className="text-xs text-amber-700">
          This end date is in the past — you will be asked to confirm before saving.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !canSave}
          className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save active dates
        </button>
      </div>
    </div>
  )
}

export default ClassActiveDatesEditor
