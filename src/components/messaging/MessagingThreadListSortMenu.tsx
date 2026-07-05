import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpAZ,
  ArrowUpWideNarrow,
  Filter,
} from 'lucide-react'

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

function SortDirectionIcon({ field, dir }: { field: ThreadListSortField; dir: ThreadListSortDir }) {
  if (field === 'title') {
    return dir === 'asc' ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />
  }
  return dir === 'desc' ? <ArrowDownWideNarrow className="w-4 h-4" /> : <ArrowUpWideNarrow className="w-4 h-4" />
}

const ICON_BASE =
  'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors cursor-pointer select-none'

function activateOnKey(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }
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

  const toggleDir = () => {
    onChange(sort, sortDir === 'asc' ? 'desc' : 'asc')
  }

  const pickSort = (field: ThreadListSortField) => {
    if (field !== sort) {
      onChange(field, defaultSortDir(field))
    }
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <span
        role="button"
        tabIndex={0}
        aria-label="Toggle sort direction"
        onClick={toggleDir}
        onKeyDown={activateOnKey(toggleDir)}
        className={`${ICON_BASE} text-gray-600 hover:text-gray-900 hover:bg-gray-100`}
      >
        <SortDirectionIcon field={sort} dir={sortDir} />
      </span>

      <div ref={rootRef} className="relative">
        <span
          role="button"
          tabIndex={0}
          aria-label="Sort threads"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={activateOnKey(() => setOpen((v) => !v))}
          className={`${ICON_BASE} ${
            open ? 'text-vortex-red bg-red-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Filter className="w-4 h-4" />
        </span>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-20 min-w-[9.5rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {SORT_OPTIONS.map(({ field, label }) => {
              const active = sort === field
              return (
                <span
                  key={field}
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => pickSort(field)}
                  onKeyDown={activateOnKey(() => pickSort(field))}
                  className={`block w-full px-3 py-2 text-sm cursor-pointer ${
                    active ? 'bg-red-50 text-vortex-red font-semibold' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
