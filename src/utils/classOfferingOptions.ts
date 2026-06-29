import {
  adminFetchOfferings,
  adminFetchSchedulingForms,
  formatOfferingDateRange,
} from './schedulingApi'
import { fetchDisciplineTags } from './programsApi'

export interface ClassOfferingOption {
  id: number
  formId: number
  formTitle: string
  startDate: string
  endDate: string | null
  label: string
}

export interface SportScopeOption {
  id: number
  name: string
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Offering end date is today or later, or evergreen with no end date. */
export function isActiveOrUpcomingOffering(
  endDate: string | null | undefined,
  today = todayDateString(),
): boolean {
  if (!endDate) return true
  return endDate >= today
}

export function offeringDisplayLabel(o: ClassOfferingOption): string {
  return `${o.formTitle} · ${o.label}`
}

export function offeringSearchHaystack(o: ClassOfferingOption): string {
  return [o.formTitle, o.label, o.startDate, o.endDate].join(' ').toLowerCase()
}

export function sportSearchHaystack(s: SportScopeOption): string {
  return s.name.toLowerCase()
}

export async function loadSportScopeOptions(): Promise<SportScopeOption[]> {
  const tags = await fetchDisciplineTags()
  return tags
    .map((tag) => ({ id: tag.id, name: tag.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function loadClassOfferingOptions(): Promise<ClassOfferingOption[]> {
  const forms = await adminFetchSchedulingForms()
  const activeForms = forms.filter((f) => f.isActive)

  const nested = await Promise.all(
    activeForms.map(async (form) => {
      try {
        const rows = await adminFetchOfferings(form.id)
        return rows.map((o) => ({
          id: o.id,
          formId: form.id,
          formTitle: form.title,
          startDate: o.startDate,
          endDate: o.endDate,
          label: o.label?.trim() || formatOfferingDateRange(o),
        }))
      } catch {
        return []
      }
    }),
  )

  return nested
    .flat()
    .sort(
      (a, b) =>
        a.formTitle.localeCompare(b.formTitle) ||
        a.startDate.localeCompare(b.startDate) ||
        a.id - b.id,
    )
}
