import { useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import { calculateDropInPrice } from '../../../backend/shared/dropInPricing.js'
import { request, useRead, useSearch, type Page } from '../newAdmin/api'
import ClassPriceFields from '../newAdmin/ClassPriceFields'
import { button, cell, Dialog, Empty, ErrorNotice, input, Loading, Pager, primary, Status } from '../newAdmin/shared'
import PricingBenefitSelectionField from './PricingBenefitSelectionField'

const AdditionalFees = lazyWithRetry(() => import('./AdminAdditionalFeesPanel'))

interface ClassPrice { id: number; formId: number | null; programsId: number | null; name: string; programName: string; isActive: boolean; monthlyPriceCents: number | null; costAmountCents: number; costUnit: string }
const money = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const columns = [{ key: 'program', label: 'Program' }, { key: 'class', label: 'Class' }, { key: 'cost', label: 'Class Cost' }, { key: 'status', label: 'Status' }] as const

export default function ClassCosts({ canManage, revision = 0 }: { canManage: boolean; revision?: number }) {
  const [query, setQuery] = useState('')
  const search = useSearch(query)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('class')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState<ClassPrice | null>(null)
  const [benefits, setBenefits] = useState<ClassPrice | null>(null)
  const [feesOpen, setFeesOpen] = useState(false)
  const data = useRead<Page<ClassPrice>>(`/api/admin/new-admin/pricing/classes?${new URLSearchParams({ search, page: String(page), sort, direction })}`, revision + version)
  const sortBy = (key: string) => { setDirection(sort === key && direction === 'asc' ? 'desc' : 'asc'); setSort(key); setPage(1) }
  return <div className="space-y-4">
    <label className="block max-w-md text-sm font-medium">Search classes<input className={input} type="search" placeholder="Class or program name" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} /></label>
    <ErrorNotice message={data.error} onRetry={() => setVersion(value => value + 1)} />
    {data.loading ? <Loading label="Loading class prices…" /> : data.data ? <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {data.data.rows.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{columns.map(column => <th key={column.key} scope="col" className={cell} aria-sort={sort === column.key ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="inline-flex items-center gap-1 whitespace-nowrap font-semibold uppercase" onClick={() => sortBy(column.key)}>{column.label}{sort === column.key ? direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}</button></th>)}<th scope="col" className={cell}>Default drop-in</th>{canManage ? <th scope="col" className={cell}>Actions</th> : null}</tr></thead><tbody className="divide-y divide-slate-100">{data.data.rows.map(row => <tr key={row.id}>
        <td className={cell}>{row.programName || 'Unassigned'}</td><td className={`${cell} font-semibold`}>{row.name}</td><td className={`${cell} whitespace-nowrap`}>{money(row.costAmountCents)} / {row.costUnit.replace('per_', '')}</td><td className={cell}><Status value={row.isActive ? 'active' : 'inactive'} /></td><td className={`${cell} whitespace-nowrap`}>{row.monthlyPriceCents == null ? '—' : money(calculateDropInPrice({ monthlyCents: row.monthlyPriceCents, annualMember: false }).baseCents)}</td>
        {canManage ? <td className={cell}><div className="flex flex-wrap gap-2"><button className={button} aria-label={`Edit price: ${row.name}`} onClick={() => setEditing(row)}>Edit price</button>{row.formId ? <button className={button} aria-label={`Discounts and codes: ${row.name}`} onClick={() => setBenefits(row)}>Discounts & codes</button> : null}</div></td> : null}
      </tr>)}</tbody></table></div> : <Empty>No classes match this search.</Empty>}
      <Pager data={data.data} onPage={setPage} />
    </div> : null}
    <p className="text-xs text-slate-500">Prices are shared with Create/Edit Class and Classes & schedules. Default drop-in is monthly ÷ 3; annual members use monthly ÷ 4.</p>
    <button className={button} aria-expanded={feesOpen} onClick={() => setFeesOpen(value => !value)}>{feesOpen ? 'Hide' : 'Show'} additional fees</button>
    {feesOpen ? <AdditionalFees canManage={canManage} /> : null}
    {editing ? <PriceEditor row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setVersion(value => value + 1) }} /> : null}
    {benefits ? <Dialog title={`Discounts & codes · ${benefits.name}`} onClose={() => setBenefits(null)}><div className="space-y-4">
      {benefits.formId ? <PricingBenefitSelectionField scopeLevel="class" scopeRefId={benefits.formId} includeFreePasses={false} title="Class discounts & promo codes" /> : null}
      {benefits.programsId ? <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-semibold">Shared discounts for {benefits.programName}</summary><div className="mt-3"><PricingBenefitSelectionField scopeLevel="program" scopeRefId={benefits.programsId} includeFreePasses={false} title="Program discounts & promo codes" description="These benefits apply to classes in this program. Class prices are set separately." /></div></details> : null}
    </div></Dialog> : null}
  </div>
}


function PriceEditor({ row, onClose, onSaved }: { row: ClassPrice; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(row.monthlyPriceCents == null ? '' : (row.monthlyPriceCents / 100).toFixed(2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      if (value === '') throw new Error('Enter a monthly price.')
      await request(`/api/admin/new-admin/pricing/classes/${row.id}`, { method: 'PATCH', body: JSON.stringify({ monthlyPriceCents: Math.round(Number(value) * 100) }) })
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save price.') }
    finally { setBusy(false) }
  }
  return <Dialog title={`Edit price · ${row.name}`} onClose={() => { if (!busy) onClose() }}><form className="space-y-4" onSubmit={event => void save(event)}><ErrorNotice message={error} /><ClassPriceFields value={value} onChange={setValue} legacyUnit={row.costUnit !== 'per_month' ? row.costUnit : undefined} /><div className="flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={onClose}>Cancel</button><button className={primary} disabled={busy}>{busy ? 'Saving…' : 'Save price'}</button></div></form></Dialog>
}
