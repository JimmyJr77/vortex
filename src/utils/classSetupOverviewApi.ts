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

export function formatScheduleCell(slotGroups: ClassSetupSlotGroup[]): string {
  if (slotGroups.length === 0) return '—'
  return slotGroups
    .flatMap((group) => (group.scheduleLabel || '—').split(/\s*;\s*/))
    .filter(Boolean)
    .join('\n')
}

export function formatSpacesCell(slotGroups: ClassSetupSlotGroup[]): string {
  if (slotGroups.length === 0) return '—'
  return slotGroups.map((g) => `${g.signupCount}/${g.maxParticipants}`).join('; ')
}

export { formatOfferingRangeCompact }
