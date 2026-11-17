import { formatPhoneForDisplay, isCompletePhoneNumber } from '../../utils/phoneUtils'
import { useState, type FormEvent } from 'react'
import { calculateAge, formatDateForDisplay } from '../../utils/dateUtils'
import { button, input, primary, ErrorNotice } from './shared'
import { request, useRead } from './api'
import { INQUIRY_INTERESTS, INQUIRY_CLASS_TYPES, SUBMITTER_ROLES } from '../../config/inquiryOptions'
import TextInput from '../common/TextInput'
import type { Lead, LeadAcquisition, LeadChild } from './leadTypes'

export function AcquisitionDetails({ acquisition }: { acquisition?: LeadAcquisition | null }) {
  if (!acquisition) return <span className="text-slate-500">Not recorded</span>
  const source = acquisition.source ?? acquisition.referrerHost ?? (acquisition.direct ? 'Direct' : 'Source not recorded')
  const medium = acquisition.medium === 'self_reported' ? 'Self-reported' : acquisition.medium
  return <div className="break-words">
    <p>{[source, medium, acquisition.campaign].filter(Boolean).join(' · ')}</p>
    {acquisition.referrerHost && acquisition.source ? <p className="text-xs text-slate-500">Referrer {acquisition.referrerHost}</p> : null}
    {acquisition.landingPath ? <p className="text-xs text-slate-500">Landing page {acquisition.landingPath}</p> : null}
  </div>
}

export function KidDetails({ children }: { children: LeadChild[] }) {
  return children.length ? <ul className="space-y-1">{children.map((child, index) => {
    const age = child.dateOfBirth ? calculateAge(child.dateOfBirth) : null
    return <li key={index}><span className="font-medium">{[child.firstName, child.lastName].filter(Boolean).join(' ') || `Child ${index + 1}`}</span><span className="block text-slate-500">{child.gender === 'male' ? 'Male' : child.gender === 'female' ? 'Female' : 'Gender not provided'} · {age == null ? 'Birthday not provided' : `${age} years old`}</span></li>
  })}</ul> : <span className="text-slate-500">No child details provided</span>
}

const asList = (value: string[] | string | undefined) => Array.isArray(value) ? value : (value || '').split(',').map(item => item.trim()).filter(Boolean)
const interestOptions: readonly string[] = INQUIRY_INTERESTS

export function LeadFields({ lead, onSaved, onCancel }: { lead: Lead | null; onSaved: (lead: Lead) => void; onCancel: () => void }) {
  const actor = useRead<{ user?: { fullName?: string; email?: string } }>(lead ? null : '/api/admin/access/me')
  const [draft, setDraft] = useState({ firstName: lead?.firstName || '', lastName: lead?.lastName || '', email: lead?.email || '', phone: formatPhoneForDisplay(lead?.phone), message: lead?.message || '' })
  const initialInterests = asList(lead?.inquiry?.interests)
  const [inquiry, setInquiry] = useState({ submitterRole: lead?.inquiry?.submitterRole || '', source: lead?.inquiry?.source || '', interest: lead?.inquiry?.interest || '' })
  const [acquisitionSource, setAcquisitionSource] = useState('')
  const [interests, setInterests] = useState<string[]>(initialInterests)
  const [classTypes, setClassTypes] = useState<string[]>(lead?.inquiry?.classTypes || [])
  const [newsletter, setNewsletter] = useState(lead?.inquiry?.newsletter ?? true)
  const [children, setChildren] = useState<LeadChild[]>(lead?.inquiry?.campers || [])
  const [originalAge, setOriginalAge] = useState(String(lead?.inquiry?.athleteAge ?? ''))
  const [originalChildAges, setOriginalChildAges] = useState((lead?.inquiry?.childAges || []).join(', '))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unchangedLegacyPhone = draft.phone === formatPhoneForDisplay(lead?.phone) && !isCompletePhoneNumber(draft.phone)
  const submittedBy = lead ? lead.inquiry?.submittedBy?.name || 'Not recorded' : actor.data?.user?.fullName || actor.data?.user?.email || 'Current signed-in admin (recorded when saved)'
  const toggleInterest = (value: string) => setInterests(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])
  const interestGroup = (title: string, options: readonly string[]) => <fieldset className="space-y-2"><legend className="mb-2 font-semibold">{title}</legend><div className="grid gap-2 sm:grid-cols-2">{options.map(value => <label key={value} className="flex items-start gap-2 text-sm"><input className="mt-0.5" type="checkbox" checked={interests.includes(value)} onChange={() => toggleInterest(value)} /><span>{value}</span></label>)}</div></fieldset>
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      const saved = await request<Lead>(`/api/admin/new-admin/leads${lead ? `/${lead.id}` : ''}`, { method: lead ? 'PATCH' : 'POST', body: JSON.stringify({
        ...draft,
        ...(!lead && acquisitionSource.trim() ? { acquisitionSource: acquisitionSource.trim() } : {}),
        inquiry: { ...inquiry, interests, classTypes, newsletter, campers: children, ...(lead?.inquiry?.athleteAge != null ? {athleteAge: originalAge === '' ? null : Number(originalAge)} : {}), ...(lead?.inquiry?.childAges?.length ? {childAges: originalChildAges.split(',').map(age => age.trim()).filter(Boolean).map(Number)} : {}) },
      }) })
      onSaved(saved)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save lead.') }
    finally { setBusy(false) }
  }
  return <form onSubmit={save} className="space-y-4">
    <ErrorNotice message={error} />
    <p className="text-sm text-slate-600">All fields are optional for admin-entered leads. Add the information you have; you can fill in the rest later.</p>
    <fieldset disabled={busy} className="space-y-5">
      <label className="block text-sm font-medium">Submitted by<input className={`${input} bg-slate-50`} readOnly value={submittedBy} /></label>
      {!lead ? <label className="block text-sm font-medium">How did they hear about Vortex?<input className={input} maxLength={100} value={acquisitionSource} onChange={event => setAcquisitionSource(event.target.value)} placeholder="Google, referral, walk-in" /></label> : null}
      <fieldset><legend className="mb-2 text-sm font-medium">Is the contact the Athlete, Parent/Guardian, or Other?</legend><div className="flex flex-wrap gap-4">{[...SUBMITTER_ROLES, ...(!SUBMITTER_ROLES.some(role => role === inquiry.submitterRole) && inquiry.submitterRole ? [inquiry.submitterRole] : [])].map(role => <label key={role} className="flex items-center gap-2 text-sm"><input type="radio" name="leadContactRole" checked={inquiry.submitterRole === role} onChange={() => setInquiry({ ...inquiry, submitterRole: role })} />{role}</label>)}</div></fieldset>
      <div className="grid gap-3 sm:grid-cols-2">{(['firstName', 'lastName', 'email', 'phone'] as const).map(key => <label key={key} className="text-sm font-medium">{{ firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone' }[key]}<TextInput className={input} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} pattern={key === 'phone' && unchangedLegacyPhone ? '.*' : undefined} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}</div>
      <div className="space-y-3"><h4 className="font-semibold">Athlete Information</h4><p className="text-sm text-slate-600">Add any athlete details you have. Names, date of birth, and gender are optional.</p>{children.map((child, index) => <fieldset key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"><legend className="px-1 text-sm">Athlete {index + 1}</legend>{(['firstName', 'lastName', 'dateOfBirth'] as const).map(key => <label key={key} className="text-sm">{{ firstName: 'First name (optional)', lastName: 'Last name (optional)', dateOfBirth: 'Date of birth (optional)' }[key]}<input aria-label={`Athlete ${index + 1} ${{ firstName: 'first name', lastName: 'last name', dateOfBirth: 'date of birth' }[key]}`} className={input} type={key === 'dateOfBirth' ? 'date' : 'text'} value={child[key] || ''} onChange={event => setChildren(children.map((value, i) => i === index ? { ...value, [key]: event.target.value } : value))} /></label>)}<label className="text-sm">Gender (optional)<select aria-label={`Athlete ${index + 1} gender`} className={input} value={child.gender || ''} onChange={event => setChildren(children.map((value, i) => i === index ? { ...value, gender: event.target.value } : value))}><option value="">Not provided</option><option value="male">Male</option><option value="female">Female</option></select></label><button type="button" className={button} onClick={() => setChildren(children.filter((_, i) => i !== index))}>Remove athlete {index + 1}</button></fieldset>)}<button type="button" className={button} onClick={() => setChildren([...children, {}])}>Add athlete</button></div>
      {interestGroup('Interests', [...new Set([...interestOptions, ...(lead ? initialInterests : [])])])}
      <fieldset><legend className="mb-2 font-semibold">Class Type Interests</legend><div className="grid gap-2 sm:grid-cols-2">{[...new Set([...INQUIRY_CLASS_TYPES, ...classTypes])].map(value => <label key={value} className="flex items-start gap-2 text-sm"><input className="mt-0.5" type="checkbox" checked={classTypes.includes(value)} onChange={() => setClassTypes(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])} /><span>{value}</span></label>)}</div></fieldset>
      <label className="block text-sm font-medium">Leave a comment or ask any questions<textarea className={input} rows={4} value={draft.message} onChange={event => setDraft({ ...draft, message: event.target.value })} /></label>
      <label className="flex items-start gap-2 text-sm"><input className="mt-0.5" type="checkbox" checked={newsletter} onChange={event => setNewsletter(event.target.checked)} /><span>The contact would like to receive fitness and nutrition tips, recruiting information, and high school or collegiate sporting news from Vortex Athletics.</span></label>
      {lead && <div className="grid gap-3 sm:grid-cols-2">{(['interest', 'source'] as const).map(key => <label key={key} className="block text-sm font-medium">{{ interest: 'Original interest', source: 'Inquiry source' }[key]}<input className={input} value={inquiry[key]} onChange={event => setInquiry({ ...inquiry, [key]: event.target.value })} /></label>)}</div>}
      {lead?.inquiry?.athleteAge != null && <label className="block text-sm font-medium">Age reported on original form<input className={input} type="number" min="0" max="120" step="1" value={originalAge} onChange={event => setOriginalAge(event.target.value)} /></label>}
      {Boolean(lead?.inquiry?.childAges?.length) && <label className="block text-sm font-medium">Ages reported on original form (separate with commas)<input className={input} value={originalChildAges} onChange={event => setOriginalChildAges(event.target.value)} /></label>}
      <div className="flex gap-2"><button className={primary}>{busy ? 'Saving…' : 'Save lead'}</button><button className={button} type="button" onClick={onCancel}>Cancel</button></div>
    </fieldset>
  </form>
}

export function InquiryInformation({ lead }: { lead: Lead }) {
  const inquiry = lead.inquiry || {}
  return <dl className="space-y-3 text-sm"><div><dt className="font-semibold">Contact</dt><dd>{lead.firstName} {lead.lastName}<br />{lead.email}<br />{formatPhoneForDisplay(lead.phone) || 'No phone'}</dd></div><div><dt className="font-semibold">Submitted</dt><dd>{new Date(lead.createdAt).toLocaleString()}</dd></div>{inquiry.submittedBy && <div><dt className="font-semibold">Submitted by</dt><dd>{inquiry.submittedBy.name}</dd></div>}{Object.entries(inquiry).filter(([key, value]) => key !== 'campers' && key !== 'submittedBy' && value != null && value !== '' && (!Array.isArray(value) || value.length)).map(([key, value]) => <div key={key}><dt className="font-semibold">{{ athleteAge: 'Age reported on original form', childAges: 'Ages reported on original form', interests: 'Interests', interest: 'Original interest', classTypes: 'Class types', submitterRole: 'Contact role', newsletter: 'Newsletter requested', source: 'Inquiry source' }[key] || key}</dt><dd className="whitespace-pre-wrap">{Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)}</dd></div>)}<div><dt className="font-semibold">Children</dt><dd><KidDetails children={inquiry.campers || []} />{inquiry.campers?.map((child, index) => child.dateOfBirth ? <p key={index} className="mt-1 text-slate-500">Child {index + 1} birthday: {formatDateForDisplay(child.dateOfBirth)}</p> : null)}</dd></div><div><dt className="font-semibold">Inquiry message</dt><dd className="whitespace-pre-wrap">{lead.message || 'No message'}</dd></div></dl>
}
