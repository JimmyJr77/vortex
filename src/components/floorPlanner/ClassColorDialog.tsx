import { useState } from 'react'
import PlannerDialog from './PlannerDialog'
import { automaticClassColor } from './model'

interface ClassColorDialogProps {
  classId: string
  name: string
  currentColor?: string
  onClose: () => void
  onSave: (color: string | null) => Promise<void>
}

export default function ClassColorDialog({ classId, name, currentColor, onClose, onSave }: ClassColorDialogProps) {
  const initialColor = currentColor ?? automaticClassColor(classId)
  const [draft, setDraft] = useState(initialColor)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const color = draft.trim().toLowerCase()
  const validColor = /^#[0-9a-f]{6}$/.test(color)

  async function save(value: string | null) {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onSave(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the class color. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PlannerDialog title="Change class color" onClose={onClose} closeDisabled={saving}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (validColor) void save(color) }}>
        <p className="text-sm text-gray-600"><strong className="text-gray-900">{name}</strong> will use this color in every Floor Planner view, including saved views.</p>
        <div className="flex items-end gap-3">
          <input type="color" aria-label="Pick a color" value={validColor ? color : initialColor} onChange={(event) => setDraft(event.target.value)} disabled={saving} className="h-10 w-12 cursor-pointer rounded-lg border border-gray-300 bg-white p-1 disabled:cursor-not-allowed" />
          <label className="text-sm font-semibold text-gray-700">
            Class color
            <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} disabled={saving} required spellCheck={false} maxLength={7} placeholder="#RRGGBB" className="mt-1 block w-32 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-vortex-red focus:outline-none focus:ring-2 focus:ring-red-100" />
          </label>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving || !validColor} className="rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">{saving ? 'Saving…' : 'Save class color'}</button>
          {currentColor && <button type="button" disabled={saving} onClick={() => void save(null)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40">Reset to automatic</button>}
        </div>
      </form>
    </PlannerDialog>
  )
}
