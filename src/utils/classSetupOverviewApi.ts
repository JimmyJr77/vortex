import { adminApiRequest } from './api'
import { formatOfferingRangeCompact } from './dateUtils'
import { type ProgramPricingOption } from './programPricingOptions'

export type ClassSetupOverviewStatus = 'Active' | 'Inactive' | 'Legacy'

export interface ClassSetupOffering {
  id: number
  formId: number
  startDate: string
  endDate: string | null
  evergreen: boolean
  label: string | null
  isSelected: boolean
}

export interface ClassSetupSlotGroup {
  slotGroupId: number
  formId: number
  offeringId: number | null
  maxParticipants: number
  signupCount: number
  activeStart?: string | null
  activeEnd?: string | null
  datesTbd?: boolean
  scheduleLabel: string
}

export interface ClassSetupOverviewRow {
  classId: number
  className: string
  classDescription: string | null
  skillLevel: string | null
  classIsActive: boolean
  classArchived: boolean
  programsId: number | null
  programName: string
  programDescription: string | null
  programArchived: boolean
  programIsActive: boolean
  excludeFromDropIns: boolean
  primarySportId: number | null
  primarySportName: string | null
  sportTags: string
  sportTagIds: number[]
  formId: number | null
  formActive: boolean | null
  pricingOverridesProgram: boolean
  offerings: ClassSetupOffering[]
  slotGroups: ClassSetupSlotGroup[]
  enrolleeCount: number
  status: ClassSetupOverviewStatus
  costPerClass: string | null
  fee1x: string | null
  costPerMonthSummary: string | null
  pricingCostOptions: ProgramPricingOption[]
}

export interface ClassSetupOverviewResponse {
  rows: ClassSetupOverviewRow[]
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Request failed')
  }
  return data.data as T
}

export async function fetchClassSetupOverview(): Promise<ClassSetupOverviewResponse> {
  const res = await adminApiRequest('/api/admin/class-setup/overview')
  return parseJson(res)
}

export function formatOfferingsCell(offerings: ClassSetupOffering[]): string {
  if (offerings.length === 0) return '—'
  return offerings.map((o) => formatOfferingRangeCompact(o)).join('; ')
}

export function formatOfferingDescriptionsCell(offerings: ClassSetupOffering[]): string {
  if (offerings.length === 0) return '—'
  const labels = offerings.map((o) => o.label?.trim()).filter(Boolean)
  return labels.length > 0 ? labels.join('; ') : '—'
}

function formatSlotGroupActiveDates(
  group: ClassSetupSlotGroup,
  offerings: ClassSetupOffering[] = [],
): string {
  if (group.datesTbd) return 'Date TBD'
  if (group.activeStart || group.activeEnd) {
    if (!group.activeEnd) return `${group.activeStart || '—'} · Ongoing`
    return `${group.activeStart || '—'} → ${group.activeEnd}`
  }
  const offering =
    (group.offeringId != null
      ? offerings.find((item) => item.id === group.offeringId)
      : null) ??
    offerings.find((item) => item.isSelected) ??
    offerings[0] ??
    null
  if (offering) return formatOfferingRangeCompact(offering)
  return '—'
}

/** Class Master schedule cell: [active dates] · [day/time…] · [spaces] */
export function formatScheduleCell(
  slotGroups: ClassSetupSlotGroup[],
  offerings: ClassSetupOffering[] = [],
): string {
  if (slotGroups.length === 0) return '—'
  return slotGroups
    .flatMap((group) => {
      const activeDates = formatSlotGroupActiveDates(group, offerings)
      const spaces = `${group.signupCount}/${group.maxParticipants}`
      const segments = (group.scheduleLabel || '—')
        .split(/\s*;\s*/)
        .map((part) => part.trim())
        .filter(Boolean)
      if (segments.length === 0) {
        return [`${activeDates} · — · ${spaces}`]
      }
      return segments.map((segment) => `${activeDates} · ${segment} · ${spaces}`)
    })
    .join('\n')
}

export function formatSpacesCell(slotGroups: ClassSetupSlotGroup[]): string {
  if (slotGroups.length === 0) return '—'
  return slotGroups.map((g) => `${g.signupCount}/${g.maxParticipants}`).join('; ')
}

export { formatOfferingRangeCompact }
