import { Fragment, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  ChevronDown,
  CreditCard,
  Download,
  Loader2,
  Mail,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import MemberEnrollmentsPanel, { type MemberEnrollmentRow } from '../member/MemberEnrollmentsPanel'
import {
  CLASS_SKILL_LEVEL_FILTER_OPTIONS,
  type ClassSkillLevelFilter,
} from '../../utils/classDisplayUtils'
import { fetchClassesOffered, type PublicProgramOffered } from '../../utils/publicClassesApi'
import {
  adminFetchClassRegistrationSummaries,
  adminFetchEnrollmentsByMember,
  adminFetchFormSlotEnrollments,
  adminFetchDailyRoster,
  adminEmailDailyRoster,
  type AdminClassRegistrationSummary,
  type AdminFormSlotEnrollmentRow,
} from '../../utils/schedulingApi'

function easternDate(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function formatEnrollmentStartDate(date: string | null): string {
  if (!date) return '—'
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function downloadDailyRosterCsv(roster: Awaited<ReturnType<typeof adminFetchDailyRoster>>): void {
  const rows = [['Class', 'Program', 'Time', 'Athlete', 'Age', 'Email', 'Phone']]
  for (const item of roster.classes) {
    for (const athlete of item.athletes) {
      rows.push([
        item.className, item.programName || '', item.timeLabel, athlete.name,
        String(athlete.age ?? ''), athlete.email, athlete.phone,
      ])
    }
  }
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `daily-roster-${roster.date}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

type OverviewMode = 'by-member' | 'by-program'
type EnrollmentTab = 'monthly' | 'daily'
type SortDir = 'asc' | 'desc'

const UNSPECIFIED_SPORT = '__unspecified_sport__'
const DAILY_ROSTER_COLUMN_WIDTHS = ['34%', '10%', '28%', '28%'] as const

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

function openEnrollmentBilling(row: AdminFormSlotEnrollmentRow) {
  if (row.family_id == null) return
  const url = new URL(window.location.href)
  url.searchParams.set('adminBillingFamilyId', String(row.family_id))
  url.searchParams.set('adminBillingMemberId', String(row.member_id))
  window.open(url.toString(), '_blank', 'noopener,noreferrer')
}

function AdminClassRosterDetails({ summary }: { summary: AdminClassRegistrationSummary }) {
  const [rows, setRows] = useState<AdminFormSlotEnrollmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
      {error && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading enrollments…
        </div>
      ) : rows.length === 0 ? (
        <p className="py-3 text-sm text-gray-500">No current enrollments for this class schedule.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="p-3 font-semibold">Member</th>
                <th className="p-3 font-semibold">Start date</th>
                <th className="p-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name = `${row.member_first_name} ${row.member_last_name}`.trim() || 'Member'
                const hasFamilyBilling = row.family_id != null
                return (
                  <tr key={`${row.source}-${row.id}`} className="border-b border-gray-100 last:border-0">
                    <td className="p-3 text-gray-900">{name}</td>
                    <td className="p-3 text-gray-600">
                      {formatEnrollmentStartDate(row.enrollment_start_date)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => openEnrollmentBilling(row)}
                        disabled={!hasFamilyBilling}
                        title={hasFamilyBilling ? 'Open Account Billing & Enrollments' : 'No family billing account'}
                        aria-label={`Open ${name}'s Account Billing & Enrollments`}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-vortex-red hover:bg-red-50 disabled:pointer-events-none disabled:opacity-40"
                      >
                        <CreditCard className="h-4 w-4" />
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
        <p className="text-gray-600 text-sm py-4">No members with enrollments.</p>
      ) : (
        <div className="space-y-6">
          {members.map((member) => {
            const label = `${member.firstName} ${member.lastName}`.trim() || 'Member'
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
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
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
        row.offeringDates ?? '',
        row.offeringLabel ?? '',
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
              <th className="w-10 py-2 pl-3 pr-1" aria-label="Expand row" />
              <SortableTh label="Sport" sortKey="sportName" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableTh label="Program" sortKey="programName" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableTh label="Class" sortKey="className" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableTh label="Active dates" sortKey="offeringDates" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableTh label="Schedule" sortKey="schedule" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableTh label="Enrollments" sortKey="enrollmentCount" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No class schedules match your filters.
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const isExpanded = expandedRowKey === row.rowKey
                return (
                  <Fragment key={row.rowKey}>
                    <tr
                      className={`cursor-pointer border-b border-gray-100 transition-colors ${
                        isExpanded ? 'bg-vortex-red/5' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setExpandedRowKey((current) => current === row.rowKey ? null : row.rowKey)}
                    >
                      <td className="py-3 pl-3 pr-1">
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </td>
                      <td className="py-3 pr-4 text-gray-700">{row.sportName || '—'}</td>
                      <td className="py-3 pr-4 text-gray-700">{row.programName || '—'}</td>
                      <td className="py-3 pr-4 text-gray-900">{row.className}</td>
                      <td className="py-3 pr-4 text-gray-700">
                        {row.offeringDates || row.offeringLabel || '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-700">{row.schedule || '—'}</td>
                      <td className="py-3 pr-4 text-gray-700">{row.enrollmentCount}/{row.maxParticipants}</td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-b border-gray-100">
                        <td colSpan={7} className="p-0">
                          <AdminClassRosterDetails summary={row} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

function DailyEnrollmentsView() {
  const [date, setDate] = useState(easternDate)
  const [roster, setRoster] = useState<Awaited<ReturnType<typeof adminFetchDailyRoster>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRoster(await adminFetchDailyRoster(date))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load daily enrollments')
      setRoster(null)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { void load() }, [load])

  const openEmailDialog = () => {
    setSendError(null)
    setSendSuccess(null)
    setEmailDialogOpen(true)
  }

  const sendSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSending(true)
    setSendError(null)
    setSendSuccess(null)
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.()
      const result = await adminEmailDailyRoster(date, recipient.trim(), idempotencyKey)
      setSendSuccess(`Schedule sent to ${result.recipient}.`)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send the schedule email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" onClick={() => setDate((current) => addDays(current, -1))} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50" aria-label="Previous day">←</button>
          <label className="text-sm font-semibold text-gray-700">
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="ml-2 rounded-lg border border-gray-300 px-3 py-2 font-normal" />
          </label>
          <button type="button" onClick={() => setDate((current) => addDays(current, 1))} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50" aria-label="Next day">→</button>
          <button type="button" onClick={() => setDate(easternDate())} className="rounded-lg px-3 py-2 text-sm font-semibold text-vortex-red hover:bg-red-50">Today</button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50"><RotateCcw className="h-4 w-4" /> Refresh</button>
          <button type="button" disabled={!roster} onClick={() => roster && downloadDailyRosterCsv(roster)} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Download className="h-4 w-4" /> Export CSV</button>
          <button
            type="button"
            disabled={!roster}
            onClick={openEmailDialog}
            className="inline-flex items-center justify-center rounded-lg border border-vortex-red px-3 py-2 text-vortex-red hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Email daily schedule"
            title="Email daily schedule"
          >
            <Mail className="h-4 w-4" />
          </button>
        </div>
      </div>

      {emailDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-schedule-email-title"
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="daily-schedule-email-title" className="text-lg font-bold text-gray-900">Email daily schedule</h3>
                <p className="mt-1 text-sm text-gray-600">Send the {roster?.dateLabel || date} schedule and enrolled athletes.</p>
              </div>
              <button
                type="button"
                onClick={() => setEmailDialogOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close email schedule dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={(event) => void sendSchedule(event)}>
              <label className="block text-sm font-semibold text-gray-700">
                Recipient email
                <input
                  type="email"
                  required
                  autoFocus
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="team@vortexathletics.com"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-vortex-red focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </label>

              {sendError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{sendError}</p> : null}
              {sendSuccess ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{sendSuccess}</p> : null}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEmailDialogOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={sending || !recipient.trim()} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Send schedule
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-600"><Loader2 className="h-5 w-5 animate-spin" /> Loading daily enrollments…</div>
      ) : error ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : (
        <>
          <div><h3 className="text-lg font-bold text-gray-900">{roster?.dateLabel}</h3><p className="text-sm text-gray-600">{roster?.classCount ?? 0} classes · {roster?.athleteCount ?? 0} enrollments</p></div>
          {(roster?.classes ?? []).map((item) => (
            <section key={item.eventId} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="border-b bg-gray-50 px-4 py-3"><h4 className="font-bold text-gray-900">{[item.timeLabel, item.programName, item.className].filter(Boolean).join(' · ')}</h4></div>
              {item.athletes.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No enrollments for this class.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] table-fixed text-sm">
                    <colgroup>
                      {DAILY_ROSTER_COLUMN_WIDTHS.map((width) => <col key={width} style={{ width }} />)}
                    </colgroup>
                    <thead>
                      <tr className="border-b text-left text-gray-600">
                        <th className="p-3">Athlete</th>
                        <th className="p-3">Age</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.athletes.map((athlete) => (
                        <tr key={`${athlete.source}:${athlete.signupId}`} className="border-b last:border-0">
                          <td className="break-words p-3 font-semibold text-gray-900">{athlete.name}</td>
                          <td className="p-3 text-gray-600">{athlete.age ?? '—'}</td>
                          <td className="break-words p-3 text-gray-600">{athlete.email || '—'}</td>
                          <td className="break-words p-3 text-gray-600">{athlete.phone || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
          {(roster?.classes.length ?? 0) === 0 ? <p className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">No classes are scheduled for this date.</p> : null}
        </>
      )}
    </div>
  )
}

export default function AdminRegistrationsOverview() {
  const [activeTab, setActiveTab] = useState<EnrollmentTab>('monthly')
  const [mode, setMode] = useState<OverviewMode>('by-program')
  const [refreshKey, setRefreshKey] = useState(0)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState<string | null>(null)

  const triggerRefresh = () => setRefreshKey((k) => k + 1)

  const downloadDailyRoster = async () => {
    setRosterLoading(true)
    setRosterError(null)
    try {
      downloadDailyRosterCsv(await adminFetchDailyRoster(easternDate()))
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Failed to download daily roster')
    } finally {
      setRosterLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-vortex-red" />
            {activeTab === 'monthly' ? 'Monthly Enrollments' : 'Daily Enrollments'}
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            {activeTab === 'monthly'
              ? 'View recurring and temporary registrations by member or class schedule.'
              : 'View everyone attending each class on a selected day.'}
          </p>
        </div>
        {activeTab === 'monthly' ? <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void downloadDailyRoster()}
            disabled={rosterLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rosterLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Daily Roster
          </button>
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
          {rosterError && <p className="basis-full text-right text-xs text-red-700">{rosterError}</p>}
        </div> : null}
      </div>

      <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 bg-white" role="tablist" aria-label="Enrollment views">
        <button type="button" role="tab" aria-selected={activeTab === 'monthly'} onClick={() => setActiveTab('monthly')} className={`px-4 py-2 text-sm font-semibold ${activeTab === 'monthly' ? 'bg-vortex-red text-white' : 'text-gray-700 hover:bg-gray-50'}`}>Monthly Enrollments</button>
        <button type="button" role="tab" aria-selected={activeTab === 'daily'} onClick={() => setActiveTab('daily')} className={`px-4 py-2 text-sm font-semibold ${activeTab === 'daily' ? 'bg-vortex-red text-white' : 'text-gray-700 hover:bg-gray-50'}`}>Daily Enrollments</button>
      </div>

      {activeTab === 'daily' ? <DailyEnrollmentsView /> : mode === 'by-member' ? (
        <AdminEnrollmentsByMemberView key={`member-${refreshKey}`} onRefresh={triggerRefresh} />
      ) : (
        <AdminEnrollmentsByProgramView key={`program-${refreshKey}`} onRefresh={triggerRefresh} />
      )}
    </div>
  )
}
