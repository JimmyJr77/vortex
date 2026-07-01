import {
  adminFetchOfferings,
  adminFetchSchedulingForm,
  buildSchedulingSignupUrl,
  dayAbbrev,
  formatOfferingDateRange,
  type SchedulingFormDetail,
  type SchedulingOffering,
  type SchedulingSlotGroup,
} from './schedulingApi'
import { fetchClassEventSchedulingFormId, fetchClassEvents, type ClassEvent } from './programsApi'
import { normalizeDateKey, sortOccurrences, sortSlotGroups } from './slotSort'

export interface OfferingWithSlots {
  offering: SchedulingOffering
  slotGroups: SchedulingSlotGroup[]
}

export interface ClassSchedulingDetail {
  formId: number
  form: SchedulingFormDetail
  offerings: SchedulingOffering[]
  slotGroups: SchedulingSlotGroup[]
  costsLabel: string
  signupUrl: string
}

export interface ClassSpreadsheetRow {
  programId: number
  programName: string
  classId: number
  className: string
  formId: number
  offeringsSummary: string
  slotsSummary: string
  costsSummary: string
  offeringCount: number
  slotCount: number
}

export function formatSchedulingCosts(form: {
  slotCostMonthlyCents?: number
  freeSlotsPerUser?: number
  maxFreeSlotsTotal?: number | null
}): string {
  const parts: string[] = []
  if (form.slotCostMonthlyCents && form.slotCostMonthlyCents > 0) {
    parts.push(`$${(form.slotCostMonthlyCents / 100).toFixed(2)}/mo per slot`)
  }
  if (form.freeSlotsPerUser && form.freeSlotsPerUser > 0) {
    parts.push(`${form.freeSlotsPerUser} free slot${form.freeSlotsPerUser !== 1 ? 's' : ''} per user`)
  }
  if (form.maxFreeSlotsTotal != null && form.maxFreeSlotsTotal > 0) {
    parts.push(`${form.maxFreeSlotsTotal} free slot${form.maxFreeSlotsTotal !== 1 ? 's' : ''} total`)
  }
  return parts.length > 0 ? parts.join(' · ') : '—'
}

export function schedulingSignupUrl(formId: number): string {
  return buildSchedulingSignupUrl(formId)
}

export function formatOfferingDates(offering: SchedulingOffering): string {
  const label = offering.label ? `${offering.label}: ` : ''
  return `${label}${formatOfferingDateRange(offering)}`
}

export function formatSlotOccurrence(group: SchedulingSlotGroup): string {
  return sortOccurrences(group.occurrences)
    .map((occ) =>
      occ.scheduleMode === 'date'
        ? `${occ.specificDate} · ${occ.startTime}–${occ.endTime}`
        : `${dayAbbrev(occ.dayOfWeek) ?? occ.dayName} · ${occ.startTime}–${occ.endTime}`,
    )
    .join('; ')
}

function sortOfferingsChronological(offerings: SchedulingOffering[]): SchedulingOffering[] {
  return [...offerings].sort((a, b) => {
    const sa = normalizeDateKey(a.startDate) ?? ''
    const sb = normalizeDateKey(b.startDate) ?? ''
    return sa.localeCompare(sb) || a.id - b.id
  })
}

export function groupSlotsByOffering(
  offerings: SchedulingOffering[],
  slotGroups: SchedulingSlotGroup[],
): { byOffering: OfferingWithSlots[]; unassigned: SchedulingSlotGroup[] } {
  const sortedOfferings = sortOfferingsChronological(offerings)
  const sortedSlotGroups = sortSlotGroups(slotGroups)
  const assignedIds = new Set<number>()
  const byOffering = sortedOfferings.map((offering) => {
    const groups = sortedSlotGroups.filter((g) => {
      if (Number(g.offeringId) === Number(offering.id)) {
        assignedIds.add(g.id)
        return true
      }
      return false
    })
    return { offering, slotGroups: groups }
  })
  const unassigned = sortedSlotGroups.filter((g) => !assignedIds.has(g.id))
  return { byOffering, unassigned }
}

export interface ClassSchedulingCounts {
  offeringCount: number
  slotCount: number
}

export async function loadClassSchedulingCounts(
  classId: number,
  formId?: number | null,
): Promise<ClassSchedulingCounts> {
  try {
    const resolvedFormId = formId ?? (await fetchClassEventSchedulingFormId(classId))
    const [offerings, form] = await Promise.all([
      adminFetchOfferings(resolvedFormId),
      adminFetchSchedulingForm(resolvedFormId),
    ])
    return {
      offeringCount: offerings.length,
      slotCount: form.slotGroups.length,
    }
  } catch {
    return { offeringCount: 0, slotCount: 0 }
  }
}

export async function loadSchedulingCountsForClasses(
  classes: Array<{ id: number; schedulingFormId?: number | null }>,
): Promise<Map<number, ClassSchedulingCounts>> {
  const uniqueIds = [...new Set(classes.map((c) => c.id))]
  const entries = await Promise.all(
    uniqueIds.map(async (id) => {
      const cls = classes.find((c) => c.id === id)
      const counts = await loadClassSchedulingCounts(id, cls?.schedulingFormId)
      return [id, counts] as const
    }),
  )
  return new Map(entries)
}

export async function loadClassSchedulingDetail(
  classId: number,
  formId?: number | null,
): Promise<ClassSchedulingDetail | null> {
  try {
    const resolvedFormId = formId ?? (await fetchClassEventSchedulingFormId(classId))
    const [form, offerings] = await Promise.all([
      adminFetchSchedulingForm(resolvedFormId),
      adminFetchOfferings(resolvedFormId),
    ])
    return {
      formId: resolvedFormId,
      form,
      offerings,
      slotGroups: form.slotGroups,
      costsLabel: formatSchedulingCosts(form),
      signupUrl: schedulingSignupUrl(resolvedFormId),
    }
  } catch {
    return null
  }
}

function summarizeOfferings(offerings: SchedulingOffering[]): string {
  if (offerings.length === 0) return '—'
  const selected = offerings.filter((o) => o.isSelected)
  if (selected.length > 0) {
    return selected.map((o) => formatOfferingDates(o)).join('; ')
  }
  return `${offerings.length} offering${offerings.length !== 1 ? 's' : ''}`
}

function summarizeSlots(form: SchedulingFormDetail): string {
  const count = form.slotGroups.length
  if (count === 0) return '—'
  return `${count} slot${count !== 1 ? 's' : ''}`
}

export async function loadClassSpreadsheetRow(
  classId: number,
  className: string,
  programId: number,
  programName: string,
  schedulingFormId: number,
): Promise<ClassSpreadsheetRow | null> {
  try {
    const [form, offerings] = await Promise.all([
      adminFetchSchedulingForm(schedulingFormId),
      adminFetchOfferings(schedulingFormId),
    ])
    const offeringCount = offerings.length
    if (offeringCount === 0) return null

    return {
      programId,
      programName,
      classId,
      className,
      formId: schedulingFormId,
      offeringsSummary: summarizeOfferings(offerings),
      slotsSummary: summarizeSlots(form),
      costsSummary: formatSchedulingCosts(form),
      offeringCount,
      slotCount: form.slotGroups.length,
    }
  } catch {
    return null
  }
}

export async function loadAllSpreadsheetRows(
  classes: Array<{ id: number; displayName: string; categoryId?: number | null }>,
  programNameFor: (categoryId: number) => string,
): Promise<ClassSpreadsheetRow[]> {
  const programIds = [
    ...new Set(classes.map((c) => c.categoryId).filter((id): id is number => id != null)),
  ]

  const eventsByProgram = new Map<number, ClassEvent[]>()
  await Promise.all(
    programIds.map(async (programId) => {
      const events = await fetchClassEvents({ programsId: programId, archived: false })
      eventsByProgram.set(programId, events)
    }),
  )

  const rowResults = await Promise.all(
    classes
      .filter((cls) => cls.categoryId != null)
      .map(async (cls) => {
        const programId = cls.categoryId!
        const events = eventsByProgram.get(programId) ?? []
        const classEvent = events.find((e) => e.id === cls.id)
        if (!classEvent?.schedulingFormId) return null
        return loadClassSpreadsheetRow(
          cls.id,
          cls.displayName,
          programId,
          programNameFor(programId),
          classEvent.schedulingFormId,
        )
      }),
  )

  return rowResults.filter((row): row is ClassSpreadsheetRow => row != null)
}
