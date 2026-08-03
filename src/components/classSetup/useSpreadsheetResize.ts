import { useCallback, useEffect, useState } from 'react'
import {
  OVERVIEW_COLUMNS,
  columnWidthsForDensity,
  type ColumnDensity,
  type OverviewColumnId,
} from './overviewColumns'
import { type ClassSetupOverviewRow } from '../../utils/classSetupOverviewApi'

const STORAGE_KEY = 'vortex-class-setup-overview-sizes'
const DENSITY_STORAGE_KEY = 'vortex-class-setup-column-density'

type StoredSizes = {
  columnWidths: Partial<Record<OverviewColumnId, number>>
  rowHeights: Record<number, number>
}

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

function loadStoredDensity(): ColumnDensity {
  try {
    const raw = sessionStorage.getItem(DENSITY_STORAGE_KEY)
    return raw === 'max' ? 'max' : 'min'
  } catch {
    return 'min'
  }
}

function persistDensity(density: ColumnDensity) {
  try {
    sessionStorage.setItem(DENSITY_STORAGE_KEY, density)
  } catch {
    /* ignore quota errors */
  }
}

const MIN_ROW_HEIGHT = 40
const MAX_ROW_HEIGHT = 240
const DEFAULT_ROW_HEIGHT = 44
const MAX_DRAG_COLUMN_PX = 720

export function useSpreadsheetResize(rows: ClassSetupOverviewRow[], density: ColumnDensity) {
  const [columnWidths, setColumnWidths] = useState<Record<OverviewColumnId, number>>(() =>
    columnWidthsForDensity(loadStoredDensity()),
  )
  const [rowHeights, setRowHeights] = useState<Record<number, number>>(
    () => loadStoredSizes().rowHeights,
  )

  useEffect(() => {
    persistSizes({ columnWidths, rowHeights })
  }, [columnWidths, rowHeights])

  useEffect(() => {
    persistDensity(density)
    setColumnWidths(columnWidthsForDensity(density, rows))
    // Re-apply presets when density toggles; Max also refreshes when row data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- min keeps manual widths across row refreshes
  }, [density])

  useEffect(() => {
    if (density !== 'max') return
    setColumnWidths(columnWidthsForDensity('max', rows))
  }, [density, rows])

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
        const next = Math.min(
          MAX_DRAG_COLUMN_PX,
          Math.max(minWidth, startWidth + (event.clientX - startX)),
        )
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
      const next = Math.min(
        MAX_ROW_HEIGHT,
        Math.max(MIN_ROW_HEIGHT, startHeight + (event.clientY - startY)),
      )
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

export { loadStoredDensity }
