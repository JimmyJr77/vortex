import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgeDollarSign,
  CalendarDays,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react'
import { adminApiRequest } from '../../utils/api'

interface MemberRow {
  memberId: number
  memberName: string
  familyName: string | null
  classCount: number
  missingScheduleCount?: number
}

interface DashboardData {
  permissions: { canViewEnrollment: boolean; canViewBilling: boolean }
  generatedAt: string
  enrollment: null | {
    activeAthletes: number
    activeClasses: number
    gainedThisMonth: number
    lostThisMonth: number
    byClass: Array<{ className: string; athleteCount: number; enrollmentCount: number }>
    byAthlete: MemberRow[]
    withoutMembership: MemberRow[]
  }
  billing: null | {
    revenueByMonth: Array<{ key: string; label: string; amountCents: number }>
    scheduledMonthlyTuitionCents: number
    dropInsThisMonth: number
    dropInRevenueCents: number
    activeAnnualMemberships: number
    withoutCard: MemberRow[]
    withoutMonthlyBilling: MemberRow[]
  }
}

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'red',
}: {
  label: string
  value: string | number
  detail: string
  icon: typeof Users
  tone?: 'red' | 'amber' | 'green' | 'blue'
}) {
  const tones = {
    red: 'bg-red-50 text-vortex-red',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-gray-950">{value}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      </div>
      <p className="mt-3 text-xs text-gray-500">{detail}</p>
    </div>
  )
}

function ExceptionList({
  title,
  description,
  rows,
  empty,
  actionLabel,
  onAction,
  showMissingSchedules = false,
}: {
  title: string
  description: string
  rows: MemberRow[]
  empty: string
  actionLabel: string
  onAction?: () => void
  showMissingSchedules?: boolean
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="font-bold text-gray-950">{title}</h3>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rows.length ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{rows.length}</span>
      </div>
      <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
        {rows.slice(0, 12).map((row) => (
          <div key={row.memberId} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{row.memberName}</p>
              <p className="truncate text-xs text-gray-500">
                {row.familyName || 'No family name'} · {row.classCount} active {row.classCount === 1 ? 'class' : 'classes'}
                {showMissingSchedules && row.missingScheduleCount ? ` · ${row.missingScheduleCount} unscheduled` : ''}
              </p>
            </div>
            {onAction ? <button type="button" onClick={onAction} className="shrink-0 text-xs font-bold text-vortex-red hover:underline">{actionLabel}</button> : null}
          </div>
        ))}
        {rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-gray-500">{empty}</p> : null}
      </div>
    </section>
  )
}

function RevenueBars({ rows }: { rows: NonNullable<DashboardData['billing']>['revenueByMonth'] }) {
  const max = Math.max(1, ...rows.map((row) => row.amountCents))
  return (
    <div className="mt-5 grid h-44 grid-cols-6 items-end gap-3">
      {rows.map((row) => {
        const percentage = Math.max(row.amountCents > 0 ? 8 : 0, Math.round((row.amountCents / max) * 100))
        return (
          <div key={row.key} className="flex h-full min-w-0 flex-col justify-end gap-2 text-center">
            <p className="truncate text-[11px] font-bold text-gray-700">{row.amountCents ? money(row.amountCents) : '—'}</p>
            <div className="flex h-28 items-end rounded-t-lg bg-gray-100">
              <div className="w-full rounded-t-lg bg-vortex-red transition-all" style={{ height: `${percentage}%` }} />
            </div>
            <p className="text-xs font-semibold text-gray-500">{row.label}</p>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminDashboard({
  onOpenCustomerBilling,
  onOpenEnrollments,
}: {
  onOpenCustomerBilling?: () => void
  onOpenEnrollments?: () => void
}) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await adminApiRequest('/api/admin/dashboard')
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.success === false) throw new Error(body.message || 'Unable to load the Admin Dashboard.')
      setData(body.data)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the Admin Dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const attentionCount = useMemo(() => (
    (data?.enrollment?.withoutMembership.length ?? 0) +
    (data?.billing?.withoutCard.length ?? 0) +
    (data?.billing?.withoutMonthlyBilling.length ?? 0)
  ), [data])

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-vortex-red">Admin overview</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-gray-950">Dashboard</h2>
          <p className="mt-2 max-w-3xl text-sm text-gray-500">Enrollment, collected revenue, memberships, and billing exceptions that need attention.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading && !data ? <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500 shadow-sm"><Loader2 className="h-5 w-5 animate-spin" /> Loading account health…</div> : null}

      {data ? <>
        {!data.permissions.canViewEnrollment || !data.permissions.canViewBilling ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {!data.permissions.canViewEnrollment && !data.permissions.canViewBilling
              ? 'Your role can open the Dashboard, but does not currently have enrollment or billing read access.'
              : !data.permissions.canViewEnrollment
                ? 'Enrollment cards are hidden for your role.'
                : 'Billing cards and exception queues are hidden for your role.'}
          </div>
        ) : null}

        {data.enrollment ? <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active athletes" value={data.enrollment.activeAthletes} detail={`${data.enrollment.activeClasses} active class enrollments`} icon={Users} />
            <StatCard label="Enrollment movement" value={`+${data.enrollment.gainedThisMonth} / −${data.enrollment.lostThisMonth}`} detail="Started / ended this calendar month" icon={UserCheck} tone="blue" />
            <StatCard label="Annual memberships" value={data.billing?.activeAnnualMemberships ?? '—'} detail="Individual paid-through memberships" icon={CalendarDays} tone="green" />
            <StatCard label="Needs attention" value={attentionCount} detail="Membership, payment method, or billing schedule exceptions" icon={ShieldAlert} tone={attentionCount ? 'amber' : 'green'} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                <div><h3 className="font-bold text-gray-950">Enrollment by class</h3><p className="mt-1 text-xs text-gray-500">Current, billable class enrollments by class.</p></div>
                {onOpenEnrollments ? <button type="button" onClick={onOpenEnrollments} className="text-xs font-bold text-vortex-red hover:underline">Open enrollments</button> : null}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Class</th><th className="px-5 py-3 text-right">Athletes</th><th className="px-5 py-3 text-right">Enrollments</th></tr></thead>
                  <tbody>{data.enrollment.byClass.map((row) => <tr key={row.className} className="border-t border-gray-100"><td className="px-5 py-3 font-semibold text-gray-900">{row.className}</td><td className="px-5 py-3 text-right text-gray-700">{row.athleteCount}</td><td className="px-5 py-3 text-right text-gray-700">{row.enrollmentCount}</td></tr>)}{data.enrollment.byClass.length === 0 ? <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-500">No active class enrollments.</td></tr> : null}</tbody>
                </table>
              </div>
            </section>
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4"><h3 className="font-bold text-gray-950">Enrollment by athlete</h3><p className="mt-1 text-xs text-gray-500">Athletes with the most active classes.</p></div>
              <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto">{data.enrollment.byAthlete.map((row) => <div key={row.memberId} className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900">{row.memberName}</p><p className="truncate text-xs text-gray-500">{row.familyName || 'No family name'}</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{row.classCount} classes</span></div>)}{data.enrollment.byAthlete.length === 0 ? <p className="px-5 py-8 text-center text-sm text-gray-500">No active athletes.</p> : null}</div>
            </section>
          </div>
        </> : null}

        {data.billing ? <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Collected this month" value={money(data.billing.revenueByMonth.at(-1)?.amountCents ?? 0)} detail="Settled payments recorded this calendar month" icon={BadgeDollarSign} tone="green" />
            <StatCard label="Scheduled monthly tuition" value={money(data.billing.scheduledMonthlyTuitionCents)} detail="Active local class billing schedules" icon={CreditCard} tone="blue" />
            <StatCard label="Drop-ins this month" value={data.billing.dropInsThisMonth} detail={`${money(data.billing.dropInRevenueCents)} in drop-in payments`} icon={CalendarDays} tone="amber" />
          </div>
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-gray-950">Collected revenue</h3><p className="mt-1 text-xs text-gray-500">Settled billing payments for the last six calendar months.</p><RevenueBars rows={data.billing.revenueByMonth} /></section>
          <div className="grid gap-6 xl:grid-cols-3">
            <ExceptionList title="Active athletes without a membership" description="Enrolled athletes without an individual paid-through annual membership." rows={data.enrollment?.withoutMembership ?? []} empty="Every active athlete has an annual membership." actionLabel="Open billing" onAction={onOpenCustomerBilling} />
            <ExceptionList title="No card on file for auto-pay" description="Active class families without a remote Stripe class subscription. Review the payment method." rows={data.billing.withoutCard} empty="Every active class family has remote auto-pay." actionLabel="Open billing" onAction={onOpenCustomerBilling} />
            <ExceptionList title="Not set up for monthly billing" description="At least one active class is missing its local monthly billing schedule." rows={data.billing.withoutMonthlyBilling} empty="Every active class has a local billing schedule." actionLabel="Open billing" onAction={onOpenCustomerBilling} showMissingSchedules />
          </div>
        </> : null}
      </> : null}
    </div>
  )
}
