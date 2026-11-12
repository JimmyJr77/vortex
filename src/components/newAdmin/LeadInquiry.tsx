import { useState, type FormEvent } from 'react'
import { calculateAge, formatDateForDisplay } from '../../utils/dateUtils'
import { button, input, primary, ErrorNotice } from './shared'
import { request } from './api'
import type { Lead, LeadChild } from './leadTypes'

export function KidDetails({ children }: { children: LeadChild[] }) {
  return children.length ? <ul className="space-y-1">{children.map((child, index) => {
    const age = child.dateOfBirth ? calculateAge(child.dateOfBirth) : null
    return <li key={index}><span className="font-medium">{[child.firstName, child.lastName].filter(Boolean).join(' ') || `Child ${index + 1}`}</span><span className="block text-slate-500">{child.gender === 'male' ? 'Male' : child.gender === 'female' ? 'Female' : 'Gender not provided'} · {age == null ? 'Birthday not provided' : `${age} years old`}</span></li>
  })}</ul> : <span className="text-slate-500">No child details provided</span>
}

export function LeadFields({ lead, onSaved, onCancel }: { lead: Lead | null; onSaved: (lead: Lead) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState({ firstName: lead?.firstName || '', lastName: lead?.lastName || '', email: lead?.email || '', phone: lead?.phone || '', message: lead?.message || '' })
  const [inquiry, setInquiry] = useState({ submitterRole: lead?.inquiry?.submitterRole || '', source: lead?.inquiry?.source || '', interest: lead?.inquiry?.interest || '', interests: Array.isArray(lead?.inquiry?.interests) ? lead.inquiry.interests.join(', ') : lead?.inquiry?.interests || '', classTypes: (lead?.inquiry?.classTypes || []).join(', ') })
  const [children, setChildren] = useState<LeadChild[]>(lead?.inquiry?.campers || [])
  const [originalAge, setOriginalAge] = useState(String(lead?.inquiry?.athleteAge ?? ''))
  const [originalChildAges, setOriginalChildAges] = useState((lead?.inquiry?.childAges || []).join(', '))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      const saved = await request<Lead>(`/api/admin/new-admin/leads${lead ? `/${lead.id}` : ''}`, { method: lead ? 'PATCH' : 'POST', body: JSON.stringify({ ...draft, inquiry: { ...inquiry, interests: inquiry.interests.split(','), classTypes: inquiry.classTypes.split(','), campers: children, ...(lead?.inquiry?.athleteAge != null ? {athleteAge: originalAge === '' ? null : Number(originalAge)} : {}), ...(lead?.inquiry?.childAges?.length ? {childAges: originalChildAges.split(',').map(age => age.trim()).filter(Boolean).map(Number)} : {}) } }) })
      onSaved(saved)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save lead.') }
    finally { setBusy(false) }
  }
  return <form onSubmit={save} className="space-y-4"><ErrorNotice message={error} /><fieldset disabled={busy} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{(['firstName', 'lastName', 'email', 'phone'] as const).map(key => <label key={key} className="text-sm font-medium">{{ firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone' }[key]}<input className={input} required={key !== 'phone'} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}</div>
    {(['submitterRole', 'interests', 'classTypes', 'interest', 'source'] as const).map(key => <label key={key} className="block text-sm font-medium">{{ submitterRole: 'Submitted by', interests: 'Interests (separate with commas)', classTypes: 'Class types (separate with commas)', interest: 'Original interest', source: 'Inquiry source' }[key]}<input className={input} value={inquiry[key]} onChange={event => setInquiry({ ...inquiry, [key]: event.target.value })} /></label>)}
    <label className="block text-sm font-medium">Inquiry message<textarea className={input} rows={4} value={draft.message} onChange={event => setDraft({ ...draft, message: event.target.value })} /></label>
    {lead?.inquiry?.athleteAge != null && <label className="block text-sm font-medium">Age reported on original form<input className={input} type="number" min="0" max="120" step="1" value={originalAge} onChange={event => setOriginalAge(event.target.value)} /></label>}
    {Boolean(lead?.inquiry?.childAges?.length) && <label className="block text-sm font-medium">Ages reported on original form (separate with commas)<input className={input} value={originalChildAges} onChange={event => setOriginalChildAges(event.target.value)} /></label>}
    <div className="space-y-3"><h4 className="font-semibold">Children</h4>{children.map((child, index) => <fieldset key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"><legend className="px-1 text-sm">Child {index + 1}</legend>{(['firstName', 'lastName', 'dateOfBirth'] as const).map(key => <label key={key} className="text-sm">{{ firstName: 'Child first name', lastName: 'Child last name', dateOfBirth: 'Birthday' }[key]}<input className={input} type={key === 'dateOfBirth' ? 'date' : 'text'} value={child[key] || ''} onChange={event => setChildren(children.map((value, i) => i === index ? { ...value, [key]: event.target.value } : value))} /></label>)}<label className="text-sm">Gender<select className={input} value={child.gender || ''} onChange={event => setChildren(children.map((value, i) => i === index ? { ...value, gender: event.target.value } : value))}><option value="">Not provided</option><option value="male">Male</option><option value="female">Female</option></select></label><button type="button" className={button} onClick={() => setChildren(children.filter((_, i) => i !== index))}>Remove child {index + 1}</button></fieldset>)}<button type="button" className={button} onClick={() => setChildren([...children, {}])}>Add child</button></div>
    <div className="flex gap-2"><button className={primary}>{busy ? 'Saving…' : 'Save lead'}</button><button className={button} type="button" onClick={onCancel}>Cancel</button></div></fieldset></form>
}

export function InquiryInformation({ lead }: { lead: Lead }) {
  const inquiry = lead.inquiry || {}
  return <dl className="space-y-3 text-sm"><div><dt className="font-semibold">Contact</dt><dd>{lead.firstName} {lead.lastName}<br />{lead.email}<br />{lead.phone || 'No phone'}</dd></div><div><dt className="font-semibold">Submitted</dt><dd>{new Date(lead.createdAt).toLocaleString()}</dd></div>{Object.entries(inquiry).filter(([key, value]) => key !== 'campers' && value != null && value !== '' && (!Array.isArray(value) || value.length)).map(([key, value]) => <div key={key}><dt className="font-semibold">{{ athleteAge: 'Age reported on original form', childAges: 'Ages reported on original form', interests: 'Interests', interest: 'Original interest', classTypes: 'Class types', submitterRole: 'Submitted by', source: 'Inquiry source' }[key] || key}</dt><dd className="whitespace-pre-wrap">{Array.isArray(value) ? value.join(', ') : String(value)}</dd></div>)}<div><dt className="font-semibold">Children</dt><dd><KidDetails children={inquiry.campers || []} />{inquiry.campers?.map((child, index) => child.dateOfBirth ? <p key={index} className="mt-1 text-slate-500">Child {index + 1} birthday: {formatDateForDisplay(child.dateOfBirth)}</p> : null)}</dd></div><div><dt className="font-semibold">Inquiry message</dt><dd className="whitespace-pre-wrap">{lead.message || 'No message'}</dd></div></dl>
}
