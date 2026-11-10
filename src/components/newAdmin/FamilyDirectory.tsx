import { useState } from 'react'
import { Search } from 'lucide-react'
import { useRead, useSearch, type Page } from './api'
import { button, cell, Empty, ErrorNotice, input, Loading, Pager } from './shared'
interface FamilyRow { id: number; name: string; archived: boolean; peopleCount: number }
export default function FamilyDirectory({ revision, onSelect }: { revision: number; onSelect: (id: number) => void }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [record, setRecord] = useState('active')
  const [retry, setRetry] = useState(0)
  const search = useSearch(query)
  const state = useRead<Page<FamilyRow>>(`/api/admin/new-admin/families?${new URLSearchParams({ search, page: String(page), record })}`, revision + retry)
  return <div className="space-y-4"><div className="flex flex-wrap gap-3"><label className="min-w-60 flex-1 text-sm font-medium"><span className="flex items-center gap-2"><Search className="h-4 w-4" />Search families</span><input className={input} placeholder="Family, person, email, or phone" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} /></label><label className="text-sm font-medium">Records<select className={input} value={record} onChange={e => { setRecord(e.target.value); setPage(1) }}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All records</option></select></label></div><ErrorNotice message={state.error} onRetry={() => setRetry(v => v + 1)} />{state.loading ? <Loading label="Loading families…" /> : state.data ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">{state.data.rows.length ? <table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{['Family', 'Current people', 'Actions'].map(label => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{state.data.rows.map(row => <tr key={row.id}><td className={cell}><button className="font-semibold underline decoration-slate-300 underline-offset-4" onClick={() => onSelect(row.id)}>{row.name}</button><p className="mt-1 text-xs text-slate-500">Family #{row.id}{row.archived ? ' · Archived' : ''}</p></td><td className={cell}>{row.peopleCount}</td><td className={cell}><button className={button} onClick={() => onSelect(row.id)}>Open family</button></td></tr>)}</tbody></table> : <Empty>No families match these filters.</Empty>}<Pager data={state.data} onPage={setPage} /></div> : null}</div>
}
