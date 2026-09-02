export type RecordStatus = 'active' | 'archived'
export type PortalAccessStatus = 'active' | 'setup_required' | 'suspended' | 'no_login'
export type StaffAccessRole = 'OWNER' | 'ADMINISTRATOR' | 'COACH'
export type StaffAccessStatus = 'active' | 'suspended' | 'none'
export type HouseholdBadge = 'payer' | 'guardian' | 'dependent'
export type ParticipationState = 'current' | 'upcoming' | 'paused' | 'waitlisted' | 'former' | 'never'
export type WaiverStatus = 'current' | 'action_required' | 'not_required'
export type AgeGroup = 'youth' | 'adult' | 'unknown'

export interface AccountDirectoryRow {
  id: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  age: number | null
  ageGroup: AgeGroup
  family: {
    id: number | null
    name: string | null
  }
  recordStatus: RecordStatus
  portalAccess: {
    status: PortalAccessStatus
    userId: number | null
  }
  staffAccess: {
    roles: StaffAccessRole[]
    labels: string[]
    status: StaffAccessStatus
  }
  household: {
    isPayer: boolean
    isGuardian: boolean
    isDependent: boolean
    badges: HouseholdBadge[]
  }
  participation: {
    current: number
    upcoming: number
    paused: number
    waitlisted: number
    former: number
    total: number
    states: ParticipationState[]
  }
  waiver: {
    status: WaiverStatus
    requiredCount: number
    acceptedCount: number
    lastAcceptedAt: string | null
  }
  dataQuality: string[]
}

export interface AccountDirectoryResponse {
  success: boolean
  data: {
    rows: AccountDirectoryRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
    facets?: AccountDirectoryFacetCounts
  }
}

export type AccountDirectoryFacetKey =
  | 'record'
  | 'portal'
  | 'role'
  | 'responsibility'
  | 'participation'
  | 'waiver'
  | 'ageGroup'
  | 'review'

export type AccountDirectoryFilters = Record<AccountDirectoryFacetKey, string[]>
export type AccountDirectoryFacetCounts = Partial<
  Record<AccountDirectoryFacetKey, Record<string, number>>
>

export type AccountDirectorySortKey =
  | 'member'
  | 'family'
  | 'participation'
  | 'household'
  | 'portalAccess'
  | 'staffAccess'
  | 'waiver'
  | 'recordStatus'

export interface AccountDirectorySort {
  key: AccountDirectorySortKey
  direction: 'asc' | 'desc'
}

export function createDefaultAccountDirectoryFilters(): AccountDirectoryFilters {
  return {
    record: ['active'],
    portal: [],
    role: [],
    responsibility: [],
    participation: [],
    waiver: [],
    ageGroup: [],
    review: [],
  }
}

export function buildAccountDirectoryQuery(params: {
  search: string
  filters: AccountDirectoryFilters
  sort: AccountDirectorySort
  page: number
  pageSize: number
}): string {
  const query = new URLSearchParams()
  if (params.search.trim()) query.set('search', params.search.trim())
  for (const [key, values] of Object.entries(params.filters)) {
    if (values.length > 0) query.set(key, values.join(','))
  }
  query.set('sortBy', params.sort.key)
  query.set('sortDir', params.sort.direction)
  query.set('page', String(params.page))
  query.set('pageSize', String(params.pageSize))
  return query.toString()
}
