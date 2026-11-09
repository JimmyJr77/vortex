import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react'
import { amount, day, humanize } from './format'
import type { BillLine, PaymentEvent, SortDirection } from './types'

const td = 'px-4 py-4 align-top'
const numeric = `${td} text-right tabular-nums whitespace-nowrap`
function SortHeading({ label, value, sortBy, sortDir, onSort, right = false }: { label: string; value: string; sortBy: string; sortDir: SortDirection; onSort: (key: string) => void; right?: boolean }) {
  const sorted = value === sortBy
  const Icon = sorted ? sortDir === 'asc' ? ArrowUp : ArrowDown : ArrowUpDown
  return <th scope="col" aria-sort={sorted ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'} className={`px-4 py-3 ${right ? 'text-right' : 'text-left'}`}>
    <button type="button" className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold hover:text-slate-950 ${sorted ? 'text-slate-950' : 'text-slate-500'}`} onClick={() => onSort(value)}>{label}<Icon aria-hidden className="h-3 w-3" /></button>
  </th>
}

export function AccountingStatus({ value }: { value: string }) {
  const color = ['paid', 'settled', 'succeeded'].includes(value) ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : ['partial', 'partially_paid', 'pending'].includes(value) ? 'border-amber-200 bg-amber-50 text-amber-800'
      : ['credit', 'refunded'].includes(value) ? 'border-blue-200 bg-blue-50 text-blue-800'
        : ['failed', 'open', 'unpaid'].includes(value) ? 'border-rose-200 bg-rose-50 text-rose-800'
          : 'border-slate-200 bg-slate-50 text-slate-600'
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}>{humanize(value)}</span>
}

interface SortProps { sortBy: string; sortDir: SortDirection; onSort: (key: string) => void }

export function BillsTable({ rows, onSelect, ...sort }: SortProps & { rows: BillLine[]; onSelect: (row: BillLine) => void }) {
  return <div className="max-h-[65vh] overflow-auto"><table className="w-full min-w-[1120px] text-left text-sm">
    <caption className="sr-only">Filtered bills and line items with current payment allocations and open balances</caption>
    <thead className="sticky top-0 z-10 bg-slate-50"><tr>
      <SortHeading label="Bill date" value="date" {...sort} />
      <SortHeading label="Person / account" value="person" {...sort} />
      <SortHeading label="Class / line item" value="class" {...sort} />
      <SortHeading label="Billed" value="billed" right {...sort} />
      <SortHeading label="Paid" value="paid" right {...sort} />
      <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Credit applied</th>
      <SortHeading label="Open" value="balance" right {...sort} />
      <th scope="col" className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
      <th scope="col"><span className="sr-only">Actions</span></th>
    </tr></thead>
    <tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.id} className="hover:bg-slate-50/70">
      <td className={`${td} whitespace-nowrap text-slate-600`}>{day(row.billedDate)}<p className="mt-1 text-xs text-slate-400">Line #{row.id}</p></td>
      <td className={td}><p className="font-medium text-slate-900">{row.memberName || 'Household'}</p><p className="mt-1 text-xs text-slate-500">{row.familyName || `Account #${row.accountId}`}</p></td>
      <td className={`${td} max-w-xs`}><button type="button" className="text-left font-medium leading-5 text-slate-950 hover:underline" onClick={() => onSelect(row)}>{row.description}</button>{row.className && row.className !== row.description ? <p className="mt-1 text-xs text-slate-500">{row.className}</p> : null}<p className="mt-1 text-xs text-slate-400">{humanize(row.chargeType)}{row.ledgerRetired ? ' · Historical ledger' : ''}</p></td>
      <td className={`${numeric} font-medium text-slate-950`}>{amount(row.amountCents, row.currency)}</td>
      <td className={`${numeric} text-slate-700`}>{amount(row.paidCents, row.currency)}{row.lastPaidDate ? <p className="mt-1 text-[11px] text-slate-400">Last {day(row.lastPaidDate)}</p> : null}</td>
      <td className={`${numeric} text-slate-500`}>{amount(row.creditAppliedCents, row.currency)}</td>
      <td className={`${numeric} font-semibold ${row.openCents > 0 ? 'text-amber-800' : 'text-slate-500'}`}>{amount(row.openCents, row.currency)}</td>
      <td className={td}><AccountingStatus value={row.status} /></td>
      <td className={`${td} text-right`}><button type="button" aria-label={`View bill line ${row.id}`} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400" onClick={() => onSelect(row)}>Details<ChevronRight className="h-3 w-3" /></button></td>
    </tr>)}</tbody>
  </table></div>
}

export function PaymentsTable({ rows, filtered, onSelect, ...sort }: SortProps & { rows: PaymentEvent[]; filtered: boolean; onSelect: (row: PaymentEvent) => void }) {
  return <div className="max-h-[65vh] overflow-auto"><table className="w-full min-w-[1000px] text-left text-sm">
    <caption className="sr-only">Filtered payments and refunds with whole receipt amounts and allocations to matching bills</caption>
    <thead className="sticky top-0 z-10 bg-slate-50"><tr>
      <SortHeading label="Receipt / refund recorded" value="date" {...sort} />
      <SortHeading label="Household account" value="person" {...sort} />
      <th scope="col" className="px-4 py-3 text-xs font-semibold text-slate-500">Type / method</th>
      <SortHeading label="Whole event" value="amount" right {...sort} />
      <SortHeading label={filtered ? 'Applied to filter' : 'Applied to bills'} value="applied" right {...sort} />
      <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Unapplied</th>
      <th scope="col" className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
      <th scope="col"><span className="sr-only">Actions</span></th>
    </tr></thead>
    <tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={`${row.kind}-${row.id}`} className="hover:bg-slate-50/70">
      <td className={`${td} whitespace-nowrap text-slate-600`}>{day(row.occurredDate)}<p className="mt-1 text-xs text-slate-400">{humanize(row.kind)} #{row.id}</p></td>
      <td className={`${td} max-w-xs`}><button type="button" onClick={() => onSelect(row)} className="text-left font-medium text-slate-950 hover:underline">{row.familyName || `Account #${row.accountId}`}</button><p className="mt-1 break-all text-xs text-slate-400">{row.reference || `Account #${row.accountId}`}</p></td>
      <td className={td}><p className="font-medium text-slate-700">{humanize(row.kind)}</p><p className="mt-1 text-xs text-slate-500">{humanize(row.method)}</p></td>
      <td className={`${numeric} font-semibold ${row.kind === 'refund' ? 'text-rose-700' : 'text-slate-950'}`}>{amount(row.signedAmountCents)}</td>
      <td className={`${numeric} text-slate-700`}>{amount(row.filteredAppliedCents)}</td>
      <td className={`${numeric} text-slate-500`}>{row.kind === 'payment' ? amount(row.unappliedCents) : '—'}</td>
      <td className={td}><AccountingStatus value={row.status} />{!row.settled ? <p className="mt-1 max-w-24 text-[11px] text-slate-400">Excluded from cash totals</p> : null}</td>
      <td className={`${td} text-right`}><button type="button" aria-label={`View ${row.kind} ${row.id}`} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400" onClick={() => onSelect(row)}>Details<ChevronRight className="h-3 w-3" /></button></td>
    </tr>)}</tbody>
  </table></div>
}
