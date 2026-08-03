import {
  expandScheduleLines,
  type ClassSetupOverviewRow,
  type ClassSetupOverviewStatus,
} from '../../utils/classSetupOverviewApi'
import { compareSkillLevels, formatSkillLevel } from '../../utils/classDisplayUtils'

export type OverviewColumnId =
  | 'classId'
  | 'primarySport'
  | 'sportTags'
  | 'program'
  | 'programDescription'
  | 'className'
  | 'classDescription'
  | 'classNotes'
  | 'skillLevel'
  | 'activeDates'
  | 'days'
  | 'times'
  | 'capacity'
  | 'excludeFromDropIns'
  | 'status'
  | 'costPerMonth'

export type FilterKind = 'text' | 'numeric' | 'status' | 'skillLevel' | 'primarySport' | 'currency'

export interface OverviewColumnDef {
  id: OverviewColumnId
  label: string
  editable: boolean
  filterKind: FilterKind
  minWidth: number
  defaultWidth: number
}

/** Shared class/program fields — rowspan across schedule lines. */
export const GROUP_COLUMNS: OverviewColumnDef[] = [
  { id: 'classId', label: 'Class ID', editable: false, filterKind: 'numeric', minWidth: 80, defaultWidth: 90 },
  { id: 'primarySport', label: 'Primary Sport', editable: true, filterKind: 'primarySport', minWidth: 120, defaultWidth: 140 },
  { id: 'sportTags', label: 'Sport Tags', editable: true, filterKind: 'text', minWidth: 120, defaultWidth: 150 },
  { id: 'program', label: 'Program', editable: true, filterKind: 'text', minWidth: 120, defaultWidth: 160 },
  { id: 'programDescription', label: 'Program Description', editable: true, filterKind: 'text', minWidth: 160, defaultWidth: 200 },
  { id: 'className', label: 'Class', editable: true, filterKind: 'text', minWidth: 120, defaultWidth: 160 },
  { id: 'classDescription', label: 'Class Description', editable: true, filterKind: 'text', minWidth: 160, defaultWidth: 200 },
  { id: 'classNotes', label: 'Class Notes', editable: true, filterKind: 'text', minWidth: 140, defaultWidth: 180 },
  { id: 'skillLevel', label: 'Skill Level', editable: true, filterKind: 'skillLevel', minWidth: 100, defaultWidth: 120 },
]

/** Schedule parts shown per timeslot line (editing any opens the schedule editor). */
export const SCHEDULE_PART_COLUMN_IDS: ReadonlySet<OverviewColumnId> = new Set([
  'activeDates',
  'days',
  'times',
  'capacity',
])

/** Per scheduled timeslot line — one table row each. */
export const SCHEDULE_COLUMNS: OverviewColumnDef[] = [
  { id: 'activeDates', label: 'Active dates', editable: true, filterKind: 'text', minWidth: 120, defaultWidth: 140 },
  { id: 'days', label: 'Days', editable: true, filterKind: 'text', minWidth: 100, defaultWidth: 120 },
  { id: 'times', label: 'Times', editable: true, filterKind: 'text', minWidth: 110, defaultWidth: 130 },
  { id: 'capacity', label: 'Capacity', editable: true, filterKind: 'numeric', minWidth: 80, defaultWidth: 90 },
  { id: 'excludeFromDropIns', label: 'Allow Drop-ins', editable: true, filterKind: 'text', minWidth: 120, defaultWidth: 130 },
  { id: 'costPerMonth', label: 'Cost per Month', editable: true, filterKind: 'currency', minWidth: 130, defaultWidth: 160 },
  { id: 'status', label: 'Status', editable: true, filterKind: 'status', minWidth: 90, defaultWidth: 100 },
]

export const OVERVIEW_COLUMNS: OverviewColumnDef[] = [...GROUP_COLUMNS, ...SCHEDULE_COLUMNS]

export type ColumnDensity = 'min' | 'max'

/**
 * Non-label header chrome in OverviewColumnHeader:
 * th px-3 (24) + flex pr-2 (8) + gap-1 × 3 between label/actions (12)
 * + sort / filter / collapse buttons (16 each = 48) + safety for font variance.
 */
const HEADER_CHROME_PX = 112
/** Fallback when canvas measure is unavailable: text-xs uppercase tracking-wider. */
const HEADER_CHAR_PX = 9.2
const HEADER_TRACKING_PX = 0.6 // tracking-wider ≈ 0.05em at 12px
const CELL_PADDING_PX = 24
const MAX_COLUMN_PX = 560

let headerMeasureCtx: CanvasRenderingContext2D | null | undefined

/** Pixel width of the header label as rendered (uppercase, semibold, tracking-wider). */
function measureHeaderLabel(label: string): number {
  const upper = label.toUpperCase()
  if (typeof document !== 'undefined') {
    if (headerMeasureCtx === undefined) {
      headerMeasureCtx = document.createElement('canvas').getContext('2d')
    }
    if (headerMeasureCtx) {
      // Matches OverviewColumnHeader: text-xs font-semibold uppercase tracking-wider (Inter)
      headerMeasureCtx.font = '600 12px Inter, system-ui, sans-serif'
      const base = headerMeasureCtx.measureText(upper).width
      const tracking = Math.max(0, upper.length - 1) * HEADER_TRACKING_PX
      return Math.ceil(base + tracking)
    }
  }
  return Math.ceil(upper.length * HEADER_CHAR_PX)
}

/** Width that keeps the uppercase header label + chrome fully visible. */
export function headerFitWidth(label: string, minWidth: number): number {
  return Math.max(minWidth, measureHeaderLabel(label) + HEADER_CHROME_PX)
}

function estimateContentWidth(text: string, minWidth: number): number {
  const longest = text
    .split('\n')
    .reduce((max, line) => Math.max(max, line.trim().length), 0)
  return Math.min(MAX_COLUMN_PX, Math.max(minWidth, Math.ceil(longest * 8.1) + CELL_PADDING_PX))
}

function longestLineValue(rows: ClassSetupOverviewRow[], columnId: OverviewColumnId): string {
  let longest = ''
  const consider = (value: string) => {
    for (const line of value.split('\n')) {
      if (line.length > longest.length) longest = line
    }
  }

  for (const row of rows) {
    if (
      columnId === 'activeDates' ||
      columnId === 'days' ||
      columnId === 'times' ||
      columnId === 'capacity'
    ) {
      for (const scheduleLine of expandScheduleLines(row)) {
        consider(scheduleLine[columnId])
      }
    } else {
      consider(getCellDisplayValue(row, columnId))
    }
  }
  return longest
}

/** Min = header-fit; Max = widest of header-fit and cell content across rows. */
export function columnWidthsForDensity(
  density: ColumnDensity,
  rows: ClassSetupOverviewRow[] = [],
): Record<OverviewColumnId, number> {
  const widths = {} as Record<OverviewColumnId, number>
  for (const column of OVERVIEW_COLUMNS) {
    const headerWidth = headerFitWidth(column.label, column.minWidth)
    if (density === 'min') {
      widths[column.id] = headerWidth
      continue
    }
    const contentWidth = estimateContentWidth(longestLineValue(rows, column.id), column.minWidth)
    widths[column.id] = Math.max(headerWidth, contentWidth)
  }
  return widths
}

export type TextFilter = { kind: 'text'; query: string }
export type NumericFilter = { kind: 'numeric'; min: string; max: string }
export type StatusFilter = { kind: 'status'; values: ClassSetupOverviewStatus[] }
export type MultiSelectFilter = { kind: 'multi'; values: string[] }
export type CurrencyFilter = { kind: 'currency'; min: string; max: string }

export type ColumnFilter =
  | TextFilter
  | NumericFilter
  | StatusFilter
  | MultiSelectFilter
  | CurrencyFilter

export type ColumnFilters = Partial<Record<OverviewColumnId, ColumnFilter>>

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  column: OverviewColumnId | null
  direction: SortDirection
}

function parseCurrency(value: string | null | undefined): number | null {
  if (!value || value === '—') return null
  const n = Number(String(value).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function getCellDisplayValue(row: ClassSetupOverviewRow, columnId: OverviewColumnId): string {
  switch (columnId) {
    case 'classId':
      return String(row.classId)
    case 'primarySport':
      return row.primarySportName || '—'
    case 'sportTags':
      return row.sportTags?.trim() || '—'
    case 'program':
      return row.programName || '—'
    case 'programDescription':
      return row.programDescription?.trim() || '—'
    case 'excludeFromDropIns':
      // Column is "Allow Drop-ins": Yes = included in drop-in list (not excluded).
      return row.excludeFromDropIns ? 'No' : 'Yes'
    case 'className':
      return row.className || '—'
    case 'classDescription':
      return row.classDescription?.trim() || '—'
    case 'classNotes':
      return row.classNotes?.trim() || '—'
    case 'activeDates':
      return expandScheduleLines(row)
        .map((line) => line.activeDates)
        .join('\n')
    case 'days':
      return expandScheduleLines(row)
        .map((line) => line.days)
        .join('\n')
    case 'times':
      return expandScheduleLines(row)
        .map((line) => line.times)
        .join('\n')
    case 'capacity':
      return expandScheduleLines(row)
        .map((line) => line.capacity)
        .join('\n')
    case 'skillLevel':
      return formatSkillLevel(row.skillLevel)
    case 'status':
      return row.status
    case 'costPerMonth':
      return row.costPerMonthSummary || '—'
    default:
      return '—'
  }
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
}

export function compareOverviewRows(
  a: ClassSetupOverviewRow,
  b: ClassSetupOverviewRow,
  column: OverviewColumnId,
  direction: SortDirection,
): number {
  const dir = direction === 'asc' ? 1 : -1
  let cmp = 0

  switch (column) {
    case 'classId':
      cmp = a.classId - b.classId
      break
    case 'costPerMonth':
      cmp = compareStrings(a.costPerMonthSummary ?? '', b.costPerMonthSummary ?? '')
      break
    case 'skillLevel':
      cmp = compareSkillLevels(a.skillLevel, b.skillLevel)
      break
    default:
      cmp = compareStrings(getCellDisplayValue(a, column), getCellDisplayValue(b, column))
  }

  if (cmp !== 0) return cmp * dir
  return a.classId - b.classId
}

function matchesTextFilter(value: string, filter: TextFilter): boolean {
  if (!filter.query.trim()) return true
  return value.toLowerCase().includes(filter.query.trim().toLowerCase())
}

function matchesNumericFilter(value: number, filter: NumericFilter): boolean {
  const min = filter.min.trim() ? Number(filter.min) : null
  const max = filter.max.trim() ? Number(filter.max) : null
  if (min != null && Number.isFinite(min) && value < min) return false
  if (max != null && Number.isFinite(max) && value > max) return false
  return true
}

function matchesCurrencyFilter(value: string | null, filter: CurrencyFilter): boolean {
  const parsed = parseCurrency(value)
  if (parsed == null) {
    const hasBounds = filter.min.trim() || filter.max.trim()
    return !hasBounds
  }
  const min = filter.min.trim() ? Number(filter.min) : null
  const max = filter.max.trim() ? Number(filter.max) : null
  if (min != null && Number.isFinite(min) && parsed < min) return false
  if (max != null && Number.isFinite(max) && parsed > max) return false
  return true
}

export function applyOverviewFilters(
  rows: ClassSetupOverviewRow[],
  filters: ColumnFilters,
): ClassSetupOverviewRow[] {
  return rows.filter((row) =>
    OVERVIEW_COLUMNS.every((col) => {
      const filter = filters[col.id]
      if (!filter) return true
      const display = getCellDisplayValue(row, col.id)

      switch (filter.kind) {
        case 'text':
          return matchesTextFilter(display, filter)
        case 'numeric':
          return matchesNumericFilter(Number(display) || 0, filter)
        case 'currency':
          return matchesCurrencyFilter(row.costPerMonthSummary, filter)
        case 'status':
          return filter.values.length === 0 || filter.values.includes(row.status)
        case 'multi':
          if (filter.values.length === 0) return true
          if (col.id === 'skillLevel') {
            const skill = formatSkillLevel(row.skillLevel)
            return filter.values.includes(skill)
          }
          if (col.id === 'primarySport') {
            const sport = row.primarySportName || '—'
            return filter.values.includes(sport)
          }
          return filter.values.some((v) => display.toLowerCase().includes(v.toLowerCase()))
        default:
          return true
      }
    }),
  )
}

function normalizeSmartFilterText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function smartFilterTerms(query: string): string[] {
  const terms: string[] = []
  const matcher = /"([^"]+)"|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = matcher.exec(query)) !== null) {
    const term = normalizeSmartFilterText(match[1] || match[2] || '').trim()
    if (term) terms.push(term)
  }
  return terms
}

/** Match every search term anywhere across a Class Master row. Quoted text is treated as one phrase. */
export function matchesOverviewSmartFilter(row: ClassSetupOverviewRow, query: string): boolean {
  const terms = smartFilterTerms(query)
  if (terms.length === 0) return true
  const searchableText = normalizeSmartFilterText(
    [
      ...OVERVIEW_COLUMNS.map((column) => getCellDisplayValue(row, column.id)),
      ...expandScheduleLines(row).map((line) => line.scheduleText),
    ].join(' '),
  )
  return terms.every((term) => searchableText.includes(term))
}

export function hasActiveFilters(filters: ColumnFilters): boolean {
  return Object.values(filters).some((filter) => {
    if (!filter) return false
    if (filter.kind === 'text') return Boolean(filter.query.trim())
    if (filter.kind === 'numeric' || filter.kind === 'currency') {
      return Boolean(filter.min.trim() || filter.max.trim())
    }
    if (filter.kind === 'status' || filter.kind === 'multi') return filter.values.length > 0
    return false
  })
}

export function distinctSkillLevels(rows: ClassSetupOverviewRow[]): string[] {
  return [...new Set(rows.map((r) => formatSkillLevel(r.skillLevel)))].sort(compareStrings)
}

export function distinctPrimarySports(rows: ClassSetupOverviewRow[]): string[] {
  return [...new Set(rows.map((r) => r.primarySportName || '—'))].sort(compareStrings)
}
