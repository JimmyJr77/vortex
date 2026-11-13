import { formatPhoneForDisplay } from '../../utils/phoneUtils'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { button, cell, Dialog, Empty, ErrorNotice, Loading, Pager, primary, Status } from './shared'
import AccountNotes from './AccountNotes'
import LeadFilters, { type LeadFilterValues } from './LeadFilters'
import { InquiryInformation, KidDetails, LeadFields } from './LeadInquiry'
import ConvertLead from './ConvertLead'
import type { Lead } from './leadTypes'
import { allowed, request, useRead, useSearch, type Access, type Page } from './api'

const emptyFilters: LeadFilterValues = { contacted: '', followUp: '', ageMin: '', ageMax: '', gender: '' }
export default function Leads({ access, revision, onOpenMember }: { access: Access; revision: number; onOpenMember: (id: number) => void }) {
  const [query, setQuery] = useState('')
  const search = useSearch(query)
  const [keywords, setKeywords] = useState('')
  const keywordSearch = useSearch(keywords)
  const [filters, setFilters] = useState<LeadFilterValues>(emptyFilters)
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const [adding, setAdding] = useState(false)
  const [notes, setNotes] = useState<Lead | null>(null)
  const [saving, setSaving] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [convert, setConvert] = useState<Lead | null>(null)
  const canManage = allowed(access, 'members.edit')
  const invalidAge = (filters.ageMin !== '' && filters.ageMax !== '' && Number(filters.ageMin) > Number(filters.ageMax))
    || [filters.ageMin, filters.ageMax].some(value => value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 120))
  const data = useRead<Page<Lead>>(invalidAge ? null : `/api/admin/new-admin/leads?${new URLSearchParams({ search, keywords: keywordSearch, ...filters, page: String(page), pageSize: '25' })}`, revision + version)
  const refresh = () => setVersion(value => value + 1)
  const flag = async (lead: Lead, body: { contacted?: boolean; followUp?: boolean }) => {
    setSaving(lead.id); setSaveError(null)
    try { await request(`/api/admin/new-admin/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(body) }); refresh() }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Unable to update lead.') }
    finally { setSaving(null) }
  }
  return <section>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Leads</h2><p className="mt-1 text-sm text-slate-500">Follow up on inquiries from prospective families and current members.</p></div>{canManage ? <button className={primary} onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add lead</button> : null}</div>
    <LeadFilters value={filters} onChange={patch => { setFilters(current => ({ ...current, ...patch })); setPage(1) }} search={query} onSearch={value => { setQuery(value); setPage(1) }} keywords={keywords} onKeywords={value => { setKeywords(value); setPage(1) }} onReset={() => { setFilters(emptyFilters); setQuery(''); setKeywords(''); setPage(1) }} />
    <ErrorNotice message={invalidAge ? 'Enter whole child ages from 0 to 120, with minimum age no greater than maximum age.' : null} />
    <ErrorNotice message={saveError} />
    <ErrorNotice message={data.error} onRetry={refresh} />
    {data.loading ? <Loading label="Loading leads…" /> : data.data ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">{data.data.rows.length ? <table className="w-full text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr>{['Contacted', 'Follow-up', 'Name', 'Contact', 'Status', 'Kid details', 'Actions'].map(title => <th key={title} className={cell}>{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.data.rows.map(lead => <tr key={lead.id}>
      <td className={cell}><input type="checkbox" aria-label={`Contacted ${lead.firstName} ${lead.lastName}`} checked={lead.contacted} disabled={!canManage || saving !== null} onChange={event => void flag(lead, { contacted: event.target.checked })} /></td>
      <td className={cell}><input type="checkbox" aria-label={`Follow up ${lead.firstName} ${lead.lastName}`} checked={lead.followUp} disabled={!canManage || saving !== null} onChange={event => void flag(lead, { followUp: event.target.checked })} /></td>
      <td className={cell}>
        <button className="font-semibold underline decoration-slate-300 underline-offset-4" onClick={() => setNotes(lead)}>{lead.firstName} {lead.lastName}</button>
        <p className="mt-1 text-xs text-slate-500">{lead.matchedMemberId ? 'Member inquiry' : 'Lead'} #{lead.id}</p>
      </td>
      <td className={cell}>{lead.email}<p className="text-slate-500">{formatPhoneForDisplay(lead.phone) || 'No phone'}</p></td>
      <td className={cell}><Status value={lead.status} />{lead.invitation && <p className="mt-1 text-xs text-slate-500">Registration invitation {lead.invitation.status}</p>}</td>
      <td className={cell}><KidDetails children={lead.inquiry?.campers || []} /></td>
      <td className={cell}><div className="flex flex-wrap gap-2">
        <button className={button} onClick={() => setNotes(lead)}>Notes</button>
        {lead.matchedMemberId ? <button className={button} onClick={() => onOpenMember(Number(lead.matchedMemberId))}>Open member</button> : null}
        {canManage && (lead.invitation || !lead.matchedMemberId) ? <button className={button} onClick={() => setConvert(lead)}>{lead.invitation ? 'Registration invitation' : 'Convert'}</button> : null}
      </div></td></tr>)}</tbody></table> : <Empty>No inquiries match these filters.</Empty>}<Pager data={data.data} onPage={setPage} /></div> : null}
    {adding ? <Dialog title="Add lead" onClose={() => setAdding(false)}><LeadFields lead={null} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); refresh() }} /></Dialog> : null}
    {notes ? <LeadNotesDialog lead={notes} revision={revision + version} canManage={canManage} onClose={() => setNotes(null)} onSaved={lead => { setNotes(lead); refresh() }} /> : null}
    {convert ? <ConvertLead lead={convert} access={access} onClose={() => setConvert(null)} onSent={refresh} /> : null}
  </section>
}


function LeadNotesDialog({ lead, revision, canManage, onClose, onSaved }: { lead: Lead; revision: number; canManage: boolean; onClose: () => void; onSaved: (lead: Lead) => void }) {
  const [editing, setEditing] = useState(false)
  return <Dialog title={`Notes · ${lead.firstName} ${lead.lastName}`} onClose={onClose}><div className="grid h-[72vh] min-h-0 grid-rows-[minmax(0,0.8fr)_minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(260px,1fr)_minmax(0,1.6fr)] lg:grid-rows-1">
    <aside className="min-h-0 overflow-y-auto rounded-xl border bg-slate-50 p-4" aria-label="Lead information"><details open><summary className="cursor-pointer font-semibold">{lead.matchedMemberId ? 'Member inquiry information' : 'Lead form information'}</summary><div className="mt-4">{editing ? <LeadFields lead={lead} onCancel={() => setEditing(false)} onSaved={saved => { setEditing(false); onSaved(saved) }} /> : <><InquiryInformation lead={lead} />{canManage && <button className={`${button} mt-4`} onClick={() => setEditing(true)}>{lead.matchedMemberId ? 'Edit inquiry information' : 'Edit lead information'}</button>}</>}</div></details></aside>
    <div className="min-h-0 overflow-y-auto pr-2" role="region" aria-label="Scrollable account notes" tabIndex={0}><AccountNotes endpoint={`/api/admin/new-admin/leads/${lead.id}/notes`} revision={revision} canManage={canManage} subjectType="registration" subjectId={lead.id} /></div>
  </div></Dialog>
}
