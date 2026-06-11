import { adminApiRequest } from './api'

// ── Types ───────────────────────────────────────────────────────────────────

export interface School {
  id: number
  facilityId: number | null
  name: string
  level: 'high' | 'middle' | 'elementary' | 'other' | null
  location: string | null
  isVerified: boolean
  isActive: boolean
  createdAt: string
  memberCount?: number
}

export interface SchoolMember {
  id: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  status: string | null
  isActive: boolean
  dateOfBirth: string | null
  familyId: number | null
  familyName: string | null
  source: string | null
  linkedAt: string
}

export interface Note {
  id: number
  subjectType: 'member' | 'registration'
  subjectId: number
  noteType: 'user_comment' | 'staff_note'
  body: string
  authorKind: string | null
  authorId: number | null
  authorEmail: string | null
  authorName: string | null
  source: string | null
  createdAt: string
}

export interface DbQueryFieldMeta {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'boolean'
}

export interface DbQueryRelationMeta {
  key: string
  label: string
  cardinality: 'one' | 'many'
  fields: DbQueryFieldMeta[]
}

export interface DbQueryEntityMeta {
  key: string
  label: string
  fields: DbQueryFieldMeta[]
  relations: DbQueryRelationMeta[]
}

export interface DbQueryColumnRef {
  entity: string
  field: string
}

export interface DbQueryFilter {
  entity: string
  field: string
  op: string
  value?: string | number | boolean
}

export interface DbQueryConfig {
  baseEntity: string
  columns: DbQueryColumnRef[]
  filters?: DbQueryFilter[]
  limit?: number
}

export interface DbQueryResult {
  columns: { key: string; label: string; type: string }[]
  rows: Record<string, unknown>[]
}

export interface SavedQuery {
  id: number
  name: string
  baseEntity: string
  config: DbQueryConfig
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

const ADMIN_DATA_TOOLS_DEPLOY_MESSAGE =
  'Schools, Notes, and DB Queries are not on the production backend yet. Redeploy the Render service (Root Directory: backend, branch: main) and confirm GET /api/health returns apiFeatures.schools and apiFeatures.dbQueries: true.'

const DB_QUERIES_DEPLOY_MESSAGE = ADMIN_DATA_TOOLS_DEPLOY_MESSAGE
const SCHOOLS_DEPLOY_MESSAGE = ADMIN_DATA_TOOLS_DEPLOY_MESSAGE
const NOTES_DEPLOY_MESSAGE = ADMIN_DATA_TOOLS_DEPLOY_MESSAGE

async function unwrap<T>(res: Response, options?: { deployHint?: string }): Promise<T> {
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    if (res.status === 404 && json?.message === 'Route not found' && options?.deployHint) {
      throw new Error(options.deployHint)
    }
    throw new Error(json?.message || `Request failed (${res.status})`)
  }
  return json.data as T
}

// ── Schools ──────────────────────────────────────────────────────────────────

export const schoolsApi = {
  async list(params: { level?: string; active?: boolean; verified?: boolean } = {}): Promise<School[]> {
    const qs = new URLSearchParams()
    if (params.level) qs.set('level', params.level)
    if (typeof params.active === 'boolean') qs.set('active', String(params.active))
    if (typeof params.verified === 'boolean') qs.set('verified', String(params.verified))
    const q = qs.toString()
    return unwrap<School[]>(await adminApiRequest(`/api/admin/schools${q ? `?${q}` : ''}`), {
      deployHint: SCHOOLS_DEPLOY_MESSAGE,
    })
  },
  async unverified(): Promise<School[]> {
    return unwrap<School[]>(await adminApiRequest('/api/admin/schools/unverified'), {
      deployHint: SCHOOLS_DEPLOY_MESSAGE,
    })
  },
  async create(body: { name: string; level?: string | null; location?: string | null; isActive?: boolean }): Promise<School> {
    return unwrap<School>(
      await adminApiRequest('/api/admin/schools', { method: 'POST', body: JSON.stringify(body) }),
      { deployHint: SCHOOLS_DEPLOY_MESSAGE },
    )
  },
  async update(id: number, body: Partial<{ name: string; level: string | null; location: string | null; isActive: boolean; isVerified: boolean }>): Promise<School> {
    return unwrap<School>(
      await adminApiRequest(`/api/admin/schools/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      { deployHint: SCHOOLS_DEPLOY_MESSAGE },
    )
  },
  async setActive(id: number, isActive: boolean): Promise<School> {
    return unwrap<School>(
      await adminApiRequest(`/api/admin/schools/${id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
      { deployHint: SCHOOLS_DEPLOY_MESSAGE },
    )
  },
  async verify(id: number, body: Partial<{ name: string; level: string | null; location: string | null }> = {}): Promise<School> {
    return unwrap<School>(
      await adminApiRequest(`/api/admin/schools/${id}/verify`, { method: 'POST', body: JSON.stringify(body) }),
      { deployHint: SCHOOLS_DEPLOY_MESSAGE },
    )
  },
  async merge(id: number, targetSchoolId: number): Promise<void> {
    await unwrap(
      await adminApiRequest(`/api/admin/schools/${id}/merge`, { method: 'POST', body: JSON.stringify({ targetSchoolId }) }),
      { deployHint: SCHOOLS_DEPLOY_MESSAGE },
    )
  },
  async members(id: number): Promise<SchoolMember[]> {
    return unwrap<SchoolMember[]>(await adminApiRequest(`/api/admin/schools/${id}/members`), {
      deployHint: SCHOOLS_DEPLOY_MESSAGE,
    })
  },
  async forMember(memberId: number): Promise<School[]> {
    return unwrap<School[]>(await adminApiRequest(`/api/admin/members/${memberId}/schools`), {
      deployHint: SCHOOLS_DEPLOY_MESSAGE,
    })
  },
  async setForMember(memberId: number, schoolIds: number[], schoolWriteIn?: string | null): Promise<{ schoolIds: number[] }> {
    return unwrap<{ schoolIds: number[] }>(
      await adminApiRequest(`/api/admin/members/${memberId}/schools`, {
        method: 'PUT',
        body: JSON.stringify({ schoolIds, schoolWriteIn: schoolWriteIn || null }),
      }),
      { deployHint: SCHOOLS_DEPLOY_MESSAGE },
    )
  },
}

// ── Notes ──────────────────────────────────────────────────────────────────

export const notesApi = {
  async list(subjectType: 'member' | 'registration', subjectId: number, noteType?: 'user_comment' | 'staff_note'): Promise<Note[]> {
    const qs = new URLSearchParams({ subjectType, subjectId: String(subjectId) })
    if (noteType) qs.set('noteType', noteType)
    return unwrap<Note[]>(await adminApiRequest(`/api/admin/notes?${qs.toString()}`), {
      deployHint: NOTES_DEPLOY_MESSAGE,
    })
  },
  async add(body: { subjectType: 'member' | 'registration'; subjectId: number; noteType: 'user_comment' | 'staff_note'; body: string }): Promise<Note> {
    return unwrap<Note>(
      await adminApiRequest('/api/admin/notes', { method: 'POST', body: JSON.stringify(body) }),
      { deployHint: NOTES_DEPLOY_MESSAGE },
    )
  },
  async remove(id: number): Promise<void> {
    await unwrap(await adminApiRequest(`/api/admin/notes/${id}`, { method: 'DELETE' }), {
      deployHint: NOTES_DEPLOY_MESSAGE,
    })
  },
}

// ── DB Queries ────────────────────────────────────────────────────────────────

export const dbQueriesApi = {
  async entities(): Promise<DbQueryEntityMeta[]> {
    return unwrap<DbQueryEntityMeta[]>(
      await adminApiRequest('/api/admin/db-queries/entities'),
      { deployHint: DB_QUERIES_DEPLOY_MESSAGE },
    )
  },
  async run(config: DbQueryConfig): Promise<DbQueryResult> {
    return unwrap<DbQueryResult>(
      await adminApiRequest('/api/admin/db-queries/run', { method: 'POST', body: JSON.stringify(config) }),
      { deployHint: DB_QUERIES_DEPLOY_MESSAGE },
    )
  },
  async exportCsv(config: DbQueryConfig): Promise<Blob> {
    const res = await adminApiRequest('/api/admin/db-queries/export', { method: 'POST', body: JSON.stringify(config) })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json?.message || `Export failed (${res.status})`)
    }
    return res.blob()
  },
  async listSaved(): Promise<SavedQuery[]> {
    return unwrap<SavedQuery[]>(
      await adminApiRequest('/api/admin/db-queries/saved'),
      { deployHint: DB_QUERIES_DEPLOY_MESSAGE },
    )
  },
  async save(body: { id?: number; name: string; baseEntity: string; config: DbQueryConfig }): Promise<{ id: number }> {
    return unwrap<{ id: number }>(
      await adminApiRequest('/api/admin/db-queries/saved', { method: 'POST', body: JSON.stringify(body) }),
      { deployHint: DB_QUERIES_DEPLOY_MESSAGE },
    )
  },
  async deleteSaved(id: number): Promise<void> {
    await unwrap(await adminApiRequest(`/api/admin/db-queries/saved/${id}`, { method: 'DELETE' }))
  },
}
