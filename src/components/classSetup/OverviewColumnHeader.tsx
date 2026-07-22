import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ListFilter, X } from 'lucide-react'
import { type ClassSetupOverviewStatus } from '../../utils/classSetupOverviewApi'
import {
  type ColumnFilter,
  type ColumnFilters,
  type OverviewColumnDef,
  type SortConfig,
} from './overviewColumns'

interface Props {
  column: OverviewColumnDef
  sortConfig: SortConfig
  filter: ColumnFilter | undefined
  filterOptions?: string[]
  onSort: (columnId: OverviewColumnDef['id']) => void
  onFilterChange: (columnId: OverviewColumnDef['id'], filter: ColumnFilter | undefined) => void
  onColumnResizeStart: (columnId: OverviewColumnDef['id'], clientX: number) => void
  width: number
  collapsed: boolean
  onToggleCollapsed: () => void
}

const STATUS_OPTIONS: ClassSetupOverviewStatus[] = ['Active', 'Inactive', 'Legacy']

function FilterPopover({
  column,
  filter,
  filterOptions,
  onFilterChange,
  onClose,
}: {
  column: OverviewColumnDef
  filter: ColumnFilter | undefined
  filterOptions?: string[]
  onFilterChange: (filter: ColumnFilter | undefined) => void
  onClose: () => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [onClose])

  const clear = () => onFilterChange(undefined)

  if (column.filterKind === 'status') {
    const values = filter?.kind === 'status' ? filter.values : []
    return (
      <div ref={popoverRef} className="absolute top-full left-0 mt-1 z-30 w-44 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
        <div className="space-y-2">
          {STATUS_OPTIONS.map((status) => (
            <label key={status} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={values.includes(status)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...values, status]
                    : values.filter((v) => v !== status)
                  onFilterChange(next.length ? { kind: 'status', values: next } : undefined)
                }}
              />
              {status}
            </label>
          ))}
        </div>
        <button type="button" onClick={clear} className="mt-3 text-xs text-gray-500 hover:text-gray-800">
          Clear filter
        </button>
      </div>
    )
  }

  if (column.filterKind === 'skillLevel' || column.filterKind === 'primarySport') {
    const values = filter?.kind === 'multi' ? filter.values : []
    const options = filterOptions ?? []
    return (
      <div ref={popoverRef} className="absolute top-full left-0 mt-1 z-30 w-52 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg p-3">
        <div className="space-y-2">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={values.includes(option)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...values, option]
                    : values.filter((v) => v !== option)
                  onFilterChange(next.length ? { kind: 'multi', values: next } : undefined)
                }}
              />
              {option}
            </label>
          ))}
        </div>
        <button type="button" onClick={clear} className="mt-3 text-xs text-gray-500 hover:text-gray-800">
          Clear filter
        </button>
      </div>
    )
  }

  if (column.filterKind === 'numeric' || column.filterKind === 'currency') {
    const min = filter?.kind === 'numeric' || filter?.kind === 'currency' ? filter.min : ''
    const max = filter?.kind === 'numeric' || filter?.kind === 'currency' ? filter.max : ''
    const kind = column.filterKind === 'currency' ? 'currency' : 'numeric'
    return (
      <div ref={popoverRef} className="absolute top-full left-0 mt-1 z-30 w-48 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Min"
            value={min}
            onChange={(e) => {
              const nextMin = e.target.value
              const nextMax = max
              if (!nextMin && !nextMax) onFilterChange(undefined)
              else onFilterChange({ kind, min: nextMin, max: nextMax } as ColumnFilter)
            }}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <input
            type="number"
            placeholder="Max"
            value={max}
            onChange={(e) => {
              const nextMax = e.target.value
              const nextMin = min
              if (!nextMin && !nextMax) onFilterChange(undefined)
              else onFilterChange({ kind, min: nextMin, max: nextMax } as ColumnFilter)
            }}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <button type="button" onClick={clear} className="mt-3 text-xs text-gray-500 hover:text-gray-800">
          Clear filter
        </button>
      </div>
    )
  }

  const query = filter?.kind === 'text' ? filter.query : ''
  return (
    <div ref={popoverRef} className="absolute top-full left-0 mt-1 z-30 w-52 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
      <input
        type="text"
        placeholder="Contains…"
        value={query}
        onChange={(e) => {
          const next = e.target.value
          onFilterChange(next.trim() ? { kind: 'text', query: next } : undefined)
        }}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        autoFocus
      />
      <button type="button" onClick={clear} className="mt-3 text-xs text-gray-500 hover:text-gray-800">
        Clear filter
      </button>
    </div>
  )
}

const OverviewColumnHeader = ({
  column,
  sortConfig,
  filter,
  filterOptions,
  onSort,
  onFilterChange,
  onColumnResizeStart,
  width,
  collapsed,
  onToggleCollapsed,
}: Props) => {
  const [filterOpen, setFilterOpen] = useState(false)
  const isSorted = sortConfig.column === column.id
  const sortIcon =
    !isSorted ? (
      <ArrowUpDown className="w-3 h-3 opacity-50" />
    ) : sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    )
  const filterActive = Boolean(filter)

  return (
    <th
      className={`relative text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b border-gray-200 ${collapsed ? 'p-0 overflow-visible' : 'px-3 py-3'}`}
      style={{ width, minWidth: collapsed ? 5 : column.minWidth }}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="absolute left-1/2 top-1/2 z-20 flex h-5 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded bg-gray-50 text-gray-600 shadow-sm hover:bg-gray-200"
          title={`Expand ${column.label}`}
          aria-label={`Expand ${column.label} column`}
          aria-expanded="false"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      ) : <div className="flex items-center gap-1 pr-2">
        <span className="truncate">{column.label}</span>
        <button
          type="button"
          onClick={() => onSort(column.id)}
          className="shrink-0 p-0.5 rounded hover:bg-gray-200 text-gray-600"
          title="Sort"
          aria-label={`Sort by ${column.label}`}
        >
          {sortIcon}
        </button>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setFilterOpen((open) => !open)}
            className={`p-0.5 rounded hover:bg-gray-200 ${filterActive ? 'text-vortex-red' : 'text-gray-600'}`}
            title="Filter"
            aria-label={`Filter ${column.label}`}
          >
            <ListFilter className="w-3 h-3" />
          </button>
          {filterOpen && (
            <FilterPopover
              column={column}
              filter={filter}
              filterOptions={filterOptions}
              onFilterChange={(next) => onFilterChange(column.id, next)}
              onClose={() => setFilterOpen(false)}
            />
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="shrink-0 rounded p-0.5 text-gray-600 hover:bg-gray-200"
          title={`Collapse ${column.label}`}
          aria-label={`Collapse ${column.label} column`}
          aria-expanded="true"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
      </div>}
      {!collapsed && <button
        type="button"
        aria-label={`Resize ${column.label} column`}
        title={`Drag to resize ${column.label}`}
        className="group/resize absolute -right-1 top-0 z-20 h-full w-3 cursor-col-resize touch-none"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onColumnResizeStart(column.id, e.clientX)
        }}
      >
        <span className="absolute bottom-1 top-1 left-1/2 w-px -translate-x-1/2 bg-gray-300 transition-colors group-hover/resize:w-0.5 group-hover/resize:bg-vortex-red" />
      </button>}
    </th>
  )
}

export function ClearFiltersButton({
  filters,
  onClear,
}: {
  filters: ColumnFilters
  onClear: () => void
}) {
  const active = Object.values(filters).some(Boolean)
  if (!active) return null
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
    >
      <X className="w-3 h-3" />
      Clear filters
    </button>
  )
}

export default OverviewColumnHeader
