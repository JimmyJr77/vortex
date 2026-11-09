import { useState } from 'react'
import { useRead, type Page } from './api'
import { cell, Empty, ErrorNotice, Loading, Pager } from './shared'
import { amount } from './accounting/format'

interface HistoryRow { id: number; kind: string; sourceId: string; date: string | null; amountCents: number | null; data: Record<string, unknown> }
interface HistoryPage extends Page<HistoryRow> { summary: { transactions: number; enrollments: number; receiptsCents: number; refundsCents: number; netCashCents: number; unresolved: number } }

export default function JackrabbitHistory({ memberId, familyId, revision = 0, from = '', through = '' }: { memberId?: number; familyId?: number; revision?: number; from?: string; through?: string }) {
  const [page,setPage] = useState(1)
  const query = new URLSearchParams({page:String(page),pageSize:'25'})
  if(memberId)query.set('memberId',String(memberId))
  if(familyId)query.set('familyId',String(familyId))
  if(from)query.set('from',from)
  if(through)query.set('through',through)
  const data=useRead<HistoryPage>(`/api/admin/jackrabbit-history?${query}`,revision)
  const summary=data.data?.summary
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" aria-label="Jackrabbit history">
    <div><h3 className="font-bold">Jackrabbit history</h3><p className="mt-1 text-sm text-slate-500">Historical payments and class registrations from Jackrabbit. Amounts retain their original signs and do not change your current Vortex balance.</p></div>
    <ErrorNotice message={data.error} />
    {data.loading?<Loading label="Loading Jackrabbit history…"/>:null}
    {summary?<><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      [memberId?'Household payments':'Payments received',amount(summary.receiptsCents)],[memberId?'Household refunds':'Refunds returned',amount(summary.refundsCents)],['Net cash received',amount(summary.netCashCents)],['Registrations',String(summary.enrollments)],
    ].map(([label,value])=><div key={label} className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></div>)}</div>
    <p className="text-xs text-slate-500">{summary.transactions} historical transactions · {summary.enrollments} registrations · {from||'All dates'}{through?` through ${through}`:''}</p>
    {summary.unresolved?<p className="text-sm text-amber-800">{summary.unresolved} archived registration records await account matching.</p>:null}
    {data.data?.rows.length?<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Date','Family / person','History','Amount'].map(title=><th key={title} className={cell}>{title}</th>)}</tr></thead><tbody>{data.data.rows.map(row=><tr key={row.id} className="border-t border-slate-100"><td className={cell}>{row.date?.slice(0,10)||'—'}</td><td className={cell}>{String(row.data.Student||row.data['Student First']||row.data['Family/Acct']||'Household')} {row.kind==='enrollment'?String(row.data['Student Last']||''):''}<p className="text-xs text-slate-500">{String(row.data['Family/Acct']||'')}</p></td><td className={cell}><span className="font-semibold">{String(row.data.Type||row.kind)}</span><p>{String(row.data.Activity||row.data.Class||'')}</p>{row.data['Drop Date']?<p>Ended {String(row.data['Drop Date'])}</p>:null}{row.data.Note?<p className="text-slate-500">{String(row.data.Note)}</p>:null}<details className="mt-1 text-xs"><summary className="cursor-pointer text-slate-500">Original Jackrabbit record</summary><dl className="mt-2 grid gap-1">{Object.entries(row.data).filter(([,v])=>v!=null).map(([key,value])=><div key={key}><dt className="inline font-semibold">{key}: </dt><dd className="inline whitespace-pre-wrap">{typeof value === 'object' ? JSON.stringify(value,null,2) : String(value)}</dd></div>)}</dl></details></td><td className={`${cell} tabular-nums`}>{row.amountCents==null?'—':amount(row.amountCents)}</td></tr>)}</tbody></table></div>:<Empty>No Jackrabbit history found.</Empty>}
    {data.data?<Pager data={data.data} onPage={setPage}/>:null}</>:null}
  </section>
}
