import { useState } from 'react'
import { Search } from 'lucide-react'
import MemberRecordActions from '../admin/MemberRecordActions'
import { allowed, useRead, useSearch, type Access, type Page } from './api'
import { button, cell, Empty, ErrorNotice, input, Loading, Pager } from './shared'
import { AccountStatusFilters, ActiveStatusTag, EnrollmentTag } from './AccountStatusTags'

interface FamilyRow { id: number; name: string; active: boolean; enrolled: boolean; archived: boolean; peopleCount: number }
export default function FamilyDirectory({ access, revision, onSelect }: { access: Access; revision: number; onSelect: (id: number) => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState('')
  const [enrolled, setEnrolled] = useState('')
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const search = useSearch(query)
  const state = useRead<Page<FamilyRow>>(`/api/admin/new-admin/families?${new URLSearchParams({ search, active, enrolled, page: String(page), record: 'active' })}`, revision + retry)
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <label className="min-w-60 flex-1 text-sm font-medium"><span className="flex items-center gap-2"><Search className="h-4 w-4" />Search families</span><input className={input} placeholder="Family, person, email, or phone" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} /></label>
      <AccountStatusFilters active={active} enrolled={enrolled} onActiveChange={value => { setActive(value); setPage(1) }} onEnrolledChange={value => { setEnrolled(value); setPage(1) }} />
    </div>
    <p className="text-xs text-slate-500">A family is active when a child has a current annual membership or a confirmed or attended paid drop-in in the past two months. Enrolled means at least one student has a current class enrollment.</p>
    <ErrorNotice message={state.error} onRetry={() => setRetry(value => value + 1)} />
    {state.loading ? <Loading label="Loading families…" /> : state.data ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      {state.data.rows.length ? <table className="w-full text-left text-sm" aria-label="Families">
        <thead className="bg-slate-100"><tr>{['Family', 'Current people', 'Active status', 'Enrollment', 'Actions'].map(label => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{state.data.rows.map(row => <tr key={row.id}>
          <td className={cell}><button className="font-semibold underline decoration-slate-300 underline-offset-4" onClick={() => onSelect(row.id)}>{row.name}</button><p className="mt-1 text-xs text-slate-500">Family #{row.id}{row.archived ? ' · Archived' : ''}</p></td>
          <td className={cell}>{row.peopleCount}</td><td className={cell}><ActiveStatusTag active={row.active} /></td><td className={cell}><EnrollmentTag enrolled={row.enrolled} /></td>
          <td className={cell}><div className="flex flex-wrap items-start gap-2"><button className={button} onClick={() => onSelect(row.id)}>Open family</button>{allowed(access, 'accounts.lifecycle') ? <MemberRecordActions record={{ kind: 'family', id: row.id, name: row.name, archived: row.archived }} onChanged={() => setRetry(value => value + 1)} /> : null}</div></td>
        </tr>)}</tbody>
      </table> : <Empty>No families match these filters.</Empty>}
      <Pager data={state.data} onPage={setPage} />
    </div> : null}
  </div>
}
