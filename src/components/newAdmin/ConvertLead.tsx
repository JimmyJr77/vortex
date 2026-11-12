import { useState, type FormEvent } from 'react'
import { allowed, request, useRead, type Access } from './api'
import { button, Dialog, ErrorNotice, input, Loading, primary } from './shared'
import type { Lead, LeadChild } from './leadTypes'

type Selection = {
  kind: 'program' | 'class' | 'reserved'
  childIndex: number | ''
  programsId: number | ''
  classEventId: number | ''
  timeSlotId: number | ''
  enrollmentStartDate: string
}
type CatalogRow = { programs_id: number; program_name: string; class_id: number | null; class_name: string; slot_id: number | null; day_of_week: number; specific_date: string | null; start_time: string; end_time: string; max_participants: number; occupied: number }
type Invitation = { id: number; status: string; username: string; email: string; expiresAt: string; selections: { label: string; childName: string; kind: string }[] }
const unique = (rows: CatalogRow[], key: 'programs_id' | 'class_id' | 'slot_id') => rows.filter((row, index) => row[key] && rows.findIndex(other => other[key] === row[key]) === index)
const childFields = { firstName: 'first name', lastName: 'last name', dateOfBirth: 'birthday' } as const
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const defaultHoldDays = 7

export default function ConvertLead({ lead, access, onClose, onSent }: { lead: Lead; access: Access; onClose: () => void; onSent: () => void }) {
  const catalog = useRead<CatalogRow[]>('/api/admin/new-admin/lead-registration/catalog')
  const existing = useRead<Invitation>(lead.invitation ? `/api/admin/new-admin/lead-registration/${lead.invitation.id}` : null)
  const [result, setResult] = useState<Invitation | null>(null)
  const [children, setChildren] = useState<LeadChild[]>(lead.inquiry?.campers || [])
  const [selections, setSelections] = useState<Selection[]>([])
  const [instructions, setInstructions] = useState('')
  const [holdDays, setHoldDays] = useState(String(defaultHoldDays))
  const [mode, setMode] = useState('invite')
  const [memberId, setMemberId] = useState('')
  const [requestKey] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const invitation = result || (existing.data?.status !== 'expired' ? existing.data : null)
  const canReserve = allowed(access, 'scheduling.manage')
  const rows = (catalog.data || []).filter(row => row.slot_id != null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const endpoint = `/api/admin/new-admin/leads/${lead.id}/convert`
    try {
      if (mode === 'existing') {
        await request(endpoint, { method: 'POST', body: JSON.stringify({ memberId: Number(memberId) }) })
        onSent()
        onClose()
        return
      }
      const saved = await request<Invitation>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ mode, children, selections, instructions, holdDays: Number(holdDays || defaultHoldDays), requestKey }),
      })
      setResult(saved)
      onSent()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send registration invitation.')
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (!invitation) return
    setBusy(true)
    setError(null)
    try {
      setResult(await request<Invitation>(`/api/admin/new-admin/lead-registration/${invitation.id}/send`, { method: 'POST' }))
      onSent()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send invitation.')
    } finally {
      setBusy(false)
    }
  }

  const updateSelection = (index: number, values: Partial<Selection>) => {
    setSelections(current => current.map((item, i) => i === index ? { ...item, ...values } : item))
  }
  const updateChild = (index: number, values: Partial<LeadChild>) => {
    setChildren(current => current.map((child, i) => i === index ? { ...child, ...values } : child))
  }
  const removeChild = (index: number) => {
    setChildren(current => current.filter((_, i) => i !== index))
    setSelections(current => current.map(item => {
      if (item.childIndex === index) return { ...item, childIndex: '' }
      if (item.childIndex !== '' && item.childIndex > index) return { ...item, childIndex: item.childIndex - 1 }
      return item
    }))
  }

  return (
    <Dialog title={`Convert ${lead.firstName} ${lead.lastName}`} onClose={onClose}>
      <ErrorNotice message={error || catalog.error || existing.error} />
      {existing.loading ? <Loading /> : invitation ? (
        <section className="max-w-3xl space-y-4">
          <h3 className="text-lg font-semibold">{invitation.status === 'sent' ? 'Registration email sent' : invitation.status === 'completed' ? 'Account setup completed' : 'Invitation saved — email not sent'}</h3>
          <p>{invitation.email || lead.email} · Username: <strong>{invitation.username}</strong></p>
          <p>Registration deadline: {new Date(invitation.expiresAt).toLocaleDateString()}. Reserved places remain pending setup and payment until that date.</p>
          <ul className="list-inside list-disc">
            {invitation.selections.map((item, index) => (
              <li key={index}>{item.childName || 'Any family member'} · {item.label} {item.kind === 'reserved' ? '(reserved)' : ''}</li>
            ))}
          </ul>
          {invitation.status !== 'completed' && (
            <button className={primary} disabled={busy} onClick={() => void resend()}>
              {busy ? 'Sending…' : invitation.status === 'sent' ? 'Resend registration email' : 'Retry sending email'}
            </button>
          )}
          <button className={`${button} ml-2`} onClick={onClose}>Done</button>
        </section>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <p className="max-w-3xl text-sm text-slate-600">Send a family invitation to {lead.email}. The parent will complete missing details and required forms, then review your class selections and finish enrollment.</p>
          <fieldset disabled={busy} className="space-y-5">
            <label className="block max-w-lg text-sm font-medium">
              Conversion
              <select className={input} value={mode} onChange={event => setMode(event.target.value)}>
                <option value="invite">Send new family registration invitation</option>
                <option value="existing">Link verified existing member (no new credentials)</option>
              </select>
            </label>
            {mode === 'existing' ? (
              <label className="block max-w-lg text-sm font-medium">
                Verified member ID
                <input className={input} type="number" min="1" required value={memberId} onChange={event => setMemberId(event.target.value)} />
              </label>
            ) : (
              <>
                <section className="space-y-3">
                  <h3 className="font-semibold">Children</h3>
                  <p className="text-sm text-slate-500">Enter any details you know. The parent can complete them and add family members during signup.</p>
                  {children.map((child, index) => (
                    <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-4">
                      {(Object.keys(childFields) as (keyof typeof childFields)[]).map(key => (
                        <label key={key} className="text-sm">
                          Child {index + 1} {childFields[key]}
                          <input className={input} type={key === 'dateOfBirth' ? 'date' : 'text'} value={child[key] || ''} onChange={event => updateChild(index, { [key]: event.target.value })} />
                        </label>
                      ))}
                      <label className="text-sm">
                        Gender
                        <select className={input} value={child.gender || ''} onChange={event => updateChild(index, { gender: event.target.value })}>
                          <option value="">Not provided</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </label>
                      <button type="button" className={`${button} justify-self-start sm:col-span-4`} onClick={() => removeChild(index)}>Remove child {index + 1}</button>
                    </div>
                  ))}
                  <button type="button" className={button} onClick={() => setChildren(current => [...current, {}])}>Add child</button>
                </section>
                <section className="space-y-3">
                  <h3 className="font-semibold">Class links and reservations</h3>
                  <p className="text-sm text-slate-500">Leave this empty to send account setup only. Choose Any family member when the parent should pick who enrolls. The parent can also choose a start date.</p>
                  {selections.map((item, index) => {
                    const classes = rows.filter(row => Number(row.programs_id) === Number(item.programsId))
                    const slots = classes.filter(row => Number(row.class_id) === Number(item.classEventId))
                    return (
                      <fieldset key={index} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
                        <legend className="px-1 font-medium">Selection {index + 1}</legend>
                        <label className="text-sm">
                          Link type
                          <select className={input} value={item.kind} onChange={event => {
                            const kind = event.target.value as Selection['kind']
                            updateSelection(index, { kind, ...(kind === 'program' ? { classEventId: '' } : {}), timeSlotId: '' })
                          }}>
                            <option value="program">Choose from a program</option>
                            <option value="class">Choose a time for a class</option>
                            {canReserve && <option value="reserved">Reserve a class and time</option>}
                          </select>
                        </label>
                        <label className="text-sm">
                          Child
                          <select className={input} value={item.childIndex} onChange={event => updateSelection(index, { childIndex: event.target.value === '' ? '' : Number(event.target.value) })}>
                            <option value="">Any family member</option>
                            {children.map((child, i) => <option key={i} value={i}>{child.firstName || `Child ${i + 1}`} {child.lastName}</option>)}
                          </select>
                        </label>
                        <label className="text-sm">
                          Program
                          <select className={input} required value={item.programsId} onChange={event => updateSelection(index, { programsId: event.target.value ? Number(event.target.value) : '', classEventId: '', timeSlotId: '' })}>
                            <option value="">Select program</option>
                            {unique(rows, 'programs_id').map(row => <option key={row.programs_id} value={row.programs_id}>{row.program_name}</option>)}
                          </select>
                        </label>
                        {item.kind !== 'program' && (
                          <label className="text-sm">
                            Class
                            <select className={input} required value={item.classEventId} onChange={event => updateSelection(index, { classEventId: event.target.value ? Number(event.target.value) : '', timeSlotId: '' })}>
                              <option value="">Select class</option>
                              {unique(classes, 'class_id').map(row => <option key={row.class_id} value={row.class_id!}>{row.class_name}</option>)}
                            </select>
                          </label>
                        )}
                        {item.kind === 'reserved' && (
                          <label className="text-sm">
                            Class time
                            <select className={input} required value={item.timeSlotId} onChange={event => updateSelection(index, { timeSlotId: event.target.value ? Number(event.target.value) : '' })}>
                              <option value="">Select time</option>
                              {unique(slots, 'slot_id').map(row => {
                                const spots = Math.max(0, Number(row.max_participants) - Number(row.occupied))
                                return (
                                  <option key={row.slot_id} value={row.slot_id!} disabled={!spots}>
                                    {row.specific_date || weekdays[row.day_of_week]} {row.start_time?.slice(0, 5)}–{row.end_time?.slice(0, 5)} · {spots} spots
                                  </option>
                                )
                              })}
                            </select>
                          </label>
                        )}
                        <label className="text-sm">
                          Enrollment start date (optional)
                          <input className={input} type="date" value={item.enrollmentStartDate} onChange={event => updateSelection(index, { enrollmentStartDate: event.target.value })} />
                        </label>
                        <button type="button" className={`${button} self-end justify-self-start`} onClick={() => setSelections(current => current.filter((_, i) => i !== index))}>Remove selection {index + 1}</button>
                      </fieldset>
                    )
                  })}
                  {catalog.data && rows.length === 0 && <p className="text-sm text-slate-500">No class times are available for registration.</p>}
                  <button type="button" className={button} disabled={rows.length === 0} onClick={() => setSelections(current => [...current, { kind: 'program', childIndex: '', programsId: '', classEventId: '', timeSlotId: '', enrollmentStartDate: '' }])}>Add class link or reservation</button>
                </section>
                <label className="block max-w-xs text-sm font-medium">
                  Days to finish registration
                  <input className={input} type="number" min="1" max="30" placeholder={String(defaultHoldDays)} value={holdDays} onChange={event => setHoldDays(event.target.value)} />
                  <span className="text-xs text-slate-500">Reserved spots are released when this deadline passes.</span>
                </label>
                <label className="block text-sm font-medium">
                  Instructions for the parent
                  <textarea className={input} rows={3} maxLength={4000} value={instructions} onChange={event => setInstructions(event.target.value)} />
                </label>
              </>
            )}
            <button className={primary} disabled={busy}>{busy ? 'Submitting…' : mode === 'existing' ? 'Link member' : 'Send registration email'}</button>
          </fieldset>
        </form>
      )}
    </Dialog>
  )
}
