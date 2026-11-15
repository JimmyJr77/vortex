import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import MemberRecordActions from '../admin/MemberRecordActions'
import ArchivedLogins from './ArchivedLogins'
import { useRead, useSearch, type Page } from './api'
import { button, cell, Empty, ErrorNotice, input, Loading, Pager } from './shared'

type ArchiveView = 'people' | 'families' | 'logins'
interface ArchivedRow {
  id: number
  kind?: 'member' | 'lead'
  name: string
  email?: string | null
  phone?: string | null
  familyName?: string | null
  peopleCount?: number
}

export default function ArchivedCRM({ revision, onBack }: { revision: number; onBack: () => void }) {
  const [view, setView] = useState<ArchiveView>('people')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const search = useSearch(query)
  const refresh = () => { setPage(1); setVersion(value => value + 1) }
  const params = new URLSearchParams({ search, record: 'archived', page: String(page), pageSize: '25' })
  if (view === 'people') params.set('source', 'member,lead')
  const path = view === 'logins' ? null : `/api/admin/new-admin/${view === 'people' ? 'crm' : 'families'}?${params}`
  const state = useRead<Page<ArchivedRow>>(path, revision + version)

  return <section className="space-y-5">
    <button type="button" className={button} onClick={onBack}><ArrowLeft className="h-4 w-4" />Back</button>
    <div><h2 className="text-2xl font-bold">Archived CRM</h2>
      <p className="mt-1 text-sm text-slate-600">Restore archived records to the active lists or permanently delete records that no longer need to be kept.</p></div>
    <div role="group" aria-label="Archive lists" className="flex flex-wrap gap-2">
      {([['people', 'People & leads'], ['families', 'Families'], ['logins', 'Unlinked logins']] as const).map(([id, label]) =>
        <button key={id} type="button" className={button} aria-pressed={view === id} onClick={() => { setView(id); setPage(1); setQuery('') }}>{label}</button>)}
    </div>
    {view === 'logins' ? <ArchivedLogins revision={revision + version} onChanged={refresh} /> : <>
      <label className="block max-w-lg text-sm font-medium">Search archives
        <input type="search" className={input} placeholder="Name, email, phone, or family" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
      </label>
      <ErrorNotice message={state.error} onRetry={refresh} />
      {state.loading ? <Loading label="Loading archives…" /> : state.data ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {state.data.rows.length ? <table className="w-full text-left text-sm" aria-label="Archived CRM records">
          <thead className="bg-slate-100"><tr>{['Name', 'Record type', view === 'families' ? 'People' : 'Contact / family', 'Actions'].map(heading => <th key={heading} scope="col" className={cell}>{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{state.data.rows.map(row => {
            const kind = view === 'families' ? 'family' : row.kind!
            return <tr key={`${kind}-${row.id}`}>
              <td className={cell}><p className="font-semibold">{row.name}</p><p className="text-xs text-slate-500">#{row.id}</p></td>
              <td className={cell}>{kind === 'family' ? 'Family' : kind === 'lead' ? 'Lead' : 'Member account'}</td>
              <td className={cell}>{view === 'families' ? row.peopleCount : <>{row.email || row.phone || 'No contact details'}{row.familyName && <p className="text-slate-500">{row.familyName}</p>}</>}</td>
              <td className={cell}><MemberRecordActions record={{ kind, id: row.id, name: row.name, archived: true }} onChanged={refresh} /></td>
            </tr>
          })}</tbody>
        </table> : <Empty>No archived {view === 'families' ? 'families' : 'people or leads'} match your search.</Empty>}
        <Pager data={state.data} onPage={setPage} />
      </div> : null}
    </>}
  </section>
}
