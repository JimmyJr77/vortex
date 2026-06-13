import {
  adminFetchOfferings,
  adminFetchSchedulingForm,
  dayAbbrev,
  type SchedulingFormDetail,
  type SchedulingOffering,
  type SchedulingSlotGroup,
} from './schedulingApi'
import { fetchClassEventSchedulingFormId, fetchClassEvents, type ClassEvent } from './programsApi'

export interface OfferingWithSlots {
  offering: SchedulingOffering
  slotGroups: SchedulingSlotGroup[]
}

export interface CategoryOfferingDetail {
  categoryId: number | null
  categoryName: string
  offerings: SchedulingOffering[]
  slotGroups: SchedulingSlotGroup[]
}

export interface ClassSchedulingDetail {
  formId: number
  form: SchedulingFormDetail
  categories: CategoryOfferingDetail[]
  costsLabel: string
  signupUrl: string
}

export interface ClassSpreadsheetRow {
  programId: number
  programName: string
  classId: number
  className: string
  formId: number
  categoriesSummary: string
  offeringsSummary: string
  slotsSummary: string
  costsSummary: string
  offeringCount: number
  slotCount: number
}

function categoryNameFor(form: SchedulingFormDetail, categoryId: number | null): string {
  if (categoryId == null) return 'No Category'
  const fromAll = form.allCategories?.find((c) => c.id === categoryId)
  if (fromAll) return fromAll.name
  const fromForm = form.categories.find((c) => c.id === categoryId)
  if (fromForm) return fromForm.name
  return `Category #${categoryId}`
}

export function formatSchedulingCosts(form: {
  maxSlotsPerUser?: number | null
  slotCostMonthlyCents?: number
  freeSlotsPerUser?: number
}): string {
  const parts: string[] = []
  if (form.slotCostMonthlyCents && form.slotCostMonthlyCents > 0) {
    parts.push(`$${(form.slotCostMonthlyCents / 100).toFixed(2)}/mo per slot`)
  }
  if (form.freeSlotsPerUser && form.freeSlotsPerUser > 0) {
    parts.push(`${form.freeSlotsPerUser} free slot${form.freeSlotsPerUser !== 1 ? 's' : ''}`)
  }
  if (form.maxSlotsPerUser != null && form.maxSlotsPerUser > 0) {
    parts.push(`max ${form.maxSlotsPerUser} per user`)
  }
  return parts.length > 0 ? parts.join(' · ') : '—'
}

export function schedulingSignupUrl(formId: number): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/scheduling?form=${formId}`
  }
  return `/scheduling?form=${formId}`
}

export function formatOfferingDates(offering: SchedulingOffering): string {
  const label = offering.label ? `${offering.label}: ` : ''
  return `${label}${offering.startDate} → ${offering.endDate}`
}

export function formatSlotOccurrence(group: SchedulingSlotGroup): string {
  return group.occurrences
    .map((occ) =>
      occ.scheduleMode === 'date'
        ? `${occ.specificDate} · ${occ.startTime}–${occ.endTime}`
        : `${dayAbbrev(occ.dayOfWeek) ?? occ.dayName} · ${occ.startTime}–${occ.endTime}`,
    )
    .join('; ')
}

export function groupSlotsByOffering(
  offerings: SchedulingOffering[],
  slotGroups: SchedulingSlotGroup[],
): { byOffering: OfferingWithSlots[]; unassigned: SchedulingSlotGroup[] } {
  const assignedIds = new Set<number>()
  const byOffering = offerings.map((offering) => {
    const groups = slotGroups.filter((g) => {
      if (g.offeringId === offering.id) {
        assignedIds.add(g.id)
        return true
      }
      return false
    })
    return { offering, slotGroups: groups }
  })
  const unassigned = slotGroups.filter((g) => !assignedIds.has(g.id))
  return { byOffering, unassigned }
}

async function buildCategoryDetails(
  formId: number,
  form: SchedulingFormDetail,
): Promise<CategoryOfferingDetail[]> {
  const categoryIds = new Set<number | null>()
  for (const group of form.slotGroups) categoryIds.add(group.categoryId)
  for (const cat of form.categories) categoryIds.add(cat.id)
  categoryIds.add(null)

  const details = await Promise.all(
    [...categoryIds].map(async (categoryId) => {
      const offerings = await adminFetchOfferings(formId, categoryId)
      const slotGroups = form.slotGroups.filter((g) => g.categoryId === categoryId)
      if (offerings.length === 0 && slotGroups.length === 0) return null
      return {
        categoryId,
        categoryName: categoryNameFor(form, categoryId),
        offerings,
        slotGroups,
      }
    }),
  )

  return details
    .filter((row): row is CategoryOfferingDetail => row != null)
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
}

export async function loadClassSchedulingDetail(
  classId: number,
  formId?: number | null,
): Promise<ClassSchedulingDetail | null> {
  try {
    const resolvedFormId = formId ?? (await fetchClassEventSchedulingFormId(classId))
    const form = await adminFetchSchedulingForm(resolvedFormId)
    const categories = await buildCategoryDetails(resolvedFormId, form)
    return {
      formId: resolvedFormId,
      form,
      categories,
      costsLabel: formatSchedulingCosts(form),
      signupUrl: schedulingSignupUrl(resolvedFormId),
    }
  } catch {
    return null
  }
}

function summarizeCategories(categories: CategoryOfferingDetail[]): string {
  return summarizeSchedulingCategories(categories)
}

export function summarizeSchedulingCategories(categories: CategoryOfferingDetail[]): string {
  if (categories.length === 0) return 'No Category'
  return categories.map((c) => c.categoryName).join(', ')
}

export async function loadClassSchedulingCategoryLabel(
  classId: number,
  formId?: number | null,
): Promise<string> {
  try {
    const resolvedFormId = formId ?? (await fetchClassEventSchedulingFormId(classId))
    const form = await adminFetchSchedulingForm(resolvedFormId)
    const categories = await buildCategoryDetails(resolvedFormId, form)
    return summarizeSchedulingCategories(categories)
  } catch {
    return 'No Category'
  }
}

export async function loadSchedulingCategoryLabelsForClasses(
  classes: Array<{ id: number }>,
): Promise<Map<number, string>> {
  const entries = await Promise.all(
    classes.map(async (cls) => {
      const label = await loadClassSchedulingCategoryLabel(cls.id)
      return [cls.id, label] as const
    }),
  )
  return new Map(entries)
}

function summarizeOfferings(categories: CategoryOfferingDetail[]): string {
  const all = categories.flatMap((c) => c.offerings)
  if (all.length === 0) return '—'
  const selected = all.filter((o) => o.isSelected)
  if (selected.length > 0) {
    return selected.map((o) => formatOfferingDates(o)).join('; ')
  }
  return `${all.length} offering${all.length !== 1 ? 's' : ''}`
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
    const form = await adminFetchSchedulingForm(schedulingFormId)
    const categories = await buildCategoryDetails(schedulingFormId, form)
    const offeringCount = categories.reduce((sum, c) => sum + c.offerings.length, 0)
    if (offeringCount === 0) return null

    return {
      programId,
      programName,
      classId,
      className,
      formId: schedulingFormId,
      categoriesSummary: summarizeCategories(categories),
      offeringsSummary: summarizeOfferings(categories),
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
