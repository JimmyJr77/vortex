import { useCallback, useEffect, useState } from 'react'
import { OVERVIEW_COLUMNS, type OverviewColumnId } from './overviewColumns'

const STORAGE_KEY = 'vortex-class-setup-overview-sizes'

type StoredSizes = {
  columnWidths: Partial<Record<OverviewColumnId, number>>
  rowHeights: Record<number, number>
}

const DEFAULT_COLUMN_WIDTHS = Object.fromEntries(
  OVERVIEW_COLUMNS.map((c) => [c.id, c.defaultWidth]),
) as Record<OverviewColumnId, number>

function loadStoredSizes(): StoredSizes {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { columnWidths: {}, rowHeights: {} }
    const parsed = JSON.parse(raw) as StoredSizes
    return {
      columnWidths: parsed.columnWidths ?? {},
      rowHeights: parsed.rowHeights ?? {},
    }
  } catch {
    return { columnWidths: {}, rowHeights: {} }
  }
}

function persistSizes(sizes: StoredSizes) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sizes))
  } catch {
    /* ignore quota errors */
  }
}

const MIN_ROW_HEIGHT = 40
const MAX_ROW_HEIGHT = 240
const DEFAULT_ROW_HEIGHT = 44

export function useSpreadsheetResize() {
  const [columnWidths, setColumnWidths] = useState<Record<OverviewColumnId, number>>(() => ({
    ...DEFAULT_COLUMN_WIDTHS,
    ...loadStoredSizes().columnWidths,
  }))
  const [rowHeights, setRowHeights] = useState<Record<number, number>>(
    () => loadStoredSizes().rowHeights,
  )

  useEffect(() => {
    persistSizes({ columnWidths, rowHeights })
  }, [columnWidths, rowHeights])

  const getColumnWidth = useCallback(
    (columnId: OverviewColumnId) => {
      const def = OVERVIEW_COLUMNS.find((c) => c.id === columnId)
      return columnWidths[columnId] ?? def?.defaultWidth ?? 120
    },
    [columnWidths],
  )

  const getRowHeight = useCallback(
    (classId: number) => rowHeights[classId] ?? DEFAULT_ROW_HEIGHT,
    [rowHeights],
  )

  const startColumnResize = useCallback(
    (columnId: OverviewColumnId, startX: number) => {
      const def = OVERVIEW_COLUMNS.find((c) => c.id === columnId)
      const minWidth = def?.minWidth ?? 80
      const startWidth = getColumnWidth(columnId)

      const onMove = (event: MouseEvent) => {
        const next = Math.min(480, Math.max(minWidth, startWidth + (event.clientX - startX)))
        setColumnWidths((prev) => ({ ...prev, [columnId]: next }))
      }

      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [getColumnWidth],
  )

  const startRowResize = useCallback((classId: number, startY: number) => {
    const startHeight = rowHeights[classId] ?? DEFAULT_ROW_HEIGHT

    const onMove = (event: MouseEvent) => {
      const next = Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, startHeight + (event.clientY - startY)))
      setRowHeights((prev) => ({ ...prev, [classId]: next }))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [rowHeights])

  return {
    getColumnWidth,
    getRowHeight,
    startColumnResize,
    startRowResize,
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
  }
}
