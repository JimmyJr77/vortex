import MemberRecordActions from '../admin/MemberRecordActions'
import { formatPhoneForDisplay } from '../../utils/phoneUtils'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { button, Dialog, Empty, ErrorNotice, Loading, Pager, primary, Status } from './shared'
import AccountNotes from './AccountNotes'
import LeadFilters, { type LeadFilterValues } from './LeadFilters'
import { AcquisitionDetails, InquiryInformation, KidDetails, LeadFields } from './LeadInquiry'
import ConvertLead from './ConvertLead'
import TrialLead from './TrialLead'
import { leadDisplayName, type Lead } from './leadTypes'
import { formatDateShort } from '../../utils/dateUtils'
import { allowed, request, useRead, useSearch, type Access, type Page } from './api'

const checkboxCell = 'whitespace-nowrap px-0.5 py-3 text-center align-top'
const cell = 'px-2.5 py-3 text-left align-top'
const inquiryDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const emptyFilters: LeadFilterValues = { contacted: '', followUp: '', ageMin: '', ageMax: '', gender: '' }
export default function Leads({ access, revision, onOpenMember }: { access: Access; revision: number; onOpenMember: (id: number) => void }) {
  const [query, setQuery] = useState('')
  const search = useSearch(query)
  const [keywords, setKeywords] = useState('')
  const keywordSearch = useSearch(keywords)
  const [filters, setFilters] = useState<LeadFilterValues>(emptyFilters)
  const [includeMembers, setIncludeMembers] = useState(false)
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const [adding, setAdding] = useState(false)
  const [notes, setNotes] = useState<Lead | null>(null)
  const [saving, setSaving] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [convert, setConvert] = useState<Lead | null>(null)
  const [trial, setTrial] = useState<Lead | null>(null)
  const canManage = allowed(access, 'members.edit')
  const invalidAge = (filters.ageMin !== '' && filters.ageMax !== '' && Number(filters.ageMin) > Number(filters.ageMax))
    || [filters.ageMin, filters.ageMax].some(value => value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 120))
  const data = useRead<Page<Lead>>(invalidAge ? null : `/api/admin/new-admin/leads?${new URLSearchParams({ search, archived: 'false', keywords: keywordSearch, ...filters, includeMembers: String(includeMembers), page: String(page), pageSize: '25' })}`, revision + version)
  const refresh = () => setVersion(value => value + 1)
  const flag = async (lead: Lead, body: { contacted?: boolean; followUp?: boolean }) => {
    setSaving(lead.id); setSaveError(null)
    try { await request(`/api/admin/new-admin/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(body) }); refresh() }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Unable to update lead.') }
    finally { setSaving(null) }
  }
  return <section>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Leads</h2><p className="mt-1 text-sm text-slate-500">Follow up on inquiries from prospective families.</p></div><div className="flex flex-wrap items-center gap-2">
      <button type="button" className={button} aria-pressed={includeMembers} onClick={() => { setIncludeMembers(value => !value); setPage(1) }}>{includeMembers ? 'Hide active and converted members' : 'Show active and converted members'}</button>
      {canManage ? <button className={primary} onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add lead</button> : null}
    </div></div>
    <LeadFilters value={filters} onChange={patch => { setFilters(current => ({ ...current, ...patch })); setPage(1) }} search={query} onSearch={value => { setQuery(value); setPage(1) }} keywords={keywords} onKeywords={value => { setKeywords(value); setPage(1) }} onReset={() => { setFilters(emptyFilters); setQuery(''); setKeywords(''); setIncludeMembers(false); setPage(1) }} />
    <ErrorNotice message={invalidAge ? 'Enter whole child ages from 0 to 120, with minimum age no greater than maximum age.' : null} />
    <ErrorNotice message={saveError} />
    <ErrorNotice message={data.error} onRetry={refresh} />
    {data.loading ? <Loading label="Loading leads…" /> : data.data ? <div className="rounded-xl border border-slate-200 bg-white">
      {data.data.rows.length ? <div className="overflow-x-auto rounded-t-xl">
        <table className="w-full min-w-[100rem] table-fixed text-sm">
          <colgroup>
            <col span={2} className="w-[4.25rem]" />
            <col className="w-[15%]" />
            <col className="w-[19%]" />
            <col className="w-28" />
            <col />
            <col className="w-32" />
            <col className="w-64" />
            <col className="w-96" />
          </colgroup>
          <thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr>
            <th scope="col" className={`${checkboxCell} !text-[10px]`}>Contacted</th>
            <th scope="col" className={`${checkboxCell} !text-[10px]`}>Follow-up</th>
            <th scope="col" className={cell}>Name</th>
            <th scope="col" className={cell}>Contact</th>
            <th scope="col" className={cell}>Status</th>
            <th scope="col" className={cell}>Kid details</th>
            <th scope="col" className={cell}>Date of inquiry</th>
            <th scope="col" className={cell}>Free Trials</th>
            <th scope="col" className={cell}>Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">{data.data.rows.map(lead => {
            const name = leadDisplayName(lead)
            const inquiryDate = lead.createdAt ? new Date(lead.createdAt) : null
            const trials = lead.freeTrials || []
            const children = [...(lead.inquiry?.campers || [])]
            for (const booking of trials) {
              if (!children.some((child, index) => child.memberId === booking.memberId || booking.childIndex === index)) children.push({ memberId: booking.memberId, firstName: booking.childName })
            }
            const childRows = children.length ? children : [null]
            return childRows.map((child, index) => <tr key={`${lead.id}:${index}`}>
              {index === 0 && <><td rowSpan={childRows.length} className={checkboxCell}><input type="checkbox" aria-label={`Contacted ${name}`} checked={lead.contacted} disabled={!canManage || saving !== null} onChange={event => void flag(lead, { contacted: event.target.checked })} /></td>
              <td rowSpan={childRows.length} className={checkboxCell}><input type="checkbox" aria-label={`Follow up ${name}`} checked={lead.followUp} disabled={!canManage || saving !== null} onChange={event => void flag(lead, { followUp: event.target.checked })} /></td>
              <td rowSpan={childRows.length} className={cell}>
                <button type="button" className="block max-w-full text-left font-semibold underline decoration-slate-300 underline-offset-4 [overflow-wrap:anywhere]" onClick={() => setNotes(lead)}>{name}</button>
                <p className="mt-1 text-xs text-slate-500">{lead.matchedMemberId ? 'Member inquiry' : 'Lead'} #{lead.id}</p>
              </td>
              <td rowSpan={childRows.length} className={`${cell} [overflow-wrap:anywhere]`}>{lead.email}<p className="text-slate-500">{formatPhoneForDisplay(lead.phone) || 'No phone'}</p></td>
              <td rowSpan={childRows.length} className={`${cell} [overflow-wrap:anywhere]`}><Status value={lead.status} />{lead.invitation && <p className="mt-1 text-xs text-slate-500">{lead.invitation.purpose === 'trial' ? 'Trial invitation' : 'Invitation'} {lead.invitation.status}</p>}</td></>}
              <td className={`${cell} [overflow-wrap:anywhere]`}><KidDetails children={child ? [child] : []} /></td>
              {index === 0 && <td rowSpan={childRows.length} className={`${cell} whitespace-nowrap`}>{inquiryDate && !Number.isNaN(inquiryDate.getTime()) ? <time dateTime={lead.createdAt}>{inquiryDateFormatter.format(inquiryDate)}</time> : '—'}</td>}
              <td className={`${cell} [overflow-wrap:anywhere]`}>
                {trials.some(booking => child?.memberId === booking.memberId || booking.childIndex === index) ? <ul className="space-y-2" aria-label={`Free trials for ${child ? [child.firstName, child.lastName].filter(Boolean).join(' ') || `Child ${index + 1}` : name}`}>
                  {trials.filter(booking => child?.memberId === booking.memberId || booking.childIndex === index).map(booking => <li key={booking.id}>
                    <p className="font-medium">{formatDateShort(booking.date)}</p>
                    <p>{booking.className}</p>
                    <p className="text-xs capitalize text-slate-500">{booking.status === 'confirmed' ? 'Scheduled' : booking.status === 'attended' ? 'Participated' : booking.status.replaceAll('_', ' ')}</p>
                  </li>)}
                </ul> : <span className="text-slate-500">No free trial booked</span>}
              </td>
              {index === 0 && <td rowSpan={childRows.length} className={cell}><div className="flex items-start gap-1 [&_button]:whitespace-nowrap [&_button]:px-1.5 [&_button]:!text-xs">
                <button className={button} onClick={() => setNotes(lead)}>Notes</button>
                {lead.matchedMemberId ? <button className={button} onClick={() => onOpenMember(Number(lead.matchedMemberId))}>Open member</button> : null}
                {canManage && !lead.archived && (lead.invitation || !lead.matchedMemberId) ? lead.invitation && lead.invitation.purpose !== 'trial' ? <button className={button} onClick={() => setConvert(lead)}>Registration invitation</button> : <button className={button} onClick={() => setTrial(lead)}>Trial</button> : null}
                {allowed(access, 'accounts.lifecycle') && <MemberRecordActions record={{ kind: 'lead', id: lead.id, name, archived: lead.archived === true }} onChanged={refresh} />}
              </div></td>}
            </tr>)
          })}</tbody>
        </table>
      </div> : <Empty>No inquiries match these filters.</Empty>}
      <Pager data={data.data} onPage={setPage} />
    </div> : null}
    {adding ? <Dialog title="Add lead" onClose={() => setAdding(false)}><LeadFields lead={null} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); refresh() }} /></Dialog> : null}
    {notes ? <LeadNotesDialog lead={notes} revision={revision + version} canManage={canManage} onClose={() => setNotes(null)} onSaved={lead => { setNotes(lead); refresh() }} /> : null}
    {convert ? <ConvertLead lead={convert} access={access} onClose={() => setConvert(null)} onSent={refresh} /> : null}
    {trial ? <TrialLead lead={trial} onClose={() => setTrial(null)} onSent={refresh} /> : null}
  </section>
}


function LeadNotesDialog({ lead, revision, canManage, onClose, onSaved }: { lead: Lead; revision: number; canManage: boolean; onClose: () => void; onSaved: (lead: Lead) => void }) {
  const [editing, setEditing] = useState(false)
  return <Dialog title={`Notes · ${leadDisplayName(lead)}`} onClose={onClose}><div className="grid h-[72vh] min-h-0 grid-rows-[minmax(0,0.8fr)_minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(260px,1fr)_minmax(0,1.6fr)] lg:grid-rows-1">
    <aside className="min-h-0 overflow-y-auto rounded-xl border bg-slate-50 p-4" aria-label="Lead information"><details open><summary className="cursor-pointer font-semibold">{lead.matchedMemberId ? 'Member inquiry information' : 'Lead form information'}</summary>
      <div className="mt-4 text-sm"><p className="font-semibold">Acquisition source</p><AcquisitionDetails acquisition={lead.acquisition} /></div>
      <div className="mt-4">{editing ? <LeadFields lead={lead} onCancel={() => setEditing(false)} onSaved={saved => { setEditing(false); onSaved(saved) }} /> : <><InquiryInformation lead={lead} />{canManage && <button className={`${button} mt-4`} onClick={() => setEditing(true)}>{lead.matchedMemberId ? 'Edit inquiry information' : 'Edit lead information'}</button>}</>}</div>
    </details></aside>
    <div className="min-h-0 overflow-y-auto pr-2" role="region" aria-label="Scrollable account notes" tabIndex={0}><AccountNotes endpoint={`/api/admin/new-admin/leads/${lead.id}/notes`} revision={revision} canManage={canManage} subjectType="registration" subjectId={lead.id} /></div>
  </div></Dialog>
}
