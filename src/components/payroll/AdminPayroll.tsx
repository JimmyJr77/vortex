import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Users,
  WalletCards,
} from 'lucide-react'
import { adminApiRequest } from '../../utils/api'
import { payrollApi, type ComplianceTask, type PayrollDashboard, type PayrollEmployee } from '../../utils/payrollApi'

type View = 'overview' | 'onboarding' | 'time' | 'schedule' | 'compensation' | 'runs' | 'compliance' | 'reports'

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'onboarding', label: 'People & onboarding' },
  { id: 'time', label: 'Daily time' },
  { id: 'schedule', label: 'Schedules' },
  { id: 'compensation', label: 'Pay setup & leave' },
  { id: 'runs', label: 'Payroll runs' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'reports', label: 'Reports & QuickBooks' },
]

const money = (cents: unknown) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents ?? 0) / 100)
const dateText = (value: unknown) => {
  if (!value) return '—'
  const text = String(value)
  const parsed = new Date(text.length === 10 ? `${text}T12:00:00` : text)
  return Number.isFinite(parsed.valueOf()) ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : text
}
const dateTimeText = (value: unknown) => {
  if (!value) return '—'
  const parsed = new Date(String(value))
  return Number.isFinite(parsed.valueOf()) ? parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : String(value)
}
const field = (row: Record<string, unknown>, key: string) => row[key]
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-vortex-red focus:ring-2 focus:ring-red-100'
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-vortex-red px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

function StatusPill({ value, severity }: { value: string; severity?: string }) {
  const tone = severity === 'CRITICAL' || ['MISSING', 'NEEDS_EVIDENCE', 'UNVERIFIED'].includes(value)
    ? 'bg-red-50 text-red-700 ring-red-200'
    : severity === 'WARNING' || ['OPEN', 'IN_PROGRESS', 'REQUESTED', 'REVIEW'].includes(value)
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ring-1 ${tone}`}>{value.replaceAll('_', ' ')}</span>
}

function Panel({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div><h3 className="font-black text-slate-900">{title}</h3>{description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}</div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{children}</div>
}

export default function AdminPayroll() {
  const [view, setView] = useState<View>('overview')
  const [data, setData] = useState<PayrollDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [aiQuestion, setAiQuestion] = useState('What should I handle first, and why?')
  const [aiAnswer, setAiAnswer] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null)
  const [selectedQuickbooksRunId, setSelectedQuickbooksRunId] = useState<number | null>(null)
  const [runPreview, setRunPreview] = useState<Record<string, unknown> | null>(null)
  const [employeeForm, setEmployeeForm] = useState({ employeeNumber: '', legalFirstName: '', legalMiddleName: '', legalLastName: '', preferredName: '', personalEmail: '', phone: '', jobTitle: '', hireDate: '', hourlyRate: '', workState: 'MD', residenceState: 'MD', primaryWorkLocation: '4961 Tesla Dr, Suite E, Bowie, MD 20715' })
  const [timeForm, setTimeForm] = useState({ clockIn: '', clockOut: '', unpaidBreakMinutes: '0', activityType: 'INSTRUCTION', source: 'ADMIN', evidenceNote: '' })
  const [shiftForm, setShiftForm] = useState({ scheduledStart: '', scheduledEnd: '', activityType: 'INSTRUCTION', location: '4961 Tesla Dr, Suite E, Bowie, MD 20715', notes: '' })
  const [adjustmentForm, setAdjustmentForm] = useState({ kind: 'BONUS', name: '', amount: '', activeFrom: '', activeTo: '', authorizationReference: '', taxTreatmentVerified: false, status: 'DRAFT' })
  const [leaveForm, setLeaveForm] = useState({ transactionDate: '', minutes: '', reason: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const next = await payrollApi.dashboard()
      setData(next)
      setSelectedEmployeeId((current) => current ?? next.employees[0]?.id ?? null)
      setSelectedPeriodId((current) => current ?? (Number(next.payPeriods[0]?.id ?? 0) || null))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load payroll')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const selectedEmployee = useMemo(() => data?.employees.find((employee) => employee.id === selectedEmployeeId) ?? null, [data?.employees, selectedEmployeeId])
  const criticalTasks = useMemo(() => data?.complianceTasks.filter((task) => task.severity === 'CRITICAL' && !['COMPLETE', 'NOT_APPLICABLE'].includes(task.status)) ?? [], [data?.complianceTasks])
  const openTimeByEmployee = useMemo(() => new Set((data?.timeEntries ?? []).filter((entry) => !field(entry, 'clock_out')).map((entry) => Number(field(entry, 'employee_id')))), [data?.timeEntries])

  const act = useCallback(async (work: () => Promise<unknown>, message: string) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await work()
      setNotice(message)
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Payroll action failed')
    } finally { setBusy(false) }
  }, [load])

  const submitEmployee = (event: FormEvent) => {
    event.preventDefault()
    const rate = Math.round(Number(employeeForm.hourlyRate) * 100)
    void act(() => payrollApi.createEmployee({ ...employeeForm, hourlyRateCents: rate, employmentStatus: 'ONBOARDING' }), 'Employee onboarding record created. Required forms remain tracked as incomplete.')
  }

  const submitTime = (event: FormEvent) => {
    event.preventDefault()
    if (!selectedEmployeeId) return
    void act(() => payrollApi.createTimeEntry({ employeeId: selectedEmployeeId, ...timeForm, clockIn: new Date(timeForm.clockIn).toISOString(), clockOut: new Date(timeForm.clockOut).toISOString(), unpaidBreakMinutes: Number(timeForm.unpaidBreakMinutes) }), 'Time entry added as unverified. Review its evidence before approval.')
  }

  const submitShift = (event: FormEvent) => {
    event.preventDefault()
    if (!selectedEmployeeId) return
    void act(() => payrollApi.createShift({ employeeId: selectedEmployeeId, ...shiftForm, scheduledStart: new Date(shiftForm.scheduledStart).toISOString(), scheduledEnd: new Date(shiftForm.scheduledEnd).toISOString() }), 'Shift scheduled.')
  }

  const submitAdjustment = (event: FormEvent) => {
    event.preventDefault()
    if (!selectedEmployeeId) return
    void act(() => payrollApi.createAdjustment(selectedEmployeeId, {
      ...adjustmentForm,
      amountCents: Math.round(Number(adjustmentForm.amount) * 100),
      activeTo: adjustmentForm.activeTo || null,
    }), 'Pay adjustment saved. It will affect payroll only while active and verified.')
  }

  const submitLeave = (event: FormEvent) => {
    event.preventDefault()
    if (!selectedEmployeeId) return
    void act(() => payrollApi.createLeaveTransaction(selectedEmployeeId, { ...leaveForm, minutes: Number(leaveForm.minutes), leaveType: 'MD_SICK_SAFE' }), 'Leave ledger entry recorded and audited.')
  }

  const askAi = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await payrollApi.askAi(aiQuestion)
      setAiAnswer(response.answer)
    } catch (aiError) { setError(aiError instanceof Error ? aiError.message : 'AI review failed') }
    finally { setBusy(false) }
  }

  const createInvitation = async (email: string, sendEmail: boolean) => {
    if (!selectedEmployee) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await payrollApi.createEmployeeInvitation(selectedEmployee.id, email, sendEmail)
      setInviteUrl(result.inviteUrl)
      setNotice(result.emailed ? 'One-time employee payroll invitation sent.' : result.emailWarning ? `Invitation created, but email was not sent: ${result.emailWarning}` : 'One-time employee payroll invitation created. Copy it securely.')
      await load()
    } catch (inviteError) { setError(inviteError instanceof Error ? inviteError.message : 'Unable to create invitation') }
    finally { setBusy(false) }
  }

  const preview = async () => {
    if (!selectedPeriodId) return
    setBusy(true)
    setError('')
    try {
      const response = await payrollApi.previewRun(selectedPeriodId)
      setRunPreview(response.preview)
    } catch (previewError) { setError(previewError instanceof Error ? previewError.message : 'Preview failed') }
    finally { setBusy(false) }
  }

  const downloadReport = async (path: string, fallbackName: string) => {
    setBusy(true)
    setError('')
    try {
      const response = await adminApiRequest(`/api/admin/payroll/reports/${path}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || 'Export failed')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fallbackName
      link.click()
      URL.revokeObjectURL(url)
    } catch (downloadError) { setError(downloadError instanceof Error ? downloadError.message : 'Export failed') }
    finally { setBusy(false) }
  }

  if (loading && !data) return <div className="flex min-h-[420px] items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading payroll workspace…</div>

  return (
    <div className="space-y-5 pb-12">
      <header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
        <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.3fr_0.7fr] lg:px-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-red-200"><WalletCards className="h-4 w-4" /> Payroll operations</div>
            <h1 className="text-3xl font-black tracking-tight">Run payroll with evidence, gates, and a clear timeline.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Employees, onboarding, schedules, time records, payroll previews, compliance sources, and accounting exports in one audit trail.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-300">Setup readiness</span><span className="text-2xl font-black">{data?.summary.setupScore ?? 0}%</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-vortex-red" style={{ width: `${data?.summary.setupScore ?? 0}%` }} /></div>
            <p className="mt-3 text-xs leading-5 text-slate-400">Record-only mode. No money movement or tax filing occurs here.</p>
          </div>
        </div>
      </header>

      <nav aria-label="Payroll sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {VIEWS.map((item) => <button key={item.id} type="button" onClick={() => setView(item.id)} className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-bold transition ${view === item.id ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{item.label}</button>)}
      </nav>

      {error ? <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>Action needed.</strong> {error}</div></div> : null}
      {notice ? <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />{notice}</div> : null}

      {view === 'overview' ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Active employees', value: data?.summary.activeEmployees ?? 0, icon: Users, tone: 'text-blue-700 bg-blue-50' },
              { label: 'Critical actions', value: data?.summary.openCriticalTasks ?? 0, icon: AlertTriangle, tone: 'text-red-700 bg-red-50' },
              { label: 'Open clocks', value: data?.summary.openClocks ?? 0, icon: Clock3, tone: 'text-amber-700 bg-amber-50' },
              { label: 'Backfilled gross', value: money(data?.summary.historicalGrossCents), icon: WalletCards, tone: 'text-emerald-700 bg-emerald-50' },
            ].map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-4 inline-flex rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div><div className="text-2xl font-black text-slate-900">{value}</div><div className="mt-1 text-sm font-medium text-slate-500">{label}</div></div>)}
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Panel title="Priority timeline" description="Critical items remain approval blockers until supported by evidence.">
              <div className="space-y-3">
                {criticalTasks.slice(0, 7).map((task) => <div key={task.id} className="flex gap-3 rounded-xl border border-slate-200 p-3"><div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-slate-900">{task.title}</p><span className="text-xs font-semibold text-slate-500">{dateText(task.dueDate)}</span></div><p className="mt-1 text-sm text-slate-600">{task.description}</p></div></div>)}
                {criticalTasks.length === 0 ? <Empty>No critical setup items are open.</Empty> : null}
              </div>
            </Panel>
            <Panel title="Payroll AI review" description="Grounded in this dashboard and its linked official sources.">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor="payroll-ai-question">Ask about priorities or a warning</label>
              <textarea id="payroll-ai-question" value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} rows={3} className={`${inputClass} mt-2`} />
              <button type="button" onClick={() => void askAi()} disabled={busy || !data?.aiEnabled} className={`${primaryButton} mt-3`}><Bot className="h-4 w-4" /> Review payroll</button>
              {!data?.aiEnabled ? <p className="mt-2 text-xs text-amber-700">AI is not configured; deterministic warnings and source links still work.</p> : null}
              {aiAnswer ? <div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{aiAnswer}</div> : null}
              <p className="mt-3 text-xs leading-5 text-slate-500">Advisory only. AI cannot change records, approve payroll, move money, file forms, or replace a payroll professional.</p>
            </Panel>
          </div>
          <Panel title="Automated payroll alerts" description="A daily sweep watches upcoming paydays, due tasks, and changes to official-source pages.">
            <div className="space-y-3">{data?.alerts.map((alert) => <div key={String(field(alert, 'id'))} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-4"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><StatusPill value={String(field(alert, 'severity'))} severity={String(field(alert, 'severity'))} /><p className="font-black text-slate-900">{String(field(alert, 'title'))}</p></div><p className="mt-2 text-sm text-slate-600">{String(field(alert, 'message'))}</p></div><button type="button" disabled={busy} onClick={() => void act(() => payrollApi.dismissAlert(Number(field(alert, 'id'))), 'Payroll alert dismissed.')} className={secondaryButton}>Dismiss</button></div>)}{data?.alerts.length === 0 ? <Empty>No automated alerts are open.</Empty> : null}</div>
          </Panel>
          <Panel title="Maria historical wage backfill" description={`${data?.summary.unreconciledPayments ?? 0} payment allocations need source evidence and specialist reconciliation.`}>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Work period</th><th className="pb-3">Paid</th><th className="pb-3">Method</th><th className="pb-3">Gross intent</th><th className="pb-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{data?.historicalPayments.map((row) => <tr key={String(field(row, 'id'))}><td className="py-3">{dateText(field(row, 'period_start'))} – {dateText(field(row, 'period_end'))}</td><td className="py-3">{dateText(field(row, 'payment_date'))}</td><td className="py-3 font-semibold">{String(field(row, 'method'))}{field(row, 'reference') ? ` · ${String(field(row, 'reference'))}` : ''}</td><td className="py-3 font-bold">{money(field(row, 'gross_amount_cents'))}</td><td className="py-3"><StatusPill value={String(field(row, 'reconciliation_status'))} /></td></tr>)}</tbody></table></div>
          </Panel>
        </div>
      ) : null}

      {view === 'onboarding' ? (
        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <Panel title="New employee setup" description="Creates an onboarding record; it does not make the person payroll-ready.">
            <form onSubmit={submitEmployee} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Employee number<input required value={employeeForm.employeeNumber} onChange={(event) => setEmployeeForm({ ...employeeForm, employeeNumber: event.target.value })} className={`${inputClass} mt-1`} placeholder="EMP-002" /></label>
              <label className="text-sm font-semibold text-slate-700">Hire date<input required type="date" value={employeeForm.hireDate} onChange={(event) => setEmployeeForm({ ...employeeForm, hireDate: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-sm font-semibold text-slate-700">Legal first name<input required value={employeeForm.legalFirstName} onChange={(event) => setEmployeeForm({ ...employeeForm, legalFirstName: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-sm font-semibold text-slate-700">Legal middle name<input value={employeeForm.legalMiddleName} onChange={(event) => setEmployeeForm({ ...employeeForm, legalMiddleName: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-sm font-semibold text-slate-700">Legal last name<input required value={employeeForm.legalLastName} onChange={(event) => setEmployeeForm({ ...employeeForm, legalLastName: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-sm font-semibold text-slate-700">Preferred name<input value={employeeForm.preferredName} onChange={(event) => setEmployeeForm({ ...employeeForm, preferredName: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-sm font-semibold text-slate-700">Personal email<input type="email" value={employeeForm.personalEmail} onChange={(event) => setEmployeeForm({ ...employeeForm, personalEmail: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-sm font-semibold text-slate-700">Phone<input type="tel" value={employeeForm.phone} onChange={(event) => setEmployeeForm({ ...employeeForm, phone: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-sm font-semibold text-slate-700">Job title<input required value={employeeForm.jobTitle} onChange={(event) => setEmployeeForm({ ...employeeForm, jobTitle: event.target.value })} className={`${inputClass} mt-1`} placeholder="Gymnastics instructor" /></label>
              <label className="text-sm font-semibold text-slate-700">Hourly rate<input required type="number" min="0" step="0.01" value={employeeForm.hourlyRate} onChange={(event) => setEmployeeForm({ ...employeeForm, hourlyRate: event.target.value })} className={`${inputClass} mt-1`} placeholder="25.00" /></label>
              <label className="text-sm font-semibold text-slate-700">Work state<input maxLength={2} value={employeeForm.workState} onChange={(event) => setEmployeeForm({ ...employeeForm, workState: event.target.value.toUpperCase() })} className={`${inputClass} mt-1`} /></label>
              <label className="text-sm font-semibold text-slate-700">Residence state<input maxLength={2} value={employeeForm.residenceState} onChange={(event) => setEmployeeForm({ ...employeeForm, residenceState: event.target.value.toUpperCase() })} className={`${inputClass} mt-1`} /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Primary work location<input value={employeeForm.primaryWorkLocation} onChange={(event) => setEmployeeForm({ ...employeeForm, primaryWorkLocation: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <button disabled={busy} className={`${primaryButton} sm:col-span-2`}><Plus className="h-4 w-4" /> Create onboarding record</button>
            </form>
            <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Starter packet</p><div className="mt-3 grid gap-2 text-sm"><a className="font-bold text-blue-700 hover:underline" href="https://www.irs.gov/pub/irs-pdf/fw4.pdf" target="_blank" rel="noreferrer">Federal Form W-4</a><a className="font-bold text-blue-700 hover:underline" href="https://www.uscis.gov/i-9" target="_blank" rel="noreferrer">USCIS Form I-9 and instructions</a><a className="font-bold text-blue-700 hover:underline" href="https://www.marylandcomptroller.gov/forms/current_forms/MW507.pdf" target="_blank" rel="noreferrer">Maryland Form MW507</a><a className="font-bold text-blue-700 hover:underline" href="https://labor.maryland.gov/paidleave/" target="_blank" rel="noreferrer">Maryland sick and safe leave materials</a></div><p className="mt-3 text-xs leading-5 text-slate-500">Add Vortex’s wage notice, handbook acknowledgement, emergency contact, direct-deposit authorization, and role-specific safety training before activating the employee.</p></div>
          </Panel>
          <div className="space-y-5">
            <Panel title="Employees" description="Identity documents and bank details belong in an approved secure provider—not notes.">
              <div className="space-y-3">{data?.employees.map((employee) => <button type="button" key={employee.id} onClick={() => setSelectedEmployeeId(employee.id)} className={`w-full rounded-xl border p-4 text-left transition ${selectedEmployeeId === employee.id ? 'border-red-300 bg-red-50/60' : 'border-slate-200 hover:bg-slate-50'}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black text-slate-900">{employee.legalFirstName} {employee.legalMiddleName} {employee.legalLastName}</p><p className="mt-1 text-sm text-slate-500">{employee.employeeNumber} · {employee.jobTitle} · {money(employee.hourlyRateCents)}/hr</p></div><StatusPill value={employee.employmentStatus} /></div></button>)}</div>
            </Panel>
            {selectedEmployee ? <EmployeeOnboarding key={selectedEmployee.id} employee={selectedEmployee} invitation={(data?.invitations ?? []).find((item) => Number(item.employee_id) === selectedEmployee.id) ?? null} inviteUrl={inviteUrl} busy={busy} onInvite={createInvitation} onUpdate={(patch) => act(() => payrollApi.updateEmployee(selectedEmployee.id, patch), 'Employee onboarding status updated.')} /> : null}
          </div>
        </div>
      ) : null}

      {view === 'time' ? (
        <div className="space-y-5">
          <Panel title="Clock station" description="Admin-assisted clock actions. Employee self-service can be added as a dedicated signed-in portal.">
            <div className="flex flex-wrap items-end gap-3"><label className="min-w-64 flex-1 text-sm font-semibold text-slate-700">Employee<select value={selectedEmployeeId ?? ''} onChange={(event) => setSelectedEmployeeId(Number(event.target.value))} className={`${inputClass} mt-1`}>{data?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.preferredName || employee.legalFirstName} {employee.legalLastName}</option>)}</select></label><button type="button" disabled={busy || !selectedEmployeeId} onClick={() => selectedEmployeeId && void act(() => payrollApi.clock(selectedEmployeeId, openTimeByEmployee.has(selectedEmployeeId) ? 'OUT' : 'IN'), openTimeByEmployee.has(selectedEmployeeId) ? 'Clock-out recorded.' : 'Clock-in recorded.')} className={openTimeByEmployee.has(selectedEmployeeId ?? 0) ? secondaryButton : primaryButton}><Clock3 className="h-4 w-4" />{openTimeByEmployee.has(selectedEmployeeId ?? 0) ? 'Clock out' : 'Clock in'}</button></div>
          </Panel>
          <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
            <Panel title="Add supported time" description="Every reconstructed entry requires an evidence note.">
              <form onSubmit={submitTime} className="space-y-3"><label className="text-sm font-semibold text-slate-700">Clock in<input required type="datetime-local" value={timeForm.clockIn} onChange={(event) => setTimeForm({ ...timeForm, clockIn: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold text-slate-700">Clock out<input required type="datetime-local" value={timeForm.clockOut} onChange={(event) => setTimeForm({ ...timeForm, clockOut: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold text-slate-700">Unpaid break minutes<input required type="number" min="0" value={timeForm.unpaidBreakMinutes} onChange={(event) => setTimeForm({ ...timeForm, unpaidBreakMinutes: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold text-slate-700">Activity<select value={timeForm.activityType} onChange={(event) => setTimeForm({ ...timeForm, activityType: event.target.value })} className={`${inputClass} mt-1`}><option>INSTRUCTION</option><option>PLANNING</option><option>SETUP</option><option>MEETING</option><option>ADMIN</option><option>OTHER</option></select></label><label className="text-sm font-semibold text-slate-700">Evidence/source note<textarea required rows={3} value={timeForm.evidenceNote} onChange={(event) => setTimeForm({ ...timeForm, evidenceNote: event.target.value })} className={`${inputClass} mt-1`} placeholder="Calendar, message, access record, or employee attestation…" /></label><button disabled={busy || !selectedEmployeeId} className={primaryButton}>Add unverified entry</button></form>
            </Panel>
            <Panel title="Daily time log" description="Approval is a separate audited action.">
              <div className="space-y-3">{data?.timeEntries.map((entry) => <div key={String(field(entry, 'id'))} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-slate-900">{String(field(entry, 'legal_first_name'))} {String(field(entry, 'legal_last_name'))}</p><p className="mt-1 text-sm text-slate-600">{dateTimeText(field(entry, 'clock_in'))} → {dateTimeText(field(entry, 'clock_out'))}</p><p className="mt-1 text-xs text-slate-500">{field(entry, 'worked_minutes') == null ? 'Open clock' : `${field(entry, 'worked_minutes')} worked minutes`} · {String(field(entry, 'activity_type')).toLowerCase()}</p></div><div className="flex items-center gap-2"><StatusPill value={String(field(entry, 'status'))} />{field(entry, 'clock_out') && field(entry, 'status') !== 'APPROVED' ? <button type="button" disabled={busy} onClick={() => void act(() => payrollApi.setTimeStatus(Number(field(entry, 'id')), 'APPROVED'), 'Time entry approved and audit logged.')} className={secondaryButton}>Approve</button> : null}</div></div></div>)}{data?.timeEntries.length === 0 ? <Empty>No time entries yet.</Empty> : null}</div>
            </Panel>
          </div>
        </div>
      ) : null}

      {view === 'schedule' ? (
        <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
          <Panel title="Schedule a shift" description="Instruction is the primary activity; planning and setup can be scheduled separately."><form onSubmit={submitShift} className="space-y-3"><label className="text-sm font-semibold text-slate-700">Employee<select value={selectedEmployeeId ?? ''} onChange={(event) => setSelectedEmployeeId(Number(event.target.value))} className={`${inputClass} mt-1`}>{data?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.preferredName || employee.legalFirstName} {employee.legalLastName}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Starts<input required type="datetime-local" value={shiftForm.scheduledStart} onChange={(event) => setShiftForm({ ...shiftForm, scheduledStart: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold text-slate-700">Ends<input required type="datetime-local" value={shiftForm.scheduledEnd} onChange={(event) => setShiftForm({ ...shiftForm, scheduledEnd: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold text-slate-700">Activity<select value={shiftForm.activityType} onChange={(event) => setShiftForm({ ...shiftForm, activityType: event.target.value })} className={`${inputClass} mt-1`}><option>INSTRUCTION</option><option>PLANNING</option><option>SETUP</option><option>MEETING</option><option>ADMIN</option><option>OTHER</option></select></label><label className="text-sm font-semibold text-slate-700">Location<input value={shiftForm.location} onChange={(event) => setShiftForm({ ...shiftForm, location: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold text-slate-700">Notes<textarea rows={2} value={shiftForm.notes} onChange={(event) => setShiftForm({ ...shiftForm, notes: event.target.value })} className={`${inputClass} mt-1`} /></label><button disabled={busy || !selectedEmployeeId} className={primaryButton}><CalendarClock className="h-4 w-4" /> Schedule shift</button></form></Panel>
          <Panel title="Upcoming schedule"><div className="space-y-3">{data?.shifts.map((shift) => <div key={String(field(shift, 'id'))} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-bold text-slate-900">{String(field(shift, 'legal_first_name'))} {String(field(shift, 'legal_last_name'))}</p><p className="mt-1 text-sm text-slate-600">{dateTimeText(field(shift, 'scheduled_start'))} – {dateTimeText(field(shift, 'scheduled_end'))}</p><p className="mt-1 text-xs text-slate-500">{String(field(shift, 'activity_type')).toLowerCase()} · {String(field(shift, 'location') ?? '')}</p></div><div className="flex items-center gap-2"><StatusPill value={String(field(shift, 'status'))} />{field(shift, 'status') === 'SCHEDULED' ? <button type="button" disabled={busy} onClick={() => void act(() => payrollApi.updateShift(Number(field(shift, 'id')), { status: 'CANCELLED' }), 'Shift cancelled and audit logged.')} className={secondaryButton}>Cancel</button> : null}</div></div>)}{data?.shifts.length === 0 ? <Empty>No scheduled shifts in this window.</Empty> : null}</div></Panel>
        </div>
      ) : null}

      {view === 'compensation' ? (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Earnings, reimbursements, and deductions" description="Each active item requires documented authorization and verified tax treatment.">
              <form onSubmit={submitAdjustment} className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Employee<select value={selectedEmployeeId ?? ''} onChange={(event) => setSelectedEmployeeId(Number(event.target.value))} className={`${inputClass} mt-1`}>{data?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.preferredName || employee.legalFirstName} {employee.legalLastName}</option>)}</select></label>
                <label className="text-sm font-semibold text-slate-700">Type<select value={adjustmentForm.kind} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, kind: event.target.value })} className={`${inputClass} mt-1`}><option value="BONUS">Taxable bonus</option><option value="REIMBURSEMENT">Reimbursement</option><option value="PRETAX_DEDUCTION">Pretax deduction</option><option value="POSTTAX_DEDUCTION">Post-tax deduction</option><option value="GARNISHMENT">Garnishment</option></select></label>
                <label className="text-sm font-semibold text-slate-700">Name<input required value={adjustmentForm.name} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, name: event.target.value })} className={`${inputClass} mt-1`} placeholder="Travel reimbursement" /></label>
                <label className="text-sm font-semibold text-slate-700">Amount per pay period<input required min="0.01" step="0.01" type="number" value={adjustmentForm.amount} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, amount: event.target.value })} className={`${inputClass} mt-1`} /></label>
                <label className="text-sm font-semibold text-slate-700">Starts<input required type="date" value={adjustmentForm.activeFrom} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, activeFrom: event.target.value })} className={`${inputClass} mt-1`} /></label>
                <label className="text-sm font-semibold text-slate-700">Ends (optional)<input type="date" value={adjustmentForm.activeTo} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, activeTo: event.target.value })} className={`${inputClass} mt-1`} /></label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Authorization/source reference<input required value={adjustmentForm.authorizationReference} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, authorizationReference: event.target.value })} className={`${inputClass} mt-1`} placeholder="Receipt, employee election, order, or approval reference" /></label>
                <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={adjustmentForm.taxTreatmentVerified} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, taxTreatmentVerified: event.target.checked })} className="mt-1" />I verified the payroll tax treatment with a qualified source.</label>
                <label className="text-sm font-semibold text-slate-700">Initial status<select value={adjustmentForm.status} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, status: event.target.value })} className={`${inputClass} mt-1`}><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option></select></label>
                <button disabled={busy || !selectedEmployeeId} className={primaryButton}><Plus className="h-4 w-4" /> Save pay item</button>
              </form>
            </Panel>
            <Panel title="Maryland sick and safe leave ledger" description="Positive minutes add leave; negative minutes record approved use or correction.">
              <div className="mb-4 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Current selected balance</p><p className="mt-1 text-2xl font-black">{((Number(data?.leaveBalances.find((row) => Number(field(row, 'employee_id')) === selectedEmployeeId)?.balance_minutes ?? 0)) / 60).toFixed(2)} hours</p></div>
              <form onSubmit={submitLeave} className="space-y-3">
                <label className="text-sm font-semibold text-slate-700">Employee<select value={selectedEmployeeId ?? ''} onChange={(event) => setSelectedEmployeeId(Number(event.target.value))} className={`${inputClass} mt-1`}>{data?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.preferredName || employee.legalFirstName} {employee.legalLastName}</option>)}</select></label>
                <label className="text-sm font-semibold text-slate-700">Transaction date<input required type="date" value={leaveForm.transactionDate} onChange={(event) => setLeaveForm({ ...leaveForm, transactionDate: event.target.value })} className={`${inputClass} mt-1`} /></label>
                <label className="text-sm font-semibold text-slate-700">Minutes<input required type="number" step="1" value={leaveForm.minutes} onChange={(event) => setLeaveForm({ ...leaveForm, minutes: event.target.value })} className={`${inputClass} mt-1`} placeholder="60 earned or -60 used" /></label>
                <label className="text-sm font-semibold text-slate-700">Reason<input required value={leaveForm.reason} onChange={(event) => setLeaveForm({ ...leaveForm, reason: event.target.value })} className={`${inputClass} mt-1`} placeholder="Approved leave request or documented correction" /></label>
                <button disabled={busy || !selectedEmployeeId} className={primaryButton}>Record leave entry</button>
              </form>
            </Panel>
          </div>
          <Panel title="Active and draft pay items"><div className="space-y-3">{data?.adjustments.map((item) => <div key={String(field(item, 'id'))} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-bold text-slate-900">{String(field(item, 'name'))} · {money(field(item, 'amount_cents'))}</p><p className="mt-1 text-xs text-slate-500">{String(field(item, 'kind')).replaceAll('_', ' ')} · {dateText(field(item, 'active_from'))}{field(item, 'active_to') ? ` – ${dateText(field(item, 'active_to'))}` : ''}</p></div><div className="flex items-center gap-2"><StatusPill value={String(field(item, 'status'))} />{field(item, 'status') === 'ACTIVE' ? <button type="button" disabled={busy} onClick={() => void act(() => payrollApi.updateAdjustmentStatus(Number(field(item, 'id')), 'PAUSED'), 'Pay item paused.')} className={secondaryButton}>Pause</button> : null}</div></div>)}{data?.adjustments.length === 0 ? <Empty>No pay items configured.</Empty> : null}</div></Panel>
        </div>
      ) : null}

      {view === 'runs' ? (
        <div className="space-y-5">
          <Panel title="Pay calendar" description="Semimonthly: prior month 16–end pays on the 5th; current month 1–15 pays on the 20th." action={<button type="button" disabled={busy} onClick={() => { const today = new Date(); void act(() => payrollApi.generatePeriods(today.getFullYear(), today.getMonth() + 1), 'Current month pay periods generated.') }} className={secondaryButton}><RefreshCw className="h-4 w-4" /> Generate current month</button>}>
            <div className="flex flex-wrap items-end gap-3"><label className="min-w-72 flex-1 text-sm font-semibold text-slate-700">Pay period<select value={selectedPeriodId ?? ''} onChange={(event) => { setSelectedPeriodId(Number(event.target.value)); setRunPreview(null) }} className={`${inputClass} mt-1`}><option value="">Select a period</option>{data?.payPeriods.map((period) => <option key={String(field(period, 'id'))} value={String(field(period, 'id'))}>{dateText(field(period, 'period_start'))} – {dateText(field(period, 'period_end'))} · pays {dateText(field(period, 'pay_date'))}</option>)}</select></label><button type="button" disabled={busy || !selectedPeriodId} onClick={() => void preview()} className={primaryButton}>Preview payroll</button></div>
          </Panel>
          {runPreview ? <RunPreview preview={runPreview} busy={busy} onCreate={() => selectedPeriodId && act(() => payrollApi.createRun(selectedPeriodId), 'Draft payroll run saved with its calculation snapshot.')} /> : null}
          <RunManager runs={data?.payrollRuns ?? []} runEmployees={data?.payrollRunEmployees ?? []} busy={busy} onAct={act} />
        </div>
      ) : null}

      {view === 'compliance' ? <CompliancePanel tasks={data?.complianceTasks ?? []} sourceReviews={data?.sourceReviews ?? []} busy={busy} onUpdate={(task, status, note) => act(() => payrollApi.setCompliance(task.id, status, note), 'Compliance task updated with an audit record.')} onSourceCheck={(task) => act(() => payrollApi.checkComplianceSource(task.id), 'Official-source snapshot checked. Review any changed-content warning before updating the rule.')} /> : null}

      {view === 'reports' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Payroll register" description="Historical wage allocations with reconciliation status for review, records, or your accountant."><button type="button" disabled={busy} onClick={() => void downloadReport('payroll-register.csv?start=2026-01-01&end=2026-12-31', 'vortex-payroll-register-2026.csv')} className={primaryButton}><Download className="h-4 w-4" /> Download 2026 CSV</button><p className="mt-3 text-xs leading-5 text-slate-500">The Maria backfill is labeled gross-wage intent with zero recorded withholding; it is not represented as reconciled payroll.</p></Panel>
          <BookkeepingPanel mapping={data?.accountingMapping ?? null} runs={data?.payrollRuns ?? []} selectedRunId={selectedQuickbooksRunId} setSelectedRunId={setSelectedQuickbooksRunId} busy={busy} onAct={act} onDownload={downloadReport} />
          <Panel title="Operational reports" description="Export the underlying records for review or a payroll professional."><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void downloadReport('time-log.csv?start=2026-01-01&end=2026-12-31', 'vortex-time-log-2026.csv')} className={secondaryButton}><Download className="h-4 w-4" /> 2026 time log</button><button type="button" disabled={busy} onClick={() => void downloadReport('compliance.csv', 'vortex-payroll-compliance.csv')} className={secondaryButton}><Download className="h-4 w-4" /> Compliance</button><button type="button" disabled={busy} onClick={() => void downloadReport('tax-liabilities.csv', 'vortex-tax-liabilities.csv')} className={secondaryButton}><Download className="h-4 w-4" /> Tax liabilities</button><button type="button" disabled={busy} onClick={() => void downloadReport('leave.csv', 'vortex-leave-ledger.csv')} className={secondaryButton}><Download className="h-4 w-4" /> Leave ledger</button></div><ul className="mt-4 space-y-2 text-sm text-slate-700"><li>• Daily timestamps, breaks, activity type, evidence, and approval</li><li>• Workweek-based regular and overtime minutes</li><li>• Pay-period calculation snapshots and warnings</li><li>• Historical and finalized payroll register</li><li>• Compliance due dates and official-source review status</li><li>• Export hashes and reconciliation trail</li></ul></Panel>
          <Panel title="Integration boundary" description="Deliberate safeguards before direct accounting or banking connections."><ul className="space-y-2 text-sm text-slate-700"><li>• No banking credentials stored in payroll tables</li><li>• No AI-created or AI-approved transactions</li><li>• No export from a draft or blocked payroll</li><li>• No tax filing until withholding and filing services are verified</li></ul></Panel>
        </div>
      ) : null}
    </div>
  )
}

function EmployeeOnboarding({ employee, invitation, inviteUrl, busy, onUpdate, onInvite }: { employee: PayrollEmployee; invitation: Record<string, unknown> | null; inviteUrl: string; busy: boolean; onUpdate: (patch: Record<string, unknown>) => void; onInvite: (email: string, sendEmail: boolean) => void }) {
  const [email, setEmail] = useState(employee.personalEmail)
  const items = [
    { label: 'Federal W-4', key: 'w4Status', value: employee.w4Status, requested: 'REQUESTED', complete: 'COMPLETE' },
    { label: 'Maryland MW507', key: 'stateWithholdingStatus', value: employee.stateWithholdingStatus, requested: 'REQUESTED', complete: 'COMPLETE' },
    { label: 'Form I-9', key: 'i9Status', value: employee.i9Status, requested: 'SECTION_1', complete: 'COMPLETE' },
    { label: 'Direct deposit authorization', key: 'directDepositStatus', value: employee.directDepositStatus, requested: 'INVITED', complete: 'ACTIVE' },
  ]
  return <Panel title={`${employee.preferredName || employee.legalFirstName} onboarding`} description="Record status only after the underlying form or provider confirmation exists."><div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="font-black text-blue-950">Employee self-service invitation</p><p className="mt-1 text-xs leading-5 text-blue-800">Creates a one-time seven-day link. Redemption starts a revocable 30-day session; only token hashes are stored.</p><div className="mt-3 flex flex-wrap gap-2"><input aria-label="Employee invitation email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={`${inputClass} min-w-60 flex-1`} placeholder="employee@example.com" /><button type="button" disabled={busy || !email.trim()} onClick={() => onInvite(email, false)} className={secondaryButton}>Create link</button><button type="button" disabled={busy || !email.trim()} onClick={() => onInvite(email, true)} className={primaryButton}>Create & email</button></div>{invitation ? <p className="mt-2 text-xs text-blue-800">Latest: {invitation.redeemed_at ? 'redeemed' : invitation.revoked_at ? 'revoked' : new Date(String(invitation.expires_at)) > new Date() ? 'active' : 'expired'} · expires {dateTimeText(invitation.expires_at)}</p> : null}{inviteUrl ? <div className="mt-3 flex gap-2"><input readOnly aria-label="One-time employee invitation link" value={inviteUrl} className={`${inputClass} flex-1`} /><button type="button" className={secondaryButton} onClick={() => void navigator.clipboard.writeText(inviteUrl)}>Copy</button></div> : null}</div><div className="space-y-3">{items.map((item) => <div key={item.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="font-bold text-slate-900">{item.label}</p><StatusPill value={item.value} /></div><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => onUpdate({ [item.key]: item.requested })} className={secondaryButton}>Requested</button><button type="button" disabled={busy} onClick={() => onUpdate({ [item.key]: item.complete })} className={primaryButton}>Confirm complete</button></div></div>)}</div><div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Do not upload Social Security numbers, immigration identifiers, bank details, or identity documents into free-text notes. Use a vetted secure document/onboarding provider before enabling uploads.</div></Panel>
}

function RunPreview({ preview, busy, onCreate }: { preview: Record<string, unknown>; busy: boolean; onCreate: () => void }) {
  const warnings = Array.isArray(preview.warnings) ? preview.warnings as Array<Record<string, unknown>> : []
  const blockers = warnings.filter((item) => Boolean(item.blocking))
  return <Panel title="Calculation preview" description={`Version ${String(preview.calculationVersion ?? '')}`} action={<button type="button" disabled={busy} onClick={onCreate} className={secondaryButton}>Save draft snapshot</button>}><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Gross pay</p><p className="mt-1 text-xl font-black">{money(preview.grossPayCents)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Known employee FICA</p><p className="mt-1 text-xl font-black">{money(preview.employeeTaxCents)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Net pay</p><p className="mt-1 text-xl font-black">Not calculable</p></div></div><div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-black text-red-900">{blockers.length} approval blocker{blockers.length === 1 ? '' : 's'}</p><ul className="mt-2 space-y-1 text-sm text-red-800">{blockers.map((item, index) => <li key={`${String(item.code)}-${index}`}>• {String(item.message)}</li>)}</ul></div></Panel>
}

function RunManager({ runs, runEmployees, busy, onAct }: { runs: Array<Record<string, unknown>>; runEmployees: Array<Record<string, unknown>>; busy: boolean; onAct: (work: () => Promise<unknown>, message: string) => Promise<void> }) {
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [withholding, setWithholding] = useState<Record<number, { federal: string; state: string; source: string; confirmed: boolean }>>({})
  const [paymentReference, setPaymentReference] = useState('')
  const selected = runs.find((run) => Number(field(run, 'id')) === selectedRunId) ?? null
  const employees = runEmployees.filter((item) => Number(field(item, 'payroll_run_id')) === selectedRunId)
  const blockers = selected && Array.isArray(field(selected, 'blocking_warnings')) ? field(selected, 'blocking_warnings') as Array<Record<string, unknown>> : []
  const submitWithholding = (employeeId: number) => {
    const form = withholding[employeeId] ?? { federal: '', state: '', source: '', confirmed: false }
    void onAct(() => payrollApi.setVerifiedWithholding(Number(field(selected!, 'id')), employeeId, {
      federalIncomeTaxCents: Math.round(Number(form.federal) * 100),
      stateIncomeTaxCents: Math.round(Number(form.state) * 100),
      sourceNote: form.source,
      professionalConfirmed: form.confirmed,
    }), 'Verified withholding recorded and payroll totals recalculated.')
  }
  return <Panel title="Saved payroll runs" description="Review is sequential: draft → review → approval → external payment confirmation → finalized.">
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Pay date</th><th className="pb-3">Status</th><th className="pb-3">Gross</th><th className="pb-3">Net</th><th className="pb-3">Warnings</th><th className="pb-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{runs.map((run) => { const id = Number(field(run, 'id')); const warnings = Array.isArray(field(run, 'blocking_warnings')) ? field(run, 'blocking_warnings') as Array<Record<string, unknown>> : []; return <tr key={id}><td className="py-3">{dateText(field(run, 'pay_date'))}</td><td className="py-3"><StatusPill value={String(field(run, 'status'))} /></td><td className="py-3 font-bold">{money(field(run, 'gross_pay_cents'))}</td><td className="py-3">{field(run, 'status') === 'DRAFT' && Number(field(run, 'net_pay_cents')) === 0 ? 'Pending withholding' : money(field(run, 'net_pay_cents'))}</td><td className="py-3">{warnings.filter((item) => item.blocking).length} blockers</td><td className="py-3"><button type="button" onClick={() => setSelectedRunId(id)} className={secondaryButton}>Open review</button></td></tr> })}</tbody></table></div>
    {runs.length === 0 ? <Empty>No payroll runs saved yet.</Empty> : null}
    {selected ? <div className="mt-5 space-y-4 border-t border-slate-200 pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-black text-slate-900">Run {String(field(selected, 'id'))} · {dateText(field(selected, 'pay_date'))}</h4><p className="text-sm text-slate-500">{blockers.filter((item) => item.blocking).length} blocking warnings remain.</p></div><div className="flex gap-2">{field(selected, 'status') === 'DRAFT' ? <button disabled={busy} onClick={() => void onAct(() => payrollApi.setRunStatus(Number(field(selected, 'id')), 'REVIEW'), 'Payroll run moved to review.')} className={secondaryButton}>Send to review</button> : null}{field(selected, 'status') === 'REVIEW' ? <button disabled={busy || blockers.some((item) => item.blocking)} onClick={() => void onAct(() => payrollApi.setRunStatus(Number(field(selected, 'id')), 'APPROVED'), 'Payroll run approved. Record payment only after it occurs outside Vortex.')} className={primaryButton}>Approve run</button> : null}</div></div>
      {blockers.filter((item) => item.blocking).length ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{blockers.filter((item) => item.blocking).map((item, index) => <p key={`${String(item.code)}-${index}`}>• {String(item.message)}</p>)}</div> : null}
      {employees.map((employee) => { const employeeId = Number(field(employee, 'employee_id')); const form = withholding[employeeId] ?? { federal: '', state: '', source: '', confirmed: false }; return <div key={employeeId} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-bold">{String(field(employee, 'legal_first_name'))} {String(field(employee, 'legal_last_name'))}</p><p className="text-xs text-slate-500">Gross {money(Number(field(employee, 'regular_pay_cents')) + Number(field(employee, 'overtime_pay_cents')) + Number(field(employee, 'other_taxable_pay_cents')))} · reimbursements {money(field(employee, 'reimbursement_cents'))} · deductions {money(field(employee, 'other_deductions_cents'))}</p></div><p className="font-black">Net {field(employee, 'net_pay_cents') == null ? 'pending' : money(field(employee, 'net_pay_cents'))}</p></div>{['DRAFT', 'REVIEW'].includes(String(field(selected, 'status'))) ? <div className="mt-3 grid gap-2 md:grid-cols-2"><label className="text-xs font-bold text-slate-600">Federal withholding ($)<input type="number" min="0" step="0.01" value={form.federal} onChange={(event) => setWithholding({ ...withholding, [employeeId]: { ...form, federal: event.target.value } })} className={`${inputClass} mt-1`} /></label><label className="text-xs font-bold text-slate-600">Maryland withholding ($)<input type="number" min="0" step="0.01" value={form.state} onChange={(event) => setWithholding({ ...withholding, [employeeId]: { ...form, state: event.target.value } })} className={`${inputClass} mt-1`} /></label><label className="text-xs font-bold text-slate-600 md:col-span-2">Professional/table source note<input value={form.source} onChange={(event) => setWithholding({ ...withholding, [employeeId]: { ...form, source: event.target.value } })} className={`${inputClass} mt-1`} placeholder="Provider calculation ID, verified table and worksheet, reviewer/date" /></label><label className="flex items-start gap-2 text-xs text-slate-700 md:col-span-2"><input type="checkbox" checked={form.confirmed} onChange={(event) => setWithholding({ ...withholding, [employeeId]: { ...form, confirmed: event.target.checked } })} />I confirm these values came from a payroll professional or a verified calculation source—not AI.</label><button type="button" disabled={busy || !form.confirmed || form.source.trim().length < 12} onClick={() => submitWithholding(employeeId)} className={secondaryButton}>Record verified withholding</button></div> : null}</div> })}
      {field(selected, 'status') === 'APPROVED' ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-black text-amber-950">Finalize only after payment succeeds outside Vortex</p><div className="mt-3 flex flex-wrap gap-2"><input aria-label="External payment confirmation" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className={`${inputClass} min-w-64 flex-1`} placeholder="Bank/provider confirmation reference" /><button type="button" disabled={busy || paymentReference.trim().length < 4} onClick={() => void onAct(() => payrollApi.finalizeRun(Number(field(selected, 'id')), paymentReference), 'Payroll finalized and sick leave accrual posted.')} className={primaryButton}>Confirm paid & finalize</button></div></div> : null}
    </div> : null}
  </Panel>
}

function BookkeepingPanel({ mapping, runs, selectedRunId, setSelectedRunId, busy, onAct, onDownload }: { mapping: Record<string, unknown> | null; runs: Array<Record<string, unknown>>; selectedRunId: number | null; setSelectedRunId: (id: number | null) => void; busy: boolean; onAct: (work: () => Promise<unknown>, message: string) => Promise<void>; onDownload: (path: string, filename: string) => Promise<void> }) {
  const [accounts, setAccounts] = useState({
    wagesExpenseAccount: String(mapping?.wages_expense_account ?? 'Payroll:Wages Expense'),
    employerTaxExpenseAccount: String(mapping?.employer_tax_expense_account ?? 'Payroll:Employer Tax Expense'),
    reimbursementExpenseAccount: String(mapping?.reimbursement_expense_account ?? 'Employee Reimbursements'),
    taxLiabilityAccount: String(mapping?.tax_liability_account ?? 'Payroll:Tax Liabilities'),
    deductionLiabilityAccount: String(mapping?.deduction_liability_account ?? 'Payroll:Other Deductions Payable'),
    payrollClearingAccount: String(mapping?.payroll_clearing_account ?? 'Payroll Clearing'),
  })
  const verified = Boolean(mapping?.verified_by_bookkeeper)
  return <Panel title="QuickBooks journal export" description="Balanced journal CSV with a content hash and reconciliation trail.">
    {!verified ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">A bookkeeper must verify every account mapping before exports unlock.</div> : <div className="mb-4"><StatusPill value="BOOKKEEPER VERIFIED" /></div>}
    <div className="grid gap-2 sm:grid-cols-2">{Object.entries(accounts).map(([key, value]) => <label key={key} className="text-xs font-bold text-slate-600">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}<input value={value} onChange={(event) => setAccounts({ ...accounts, [key]: event.target.value })} className={`${inputClass} mt-1`} /></label>)}</div>
    <button type="button" disabled={busy} onClick={() => void onAct(() => payrollApi.verifyAccountingMapping({ ...accounts, verifiedByBookkeeper: true }), 'QuickBooks account mapping marked bookkeeper-verified.')} className={`${secondaryButton} mt-3`}>Confirm bookkeeper verification</button>
    <div className="my-4 border-t border-slate-200" />
    <select value={selectedRunId ?? ''} onChange={(event) => setSelectedRunId(Number(event.target.value) || null)} className={inputClass}><option value="">Choose an approved or finalized run</option>{runs.filter((run) => ['APPROVED', 'FINALIZED'].includes(String(field(run, 'status')))).map((run) => <option key={String(field(run, 'id'))} value={String(field(run, 'id'))}>Run {String(field(run, 'id'))} · {dateText(field(run, 'pay_date'))}</option>)}</select>
    <button type="button" disabled={busy || !selectedRunId || !verified} onClick={() => void onDownload(`quickbooks.csv?runId=${selectedRunId}`, `vortex-quickbooks-payroll-${selectedRunId}.csv`)} className={`${primaryButton} mt-3`}><Download className="h-4 w-4" /> Export QuickBooks CSV</button>
    <p className="mt-3 text-xs leading-5 text-slate-500">Export never connects to QuickBooks or moves money. Record the QuickBooks import reference in the export ledger after import.</p>
  </Panel>
}

function CompliancePanel({ tasks, sourceReviews, busy, onUpdate, onSourceCheck }: { tasks: ComplianceTask[]; sourceReviews: Array<Record<string, unknown>>; busy: boolean; onUpdate: (task: ComplianceTask, status: string, note: string) => void; onSourceCheck: (task: ComplianceTask) => void }) {
  const [notes, setNotes] = useState<Record<number, string>>({})
  const reviewByTask = new Map(sourceReviews.map((review) => [Number(review.compliance_task_id), review]))
  return <Panel title="Legal and payroll requirements" description="Source-linked operating checklist. Requirements can change; each item has a review date."><div className="space-y-3">{tasks.map((task) => { const review = reviewByTask.get(task.id); return <article key={task.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusPill value={task.severity} severity={task.severity} /><StatusPill value={task.status} />{review ? <StatusPill value={String(review.result)} severity={review.result === 'REVIEW_REQUIRED' || review.result === 'FETCH_FAILED' ? 'WARNING' : undefined} /> : null}</div><h3 className="mt-2 font-black text-slate-900">{task.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{task.description}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>Due: {dateText(task.dueDate)}</span><span>Jurisdiction: {task.jurisdiction}</span><span>Reviewed: {dateText(task.lastVerifiedOn)}</span><span>Review again: {dateText(task.nextReviewOn)}</span></div>{review ? <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-600">Source check {dateTimeText(review.checked_at)}: {String(review.advisory_summary)}</p> : null}<div className="mt-2 flex flex-wrap items-center gap-3">{task.sourceUrl ? <a href={task.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700 hover:underline">Official source · {task.sourceAuthority}</a> : null}{task.sourceUrl ? <button type="button" disabled={busy} onClick={() => onSourceCheck(task)} className="text-xs font-bold text-slate-700 hover:underline">Check source snapshot</button> : null}</div></div><select aria-label={`Status for ${task.title}`} value={task.status} disabled={busy} onChange={(event) => { const next = event.target.value; if (next === 'COMPLETE') return; onUpdate(task, next, notes[task.id] ?? '') }} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="NOT_APPLICABLE">Not applicable</option><option value="COMPLETE" disabled>Complete with note below</option></select></div><div className="mt-3 flex flex-wrap gap-2"><input aria-label={`Completion note for ${task.title}`} value={notes[task.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [task.id]: event.target.value }))} className={`${inputClass} min-w-64 flex-1`} placeholder="Confirmation number, filing date, policy reference…" /><button type="button" disabled={busy || !(notes[task.id] ?? '').trim()} onClick={() => onUpdate(task, 'COMPLETE', notes[task.id] ?? '')} className={primaryButton}><FileCheck2 className="h-4 w-4" /> Confirm complete</button></div></article> })}</div></Panel>
}
