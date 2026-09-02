import { Fragment, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Archive,
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Edit2,
  Filter,
  Loader2,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { adminApiRequest } from '../utils/api'
import MemberAccountPanel from './admin/memberAccount/MemberAccountPanel'
import type { MemberAccountTab, MemberDirectorySummary } from './admin/memberAccount/types'
import {
  buildAccountDirectoryQuery,
  createDefaultAccountDirectoryFilters,
  type AccountDirectoryFacetKey,
  type AccountDirectoryFacetCounts,
  type AccountDirectoryFilters,
  type AccountDirectoryResponse,
  type AccountDirectoryRow,
  type AccountDirectorySort,
  type AccountDirectorySortKey,
} from './admin/accountDirectory'
import FamilySignupWizard from './signup/FamilySignupWizard'

interface MemberArchiveBlocker {
  type: string
  message: string
}

interface DirectoryPage {
  rows: AccountDirectoryRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  facets?: AccountDirectoryFacetCounts
}

interface FacetOption {
  value: string
  label: string
}

interface FacetDefinition {
  key: AccountDirectoryFacetKey
  label: string
  options: FacetOption[]
}

interface QuickView {
  id: string
  label: string
  filters: AccountDirectoryFilters
}

const PAGE_SIZE = 50
const EMPTY_DIRECTORY_PAGE: DirectoryPage = {
  rows: [],
  total: 0,
  page: 1,
  pageSize: PAGE_SIZE,
  totalPages: 1,
  facets: undefined,
}

const memberIconBtn =
  'p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none'
const memberThClass = 'py-3 pr-4 font-semibold whitespace-nowrap'
const memberTdClass = 'py-3 pr-4 align-middle'

const ACCOUNT_TABLE_COLUMNS: Array<{ key: AccountDirectorySortKey; label: string }> = [
  { key: 'member', label: 'Member' },
  { key: 'family', label: 'Family' },
  { key: 'participation', label: 'Participation' },
  { key: 'household', label: 'Household' },
  { key: 'portalAccess', label: 'Portal access' },
  { key: 'staffAccess', label: 'Staff access' },
  { key: 'waiver', label: 'Waiver' },
  { key: 'recordStatus', label: 'Record' },
]

const FACET_DEFINITIONS: FacetDefinition[] = [
  {
    key: 'record',
    label: 'Record',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'archived', label: 'Archived' },
    ],
  },
  {
    key: 'portal',
    label: 'Portal',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'setup_required', label: 'Setup required' },
      { value: 'suspended', label: 'Suspended' },
      { value: 'no_login', label: 'No login' },
    ],
  },
  {
    key: 'role',
    label: 'Staff access',
    options: [
      { value: 'OWNER', label: 'Owner' },
      { value: 'ADMINISTRATOR', label: 'Administrator' },
      { value: 'COACH', label: 'Coach' },
    ],
  },
  {
    key: 'responsibility',
    label: 'Household',
    options: [
      { value: 'payer', label: 'Payer' },
      { value: 'guardian', label: 'Guardian' },
      { value: 'dependent', label: 'Dependent' },
    ],
  },
  {
    key: 'participation',
    label: 'Participation',
    options: [
      { value: 'current', label: 'Current' },
      { value: 'upcoming', label: 'Upcoming' },
      { value: 'paused', label: 'Paused' },
      { value: 'waitlisted', label: 'Waitlisted' },
      { value: 'former', label: 'Former' },
      { value: 'never', label: 'Never enrolled' },
    ],
  },
  {
    key: 'waiver',
    label: 'Waiver',
    options: [
      { value: 'current', label: 'Current' },
      { value: 'action_required', label: 'Action required' },
      { value: 'not_required', label: 'Not required' },
    ],
  },
  {
    key: 'ageGroup',
    label: 'Age',
    options: [
      { value: 'youth', label: 'Youth' },
      { value: 'adult', label: 'Adult' },
      { value: 'unknown', label: 'DOB missing' },
    ],
  },
  {
    key: 'review',
    label: 'Data review',
    options: [
      { value: 'needed', label: 'Needs review' },
      { value: 'clear', label: 'No issues' },
    ],
  },
]

function quickViewFilters(overrides: Partial<AccountDirectoryFilters>): AccountDirectoryFilters {
  return { ...createDefaultAccountDirectoryFilters(), ...overrides }
}

const QUICK_VIEWS: QuickView[] = [
  { id: 'active', label: 'All active', filters: quickViewFilters({}) },
  { id: 'current', label: 'Currently enrolled', filters: quickViewFilters({ participation: ['current'] }) },
  { id: 'starting', label: 'Starting soon', filters: quickViewFilters({ participation: ['upcoming'] }) },
  { id: 'waivers', label: 'Waivers needed', filters: quickViewFilters({ waiver: ['action_required'] }) },
  { id: 'review', label: 'Needs review', filters: quickViewFilters({ review: ['needed'] }) },
  {
    id: 'staff',
    label: 'Staff',
    filters: quickViewFilters({ role: ['OWNER', 'ADMINISTRATOR', 'COACH'] }),
  },
  { id: 'archived', label: 'Archived', filters: quickViewFilters({ record: ['archived'] }) },
]

function formatArchiveBlockers(blockers: MemberArchiveBlocker[]): string {
  return [
    'This member cannot be archived yet:',
    '',
    ...blockers.map((blocker) => `• ${blocker.message}`),
    '',
    'Resolve the items above, then try archiving again.',
  ].join('\n')
}

function filtersEqual(left: AccountDirectoryFilters, right: AccountDirectoryFilters): boolean {
  return FACET_DEFINITIONS.every(({ key }) => (
    left[key].length === right[key].length && left[key].every((value) => right[key].includes(value))
  ))
}

function FacetFilter({
  definition,
  selected,
  counts,
  onToggle,
}: {
  definition: FacetDefinition
  selected: string[]
  counts?: Record<string, number>
  onToggle: (value: string) => void
}) {
  return (
    <details className="group relative">
      <summary
        className={`flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vortex-red focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden ${
          selected.length > 0
            ? 'border-red-200 bg-red-50 text-vortex-red'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        {definition.label}
        {selected.length > 0 ? (
          <span className="rounded-full bg-vortex-red px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {selected.length}
          </span>
        ) : null}
        <ChevronDown className="h-3.5 w-3.5 text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="absolute left-0 z-30 mt-1 min-w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
        {definition.options.map((option) => {
          const checked = selected.includes(option.value)
          const countKey = definition.key === 'role'
            ? option.value === 'OWNER'
              ? 'owner'
              : option.value === 'ADMINISTRATOR'
                ? 'administrator'
                : option.value.toLowerCase()
            : option.value
          const count = counts?.[countKey]
          return (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border ${
                  checked ? 'border-vortex-red bg-vortex-red text-white' : 'border-gray-300 bg-white'
                }`}
                aria-hidden="true"
              >
                {checked ? <Check className="h-3 w-3" /> : null}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => onToggle(option.value)}
              />
              <span className="flex-1">{option.label}</span>
              {count != null ? <span className="text-xs tabular-nums text-gray-400">{count}</span> : null}
            </label>
          )
        })}
      </div>
    </details>
  )
}

function StatusPill({
  children,
  tone = 'gray',
}: {
  children: string
  tone?: 'green' | 'blue' | 'cyan' | 'amber' | 'purple' | 'red' | 'gray'
}) {
  const tones = {
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    cyan: 'bg-cyan-50 text-cyan-700',
    amber: 'bg-amber-50 text-amber-800',
    purple: 'bg-purple-50 text-purple-700',
    red: 'bg-red-50 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

function ParticipationDisplay({ row }: { row: AccountDirectoryRow }) {
  const parts = [
    row.participation.current > 0
      ? <StatusPill key="current" tone="blue">{`${row.participation.current} current`}</StatusPill>
      : null,
    row.participation.upcoming > 0
      ? <StatusPill key="upcoming" tone="cyan">{`${row.participation.upcoming} upcoming`}</StatusPill>
      : null,
    row.participation.waitlisted > 0
      ? <StatusPill key="waitlisted" tone="amber">{`${row.participation.waitlisted} waitlisted`}</StatusPill>
      : null,
    row.participation.paused > 0
      ? <StatusPill key="paused">{`${row.participation.paused} paused`}</StatusPill>
      : null,
    row.participation.former > 0 && row.participation.current === 0 && row.participation.upcoming === 0
      ? <StatusPill key="former">Former</StatusPill>
      : null,
  ].filter(Boolean)

  return parts.length > 0
    ? <div className="flex flex-wrap gap-1">{parts}</div>
    : <span className="text-gray-500">Never enrolled</span>
}

function HouseholdDisplay({ row }: { row: AccountDirectoryRow }) {
  const labels: Array<{ active: boolean; label: string; tone: 'purple' | 'blue' | 'gray' }> = [
    { active: row.household.isPayer, label: 'Payer', tone: 'purple' },
    { active: row.household.isGuardian, label: 'Guardian', tone: 'blue' },
    { active: row.household.isDependent, label: 'Dependent', tone: 'gray' },
  ]
  const activeLabels = labels.filter((item) => item.active)
  return activeLabels.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {activeLabels.map((item) => <StatusPill key={item.label} tone={item.tone}>{item.label}</StatusPill>)}
    </div>
  ) : <span className="text-gray-500">—</span>
}

function PortalAccessDisplay({ status }: { status: AccountDirectoryRow['portalAccess']['status'] }) {
  if (status === 'active') return <StatusPill tone="green">Active</StatusPill>
  if (status === 'setup_required') return <StatusPill tone="amber">Setup required</StatusPill>
  if (status === 'suspended') return <StatusPill tone="red">Suspended</StatusPill>
  return <StatusPill>No login</StatusPill>
}

function WaiverDisplay({ waiver }: { waiver: AccountDirectoryRow['waiver'] }) {
  if (waiver.status === 'current') return <StatusPill tone="green">Current</StatusPill>
  if (waiver.status === 'action_required') return <StatusPill tone="amber">Action required</StatusPill>
  return <StatusPill>Not required</StatusPill>
}

function directorySummary(row: AccountDirectoryRow): MemberDirectorySummary {
  return {
    recordStatus: row.recordStatus,
    portalAccess: row.portalAccess,
    staffAccess: row.staffAccess,
    household: row.household,
    participation: row.participation,
    waiver: row.waiver,
    ageGroup: row.ageGroup,
    dataQuality: row.dataQuality,
  }
}

interface AdminMembersProps {
  canCreateAccounts?: boolean
  canViewBilling?: boolean
  canEditMembers?: boolean
  canArchiveMembers?: boolean
  canManageClasses?: boolean
}

export default function AdminMembers({
  canCreateAccounts = false,
  canViewBilling = false,
  canEditMembers = false,
  canArchiveMembers = false,
  canManageClasses = false,
}: AdminMembersProps) {
  const [directory, setDirectory] = useState<DirectoryPage>(EMPTY_DIRECTORY_PAGE)
  const [membersLoading, setMembersLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(memberSearchQuery)
  const [filters, setFilters] = useState<AccountDirectoryFilters>(createDefaultAccountDirectoryFilters)
  const [memberSort, setMemberSort] = useState<AccountDirectorySort>({ key: 'member', direction: 'asc' })
  const [page, setPage] = useState(1)
  const requestSequence = useRef(0)
  const [seedingDevMembers, setSeedingDevMembers] = useState(false)
  const [showFamilySignupWizard, setShowFamilySignupWizard] = useState(false)
  const [showAccountEditWizard, setShowAccountEditWizard] = useState(false)
  const [accountEditMemberId, setAccountEditMemberId] = useState<number | null>(null)
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null)
  const [expandedTab, setExpandedTab] = useState<MemberAccountTab>('details')
  const showActions = canViewBilling || canEditMembers || canArchiveMembers

  const fetchMembers = useCallback(async () => {
    const requestId = ++requestSequence.current
    setMembersLoading(true)
    setLoadError(null)
    try {
      const query = buildAccountDirectoryQuery({
        search: deferredSearchQuery,
        filters,
        sort: memberSort,
        page,
        pageSize: PAGE_SIZE,
      })
      const response = await adminApiRequest(`/api/admin/account-directory?${query}`)

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || `Failed to load accounts (${response.status})`)
      }
      const payload = await response.json() as AccountDirectoryResponse
      if (!payload.success || !Array.isArray(payload.data?.rows)) {
        throw new Error('The account directory returned an invalid response.')
      }
      const nextPage: DirectoryPage = {
        rows: payload.data.rows,
        total: payload.data.total,
        page: payload.data.page,
        pageSize: payload.data.pageSize,
        totalPages: Math.max(1, payload.data.totalPages),
        facets: payload.data.facets,
      }

      if (requestId !== requestSequence.current) return
      if (nextPage.page > nextPage.totalPages) {
        setPage(nextPage.totalPages)
        return
      }
      setDirectory(nextPage)
      if (nextPage.page !== page) setPage(nextPage.page)
    } catch (error) {
      if (requestId !== requestSequence.current) return
      setDirectory(EMPTY_DIRECTORY_PAGE)
      setLoadError(error instanceof Error ? error.message : 'Failed to load accounts')
    } finally {
      if (requestId === requestSequence.current) setMembersLoading(false)
    }
  }, [deferredSearchQuery, filters, memberSort, page])

  useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  const activeQuickView = QUICK_VIEWS.find((view) => filtersEqual(view.filters, filters))?.id ?? null
  const activeFilterCount = Object.values(filters).reduce((count, values) => count + values.length, 0)

  const toggleFacetValue = (key: AccountDirectoryFacetKey, value: string) => {
    setPage(1)
    setFilters((current) => {
      const selected = current[key]
      return {
        ...current,
        [key]: selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value],
      }
    })
  }

  const applyQuickView = (view: QuickView) => {
    setPage(1)
    setFilters(view.filters)
  }

  const toggleMemberSort = (key: AccountDirectorySortKey) => {
    setPage(1)
    setMemberSort((current) => (
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    ))
  }

  const seedDevTestMembers = useCallback(async () => {
    if (!confirm('Load 15 dev-only test members? Existing dev test members will be replaced. Password for all: Vortex25!')) return
    setSeedingDevMembers(true)
    try {
      const response = await adminApiRequest('/api/admin/dev/seed-test-members', {
        method: 'POST',
        body: JSON.stringify({ replace: true }),
      })
      const data = await response.json()
      if (data.success) {
        alert(`Created ${data.data?.created ?? 0} dev test members.\n\nPassword for all accounts: Vortex25!`)
        await fetchMembers()
      } else {
        alert(data.message || 'Failed to seed dev test members')
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to seed dev test members')
    } finally {
      setSeedingDevMembers(false)
    }
  }, [fetchMembers])

  const handleArchiveMember = async (id: number, archived: boolean): Promise<boolean> => {
    try {
      if (archived) {
        const preflightResponse = await adminApiRequest(`/api/admin/members/${id}/archive-check`)
        const preflightData = await preflightResponse.json().catch(() => ({}))
        const blockers = Array.isArray(preflightData.blockers)
          ? preflightData.blockers as MemberArchiveBlocker[]
          : []
        if (blockers.length > 0) {
          alert(formatArchiveBlockers(blockers))
          return false
        }
        if (!preflightResponse.ok || preflightData.canArchive !== true) {
          alert(preflightData.message || 'Unable to check whether this member can be archived.')
          return false
        }
      }

      if (!confirm(archived ? 'Are you sure you want to archive this member?' : 'Are you sure you want to unarchive this member?')) return false
      const response = await adminApiRequest(`/api/admin/members/${id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ archived }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        await fetchMembers()
        return true
      }
      const blockers = Array.isArray(data.blockers) ? data.blockers as MemberArchiveBlocker[] : []
      alert(blockers.length > 0 ? formatArchiveBlockers(blockers) : data.message || 'Failed to archive/unarchive member')
      return false
    } catch (error) {
      console.error('Error archiving member:', error)
      alert('Failed to archive/unarchive member')
      return false
    }
  }

  const openAccountEditWizard = (memberId: number) => {
    if (!canEditMembers) return
    setExpandedMemberId(null)
    setAccountEditMemberId(memberId)
    setShowAccountEditWizard(true)
  }

  const toggleExpandedMember = (memberId: number, tab: MemberAccountTab = 'details') => {
    if (expandedMemberId === memberId) {
      setExpandedMemberId(null)
      return
    }
    setExpandedMemberId(memberId)
    setExpandedTab(tab)
  }

  const openMemberBilling = (member: AccountDirectoryRow) => {
    if (member.family.id == null) return
    const url = new URL(window.location.href)
    url.searchParams.set('adminBillingFamilyId', String(member.family.id))
    url.searchParams.set('adminBillingMemberId', String(member.id))
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  const firstVisible = directory.total === 0 ? 0 : (directory.page - 1) * directory.pageSize + 1
  const lastVisible = Math.min(directory.page * directory.pageSize, directory.total)

  return (
    <>
      <motion.div
        key="membership"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="min-w-0 max-w-full space-y-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <Users className="h-7 w-7 text-vortex-red" />
              Members
              <span className="text-lg font-semibold text-gray-500">({directory.total})</span>
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Manage members, household responsibilities, participation, and access in one directory.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {import.meta.env.DEV && canCreateAccounts ? (
              <button
                type="button"
                onClick={() => void seedDevTestMembers()}
                disabled={seedingDevMembers}
                title="Load 15 dev test members (password: Vortex25!)"
                aria-label="Load dev test members"
                className={`${memberIconBtn} border border-amber-200 text-amber-800 hover:bg-amber-50`}
              >
                {seedingDevMembers ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="px-1 text-xs font-semibold">Dev members</span>}
              </button>
            ) : null}
            {canCreateAccounts ? (
              <button
                type="button"
                onClick={() => setShowFamilySignupWizard(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 font-semibold text-white hover:bg-red-700"
              >
                <UserPlus className="h-5 w-5" />
                New account
              </button>
            ) : null}
          </div>
        </div>

        <section aria-label="Account directory filters" className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative w-full shrink-0 xl:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search members or families…"
                value={memberSearchQuery}
                onChange={(event) => {
                  setPage(1)
                  setMemberSearchQuery(event.target.value)
                }}
                className="h-9 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <Filter className="h-3.5 w-3.5" /> Quick views
              </span>
              {QUICK_VIEWS.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  aria-pressed={activeQuickView === view.id}
                  onClick={() => applyQuickView(view)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeQuickView === view.id
                      ? 'border-vortex-red bg-vortex-red text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            {FACET_DEFINITIONS.map((definition) => (
              <FacetFilter
                key={definition.key}
                definition={definition}
                selected={filters[definition.key]}
                counts={directory.facets?.[definition.key]}
                onToggle={(value) => toggleFacetValue(definition.key, value)}
              />
            ))}
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setPage(1)
                  setFilters({
                    record: [], portal: [], role: [], responsibility: [], participation: [], waiver: [], ageGroup: [], review: [],
                  })
                }}
                className="h-9 px-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Clear filters
              </button>
            ) : null}
            <span className="ml-auto text-xs text-gray-500">OR within a filter · AND across filters</span>
          </div>
        </section>

        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700">
            <p>{loadError}</p>
            <button type="button" onClick={() => void fetchMembers()} className="mt-3 font-semibold underline underline-offset-2">
              Try again
            </button>
          </div>
        ) : membersLoading && directory.rows.length === 0 ? (
          <div className="inline-flex w-full items-center justify-center gap-2 py-12 text-center text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading members…
          </div>
        ) : directory.rows.length === 0 ? (
          <div className="rounded-xl border border-dashed py-12 text-center text-gray-500">
            No accounts match these filters.
          </div>
        ) : (
          <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[1320px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className={`${memberThClass} w-8 pl-3`} aria-label="Expand" />
                    {ACCOUNT_TABLE_COLUMNS.map(({ key, label }) => {
                      const isSorted = memberSort.key === key
                      return (
                        <th key={key} className={memberThClass} aria-sort={isSorted ? (memberSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded text-left hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-vortex-red focus-visible:ring-offset-2"
                            onClick={() => toggleMemberSort(key)}
                          >
                            {label}
                            <ArrowDownUp className={`h-3.5 w-3.5 ${isSorted ? 'text-vortex-red' : 'text-gray-400'}`} aria-hidden="true" />
                            <span className="sr-only">
                              {isSorted ? `, sorted ${memberSort.direction === 'asc' ? 'ascending' : 'descending'}` : ', not sorted'}
                            </span>
                          </button>
                        </th>
                      )
                    })}
                    {showActions ? <th className={`${memberThClass} w-0`}>Actions</th> : null}
                  </tr>
                </thead>
                <tbody className={membersLoading ? 'opacity-60' : undefined}>
                  {directory.rows.map((member) => {
                    const isExpanded = expandedMemberId === member.id
                    const isActive = member.recordStatus === 'active'
                    return (
                      <Fragment key={member.id}>
                        <tr
                          onClick={() => toggleExpandedMember(member.id)}
                          className={`cursor-pointer border-b border-gray-100 transition-colors ${
                            isExpanded ? 'bg-blue-50/60' : 'hover:bg-gray-50/80'
                          } ${!isActive ? 'bg-gray-50/50' : ''}`}
                        >
                          <td className={`${memberTdClass} w-8 pl-2`}>
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${member.firstName} ${member.lastName}`}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-vortex-red"
                              onClick={(event) => {
                                event.stopPropagation()
                                toggleExpandedMember(member.id)
                              }}
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </td>
                          <td className={memberTdClass}>
                            <div className="font-medium text-gray-900">{member.firstName} {member.lastName}</div>
                            <div className="mt-0.5 text-xs text-gray-500">
                              {member.ageGroup === 'unknown' ? 'DOB missing' : `${member.ageGroup === 'youth' ? 'Youth' : 'Adult'}${member.age != null ? ` · ${member.age}` : ''}`}
                              {member.dataQuality.length > 0 ? ` · ${member.dataQuality.length} data alert${member.dataQuality.length === 1 ? '' : 's'}` : ''}
                            </div>
                          </td>
                          <td className={memberTdClass}>
                            <div className="whitespace-nowrap text-gray-900">{member.family.name || 'No family'}</div>
                            {member.family.id != null ? <div className="mt-0.5 text-xs text-gray-500">Fam #{member.family.id}</div> : null}
                          </td>
                          <td className={memberTdClass}><ParticipationDisplay row={member} /></td>
                          <td className={memberTdClass}><HouseholdDisplay row={member} /></td>
                          <td className={memberTdClass}><PortalAccessDisplay status={member.portalAccess.status} /></td>
                          <td className={memberTdClass}>
                            {member.staffAccess.labels.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {member.staffAccess.labels.map((label) => <StatusPill key={label} tone="purple">{label}</StatusPill>)}
                                {member.staffAccess.status === 'suspended' ? <StatusPill tone="red">Suspended</StatusPill> : null}
                              </div>
                            ) : <span className="text-gray-500">None</span>}
                          </td>
                          <td className={memberTdClass}><WaiverDisplay waiver={member.waiver} /></td>
                          <td className={memberTdClass}>
                            <StatusPill tone={isActive ? 'green' : 'gray'}>{isActive ? 'Active' : 'Archived'}</StatusPill>
                          </td>
                          {showActions ? <td className={`${memberTdClass} w-0 whitespace-nowrap`} onClick={(event) => event.stopPropagation()}>
                            <div className="flex items-center gap-0.5">
                              {canViewBilling ? <button
                                type="button"
                                className={`${memberIconBtn} text-vortex-red hover:bg-red-50`}
                                title={member.family.id == null ? 'No family billing account' : 'Open Account Billing & Enrollments'}
                                aria-label={`Open ${member.firstName} ${member.lastName}'s Account Billing & Enrollments`}
                                disabled={member.family.id == null}
                                onClick={() => openMemberBilling(member)}
                              >
                                <CreditCard className="h-4 w-4" />
                              </button> : null}
                              {canEditMembers ? <button
                                type="button"
                                className={memberIconBtn}
                                title="Edit member"
                                aria-label={`Edit ${member.firstName} ${member.lastName}`}
                                onClick={() => openAccountEditWizard(member.id)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </button> : null}
                              {canArchiveMembers && !member.staffAccess.roles.includes('OWNER') ? (
                                <button
                                  type="button"
                                  className={memberIconBtn}
                                  title={isActive ? 'Archive member' : 'Unarchive member'}
                                  aria-label={`${isActive ? 'Archive' : 'Unarchive'} ${member.firstName} ${member.lastName}`}
                                  onClick={() => void handleArchiveMember(member.id, isActive)}
                                >
                                  <Archive className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>
                          </td> : null}
                        </tr>
                        {isExpanded ? (
                          <tr className="border-b border-gray-200">
                            <td colSpan={ACCOUNT_TABLE_COLUMNS.length + (showActions ? 2 : 1)} className="p-0">
                              <MemberAccountPanel
                                memberId={member.id}
                                memberName={`${member.firstName} ${member.lastName}`.trim()}
                                directorySummary={directorySummary(member)}
                                initialTab={expandedTab}
                                onAccountChanged={fetchMembers}
                                canManageSecurity={canEditMembers}
                                canManageNotes={canEditMembers}
                                canManageMissedClasses={canManageClasses}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
              <span>Showing {firstVisible}–{lastVisible} of {directory.total}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={directory.page <= 1 || membersLoading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <span className="min-w-20 text-center">Page {directory.page} of {directory.totalPages}</span>
                <button
                  type="button"
                  disabled={directory.page >= directory.totalPages || membersLoading}
                  onClick={() => setPage((current) => Math.min(directory.totalPages, current + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {((showFamilySignupWizard && canCreateAccounts) || (showAccountEditWizard && canEditMembers)) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setShowFamilySignupWizard(false)
                setShowAccountEditWizard(false)
                setAccountEditMemberId(null)
              }}
              className="absolute right-4 top-4 rounded-full p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            {showAccountEditWizard && accountEditMemberId != null ? (
              <FamilySignupWizard
                mode="admin-edit"
                editMemberId={accountEditMemberId}
                onComplete={() => {
                  setShowAccountEditWizard(false)
                  setAccountEditMemberId(null)
                  void fetchMembers()
                }}
                onCancel={() => {
                  setShowAccountEditWizard(false)
                  setAccountEditMemberId(null)
                }}
              />
            ) : (
              <FamilySignupWizard
                mode="admin"
                onComplete={() => {
                  setShowFamilySignupWizard(false)
                  void fetchMembers()
                }}
                onCancel={() => setShowFamilySignupWizard(false)}
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
