import { useEffect, useMemo, useState } from 'react'
import { Archive, Loader2, Search, Trash2, X } from 'lucide-react'
import OverviewColumnHeader, { ClearFiltersButton } from './OverviewColumnHeader'
import AdminClassSetupOverviewCellEditor, { type EditTarget } from './AdminClassSetupOverviewCellEditor'
import AdminClassSetupCopyConfirmModal from './AdminClassSetupCopyConfirmModal'
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
import {
  applyCopyChangePreviews,
  buildCopyChangePreviews,
  canReceiveCopy,
  cellKey,
  isCopyableColumn,
} from './classSetupCopyPaste'
import { type ClassSetupOverviewRow } from '../../utils/classSetupOverviewApi'
import { archiveClassEvent, deleteClassEvent } from '../../utils/programsApi'

interface Props {
  rows: ClassSetupOverviewRow[]
  unlocked: boolean
  copyMode: boolean
  onCopyModeChange: (active: boolean) => void
  onRefresh: () => void
}

const tdBase = 'px-3 py-2 align-top text-sm text-gray-900 border-b border-gray-100'
const actionColumnWidth = 104

type CopySource = { classId: number; columnId: OverviewColumnId }

const AdminClassSetupOverviewTable = ({
  rows,
  unlocked,
  copyMode,
  onCopyModeChange,
  onRefresh,
}: Props) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'program', direction: 'asc' })
  const [filters, setFilters] = useState<ColumnFilters>({})
  const [smartFilter, setSmartFilter] = useState('')
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [collapsedColumns, setCollapsedColumns] = useState<Set<OverviewColumnId>>(() => new Set())
  const [pendingAction, setPendingAction] = useState<{ classId: number; kind: 'archive' | 'delete' } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copySource, setCopySource] = useState<CopySource | null>(null)
  const [copyTargets, setCopyTargets] = useState<Set<string>>(() => new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [copySaving, setCopySaving] = useState(false)
  const [copySaveError, setCopySaveError] = useState<string | null>(null)
  const { getColumnWidth, getRowHeight, startColumnResize, startRowResize } = useSpreadsheetResize()

  const resetCopySelection = () => {
    setCopySource(null)
    setCopyTargets(new Set())
    setConfirmOpen(false)
    setCopySaveError(null)
  }

  const exitCopyMode = () => {
    resetCopySelection()
    onCopyModeChange(false)
  }

  useEffect(() => {
    if (!copyMode) {
      setCopySource(null)
      setCopyTargets(new Set())
      setConfirmOpen(false)
      setCopySaveError(null)
      return
    }
    setEditTarget(null)
  }, [copyMode])

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
  const renderedColumnWidths = OVERVIEW_COLUMNS.map((column) =>
    collapsedColumns.has(column.id) ? 5 : getColumnWidth(column.id),
  )
  const tableWidth = renderedColumnWidths.reduce((total, width) => total + width, actionColumnWidth)

  const visibleRows = useMemo(() => {
    const filtered = applyOverviewFilters(rows, filters).filter((row) =>
      matchesOverviewSmartFilter(row, smartFilter),
    )
    if (!sortConfig.column) return filtered
    return [...filtered].sort((a, b) =>
      compareOverviewRows(a, b, sortConfig.column!, sortConfig.direction),
    )
  }, [rows, filters, smartFilter, sortConfig])

  const rowsById = useMemo(() => new Map(rows.map((row) => [row.classId, row])), [rows])

  const changePreviews = useMemo(() => {
    if (!copySource) return []
    return buildCopyChangePreviews(rows, copySource.classId, copySource.columnId, copyTargets)
  }, [rows, copySource, copyTargets])

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

  const handleCopyCellClick = (row: ClassSetupOverviewRow, columnId: OverviewColumnId) => {
    if (!isCopyableColumn(columnId)) return

    if (!copySource) {
      setCopySource({ classId: row.classId, columnId })
      setCopyTargets(new Set())
      return
    }

    const key = cellKey(row.classId, columnId)
    if (row.classId === copySource.classId && columnId === copySource.columnId) {
      // Re-clicking the source clears targets but keeps source; use Reset to fully clear.
      return
    }

    const sourceRow = rowsById.get(copySource.classId)
    if (!canReceiveCopy(copySource.columnId, row, columnId, sourceRow)) return

    setCopyTargets((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleCellClick = (row: ClassSetupOverviewRow, columnId: OverviewColumnId) => {
    if (copyMode) {
      handleCopyCellClick(row, columnId)
      return
    }
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

  const handleArchive = async (row: ClassSetupOverviewRow) => {
    if (!window.confirm(`Archive "${row.className}"? It will become inactive and remain in the database.`)) return
    setPendingAction({ classId: row.classId, kind: 'archive' })
    setActionError(null)
    try {
      await archiveClassEvent(row.classId, true)
      await onRefresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to archive class')
    } finally {
      setPendingAction(null)
    }
  }

  const handleDelete = async (row: ClassSetupOverviewRow) => {
    const enrolleeWarning = row.enrolleeCount > 0
      ? ` This class currently has ${row.enrolleeCount} enrollee${row.enrolleeCount === 1 ? '' : 's'}.`
      : ''
    if (!window.confirm(`Permanently delete "${row.className}" from the database?${enrolleeWarning} This cannot be undone.`)) return
    setPendingAction({ classId: row.classId, kind: 'delete' })
    setActionError(null)
    try {
      await deleteClassEvent(row.classId)
      await onRefresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete class')
    } finally {
      setPendingAction(null)
    }
  }

  const handleConfirmCopySave = async () => {
    if (!copySource) return
    const source = rowsById.get(copySource.classId)
    if (!source) {
      setCopySaveError('Source class is no longer available. Reset and try again.')
      return
    }

    setCopySaving(true)
    setCopySaveError(null)
    try {
      await applyCopyChangePreviews(source, rowsById, changePreviews)
      setConfirmOpen(false)
      exitCopyMode()
      await onRefresh()
    } catch (e) {
      setCopySaveError(e instanceof Error ? e.message : 'Failed to save copied values')
    } finally {
      setCopySaving(false)
    }
  }

  const copyToastMessage = !copySource
    ? 'Select field to copy'
    : 'Select the cells within which you want to apply the copy.'

  const cellCopyState = (
    row: ClassSetupOverviewRow,
    columnId: OverviewColumnId,
  ): 'source' | 'viable' | 'target' | 'disabled' | null => {
    if (!copyMode) return null
    if (!isCopyableColumn(columnId)) return 'disabled'
    if (copySource) {
      const key = cellKey(row.classId, columnId)
      if (row.classId === copySource.classId && columnId === copySource.columnId) return 'source'
      if (copyTargets.has(key)) return 'target'
      const sourceRow = rowsById.get(copySource.classId)
      if (canReceiveCopy(copySource.columnId, row, columnId, sourceRow)) return 'viable'
      return 'disabled'
    }
    return null
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

      {copyMode && (
        <div
          className="mb-3 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p className="text-sm font-bold text-amber-950">{copyToastMessage}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={resetCopySelection}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-950 hover:bg-amber-100"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={exitCopyMode}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setCopySaveError(null)
                setConfirmOpen(true)
              }}
              disabled={!copySource || copyTargets.size === 0 || changePreviews.length === 0}
              className="rounded-lg bg-vortex-red px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
        {actionError && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
            {actionError}
          </div>
        )}
        <table
          className="border-collapse"
          style={{ tableLayout: 'fixed', width: tableWidth, minWidth: '100%' }}
        >
          <colgroup>
            {OVERVIEW_COLUMNS.map((column, index) => (
              <col key={column.id} style={{ width: renderedColumnWidths[index] }} />
            ))}
            <col style={{ width: actionColumnWidth }} />
          </colgroup>
          <thead>
            <tr>
              {OVERVIEW_COLUMNS.map((column, columnIndex) => (
                <OverviewColumnHeader
                  key={column.id}
                  column={column}
                  sortConfig={sortConfig}
                  filter={filters[column.id]}
                  filterOptions={filterOptionsFor(column.id)}
                  onSort={handleSort}
                  onFilterChange={handleFilterChange}
                  onColumnResizeStart={startColumnResize}
                  width={renderedColumnWidths[columnIndex]}
                  collapsed={collapsedColumns.has(column.id)}
                  onToggleCollapsed={() => toggleColumnCollapsed(column.id)}
                />
              ))}
              <th
                scope="col"
                className="border-b border-l border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                style={{ width: actionColumnWidth, minWidth: actionColumnWidth }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const rowHeight = getRowHeight(row.classId)
              return (
                <tr key={row.classId} className="hover:bg-gray-50/60 group relative">
                  {OVERVIEW_COLUMNS.map((column, columnIndex) => {
                    const value = getCellDisplayValue(row, column.id)
                    const collapsed = collapsedColumns.has(column.id)
                    const columnWidth = renderedColumnWidths[columnIndex]
                    const copyState = cellCopyState(row, column.id)
                    const editable = column.editable && unlocked && !copyMode

                    let copyClass = ''
                    if (copyMode && !collapsed) {
                      if (copyState === 'source') {
                        copyClass = 'bg-green-200 text-green-950 cursor-default'
                      } else if (copyState === 'target') {
                        copyClass = 'bg-orange-300 text-orange-950 cursor-pointer'
                      } else if (copyState === 'viable') {
                        copyClass = 'bg-yellow-200 text-yellow-950 cursor-pointer hover:bg-yellow-300'
                      } else if (copyState === 'disabled' || !isCopyableColumn(column.id)) {
                        copyClass = 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      } else {
                        // Awaiting source selection — copyable cells stay interactive.
                        copyClass = 'cursor-pointer hover:bg-amber-100'
                      }
                    }

                    return (
                      <td
                        key={column.id}
                        className={`${collapsed ? 'p-0 border-b border-gray-100' : tdBase} ${
                          editable && !collapsed ? 'cursor-pointer hover:bg-vortex-red/5' : ''
                        } ${copyClass}`}
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
                  <td
                    className="border-b border-l border-gray-100 px-2 py-2 align-top"
                    style={{ width: actionColumnWidth, minWidth: actionColumnWidth }}
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleArchive(row)}
                        disabled={copyMode || row.classArchived || pendingAction?.classId === row.classId}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={`Archive ${row.className}`}
                        title={row.classArchived ? 'Already archived' : 'Archive class'}
                      >
                        {pendingAction?.classId === row.classId && pendingAction.kind === 'archive'
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Archive className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row)}
                        disabled={copyMode || pendingAction?.classId === row.classId}
                        className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={`Permanently delete ${row.className}`}
                        title="Permanently delete class"
                      >
                        {pendingAction?.classId === row.classId && pendingAction.kind === 'delete'
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={OVERVIEW_COLUMNS.length + 1} className="px-4 py-12 text-center text-sm text-gray-500">
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
      />

      <AdminClassSetupCopyConfirmModal
        open={confirmOpen}
        changes={changePreviews}
        saving={copySaving}
        error={copySaveError}
        onClose={() => {
          if (!copySaving) {
            setConfirmOpen(false)
            setCopySaveError(null)
          }
        }}
        onConfirm={() => void handleConfirmCopySave()}
      />
    </>
  )
}

export default AdminClassSetupOverviewTable
