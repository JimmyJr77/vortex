import { useState } from 'react'
import MemberRecordActions from '../admin/MemberRecordActions'
import { useRead } from './api'
import { cell, Empty, ErrorNotice, input, Loading } from './shared'

interface ArchivedLogin {
  id: number
  fullName: string
  email: string | null
  username: string | null
}

export default function ArchivedLogins({ revision, onChanged }: { revision: number; onChanged: () => void }) {
  const [search, setSearch] = useState('')
  const state = useRead<ArchivedLogin[]>('/api/admin/access/users?scope=archived-logins', revision)
  const query = search.trim().toLowerCase()
  const matches = state.data?.filter(login => [login.fullName, login.email, login.username].some(value => value?.toLowerCase().includes(query))) ?? []

  return <div className="space-y-4">
    <p className="text-sm text-slate-600">Inactive logins with no linked member record.</p>
    <label className="block max-w-md text-sm font-medium">Search archived logins
      <input className={input} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, or username" />
    </label>
    <ErrorNotice message={state.error} onRetry={onChanged} />
    {state.loading ? <Loading label="Loading archived logins…" /> : state.data && (matches.length ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-100"><tr>{['Name', 'Email', 'Username', 'Actions'].map(heading => <th key={heading} scope="col" className={cell}>{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{matches.map(login => <tr key={login.id}>
          <td className={cell}>{login.fullName || `Login #${login.id}`}</td>
          <td className={cell}>{login.email || '—'}</td>
          <td className={cell}>{login.username || '—'}</td>
          <td className={cell}><MemberRecordActions record={{ kind: 'login', id: login.id, name: login.fullName || login.email || login.username || `Login #${login.id}` }} onChanged={onChanged} /></td>
        </tr>)}</tbody>
      </table>
    </div> : <Empty>No archived logins match your search.</Empty>)}
  </div>
}
