import {
  archiveClassEvent,
  updateClassEvent,
  updateTopProgram,
} from '../../utils/programsApi'
import { normalizeProgramPricingOptions } from '../../utils/programPricingOptions'
import { adminUpdateFormActiveDates } from '../../utils/schedulingApi'
import {
  formatOfferingsCell,
  type ClassSetupOffering,
  type ClassSetupOverviewRow,
} from '../../utils/classSetupOverviewApi'
import {
  OVERVIEW_COLUMNS,
  getCellDisplayValue,
  type OverviewColumnId,
} from './overviewColumns'

/** Fields that can be copied as scalar/program values (not embedded editors). */
export const COPYABLE_COLUMN_IDS: ReadonlySet<OverviewColumnId> = new Set([
  'primarySport',
  'program',
  'programDescription',
  'excludeFromDropIns',
  'className',
  'classDescription',
  'offerings',
  'skillLevel',
  'status',
  'active',
  'costPerClass',
  'fee1x',
  'costPerMonth',
])

const STATUS_COLUMNS: ReadonlySet<OverviewColumnId> = new Set(['status', 'active'])
const PRICING_COLUMNS: ReadonlySet<OverviewColumnId> = new Set([
  'costPerClass',
  'fee1x',
  'costPerMonth',
])

export function isCopyableColumn(columnId: OverviewColumnId): boolean {
  return COPYABLE_COLUMN_IDS.has(columnId)
}

export function isCompatibleCopyTarget(
  sourceColumnId: OverviewColumnId,
  targetColumnId: OverviewColumnId,
): boolean {
  if (sourceColumnId === targetColumnId) return true
  if (STATUS_COLUMNS.has(sourceColumnId) && STATUS_COLUMNS.has(targetColumnId)) return true
  if (PRICING_COLUMNS.has(sourceColumnId) && PRICING_COLUMNS.has(targetColumnId)) return true
  return false
}

export function cellKey(classId: number, columnId: OverviewColumnId): string {
  return `${classId}:${columnId}`
}

export function parseCellKey(key: string): { classId: number; columnId: OverviewColumnId } {
  const [classIdRaw, columnId] = key.split(':')
  return { classId: Number(classIdRaw), columnId: columnId as OverviewColumnId }
}

export function columnLabel(columnId: OverviewColumnId): string {
  return OVERVIEW_COLUMNS.find((c) => c.id === columnId)?.label ?? columnId
}

export interface CopyChangePreview {
  key: string
  classId: number
  className: string
  programName: string
  columnId: OverviewColumnId
  columnLabel: string
  fromDisplay: string
  toDisplay: string
  programLevel: boolean
}

const PROGRAM_LEVEL_COLUMNS: ReadonlySet<OverviewColumnId> = new Set([
  'primarySport',
  'programDescription',
  'excludeFromDropIns',
  'costPerClass',
  'fee1x',
  'costPerMonth',
])

export function isProgramLevelColumn(columnId: OverviewColumnId): boolean {
  return PROGRAM_LEVEL_COLUMNS.has(columnId)
}

function primaryOffering(row: ClassSetupOverviewRow): ClassSetupOffering | null {
  return row.offerings.find((offering) => offering.isSelected) ?? row.offerings[0] ?? null
}

function activeDatesEqual(a: ClassSetupOffering | null, b: ClassSetupOffering | null): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.startDate === b.startDate && (a.endDate ?? null) === (b.endDate ?? null)
}

function valuesEqualForColumn(
  source: ClassSetupOverviewRow,
  target: ClassSetupOverviewRow,
  columnId: OverviewColumnId,
): boolean {
  switch (columnId) {
    case 'primarySport':
      return source.primarySportId === target.primarySportId
    case 'program':
      return source.programsId === target.programsId
    case 'programDescription':
      return (source.programDescription ?? '') === (target.programDescription ?? '')
    case 'excludeFromDropIns':
      return source.excludeFromDropIns === target.excludeFromDropIns
    case 'className':
      return source.className === target.className
    case 'classDescription':
      return (source.classDescription ?? '') === (target.classDescription ?? '')
    case 'offerings':
      return activeDatesEqual(primaryOffering(source), primaryOffering(target))
    case 'skillLevel':
      return (source.skillLevel ?? '') === (target.skillLevel ?? '')
    case 'status':
    case 'active':
      return source.status === target.status
    case 'costPerClass':
    case 'fee1x':
    case 'costPerMonth':
      return (
        JSON.stringify(normalizeProgramPricingOptions(source.pricingCostOptions)) ===
        JSON.stringify(normalizeProgramPricingOptions(target.pricingCostOptions))
      )
    default:
      return getCellDisplayValue(source, columnId) === getCellDisplayValue(target, columnId)
  }
}

export function buildCopyChangePreviews(
  rows: ClassSetupOverviewRow[],
  sourceClassId: number,
  sourceColumnId: OverviewColumnId,
  targetKeys: Iterable<string>,
): CopyChangePreview[] {
  const byId = new Map(rows.map((row) => [row.classId, row]))
  const source = byId.get(sourceClassId)
  if (!source) return []

  const previews: CopyChangePreview[] = []
  for (const key of targetKeys) {
    const { classId, columnId } = parseCellKey(key)
    if (!isCompatibleCopyTarget(sourceColumnId, columnId)) continue
    if (classId === sourceClassId && columnId === sourceColumnId) continue
    const target = byId.get(classId)
    if (!target) continue
    if (valuesEqualForColumn(source, target, columnId)) continue

    const toDisplay =
      columnId === 'offerings'
        ? formatOfferingsCell(source.offerings)
        : previewToDisplay(source, columnId)
    previews.push({
      key,
      classId,
      className: target.className,
      programName: target.programName,
      columnId,
      columnLabel: columnLabel(columnId),
      fromDisplay: getCellDisplayValue(target, columnId),
      toDisplay,
      programLevel: isProgramLevelColumn(columnId),
    })
  }

  return previews.sort((a, b) => {
    const byClass = a.className.localeCompare(b.className, undefined, { sensitivity: 'base' })
    if (byClass !== 0) return byClass
    return a.columnLabel.localeCompare(b.columnLabel, undefined, { sensitivity: 'base' })
  })
}

function previewToDisplay(source: ClassSetupOverviewRow, targetColumnId: OverviewColumnId): string {
  // Synthesize a temporary row view so display helpers stay consistent.
  const projected: ClassSetupOverviewRow = {
    ...source,
    classId: source.classId,
  }
  if (STATUS_COLUMNS.has(targetColumnId)) {
    return getCellDisplayValue(projected, targetColumnId)
  }
  if (PRICING_COLUMNS.has(targetColumnId)) {
    return getCellDisplayValue(projected, targetColumnId)
  }
  return getCellDisplayValue(projected, targetColumnId)
}

export async function applyCopyToTarget(
  source: ClassSetupOverviewRow,
  target: ClassSetupOverviewRow,
  columnId: OverviewColumnId,
): Promise<void> {
  switch (columnId) {
    case 'primarySport':
      if (target.programsId == null) throw new Error(`“${target.className}” has no parent program`)
      await updateTopProgram(target.programsId, { primarySportId: source.primarySportId })
      break
    case 'program':
      if (source.programsId == null) throw new Error('Source class has no parent program')
      await updateClassEvent(target.classId, { programsId: source.programsId })
      break
    case 'programDescription':
      if (target.programsId == null) throw new Error(`“${target.className}” has no parent program`)
      await updateTopProgram(target.programsId, {
        description: source.programDescription?.trim() || null,
      })
      break
    case 'excludeFromDropIns':
      if (target.programsId == null) throw new Error(`“${target.className}” has no parent program`)
      await updateTopProgram(target.programsId, { excludeFromDropIns: source.excludeFromDropIns })
      break
    case 'className':
      await updateClassEvent(target.classId, { displayName: source.className })
      break
    case 'classDescription':
      await updateClassEvent(target.classId, {
        description: source.classDescription?.trim() || null,
      })
      break
    case 'offerings': {
      if (target.formId == null) {
        throw new Error(`“${target.className}” has no scheduling form for active dates`)
      }
      const sourceDates = primaryOffering(source)
      if (!sourceDates) {
        throw new Error('Source class has no active dates to copy')
      }
      await adminUpdateFormActiveDates(
        target.formId,
        sourceDates.evergreen || !sourceDates.endDate
          ? { startDate: sourceDates.startDate, evergreen: true }
          : { startDate: sourceDates.startDate, endDate: sourceDates.endDate },
      )
      break
    }
    case 'skillLevel':
      await updateClassEvent(target.classId, {
        skillLevel: (source.skillLevel || null) as ClassSetupOverviewRow['skillLevel'],
      })
      break
    case 'status':
    case 'active':
      if (source.status === 'Legacy') {
        await archiveClassEvent(target.classId, true)
      } else {
        if (target.classArchived) await archiveClassEvent(target.classId, false)
        await updateClassEvent(target.classId, { isActive: source.status === 'Active' })
      }
      break
    case 'costPerClass':
    case 'fee1x':
    case 'costPerMonth': {
      if (target.programsId == null) throw new Error(`“${target.className}” has no parent program`)
      await updateTopProgram(target.programsId, {
        pricingCostOptions: normalizeProgramPricingOptions(source.pricingCostOptions),
      })
      break
    }
    default:
      throw new Error(`Copy is not supported for ${columnLabel(columnId)}`)
  }
}

/** Apply previews, coalescing program-level updates that hit the same program. */
export async function applyCopyChangePreviews(
  source: ClassSetupOverviewRow,
  rowsById: Map<number, ClassSetupOverviewRow>,
  previews: CopyChangePreview[],
): Promise<void> {
  const appliedProgramKeys = new Set<string>()

  for (const preview of previews) {
    const target = rowsById.get(preview.classId)
    if (!target) throw new Error(`Class “${preview.className}” is no longer available`)

    if (preview.programLevel && target.programsId != null) {
      const dedupeKey = `${target.programsId}:${preview.columnId}`
      if (appliedProgramKeys.has(dedupeKey)) continue
      // Pricing columns all write the same payload — coalesce across the pricing group.
      if (PRICING_COLUMNS.has(preview.columnId)) {
        const pricingDedupe = `${target.programsId}:pricing`
        if (appliedProgramKeys.has(pricingDedupe)) continue
        appliedProgramKeys.add(pricingDedupe)
      }
      appliedProgramKeys.add(dedupeKey)
    }

    await applyCopyToTarget(source, target, preview.columnId)
  }
}

export function canReceiveCopy(
  sourceColumnId: OverviewColumnId,
  target: ClassSetupOverviewRow,
  targetColumnId: OverviewColumnId,
  source?: ClassSetupOverviewRow | null,
): boolean {
  if (!isCopyableColumn(targetColumnId)) return false
  if (!isCompatibleCopyTarget(sourceColumnId, targetColumnId)) return false
  if (isProgramLevelColumn(targetColumnId) && target.programsId == null) return false
  if (targetColumnId === 'program' && target.classId < 0) return false
  if (targetColumnId === 'offerings') {
    if (target.formId == null) return false
    if (source && source.offerings.length === 0) return false
  }
  return true
}
