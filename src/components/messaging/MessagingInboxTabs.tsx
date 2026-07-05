export type MessagingInboxTab =
  | 'all'
  | 'unread'
  | 'pinned'
  | 'events'
  | 'scheduling'
  | 'files'
  | 'archived'

const TAB_DEFS: { id: MessagingInboxTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'events', label: 'Events' },
  { id: 'scheduling', label: 'Scheduling' },
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
    <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
      {tabs.map(({ id, label }) => {
        const count = counts?.[id]
        const active = activeTab === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              active
                ? 'bg-vortex-red text-white border-vortex-red'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900'
            }`}
          >
            {label}
            {count != null && count > 0 && (
              <span
                className={`ml-1.5 inline-flex min-w-[1.125rem] h-[1.125rem] px-1 items-center justify-center rounded-full text-[10px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
