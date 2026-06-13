import { adminApiRequest } from './api'
import {
  updateTopProgram,
  type ClassEvent,
  type ClassEventFormData,
  type TopProgram,
} from './programsApi'
import { type SchedulingFormDetail, type SchedulingSlotGroup } from './schedulingApi'

export interface ClassEventSlotOverview {
  classEvent: ClassEvent
  form: SchedulingFormDetail | null
}

export interface ExportOverviewInput {
  program: TopProgram
  title: string
  description: string
  active: boolean
  slotOverview: ClassEventSlotOverview[]
}

export interface ClassEventExportPrefill {
  programsId: number
  programsDisplayName: string
  editing: ClassEvent | null
  initialFormData?: ClassEventFormData
  schedulingCategoryId: number | null
  lockProgram: boolean
}

interface EventDateTimeEntry {
  date: string
  startTime?: string
  endTime?: string
  description?: string
  allDay?: boolean
}

interface FormCategoryRef {
  id: number | null
  name: string
}

function categoriesForForm(form: SchedulingFormDetail | null): FormCategoryRef[] {
  if (!form) return [{ id: null, name: 'No Category' }]

  const seen = new Set<number>()
  const ordered: FormCategoryRef[] = []
  const nameForId = (id: number): string =>
    form.categories.find((c) => c.id === id)?.name ??
    form.allCategories?.find((c) => c.id === id)?.name ??
    `Category #${id}`

  for (const group of form.slotGroups) {
    if (group.categoryId != null && !seen.has(group.categoryId)) {
      seen.add(group.categoryId)
      ordered.push({ id: group.categoryId, name: nameForId(group.categoryId) })
    }
  }
  for (const cat of form.categories) {
    if (cat.id != null && !seen.has(cat.id)) {
      seen.add(cat.id)
      ordered.push({ id: cat.id, name: cat.name })
    }
  }

  if (ordered.length === 0) return [{ id: null, name: 'No Category' }]
  return ordered
}

export async function syncTopProgramFromOverview(
  input: ExportOverviewInput,
): Promise<TopProgram> {
  return updateTopProgram(input.program.id, {
    displayName: input.title.trim(),
    description: input.description.trim() || null,
    schedulingActive: input.active,
    ...(!input.program.schedulingOverviewSavedAt ? { markOverviewSaved: true } : {}),
  })
}

export interface ExportProgramsClassesResult {
  program: TopProgram
  prefills: ClassEventExportPrefill[]
}

function resolveExportDisplayName(
  form: SchedulingFormDetail | null,
  classEvent: ClassEvent,
): string {
  const fromForm = form?.title?.trim()
  if (fromForm) return fromForm
  const fromClass = classEvent.displayName?.trim()
  if (fromClass) return fromClass
  return classEvent.displayName || 'Untitled class/event'
}

function buildExportClassPrefill(
  classEvent: ClassEvent,
  form: SchedulingFormDetail | null,
): ClassEvent {
  return {
    ...classEvent,
    displayName: resolveExportDisplayName(form, classEvent),
    description: form?.description?.trim() || classEvent.description || null,
  }
}

function buildExportFormData(
  classEvent: ClassEvent,
  form: SchedulingFormDetail | null,
): ClassEventFormData {
  return {
    displayName: resolveExportDisplayName(form, classEvent),
    skillLevel: classEvent.skillLevel,
    ageMin: classEvent.ageMin,
    ageMax: classEvent.ageMax,
    description: form?.description?.trim() || classEvent.description || '',
    skillRequirements: classEvent.skillRequirements || '',
    isActive: classEvent.isActive,
  }
}

export async function autoSaveClassesFromOverview(
  input: ExportOverviewInput,
): Promise<ExportProgramsClassesResult> {
  const program = await syncTopProgramFromOverview(input)

  const prefills: ClassEventExportPrefill[] = []
  for (const { classEvent, form } of input.slotOverview) {
    const categories = categoriesForForm(form)
    categories.forEach((category, index) => {
      prefills.push({
        programsId: input.program.id,
        programsDisplayName: input.title.trim(),
        // First category reuses the existing class row; the rest create new rows.
        editing: index === 0 ? buildExportClassPrefill(classEvent, form) : null,
        initialFormData: index === 0 ? undefined : buildExportFormData(classEvent, form),
        schedulingCategoryId: category.id,
        lockProgram: true,
      })
    })
  }

  return { program, prefills }
}

function slotGroupsToDatesAndTimes(groups: SchedulingSlotGroup[]): EventDateTimeEntry[] {
  const entries: EventDateTimeEntry[] = []
  for (const group of groups) {
    for (const occ of group.occurrences) {
      if (occ.scheduleMode === 'date' && occ.specificDate) {
        entries.push({
          date: occ.specificDate,
          startTime: occ.startTime,
          endTime: occ.endTime,
          allDay: false,
        })
      } else if (occ.scheduleMode === 'day') {
        const date = group.activeStart || occ.specificDate
        if (date) {
          entries.push({
            date,
            startTime: occ.startTime,
            endTime: occ.endTime,
            allDay: false,
          })
        }
      }
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date))
}

function dateRangeFromEntries(entries: EventDateTimeEntry[]): { startDate: string; endDate: string } {
  if (entries.length === 0) {
    const today = new Date().toISOString().split('T')[0]
    return { startDate: today, endDate: today }
  }
  const dates = entries.map((e) => e.date).sort()
  return { startDate: dates[0], endDate: dates[dates.length - 1] }
}

export async function exportOverviewToEvents(input: ExportOverviewInput): Promise<number> {
  await syncTopProgramFromOverview(input)
  let created = 0

  for (const { classEvent, form } of input.slotOverview) {
    if (!form || form.slotGroups.length === 0) continue

    const datesAndTimes = slotGroupsToDatesAndTimes(form.slotGroups)
    const { startDate, endDate } = dateRangeFromEntries(datesAndTimes)
    const eventName = form.title || classEvent.displayName
    const description =
      form.description || classEvent.description || eventName

    const res = await adminApiRequest('/api/admin/events', {
      method: 'POST',
      body: JSON.stringify({
        eventName,
        shortDescription: description,
        longDescription: description,
        startDate,
        endDate,
        type: 'class',
        datesAndTimes,
        schedulingFormId: form.id,
        tagType: 'all_classes_and_parents',
        keyDetails: [],
        images: [],
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || `Failed to export event for ${eventName}`)
    }

    created++
  }

  return created
}
