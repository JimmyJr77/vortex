import { type EnrollSiteKey } from '../config/enrollSites'
import { type CostUnit } from './schedulingApi'
import { type ProgramPricingOption } from './programPricingOptions'
import { type MultiClassPassPackage } from './multiClassPassPackages'
import {
  adaptProgramPricingUpdateForApi,
  getProgramPricingApiCapabilities,
  markProgramPricingCostOptionsUnsupported,
  multiClassPassPackagesRejected,
  pricingCostOptionsRejected,
} from './programPricingApi'
import { adminApiRequest } from './api'
import {
  adaptProgramSchedulingUpdateForApi,
  getSchedulingEnrollApiCapabilities,
  markSchedulingEnrollSitesUnsupported,
} from './schedulingEnrollApi'

export interface TopProgram {
  id: number
  name: string
  displayName: string
  abridgedName?: string | null
  description?: string | null
  excludeFromDropIns?: boolean
  primarySportId?: number | null
  primarySportName?: string | null
  pricingMaxSlotsPerUser?: number | null
  pricingSlotCostMonthlyCents?: number
  pricingCostUnit?: CostUnit
  pricingCostAmountCents?: number
  pricingFreeSlotsPerUser?: number
  pricingMaxFreeSlotsTotal?: number | null
  pricingPromoCodes?: string[]
  pricingCostOptions?: ProgramPricingOption[]
  multiClassPassPackages?: MultiClassPassPackage[]
  archived: boolean
  schedulingActive?: boolean
  schedulingEnrollSites?: EnrollSiteKey[]
  schedulingSignupFields?: string[] | null
  schedulingMandateWaiver?: boolean
  schedulingOverviewSavedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ClassEvent {
  id: number
  programsId?: number | null
  categoryId?: number | null
  programsDisplayName?: string | null
  categoryDisplayName?: string | null
  name: string
  displayName: string
  abridgedName?: string | null
  skillLevel: string | null
  ageMin: number | null
  ageMax: number | null
  description: string | null
  skillRequirements: string | null
  isActive: boolean
  archived?: boolean
  schedulingFormId?: number | null
  schedulingFormActive?: boolean
  schedulingFormEnrollSites?: EnrollSiteKey[] | null
  primarySport?: string | null
  sportTags?: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminProgramPricing extends ClassEvent {
  schedulingFormId?: number | null
  pricingOverridesProgram?: boolean
  formMaxSlotsPerUser?: number | null
  formSlotCostMonthlyCents?: number
  formCostUnit?: CostUnit | null
  formFreeSlotsPerUser?: number
  formMaxFreeSlotsTotal?: number | null
  programMaxSlotsPerUser?: number | null
  programSlotCostMonthlyCents?: number
  programCostUnit?: CostUnit | null
  programFreeSlotsPerUser?: number
  programMaxFreeSlotsTotal?: number | null
  maxSlotsPerUser?: number | null
  slotCostMonthlyCents?: number
  costUnit?: CostUnit
  freeSlotsPerUser?: number
  maxFreeSlotsTotal?: number | null
}

export interface ClassEventFormData {
  displayName: string
  abridgedName?: string | null
  skillLevel?: string | null
  ageMin?: number | null
  ageMax?: number | null
  description?: string | null
  skillRequirements?: string | null
  isActive?: boolean
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok || !data.success) {
    const details = Array.isArray(data.errors) ? data.errors.join('; ') : ''
    throw new Error(details || data.message || 'Request failed')
  }
  return data.data as T
}

/** Top-level programs (Adult Fitness, Football, etc.) — was program_categories / categories API. */
export async function fetchTopPrograms(archived?: boolean): Promise<TopProgram[]> {
  const qs = archived === undefined ? '' : `?archived=${archived}`
  const res = await adminApiRequest(`/api/admin/programs-top${qs}`)
  return parseJson(res)
}

export async function createTopProgram(payload: {
  name: string
  displayName: string
  abridgedName?: string | null
  description?: string | null
  primarySportId?: number | null
  excludeFromDropIns?: boolean
}): Promise<TopProgram> {
  const res = await adminApiRequest('/api/admin/programs-top', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function updateTopProgram(
  id: number,
  payload: Partial<{
    name: string
    displayName: string
    abridgedName: string | null
    description: string | null
    archived: boolean
    schedulingActive: boolean
    schedulingEnrollSites: EnrollSiteKey[]
    schedulingSignupFields: string[] | null
    schedulingMandateWaiver: boolean
    markOverviewSaved: boolean
    primarySportId: number | null
    pricingMaxSlotsPerUser: number | null
    pricingSlotCostMonthlyCents: number
    pricingCostUnit: CostUnit
    pricingFreeSlotsPerUser: number
    pricingMaxFreeSlotsTotal: number | null
    pricingPromoCodes: string[]
    pricingCostOptions: ProgramPricingOption[]
    multiClassPassPackages: MultiClassPassPackage[]
    excludeFromDropIns: boolean
  }>,
): Promise<TopProgram> {
  const [schedulingCapabilities, pricingCapabilities] = await Promise.all([
    getSchedulingEnrollApiCapabilities(),
    getProgramPricingApiCapabilities(),
  ])
  let apiPayload = adaptProgramSchedulingUpdateForApi(payload, schedulingCapabilities.schedulingEnrollSites)
  apiPayload = adaptProgramPricingUpdateForApi(apiPayload, pricingCapabilities.pricingCostOptions)
  if (apiPayload.pricingCostOptions) {
    apiPayload = {
      ...apiPayload,
      pricingCostOptions: apiPayload.pricingCostOptions.map((o) => ({
        ...o,
        amountCents: Math.max(0, Math.round(Number(o.amountCents) || 0)),
      })),
    }
  }
  if (apiPayload.multiClassPassPackages) {
    if (!pricingCapabilities.multiClassPassPackages) {
      apiPayload = { ...apiPayload }
      delete apiPayload.multiClassPassPackages
    } else {
      apiPayload = {
        ...apiPayload,
        multiClassPassPackages: apiPayload.multiClassPassPackages.map((p) => ({
          ...p,
          classCount: Math.max(1, Math.round(Number(p.classCount) || 1)),
          priceCents: Math.max(0, Math.round(Number(p.priceCents) || 0)),
        })),
      }
    }
  }
  let res = await adminApiRequest(`/api/admin/programs-top/${id}`, {
    method: 'PUT',
    body: JSON.stringify(apiPayload),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const message = typeof data.message === 'string' ? data.message : ''

    if (
      payload.schedulingEnrollSites !== undefined &&
      schedulingCapabilities.schedulingEnrollSites &&
      (message.includes('schedulingEnrollSites') || message.includes('not allowed'))
    ) {
      markSchedulingEnrollSitesUnsupported()
      apiPayload = adaptProgramSchedulingUpdateForApi(payload, false)
      apiPayload = adaptProgramPricingUpdateForApi(apiPayload, pricingCapabilities.pricingCostOptions)
      res = await adminApiRequest(`/api/admin/programs-top/${id}`, {
        method: 'PUT',
        body: JSON.stringify(apiPayload),
      })
    } else if (payload.pricingCostOptions !== undefined && pricingCostOptionsRejected(message)) {
      markProgramPricingCostOptionsUnsupported()
      apiPayload = adaptProgramPricingUpdateForApi(payload, false)
      apiPayload = adaptProgramSchedulingUpdateForApi(apiPayload, schedulingCapabilities.schedulingEnrollSites)
      res = await adminApiRequest(`/api/admin/programs-top/${id}`, {
        method: 'PUT',
        body: JSON.stringify(apiPayload),
      })
    } else if (
      payload.multiClassPassPackages !== undefined &&
      multiClassPassPackagesRejected(message)
    ) {
      markProgramPricingCostOptionsUnsupported()
      const payloadWithoutPackages = { ...payload }
      delete payloadWithoutPackages.multiClassPassPackages
      apiPayload = adaptProgramPricingUpdateForApi(payloadWithoutPackages, pricingCapabilities.pricingCostOptions)
      apiPayload = adaptProgramSchedulingUpdateForApi(apiPayload, schedulingCapabilities.schedulingEnrollSites)
      res = await adminApiRequest(`/api/admin/programs-top/${id}`, {
        method: 'PUT',
        body: JSON.stringify(apiPayload),
      })
    }
  }

  return parseJson(res)
}

export async function archiveTopProgram(id: number, archived: boolean): Promise<void> {
  const res = await adminApiRequest(`/api/admin/programs-top/${id}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ archived }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to archive')
  }
}

export async function deleteTopProgram(id: number): Promise<void> {
  const res = await adminApiRequest(`/api/admin/programs-top/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to delete')
  }
}

export async function fetchClassEvents(opts?: {
  programsId?: number
  archived?: boolean
  includePricing?: boolean
}): Promise<ClassEvent[]> {
  if (opts?.programsId != null) {
    const qs = opts.archived === undefined ? '' : `?archived=${opts.archived}`
    const res = await adminApiRequest(
      `/api/admin/programs/${opts.programsId}/class-events${qs}`,
    )
    return parseJson(res)
  }
  const params = new URLSearchParams()
  if (opts?.archived !== undefined) params.set('archived', String(opts.archived))
  if (opts?.includePricing) params.set('includePricing', 'true')
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await adminApiRequest(`/api/admin/programs${qs}`)
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.message || 'Request failed')
  return data.data as ClassEvent[]
}

export async function fetchAdminProgramsWithPricing(
  archived = false,
): Promise<AdminProgramPricing[]> {
  return fetchClassEvents({ archived, includePricing: true }) as Promise<AdminProgramPricing[]>
}

export async function resetProgramClassesPricing(programId: number): Promise<number> {
  const res = await adminApiRequest(`/api/admin/programs-top/${programId}/pricing/reset-classes`, {
    method: 'POST',
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.message || 'Request failed')
  return Number(data.resetCount ?? 0)
}

export async function createClassEvent(
  programsId: number,
  payload: ClassEventFormData,
): Promise<ClassEvent> {
  const res = await adminApiRequest(`/api/admin/programs/${programsId}/class-events`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

const VALID_SKILL_LEVELS = ['EARLY_STAGE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const

function coerceOptionalInt(value: number | null | undefined): number | null | undefined {
  if (value === undefined) return undefined
  if (value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

function sanitizeClassEventUpdateBody(
  payload: Partial<ClassEventFormData> & { programsId?: number | null },
): Record<string, unknown> {
  const { programsId, skillLevel, displayName, abridgedName, ageMin, ageMax, ...rest } = payload
  const body: Record<string, unknown> = { ...rest }
  if (displayName !== undefined) {
    const trimmed = displayName.trim()
    if (trimmed) body.displayName = trimmed
  }
  if (abridgedName !== undefined) {
    body.abridgedName = typeof abridgedName === 'string' ? abridgedName.trim() : abridgedName
  }
  if (skillLevel !== undefined) {
    body.skillLevel =
      skillLevel && VALID_SKILL_LEVELS.includes(skillLevel as (typeof VALID_SKILL_LEVELS)[number])
        ? skillLevel
        : null
  }
  const coercedAgeMin = coerceOptionalInt(ageMin)
  if (coercedAgeMin !== undefined) body.ageMin = coercedAgeMin
  const coercedAgeMax = coerceOptionalInt(ageMax)
  if (coercedAgeMax !== undefined) body.ageMax = coercedAgeMax
  if (programsId != null) body.programsId = programsId
  return body
}

export async function updateClassEvent(
  id: number,
  payload: Partial<ClassEventFormData> & { programsId?: number | null },
): Promise<ClassEvent> {
  const res = await adminApiRequest(`/api/admin/programs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(sanitizeClassEventUpdateBody(payload)),
  })
  return parseJson(res)
}

export async function archiveClassEvent(id: number, archived: boolean): Promise<void> {
  const res = await adminApiRequest(`/api/admin/programs/${id}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ archived }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to archive')
  }
}

export async function deleteClassEvent(id: number): Promise<void> {
  const res = await adminApiRequest(`/api/admin/programs/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to delete')
  }
}

export async function fetchClassEventSchedulingFormId(classEventId: number): Promise<number> {
  const res = await adminApiRequest(`/api/admin/class-events/${classEventId}/scheduling-form`)
  const data = await parseJson<{ id: number }>(res)
  return data.id
}

export interface SyncSchedulingStats {
  groups: number
  merged: number
  formsMerged: number
  removed: number
}

/**
 * Consolidate duplicate class rows (reverse the legacy physical split). Merges
 * program rows that share a parent + display name back into one class/form.
 * Idempotent and never deletes scheduling data.
 */
export async function consolidateClasses(opts?: {
  parentProgramId?: number | null
  programId?: number | null
}): Promise<SyncSchedulingStats> {
  const res = await adminApiRequest('/api/admin/programs/consolidate', {
    method: 'POST',
    body: JSON.stringify({
      parentProgramId: opts?.parentProgramId ?? null,
      programId: opts?.programId ?? null,
    }),
  })
  return parseJson(res)
}

export interface DisciplineTag {
  id: number
  name: string
  sortOrder: number
}

/** Discipline tags are global/searchable and associated at the program level. */
export async function fetchDisciplineTags(): Promise<DisciplineTag[]> {
  const res = await adminApiRequest('/api/admin/discipline-tags')
  return parseJson(res)
}

export async function createDisciplineTag(name: string): Promise<DisciplineTag> {
  const res = await adminApiRequest('/api/admin/discipline-tags', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  return parseJson(res)
}

export async function updateDisciplineTag(id: number, name: string): Promise<DisciplineTag> {
  const res = await adminApiRequest(`/api/admin/discipline-tags/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
  return parseJson(res)
}

export async function deleteDisciplineTag(id: number): Promise<void> {
  const res = await adminApiRequest(`/api/admin/discipline-tags/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to delete tag')
  }
}

export async function fetchProgramDisciplineTags(programId: number): Promise<DisciplineTag[]> {
  const res = await adminApiRequest(`/api/admin/programs-top/${programId}/discipline-tags`)
  return parseJson(res)
}

export async function linkProgramDisciplineTag(programId: number, tagId: number): Promise<void> {
  const res = await adminApiRequest(
    `/api/admin/programs-top/${programId}/discipline-tags/${tagId}`,
    { method: 'POST' },
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to link tag to program')
  }
}

export async function unlinkProgramDisciplineTag(programId: number, tagId: number): Promise<void> {
  const res = await adminApiRequest(
    `/api/admin/programs-top/${programId}/discipline-tags/${tagId}`,
    { method: 'DELETE' },
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to unlink tag from program')
  }
}

/** @deprecated Use fetchTopPrograms — categories alias during migration */
export async function fetchTopProgramsLegacy(archived?: boolean): Promise<TopProgram[]> {
  const qs = archived === undefined ? '' : `?archived=${archived}`
  const res = await adminApiRequest(`/api/admin/categories${qs}`)
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.message || 'Request failed')
  return data.data as TopProgram[]
}

export interface AdminMultiClassPassRow {
  id: number
  memberId: number
  memberName: string
  programsId: number
  programDisplayName: string | null
  packageId: string
  classCountPurchased: number
  classesRemaining: number
  priceCents: number
  packageLabel: string | null
  purchasedAt: string
}

export async function adminFetchMultiClassPasses(opts?: {
  programsId?: number
  classEventId?: number
}): Promise<AdminMultiClassPassRow[]> {
  const params = new URLSearchParams()
  if (opts?.programsId != null) params.set('programsId', String(opts.programsId))
  if (opts?.classEventId != null) params.set('classEventId', String(opts.classEventId))
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await adminApiRequest(`/api/admin/multi-class-passes${qs}`)
  return parseJson(res)
}
