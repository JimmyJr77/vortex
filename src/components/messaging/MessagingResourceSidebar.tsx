import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Paperclip } from 'lucide-react'
import { fetchScheduleInboxRows, type ScheduleInboxRow } from './messagingApi'
import MessagingFileChip from './MessagingFileChip'
import type { MessageFile, MessageRow, MessagingRole } from './types'

interface Props {
  filesVisible?: boolean
  eventsVisible?: boolean
  role: MessagingRole
  fetcher: (endpoint: string, options?: RequestInit) => Promise<unknown>
  messages: MessageRow[]
  selectedThreadId: number | null
  loading: boolean
  error?: string | null
}

export default function MessagingResourceSidebar({ role, fetcher, messages, selectedThreadId, loading, error, filesVisible = true, eventsVisible = true }: Props) {
  const [events, setEvents] = useState<ScheduleInboxRow[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      void fetchScheduleInboxRows(role, fetcher).then((rows) => {
        if (cancelled) return
        const now = Date.now()
        setEvents(rows.filter((row) => row.when_start && Date.parse(row.when_end || row.when_start) >= now)
          .sort((a, b) => Date.parse(a.when_start!) - Date.parse(b.when_start!)))
        setEventsError(false)
      }).catch(() => { if (!cancelled) setEventsError(true) })
        .finally(() => { if (!cancelled) setEventsLoading(false) })
    }
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [role, fetcher, retry])

  const files = useMemo(() => {
    const result = new Map<string, MessageFile>()
    for (const message of [...messages].reverse()) {
      if (message.deleted_at) continue
      const posted = [...(message.files ?? [])]
      if (message.attachment_url) posted.push({ url: message.attachment_url, name: message.attachment_name || 'Attachment', mime: message.attachment_mime })
      for (const file of posted) if (!result.has(file.url)) result.set(file.url, file)
    }
    return [...result.values()]
  }, [messages])

  return (
    <aside aria-label="Conversation resources" className="flex h-full min-h-0 flex-col divide-y divide-slate-200 bg-slate-50">
      {filesVisible && <section aria-label="Shared files" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-5 pb-3 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Paperclip className="size-4 text-slate-400" aria-hidden />Shared files <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{selectedThreadId && !loading && !error ? files.length : '—'}</span></h3>
          <p className="mt-1 text-xs text-slate-500">Posted in this conversation</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {!selectedThreadId ? <p className="text-sm text-slate-500">Select a conversation to see its files.</p>
            : loading ? <p role="status" className="text-sm text-slate-500">Loading files…</p>
              : error ? <p className="text-sm text-slate-500">Files are unavailable until the conversation loads.</p>
                : files.length ? <ul className="space-y-2">{files.map((file) => <li key={file.url}><MessagingFileChip file={file} /></li>)}</ul>
                  : <p className="text-sm text-slate-500">No files shared yet.</p>}
        </div>
      </section>}
      {eventsVisible && <section aria-label="Upcoming events" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-5 pb-3 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarDays className="size-4 text-slate-400" aria-hidden />Upcoming events</h3>
          <p className="mt-1 text-xs text-slate-500">Your schedule · soonest first</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {eventsLoading ? <p role="status" className="text-sm text-slate-500">Loading events…</p>
            : eventsError ? <div className="text-sm text-slate-500">Couldn’t load events. <button type="button" className="font-semibold text-slate-700 underline" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>
              : events.length ? <ul className="space-y-3">{events.map((event) => (
                <li key={event.row_key} className="rounded-xl border border-slate-200 bg-white p-3">
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">{event.title}</summary>
                    {(event.what_text || event.notes || event.who_text) && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{[event.what_text, event.who_text, event.notes].filter(Boolean).join('\n')}</p>}
                  </details>
                  <time dateTime={event.when_start!} className="mt-2 block text-xs font-medium text-slate-600">{new Date(event.when_start!).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                  {event.where_text && <p className="mt-1 text-xs text-slate-500 [overflow-wrap:anywhere]">{event.where_text}</p>}
                </li>
              ))}</ul> : <p className="text-sm text-slate-500">No upcoming events.</p>}
        </div>
      </section>}
    </aside>
  )
}
