import {
  formatOfferingsCell,
  formatOfferingDescriptionsCell,
  formatScheduleCell,
  formatSpacesCell,
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
  | 'offerings'
  | 'offeringDescription'
  | 'schedule'
  | 'skillLevel'
  | 'spaces'
  | 'status'
  | 'costPerClass'
  | 'fee1x'
  | 'costPerMonth'
  | 'active'
  | 'enrollees'

export type FilterKind = 'text' | 'numeric' | 'status' | 'skillLevel' | 'primarySport' | 'currency'

export interface OverviewColumnDef {
  id: OverviewColumnId
  label: string
  editable: boolean
  filterKind: FilterKind
  minWidth: number
  defaultWidth: number
}

export const OVERVIEW_COLUMNS: OverviewColumnDef[] = [
  { id: 'classId', label: 'Class ID', editable: false, filterKind: 'numeric', minWidth: 80, defaultWidth: 90 },
  { id: 'primarySport', label: 'Primary Sport', editable: true, filterKind: 'primarySport', minWidth: 120, defaultWidth: 140 },
  { id: 'sportTags', label: 'Sport Tags', editable: true, filterKind: 'text', minWidth: 120, defaultWidth: 150 },
  { id: 'program', label: 'Program', editable: true, filterKind: 'text', minWidth: 120, defaultWidth: 160 },
  { id: 'programDescription', label: 'Program Description', editable: true, filterKind: 'text', minWidth: 160, defaultWidth: 200 },
  { id: 'className', label: 'Class', editable: true, filterKind: 'text', minWidth: 120, defaultWidth: 160 },
  { id: 'classDescription', label: 'Class Description', editable: true, filterKind: 'text', minWidth: 160, defaultWidth: 200 },
  { id: 'offerings', label: 'Offerings', editable: true, filterKind: 'text', minWidth: 140, defaultWidth: 180 },
  { id: 'offeringDescription', label: 'Offering Description', editable: true, filterKind: 'text', minWidth: 140, defaultWidth: 180 },
  { id: 'schedule', label: 'Schedule', editable: true, filterKind: 'text', minWidth: 160, defaultWidth: 220 },
  { id: 'skillLevel', label: 'Skill Level', editable: true, filterKind: 'skillLevel', minWidth: 100, defaultWidth: 120 },
  { id: 'spaces', label: 'Spaces', editable: true, filterKind: 'text', minWidth: 90, defaultWidth: 100 },
  { id: 'costPerClass', label: 'Cost per Class', editable: true, filterKind: 'currency', minWidth: 110, defaultWidth: 120 },
  { id: 'fee1x', label: 'Monthly 1×/Week', editable: true, filterKind: 'currency', minWidth: 120, defaultWidth: 140 },
  { id: 'costPerMonth', label: 'Cost per Month', editable: true, filterKind: 'currency', minWidth: 130, defaultWidth: 160 },
  { id: 'status', label: 'Status', editable: true, filterKind: 'status', minWidth: 90, defaultWidth: 100 },
  { id: 'active', label: 'Active', editable: true, filterKind: 'text', minWidth: 80, defaultWidth: 90 },
  { id: 'enrollees', label: 'Enrollees', editable: false, filterKind: 'numeric', minWidth: 90, defaultWidth: 100 },
]

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
    case 'className':
      return row.className || '—'
    case 'classDescription':
      return row.classDescription?.trim() || '—'
    case 'offerings':
      return formatOfferingsCell(row.offerings)
    case 'offeringDescription':
      return formatOfferingDescriptionsCell(row.offerings)
    case 'schedule':
      return formatScheduleCell(row.slotGroups)
    case 'skillLevel':
      return formatSkillLevel(row.skillLevel)
    case 'spaces':
      return formatSpacesCell(row.slotGroups)
    case 'status':
      return row.status
    case 'costPerClass':
      return row.costPerClass || '—'
    case 'fee1x':
      return row.fee1x || '—'
    case 'costPerMonth':
      return row.costPerMonthSummary || '—'
    case 'active':
      return row.classIsActive ? 'Yes' : 'No'
    case 'enrollees':
      return String(row.enrolleeCount)
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
    case 'enrollees':
      cmp = a[column === 'classId' ? 'classId' : 'enrolleeCount'] - b[column === 'classId' ? 'classId' : 'enrolleeCount']
      break
    case 'costPerClass':
    case 'fee1x': {
      const key = column === 'costPerClass' ? 'costPerClass' : 'fee1x'
      const av = parseCurrency(a[key]) ?? -1
      const bv = parseCurrency(b[key]) ?? -1
      cmp = av - bv
      break
    }
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
          return matchesCurrencyFilter(
            col.id === 'costPerClass' ? row.costPerClass : col.id === 'fee1x' ? row.fee1x : row.costPerMonthSummary,
            filter,
          )
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
    OVERVIEW_COLUMNS.map((column) => getCellDisplayValue(row, column.id)).join(' '),
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
