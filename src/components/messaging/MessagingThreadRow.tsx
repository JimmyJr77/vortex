import { CalendarDays, GraduationCap, MessageSquare, Paperclip, Star, UsersRound } from 'lucide-react'
import type { MessageThread } from './types'
import { threadIsEventDiscussionBoard, threadListAccentCategory, threadListTitle } from './messagingLayout'

interface MessagingThreadRowProps {
  thread: MessageThread
  selected: boolean
  onSelect: (id: number) => void
  subtitle?: string | null
  meta?: string | null
}

function activityLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const now = new Date()
  return date.toLocaleString(undefined, date.toDateString() === now.toDateString()
    ? { hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : '2-digit' })
}

export default function MessagingThreadRow({ thread, selected, onSelect, subtitle, meta }: MessagingThreadRowProps) {
  const unread = thread.unread_count ?? 0
  const category = threadListAccentCategory(thread)
  const schedule = thread.is_schedule_inbox_row || thread.is_calendar_inbox_row || category === 'scheduling'
  const isClass = thread.schedule_source === 'class' || thread.links?.some((link) => link.object_type === 'scheduling_form')
  const event = threadIsEventDiscussionBoard(thread) || category === 'event'
  const Icon = isClass ? GraduationCap : schedule ? CalendarDays : event ? UsersRound : MessageSquare
  const iconColor = isClass || schedule ? 'bg-teal-50 text-teal-700' : event ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'
  const date = thread.last_message_created_at || thread.last_message_at || thread.created_at
  const time = date && activityLabel(date)
  const preview = thread.last_message_body?.trim()
  const participantLabel = thread.calendar_event_name || subtitle || thread.participant_names
  const tags = thread.tags?.filter((tag) => !(thread.kind === 'discussion' && tag.slug === 'event-info'))
  const hasFiles = thread.has_files || (thread.file_count ?? 0) > 0

  return (
    <button
      type="button"
      onClick={() => onSelect(thread.id)}
      aria-current={selected ? 'true' : undefined}
      className={`relative flex w-full min-w-0 items-start gap-2.5 border-l-[3px] py-3 pl-2.5 pr-3 text-left transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 ${selected ? '!border-l-blue-600 bg-blue-50/80' : '!border-l-transparent hover:bg-slate-50'}`}
    >
      <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${selected ? 'bg-blue-100 text-blue-700' : iconColor}`} aria-hidden>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`truncate text-sm text-slate-900 ${selected || unread ? 'font-semibold' : 'font-medium'}`}>{threadListTitle(thread)}</span>
            {thread.is_favorite && <Star className="size-3 shrink-0 fill-amber-400 text-amber-600" aria-label="Favorite" />}
            {hasFiles && <Paperclip className="size-3 shrink-0 text-slate-500" aria-label="Has attachments" />}
          </span>
          {time && <time dateTime={date ?? undefined} className="shrink-0 text-[11px] text-slate-500">{time}</time>}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-2">
          <span className={`min-w-0 flex-1 truncate text-xs ${unread ? 'font-medium text-slate-700' : 'text-slate-600'}`}>{preview || participantLabel || (hasFiles ? 'Attachment' : 'No messages yet')}</span>
          {unread > 0 && (
            <span aria-label={`${unread} unread ${unread === 1 ? 'message' : 'messages'}`} className="min-w-5 shrink-0 rounded-full bg-blue-700 px-1 text-center text-[10px] font-semibold leading-5 text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
        {participantLabel && preview && participantLabel !== preview && <span className="mt-0.5 block truncate text-[11px] text-slate-500">{participantLabel}</span>}
        {meta && !time && <span className="mt-0.5 block text-[11px] text-slate-500">{meta}</span>}
        {tags && tags.length > 0 && (
          <span className="mt-1.5 flex flex-wrap items-center gap-1">
            {tags.map((tag) => <span key={tag.id ?? tag.slug} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{tag.label}</span>)}
          </span>
        )}
      </span>
    </button>
  )
}
