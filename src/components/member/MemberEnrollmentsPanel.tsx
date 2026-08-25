import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, CheckCircle2, Loader2, UserMinus, X, Zap } from 'lucide-react'
import { enrollmentClassHeading, enrichEnrollmentsFromClassesOffered, memberEnrollmentCancelHeading } from '../../utils/enrollmentDisplayLine'
import { memberCancelEnrollment, type MemberEnrollmentCancelResult } from '../../utils/schedulingApi'
import type { PublicProgramOffered } from '../../utils/publicClassesApi'

export interface MemberEnrollmentRow {
  id: number
  member_id: number
  member_first_name: string
  member_last_name: string
  class_name: string
  sport_name?: string | null
  program_name?: string | null
  class_context_line?: string | null
  program_id?: number | null
  form_id?: number | null
  slot_group_id?: number | null
  time_slot_id?: number | null
  offering_id?: number | null
  offering_label?: string | null
  offering_start_date?: string | null
  offering_end_date?: string | null
  offering_dates?: string | null
  enrollment_start_date?: string | null
  slot_label: string
  status: string
  cancel_effective_date?: string | null
  cancel_requested_at?: string | null
  created_at?: string | null
  source?: 'scheduling' | 'drop_in' | 'legacy'
  enrollment_type?: 'monthly' | 'temporary_block' | 'one_time' | 'drop_in'
  enrollmentType?: 'monthly' | 'temporary_block' | 'one_time' | 'drop_in'
  attendance_date?: string | null
  attendanceDate?: string | null
  billing_type?: 'recurring' | 'one_time'
  billingType?: 'recurring' | 'one_time'
}

interface Props {
  enrollments: MemberEnrollmentRow[]
  loading: boolean
  currentMemberId?: number | null
  memberToken?: string | null
  classesOffered?: PublicProgramOffered[]
  multiClassPasses?: Array<{
    id: number
    programsId: number
    packageLabel: string | null
    classesRemaining: number
    classCountPurchased: number
  }>
  onEnrollmentsChanged?: (result?: MemberEnrollmentCancelResult) => void | Promise<void>
  /** Admin read-only: hide manage actions */
  readOnly?: boolean
  defaultView?: ViewMode
  /** Hide class/member view toggle (e.g. embedded admin by-member list) */
  hideViewToggle?: boolean
  /** Nested inside admin sections — hide page header chrome */
  embedded?: boolean
}

type ViewMode = 'class' | 'member'

const CANCELLATION_REQUEST_TOAST =
  'Your cancellation request has been submitted and needs administrator review for final resolution. Cancellation is not automatic; the request will be approved or declined based on the cancellation policy.'

type EnrollmentColumn = {
  key: string
  header: string
  width: number
  minWidth: number
  cell: (row: MemberEnrollmentRow) => ReactNode
}

const BY_CLASS_COLUMNS: EnrollmentColumn[] = [
  {
    key: 'member',
    header: 'Member',
    width: 230,
    minWidth: 150,
    cell: (row) => memberDisplayName(row),
  },
  {
    key: 'offerings',
    header: 'Active dates',
    width: 280,
    minWidth: 170,
    cell: (row) => offeringsCell(row),
  },
  {
    key: 'start',
    header: 'Starts',
    width: 150,
    minWidth: 120,
    cell: (row) => enrollmentStartCell(row),
  },
  {
    key: 'slot',
    header: 'Time',
    width: 270,
    minWidth: 170,
    cell: (row) => timeCell(row),
  },
  {
    key: 'status',
    header: 'Status',
    width: 180,
    minWidth: 130,
    cell: (row) => statusBadge(row),
  },
]

const BY_MEMBER_COLUMNS: EnrollmentColumn[] = [
  {
    key: 'sport',
    header: 'Sport',
    width: 120,
    minWidth: 90,
    cell: (row) => textOrDash(row.sport_name),
  },
  {
    key: 'program',
    header: 'Program',
    width: 190,
    minWidth: 120,
    cell: (row) => textOrDash(row.program_name),
  },
  {
    key: 'class',
    header: 'Class',
    width: 230,
    minWidth: 140,
    cell: (row) => textOrDash(row.class_name),
  },
  {
    key: 'offerings',
    header: 'Active dates',
    width: 220,
    minWidth: 150,
    cell: (row) => offeringsCell(row),
  },
  {
    key: 'start',
    header: 'Starts',
    width: 150,
    minWidth: 120,
    cell: (row) => enrollmentStartCell(row),
  },
  {
    key: 'slot',
    header: 'Time',
    width: 210,
    minWidth: 150,
    cell: (row) => timeCell(row),
  },
  {
    key: 'status',
    header: 'Status',
    width: 180,
    minWidth: 130,
    cell: (row) => statusBadge(row),
  },
]

function memberDisplayName(row: MemberEnrollmentRow, currentMemberId?: number | null) {
  const name = `${row.member_first_name} ${row.member_last_name}`.trim() || 'Member'
  if (currentMemberId != null && row.member_id === currentMemberId) {
    return `${name} (You)`
  }
  return name
}

function formatCancelEffectiveDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function offeringsCell(row: MemberEnrollmentRow) {
  return <span>{row.offering_dates?.trim() || '—'}</span>
}

function enrollmentStartCell(row: MemberEnrollmentRow) {
  return <span>{row.enrollment_start_date ? formatCancelEffectiveDate(row.enrollment_start_date) : '—'}</span>
}

function timeCell(row: MemberEnrollmentRow) {
  return (
    <span className="inline-flex flex-col gap-0.5">
      {row.slot_label.split('; ').map((line) => (
        <span key={line}>{line}</span>
      ))}
    </span>
  )
}

function textOrDash(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed || '—'
}

function canManageEnrollment(row: MemberEnrollmentRow) {
  return row.source !== 'legacy' && row.source !== 'drop_in'
}

function statusBadge(row: MemberEnrollmentRow) {
  if (row.cancel_effective_date) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-800">
        Cancellation effective on {formatCancelEffectiveDate(row.cancel_effective_date)}
      </span>
    )
  }

  const normalized = row.status.toLowerCase()
  if (normalized === 'paused') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 capitalize">
        Paused
      </span>
    )
  }
  if (normalized === 'confirmed' || normalized === 'enrolled') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 capitalize">
        {normalized === 'enrolled' ? 'Enrolled' : 'Confirmed'}
      </span>
    )
  }
  if (normalized === 'waitlisted') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 capitalize">
        Waitlisted
      </span>
    )
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 capitalize">
      {row.status}
    </span>
  )
}

function EnrollmentTable({
  rows,
  columns,
  onManage,
}: {
  rows: MemberEnrollmentRow[]
  columns: EnrollmentColumn[]
  onManage?: (row: MemberEnrollmentRow) => void
}) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((column) => [column.key, column.width])),
  )
  const stopResizeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setColumnWidths(Object.fromEntries(columns.map((column) => [column.key, column.width])))
  }, [columns])

  useEffect(() => () => stopResizeRef.current?.(), [])

  const setColumnWidth = useCallback((column: EnrollmentColumn, width: number) => {
    setColumnWidths((current) => ({
      ...current,
      [column.key]: Math.max(column.minWidth, Math.round(width)),
    }))
  }, [])

  const startResize = useCallback((event: ReactPointerEvent, column: EnrollmentColumn) => {
    event.preventDefault()
    event.stopPropagation()
    stopResizeRef.current?.()
    const startX = event.clientX
    const startWidth = columnWidths[column.key] ?? column.width
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (moveEvent: PointerEvent) => {
      setColumnWidth(column, startWidth + moveEvent.clientX - startX)
    }
    const stop = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      stopResizeRef.current = null
    }
    stopResizeRef.current = stop
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }, [columnWidths, setColumnWidth])

  const resizeWithKeyboard = useCallback((event: KeyboardEvent, column: EnrollmentColumn) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const delta = event.key === 'ArrowLeft' ? -16 : 16
    setColumnWidth(column, (columnWidths[column.key] ?? column.width) + delta)
  }, [columnWidths, setColumnWidth])

  if (rows.length === 0) return null

  const showActions = Boolean(onManage)
  const tableWidth = columns.reduce(
    (total, column) => total + (columnWidths[column.key] ?? column.width),
    showActions ? 72 : 0,
  )

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm table-fixed border-collapse [&_th]:align-top [&_td]:align-top" style={{ width: tableWidth }}>
        <colgroup>
          {columns.map((col) => (
            <col key={col.key} style={{ width: columnWidths[col.key] ?? col.width }} />
          ))}
          {showActions && <col style={{ width: '72px' }} />}
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-600">
            {columns.map((col) => (
              <th key={col.key} className="relative py-2 pl-3 pr-5 font-semibold whitespace-nowrap">
                <span>{col.header}</span>
                <span
                  role="separator"
                  aria-label={`Resize ${col.header} column`}
                  aria-orientation="vertical"
                  aria-valuemin={col.minWidth}
                  aria-valuenow={columnWidths[col.key] ?? col.width}
                  tabIndex={0}
                  onPointerDown={(event) => startResize(event, col)}
                  onKeyDown={(event) => resizeWithKeyboard(event, col)}
                  className="absolute inset-y-0 right-0 z-10 w-2 cursor-col-resize touch-none border-r border-transparent hover:border-vortex-red focus:border-vortex-red focus:outline-none"
                />
              </th>
            ))}
            {showActions && (
              <th className="py-2 pr-4 font-semibold text-center">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.source || 'row'}-${row.id}`} className="border-b border-gray-100">
              {columns.map((col) => (
                <td key={col.key} className="overflow-hidden py-3 pl-3 pr-4 text-gray-900">
                  <div className={col.key === 'offerings' || col.key === 'slot' ? 'whitespace-normal break-words' : 'truncate whitespace-nowrap'}>
                    {col.cell(row)}
                  </div>
                </td>
              ))}
              {showActions && (
                <td className="py-3 pr-4 text-center">
                  {canManageEnrollment(row) ? (
                    <button
                      type="button"
                      onClick={() => onManage?.(row)}
                      title="Manage enrollment"
                      className="inline-flex items-center justify-center rounded-md border border-gray-200 p-1.5 text-amber-600 hover:bg-amber-50 hover:border-amber-300"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MemberEnrollmentActionModal({
  row,
  memberToken,
  onClose,
  onChanged,
}: {
  row: MemberEnrollmentRow
  memberToken: string
  onClose: () => void
  onChanged: (result?: MemberEnrollmentCancelResult) => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const isWaitlisted = row.status.toLowerCase() === 'waitlisted'
  const pendingCancel = Boolean(row.cancel_effective_date)

  const runCancel = async () => {
    setBusy(true)
    setErr(null)
    try {
      const result = await memberCancelEnrollment(row.id, memberToken, reason)
      await onChanged(result)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to cancel enrollment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-snug">
              {memberEnrollmentCancelHeading(row)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {memberDisplayName(row)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {err && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
          )}

          {pendingCancel ? (
            <p className="text-sm text-gray-700">
              Cancellation is effective on{' '}
              <span className="font-semibold">{formatCancelEffectiveDate(row.cancel_effective_date!)}</span>.
              You may continue attending through the current billing period; billing stops on that date.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                {isWaitlisted
                  ? 'This waitlisted spot can be removed immediately. No billing applies while waitlisted.'
                  : 'Request cancellation through Billing. Your enrollment and billing stay active until the request is reviewed. Recurring memberships normally end after the current paid period; fixed-term programs require individual review.'}
              </p>

              {confirming ? (
                <div className="rounded-md bg-red-50 px-3 py-3 space-y-3">
                  {isWaitlisted ? (
                    <p className="text-sm text-red-800">Remove this waitlist spot?</p>
                  ) : (
                    <label htmlFor="cancellation-comments" className="block text-sm font-medium text-red-800">
                      Comments
                    </label>
                  )}
                  {!isWaitlisted && (
                    <textarea
                      id="cancellation-comments"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Reason for cancellation (optional)"
                      rows={3}
                      className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-800"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void runCancel()}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                      {isWaitlisted ? 'Remove from waitlist' : 'Request Cancellation'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      disabled={busy}
                      className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Go back
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <UserMinus className="w-4 h-4" />
                  {isWaitlisted ? 'Leave waitlist' : 'Request cancellation'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MemberEnrollmentsPanel({
  enrollments,
  loading,
  currentMemberId,
  memberToken,
  classesOffered = [],
  multiClassPasses = [],
  onEnrollmentsChanged,
  readOnly = false,
  defaultView = 'member',
  hideViewToggle = false,
  embedded = false,
}: Props) {
  const [view, setView] = useState<ViewMode>(defaultView)
  const [activeRow, setActiveRow] = useState<MemberEnrollmentRow | null>(null)
  const [showCancellationToast, setShowCancellationToast] = useState(false)

  useEffect(() => {
    if (!showCancellationToast) return
    const timer = window.setTimeout(() => setShowCancellationToast(false), 10_000)
    return () => window.clearTimeout(timer)
  }, [showCancellationToast])

  const displayEnrollments = useMemo(
    () => enrichEnrollmentsFromClassesOffered(enrollments, classesOffered),
    [enrollments, classesOffered],
  )

  const byClass = useMemo(() => {
    const groups = new Map<string, MemberEnrollmentRow[]>()
    for (const row of displayEnrollments) {
      const key = enrollmentClassHeading(row)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(row)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [displayEnrollments])

  const byMember = useMemo(() => {
    const groups = new Map<number, MemberEnrollmentRow[]>()
    for (const row of displayEnrollments) {
      if (!groups.has(row.member_id)) groups.set(row.member_id, [])
      groups.get(row.member_id)!.push(row)
    }
    return [...groups.entries()].sort(([aId], [bId]) => {
      if (currentMemberId != null) {
        if (aId === currentMemberId) return -1
        if (bId === currentMemberId) return 1
      }
      const aName = groups.get(aId)?.[0]
      const bName = groups.get(bId)?.[0]
      const aLabel = `${aName?.member_first_name || ''} ${aName?.member_last_name || ''}`.trim()
      const bLabel = `${bName?.member_first_name || ''} ${bName?.member_last_name || ''}`.trim()
      return aLabel.localeCompare(bLabel)
    })
  }, [displayEnrollments, currentMemberId])

  const handleManage = !readOnly && memberToken ? (row: MemberEnrollmentRow) => setActiveRow(row) : undefined

  return (
    <>
      {showCancellationToast && (
        <div
          className="fixed right-4 top-4 z-[70] flex w-[min(28rem,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 text-sm text-gray-700 shadow-xl"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div role="status" aria-live="polite">
            <p className="font-bold text-gray-900">Cancellation request submitted</p>
            <p className="mt-1 leading-relaxed">{CANCELLATION_REQUEST_TOAST}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCancellationToast(false)}
            aria-label="Dismiss cancellation request notification"
            className="ml-auto shrink-0 text-gray-400 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className={embedded ? 'overflow-hidden' : 'border border-gray-200 rounded-xl bg-white overflow-hidden'}>
      {!embedded && (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6 border-b border-gray-200 bg-gray-50/80">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-vortex-red" />
            Enrollments
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Current and past monthly, temporary, one-time, and drop-in class registrations for your family.
          </p>
        </div>
        {enrollments.length > 0 && !hideViewToggle && (
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setView('class')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                view === 'class' ? 'bg-vortex-red text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              By Class
            </button>
            <button
              type="button"
              onClick={() => setView('member')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                view === 'member' ? 'bg-vortex-red text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              By Family Member
            </button>
          </div>
        )}
      </div>
      )}

      <div className={embedded ? '' : 'p-4 md:p-6'}>
        {multiClassPasses.length > 0 && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Multi-class pass balances</h3>
            <ul className="space-y-2 text-sm">
              {multiClassPasses.map((pass) => (
                <li
                  key={pass.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white border border-emerald-100 px-3 py-2"
                >
                  <span className="font-medium text-gray-900">
                    {pass.packageLabel ?? 'Multi-class pass'}
                  </span>
                  <span className="text-emerald-800 font-semibold">
                    {pass.classesRemaining} of {pass.classCountPurchased} classes remaining
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-600">Loading enrollments…</div>
        ) : enrollments.length === 0 ? (
          <p className="text-gray-600 flex items-center gap-2 py-4">
            <Calendar className="w-4 h-4 shrink-0" />
            No enrollments yet. Sign up for a class from the schedule below.
          </p>
        ) : embedded ? (
          <EnrollmentTable
            rows={displayEnrollments}
            onManage={handleManage}
            columns={BY_MEMBER_COLUMNS}
          />
        ) : view === 'class' ? (
          <div className="space-y-6">
            {byClass.map(([heading, rows]) => (
              <section key={heading}>
                <h3 className="text-lg font-bold text-black mb-3">{heading}</h3>
                <EnrollmentTable
                  rows={rows}
                  onManage={handleManage}
                  columns={BY_CLASS_COLUMNS.map((column) => column.key === 'member'
                    ? { ...column, cell: (row) => memberDisplayName(row, currentMemberId) }
                    : column)}
                />
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {byMember.map(([memberId, rows]) => {
              const label = memberDisplayName(rows[0], currentMemberId)
              return (
                <section key={memberId}>
                  <h3 className="text-lg font-bold text-black mb-3">{label}</h3>
                  <EnrollmentTable
                    rows={rows}
                    onManage={handleManage}
                    columns={BY_MEMBER_COLUMNS}
                  />
                </section>
              )
            })}
          </div>
        )}
      </div>

      {activeRow && memberToken && (
        <MemberEnrollmentActionModal
          row={activeRow}
          memberToken={memberToken}
          onClose={() => setActiveRow(null)}
          onChanged={async (result) => {
            await onEnrollmentsChanged?.(result)
            if (result?.pendingReview) setShowCancellationToast(true)
            setActiveRow(null)
          }}
        />
      )}
      </div>
    </>
  )
}
