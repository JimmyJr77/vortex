import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import {
  archiveTopProgram,
  createTopProgram,
  deleteTopProgram,
  fetchTopPrograms,
  updateTopProgram,
  type TopProgram,
} from '../../utils/programsApi'

interface Props {
  selectedProgramId?: number | null
  onSelectProgram?: (program: TopProgram | null) => void
  onRefresh?: () => void
  compact?: boolean
}

const iconBtn =
  'p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 disabled:opacity-40'

const ProgramsSection = ({
  selectedProgramId,
  onSelectProgram,
  onRefresh,
  compact = false,
}: Props) => {
  const [programs, setPrograms] = useState<TopProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TopProgram | null>(null)
  const [form, setForm] = useState({ name: '', displayName: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const filteredPrograms = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return programs
    return programs.filter(
      (program) =>
        program.displayName.toLowerCase().includes(q) ||
        program.name.toLowerCase().includes(q) ||
        (program.description?.toLowerCase().includes(q) ?? false),
    )
  }, [programs, search])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTopPrograms(false)
      setPrograms(data.filter((p) => !p.archived))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load programs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', displayName: '', description: '' })
    setModalOpen(true)
  }

  const openEdit = (program: TopProgram) => {
    setEditing(program)
    setForm({
      name: program.name,
      displayName: program.displayName,
      description: program.description || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.displayName.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        await updateTopProgram(editing.id, {
          displayName: form.displayName,
          description: form.description || null,
        })
      } else {
        const name =
          form.name.trim() ||
          form.displayName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
        await createTopProgram({
          name,
          displayName: form.displayName,
          description: form.description || null,
        })
      }
      setModalOpen(false)
      await load()
      onRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (program: TopProgram) => {
    if (!confirm(`Archive "${program.displayName}"?`)) return
    setActionId(program.id)
    try {
      await archiveTopProgram(program.id, true)
      if (selectedProgramId === program.id) onSelectProgram?.(null)
      await load()
      onRefresh?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to archive')
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async (program: TopProgram) => {
    if (
      !confirm(
        `Permanently delete "${program.displayName}" and all of its classes? This cannot be undone.`,
      )
    ) {
      return
    }
    setActionId(program.id)
    try {
      await deleteTopProgram(program.id)
      if (selectedProgramId === program.id) onSelectProgram?.(null)
      await load()
      onRefresh?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setActionId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-black">Programs</h3>
            <p className="text-sm text-gray-600">Top-level taxonomy (Football, Adult Fitness, etc.)</p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="p-2 rounded-lg bg-vortex-red text-white hover:bg-red-700 shrink-0"
            title="Add program"
            aria-label="Add program"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {compact && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search programs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm"
          />
        </div>
      )}

      {programs.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">No programs yet.</p>
      ) : filteredPrograms.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">No programs match your search.</p>
      ) : (
        <div className={compact ? 'space-y-2' : 'border border-gray-200 rounded-xl overflow-hidden'}>
          {filteredPrograms.map((program) => {
            const selected = selectedProgramId === program.id
            return (
              <div
                key={program.id}
                className={
                  compact
                    ? `w-full text-left rounded-lg px-4 py-3 border transition-colors ${
                        selected
                          ? 'border-vortex-red bg-red-50 text-black font-semibold'
                          : 'border-gray-200 hover:border-gray-400 text-gray-700'
                      }`
                    : `flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 first:border-t-0 ${
                        selected ? 'bg-red-50' : 'hover:bg-gray-50'
                      }`
                }
              >
                {compact ? (
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => onSelectProgram?.(selected ? null : program)}
                  >
                    {program.displayName}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="text-left font-medium text-black hover:text-vortex-red flex-1"
                      onClick={() => onSelectProgram?.(selected ? null : program)}
                    >
                      {program.displayName}
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className={iconBtn}
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => openEdit(program)}
                        disabled={actionId === program.id}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        title="Archive"
                        aria-label="Archive"
                        onClick={() => handleArchive(program)}
                        disabled={actionId === program.id}
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className={`${iconBtn} hover:text-red-700`}
                        title="Delete"
                        aria-label="Delete"
                        onClick={() => handleDelete(program)}
                        disabled={actionId === program.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {compact && (
        <button
          type="button"
          onClick={openAdd}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-vortex-red hover:text-vortex-red"
        >
          <Plus className="w-4 h-4" />
          Add program
        </button>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} aria-hidden />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-lg font-bold text-black">
              {editing ? 'Edit program' : 'Add program'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display name *</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.displayName.trim()}
                className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProgramsSection
