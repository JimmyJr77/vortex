import MemberRecordActions from '../admin/MemberRecordActions'
import { formatPhoneForDisplay } from '../../utils/phoneUtils'
import { useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from 'lucide-react'
import { button, Dialog, Empty, ErrorNotice, Loading, Pager, primary, Status } from './shared'
import AccountNotes from './AccountNotes'
import LeadFilters, { type LeadFilterValues } from './LeadFilters'
import { AcquisitionDetails, InquiryInformation, KidDetails, LeadFields } from './LeadInquiry'
import ConvertLead from './ConvertLead'
import TrialLead from './TrialLead'
import LeadLastContacted from './LeadLastContacted'
import LeadTrialBooking from './LeadTrialBooking'
import { leadChildRows, leadDisplayName, leadHasUsedFreeTrial, leadIsConverted, type Lead, type LeadParticipationTag, type LeadSortKey } from './leadTypes'
import { formatDateShort } from '../../utils/dateUtils'
import { allowed, request, useRead, useSearch, type Access, type Page } from './api'

const checkboxCell = 'px-0 py-3 text-center align-top'
const cell = 'px-2.5 py-3 text-left align-top'
const inquiryDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const participationLabels: Record<LeadParticipationTag, string> = { inquiry: 'Inquiry', free_trial: 'Free Trial', drop_in: 'Non-Member Drop-in', recent_drop: 'Recent Drop' }

function LeadStatus({ lead }: { lead: Lead }) {
  const converted = leadIsConverted(lead)
  const tags = lead.participationTags ?? (lead.inquiry?.source === 'free_trial' ? ['free_trial'] : ['inquiry', ...((lead.freeTrials?.length || lead.invitation?.purpose === 'trial') ? ['free_trial'] : [])])
  return <div className="space-y-2"><div><span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${converted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{converted ? 'Converted' : 'Lead'}</span></div>
    <div className="flex flex-wrap items-start gap-1">{(Object.keys(participationLabels) as LeadParticipationTag[]).filter(tag => tags.includes(tag)).map(tag => <Status key={tag} value={participationLabels[tag]} />)}</div>
    {lead.invitation ? <p className="text-xs text-slate-500">{lead.invitation.purpose === 'trial' ? 'Trial invitation' : 'Invitation'} {lead.invitation.status}</p> : null}
  </div>
}

function LeadDate({ value }: { value: string | null | undefined }) {
  if (!value) return <>—</>
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  return !Number.isNaN(date.getTime()) ? <time dateTime={value}>{inquiryDateFormatter.format(date)}</time> : <>—</>
}

type LeadSort = { key: LeadSortKey; direction: 'asc' | 'desc' }
const initialSort: LeadSort = { key: 'inquiryDate', direction: 'desc' }
function SortableHeader({ label, name, sortKey, sort, onSort }: { label: string; name: string; sortKey: LeadSortKey; sort: LeadSort; onSort: (key: LeadSortKey) => void }) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
  return <th scope="col" className={cell} aria-label={label} aria-sort={active ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" aria-label={`Sort by ${name}`} className="inline-flex items-center gap-1 text-left uppercase hover:text-slate-900 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500" onClick={() => onSort(sortKey)}><span>{label}</span><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></button></th>
}

const emptyFilters: LeadFilterValues = { contacted: '', followUp: '', ageMin: '', ageMax: '', gender: '', participation: '' }
export default function Leads({ access, revision, onOpenMember }: { access: Access; revision: number; onOpenMember: (id: number) => void }) {
  const [query, setQuery] = useState('')
  const search = useSearch(query)
  const [keywords, setKeywords] = useState('')
  const keywordSearch = useSearch(keywords)
  const [filters, setFilters] = useState<LeadFilterValues>(emptyFilters)
  const [includeMembers, setIncludeMembers] = useState(false)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<LeadSort>(initialSort)
  const [version, setVersion] = useState(0)
  const [adding, setAdding] = useState(false)
  const [notes, setNotes] = useState<Lead | null>(null)
  const [saving, setSaving] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [convert, setConvert] = useState<Lead | null>(null)
  const [trial, setTrial] = useState<Lead | null>(null)
  const [trialBooking, setTrialBooking] = useState<Lead | null>(null)
  const canManage = allowed(access, 'members.edit')
  const invalidAge = (filters.ageMin !== '' && filters.ageMax !== '' && Number(filters.ageMin) > Number(filters.ageMax))
    || [filters.ageMin, filters.ageMax].some(value => value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 120))
  const data = useRead<Page<Lead>>(invalidAge ? null : `/api/admin/new-admin/leads?${new URLSearchParams({ search, archived: 'false', keywords: keywordSearch, ...filters, includeMembers: String(includeMembers), sortBy: sort.key, sortDirection: sort.direction, page: String(page), pageSize: '25' })}`, revision + version)
  const refresh = () => setVersion(value => value + 1)
  const changeSort = (key: LeadSortKey) => {
    setSort(current => ({ key, direction: current.key === key ? current.direction === 'asc' ? 'desc' : 'asc' : key === 'name' ? 'asc' : 'desc' }))
    setPage(1)
  }
  const flag = async (lead: Lead, body: { contacted?: boolean; followUp?: boolean }) => {
    setSaving(lead.id); setSaveError(null)
    try { await request(`/api/admin/new-admin/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(body) }); refresh() }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Unable to update lead.') }
    finally { setSaving(null) }
  }
  return <section>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Leads</h2><p className="mt-1 text-sm text-slate-500">Follow up on inquiries from prospective families.</p></div><div className="flex flex-wrap items-center gap-2">
      <button type="button" className={button} aria-pressed={includeMembers || Boolean(filters.participation)} disabled={Boolean(filters.participation)} onClick={() => { setIncludeMembers(value => !value); setPage(1) }}>{filters.participation ? 'Active and converted members included' : includeMembers ? 'Hide active and converted members' : 'Show active and converted members'}</button>
      {canManage ? <button className={primary} onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add lead</button> : null}
    </div></div>
    <LeadFilters value={filters} onChange={patch => { setFilters(current => ({ ...current, ...patch })); setPage(1) }} search={query} onSearch={value => { setQuery(value); setPage(1) }} keywords={keywords} onKeywords={value => { setKeywords(value); setPage(1) }} onReset={() => { setFilters(emptyFilters); setQuery(''); setKeywords(''); setIncludeMembers(false); setSort(initialSort); setPage(1) }} />
    <ErrorNotice message={invalidAge ? 'Enter whole child ages from 0 to 120, with minimum age no greater than maximum age.' : null} />
    <ErrorNotice message={saveError} />
    <ErrorNotice message={data.error} onRetry={refresh} />
    {data.loading ? <Loading label="Loading leads…" /> : data.data ? <div className="rounded-xl border border-slate-200 bg-white">
      {data.data.rows.length ? <div className="overflow-x-auto rounded-t-xl">
        <table className="w-full min-w-[108rem] table-fixed text-sm">
          <colgroup>
            <col span={2} className="w-7" />
            <col className="w-48" />
            <col className="w-52" />
            <col className="w-40" />
            <col />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-56" />
            <col className="w-36" />
            <col className="w-72" />
          </colgroup>
          <thead className="bg-slate-100 text-xs uppercase text-slate-500 [&_th]:align-bottom"><tr>
            <th scope="col" className={`${checkboxCell} h-24 !align-bottom`}><span className="inline-block rotate-180 whitespace-nowrap [writing-mode:vertical-rl]">Contacted</span></th>
            <th scope="col" className={`${checkboxCell} h-24 !align-bottom`}><span className="inline-block rotate-180 whitespace-nowrap [writing-mode:vertical-rl]">Follow-up</span></th>
            <SortableHeader label="Name" name="last name" sortKey="name" sort={sort} onSort={changeSort} />
            <th scope="col" className={cell}>Contact</th>
            <th scope="col" className={cell}>Status</th>
            <th scope="col" className={cell}>Kid details</th>
            <SortableHeader label="Date of inquiry" name="date of inquiry" sortKey="inquiryDate" sort={sort} onSort={changeSort} />
            <th scope="col" className={cell}>Last contacted</th>
            <SortableHeader label="Date of free trial" name="date of free trial" sortKey="freeTrialDate" sort={sort} onSort={changeSort} />
            <SortableHeader label="Conversion Date" name="conversion date" sortKey="conversionDate" sort={sort} onSort={changeSort} />
            <th scope="col" className={cell}>Actions</th>
          </tr></thead>
          {data.data.rows.map(lead => {
            const name = leadDisplayName(lead)
            const childRows = leadChildRows(lead)
            const converted = leadIsConverted(lead)
            const memberId = lead.linkedMemberId ?? lead.convertedMemberId ?? lead.matchedMemberId
            return <tbody key={lead.id} className="group/lead divide-y divide-slate-100 border-t border-slate-100 hover:bg-slate-50/60">{childRows.map(({ child, trials }, index) => <tr key={`${lead.id}:${index}`}>
              {index === 0 && <><td rowSpan={childRows.length} className={checkboxCell}><input className="h-3.5 w-3.5" type="checkbox" aria-label={`Contacted ${name}`} checked={lead.contacted} disabled={!canManage || saving !== null} onChange={event => void flag(lead, { contacted: event.target.checked })} /></td>
              <td rowSpan={childRows.length} className={checkboxCell}><input className="h-3.5 w-3.5" type="checkbox" aria-label={`Follow up ${name}`} checked={lead.followUp} disabled={!canManage || saving !== null} onChange={event => void flag(lead, { followUp: event.target.checked })} /></td>
              <td rowSpan={childRows.length} className={cell}>
                <button type="button" className="block max-w-full text-left font-semibold underline decoration-slate-300 underline-offset-4 [overflow-wrap:anywhere]" onClick={() => setNotes(lead)}>{name}</button>
                <p className="mt-1 text-xs text-slate-500">{lead.matchedMemberId ? 'Member inquiry' : 'Lead'} #{lead.id}</p>
              </td>
              <td rowSpan={childRows.length} className={`${cell} [overflow-wrap:anywhere]`}>{lead.email}<p className="text-slate-500">{formatPhoneForDisplay(lead.phone) || 'No phone'}</p></td>
              <td rowSpan={childRows.length} className={`${cell} [overflow-wrap:anywhere]`}><LeadStatus lead={lead} /></td></>}
              <td className={`${cell} [overflow-wrap:anywhere]`}><KidDetails children={child ? [child] : []} /></td>
              {index === 0 && <td rowSpan={childRows.length} className={`${cell} whitespace-nowrap`}><LeadDate value={lead.createdAt} /></td>}
              {index === 0 && <td rowSpan={childRows.length} className={`${cell} whitespace-nowrap`}><LeadDate value={lead.lastContactedAt} /></td>}
              <td className={`${cell} [overflow-wrap:anywhere]`}>
                {trials.length ? <ul className="space-y-2" aria-label={`Free trials for ${child ? [child.firstName, child.lastName].filter(Boolean).join(' ') || `Child ${index + 1}` : name}`}>
                  {trials.map(booking => <li key={booking.id}>
                    <p className="font-medium">{formatDateShort(booking.date)}</p>
                    <p>{booking.className}</p>
                    <p className="text-xs capitalize text-slate-500">{booking.status === 'confirmed' ? 'Scheduled' : booking.status === 'attended' ? 'Participated' : booking.status.replaceAll('_', ' ')}</p>
                  </li>)}
                </ul> : <span className="text-slate-500">No free trial booked</span>}
              </td>
              {index === 0 && <td rowSpan={childRows.length} className={`${cell} whitespace-nowrap`}><LeadDate value={lead.convertedAt} /></td>}
              {index === 0 && <td rowSpan={childRows.length} className={cell}><div className="flex items-start gap-1 [&_button]:whitespace-nowrap [&_button]:px-1.5 [&_button]:!text-xs">
                <button className={button} onClick={() => setNotes(lead)}>Notes</button>
                {converted ? memberId != null ? <button className={button} onClick={() => onOpenMember(Number(memberId))}>Member</button> : null : canManage && !lead.archived ? <>
                  {!leadHasUsedFreeTrial(lead) ? <button className={button} disabled={memberId != null && !allowed(access, 'scheduling.manage')} title={memberId != null && !allowed(access, 'scheduling.manage') ? 'Scheduling permission is required to book a trial.' : undefined} onClick={() => memberId != null ? setTrialBooking(lead) : setTrial(lead)}>Free trial</button> : null}
                  <button className={button} onClick={() => memberId != null ? onOpenMember(Number(memberId)) : setConvert(lead)}>Convert</button>
                </> : null}
                {access.isMasterAdmin && <MemberRecordActions iconOnly compact archiveClassName="opacity-0 transition-opacity group-hover/lead:opacity-100 group-focus-within/lead:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100" record={{ kind: 'lead', id: lead.id, name, archived: lead.archived === true }} onChanged={refresh} />}
              </div></td>}
            </tr>)}</tbody>
          })}
        </table>
      </div> : <Empty>No inquiries match these filters.</Empty>}
      <Pager data={data.data} onPage={setPage} />
    </div> : null}
    {adding ? <Dialog title="Add lead" onClose={() => setAdding(false)}><LeadFields lead={null} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); refresh() }} /></Dialog> : null}
    {notes ? <LeadNotesDialog lead={notes} revision={revision + version} canManage={canManage} onClose={() => setNotes(null)} onSaved={lead => { setNotes(lead); refresh() }} /> : null}
    {convert ? <ConvertLead lead={convert} access={access} onClose={() => setConvert(null)} onSent={refresh} /> : null}
    {trial ? <TrialLead lead={trial} onClose={() => setTrial(null)} onSent={refresh} /> : null}
    {trialBooking ? <LeadTrialBooking lead={trialBooking} onClose={() => setTrialBooking(null)} onBooked={refresh} onOpenMember={onOpenMember} /> : null}
  </section>
}


function LeadNotesDialog({ lead, revision, canManage, onClose, onSaved }: { lead: Lead; revision: number; canManage: boolean; onClose: () => void; onSaved: (lead: Lead) => void }) {
  const [editing, setEditing] = useState(false)
  return <Dialog title={`Notes · ${leadDisplayName(lead)}`} onClose={onClose}><div className="grid h-[72vh] min-h-0 grid-rows-[minmax(0,0.8fr)_minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(260px,1fr)_minmax(0,1.6fr)] lg:grid-rows-1">
    <aside className="min-h-0 overflow-y-auto rounded-xl border bg-slate-50 p-4" aria-label="Lead information"><LeadLastContacted key={`${lead.id}:${lead.lastContactedAt ?? ''}`} lead={lead} canManage={canManage} onSaved={date => onSaved({ ...lead, lastContactedAt: date })} /><details open><summary className="cursor-pointer font-semibold">{lead.matchedMemberId ? 'Member inquiry information' : 'Lead form information'}</summary>
      <div className="mt-4 text-sm"><p className="font-semibold">Acquisition source</p><AcquisitionDetails acquisition={lead.acquisition} /></div>
      <div className="mt-4">{editing ? <LeadFields lead={lead} onCancel={() => setEditing(false)} onSaved={saved => { setEditing(false); onSaved(saved) }} /> : <><InquiryInformation lead={lead} />{canManage && <button className={`${button} mt-4`} onClick={() => setEditing(true)}>{lead.matchedMemberId ? 'Edit inquiry information' : 'Edit lead information'}</button>}</>}</div>
    </details></aside>
    <div className="min-h-0 overflow-y-auto pr-2" role="region" aria-label="Scrollable account notes" tabIndex={0}><AccountNotes endpoint={`/api/admin/new-admin/leads/${lead.id}/notes`} revision={revision} canManage={canManage} subjectType="registration" subjectId={lead.id} onAdded={note => onSaved({ ...lead, ...(!note.nonContact && note.contactDate ? { lastContactedAt: note.contactDate } : {}) })} /></div>
  </div></Dialog>
}
