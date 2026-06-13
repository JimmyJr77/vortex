import { useCallback, useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import {
  adminDeleteSchedulingForm,
  adminFetchLegacySchedulingForms,
  type LegacySchedulingForm,
} from '../../utils/schedulingApi'

interface Props {
  onDeleted?: () => void
}

const AdminSchedulingLegacyForms = ({ onDeleted }: Props) => {
  const [forms, setForms] = useState<LegacySchedulingForm[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetchLegacySchedulingForms()
      setForms(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load legacy forms')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (form: LegacySchedulingForm) => {
    const parts = [
      `Delete "${form.title}"?`,
      'It will be removed from /scheduling and unlinked from any events.',
      form.signupCount > 0
        ? `${form.signupCount} signup(s) will remain in the database for records.`
        : null,
    ]
      .filter(Boolean)
      .join(' ')

    if (!confirm(parts)) return

    setDeletingId(form.id)
    setError(null)
    try {
      await adminDeleteSchedulingForm(form.id)
      await load()
      onDeleted?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete form')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking for legacy forms…
      </div>
    )
  }

  if (forms.length === 0) return null

  return (
    <div className="mt-10 pt-8 border-t border-gray-200 w-full">
      <h3 className="text-lg font-bold text-black">Legacy scheduling forms</h3>
      <p className="text-sm text-gray-600 mt-1 mb-4">
        These forms were created before the program → class/event workflow. They may still be linked to events on the Read Board. Delete any you no longer need to fully remove them.
      </p>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <ul className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
        {forms.map((form) => (
          <li
            key={form.id}
            className="flex items-start justify-between gap-4 px-4 py-3 bg-white"
          >
            <div className="min-w-0">
              <p className="font-semibold text-black">{form.title}</p>
              {form.description && (
                <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{form.description}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {form.startDate || form.endDate
                  ? `Opens ${form.startDate ?? '—'} · Closes ${form.endDate ?? '—'}`
                  : 'No form-level dates'}
                {' · '}
                {form.slotGroupCount} slot group{form.slotGroupCount === 1 ? '' : 's'}
                {' · '}
                {form.signupCount} signup{form.signupCount === 1 ? '' : 's'}
                {form.eventLinked ? ' · Linked to an event' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(form)}
              disabled={deletingId === form.id}
              className="shrink-0 p-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
              title="Delete legacy form"
              aria-label={`Delete ${form.title}`}
            >
              {deletingId === form.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default AdminSchedulingLegacyForms
