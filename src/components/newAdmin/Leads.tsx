import { useState, type FormEvent } from 'react'
import { Plus, Search } from 'lucide-react'
import { button, cell, Dialog, Empty, ErrorNotice, input, Loading, Pager, primary, Status } from './shared'
import { allowed, request, useRead, useSearch, type Access, type Page } from './api'

interface Lead { id: number; firstName: string; lastName: string; email: string; phone: string | null; status: string; notes: string | null; convertedMemberId: number | null; createdAt: string }
const statuses = ['new', 'contacted', 'qualified', 'closed']
export default function Leads({ access, revision, onMember }: { access: Access; revision: number; onMember: (id: number) => void }) {
  const [query, setQuery] = useState('')
  const search = useSearch(query)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const [edit, setEdit] = useState<Lead | 'new' | null>(null)
  const [convert, setConvert] = useState<Lead | null>(null)
  const canManage = allowed(access, 'members.edit')
  const data = useRead<Page<Lead>>(`/api/admin/new-admin/leads?${new URLSearchParams({ search, status, page: String(page), pageSize: '25' })}`, revision + version)
  const refresh = () => setVersion(value => value + 1)
  return <section>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Leads</h2><p className="mt-1 text-sm text-slate-500">Follow up with prospective families and connect them to a member account.</p></div>{canManage ? <button className={primary} onClick={() => setEdit('new')}><Plus className="h-4 w-4" />Add lead</button> : null}</div>
    <div className="mb-4 flex flex-wrap gap-3"><label className="min-w-64 flex-1 text-sm font-medium"><span className="flex items-center gap-2"><Search className="h-4 w-4" />Search leads</span><input className={input} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Name, email, or phone" /></label><label className="text-sm font-medium">Status<select className={input} value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">All statuses</option>{[...statuses, 'converted'].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
    <ErrorNotice message={data.error} onRetry={refresh} />
    {data.loading ? <Loading label="Loading leads…" /> : data.data ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">{data.data.rows.length ? <table className="w-full text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr>{['Name', 'Contact', 'Status', 'Notes', 'Actions'].map(title => <th key={title} className={cell}>{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.data.rows.map(lead => <tr key={lead.id}><td className={cell}><strong>{lead.firstName} {lead.lastName}</strong><p className="mt-1 text-xs text-slate-500">Lead #{lead.id}</p></td><td className={cell}>{lead.email}<p className="text-slate-500">{lead.phone || 'No phone'}</p></td><td className={cell}><Status value={lead.status} /></td><td className={`${cell} max-w-64 whitespace-pre-wrap`}>{lead.notes || '—'}</td><td className={cell}><div className="flex flex-wrap gap-2">{canManage ? <button className={button} onClick={() => setEdit(lead)}>Edit</button> : null}{lead.convertedMemberId ? <button className={button} onClick={() => onMember(lead.convertedMemberId!)}>View member</button> : canManage ? <button className={button} onClick={() => setConvert(lead)}>Convert</button> : null}</div></td></tr>)}</tbody></table> : <Empty>No leads match these filters.</Empty>}<Pager data={data.data} onPage={setPage} /></div> : null}
    {edit ? <LeadEditor lead={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh() }} /> : null}
    {convert ? <ConvertLead lead={convert} onClose={() => setConvert(null)} onConverted={id => { setConvert(null); refresh(); onMember(id) }} /> : null}
  </section>
}

function LeadEditor({ lead, onClose, onSaved }: { lead: Lead | null; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState({ firstName: lead?.firstName ?? '', lastName: lead?.lastName ?? '', email: lead?.email ?? '', phone: lead?.phone ?? '', status: lead?.status ?? 'new', notes: lead?.notes ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null)
    try { await request(`/api/admin/new-admin/leads${lead ? `/${lead.id}` : ''}`, { method: lead ? 'PATCH' : 'POST', body: JSON.stringify({ ...draft, status: lead?.status === 'converted' ? undefined : draft.status }) }); onSaved() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save lead.') }
    finally { setBusy(false) }
  }
  return <Dialog title={lead ? 'Edit lead' : 'Add lead'} onClose={onClose}><form onSubmit={save} className="max-w-2xl space-y-4"><ErrorNotice message={error} /><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">{(['firstName', 'lastName', 'email', 'phone'] as const).map(key => <label key={key} className="text-sm font-medium">{{ firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone' }[key]}<input className={input} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} required={key !== 'phone'} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}<label className="text-sm font-medium">Status<select className={input} disabled={lead?.status === 'converted'} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}>{[...statuses, ...(lead?.status === 'converted' ? ['converted'] : [])].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-medium sm:col-span-2">Staff notes<textarea className={input} rows={4} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label></fieldset><button disabled={busy} className={primary}>{busy ? 'Saving…' : 'Save lead'}</button></form></Dialog>
}

function ConvertLead({ lead, onClose, onConverted }: { lead: Lead; onClose: () => void; onConverted: (id: number) => void }) {
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [memberId, setMemberId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const convert = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      const result = await request<{ memberId: number }>(`/api/admin/new-admin/leads/${lead.id}/convert`, { method: 'POST', body: JSON.stringify(mode === 'existing' ? { memberId: Number(memberId) } : { firstName: lead.firstName, lastName: lead.lastName, email: lead.email, phone: lead.phone, dateOfBirth }) })
      onConverted(result.memberId)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to convert lead.') }
    finally { setBusy(false) }
  }
  return <Dialog title={`Convert ${lead.firstName} ${lead.lastName}`} onClose={onClose}><form onSubmit={convert} className="max-w-xl space-y-4"><p className="text-sm text-slate-600">Create an adult account for the inquiring guardian, or link a member you have verified. Add children through the family account editor.</p><ErrorNotice message={error} /><label className="block text-sm font-medium">Conversion<select disabled={busy} className={input} value={mode} onChange={event => setMode(event.target.value as 'new' | 'existing')}><option value="new">Create adult account</option><option value="existing">Link verified existing member</option></select></label>{mode === 'new' ? <label className="block text-sm font-medium">Adult date of birth<input disabled={busy} className={input} type="date" required value={dateOfBirth} onChange={event => setDateOfBirth(event.target.value)} /><span className="mt-1 block text-xs text-slate-500">The new household payer must be at least 18 years old.</span></label> : <label className="block text-sm font-medium">Verified member ID<input disabled={busy} className={input} type="number" min="1" step="1" required value={memberId} onChange={event => setMemberId(event.target.value)} /></label>}<button disabled={busy} className={primary}>{busy ? 'Converting…' : 'Convert lead'}</button></form></Dialog>
}
