import { useMemo, useState } from 'react'
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
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const { getColumnWidth, getRowHeight, startColumnResize, startRowResize } = useSpreadsheetResize()

  const skillLevelOptions = useMemo(() => distinctSkillLevels(rows), [rows])
  const primarySportOptions = useMemo(() => distinctPrimarySports(rows), [rows])

  const visibleRows = useMemo(() => {
    const filtered = applyOverviewFilters(rows, filters)
    if (!sortConfig.column) return filtered
    return [...filtered].sort((a, b) =>
      compareOverviewRows(a, b, sortConfig.column!, sortConfig.direction),
    )
  }, [rows, filters, sortConfig])

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
      <div className="mb-3">
        <ClearFiltersButton filters={filters} onClear={() => setFilters({})} />
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
                  width={getColumnWidth(column.id)}
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
                    return (
                      <td
                        key={column.id}
                        className={`${tdBase} ${editable ? 'cursor-pointer hover:bg-vortex-red/5' : ''} ${
                          columnIndex === 0 ? 'relative' : ''
                        }`}
                        style={{
                          width: getColumnWidth(column.id),
                          maxWidth: getColumnWidth(column.id),
                          height: rowHeight,
                          overflow: 'hidden',
                        }}
                        title={value}
                        onClick={() => handleCellClick(row, column.id)}
                      >
                        <div className="line-clamp-[8] whitespace-pre-wrap break-words">{value}</div>
                        {columnIndex === 0 && (
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
