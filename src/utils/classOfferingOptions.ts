import {
  adminFetchAllCategories,
  adminFetchOfferings,
  adminFetchSchedulingForms,
} from './schedulingApi'

export interface ClassOfferingOption {
  id: number
  formId: number
  formTitle: string
  categoryName: string
  startDate: string
  endDate: string
  label: string
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Offering end date is today or later (current or upcoming session). */
export function isActiveOrUpcomingOffering(endDate: string, today = todayDateString()): boolean {
  return endDate >= today
}

export function offeringDisplayLabel(o: ClassOfferingOption): string {
  return `${o.formTitle} · ${o.categoryName} · ${o.label}`
}

export function offeringSearchHaystack(o: ClassOfferingOption): string {
  return [o.formTitle, o.categoryName, o.label, o.startDate, o.endDate].join(' ').toLowerCase()
}

export async function loadClassOfferingOptions(): Promise<ClassOfferingOption[]> {
  const [forms, categories] = await Promise.all([
    adminFetchSchedulingForms(),
    adminFetchAllCategories(),
  ])
  const categoryById = new Map(categories.map((c) => [c.id, c.name]))
  const activeForms = forms.filter((f) => f.isActive)

  const nested = await Promise.all(
    activeForms.map(async (form) => {
      try {
        const rows = await adminFetchOfferings(form.id)
        return rows.map((o) => ({
          id: o.id,
          formId: form.id,
          formTitle: form.title,
          categoryName:
            o.categoryId != null
              ? (categoryById.get(o.categoryId) ?? `Category #${o.categoryId}`)
              : 'No category',
          startDate: o.startDate,
          endDate: o.endDate,
          label: o.label?.trim() || `${o.startDate} – ${o.endDate}`,
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
