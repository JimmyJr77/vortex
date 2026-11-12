import { useEffect, useState } from 'react'
import { ArrowDownToLine, Check, CreditCard, Loader2, ReceiptText, Search, SlidersHorizontal } from 'lucide-react'
import { adminApiRequest } from '../../../utils/api'
import { useRead, useSearch, type BillingTarget } from '../api'
import { button, Empty, ErrorNotice, Loading, Pager } from '../shared'
import DateRange, { filterInput } from './DateRange'
import { presetRange, type DateRangeValue } from './dateRanges'
import EntityPicker, { type EntityOption } from './EntityPicker'
import AccountingDetails, { type AccountingSelection } from './Details'
import { BillsTable, PaymentsTable } from './Tables'
import { amount, day, moment } from './format'
import type { AccountingView, BillPage, BillSummary, FilterOptions, PaymentPage, PaymentSummary, SortDirection } from './types'

interface Filters {
  dates: DateRangeValue
  dateField: string
  search: string
  person: EntityOption | null
  classOption: EntityOption | null
  status: string
  balancePeriod?: 'all' | 'current' | 'upcoming'
  kind: string
  paymentStatus: string
  sortBy: string
  sortDir: SortDirection
  page: number
  pageSize: number
}
export interface AccountingWorkspaceState { view: AccountingView; filters: Record<AccountingView, Filters> }
const freshFilters = (timezone = 'America/New_York'): Filters => ({ dates: presetRange('month', timezone), dateField: 'billed', search: '', person: null, classOption: null, status: 'all', balancePeriod: 'all', kind: 'all', paymentStatus: 'all', sortBy: 'date', sortDir: 'desc', page: 1, pageSize: 25 })
const billStatuses = [{ value: 'all', label: 'All' }, { value: 'open', label: 'Open bills' }, { value: 'partial', label: 'Partially paid' }, { value: 'paid', label: 'Paid or credited' }, { value: 'credit', label: 'Credit line items' }, { value: 'voided', label: 'Voided' }, { value: 'historical', label: 'Historical' }]

function queryFor(filters: Filters, view: AccountingView, search: string) {
  const query = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize), sortBy: filters.sortBy, sortDir: filters.sortDir })
  if (filters.dates.from) query.set('from', filters.dates.from)
  if (filters.dates.through) query.set('through', filters.dates.through)
  if (search) query.set('search', search)
  if (filters.person) query.set('memberId', String(filters.person.id))
  if (filters.classOption) query.set('classId', String(filters.classOption.id))
  if (view === 'lines') { query.set('dateField', filters.dateField); query.set('status', filters.status); query.set('balancePeriod', filters.balancePeriod ?? 'all') }
  else { query.set('kind', filters.kind); query.set('paymentStatus', filters.paymentStatus) }
  return query
}

function SummaryCard({ label, cents, note, accent = false }: { label: string; cents: number; note: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-5 ${accent ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
    <p className={`text-xs font-semibold uppercase tracking-wider ${accent ? 'text-slate-300' : 'text-slate-500'}`}>{label}</p>
    <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{amount(cents)}</p>
    <p className={`mt-2 text-xs leading-5 ${accent ? 'text-slate-300' : 'text-slate-500'}`}>{note}</p>
  </div>
}

function AccountBalanceCards({ data }: { data: BillPage }) {
  if (!data.balances) return null
  const value = data.balances
  return <section aria-label="Current family account balances" className="space-y-3">
    <div><h3 className="font-semibold text-slate-900">Family account balances</h3><p className="mt-1 text-xs text-slate-500">All family accounts · As of {day(data.asOf)} · These totals are independent of the report filters.</p></div>
    <div className="grid gap-3 lg:grid-cols-3">
      <SummaryCard label="Current unpaid balances" cents={value.currentCents} note={`${value.currentFamilies} families · This month and earlier, after payments and credits`} accent />
      <SummaryCard label="Upcoming bills" cents={value.upcomingCents} note={`${value.upcomingFamilies} families · Future service months, after payments and credits`} />
      <SummaryCard label="Available account credits" cents={value.creditCents} note={`${value.creditFamilies} families · Credit remaining after all posted bills`} />
    </div>
    {value.reviewCents > 0 ? <p className="text-sm text-amber-800">{amount(value.reviewCents)} of account balances needs review because it cannot be assigned to a current or upcoming bill.</p> : null}
  </section>
}

function BillSummaryCards({ value }: { value: BillSummary }) {
  if (value.comparableBilledCents == null) return <p className="text-sm text-slate-500">The billed/paid comparison is temporarily unavailable.</p>
  return <section aria-label="Matched bill comparison" className="space-y-3">
    <p className="text-xs text-slate-500">Totals for the same {value.comparableCount} bills. Includes future bills unless an unpaid period is selected.</p>
    <div className="grid gap-3 lg:grid-cols-3">
      <SummaryCard label="Total billed" cents={value.comparableBilledCents} note="After bill adjustments; excludes voided bills and standalone credits" />
      <SummaryCard label="Paid or credited" cents={value.comparableBilledCents - (value.remainingCents ?? 0)} note="Amount of these bills covered by payments and credits" />
      <SummaryCard label="Remaining balance" cents={value.remainingCents ?? 0} note={`${amount(value.currentRemainingCents ?? 0)} current · ${amount(value.upcomingRemainingCents ?? 0)} upcoming`} />
    </div>
    <p className="text-xs leading-5 text-slate-500">Payments and credits are included automatically in these balances. See Payments &amp; refunds for the full amounts received and refunded.</p>
    {(value.historicalCount ?? 0) > 0 ? <p className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 text-xs leading-5 text-slate-600">{value.historicalCount} imported historical line items totaling {amount(value.historicalBilledCents ?? 0)} remain in the table for reference and are excluded from this current-bill comparison. Imported receipts and refunds remain in Payments &amp; refunds.</p> : null}
  </section>
}

function PaymentSummaryCards({ value, filtered }: { value: PaymentSummary; filtered: boolean }) {
  return <div className="grid gap-3 lg:grid-cols-3">
    <SummaryCard label={filtered ? 'Household receipts' : 'Payments received'} cents={value.receiptsCents} note="Whole settled household receipts" />
    <SummaryCard label={filtered ? 'Household refunds' : 'Refunds returned'} cents={value.refundsCents} note="Whole settled refund events in this report" />
    <SummaryCard label={filtered ? 'Household net cash' : 'Net cash movement'} cents={value.netCashCents} note="Settled receipts less settled refunds" accent={!filtered} />
  </div>
}

export default function Accounting({ revision, onBilling, workspace, onWorkspaceChange }: { revision: number; onBilling: (target: BillingTarget) => void; workspace?: AccountingWorkspaceState | null; onWorkspaceChange?: (state: AccountingWorkspaceState) => void }) {
  const [view, setView] = useState<AccountingView>(workspace?.view ?? 'lines')
  const [savedFilters, setSavedFilters] = useState<Record<AccountingView, Filters>>(() => workspace?.filters ?? { lines: freshFilters(), payments: freshFilters() })
  const [personQuery, setPersonQuery] = useState('')
  const [classQuery, setClassQuery] = useState('')
  const [selected, setSelected] = useState<AccountingSelection | null>(null)
  const [version, setVersion] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exported, setExported] = useState(false)
  useEffect(() => { onWorkspaceChange?.({ view, filters: savedFilters }) }, [view, savedFilters, onWorkspaceChange])
  const filters = savedFilters[view]
  const billSearch = useSearch(savedFilters.lines.search)
  const paymentSearch = useSearch(savedFilters.payments.search)
  const personSearch = useSearch(personQuery)
  const classSearch = useSearch(classQuery)
  const personOptions = useRead<FilterOptions>(`/api/admin/accounting/options?q=${encodeURIComponent(personSearch)}`, revision)
  const classOptions = useRead<FilterOptions>(`/api/admin/accounting/options?q=${encodeURIComponent(classSearch)}`, revision)
  const query = queryFor(filters, view, view === 'lines' ? billSearch : paymentSearch)
  const invalidDates = Boolean(filters.dates.from && filters.dates.through && filters.dates.from > filters.dates.through)
  const queryPending = (view === 'lines' ? billSearch : paymentSearch) !== filters.search.trim()
  const lines = useRead<BillPage>(view === 'lines' && !invalidDates && !queryPending ? `/api/admin/accounting/lines?${query}` : null, revision + version)
  const payments = useRead<PaymentPage>(view === 'payments' && !invalidDates && !queryPending ? `/api/admin/accounting/payments?${query}` : null, revision + version)
  const state = view === 'lines' ? lines : payments
  const data = state.data
  const timezone = data?.timezone ?? 'America/New_York'
  const hasRelationFilter = Boolean(filters.person || filters.classOption)
  const loading = state.loading || queryPending

  const update = (patch: Partial<Filters>) => {
    setSavedFilters(current => ({ ...current, [view]: { ...current[view], ...patch, page: patch.page ?? 1 } }))
    setSelected(null); setExportError(null); setExported(false)
  }
  const sort = (key: string) => update({ sortBy: key, sortDir: filters.sortBy === key && filters.sortDir === 'asc' ? 'desc' : 'asc' })
  const changeView = (next: AccountingView) => { setView(next); setSelected(null); setPersonQuery(''); setClassQuery(''); setExportError(null); setExported(false) }
  const clear = () => { setSavedFilters(current => ({ ...current, [view]: freshFilters(timezone) })); setPersonQuery(''); setClassQuery(''); setSelected(null); setExportError(null); setExported(false) }

  const exportCsv = async () => {
    setExporting(true); setExportError(null); setExported(false)
    try {
      const exportQuery = new URLSearchParams(query)
      exportQuery.set('view', view); exportQuery.delete('page'); exportQuery.delete('pageSize')
      const response = await adminApiRequest(`/api/admin/accounting/export.csv?${exportQuery}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || 'CSV export could not be prepared. Please retry.')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url; link.download = `accounting-${view}-${filters.dates.from || 'all'}-${filters.dates.through || 'dates'}.csv`
      document.body.append(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExported(true)
    } catch (error) { setExportError(error instanceof Error ? error.message : 'Export failed.') }
    finally { setExporting(false) }
  }

  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-slate-950 px-6 py-7 text-white sm:px-7">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Finance workspace</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Accounting</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Every bill, payment, and refund across your household accounts.</p></div>
      <button type="button" onClick={() => void exportCsv()} disabled={exporting || loading || invalidDates || !data || Boolean(state.error)} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-slate-100 disabled:opacity-50">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}Export filtered CSV</button>
    </header>

    <div role="tablist" aria-label="Accounting views" className="flex gap-1 border-b border-slate-200">
      {[{ id: 'lines' as const, label: 'Bills & line items', icon: ReceiptText }, { id: 'payments' as const, label: 'Payments & refunds', icon: CreditCard }].map(tab => <button key={tab.id} type="button" role="tab" tabIndex={view === tab.id ? 0 : -1} aria-selected={view === tab.id} aria-controls="accounting-panel" id={`accounting-tab-${tab.id}`} onClick={() => changeView(tab.id)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? 'lines' : event.key === 'End' ? 'payments' : view === 'lines' ? 'payments' : 'lines'
        changeView(next)
        document.getElementById(`accounting-tab-${next}`)?.focus()
      }} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${view === tab.id ? 'border-slate-950 text-slate-950' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><tab.icon className="h-4 w-4" />{tab.label}</button>)}
    </div>

    <div id="accounting-panel" role="tabpanel" aria-labelledby={`accounting-tab-${view}`} className="space-y-5">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><SlidersHorizontal className="h-4 w-4" />Filters</h3><button type="button" onClick={clear} className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">Reset filters</button></div>
        <DateRange value={filters.dates} timezone={timezone} onChange={dates => update({ dates })} basis={view === 'lines' ? filters.dateField : 'paid'} basisOptions={view === 'lines' ? [{ value: 'billed', label: 'Bill posted date' }, { value: 'paid', label: 'Payment received date' }] : [{ value: 'paid', label: 'Receipt / refund recorded date' }]} onBasisChange={dateField => update({ dateField })} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr]">
          <EntityPicker label="Person" allLabel="All people" placeholder="Search people" selected={filters.person} query={personQuery} onQuery={setPersonQuery} options={personOptions.data?.members.map(person => ({ id: Number(person.id), label: person.name, detail: `Member #${person.id}` })) ?? []} loading={personOptions.loading || personQuery.trim() !== personSearch} error={personOptions.error} onSelect={person => update({ person })} />
          <EntityPicker label="Class" allLabel="All classes" placeholder="Search classes" selected={filters.classOption} query={classQuery} onQuery={setClassQuery} options={classOptions.data?.classes.map(item => ({ id: Number(item.id), label: item.name, detail: `Class #${item.id}` })) ?? []} loading={classOptions.loading || classQuery.trim() !== classSearch} error={classOptions.error} onSelect={classOption => update({ classOption })} />
          <label className="text-xs font-semibold text-slate-600">{view === 'lines' ? 'Search line items' : 'Search payments'}<span className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${filterInput} !pl-9`} value={filters.search} maxLength={200} onChange={event => update({ search: event.target.value })} placeholder={view === 'lines' ? 'Description, household, person, class, or bill #' : 'Household, reference, or payment #'} /></span></label>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {view === 'lines' ? <><div className="flex flex-wrap gap-2" role="group" aria-label="Bill status">{billStatuses.map(status => <button type="button" key={status.value} aria-pressed={filters.status === status.value} onClick={() => update({ status: status.value })} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${filters.status === status.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>{status.label}</button>)}</div>
            <label className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-500">Unpaid period<select aria-label="Unpaid billing period" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700" value={filters.balancePeriod ?? 'all'} onChange={event => update({ balancePeriod: event.target.value as Filters['balancePeriod'], status: 'all' })}><option value="all">All line items</option><option value="current">Current unpaid</option><option value="upcoming">Upcoming unpaid</option></select></label>
          </> : <>
            <div role="group" aria-label="Payment event type" className="flex flex-wrap gap-2">{[{ value: 'all', label: 'All events' }, { value: 'payment', label: 'Payments' }, { value: 'refund', label: 'Refunds' }].map(kind => <button type="button" key={kind.value} aria-pressed={filters.kind === kind.value} onClick={() => update({ kind: kind.value })} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${filters.kind === kind.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>{kind.label}</button>)}</div>
            <label className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-500">Payment status<select className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700" value={filters.paymentStatus} onChange={event => update({ paymentStatus: event.target.value })}><option value="all">All statuses</option><option value="settled">Settled</option><option value="pending">Pending</option><option value="failed">Failed</option></select></label>
          </>}
        </div>
        <p className="text-xs leading-5 text-slate-500">Dates use {timezone}. {view === 'lines' ? filters.dateField === 'paid' ? 'Matches bills with a settled payment received in the date range, including receipts later reversed. Balances and history remain lifetime totals.' : 'Filters the date a bill was posted. Current balances include all recorded payments and adjustments.' : 'Uses payment receipt dates and refund recorded dates. Cash totals include settled events only.'}</p>
      </div>

      <ErrorNotice message={invalidDates ? 'The From date must be on or before the Through date.' : state.error} onRetry={state.error ? () => setVersion(value => value + 1) : undefined} />
      <ErrorNotice message={exportError} />
      {exported ? <p role="status" className="flex items-center gap-2 text-sm text-emerald-700"><Check className="h-4 w-4" />Filtered CSV exported.</p> : null}
      {loading ? <Loading label="Loading accounting report…" /> : data && !invalidDates ? <>
        {view === 'lines' && lines.data ? <AccountBalanceCards data={lines.data} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-700">{view === 'lines' ? 'Bill totals' : 'Cash movement for matching events'}</h3><p className="text-xs text-slate-500">Across all {data.total.toLocaleString()} filtered {view === 'lines' ? 'line items' : 'events'} · USD</p></div>
        {view === 'lines' && lines.data ? <BillSummaryCards value={lines.data.summary} /> : payments.data ? <PaymentSummaryCards value={payments.data.summary} filtered={hasRelationFilter} /> : null}
        {view === 'payments' && payments.data ? <p className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 text-xs leading-5 text-slate-600">{hasRelationFilter ? 'Receipts and refunds show whole household payments, even when a person or class filter is selected. ' : 'Receipts and refunds show whole household amounts. '}Payments automatically reduce the family’s balance.</p> : null}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4"><div><h3 className="font-semibold text-slate-900">{view === 'lines' ? 'Bills & line items' : 'Payments & refunds'}</h3><p className="mt-1 text-xs text-slate-500">{data.total.toLocaleString()} {view === 'lines' ? 'line items' : 'events'}{data.generatedAt ? ` · Updated ${moment(data.generatedAt, timezone)}` : ''}</p></div><label className="flex items-center gap-2 text-xs text-slate-500">Rows per page<select className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-800" value={filters.pageSize} onChange={event => update({ pageSize: Number(event.target.value) })}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label></div>
          {!data.rows.length ? <div className="p-5"><Empty>No {view === 'lines' ? 'bills' : 'payments or refunds'} match these filters.</Empty><button className={`${button} mt-3`} onClick={clear}>Clear filters</button></div> : view === 'lines' && lines.data ? <BillsTable rows={lines.data.rows} sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={sort} onSelect={row => setSelected({ kind: 'line', id: row.id })} /> : payments.data ? <PaymentsTable rows={payments.data.rows} sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={sort} onSelect={row => setSelected({ kind: row.kind, id: row.id })} /> : null}
          <Pager data={data} onPage={page => update({ page })} />
        </div>
      </> : null}
    </div>
    {selected ? <AccountingDetails selected={selected} timezone={timezone} revision={revision + version} onClose={() => setSelected(null)} onBilling={onBilling} onLine={id => setSelected({ kind: 'line', id })} /> : null}
  </section>
}
