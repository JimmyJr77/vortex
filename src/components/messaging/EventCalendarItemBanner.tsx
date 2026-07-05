import { CalendarDays, MapPin } from 'lucide-react'
import type { EventCalendarItem } from './messagingApi'

interface EventCalendarItemBannerProps {
  item: EventCalendarItem | null
}

function formatWhen(item: EventCalendarItem): string | null {
  if (!item.when_start) return null
  const start = new Date(item.when_start)
  if (Number.isNaN(start.getTime())) return null
  if (item.when_end) {
    const end = new Date(item.when_end)
    if (!Number.isNaN(end.getTime())) {
      return `${start.toLocaleString()} – ${end.toLocaleString()}`
    }
  }
  return start.toLocaleString()
}

export default function EventCalendarItemBanner({ item }: EventCalendarItemBannerProps) {
  if (!item) return null

  const bringItems = item.what_to_bring?.length
    ? item.what_to_bring
    : []

  const rows = [
    item.event_name ? { label: 'Event', value: item.event_name } : null,
    item.who_text ? { label: 'Who', value: item.who_text } : null,
    item.what_text ? { label: 'What', value: item.what_text } : null,
    item.why_text ? { label: 'Why', value: item.why_text } : null,
    formatWhen(item) ? { label: 'When', value: formatWhen(item)! } : null,
    item.where_text ? { label: 'Where', value: item.where_text } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div className="shrink-0 mx-4 mt-3 mb-1 rounded-xl border border-amber-200 bg-amber-50/80 overflow-hidden">
      <div className="px-3 py-2 border-b border-amber-200 bg-white/80 flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-amber-700 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-amber-800 font-semibold">Calendar item</div>
          <div className="text-sm font-semibold text-gray-900 truncate">{item.title}</div>
        </div>
        {item.where_text?.trim() && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.where_text.trim())}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 bg-amber-100 border border-amber-200 rounded-full px-2 py-1 shrink-0 hover:bg-amber-200"
          >
            <MapPin className="w-3.5 h-3.5" /> Map
          </a>
        )}
      </div>
      {rows.length > 0 && (
        <dl className="divide-y divide-amber-100">
          {rows.map(({ label, value }) => (
            <div key={label} className="px-3 py-2 grid grid-cols-[minmax(0,28%)_1fr] gap-2 text-sm">
              <dt className="text-amber-900/70 font-medium">{label}</dt>
              <dd className="text-gray-900 whitespace-pre-wrap break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {bringItems.length > 0 && (
        <div className="px-3 py-2 border-t border-amber-100">
          <div className="text-xs font-semibold text-amber-900/70 mb-1">What to bring</div>
          <ul className="text-sm text-gray-900 list-disc list-inside space-y-0.5">
            {bringItems.map((bringItem) => (
              <li key={bringItem}>{bringItem}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="px-3 py-2 text-[11px] text-amber-900/70 border-t border-amber-100">
        Replies here post to the linked event chat.
      </p>
    </div>
  )
}
