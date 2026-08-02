import {
  archiveClassEvent,
  fetchProgramDisciplineTags,
  linkProgramDisciplineTag,
  unlinkProgramDisciplineTag,
  updateClassEvent,
  updateTopProgram,
} from '../../utils/programsApi'
import { normalizeProgramPricingOptions } from '../../utils/programPricingOptions'
import {
  adminCreateSlotBatch,
  adminDeleteSlotGroup,
  adminEnsureFormActiveDates,
  adminFetchSchedulingForm,
  type SchedulingSlotGroup,
  type SlotBatchPayload,
} from '../../utils/schedulingApi'
import {
  formatScheduleCell,
  type ClassSetupOverviewRow,
} from '../../utils/classSetupOverviewApi'
import {
  OVERVIEW_COLUMNS,
  getCellDisplayValue,
  type OverviewColumnId,
} from './overviewColumns'

/** Fields that can be copied as values across Class Master rows. */
export const COPYABLE_COLUMN_IDS: ReadonlySet<OverviewColumnId> = new Set([
  'primarySport',
  'sportTags',
  'program',
  'programDescription',
  'excludeFromDropIns',
  'className',
  'classDescription',
  'skillLevel',
  'schedule',
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
  'sportTags',
  'programDescription',
  'excludeFromDropIns',
  'costPerClass',
  'fee1x',
  'costPerMonth',
])

export function isProgramLevelColumn(columnId: OverviewColumnId): boolean {
  return PROGRAM_LEVEL_COLUMNS.has(columnId)
}

function sportTagIds(row: ClassSetupOverviewRow): number[] {
  return [...(row.sportTagIds ?? [])].map(Number).filter((id) => Number.isFinite(id)).sort((a, b) => a - b)
}

function valuesEqualForColumn(
  source: ClassSetupOverviewRow,
  target: ClassSetupOverviewRow,
  columnId: OverviewColumnId,
): boolean {
  switch (columnId) {
    case 'primarySport':
      return source.primarySportId === target.primarySportId
    case 'sportTags':
      return JSON.stringify(sportTagIds(source)) === JSON.stringify(sportTagIds(target))
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
    case 'schedule':
      return (
        formatScheduleCell(source.slotGroups, source.offerings) ===
        formatScheduleCell(target.slotGroups, target.offerings)
      )
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

    previews.push({
      key,
      classId,
      className: target.className,
      programName: target.programName,
      columnId,
      columnLabel: columnLabel(columnId),
      fromDisplay: getCellDisplayValue(target, columnId),
      toDisplay: getCellDisplayValue(source, columnId),
      programLevel: isProgramLevelColumn(columnId),
    })
  }

  return previews.sort((a, b) => {
    const byClass = a.className.localeCompare(b.className, undefined, { sensitivity: 'base' })
    if (byClass !== 0) return byClass
    return a.columnLabel.localeCompare(b.columnLabel, undefined, { sensitivity: 'base' })
  })
}

function normalizeTime(time: string): string {
  return time.length >= 5 ? time.slice(0, 5) : time
}

/** Build a create-slot-batch payload that recreates an existing slot group. */
export function slotGroupToBatchPayload(
  group: SchedulingSlotGroup,
  offeringId: number | null,
): SlotBatchPayload {
  const base = {
    offeringId,
    activeDatesMode: 'inherit' as const,
    maxParticipants: group.maxParticipants,
  }

  if (group.scheduleMode === 'date') {
    const byDate = new Map<string, { startTime: string; endTime: string }[]>()
    for (const occ of group.occurrences) {
      const date = occ.specificDate
      if (!date) continue
      if (!byDate.has(date)) byDate.set(date, [])
      byDate.get(date)!.push({
        startTime: normalizeTime(occ.startTime),
        endTime: normalizeTime(occ.endTime),
      })
    }
    return {
      ...base,
      scheduleMode: 'date',
      dateSchedule: {
        entries: [...byDate.entries()].map(([date, times]) => ({
          type: 'single' as const,
          date,
          times,
        })),
      },
    }
  }

  const byWeek = new Map<string, Map<number, { startTime: string; endTime: string }[]>>()
  for (const occ of group.occurrences) {
    if (occ.dayOfWeek == null) continue
    const week = (occ.weekLetter || 'A').trim() || 'A'
    if (!byWeek.has(week)) byWeek.set(week, new Map())
    const days = byWeek.get(week)!
    if (!days.has(occ.dayOfWeek)) days.set(occ.dayOfWeek, [])
    days.get(occ.dayOfWeek)!.push({
      startTime: normalizeTime(occ.startTime),
      endTime: normalizeTime(occ.endTime),
    })
  }

  return {
    ...base,
    scheduleMode: 'day',
    daySchedule: {
      weeks: [...byWeek.entries()].map(([weekLetter, days]) => ({
        weekLetter,
        days: [...days.entries()].map(([dayOfWeek, times]) => ({
          dayOfWeek,
          times,
        })),
      })),
    },
  }
}

async function applySportTagsCopy(
  source: ClassSetupOverviewRow,
  target: ClassSetupOverviewRow,
): Promise<void> {
  if (target.programsId == null) throw new Error(`“${target.className}” has no parent program`)
  const desired = new Set(sportTagIds(source))
  // Prefer live target tags so we don't leave stale links when overview is slightly behind.
  const currentTags = await fetchProgramDisciplineTags(target.programsId)
  const currentIds = new Set(
    currentTags
      .map((tag) => tag.id)
      .filter((id) => id !== target.primarySportId && id !== source.primarySportId),
  )

  for (const id of currentIds) {
    if (!desired.has(id)) await unlinkProgramDisciplineTag(target.programsId, id)
  }
  for (const id of desired) {
    if (id === target.primarySportId) continue
    if (!currentIds.has(id)) await linkProgramDisciplineTag(target.programsId, id)
  }
}

async function applyScheduleCopy(
  source: ClassSetupOverviewRow,
  target: ClassSetupOverviewRow,
): Promise<void> {
  if (source.formId == null) throw new Error('Source class has no scheduling form')
  if (target.formId == null) throw new Error(`“${target.className}” has no scheduling form`)

  const sourceDetail = await adminFetchSchedulingForm(source.formId)
  const sourceGroups = sourceDetail.slotGroups ?? []
  if (sourceGroups.length === 0) {
    throw new Error('Source class has no schedule slots to copy')
  }

  const offering = await adminEnsureFormActiveDates(target.formId, {
    startDate: sourceDetail.startDate,
    endDate: sourceDetail.endDate,
  })
  const targetDetail = await adminFetchSchedulingForm(target.formId)

  // Replace target schedule with source structure (deletes move enrollments to orphaned).
  for (const group of targetDetail.slotGroups ?? []) {
    await adminDeleteSlotGroup(group.id)
  }
  for (const group of sourceGroups) {
    const payload = slotGroupToBatchPayload(group, offering.id)
    if (
      (payload.scheduleMode === 'day' && !payload.daySchedule?.weeks?.length) ||
      (payload.scheduleMode === 'date' && !payload.dateSchedule?.entries?.length)
    ) {
      continue
    }
    await adminCreateSlotBatch(target.formId, payload)
  }
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
    case 'sportTags':
      await applySportTagsCopy(source, target)
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
    case 'schedule':
      await applyScheduleCopy(source, target)
      break
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
  if (targetColumnId === 'schedule') {
    if (target.formId == null) return false
    if (source && (source.formId == null || source.slotGroups.length === 0)) return false
  }
  if (targetColumnId === 'sportTags') {
    if (target.programsId == null) return false
  }
  return true
}
