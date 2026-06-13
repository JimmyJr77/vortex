import { useCallback, useEffect, useState } from 'react'
import { Archive, Loader2, Pencil, Plus, Trash2, RotateCcw } from 'lucide-react'
import {
  archiveClassEvent,
  deleteClassEvent,
  fetchClassEvents,
  type ClassEvent,
} from '../../utils/programsApi'
import ClassEventModal from './ClassEventModal'

interface Props {
  programsId: number
  programsDisplayName?: string
  selectedClassEventId?: number | null
  onSelectClassEvent?: (event: ClassEvent | null) => void
  onRefresh?: () => void
  showAddButton?: boolean
}

const iconBtn =
  'p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 disabled:opacity-40'

const ClassEventsPanel = ({
  programsId,
  programsDisplayName,
  selectedClassEventId,
  onSelectClassEvent,
  onRefresh,
  showAddButton = true,
}: Props) => {
  const [items, setItems] = useState<ClassEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ClassEvent | null>(null)
  const [actionId, setActionId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchClassEvents({ programsId, archived: false })
      setItems(data.filter((e) => !e.archived))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [programsId])

  useEffect(() => {
    load()
  }, [load])

  const handleSaved = async () => {
    await load()
    onRefresh?.()
  }

  const handleArchive = async (item: ClassEvent) => {
    if (!confirm(`Archive "${item.displayName}"?`)) return
    setActionId(item.id)
    try {
      await archiveClassEvent(item.id, true)
      if (selectedClassEventId === item.id) onSelectClassEvent?.(null)
      await load()
      onRefresh?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to archive')
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async (item: ClassEvent) => {
    if (!confirm(`Permanently delete "${item.displayName}"?`)) return
    setActionId(item.id)
    try {
      await deleteClassEvent(item.id)
      if (selectedClassEventId === item.id) onSelectClassEvent?.(null)
      await load()
      onRefresh?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setActionId(null)
    }
  }

  const openAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (item: ClassEvent) => {
    setEditing(item)
    setModalOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-black">Classes &amp; events</h3>
          <p className="text-sm text-gray-600">
            Offerings under {programsDisplayName || 'this program'}. Select one to manage slots and signups.
          </p>
        </div>
        {showAddButton && (
          <button
            type="button"
            onClick={openAdd}
            className="p-2 rounded-lg bg-vortex-red text-white hover:bg-red-700 shrink-0"
            title="Add class or event"
            aria-label="Add class or event"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 py-6">No classes or events yet. Add one to get started.</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="py-2 px-4 font-medium">Name</th>
                <th className="py-2 px-4 font-medium">Ages</th>
                <th className="py-2 px-4 font-medium">Status</th>
                <th className="py-2 px-4 font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const selected = selectedClassEventId === item.id
                return (
                  <tr
                    key={item.id}
                    className={`border-t border-gray-100 ${selected ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="py-2 px-4">
                      <button
                        type="button"
                        onClick={() => onSelectClassEvent?.(selected ? null : item)}
                        className="text-left font-medium text-black hover:text-vortex-red"
                      >
                        {item.displayName}
                      </button>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                      )}
                    </td>
                    <td className="py-2 px-4 text-gray-600">
                      {item.ageMin != null || item.ageMax != null
                        ? `${item.ageMin ?? '—'} – ${item.ageMax ?? '—'}`
                        : '—'}
                    </td>
                    <td className="py-2 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className={iconBtn}
                          title="Edit"
                          aria-label="Edit"
                          onClick={() => openEdit(item)}
                          disabled={actionId === item.id}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className={iconBtn}
                          title="Archive"
                          aria-label="Archive"
                          onClick={() => handleArchive(item)}
                          disabled={actionId === item.id}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className={`${iconBtn} hover:text-red-700`}
                          title="Delete"
                          aria-label="Delete"
                          onClick={() => handleDelete(item)}
                          disabled={actionId === item.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {onSelectClassEvent && (
                          <button
                            type="button"
                            className={`${iconBtn} ${selected ? 'text-vortex-red' : ''}`}
                            title={selected ? 'Deselect' : 'Select for scheduling'}
                            aria-label="Select"
                            onClick={() => onSelectClassEvent(selected ? null : item)}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ClassEventModal
        open={modalOpen}
        programsId={programsId}
        programsDisplayName={programsDisplayName}
        editing={editing}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSaved={handleSaved}
      />
    </div>
  )
}

export default ClassEventsPanel
