import { formatPhoneForDisplay } from '../../utils/phoneUtils'
import { Suspense, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, CreditCard, Plus, Users } from 'lucide-react'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import { calculateAge, getTodayDateString, parseDateOnly } from '../../utils/dateUtils'
import { allowed, request, useRead, type Access, type BillingTarget } from './api'
import { button, cell, Dialog, Empty, ErrorNotice, input, Loading, primary, Status } from './shared'
import EnrollmentActions from './EnrollmentActions'
import AccountNotes from './AccountNotes'
import MemberRecordActions from '../admin/MemberRecordActions'
import MemberAccountSecurityTab from '../admin/memberAccount/MemberAccountSecurityTab'
import TextInput from '../common/TextInput'

const NewEnrollment = lazyWithRetry(() => import('../customerBilling/NewBillingEnrollmentModal'))
interface Person { id: number; name: string; firstName: string; lastName: string; email: string | null; phone: string | null; dateOfBirth: string | null; isActive: boolean; isOwner?: boolean; currentHousehold: boolean; guardianFor: number[] }
interface HistoryRow { key: string; date: string | null; kind: string; memberId: number | null; title: string; summary: string; source: string; amountCents: number | null }
interface HistoryPage { rows: HistoryRow[]; nextCursor: string | null }
interface Workspace {
  family: { id: number; name: string; archived: boolean }
  today?: string
  people: Person[]
  participation: Array<{ id: number; memberId: number; className: string; status: string; startDate: string | null; cancelDate: string | null; slots: Array<{ day: number | null; start: string; end: string; date: string | null; week: string | null }> }>
  trials: { rows: Array<{ id: number; memberId: number; className: string; date: string; kind: string; status: string }>; total: number }
  leads: { rows: Array<{ id: number; name: string; status: string; createdAt: string; contactedAt: string | null; followUp: boolean; archived: boolean; linkType: string; message: string | null; notes: string | null }>; total: number }
  financial: null | { accountId: number; payerMemberId: number | null; billingEmail: string | null; billingPhone: string | null; outstandingBalanceCents: number; futureCreditsCents: number; balanceCents: number; nextBillDate: string | null; recurringBillingMonth: string; currency?: string;
    memberships: Array<{ memberId: number; active: boolean; membershipDate: string | null; renewalDate: string | null; autoRenewal: boolean }>;
    paymentMethod: { available: boolean; syncStatus: string; syncedAt: string | null; brand: string | null; last4: string | null } }
  financialIssue?: string | null
  permissions: { canViewBilling: boolean }
  history: HistoryPage
  generatedAt: string
  coverage: string
}
const tabs = ['Overview', 'People', 'Classes', 'Trials and drop-ins', 'Leads & Notes', 'History'] as const
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : 'Not recorded'

export default function FamilyWorkspace({ familyId, memberId, access, revision, onBack, onBilling, onEdit, onChanged, onMemberDeleted, onIndividualProfile }: {
  familyId: number | null; memberId: number | null; access: Access; revision: number;
  onBack: () => void; onBilling: (target: BillingTarget) => void; onEdit: (id: number) => void; onChanged: () => void; onMemberDeleted: (id: number) => void; onIndividualProfile?: () => void
}) {
  const path = familyId != null ? `/api/admin/new-admin/families/${familyId}/workspace` : `/api/admin/new-admin/members/${memberId}/workspace`
  const state = useRead<Workspace>(path, revision)
  const [tab, setTab] = useState<typeof tabs[number]>('Overview')
  const [personId, setPersonId] = useState<number | null>(null)
  const [addingMember, setAddingMember] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [securityMemberId, setSecurityMemberId] = useState<number | null>(null)
  const [action, setAction] = useState<{ memberId: number; id: number } | null>(null)
  const data = state.data
  const name = (id: number | null) => data?.people.find(p => p.id === id)?.name || (id ? `Member #${id}` : 'Family')
  const canEdit = allowed(access, 'members.edit')
  const canEnroll = canEdit && allowed(access, 'scheduling.manage')
  const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: data?.financial?.currency || 'USD' }).format(cents / 100)
  return <section aria-label="Unified family workspace" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><button className={button} onClick={onBack}><ArrowLeft className="h-4 w-4" />All families and people</button></div>
    <ErrorNotice message={state.error} onRetry={onChanged} />
    {state.error && onIndividualProfile ? <button className={button} onClick={onIndividualProfile}>Open individual profile</button> : null}
    {state.loading ? <Loading label="Loading family workspace…" /> : data ? <>
      <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-red-700">Family workspace · #{data.family.id}</p><h2 className="mt-2 text-2xl font-bold text-slate-950">{data.family.name || 'Unnamed family'}</h2><p className="mt-2 text-sm text-slate-500">{data.people.filter(p => p.currentHousehold).length} current people · {data.participation.length} current / upcoming class records{data.family.archived ? ' · Archived family' : ''}</p></div>
          <div className="flex flex-wrap gap-2">
            {canEdit && !data.family.archived ? <button className={button} onClick={() => setAddingMember(true)}><Plus aria-hidden="true" className="h-4 w-4" />New family member</button> : null}
            {canEnroll && data.people.some(p => p.currentHousehold) ? <button className={button} onClick={() => setEnrolling(true)}><Plus className="h-4 w-4" />Enroll family member</button> : null}
            {data.permissions.canViewBilling ? <button className={primary} onClick={() => onBilling({ familyId: data.family.id, memberId: personId })}><CreditCard className="h-4 w-4" />Billing & payments</button> : null}
          </div>
        </div>
        {data.financial ? <div className="mt-6 grid gap-3 sm:grid-cols-3"><Summary label="Outstanding balance" value={money(data.financial.outstandingBalanceCents)} /><Summary label="Available credit" value={money(data.financial.futureCreditsCents)} /><Summary label="Next scheduled bill" value={dateLabel(data.financial.nextBillDate)} /></div> : <p className="mt-5 text-sm text-slate-500">{data.financialIssue || (data.permissions.canViewBilling ? 'No active billing account is linked. Existing history is retained below.' : 'Billing and financial history require billing access.')}</p>}
      </header>
      <nav aria-label="Family workspace sections" className="flex flex-wrap gap-2">{tabs.map(item => <button key={item} className={`${button} ${tab === item ? '!border-slate-950 !bg-slate-950 !text-white' : ''}`} aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}</nav>
      {(tab === 'People' || tab === 'Overview') ? <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 font-bold"><Users className="h-4 w-4" />People and responsibilities</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{data.people.map(person => <div key={person.id} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="font-semibold">{person.name}{data.financial?.payerMemberId === person.id ? ' · Payer' : ''}</p>
              <p className="mt-1 text-xs text-slate-500">{!person.isActive ? 'Archived' : person.currentHousehold ? 'Current household' : 'Former household member'} · Member #{person.id}</p>
            </div>
            {canEdit && person.currentHousehold ? <div className="flex flex-wrap gap-2">
              <button className={button} onClick={() => onEdit(person.id)}>Edit</button>
              {person.isActive ? <button className={button} aria-label={`Account security for ${person.name}`} onClick={() => setSecurityMemberId(person.id)}>Account security</button> : null}
            </div> : null}
          </div>
          <p className="mt-3 break-all text-sm text-slate-600">{person.email || 'No email'} · {formatPhoneForDisplay(person.phone) || 'No phone'}</p>
          <p className="mt-1 text-xs text-slate-500">Born {dateLabel(person.dateOfBirth)}</p>
          {person.guardianFor.length ? <p className="mt-2 text-xs text-slate-600">Guardian for {person.guardianFor.map(name).join(', ')}</p> : null}
          {access.isMasterAdmin && !person.isOwner && (!person.isActive || person.currentHousehold) ? <div className="mt-3">
            <MemberRecordActions record={{ kind: 'member', id: person.id, name: person.name, archived: !person.isActive }} onChanged={action => {
              if (action === 'delete') {
                if (personId === person.id) setPersonId(null)
                onMemberDeleted(person.id)
              } else onChanged()
            }} />
          </div> : null}
        </div>)}</div>
        {!data.people.length ? <Empty>No linked people.</Empty> : null}
      </div> : null}
      {(tab === 'Classes' || tab === 'Trials and drop-ins') ? <label className="block text-sm font-semibold">Show person<select className="ml-3 rounded-lg border border-slate-300 bg-white px-3 py-2" value={personId ?? ''} onChange={event => setPersonId(event.target.value ? Number(event.target.value) : null)}><option value="">Everyone</option>{data.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label> : null}
      {(tab === 'Classes' || tab === 'Overview') ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5"><h3 className="mb-4 font-bold">Current and upcoming classes</h3>{data.participation.length ? <table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Person / class', 'Schedule', 'Status', 'Actions'].map(label => <th scope="col" key={label} className={cell}>{label}</th>)}</tr></thead><tbody>{data.participation.filter(r => tab === 'Overview' || personId == null || r.memberId === personId).map(row => <tr key={row.id} className="border-t border-slate-100"><td className={cell}><p className="font-semibold">{row.className}</p><p className="text-xs text-slate-500">{name(row.memberId)} · Starts {dateLabel(row.startDate)}</p></td><td className={cell}>{row.slots.length ? row.slots.map((slot, i) => <p key={i}>{slot.date ? dateLabel(slot.date) : days[slot.day ?? 0]} {slot.start?.slice(0, 5)}–{slot.end?.slice(0, 5)}{slot.week ? ` · ${slot.week}` : ''}</p>) : 'Schedule not recorded'}</td><td className={cell}><Status value={row.status} />{row.cancelDate ? <p className="mt-1 text-xs">Ends {dateLabel(row.cancelDate)}</p> : null}</td><td className={cell}>{canEnroll ? <button className={button} onClick={() => setAction(row)}>Manage</button> : null}</td></tr>)}</tbody></table> : <Empty>No current classes. Previous enrollments are available in History.</Empty>}</div> : null}
      {tab === 'Overview' && data.financial ? <div className="grid gap-5 lg:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-bold">Membership coverage</h3><div className="mt-3 divide-y divide-slate-100">{data.financial.memberships.map(m => <div key={m.memberId} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{name(m.memberId)}</span><span>{m.active ? 'Active' : 'No current coverage'} · Renews {dateLabel(m.renewalDate)}{m.autoRenewal ? ' · Auto-renewal' : ''}</span></div>)}</div></div><div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-bold">Billing contact and payment method</h3><p className="mt-3 text-sm">{name(data.financial.payerMemberId)}</p><p className="mt-1 break-all text-sm text-slate-500">{data.financial.billingEmail || 'No billing email'} · {formatPhoneForDisplay(data.financial.billingPhone) || 'No billing phone'}</p><p className="mt-4 text-sm">{data.financial.paymentMethod.last4 ? `${data.financial.paymentMethod.brand || 'Card'} ending ${data.financial.paymentMethod.last4}` : 'No saved card details available'}</p><p className="mt-1 text-xs text-slate-500">Saved payment status: {data.financial.paymentMethod.syncStatus}. Last updated {dateLabel(data.financial.paymentMethod.syncedAt)}.</p></div></div> : null}
      {tab === 'Trials and drop-ins' ? <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-bold">Trials and drop-ins · {data.trials.total}</h3><p className="mt-1 text-xs text-slate-500">Latest 25 bookings. Older bookings remain in History.</p><div className="mt-4 divide-y divide-slate-100">{data.trials.rows.filter(r => personId == null || r.memberId === personId).map(row => <div key={row.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><p className="font-semibold">{row.className}</p><p className="text-slate-500">{name(row.memberId)} · {dateLabel(row.date)} · {row.kind.replaceAll('_', ' ')}</p></div><Status value={row.status} /></div>)}</div>{!data.trials.total ? <Empty>No recorded trials or drop-ins.</Empty> : null}</div> : null}
      {tab === 'Leads & Notes' ? <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <AccountNotes key={data.family.id} endpoint={`/api/admin/new-admin/families/${data.family.id}/notes`} revision={revision} canManage={allowed(access, 'members.edit')} subjectType="family" subjectId={data.family.id} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-bold">Inquiries and follow-up · {data.leads.total}</h3>
          <p className="mt-1 text-xs text-slate-500">Latest 25 linked inquiries; older inquiries remain in History. Contact matches are shown separately from explicit conversions.</p>
          <div className="mt-4 space-y-3">{data.leads.rows.map(row => <article key={row.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{row.name} · Inquiry #{row.id}</p><Status value={row.status || 'new'} /></div>
            <p className="mt-1 text-xs text-slate-500">{dateLabel(row.createdAt)} · {row.linkType === 'explicit_conversion' ? 'Explicit conversion' : 'Contact match'}{row.followUp ? ' · Follow-up needed' : ''}{row.archived ? ' · Archived' : ''}</p>
            {row.message ? <p className="mt-3 whitespace-pre-wrap text-sm">{row.message}</p> : null}
            {row.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">Staff note: {row.notes}</p> : null}
          </article>)}</div>
          {!data.leads.total ? <Empty>No linked inquiries. Unmatched inquiries remain in Leads.</Empty> : null}
        </div>
      </div> : null}
      {tab === 'History' || tab === 'Overview' ? <FamilyHistory key={`${data.family.id}:${data.generatedAt}`} familyId={data.family.id} initial={data.history} people={data.people} coverage={data.coverage} /> : null}
      {addingMember && canEdit && !data.family.archived ? <NewFamilyMember family={data.family} people={data.people} today={data.today} onClose={() => setAddingMember(false)} onAdded={() => {
        setAddingMember(false)
        setTab('People')
        onChanged()
      }} /> : null}
      {enrolling ? <Suspense fallback={<Loading />}><NewEnrollment members={data.people.filter(p => p.currentHousehold)} initialMemberId={data.people.some(p => p.currentHousehold && p.id === personId) ? personId : null} onClose={() => setEnrolling(false)} onCreated={() => { setEnrolling(false); onChanged() }} /></Suspense> : null}
      {action ? <EnrollmentActions memberId={action.memberId} enrollmentId={action.id} onClose={() => setAction(null)} onChanged={() => { setAction(null); onChanged() }} /> : null}
    </> : null}
    {securityMemberId != null ? <Dialog title={`${name(securityMemberId)} · Account security`} onClose={() => setSecurityMemberId(null)}>
      <MemberAccountSecurityTab key={securityMemberId} memberId={securityMemberId} />
    </Dialog> : null}
  </section>
}

function NewFamilyMember({ family, people, today = getTodayDateString(), onClose, onAdded }: {
  family: Workspace['family']; people: Person[]; today?: string; onClose: () => void; onAdded: () => void
}) {
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const asOf = parseDateOnly(today) ?? new Date()
  const age = calculateAge(dateOfBirth, asOf)
  const needsGuardian = age != null && age < 18
  const guardians = people.filter(person => person.currentHousehold && (calculateAge(person.dateOfBirth, asOf) ?? 0) >= 18)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || (needsGuardian && !guardians.length)) return
    const fields = new FormData(event.currentTarget)
    const firstName = String(fields.get('firstName') ?? '').trim()
    const lastName = String(fields.get('lastName') ?? '').trim()
    if (!firstName || !lastName) {
      setError('First and last name are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await request('/api/admin/new-admin/members', {
        method: 'POST',
        body: JSON.stringify({
          familyId: family.id,
          firstName,
          lastName,
          dateOfBirth,
          email: String(fields.get('email') ?? '').trim() || null,
          phone: formatPhoneForDisplay(String(fields.get('phone') ?? '')) || null,
          legalGuardianMemberId: needsGuardian ? Number(fields.get('legalGuardianMemberId')) : null,
        }),
      })
      onAdded()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add family member.')
    } finally {
      setSaving(false)
    }
  }

  return <Dialog title="New family member" onClose={() => { if (!saving) onClose() }}>
    <form className="max-w-xl space-y-4" onSubmit={submit}>
      <p className="text-sm text-slate-600">Add a person to {family.name || 'this family'}.</p>
      <ErrorNotice message={error} />
      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={saving}>
        <label className="text-sm font-medium">First name<input className={input} name="firstName" maxLength={100} required /></label>
        <label className="text-sm font-medium">Last name<input className={input} name="lastName" maxLength={100} required /></label>
        <label className="text-sm font-medium">Date of birth<input className={input} type="date" required max={today} value={dateOfBirth} onChange={event => setDateOfBirth(event.target.value)} /></label>
        <label className="text-sm font-medium">Email (optional)<input className={input} type="email" name="email" /></label>
        <label className="text-sm font-medium">Phone (optional)<TextInput className={input} type="tel" name="phone" /></label>
        {needsGuardian && guardians.length > 0 ? <label className="text-sm font-medium">Legal guardian
          <select className={input} name="legalGuardianMemberId" required defaultValue="">
            <option value="" disabled>Select a legal guardian</option>
            {guardians.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label> : null}
      </fieldset>
      {needsGuardian && !guardians.length ? <p className="text-sm text-slate-600">Add an adult to this family or verify an adult’s date of birth before adding a minor.</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button className={button} type="button" onClick={onClose} disabled={saving}>Cancel</button>
        <button className={primary} type="submit" disabled={saving || (needsGuardian && !guardians.length)}>{saving ? 'Adding…' : 'Add family member'}</button>
      </div>
    </form>
  </Dialog>
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-950">{value}</p></div> }
function FamilyHistory({ familyId, initial, people, coverage }: { familyId: number; initial: HistoryPage; people: Person[]; coverage: string }) {
  const [page, setPage] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const loadMore = async () => {
    if (!page.nextCursor || inFlight.current) return
    inFlight.current = true; setLoading(true); setError(null)
    try {
      const next = await request<HistoryPage>(`/api/admin/new-admin/families/${familyId}/history?cursor=${encodeURIComponent(page.nextCursor)}`)
      setPage(current => ({ rows: [...new Map([...current.rows, ...next.rows].map(row => [row.key, row])).values()], nextCursor: next.nextCursor }))
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load older history.') }
    finally { inFlight.current = false; setLoading(false) }
  }
  return <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-bold">Account and enrollment history</h3><p className="mt-2 text-xs leading-relaxed text-slate-500">{coverage}</p><ol className="mt-4 divide-y divide-slate-100">{page.rows.map(row => <li key={row.key} className="py-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-slate-900">{row.title}</p><span className="text-xs text-slate-500">{row.source} · {dateLabel(row.date)}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{row.summary}</p>{row.memberId ? <p className="mt-1 text-xs text-slate-500">{people.find(p => p.id === row.memberId)?.name || `Member #${row.memberId}`}</p> : null}{row.amountCents != null ? <p className="mt-1 text-xs text-slate-500">Source amount: {(row.amountCents / 100).toFixed(2)}</p> : null}</li>)}</ol>{!page.rows.length ? <Empty>No recorded history.</Empty> : null}<ErrorNotice message={error} />{page.nextCursor ? <button className={button} disabled={loading} onClick={() => void loadMore()}>{loading ? 'Loading…' : 'Load older history'}</button> : null}</div>
}
