import EmployeeMarylandAgreement from './EmployeeMarylandAgreement'
import EmployeeRetirementContributions from './EmployeeRetirementContributions'
import EmployeeRetirement from './EmployeeRetirement'
import EmployeeBenefitCoverage from './EmployeeBenefitCoverage'
import CheckReceipts from './CheckReceipts'
import ReplacementReceipts from './ReplacementReceipts'
import EmployeeBankEnrollment from './EmployeeBankEnrollment'
import EmployeeW2Documents from './EmployeeW2Documents'
import EmployeeW2Consent from './EmployeeW2Consent'
import EmployeePaymentAuthorization from './EmployeePaymentAuthorization'
import EmployeeFilingIdentityReview from './EmployeeFilingIdentityReview'
import EmployeeBenefitContributions from './EmployeeBenefitContributions'
import SplitCompensationReview from './SplitCompensationReview'
import EmployeeSalaryNotices from './EmployeeSalaryNotices'
import EmployeeScheduleNotices from './EmployeeScheduleNotices'
import CompensationHistory from './CompensationHistory'
import OnboardingWorkspace from './OnboardingWorkspace'
import WorkforceRequests from './WorkforceRequests'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarDays, CheckCircle2, Clock3, FileText, Loader2, LogOut, RefreshCw, ShieldCheck, UserRound, WalletCards } from 'lucide-react'
import { clearPayrollEmployeeSession, employeePayrollApi, getPayrollEmployeeSession, type EmployeePayrollPortalData } from '../../utils/employeePayrollApi'

type PortalView = 'requests' | 'home' | 'time' | 'schedule' | 'pay' | 'onboarding'
const views: Array<{ id: PortalView; label: string; icon: typeof Clock3 }> = [
  { id: 'requests', label: 'Leave & requests', icon: FileText },
  { id: 'home', label: 'Home', icon: UserRound },
  { id: 'time', label: 'My time', icon: Clock3 },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'pay', label: 'Pay statements', icon: WalletCards },
  { id: 'onboarding', label: 'Onboarding', icon: FileText },
]
const field = (row: Record<string, unknown>, key: string) => row[key]
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const dateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Open'
const dateOnlyText = (value: unknown) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const pillTone = (status: string) => ['COMPLETE', 'ACTIVE', 'APPROVED', 'EMPLOYEE_ATTESTED'].includes(status) ? 'bg-emerald-100 text-emerald-800' : ['MISSING', 'REJECTED', 'MISSED'].includes(status) ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'

function StatementRates({statement}:{statement:Record<string,unknown>}) {
 const rates=(statement.statement_snapshot as {rateBreakdown?:Array<{hourlyRateCents:number;regularMinutes:number;overtimeMinutes:number;regularPayCents:number;overtimePayCents:number}>})?.rateBreakdown
 if((statement.statement_snapshot as {splitCompensation?:unknown[]})?.splitCompensation?.length||!rates?.length)return null
 return <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">{rates.map(rate=><p key={rate.hourlyRateCents}><strong>{money(rate.hourlyRateCents)}/hour:</strong> {(rate.regularMinutes/60).toFixed(2)} regular hours ({money(rate.regularPayCents)}) · {(rate.overtimeMinutes/60).toFixed(2)} overtime hours at {money(rate.hourlyRateCents*1.5)}/hour ({money(rate.overtimePayCents)})</p>)}</div>
}

function Pill({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${pillTone(status)}`}>{status.replaceAll('_', ' ')}</span>
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-slate-100 px-5 py-4 text-lg font-black text-slate-950">{title}</h2><div className="p-5">{children}</div></section>
}

export default function PayrollEmployeePortal() {
  const redemption = useRef<{ token: string; result: ReturnType<typeof employeePayrollApi.redeem> } | null>(null)
  const [data, setData] = useState<EmployeePayrollPortalData | null>(null)
  const [requestReason,setRequestReason]=useState('')
  const requestCoverageHelp=(month:string)=>{setRequestReason(`Benefit coverage question for ${month}: `);setView('requests')}
  const [onboardingRefresh,setOnboardingRefresh]=useState(0)
  const [view, setView] = useState<PortalView>('home')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activityType, setActivityType] = useState('INSTRUCTION')
  const [preferredName, setPreferredName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [workplace, setWorkplace] = useState('1')

  const load = useCallback(async () => {
    const next = await employeePayrollApi.me()
    setData(next)
    setPreferredName(next.employee.preferredName)
    setPhone(next.employee.phone)
  }, [])

  useEffect(() => {
    let cancelled = false
    const start = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams(window.location.search)
        const invite = params.get('invite')
        if (invite) {
          if (redemption.current?.token !== invite) redemption.current = { token: invite, result: employeePayrollApi.redeem(invite) }
          const redeemed = await redemption.current.result
          if (cancelled) return
          window.history.replaceState({}, '', '/employee/payroll')
          setData(redeemed)
          setPreferredName(redeemed.employee.preferredName)
          setPhone(redeemed.employee.phone)
        } else if (getPayrollEmployeeSession()) {
          const next = await employeePayrollApi.me()
          if (cancelled) return
          setData(next)
          setPreferredName(next.employee.preferredName)
          setPhone(next.employee.phone)
        } else {
          setError('Open the one-time invitation link from Vortex to start your payroll portal session.')
        }
      } catch (startError) {
        clearPayrollEmployeeSession()
        if (!cancelled) setError(startError instanceof Error ? startError.message : 'Unable to open payroll portal')
      } finally { if (!cancelled) setLoading(false) }
    }
    void start()
    return () => { cancelled = true }
  }, [])

  const isClockedIn = useMemo(() => data?.timeEntries.some((entry) => !field(entry, 'clock_out') && field(entry, 'status') !== 'REJECTED') ?? false, [data?.timeEntries])
  const currentEntry = useMemo(() => data?.timeEntries.find((entry) => !field(entry, 'clock_out') && field(entry, 'status') !== 'REJECTED') ?? null, [data?.timeEntries])
  const displayName = data?.employee.preferredName || data?.employee.legalFirstName || 'Employee'

  const act = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true)
    setError('')
    setNotice('')
    try { await action(); await load(); setNotice(message) }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Action failed') }
    finally { setBusy(false) }
  }

  const logout = async () => {
    setBusy(true)
    try { await employeePayrollApi.logout() } catch { clearPayrollEmployeeSession() }
    setData(null)
    setError('Your payroll session has ended. Sign in with your payroll password, or ask your hiring admin for a fresh invitation.')
    setBusy(false)
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening secure payroll portal…</main>

  if (!data) return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5"><div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl"><ShieldCheck className="mx-auto h-12 w-12 text-vortex-red" /><h1 className="mt-4 text-2xl font-black text-slate-950">Vortex employee payroll</h1><p className="mt-3 text-sm leading-6 text-slate-600">{error}</p><form className="mt-5 space-y-3 text-left" onSubmit={e => { e.preventDefault(); void act(() => employeePayrollApi.login(loginEmail, password, Number(workplace)), 'Signed in.').then(() => setPassword('')) }}><label className="block text-sm font-bold">Email<input required type="email" autoComplete="username" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label><label className="block text-sm font-bold">Password<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label><label className="block text-sm font-bold">Workplace number<input required type="number" min="1" value={workplace} onChange={e => setWorkplace(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label><button disabled={busy} className="w-full rounded-xl bg-slate-950 p-3 font-bold text-white">Sign in to payroll</button></form><p className="mt-5 text-xs text-slate-500">For your security, do not email identity documents, Social Security numbers, or bank details.</p></div></main>

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Vortex payroll</p><p className="mt-1 text-lg font-black">Hi, {displayName}</p></div><button type="button" disabled={busy} onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-sm font-bold hover:bg-white/10"><LogOut className="h-4 w-4" /> Sign out</button></div>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        <section className="rounded-3xl bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-bold text-slate-300">{data.employee.jobTitle}</p><h1 className="mt-1 text-3xl font-black">Your work, schedule, and onboarding</h1><p className="mt-3 text-sm text-slate-300">{data.employee.primaryWorkLocation}</p></div><div className="rounded-2xl bg-white/10 px-5 py-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-300">{data.employee.payType==='SALARY'?'Annual salary':'Hourly rate'}</p><p className="mt-1 text-2xl font-black">{money(data.employee.payType==='SALARY'?data.employee.annualSalaryCents||0:data.employee.hourlyRateCents)}</p></div></div></section>
        <nav aria-label="Employee payroll sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{views.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setView(id); setNotice(''); setError('') }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${view === id ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
        {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
        {notice ? <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5" />{notice}</div> : null}

        {view === 'home' ? <Card title={data.employee.hasPassword ? 'Update your payroll password' : 'Set up return access'}><p className="text-sm text-slate-600">Set a password to return without another invitation. Your workplace number is {data.employee.facilityId}.</p><form className="mt-3 flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); void act(() => employeePayrollApi.setPassword(password), 'Password saved. You can sign in again with your email.').then(() => setPassword('')) }}><input aria-label="New payroll password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} className="min-w-60 flex-1 rounded-xl border border-slate-300 p-3" placeholder="At least 12 characters" /><button disabled={busy} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Save password</button></form></Card> : null}
        {data.employee.employmentStatus === 'TERMINATED' ? <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Your employment has ended. Pay statements, documents, sign-in settings, and payroll questions remain available.</p> : null}
        {view === 'home' ? <div className="grid gap-5 lg:grid-cols-2"><Card title="Clock status"><div className={`rounded-2xl p-5 ${isClockedIn ? 'bg-emerald-50' : 'bg-slate-50'}`}><p className="text-xs font-black uppercase tracking-wide text-slate-500">Current status</p><p className="mt-1 text-2xl font-black text-slate-950">{isClockedIn ? `Clocked in since ${dateTime(field(currentEntry ?? {}, 'clock_in'))}` : 'Not clocked in'}</p>{!isClockedIn ? <select aria-label="Clock-in activity" value={activityType} onChange={(event) => setActivityType(event.target.value)} className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold"><option>INSTRUCTION</option><option>PLANNING</option><option>SETUP</option><option>MEETING</option><option>ADMIN</option><option>OTHER</option></select> : null}<button type="button" disabled={busy || data.employee.employmentStatus === 'TERMINATED'} onClick={() => void act(() => employeePayrollApi.clock(isClockedIn ? 'OUT' : 'IN', activityType), isClockedIn ? 'Clock-out recorded. Review and attest the entry.' : 'Clock-in recorded.')} className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white ${isClockedIn ? 'bg-slate-950' : 'bg-vortex-red hover:bg-red-700'}`}><Clock3 className="h-5 w-5" />{isClockedIn ? 'Clock out' : 'Clock in'}</button></div></Card><Card title="At a glance"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Upcoming shifts</p><p className="mt-1 text-2xl font-black">{data.shifts.filter((shift) => new Date(String(field(shift, 'scheduled_start'))) >= new Date() && field(shift, 'status') === 'SCHEDULED').length}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Sick leave balance</p><p className="mt-1 text-2xl font-black">{(data.sickLeaveBalanceMinutes / 60).toFixed(2)} hr</p></div></div><p className="mt-4 text-xs leading-5 text-slate-500">Time entries remain subject to employer review. This portal does not show or store bank account numbers or identity-document numbers.</p></Card><Card title="Profile"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">Preferred name<input value={preferredName} onChange={(event) => setPreferredName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label><label className="text-sm font-bold text-slate-700">Phone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label></div><button type="button" disabled={busy} onClick={() => void act(() => employeePayrollApi.updateProfile(preferredName, phone), 'Profile updated.')} className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black hover:bg-slate-50">Save profile</button></Card></div> : null}

        {view === 'time' ? <Card title="My daily time"><div className="space-y-3">{data.timeEntries.map((entry) => <article key={String(field(entry, 'id'))} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black text-slate-950">{dateTime(field(entry, 'clock_in'))}</p><p className="mt-1 text-sm text-slate-600">to {dateTime(field(entry, 'clock_out'))} · {field(entry, 'worked_minutes') == null ? 'open' : `${field(entry, 'worked_minutes')} worked minutes`}</p><p className="mt-1 text-xs text-slate-500">{String(field(entry, 'activity_type')).toLowerCase()} · break {String(field(entry, 'unpaid_break_minutes'))} min</p></div><Pill status={String(field(entry, 'status'))} /></div>{field(entry, 'clock_out') && field(entry, 'status') === 'UNVERIFIED' ? <button type="button" disabled={busy} onClick={() => void act(() => employeePayrollApi.attest(Number(field(entry, 'id'))), 'Time entry attested and sent for employer approval.')} className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">I confirm this entry</button> : null}</article>)}{data.timeEntries.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No time entries yet.</p> : null}</div></Card> : null}

        {view === 'schedule' ? <Card title="My schedule"><div className="space-y-3">{data.shifts.map((shift) => <article key={String(field(shift, 'id'))} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-black text-slate-950">{dateTime(field(shift, 'scheduled_start'))}</p><p className="mt-1 text-sm text-slate-600">Ends {dateTime(field(shift, 'scheduled_end'))}</p><p className="mt-1 text-xs text-slate-500">{String(field(shift, 'activity_type')).toLowerCase()} · {String(field(shift, 'location') ?? '')}</p></div><Pill status={String(field(shift, 'status'))} /></article>)}{data.shifts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No shifts in this schedule window.</p> : null}</div></Card> : null}

        {view === 'pay' ? <><EmployeeRetirement/><EmployeeRetirementContributions/><CheckReceipts/><ReplacementReceipts/><EmployeeBenefitContributions/><EmployeeBenefitCoverage onRequestHelp={requestCoverageHelp}/><EmployeeScheduleNotices/><EmployeeSalaryNotices/><CompensationHistory/><Card title="My pay statements"><div className="space-y-4">{data.payStatements.map((statement) => { const allocated=!!(statement.statement_snapshot as {authorizedSettlement?:unknown[]})?.authorizedSettlement?.length; const gross = Number(field(statement, 'regular_pay_cents')) + Number(field(statement, 'overtime_pay_cents')) + Number(field(statement, 'other_taxable_pay_cents')); const taxes = Number(field(statement, 'federal_income_tax_cents')) + Number(field(statement, 'state_income_tax_cents')) + Number(field(statement, 'social_security_tax_cents')) + Number(field(statement, 'medicare_tax_cents')) + Number(field(statement, 'additional_medicare_tax_cents')); return <article key={String(field(statement, 'id'))} className="overflow-hidden rounded-2xl border border-slate-200"><div className="flex flex-wrap items-start justify-between gap-3 bg-slate-950 p-4 text-white"><div><p className="font-black">{String(field(statement, 'legal_business_name'))}</p><p className="mt-1 text-xs text-slate-300">{String(field(statement, 'business_address'))} · EIN ending {String(field(statement, 'ein_last4'))}</p></div><div className="text-right"><p className="text-xs text-slate-300">Pay date</p><p className="font-black">{dateOnlyText(field(statement, 'pay_date'))}</p></div></div><div className="p-4"><p className="text-xs font-bold text-slate-500">Period {dateOnlyText(field(statement, 'period_start'))} through {dateOnlyText(field(statement, 'period_end'))}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-slate-500">{allocated?'Straight-time':'Regular'}</p><p className="font-black">{((Number(field(statement, 'regular_minutes'))+(allocated?Number(field(statement, 'overtime_minutes')):0)) / 60).toFixed(2)} hr · {money(Number(field(statement, 'regular_pay_cents')))}</p></div><div><p className="text-xs text-slate-500">{allocated?'Overtime premium':'Overtime'}</p><p className="font-black">{(Number(field(statement, 'overtime_minutes')) / 60).toFixed(2)} hr · {money(Number(field(statement, 'overtime_pay_cents')))}</p></div><div><p className="text-xs text-slate-500">Rate</p><p className="font-black">{allocated?'Combined workweek rate':(statement.statement_snapshot as {splitCompensation?:unknown[]})?.splitCompensation?.length?'Multiple agreements':((statement.statement_snapshot as {rateBreakdown?:Array<{hourlyRateCents:number}>})?.rateBreakdown?.length ? (statement.statement_snapshot as {rateBreakdown:Array<{hourlyRateCents:number}>}).rateBreakdown.map(r=>money(r.hourlyRateCents)).join(', ') : money(Number(field(statement, 'hourly_rate_cents'))))+' /hr'}</p></div><div><p className="text-xs text-slate-500">Additional taxable pay</p><p className="font-black">{money(Number(field(statement, 'other_taxable_pay_cents')) - Number(field(statement, 'paid_leave_cents') || 0))}</p></div><div><p className="text-xs text-slate-500">Paid leave</p><p className="font-black">{(Number(field(statement, 'paid_leave_minutes') || 0) / 60).toFixed(2)} hr · {money(Number(field(statement, 'paid_leave_cents') || 0))}</p></div><div><p className="text-xs text-slate-500">Gross wages</p><p className="font-black">{money(gross)}</p></div><div><p className="text-xs text-slate-500">Reimbursements</p><p className="font-black">{money(Number(field(statement, 'reimbursement_cents')))}</p></div><div><p className="text-xs text-slate-500">Taxes</p><p className="font-black">{money(taxes)}</p></div><div><p className="text-xs text-slate-500">Other deductions</p><p className="font-black">{money(Number(field(statement, 'other_deductions_cents')))}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Net pay</p><p className="text-lg font-black text-emerald-900">{money(Number(field(statement, 'net_pay_cents')))}</p></div></div><div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">{([['Federal income tax','federal_income_tax_cents'],['Maryland income tax','state_income_tax_cents'],['Social Security','social_security_tax_cents'],['Medicare','medicare_tax_cents'],['Additional Medicare','additional_medicare_tax_cents'],['Pretax deductions','pretax_deduction_cents'],['Posttax deductions','posttax_deduction_cents'],['Garnishments','garnishment_cents']] as const).map(([label,key])=><p key={key}>{label}: <strong>{money(Number(field(statement,key)))}</strong></p>)}</div><SplitCompensationReview snapshot={{employees:[statement.statement_snapshot]}}/><StatementRates statement={statement}/><button type="button" disabled={busy} className="mt-4 rounded-xl bg-slate-950 px-4 py-3 font-bold text-white" onClick={()=>void act(()=>employeePayrollApi.downloadStatement(Number(field(statement,'id'))),'Pay statement downloaded.')}>Download itemized pay statement (PDF)</button></div></article> })}{data.payStatements.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No finalized pay statements yet.</p> : null}</div></Card></> : null}

        {view === 'pay' ? <EmployeeW2Documents/> : null}
        {view === 'requests' ? <WorkforceRequests timeEntries={data.timeEntries} initialReason={requestReason} onSubmitted={()=>setRequestReason('')} /> : null}
        {view === 'onboarding' ? <><EmployeeMarylandAgreement onChanged={()=>setOnboardingRefresh(value=>value+1)}/><EmployeeRetirement/><EmployeeRetirementContributions/><OnboardingWorkspace refresh={onboardingRefresh} employmentStatus={data.employee.employmentStatus} onChanged={load} /><EmployeeBenefitCoverage onRequestHelp={requestCoverageHelp}/><EmployeeFilingIdentityReview /><EmployeeBankEnrollment /><EmployeePaymentAuthorization /><EmployeeW2Consent /></> : null}
      </main>
      <button type="button" onClick={() => void act(load, 'Payroll portal refreshed.')} disabled={busy} aria-label="Refresh payroll portal" className="fixed bottom-5 right-5 rounded-full bg-white p-3 text-slate-700 shadow-lg ring-1 ring-slate-200 hover:bg-slate-50"><RefreshCw className={`h-5 w-5 ${busy ? 'animate-spin' : ''}`} /></button>
    </div>
  )
}
