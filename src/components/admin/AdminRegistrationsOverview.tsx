import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  Loader2,
  RotateCcw,
  Search,
  X,
  Zap,
} from 'lucide-react'
import MemberEnrollmentsPanel, { type MemberEnrollmentRow } from '../member/MemberEnrollmentsPanel'
import AdminEnrollmentActionModal, {
  AdminEnrollmentStatusBadge,
} from './memberAccount/AdminEnrollmentActionModal'
import {
  CLASS_SKILL_LEVEL_FILTER_OPTIONS,
  type ClassSkillLevelFilter,
} from '../../utils/classDisplayUtils'
import { fetchClassesOffered, type PublicProgramOffered } from '../../utils/publicClassesApi'
import {
  adminFetchClassRegistrationSummaries,
  adminFetchEnrollmentsByMember,
  adminFetchFormSlotEnrollments,
  type AdminClassRegistrationSummary,
  type AdminEnrollmentRow,
  type AdminFormSlotEnrollmentRow,
} from '../../utils/schedulingApi'

type OverviewMode = 'by-member' | 'by-program'
type SortDir = 'asc' | 'desc'

const UNSPECIFIED_SPORT = '__unspecified_sport__'

function classMatchesLevelFilter(skillLevel: string | null, levelFilter: ClassSkillLevelFilter): boolean {
  if (levelFilter === 'all') return true
  return skillLevel == null || skillLevel === levelFilter
}

function sortRows<T extends object>(
  rows: T[],
  key: keyof T,
  dir: SortDir,
): T[] {
  const sorted = [...rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    const aStr = av == null ? '' : String(av)
    const bStr = bv == null ? '' : String(bv)
    const cmp = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' })
    return dir === 'asc' ? cmp : -cmp
  })
  return sorted
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string
  sortKey: string
  activeKey: string
  dir: SortDir
  onSort: (key: string) => void
}) {
  const active = activeKey === sortKey
  return (
    <th className="py-2 pr-4 font-semibold">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-gray-900 ${active ? 'text-gray-900' : ''}`}
      >
        {label}
        {active && <span className="text-[10px] text-gray-400">{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  )
}

function AdminClassRosterPanel({
  summary,
  onClose,
}: {
  summary: AdminClassRegistrationSummary
  onClose: () => void
}) {
  const [rows, setRows] = useState<AdminFormSlotEnrollmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeRow, setActiveRow] = useState<AdminEnrollmentRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetchFormSlotEnrollments(
        summary.formId,
        summary.slotGroupId,
        summary.timeSlotId,
      )
      setRows(data.rows ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roster')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [summary.formId, summary.slotGroupId, summary.timeSlotId])

  useEffect(() => {
    void load()
  }, [load])

  const heading = [summary.className, summary.offeringLabel || summary.offeringDates, summary.schedule]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="rounded-xl border border-vortex-red/30 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="min-w-0">
          <h4 className="text-base font-bold text-gray-900">Class roster</h4>
          <p className="text-sm text-gray-600 mt-0.5">{heading}</p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-gray-600 text-sm py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading roster…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No enrollments for this class schedule.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-auto border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="py-2 pr-4 font-semibold">Member</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 pr-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const name = `${row.member_first_name} ${row.member_last_name}`.trim() || 'Member'
                  return (
                    <tr key={`${row.source}-${row.id}`} className="border-b border-gray-100">
                      <td className="py-3 pr-4 text-gray-900">{name}</td>
                      <td className="py-3 pr-4">
                        <AdminEnrollmentStatusBadge row={row} />
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <button
                          type="button"
                          onClick={() => setActiveRow(row)}
                          title="Manage enrollment"
                          className="inline-flex items-center justify-center rounded-md border border-gray-200 p-1.5 text-amber-600 hover:bg-amber-50 hover:border-amber-300"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeRow && (
        <AdminEnrollmentActionModal
          row={activeRow}
          onClose={() => setActiveRow(null)}
          onChanged={() => {
            setActiveRow(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function AdminEnrollmentsByMemberView({ onRefresh }: { onRefresh: () => void }) {
  const [members, setMembers] = useState<
    Array<{ id: number; firstName: string; lastName: string; enrollments: MemberEnrollmentRow[] }>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetchEnrollmentsByMember()
      setMembers(
        (data.members ?? []).map((member) => ({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          enrollments: member.enrollments as MemberEnrollmentRow[],
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments')
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-vortex-red" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            onRefresh()
            void load()
          }}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <RotateCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {members.length === 0 ? (
        <p className="text-gray-600 text-sm py-4">No active members on record.</p>
      ) : (
        <div className="space-y-6">
          {members.map((member) => {
            const label = `${member.firstName} ${member.lastName}`.trim() || 'Member'
            if (member.enrollments.length === 0) {
              return (
                <section key={member.id} className="border border-gray-200 rounded-xl bg-white px-4 py-4">
                  <h3 className="text-lg font-bold text-black mb-1">{label}</h3>
                  <p className="text-sm text-gray-500">No enrollments</p>
                </section>
              )
            }
            return (
              <section key={member.id} className="border border-gray-200 rounded-xl bg-white px-4 py-4">
                <h3 className="text-lg font-bold text-black mb-3">{label}</h3>
                <MemberEnrollmentsPanel
                  enrollments={member.enrollments}
                  loading={false}
                  readOnly
                  embedded
                  defaultView="member"
                  hideViewToggle
                />
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AdminEnrollmentsByProgramView({ onRefresh }: { onRefresh: () => void }) {
  const [summaries, setSummaries] = useState<AdminClassRegistrationSummary[]>([])
  const [programs, setPrograms] = useState<PublicProgramOffered[]>([])
  const [selected, setSelected] = useState<AdminClassRegistrationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [programFilter, setProgramFilter] = useState<number | 'all'>('all')
  const [levelFilter, setLevelFilter] = useState<ClassSkillLevelFilter>('all')
  const [sortKey, setSortKey] = useState<string>('className')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryData, classesData] = await Promise.all([
        adminFetchClassRegistrationSummaries(),
        fetchClassesOffered().catch(() => ({ programs: [] as PublicProgramOffered[] })),
      ])
      setSummaries(summaryData.rows ?? [])
      setPrograms(classesData.programs ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load class registrations')
      setSummaries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sportOptions = useMemo(() => {
    const names = new Set<string>()
    let hasUnspecified = false
    for (const row of summaries) {
      if (row.sportName) names.add(row.sportName)
      else hasUnspecified = true
    }
    for (const program of programs) {
      if (program.primarySportName) names.add(program.primarySportName)
      else hasUnspecified = true
    }
    return { named: [...names].sort((a, b) => a.localeCompare(b)), hasUnspecified }
  }, [summaries, programs])

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return summaries.filter((row) => {
      if (programFilter !== 'all' && row.programId !== programFilter) return false
      const sportKey = row.sportName ?? UNSPECIFIED_SPORT
      if (sportFilter !== 'all') {
        if (sportFilter === UNSPECIFIED_SPORT && row.sportName) return false
        if (sportFilter !== UNSPECIFIED_SPORT && sportKey !== sportFilter) return false
      }
      if (!classMatchesLevelFilter(row.skillLevel, levelFilter)) return false
      if (!q) return true
      const haystack = [
        row.sportName ?? '',
        row.programName ?? '',
        row.className,
        row.offeringLabel ?? '',
        row.offeringDates ?? '',
        row.schedule,
        row.statusLabel,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [summaries, programFilter, sportFilter, levelFilter, searchQuery])

  const sortedRows = useMemo(
    () => sortRows(filteredRows, sortKey as keyof AdminClassRegistrationSummary, sortDir),
    [filteredRows, sortKey, sortDir],
  )

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-vortex-red" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
        {error}
      </div>
    )
  }

  const controlClass =
    'w-full h-10 rounded-lg border border-gray-300 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-vortex-red/30 focus:border-vortex-red'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search classes…"
            className={`${controlClass} pl-9`}
          />
        </div>
        <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} className={controlClass}>
          <option value="all">All sports</option>
          {sportOptions.named.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
          {sportOptions.hasUnspecified && <option value={UNSPECIFIED_SPORT}>Unspecified sport</option>}
        </select>
        <select
          value={programFilter === 'all' ? 'all' : String(programFilter)}
          onChange={(e) =>
            setProgramFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          className={controlClass}
        >
          <option value="all">All programs</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.displayName}
            </option>
          ))}
        </select>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as ClassSkillLevelFilter)}
          className={controlClass}
        >
          {CLASS_SKILL_LEVEL_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            onRefresh()
            void load()
          }}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <RotateCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
        <table className="w-full text-sm table-auto border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
              <SortableTh label="Sport" sortKey="sportName" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableTh label="Class" sortKey="className" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableTh label="Offering" sortKey="offeringLabel" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableTh label="Schedule" sortKey="schedule" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableTh label="Status" sortKey="statusLabel" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <th className="py-2 pr-4 font-semibold text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No class schedules match your filters.
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const selectedRow = selected?.rowKey === row.rowKey
                return (
                  <tr
                    key={row.rowKey}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      selectedRow ? 'bg-vortex-red/5' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelected(row)}
                  >
                    <td className="py-3 pr-4 text-gray-700">{row.sportName || '—'}</td>
                    <td className="py-3 pr-4 text-gray-900">{row.className}</td>
                    <td className="py-3 pr-4 text-gray-700">
                      {row.offeringLabel || row.offeringDates || '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{row.schedule || '—'}</td>
                    <td className="py-3 pr-4 text-gray-700">{row.statusLabel}</td>
                    <td className="py-3 pr-4 text-center text-gray-400 text-xs">View roster</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <AdminClassRosterPanel summary={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

export default function AdminRegistrationsOverview() {
  const [mode, setMode] = useState<OverviewMode>('by-program')
  const [refreshKey, setRefreshKey] = useState(0)

  const triggerRefresh = () => setRefreshKey((k) => k + 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-vortex-red" />
            Enrollments
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            View registrations by member or browse class schedules and manage rosters.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setMode('by-member')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              mode === 'by-member' ? 'bg-vortex-red text-white' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            By User
          </button>
          <button
            type="button"
            onClick={() => setMode('by-program')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              mode === 'by-program' ? 'bg-vortex-red text-white' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            By Program
          </button>
        </div>
      </div>

      {mode === 'by-member' ? (
        <AdminEnrollmentsByMemberView key={`member-${refreshKey}`} onRefresh={triggerRefresh} />
      ) : (
        <AdminEnrollmentsByProgramView key={`program-${refreshKey}`} onRefresh={triggerRefresh} />
      )}
    </div>
  )
}
