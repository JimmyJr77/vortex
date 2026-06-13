import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { updateTopProgram, type TopProgram } from '../../utils/programsApi'

interface Props {
  program: TopProgram
  onSaved: (program: TopProgram) => void
}

const AdminSchedulingOverview = ({ program, onSaved }: Props) => {
  const [title, setTitle] = useState(program.displayName)
  const [description, setDescription] = useState(program.description || '')
  const [active, setActive] = useState(program.schedulingActive ?? false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(program.displayName)
    setDescription(program.description || '')
    setActive(program.schedulingActive ?? false)
    setSaved(false)
  }, [program])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateTopProgram(program.id, {
        displayName: title.trim(),
        description: description.trim() || null,
        schedulingActive: active,
        markOverviewSaved: true,
      })
      onSaved(updated)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-bold text-black">Overview</h3>
        <p className="text-sm text-gray-600 mt-1">
          Program title and description appear on the public scheduling page. Synced with Admin → Classes.
        </p>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setSaved(false)
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Description</label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            setSaved(false)
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-2"
        />
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => {
            setActive(e.target.checked)
            setSaved(false)
          }}
        />
        <span className="font-semibold">Active (visible on /scheduling)</span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="bg-vortex-red text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save overview
        </button>
        {saved && <span className="text-green-600 text-sm font-medium">Saved</span>}
      </div>
    </div>
  )
}

export default AdminSchedulingOverview
