import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Zap,
  X,
  Pause,
  Play,
  CheckCircle2,
  UserMinus,
  Percent,
  Trash2,
  RotateCcw,
} from 'lucide-react'
import {
  adminFetchMemberEnrollments,
  adminUpdateEnrollmentStatus,
  adminSetSignupDiscount,
  adminDeleteEnrollment,
  adminFetchDiscountRules,
  type AdminEnrollmentRow,
  type DiscountRule,
} from '../../../utils/schedulingApi'

function money(cents: number | null | undefined) {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

type StatusKey = 'active' | 'waitlisted' | 'paused' | 'completed' | 'cancelled'

function normalizeStatus(raw: string): StatusKey {
  switch (raw) {
    case 'confirmed':
    case 'active':
      return 'active'
    case 'waitlisted':
      return 'waitlisted'
    case 'paused':
      return 'paused'
    case 'completed':
      return 'completed'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'active'
  }
}

const STATUS_META: Record<StatusKey, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800' },
  waitlisted: { label: 'Waitlisted', className: 'bg-amber-100 text-amber-800' },
  paused: { label: 'Paused', className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completed', className: 'bg-gray-200 text-gray-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

function formatPauseDate(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ row }: { row: Pick<AdminEnrollmentRow, 'status' | 'pause_effective_date'> }) {
  if (row.pause_effective_date && normalizeStatus(row.status) !== 'paused') {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_META.active.className}`}>
          {STATUS_META.active.label}
        </span>
        <span className="text-[10px] font-medium text-blue-700">
          Pause {formatPauseDate(row.pause_effective_date)}
        </span>
      </span>
    )
  }
  const meta = STATUS_META[normalizeStatus(row.status)]
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export default function MemberEnrollmentsTab({ memberId }: { memberId: number; enrollments?: unknown[] }) {
  const [rows, setRows] = useState<AdminEnrollmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeRow, setActiveRow] = useState<AdminEnrollmentRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetchMemberEnrollments(memberId)
      setRows(data.rows ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments')
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    void load()
  }, [load])

  const monthlyTotal = useMemo(
    () =>
      rows
        .filter((r) => normalizeStatus(r.status) === 'active' || normalizeStatus(r.status) === 'waitlisted')
        .reduce((sum, r) => sum + (r.adjusted_cost_cents ?? 0), 0),
    [rows],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Enrollments</h4>
          <p className="text-xs text-gray-500">
            Everything this account is enrolled in. Per-class cost reconciles to the monthly total.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading enrollments…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">No enrollments on record.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Sport</th>
                <th className="px-3 py-2 font-semibold">Program</th>
                <th className="px-3 py-2 font-semibold">Class</th>
                <th className="px-3 py-2 font-semibold">Offering</th>
                <th className="px-3 py-2 font-semibold">Schedule</th>
                <th className="px-3 py-2 font-semibold text-right">Class Cost</th>
                <th className="px-3 py-2 font-semibold text-right">Adjusted Cost</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const discounted =
                  row.adjusted_cost_cents != null &&
                  row.class_cost_cents != null &&
                  row.adjusted_cost_cents < row.class_cost_cents
                return (
                  <tr key={`${row.source}-${row.id}`} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 text-gray-700">{row.sport_name || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{row.program_name || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{row.class_name || '—'}</div>
                      {row.source === 'member_program' && (
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">Legacy</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {row.offering_label || row.offering_dates || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{row.schedule || '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{money(row.class_cost_cents)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={discounted ? 'text-green-700 font-medium' : 'text-gray-700'}>
                        {money(row.adjusted_cost_cents)}
                      </span>
                      {row.manual_discount_reason && (
                        <div className="text-[10px] text-gray-400">{row.manual_discount_reason}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge row={row} />
                    </td>
                    <td className="px-3 py-2 text-center">
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
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={6} className="px-3 py-2 text-right font-semibold text-gray-900">
                  Estimated monthly total
                </td>
                <td className="px-3 py-2 text-right font-semibold text-gray-900">{money(monthlyTotal)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {activeRow && (
        <EnrollmentActionModal
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

function EnrollmentActionModal({
  row,
  onClose,
  onChanged,
}: {
  row: AdminEnrollmentRow
  onClose: () => void
  onChanged: () => void
}) {
  const isLegacy = row.source === 'member_program'
  const status = normalizeStatus(row.status)
  const hasScheduledPause = Boolean(row.pause_effective_date) && status !== 'paused'
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [showPauseOptions, setShowPauseOptions] = useState(false)
  const [pauseMode, setPauseMode] = useState<'next_month' | 'prorated'>('next_month')

  const [discountMode, setDiscountMode] = useState<'percent' | 'amount' | 'rule'>('percent')
  const [percent, setPercent] = useState('')
  const [amount, setAmount] = useState('')
  const [ruleId, setRuleId] = useState<number | ''>('')
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

  const applyDiscount = () =>
    run('discount', async () => {
      if (discountMode === 'rule') {
        if (ruleId === '') throw new Error('Select a discount rule')
        await adminSetSignupDiscount(row.id, { mode: 'rule', ruleId: Number(ruleId), reason: reason || undefined })
      } else if (discountMode === 'amount') {
        const dollars = Number(amount)
        if (!Number.isFinite(dollars) || dollars <= 0) throw new Error('Enter a valid dollar amount')
        await adminSetSignupDiscount(row.id, {
          mode: 'manual',
          amountCents: Math.round(dollars * 100),
          reason: reason || undefined,
        })
      } else {
        const pct = Number(percent)
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw new Error('Enter a percent between 1 and 100')
        await adminSetSignupDiscount(row.id, { mode: 'manual', percent: pct, reason: reason || undefined })
      }
    })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">{row.class_name || 'Enrollment'}</div>
            <div className="text-xs text-gray-500">
              {[row.program_name, row.schedule].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-5">
          {err && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
          )}

          {isLegacy ? (
            <p className="text-xs text-gray-500">
              This is a legacy enrollment. Only deletion is available.
            </p>
          ) : (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </div>
              <div className="flex flex-wrap gap-2">
                {status === 'paused' ? (
                  <ActionButton
                    icon={<Play className="w-4 h-4" />}
                    label="Activate"
                    busy={busy === 'activate'}
                    onClick={() => run('activate', () => adminUpdateEnrollmentStatus(row.id, 'confirmed'))}
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
                    disabled={status === 'cancelled' || status === 'completed'}
                    busy={busy === 'pause'}
                    onClick={() => {
                      setShowPauseOptions(true)
                      setPauseMode('next_month')
                    }}
                  />
                )}
                {(status === 'cancelled' || status === 'completed') && (
                  <ActionButton
                    icon={<Play className="w-4 h-4" />}
                    label="Reactivate"
                    busy={busy === 'reactivate'}
                    onClick={() => run('reactivate', () => adminUpdateEnrollmentStatus(row.id, 'confirmed'))}
                  />
                )}
                <ActionButton
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  label="Mark Completed"
                  disabled={status === 'completed'}
                  busy={busy === 'complete'}
                  onClick={() => run('complete', () => adminUpdateEnrollmentStatus(row.id, 'completed'))}
                />
                <ActionButton
                  icon={<UserMinus className="w-4 h-4" />}
                  label="Disenroll"
                  disabled={status === 'cancelled'}
                  busy={busy === 'disenroll'}
                  onClick={() => run('disenroll', () => adminUpdateEnrollmentStatus(row.id, 'cancelled'))}
                />
              </div>

              {showPauseOptions && status !== 'paused' && !hasScheduledPause && (
                <div className="mt-3 rounded-md border border-blue-100 bg-blue-50/50 px-3 py-3 space-y-3">
                  <div className="text-xs font-semibold text-gray-700">When should billing pause?</div>
                  <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name={`pause-mode-${row.id}`}
                      checked={pauseMode === 'next_month'}
                      onChange={() => setPauseMode('next_month')}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium">Start of next month</span>
                      <span className="block text-xs text-gray-500">
                        Stays active through this month; no mid-month credit.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name={`pause-mode-${row.id}`}
                      checked={pauseMode === 'prorated'}
                      onChange={() => setPauseMode('prorated')}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium">Pause now (prorated)</span>
                      <span className="block text-xs text-gray-500">
                        Pauses immediately; unused sessions this month become a credit on next bill.
                      </span>
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === 'pause'}
                      onClick={() =>
                        run('pause', () =>
                          adminUpdateEnrollmentStatus(row.id, 'paused', { pauseMode }),
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
          )}

          {!isLegacy && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <Percent className="w-3.5 h-3.5" /> Discount
              </div>
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
                  disabled={busy === 'discount'}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {busy === 'discount' && <Loader2 className="w-4 h-4 animate-spin" />} Apply discount
                </button>
                {(row.manual_discount_cents != null || row.manual_discount_pct != null) && (
                  <button
                    type="button"
                    onClick={() => run('clear', () => adminSetSignupDiscount(row.id, { mode: 'clear' }))}
                    disabled={busy === 'clear'}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-500">
              Danger zone
            </div>
            {confirmingDelete ? (
              <div className="rounded-md bg-red-50 px-3 py-3">
                <p className="text-sm text-red-700 mb-2">
                  Permanently delete this enrollment record? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      run('delete', () => adminDeleteEnrollment(row.id, row.source))
                    }
                    disabled={busy === 'delete'}
                    className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {busy === 'delete' && <Loader2 className="w-4 h-4 animate-spin" />} Confirm delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" /> Delete enrollment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  busy,
  disabled,
}: {
  icon: React.ReactNode
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
