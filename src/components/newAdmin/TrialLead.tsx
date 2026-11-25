import { useState, type FormEvent } from 'react'
import TextInput from '../common/TextInput'
import { request, useRead } from './api'
import { button, Dialog, ErrorNotice, input, Loading, primary } from './shared'
import { leadDisplayName, type Lead, type LeadChild } from './leadTypes'

type Guardian = { firstName: string; lastName: string; email: string; phone: string }
type TrialInvitation = {
  id: number; status: string; username: string; email: string; expiresAt: string; revision: number
  guardian: Guardian; children: LeadChild[]; instructions: string
}
const defaultDays = 7

export default function TrialLead({ lead, onClose, onSent }: { lead: Lead; onClose: () => void; onSent: () => void }) {
  const existing = useRead<TrialInvitation>(lead.invitation ? `/api/admin/new-admin/lead-registration/${lead.invitation.id}` : null)
  const [result, setResult] = useState<TrialInvitation | null>(null)
  const [editing, setEditing] = useState(false)
  const [guardian, setGuardian] = useState<Guardian>({ firstName: lead.firstName, lastName: lead.lastName, email: lead.email, phone: lead.phone || '' })
  const [children, setChildren] = useState<LeadChild[]>(lead.inquiry?.campers || [])
  const [instructions, setInstructions] = useState('')
  const [days, setDays] = useState(String(defaultDays))
  const [requestKey] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const invitation = result || (existing.data?.status !== 'expired' ? existing.data : null)

  const edit = () => {
    if (!invitation) return
    setGuardian(invitation.guardian)
    setChildren(invitation.children || [])
    setInstructions(invitation.instructions || '')
    setDays(String(Math.max(1, Math.min(30, Math.ceil((Date.parse(invitation.expiresAt) - Date.now()) / 86400000)))))
    setError(null)
    setEditing(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const saved = await request<TrialInvitation>(editing && invitation ? `/api/admin/new-admin/lead-registration/${invitation.id}` : `/api/admin/new-admin/leads/${lead.id}/trial`, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({ mode: 'trial', children, selections: [], instructions, holdDays: Number(days || defaultDays), requestKey,
          ...(editing && invitation ? { guardian, revision: invitation.revision } : {}) }),
      })
      setResult(saved)
      setEditing(false)
      onSent()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send trial invitation.')
    } finally { setBusy(false) }
  }

  const resend = async () => {
    if (!invitation || busy) return
    setBusy(true)
    setError(null)
    try {
      setResult(await request<TrialInvitation>(`/api/admin/new-admin/lead-registration/${invitation.id}/send`, { method: 'POST' }))
      onSent()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send trial invitation.')
    } finally { setBusy(false) }
  }

  const updateChild = (index: number, values: Partial<LeadChild>) => setChildren(current => current.map((child, i) => i === index ? { ...child, ...values } : child))

  return <Dialog title={`Trial · ${leadDisplayName(lead)}`} onClose={onClose}>
    <ErrorNotice message={error || existing.error} />
    {existing.loading ? <Loading /> : existing.error && !result ? null : invitation && !editing ? <section className="max-w-3xl space-y-4">
      <h3 className="text-lg font-semibold">{invitation.status === 'completed' ? 'Trial account setup completed' : invitation.status === 'sent' ? 'Trial invitation sent' : 'Trial invitation saved — email not sent'}</h3>
      <p>{invitation.email || lead.email} · Username: <strong>{invitation.username}</strong></p>
      <p>{invitation.status === 'completed' ? 'The family can choose an available free trial date after completing their information and waivers. Bookings appear in Free Trials next to each child.' : `The parent will complete family information and sign waivers, then choose a specific free trial class and date. Finish account setup by ${new Date(invitation.expiresAt).toLocaleDateString()}.`}</p>
      <p className="text-sm text-slate-600">The family stays under Leads while trying a class.</p>
      {invitation.children?.length > 0 && <ul className="list-inside list-disc">{invitation.children.map((child, index) => <li key={index}>{[child.firstName, child.lastName].filter(Boolean).join(' ') || `Child ${index + 1}`}</li>)}</ul>}
      {invitation.instructions && <p className="whitespace-pre-wrap text-sm">{invitation.instructions}</p>}
      <div className="flex flex-wrap gap-2">
        {invitation.status !== 'completed' && <>
          <button className={button} disabled={busy} onClick={edit}>Edit</button>
          <button className={primary} disabled={busy} onClick={() => void resend()}>{busy ? 'Sending…' : invitation.status === 'sent' ? 'Resend trial invitation' : 'Retry sending email'}</button>
        </>}
        <button className={button} onClick={onClose}>Done</button>
      </div>
    </section> : <form onSubmit={submit} className="space-y-5">
      <p className="max-w-3xl text-sm text-slate-600">Send a free trial invitation to {lead.email || 'the parent’s email address'}. The parent will complete family information and sign the required waivers, then choose from available free trial dates.</p>
      <fieldset disabled={busy} className="space-y-5">
        {editing && <section className="space-y-3">
          <h3 className="font-semibold">Contact information</h3>
          <div className="grid gap-3 sm:grid-cols-2">{(['firstName', 'lastName', 'email', 'phone'] as const).map(key => <label key={key} className="text-sm">
            {{ firstName: 'Contact first name', lastName: 'Contact last name', email: 'Contact email', phone: 'Contact phone' }[key]}
            <TextInput className={input} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} required={key === 'email'} value={guardian[key]} onChange={event => setGuardian(current => ({ ...current, [key]: event.target.value }))} />
          </label>)}</div>
        </section>}
        <section className="space-y-3">
          <h3 className="font-semibold">Children</h3>
          <p className="text-sm text-slate-500">Add the details you have. The parent can complete them and add children during signup.</p>
          {children.map((child, index) => <fieldset key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-medium">Child {index + 1}</legend>
            {(['firstName', 'lastName', 'dateOfBirth'] as const).map(key => <label key={key} className="text-sm">
              Child {index + 1} {{ firstName: 'first name', lastName: 'last name', dateOfBirth: 'birthday' }[key]}
              <input className={input} type={key === 'dateOfBirth' ? 'date' : 'text'} value={child[key] || ''} onChange={event => updateChild(index, { [key]: event.target.value })} />
            </label>)}
            <label className="text-sm">Child {index + 1} gender<select className={input} value={child.gender || ''} onChange={event => updateChild(index, { gender: event.target.value })}><option value="">Not provided</option><option value="male">Male</option><option value="female">Female</option></select></label>
            <button type="button" className={`${button} justify-self-start sm:col-span-2`} onClick={() => setChildren(current => current.filter((_, i) => i !== index))}>Remove child {index + 1}</button>
          </fieldset>)}
          <button type="button" className={button} onClick={() => setChildren(current => [...current, {}])}>Add child</button>
        </section>
        <label className="block max-w-xs text-sm font-medium">Days to finish registration<input className={input} type="number" min="1" max="30" placeholder={String(defaultDays)} value={days} onChange={event => setDays(event.target.value)} /></label>
        <label className="block text-sm font-medium">Instructions for the parent<textarea className={input} rows={3} maxLength={4000} value={instructions} onChange={event => setInstructions(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          <button className={primary}>{busy ? 'Sending…' : editing ? 'Send updated trial invitation' : 'Send trial invitation'}</button>
          {editing && <button type="button" className={button} onClick={() => { setEditing(false); setError(null) }}>Cancel edit</button>}
        </div>
      </fieldset>
    </form>}
  </Dialog>
}
