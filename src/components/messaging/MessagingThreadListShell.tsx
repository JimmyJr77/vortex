import { useId, useRef, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'

interface MessagingThreadListShellProps {
  title: string
  titleAction?: ReactNode
  search: string
  onSearchChange: (value: string) => void
  onSearchSubmit?: () => void
  searchPlaceholder?: string
  headerExtra?: ReactNode
  children: ReactNode
  resultCount?: number
}

export default function MessagingThreadListShell({
  title,
  titleAction,
  search,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Search conversations',
  headerExtra,
  children,
  resultCount,
}: MessagingThreadListShellProps) {
  const headingId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <section aria-labelledby={headingId} className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-3">
        <h3 id={headingId} tabIndex={-1} className="min-w-0 truncate text-sm font-semibold text-slate-900">{title}</h3>
        {titleAction}
      </div>
      <div className="shrink-0 space-y-3 border-b border-slate-200 px-3 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearchSubmit?.()
            }}
            placeholder={searchPlaceholder}
            aria-label="Search conversations"
            className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-500 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100 [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => { onSearchChange(''); inputRef.current?.focus() }} className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-600 hover:bg-slate-200">
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        {headerExtra}
      </div>
      {resultCount != null && (
        <div className="shrink-0 bg-white px-4 pb-1 pt-2 text-xs font-medium text-slate-500" role="status">
          {resultCount} {resultCount === 1 ? 'conversation' : 'conversations'}
        </div>
      )}
      <div className="messaging-scroll flex-1 min-h-0 overflow-y-auto">{children}</div>
    </section>
  )
}
