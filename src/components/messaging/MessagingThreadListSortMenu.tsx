import { ArrowDownUp } from 'lucide-react'
import type { ThreadListSortDir, ThreadListSortField } from './messagingThreadSort'

const SORT_OPTIONS = [
  { field: 'recent', dir: 'desc', label: 'Latest activity' },
  { field: 'recent', dir: 'asc', label: 'Oldest activity' },
  { field: 'title', dir: 'asc', label: 'Title A–Z' },
  { field: 'title', dir: 'desc', label: 'Title Z–A' },
  { field: 'created', dir: 'desc', label: 'Newest created' },
  { field: 'created', dir: 'asc', label: 'Oldest created' },
] as const

interface MessagingThreadListSortMenuProps {
  sort: ThreadListSortField
  sortDir: ThreadListSortDir
  onChange: (sort: ThreadListSortField, sortDir: ThreadListSortDir) => void
}

export default function MessagingThreadListSortMenu({ sort, sortDir, onChange }: MessagingThreadListSortMenuProps) {
  return (
    <div className="relative size-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-300">
      <ArrowDownUp className="pointer-events-none absolute inset-0 m-auto size-4" aria-hidden />
      <select
        aria-label="Sort conversations"
        title={SORT_OPTIONS.find(({ field, dir }) => field === sort && dir === sortDir)?.label}
        value={`${sort}:${sortDir}`}
        onChange={(e) => {
          const option = SORT_OPTIONS.find(({ field, dir }) => `${field}:${dir}` === e.target.value)
          if (option) onChange(option.field, option.dir)
        }}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      >
        {SORT_OPTIONS.map(({ field, dir, label }) => <option key={`${field}:${dir}`} value={`${field}:${dir}`}>{label}</option>)}
      </select>
    </div>
  )
}
