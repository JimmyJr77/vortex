import { type EnrollSiteKey } from '../config/enrollSites'
import { type CostUnit } from './schedulingApi'
import { adminApiRequest } from './api'
import {
  adaptProgramSchedulingUpdateForApi,
  getSchedulingEnrollApiCapabilities,
  markSchedulingEnrollSitesUnsupported,
} from './schedulingEnrollApi'

export interface SchedulingCategoryRef {
  id: number | null
  name: string
}

export interface TopProgram {
  id: number
  name: string
  displayName: string
  description?: string | null
  primarySportId?: number | null
  primarySportName?: string | null
  pricingMaxSlotsPerUser?: number | null
  pricingSlotCostMonthlyCents?: number
  pricingCostUnit?: CostUnit
  pricingCostAmountCents?: number
  pricingFreeSlotsPerUser?: number
  pricingMaxFreeSlotsTotal?: number | null
  pricingPromoCodes?: string[]
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
  schedulingCategoryId?: number | null
  schedulingCategoryName?: string | null
  schedulingCategories?: SchedulingCategoryRef[]
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
  description?: string | null
  primarySportId?: number | null
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
  }>,
): Promise<TopProgram> {
  const capabilities = await getSchedulingEnrollApiCapabilities()
  let apiPayload = adaptProgramSchedulingUpdateForApi(payload, capabilities.schedulingEnrollSites)
  let res = await adminApiRequest(`/api/admin/programs-top/${id}`, {
    method: 'PUT',
    body: JSON.stringify(apiPayload),
  })

  if (
    !res.ok &&
    payload.schedulingEnrollSites !== undefined &&
    capabilities.schedulingEnrollSites
  ) {
    const data = await res.json().catch(() => ({}))
    const message = typeof data.message === 'string' ? data.message : ''
    if (message.includes('schedulingEnrollSites') || message.includes('not allowed')) {
      markSchedulingEnrollSitesUnsupported()
      apiPayload = adaptProgramSchedulingUpdateForApi(payload, false)
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
  const { programsId, skillLevel, displayName, ageMin, ageMax, ...rest } = payload
  const body: Record<string, unknown> = { ...rest }
  if (displayName !== undefined) {
    const trimmed = displayName.trim()
    if (trimmed) body.displayName = trimmed
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

/**
 * Re-point a class row's scheduling data to a different category (or "No
 * Category" when categoryId is null). This is the Classes -> Scheduling
 * direction of the bidirectional sync.
 */
export async function setClassSchedulingCategory(
  classId: number,
  schedulingCategoryId: number | null,
): Promise<void> {
  const res = await adminApiRequest(`/api/admin/programs/${classId}/scheduling-category`, {
    method: 'PUT',
    body: JSON.stringify({ schedulingCategoryId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to update scheduling category')
  }
}

/**
 * Re-point a single category variation of a class to a different category
 * (or "No Category" when null), moving only that variation's scheduling data.
 */
export async function reassignClassVariation(
  classId: number,
  fromCategoryId: number | null,
  toCategoryId: number | null,
): Promise<void> {
  const res = await adminApiRequest(`/api/admin/programs/${classId}/variations/reassign`, {
    method: 'PUT',
    body: JSON.stringify({ fromCategoryId, toCategoryId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to reassign category variation')
  }
}

/** Add a new category variation to a class (links the category to its form). */
export async function addClassVariation(
  classId: number,
  categoryId: number | null,
): Promise<void> {
  const res = await adminApiRequest(`/api/admin/programs/${classId}/variations`, {
    method: 'POST',
    body: JSON.stringify({ categoryId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to add category variation')
  }
}

/** Split one Admin > Classes row into a new independent class with a different category. */
export async function splitClassByCategory(
  classId: number,
  payload: ClassEventFormData & {
    fromCategoryId: number | null
    toCategoryId: number | null
  },
): Promise<{ newProgramId: number }> {
  const res = await adminApiRequest(`/api/admin/programs/${classId}/split-by-category`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await parseJson<{ newProgramId: number }>(res)
  return data
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
export async function syncSchedulingCategories(opts?: {
  parentProgramId?: number | null
  programId?: number | null
}): Promise<SyncSchedulingStats> {
  const res = await adminApiRequest('/api/admin/programs/sync-scheduling-categories', {
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
