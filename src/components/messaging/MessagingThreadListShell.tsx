import type { ReactNode } from 'react'

interface MessagingThreadListShellProps {
  title: string
  search: string
  onSearchChange: (value: string) => void
  onSearchSubmit?: () => void
  searchPlaceholder?: string
  headerExtra?: ReactNode
  children: ReactNode
}

export default function MessagingThreadListShell({
  title,
  search,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Search threads…',
  headerExtra,
  children,
}: MessagingThreadListShellProps) {
  return (
    <div className="messaging-panel flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm shrink-0">{title}</div>
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
