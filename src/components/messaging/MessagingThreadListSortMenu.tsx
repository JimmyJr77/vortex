import { useEffect, useRef, useState } from 'react'
import { ArrowDownAZ, ArrowUpAZ, ArrowDownWideNarrow, ArrowUpWideNarrow, Filter } from 'lucide-react'

export type ThreadListSortField = 'title' | 'recent' | 'created'
export type ThreadListSortDir = 'asc' | 'desc'

export function defaultSortDir(field: ThreadListSortField): ThreadListSortDir {
  return field === 'title' ? 'asc' : 'desc'
}

export function toApiThreadSort(field: ThreadListSortField): 'title' | 'created' | 'updated' {
  if (field === 'recent') return 'updated'
  return field
}

const SORT_OPTIONS: { field: ThreadListSortField; label: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'recent', label: 'Recent' },
  { field: 'created', label: 'Date Created' },
]

function sortHint(field: ThreadListSortField, dir: ThreadListSortDir): string {
  if (field === 'title') return dir === 'asc' ? 'A–Z' : 'Z–A'
  if (field === 'recent') return dir === 'desc' ? 'Most recent first' : 'Oldest activity first'
  return dir === 'desc' ? 'Newest first' : 'Oldest first'
}

function SortDirectionIcon({ field, dir }: { field: ThreadListSortField; dir: ThreadListSortDir }) {
  if (field === 'title') {
    return dir === 'asc' ? <ArrowDownAZ className="w-3.5 h-3.5" /> : <ArrowUpAZ className="w-3.5 h-3.5" />
  }
  return dir === 'desc' ? <ArrowDownWideNarrow className="w-3.5 h-3.5" /> : <ArrowUpWideNarrow className="w-3.5 h-3.5" />
}

interface MessagingThreadListSortMenuProps {
  sort: ThreadListSortField
  sortDir: ThreadListSortDir
  onChange: (sort: ThreadListSortField, sortDir: ThreadListSortDir) => void
}

export default function MessagingThreadListSortMenu({
  sort,
  sortDir,
  onChange,
}: MessagingThreadListSortMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const pickSort = (field: ThreadListSortField) => {
    if (field === sort) {
      onChange(field, sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      onChange(field, defaultSortDir(field))
    }
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Sort threads"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
          open ? 'border-vortex-red text-vortex-red bg-red-50' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
        }`}
      >
        <Filter className="w-4 h-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {SORT_OPTIONS.map(({ field, label }) => {
            const active = sort === field
            const dir = active ? sortDir : defaultSortDir(field)
            return (
              <button
                key={field}
                type="button"
                role="menuitem"
                onClick={() => pickSort(field)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                  active ? 'bg-red-50 text-vortex-red font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{label}</span>
                <span className={`inline-flex items-center gap-1 text-[11px] ${active ? 'text-vortex-red' : 'text-gray-400'}`}>
                  {active && <SortDirectionIcon field={field} dir={dir} />}
                  <span aria-hidden>{sortHint(field, dir)}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
