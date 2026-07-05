export type MessagingInboxTab =
  | 'all'
  | 'unread'
  | 'pinned'
  | 'events'
  | 'scheduling'
  | 'classes'
  | 'files'
  | 'archived'

const TAB_DEFS: { id: MessagingInboxTab; label: string }[] = [
  { id: 'all', label: 'All threads' },
  { id: 'unread', label: 'Unread Messages' },
  { id: 'pinned', label: 'Favorite Messages' },
  { id: 'events', label: 'Event Boards' },
  { id: 'scheduling', label: 'Event Schedules' },
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
  const hidden = new Set(hiddenTabs)
  const tabs = TAB_DEFS.filter((t) => !hidden.has(t.id))

  return (
    <select
      value={activeTab}
      onChange={(e) => onChange(e.target.value as MessagingInboxTab)}
      aria-label="Filter threads"
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
    >
      {tabs.map(({ id, label }) => {
        const count = counts?.[id]
        const suffix = count != null && count > 0 ? ` (${count > 99 ? '99+' : count})` : ''
        return (
          <option key={id} value={id}>
            {label}
            {suffix}
          </option>
        )
      })}
    </select>
  )
}
