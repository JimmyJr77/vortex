import type { ReactNode } from 'react'

interface MessagingThreadListShellProps {
  title: string
  titleAction?: ReactNode
  search: string
  onSearchChange: (value: string) => void
  onSearchSubmit?: () => void
  searchPlaceholder?: string
  headerExtra?: ReactNode
  children: ReactNode
}

export default function MessagingThreadListShell({
  title,
  titleAction,
  search,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Search threads…',
  headerExtra,
  children,
}: MessagingThreadListShellProps) {
  return (
    <div className="messaging-panel flex flex-col min-h-0 h-full max-h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 shrink-0 flex items-center justify-between gap-2">
        <span className="font-semibold text-sm min-w-0 truncate">{title}</span>
        {titleAction}
      </div>
      <div className="px-3 py-2 border-b border-gray-100 shrink-0 space-y-2">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearchSubmit?.()
          }}
          placeholder={searchPlaceholder}
          aria-label="Search threads"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        {headerExtra}
      </div>
      <div className="messaging-scroll flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  )
}
