import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import OverviewColumnHeader, { ClearFiltersButton } from './OverviewColumnHeader'
import AdminClassSetupOverviewCellEditor, { type EditTarget } from './AdminClassSetupOverviewCellEditor'
import { useSpreadsheetResize } from './useSpreadsheetResize'
import {
  OVERVIEW_COLUMNS,
  applyOverviewFilters,
  compareOverviewRows,
  distinctPrimarySports,
  distinctSkillLevels,
  getCellDisplayValue,
  matchesOverviewSmartFilter,
  type ColumnFilters,
  type OverviewColumnId,
  type SortConfig,
} from './overviewColumns'
import { type ClassSetupOverviewRow } from '../../utils/classSetupOverviewApi'
import { type SchedulingNavigationIntent } from '../../utils/schedulingNavigation'

interface Props {
  rows: ClassSetupOverviewRow[]
  unlocked: boolean
  onRefresh: () => void
  onOpenScheduling?: (intent: SchedulingNavigationIntent) => void
}

const tdBase = 'px-3 py-2 align-top text-sm text-gray-900 border-b border-gray-100'

const AdminClassSetupOverviewTable = ({
  rows,
  unlocked,
  onRefresh,
  onOpenScheduling,
}: Props) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'program', direction: 'asc' })
  const [filters, setFilters] = useState<ColumnFilters>({})
  const [smartFilter, setSmartFilter] = useState('')
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [collapsedColumns, setCollapsedColumns] = useState<Set<OverviewColumnId>>(() => new Set())
  const { getColumnWidth, getRowHeight, startColumnResize, startRowResize } = useSpreadsheetResize()

  const toggleColumnCollapsed = (columnId: OverviewColumnId) => {
    setCollapsedColumns((previous) => {
      const next = new Set(previous)
      if (next.has(columnId)) next.delete(columnId)
      else next.add(columnId)
      return next
    })
  }

  const skillLevelOptions = useMemo(() => distinctSkillLevels(rows), [rows])
  const primarySportOptions = useMemo(() => distinctPrimarySports(rows), [rows])

  const visibleRows = useMemo(() => {
    const filtered = applyOverviewFilters(rows, filters).filter((row) =>
      matchesOverviewSmartFilter(row, smartFilter),
    )
    if (!sortConfig.column) return filtered
    return [...filtered].sort((a, b) =>
      compareOverviewRows(a, b, sortConfig.column!, sortConfig.direction),
    )
  }, [rows, filters, smartFilter, sortConfig])

  const handleSort = (columnId: OverviewColumnId) => {
    setSortConfig((prev) => {
      if (prev.column !== columnId) {
        return { column: columnId, direction: 'asc' }
      }
      if (prev.direction === 'asc') {
        return { column: columnId, direction: 'desc' }
      }
      return { column: null, direction: 'asc' }
    })
  }

  const handleFilterChange = (columnId: OverviewColumnId, filter: ColumnFilters[OverviewColumnId]) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (filter) next[columnId] = filter
      else delete next[columnId]
      return next
    })
  }

  const handleCellClick = (row: ClassSetupOverviewRow, columnId: OverviewColumnId) => {
    if (!unlocked) return
    const col = OVERVIEW_COLUMNS.find((c) => c.id === columnId)
    if (!col?.editable) return
    setEditTarget({ row, columnId })
  }

  const filterOptionsFor = (columnId: OverviewColumnId): string[] | undefined => {
    if (columnId === 'skillLevel') return skillLevelOptions
    if (columnId === 'primarySport') return primarySportOptions
    return undefined
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={smartFilter}
            onChange={(event) => setSmartFilter(event.target.value)}
            placeholder="Filter classes by name, program, sport, schedule, skill, status…"
            aria-label="Smart filter Class Master"
            className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-9 text-sm text-gray-900 outline-none transition focus:border-vortex-red focus:ring-2 focus:ring-vortex-red/15"
          />
          {smartFilter && (
            <button
              type="button"
              onClick={() => setSmartFilter('')}
              aria-label="Clear smart filter"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {(smartFilter.trim() || visibleRows.length !== rows.length) && (
            <span className="whitespace-nowrap text-xs text-gray-500">
              {visibleRows.length} of {rows.length} classes
            </span>
          )}
          <ClearFiltersButton filters={filters} onClear={() => setFilters({})} />
        </div>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
        <table className="min-w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {OVERVIEW_COLUMNS.map((column) => (
                <OverviewColumnHeader
                  key={column.id}
                  column={column}
                  sortConfig={sortConfig}
                  filter={filters[column.id]}
                  filterOptions={filterOptionsFor(column.id)}
                  onSort={handleSort}
                  onFilterChange={handleFilterChange}
                  onColumnResizeStart={startColumnResize}
                  width={collapsedColumns.has(column.id) ? 5 : getColumnWidth(column.id)}
                  collapsed={collapsedColumns.has(column.id)}
                  onToggleCollapsed={() => toggleColumnCollapsed(column.id)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const rowHeight = getRowHeight(row.classId)
              return (
                <tr key={row.classId} className="hover:bg-gray-50/60 group relative">
                  {OVERVIEW_COLUMNS.map((column, columnIndex) => {
                    const value = getCellDisplayValue(row, column.id)
                    const editable = column.editable && unlocked
                    const collapsed = collapsedColumns.has(column.id)
                    const columnWidth = collapsed ? 5 : getColumnWidth(column.id)
                    return (
                      <td
                        key={column.id}
                        className={`${collapsed ? 'p-0 border-b border-gray-100' : tdBase} ${editable && !collapsed ? 'cursor-pointer hover:bg-vortex-red/5' : ''} ${
                          columnIndex === 0 ? 'relative' : ''
                        }`}
                        style={{
                          width: columnWidth,
                          maxWidth: columnWidth,
                          height: rowHeight,
                          overflow: 'hidden',
                        }}
                        title={value}
                        onClick={() => !collapsed && handleCellClick(row, column.id)}
                      >
                        {!collapsed && <div className="line-clamp-[8] whitespace-pre-wrap break-words">{value}</div>}
                        {columnIndex === 0 && !collapsed && (
                          <button
                            type="button"
                            aria-label="Resize row"
                            className="absolute left-0 right-0 -bottom-1 h-2 cursor-row-resize opacity-0 group-hover:opacity-100 hover:bg-vortex-red/20"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              startRowResize(row.classId, e.clientY)
                            }}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={OVERVIEW_COLUMNS.length} className="px-4 py-12 text-center text-sm text-gray-500">
                  No classes match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminClassSetupOverviewCellEditor
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={onRefresh}
        onOpenScheduling={onOpenScheduling}
      />
    </>
  )
}

export default AdminClassSetupOverviewTable
