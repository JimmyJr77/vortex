import { ChevronDown, ListFilter } from 'lucide-react'

export type MessagingInboxTab =
  | 'all'
  | 'messages'
  | 'unread'
  | 'pinned'
  | 'events'
  | 'scheduling'
  | 'classes'
  | 'files'
  | 'archived'

const QUICK_FILTERS: { id: MessagingInboxTab; label: string }[] = [
  { id: 'messages', label: 'Messages' },
  { id: 'unread', label: 'Unread' },
  { id: 'pinned', label: 'Favorites' },
]

const MORE_FILTERS: { id: MessagingInboxTab; label: string }[] = [
  { id: 'all', label: 'All conversations' },
  { id: 'events', label: 'Event discussions' },
  { id: 'scheduling', label: 'Schedules' },
  { id: 'classes', label: 'Classes' },
  { id: 'files', label: 'Files' },
  { id: 'archived', label: 'Archived' },
]

interface MessagingInboxTabsProps {
  activeTab: MessagingInboxTab
  onChange: (tab: MessagingInboxTab) => void
  counts?: Partial<Record<MessagingInboxTab, number>>
  hiddenTabs?: MessagingInboxTab[]
}

export default function MessagingInboxTabs({
  activeTab,
  onChange,
  counts,
  hiddenTabs = [],
}: MessagingInboxTabsProps) {
  const extra = MORE_FILTERS.filter(({ id }) => !hiddenTabs.includes(id))
  const extraActive = extra.some(({ id }) => id === activeTab)
  const unread = counts?.unread ?? 0

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Quick filters" className="grid grid-cols-3 gap-0.5 rounded-lg bg-slate-100 p-0.5">
        {QUICK_FILTERS.filter(({ id }) => !hiddenTabs.includes(id)).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === activeTab}
            onClick={() => onChange(id)}
            className={`flex min-h-9 items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold transition-colors ${id === activeTab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {label}
            {id === 'unread' && unread > 0 && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] leading-none text-red-800">{unread > 99 ? '99+' : unread}</span>}
          </button>
        ))}
      </div>
      {extra.length > 0 && (
        <div className="relative">
          <ListFilter className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden />
          <select
            value={extraActive ? activeTab : ''}
            onChange={(e) => onChange(e.target.value as MessagingInboxTab)}
            aria-label="More conversation filters"
            className={`min-h-9 w-full appearance-none rounded-lg border bg-white py-1.5 pl-8 pr-8 text-xs font-medium ${extraActive ? 'border-red-200 text-red-800' : 'border-slate-200 text-slate-700'}`}
          >
            <option value="" disabled>More filters</option>
            {extra.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden />
        </div>
      )}
    </div>
  )
}
