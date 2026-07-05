import type { MessageThread } from './types'
import { threadListAccentClass, threadListTitle } from './messagingLayout'

interface MessagingThreadRowProps {
  thread: MessageThread
  selected: boolean
  onSelect: (id: number) => void
  subtitle?: string | null
  meta?: string | null
}

export default function MessagingThreadRow({
  thread,
  selected,
  onSelect,
  subtitle,
  meta,
}: MessagingThreadRowProps) {
  const unread = thread.unread_count ?? 0
  const accentClass = threadListAccentClass(thread)
  const displayTags = thread.tags?.filter((tag) => {
    if (thread.kind === 'discussion' && tag.slug === 'event-info') return false
    return true
  })

  return (
    <button
      type="button"
      onClick={() => onSelect(thread.id)}
      className={`w-full pl-3 pr-4 py-3 text-left border-l-4 hover:bg-gray-50 ${accentClass} ${selected ? 'bg-red-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 text-sm truncate flex items-center gap-1">
            {thread.is_favorite && <span className="text-yellow-400 text-xs" aria-hidden>★</span>}
            {thread.is_calendar_inbox_row && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 shrink-0">Cal</span>
            )}
            {threadListTitle(thread)}
          </div>
          {thread.is_calendar_inbox_row && thread.calendar_event_name && (
            <div className="text-xs text-amber-800/80 truncate">{thread.calendar_event_name}</div>
          )}
          {subtitle && <div className="text-xs text-gray-500 truncate">{subtitle}</div>}
          {thread.last_message_body && (
            <div className="text-xs text-gray-400 truncate mt-0.5">{thread.last_message_body}</div>
          )}
          {meta && <div className="text-[10px] text-gray-400 mt-0.5">{meta}</div>}
          {displayTags && displayTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {displayTags.map((tag) => (
                <span
                  key={tag.id ?? tag.slug}
                  className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {unread > 0 && (
          <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-vortex-red text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </div>
    </button>
  )
}
