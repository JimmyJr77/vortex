import { useEffect, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import {
  createEventCalendarItem,
  fetchClassMessageOptions,
  fetchHighlightEvents,
  type ClassMessageOption,
  type HighlightEventOption,
  type ScheduleInboxRow,
} from './messagingApi'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

export interface CalendarItemDraft {
  title: string
  who_text: string
  what_text: string
  why_text: string
  when_start: string
  where_text: string
  class_ids: number[]
}

const EMPTY_DRAFT: CalendarItemDraft = {
  title: '',
  who_text: '',
  what_text: '',
  why_text: '',
  when_start: '',
  where_text: '',
  class_ids: [],
}

interface CalendarItemComposePanelProps {
  fetcher: Fetcher
  role: 'admin' | 'coach'
  onCancel: () => void
  onCreated: (item: ScheduleInboxRow | null, threadId: number | null) => void
}

export default function CalendarItemComposePanel({
  fetcher,
  role,
  onCancel,
  onCreated,
}: CalendarItemComposePanelProps) {
  const [events, setEvents] = useState<HighlightEventOption[]>([])
  const [classes, setClasses] = useState<ClassMessageOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [eventId, setEventId] = useState<number | null>(null)
  const [draft, setDraft] = useState<CalendarItemDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchHighlightEvents(role, fetcher),
      fetchClassMessageOptions(role, fetcher),
    ])
      .then(([eventRows, classRows]) => {
        setEvents(eventRows)
        setClasses(classRows)
        setEventId(eventRows[0]?.id != null ? Number(eventRows[0].id) : null)
      })
      .finally(() => setLoading(false))
  }, [fetcher, role])

  const handleSave = async () => {
    if (eventId == null) {
      setError('Select an event.')
      return
    }
    if (!draft.title.trim()) {
      setError('Title is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const item = await createEventCalendarItem(eventId, fetcher, {
        title: draft.title.trim(),
        who_text: draft.who_text || null,
        what_text: draft.what_text || null,
        why_text: draft.why_text || null,
        when_start: draft.when_start || null,
        where_text: draft.where_text || null,
        class_ids: draft.class_ids,
      }, role)
      onCreated({
        row_key: `calendar_item:${item.id}`,
        source: 'calendar_item',
        title: item.title,
        who_text: item.who_text,
        what_text: item.what_text,
        why_text: item.why_text,
        when_start: item.when_start,
        where_text: item.where_text,
        linked_event_id: eventId,
        calendar_item_id: item.id,
        discussion_thread_id: item.discussion_thread_id ?? null,
        class_ids: draft.class_ids,
        event_name: item.event_name ?? null,
      }, item.discussion_thread_id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save calendar item')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-gray-600 p-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">New calendar item</h3>
        <p className="text-sm text-gray-500 mt-1">Set up the 5 Ws for an upcoming schedule entry.</p>
      </div>
      {error && <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</span>
        <select
          value={eventId ?? ''}
          onChange={(e) => setEventId(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.event_name ?? event.eventName ?? `Event ${event.id}`}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Title"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          type="datetime-local"
          value={draft.when_start}
          onChange={(e) => setDraft((d) => ({ ...d, when_start: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={draft.who_text}
          onChange={(e) => setDraft((d) => ({ ...d, who_text: e.target.value }))}
          placeholder="Who"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={draft.what_text}
          onChange={(e) => setDraft((d) => ({ ...d, what_text: e.target.value }))}
          placeholder="What"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={draft.why_text}
          onChange={(e) => setDraft((d) => ({ ...d, why_text: e.target.value }))}
          placeholder="Why"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={draft.where_text}
          onChange={(e) => setDraft((d) => ({ ...d, where_text: e.target.value }))}
          placeholder="Where"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      {draft.where_text.trim() && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(draft.where_text.trim())}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-3 py-1.5 hover:bg-teal-100"
        >
          <MapPin className="w-4 h-4" /> Open in Maps
        </a>
      )}
      {classes.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Associated classes</span>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {classes.map((cls) => {
              const checked = draft.class_ids.includes(cls.id)
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setDraft((d) => ({
                    ...d,
                    class_ids: checked
                      ? d.class_ids.filter((id) => id !== cls.id)
                      : [...d.class_ids, cls.id],
                  }))}
                  className={`text-xs font-semibold rounded-full px-2.5 py-1 border ${
                    checked ? 'bg-vortex-red text-white border-vortex-red' : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {cls.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save calendar item'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm border border-gray-300">
          Cancel
        </button>
      </div>
    </div>
  )
}
