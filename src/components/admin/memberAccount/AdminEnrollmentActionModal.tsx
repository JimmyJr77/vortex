import { Suspense, useEffect, useState, type ReactNode } from 'react'
import {
  Loader2,
  X,
  Pause,
  Play,
  ArrowRightLeft,
  UserPlus,
  ListOrdered,
  UserMinus,
  Percent,
} from 'lucide-react'
import {
  adminUpdateEnrollmentStatus,
  adminSetSignupDiscount,
  adminFetchDiscountRules,
  type AdminEnrollmentRow,
  type DiscountRule,
} from '../../../utils/schedulingApi'
import { lazyWithRetry } from '../../../utils/chunkLoadRecovery'
import { getTodayDateString } from '../../../utils/dateUtils'

const EnrollmentPicker = lazyWithRetry(() => import('../../customerBilling/NewBillingEnrollmentModal'))

import { normalizeAdminEnrollmentStatus } from './adminEnrollmentStatus'

const STATUS_META = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800' },
  requested: { label: 'Requested', className: 'bg-violet-100 text-violet-800' },
  waitlisted: { label: 'Waitlisted', className: 'bg-amber-100 text-amber-800' },
  paused: { label: 'Paused', className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completed', className: 'bg-gray-200 text-gray-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

function formatPauseDate(iso: string) {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCancellationDate(iso: string) {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function AdminEnrollmentStatusBadge({
  row,
}: {
  row: Pick<AdminEnrollmentRow, 'status' | 'pause_effective_date' | 'cancel_effective_date'>
}) {
  if (row.cancel_effective_date) {
    return (
      <span className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800">
        Cancellation effective on {formatCancellationDate(row.cancel_effective_date)}
      </span>
    )
  }
  if (row.pause_effective_date && normalizeAdminEnrollmentStatus(row.status) !== 'paused') {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_META.active.className}`}
        >
          {STATUS_META.active.label}
        </span>
        <span className="text-[10px] font-medium text-blue-700">
          Pause {formatPauseDate(row.pause_effective_date)}
        </span>
      </span>
    )
  }
  const meta = STATUS_META[normalizeAdminEnrollmentStatus(row.status)]
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  busy,
  disabled,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  busy?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  )
}

export default function AdminEnrollmentActionModal({
  row,
  member,
  onClose,
  onChanged,
}: {
  row: AdminEnrollmentRow
  member: { id: number; firstName: string; lastName: string }
  onClose: () => void
  onChanged: () => void
}) {
  const status = normalizeAdminEnrollmentStatus(row.status)
  const hasScheduledPause = Boolean(row.pause_effective_date) && status !== 'paused'
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [enrollmentAction, setEnrollmentAction] = useState<'reenroll' | 'switch' | null>(null)
  const [showPauseOptions, setShowPauseOptions] = useState(false)
  const [actionDate, setActionDate] = useState(getTodayDateString())
  const pendingAction = row.actions?.find(action => action.status === 'pending')

  const [discountMode, setDiscountMode] = useState<'percent' | 'amount' | 'rule'>('percent')
  const [percent, setPercent] = useState('')
  const [amount, setAmount] = useState('')
  const [ruleId, setRuleId] = useState<number | ''>('')
  const [duration, setDuration] = useState<'once' | 'monthly' | 'months'>(row.discount_assignment?.duration ?? 'monthly')
  const [durationMonths, setDurationMonths] = useState(String(row.discount_assignment?.durationMonths ?? 3))
  const thisMonth = getTodayDateString().slice(0, 7)
  const nextMonth = new Date(Date.UTC(Number(thisMonth.slice(0,4)), Number(thisMonth.slice(5,7)), 1)).toISOString().slice(0,7)
  const minimumDiscountMonth = status === 'paused' || status === 'waitlisted' ? nextMonth : thisMonth
  const [effectiveFromMonth, setEffectiveFromMonth] = useState(minimumDiscountMonth)
  const [requestKey] = useState(() => crypto.randomUUID())
  const [reason, setReason] = useState(row.manual_discount_reason ?? '')
  const [rules, setRules] = useState<DiscountRule[]>([])

  useEffect(() => {
    let cancelled = false
    void adminFetchDiscountRules()
      .then((res) => {
        if (!cancelled) setRules(res.rules.filter((r) => r.active))
      })
      .catch(() => {
        /* rules are optional */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    setErr(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed')
      setBusy(null)
    }
  }

  const changeStatus = (target: 'confirmed' | 'waitlisted' | 'cancelled' | 'paused') => adminUpdateEnrollmentStatus(row.id, target, { effectiveDate: actionDate, requestKey: `${requestKey}-${target}-${actionDate}`, pauseMode: 'prorated' })

  const applyDiscount = () =>
    run('discount', async () => {
      const months = Number(durationMonths)
      if (duration === 'months' && (!Number.isInteger(months) || months < 1 || months > 120)) throw new Error('Enter a duration from 1 to 120 months')
      const timing = { duration, durationMonths: duration === 'months' ? months : undefined, effectiveFromMonth, requestKey }
      if (discountMode === 'rule') {
        if (ruleId === '') throw new Error('Select a discount rule')
        await adminSetSignupDiscount(row.id, { ...timing, mode: 'rule', ruleId: Number(ruleId), reason: reason || undefined })
      } else if (discountMode === 'amount') {
        const dollars = Number(amount)
        if (!Number.isFinite(dollars) || dollars <= 0) throw new Error('Enter a valid dollar amount')
        await adminSetSignupDiscount(row.id, {
          ...timing, mode: 'manual',
          amountCents: Math.round(dollars * 100),
          reason: reason || undefined,
        })
      } else {
        const pct = Number(percent)
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw new Error('Enter a percent between 1 and 100')
        await adminSetSignupDiscount(row.id, { ...timing, mode: 'manual', percent: pct, reason: reason || undefined })
      }
    })

  if (enrollmentAction) return <Suspense fallback={<div role="status">Loading enrollment options…</div>}>
    <EnrollmentPicker
      members={[{ id: member.id, name: `${member.firstName} ${member.lastName}`.trim() }]}
      initialMemberId={member.id}
      initialEnrollmentDate={actionDate}
      onClose={() => setEnrollmentAction(null)}
      onCreated={onChanged}
      swapEnrollment={enrollmentAction === 'switch' ? { id: row.id, memberName: `${member.firstName} ${member.lastName}`.trim(), class_name: row.class_name, program_name: row.program_name } : null}
      reenrollEnrollment={enrollmentAction === 'reenroll' ? { id: row.id, formId: row.form_id } : null}
    />
  </Suspense>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!busy) onClose() }}>
      <div
        role="dialog" aria-modal="true" aria-label="Manage enrollment"
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">{row.class_name || 'Enrollment'}</div><p className="mt-1 text-sm text-gray-600">{member.firstName} {member.lastName}{row.waitlist_position ? ` · Waitlist #${row.waitlist_position}` : ''}</p>
            <div className="text-xs text-gray-500">
              {[row.program_name, row.schedule].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <button type="button" aria-label="Close enrollment actions" disabled={Boolean(busy)} onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-5">
          {err && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
          )}

          <div>
              <label className="mb-3 block text-sm font-medium text-gray-700">Action date
                <input type="date" required value={actionDate} disabled={Boolean(busy)} onChange={event => setActionDate(event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-2" />
              </label>
              <p className="mb-3 text-xs text-gray-500">Actions use this date. Future changes are scheduled; past dates are recorded with their billing adjustments.</p>
              {pendingAction && <div className="mb-3 rounded-md bg-blue-50 p-3 text-sm">Scheduled: {pendingAction.requested_status === 'confirmed' ? 'Activate' : pendingAction.requested_status} on {pendingAction.effective_date.slice(0, 10)}.
                {pendingAction.last_error && <p className="mt-1 text-red-700">{pendingAction.last_error}</p>}
                <button className="mt-2 block underline" disabled={Boolean(busy)} onClick={() => run('cancel-action', () => adminUpdateEnrollmentStatus(row.id, 'confirmed', { cancelScheduledAction: true }))}>Cancel scheduled action</button>
              </div>}
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </div>
              <fieldset disabled={Boolean(busy) || Boolean(pendingAction) || !actionDate} className="flex flex-wrap gap-2">
                {status === 'paused' || status === 'waitlisted' ? (
                  <ActionButton
                    icon={<Play className="w-4 h-4" />}
                    label={status === 'waitlisted' ? 'Activate' : 'Reactivate'}
                    busy={busy === 'activate'}
                    onClick={() => run('activate', () => changeStatus('confirmed'))}
                  />
                ) : hasScheduledPause ? (
                  <ActionButton
                    icon={<X className="w-4 h-4" />}
                    label="Cancel scheduled pause"
                    busy={busy === 'cancel-pause'}
                    onClick={() =>
                      run('cancel-pause', () =>
                        adminUpdateEnrollmentStatus(row.id, 'confirmed', { cancelScheduledPause: true }),
                      )
                    }
                  />
                ) : (
                  <ActionButton
                    icon={<Pause className="w-4 h-4" />}
                    label="Pause"
                    disabled={status !== 'active'}
                    busy={busy === 'pause'}
                    onClick={() => {
                      setShowPauseOptions(true)
                    }}
                  />
                )}
                {(status === 'active' || status === 'paused') && <ActionButton icon={<ListOrdered className="w-4 h-4" />} label="Waitlist" onClick={() => run('waitlist', () => changeStatus('waitlisted'))} />}
                {(status === 'cancelled' || status === 'completed') && (
                  <ActionButton
                    icon={<UserPlus className="w-4 h-4" />}
                    label="Reenroll"
                    onClick={() => setEnrollmentAction('reenroll')}
                  />
                )}
                {(status === 'active' || status === 'paused') && <ActionButton
                  icon={<ArrowRightLeft className="w-4 h-4" />}
                  label="Switch class"
                  disabled={status === 'paused'}
                  onClick={() => setEnrollmentAction('switch')}
                />}
                <ActionButton
                  icon={<UserMinus className="w-4 h-4" />}
                  label="Disenroll"
                  disabled={status === 'cancelled'}
                  busy={busy === 'disenroll'}
                  onClick={() => run('disenroll', () => changeStatus('cancelled'))}
                />
              </fieldset>

              {showPauseOptions && status !== 'paused' && !hasScheduledPause && (
                <div className="mt-3 rounded-md border border-blue-100 bg-blue-50/50 px-3 py-3 space-y-3">
                  <p className="text-sm text-gray-700">Pause effective {actionDate}. Unused billed weeks are credited to the account for the following month.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        run('pause', () =>
                          changeStatus('paused'),
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {busy === 'pause' && <Loader2 className="w-4 h-4 animate-spin" />}
                      Confirm pause
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPauseOptions(false)}
                      className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {hasScheduledPause && row.pause_effective_date && (
                <p className="mt-2 text-xs text-blue-700">
                  Billing pauses on {formatPauseDate(row.pause_effective_date)}. Enrollment stays active until then.
                </p>
              )}
          </div>

          {row.actions && row.actions.length > 0 && <section><h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Action history</h3><ol className="space-y-2 text-xs text-gray-600">{row.actions.map(action => <li key={action.id}>{action.requested_status === 'confirmed' ? 'Activated' : action.requested_status} · Effective {action.effective_date.slice(0, 10)} · {action.status}<span className="block text-gray-400">Recorded {new Date(action.requested_at).toLocaleString()}</span></li>)}</ol></section>}
          <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <Percent className="w-3.5 h-3.5" /> Discount
              </div>
              {row.discount_assignment && <p className="mb-2 text-xs text-gray-600">
                {row.discount_assignment.amountValue === 0 ? 'Discount cleared' : row.discount_assignment.name}: {row.discount_assignment.fromMonth}{row.discount_assignment.throughMonth ? ` through ${row.discount_assignment.throughMonth}` : ' onward'}.
              </p>}
              <div className="flex gap-2 mb-2 text-xs">
                {(['percent', 'amount', 'rule'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDiscountMode(m)}
                    className={`rounded-md px-2.5 py-1 border ${
                      discountMode === m
                        ? 'border-amber-400 bg-amber-50 text-amber-800'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {m === 'percent' ? '% off' : m === 'amount' ? '$ off' : 'Rule'}
                  </button>
                ))}
              </div>

              {discountMode === 'percent' && (
                <input
                  type="number"
                  aria-label="Discount percentage"
                  min={1}
                  max={100}
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  placeholder="e.g. 15"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              )}
              {discountMode === 'amount' && (
                <input
                  type="number"
                  aria-label="Discount amount"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 25.00"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              )}
              {discountMode === 'rule' && (
                <select
                  aria-label="Discount rule"
                  value={ruleId}
                  onChange={(e) => setRuleId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Select a discount rule…</option>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">Length of time
                  <select aria-label="Discount duration" value={duration} onChange={(event) => setDuration(event.target.value as typeof duration)} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm">
                    <option value="once">1 time</option><option value="monthly">Monthly</option><option value="months">Duration of months</option>
                  </select>
                </label>
                <label className="text-xs text-gray-600">Starts billing month
                  <input aria-label="Discount start month" type="month" min={minimumDiscountMonth} value={effectiveFromMonth} onChange={(event) => setEffectiveFromMonth(event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm" />
                </label>
                {duration === 'months' && <label className="text-xs text-gray-600">Number of months
                  <input aria-label="Number of discount months" type="number" min={1} max={120} value={durationMonths} onChange={(event) => setDurationMonths(event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm" />
                </label>}
              </div>
              <p className="mt-2 text-xs text-gray-500">{duration === 'once' ? 'Applies to the selected billing month only.' : duration === 'monthly' ? 'Repeats each month until cleared or replaced.' : 'Ends automatically after the selected number of billing months.'} Discounts apply before the family multi-class discount.</p>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason / note (optional)"
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={applyDiscount}
                  disabled={Boolean(busy)}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {busy === 'discount' && <Loader2 className="w-4 h-4 animate-spin" />} Apply discount
                </button>
                {(row.manual_discount_cents != null || row.manual_discount_pct != null) && (
                  <button
                    type="button"
                    onClick={() => run('clear', () => adminSetSignupDiscount(row.id, { mode: 'clear', effectiveFromMonth, requestKey: `${requestKey}-clear` }))}
                    disabled={Boolean(busy)}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Clear
                  </button>
                )}
              </div>
          </div>


        </div>
      </div>
    </div>
  )
}
