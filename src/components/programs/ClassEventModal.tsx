import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  createClassEvent,
  updateClassEvent,
  type ClassEvent,
  type ClassEventFormData,
} from '../../utils/programsApi'
import DisciplineTagPicker from './DisciplineTagPicker'

interface ProgramOption {
  id: number
  displayName: string
}

interface Props {
  open: boolean
  programsId: number
  programsDisplayName?: string
  availablePrograms?: ProgramOption[]
  lockProgram?: boolean
  parentProgramActive?: boolean
  editing?: ClassEvent | null
  initialFormData?: ClassEventFormData
  programPrimarySportId?: number | null
  submitLabel?: string
  onClose: () => void
  onSaved: () => void
}

const emptyForm = (): ClassEventFormData => ({
  displayName: '',
  skillLevel: null,
  ageMin: null,
  ageMax: null,
  description: '',
  skillRequirements: '',
  isActive: true,
})

const ClassEventModal = ({
  open,
  programsId,
  programsDisplayName,
  availablePrograms = [],
  lockProgram = false,
  parentProgramActive = true,
  editing,
  initialFormData,
  programPrimarySportId = null,
  submitLabel,
  onClose,
  onSaved,
}: Props) => {
  const [form, setForm] = useState<ClassEventFormData>(emptyForm())
  const [selectedProgramsId, setSelectedProgramsId] = useState(programsId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showProgramDropdown = !lockProgram && availablePrograms.length > 0

  useEffect(() => {
    if (!open) return
    const resolvedProgramsId =
      editing?.programsId ?? editing?.categoryId ?? programsId
    setSelectedProgramsId(resolvedProgramsId)
    if (editing) {
      setForm({
        displayName: editing.displayName,
        skillLevel: editing.skillLevel,
        ageMin: editing.ageMin,
        ageMax: editing.ageMax,
        description: editing.description || '',
        skillRequirements: editing.skillRequirements || '',
        isActive: editing.isActive,
      })
    } else if (initialFormData) {
      setForm({ ...initialFormData })
    } else {
      setForm(emptyForm())
    }
    setError(null)
  }, [open, editing, initialFormData, programsId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.displayName?.trim()) {
      setError('Class or Event Name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (!selectedProgramsId) {
        setError('Program is required')
        return
      }
      if (editing) {
        await updateClassEvent(editing.id, {
          ...form,
          ...(lockProgram ? {} : { programsId: selectedProgramsId }),
          isActive: parentProgramActive ? form.isActive : false,
        })
      } else {
        await createClassEvent(selectedProgramsId, {
          ...form,
          isActive: parentProgramActive ? form.isActive !== false : false,
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const submitButtonLabel =
    submitLabel ?? (editing ? 'Update class/event' : 'Add class/event')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-black">
              {editing ? 'Edit class or event' : 'Add class or event'}
            </h3>
            {programsDisplayName && (
              <p className="text-sm text-gray-500 mt-0.5">Program: {programsDisplayName}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-800" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {showProgramDropdown && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Program *</label>
              <select
                value={selectedProgramsId || ''}
                onChange={(e) =>
                  setSelectedProgramsId(e.target.value ? parseInt(e.target.value, 10) : 0)
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              >
                <option value="">Select a program…</option>
                {availablePrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class or Event Name *</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional sport tags</label>
            <p className="text-xs text-gray-500 mb-2">
              Primary sport is set on the program. Add cross-training or joint-event tags here.
            </p>
            <DisciplineTagPicker
              programId={selectedProgramsId}
              programDisplayName={programsDisplayName}
              showHeading={false}
              excludeTagId={programPrimarySportId}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skill level</label>
            <select
              value={form.skillLevel || ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, skillLevel: e.target.value || null }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">None (all levels)</option>
              <option value="EARLY_STAGE">Early stage</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min age</label>
              <input
                type="number"
                min={0}
                value={form.ageMin ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    ageMin: e.target.value ? parseInt(e.target.value, 10) : null,
                  }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max age</label>
              <input
                type="number"
                min={0}
                value={form.ageMax ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    ageMax: e.target.value ? parseInt(e.target.value, 10) : null,
                  }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skill requirements</label>
            <input
              type="text"
              value={form.skillRequirements || ''}
              onChange={(e) => setForm((f) => ({ ...f, skillRequirements: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. No experience required"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive !== false}
                disabled={!parentProgramActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 text-vortex-red border-gray-300 rounded focus:ring-vortex-red disabled:opacity-50"
              />
              Active
            </label>
            {!parentProgramActive && (
              <p className="text-xs text-amber-700 mt-1">
                This class cannot be active while its program is inactive.
              </p>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Schedule times are managed in the Scheduling → Slots tab after saving.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitButtonLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ClassEventModal
