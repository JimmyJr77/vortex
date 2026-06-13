import { adminApiRequest } from './api'

export interface TopProgram {
  id: number
  name: string
  displayName: string
  description?: string | null
  archived: boolean
  schedulingActive?: boolean
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
  createdAt: string
  updatedAt: string
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
    throw new Error(data.message || 'Request failed')
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
    schedulingSignupFields: string[] | null
    schedulingMandateWaiver: boolean
    markOverviewSaved: boolean
  }>,
): Promise<TopProgram> {
  const res = await adminApiRequest(`/api/admin/programs-top/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
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
}): Promise<ClassEvent[]> {
  if (opts?.programsId != null) {
    const qs = opts.archived === undefined ? '' : `?archived=${opts.archived}`
    const res = await adminApiRequest(
      `/api/admin/programs/${opts.programsId}/class-events${qs}`,
    )
    return parseJson(res)
  }
  const qs = opts?.archived === undefined ? '' : `?archived=${opts.archived}`
  const res = await adminApiRequest(`/api/admin/programs${qs}`)
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.message || 'Request failed')
  return data.data as ClassEvent[]
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

export async function updateClassEvent(
  id: number,
  payload: Partial<ClassEventFormData> & { programsId?: number | null },
): Promise<ClassEvent> {
  const body: Record<string, unknown> = { ...payload }
  if (payload.programsId != null) body.categoryId = payload.programsId
  const res = await adminApiRequest(`/api/admin/programs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
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

/** @deprecated Use fetchTopPrograms — categories alias during migration */
export async function fetchTopProgramsLegacy(archived?: boolean): Promise<TopProgram[]> {
  const qs = archived === undefined ? '' : `?archived=${archived}`
  const res = await adminApiRequest(`/api/admin/categories${qs}`)
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.message || 'Request failed')
  return data.data as TopProgram[]
}
