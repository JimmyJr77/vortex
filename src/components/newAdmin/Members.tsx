import { Suspense, useState } from 'react'
import { ArrowLeft, CreditCard, Plus, Search, Users } from 'lucide-react'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import type { AccountDirectoryRow } from '../admin/accountDirectory'
import EnrollmentActions from './EnrollmentActions'
import { button, cell, Dialog, Empty, ErrorNotice, input, Loading, Pager, primary, Status } from './shared'
import { allowed, useRead, useSearch, type Access, type BillingTarget, type Page } from './api'

const FamilyWorkspace = lazyWithRetry(() => import('./FamilyWorkspace'))
const FamilyDirectory = lazyWithRetry(() => import('./FamilyDirectory'))
const FamilyWizard = lazyWithRetry(() => import('../signup/FamilySignupWizard'))
const NewEnrollment = lazyWithRetry(() => import('../customerBilling/NewBillingEnrollmentModal'))
interface Person { id: number; firstName: string; lastName: string; email: string | null; phone: string | null; dateOfBirth: string | null; isActive: boolean; familyId: number | null; isPayer?: boolean }
interface MemberDetail {
  member: Person
  household: { id: number; name: string; payerMemberId: number | null; members: Person[] } | null
  enrollments: Array<{ id: number; formId: number | null; historical?: boolean; sourceId?: string; className: string; status: string; slotGroupId: number; startDate: string | null; cancelEffectiveDate?: string | null }>
  enrollmentPagination?: { page: number; total: number; totalPages: number }
  billingAccountId: number | null
}
export default function Members({ access, revision, selectedId, selectedFamilyId, onSelectFamily, onSelect, onBilling }: {
  selectedFamilyId: number | null; onSelectFamily: (id: number | null) => void;
  access: Access; revision: number; selectedId: number | null; onSelect: (id: number | null) => void; onBilling: (target: BillingTarget) => void
}) {
  const [directory, setDirectory] = useState<'families' | 'people'>('families')
  const [individualProfileFor, setIndividualProfileFor] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const search = useSearch(query)
  const [page, setPage] = useState(1)
  const [record, setRecord] = useState('active')
  const [version, setVersion] = useState(0)
  const [wizard, setWizard] = useState<number | 'new' | null>(null)
  const refresh = () => setVersion(value => value + 1)
  const data = useRead<Page<AccountDirectoryRow>>(selectedId == null && selectedFamilyId == null && directory === 'people' ? `/api/admin/account-directory?${new URLSearchParams({ search, record, page: String(page), pageSize: '25', sortBy: 'member', sortDir: 'asc' })}` : null, revision + version)
  const showWorkspace = selectedFamilyId != null || (selectedId != null && individualProfileFor !== selectedId)
  return <section>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Families & accounts</h2><p className="mt-1 text-sm text-slate-500">People, family relationships, class enrollments, and household billing.</p></div>{(allowed(access, 'members.edit') && allowed(access, 'scheduling.manage')) ? <button className={primary} onClick={() => setWizard('new')}><Plus className="h-4 w-4" />Create family account</button> : null}</div>
    {showWorkspace ? <Suspense fallback={<Loading />}><FamilyWorkspace key={`${selectedFamilyId ?? 'member'}:${selectedId ?? ''}`} familyId={selectedFamilyId} memberId={selectedId} access={access} revision={revision + version} onBack={() => { onSelect(null); onSelectFamily(null); setIndividualProfileFor(null) }} onBilling={onBilling} onEdit={setWizard} onChanged={refresh} onIndividualProfile={selectedId == null ? undefined : () => setIndividualProfileFor(selectedId)} /></Suspense> : selectedId != null ? <MemberProfile key={selectedId} id={selectedId} access={access} revision={revision + version} onBack={() => onSelect(null)} onSelect={onSelect} onEdit={() => setWizard(selectedId)} onBilling={onBilling} onChanged={refresh} /> : <>
      <div role="group" aria-label="Directory view" className="mb-4 flex gap-2"><button className={button} aria-pressed={directory === 'families'} onClick={() => setDirectory('families')}>Families</button><button className={button} aria-pressed={directory === 'people'} onClick={() => setDirectory('people')}>People</button></div>
      {directory === 'families' ? <Suspense fallback={<Loading />}><FamilyDirectory revision={revision + version} onSelect={onSelectFamily} /></Suspense> : <>
      <div className="mb-4 flex flex-wrap gap-3"><label className="min-w-64 flex-1 text-sm font-medium"><span className="flex items-center gap-2"><Search className="h-4 w-4" />Search members</span><input className={input} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Name, email, phone, or family" /></label><label className="text-sm font-medium">Records<select className={input} value={record} onChange={event => { setRecord(event.target.value); setPage(1) }}><option value="active">Active</option><option value="archived">Archived</option><option value="">All records</option></select></label></div>
      <ErrorNotice message={data.error} onRetry={refresh} />
      {data.loading ? <Loading label="Loading members…" /> : data.data ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">{data.data.rows.length ? <table className="w-full text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr>{['Member', 'Family', 'Participation', 'Portal', 'Actions'].map(title => <th key={title} className={cell}>{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.data.rows.map(row => <tr key={row.id}><td className={cell}><button className="font-semibold text-slate-950 underline decoration-slate-300 underline-offset-4 hover:text-red-700" onClick={() => onSelect(row.id)}>{row.firstName} {row.lastName}</button><p className="mt-1 text-xs text-slate-500">{row.email || 'No email'} · #{row.id}</p></td><td className={cell}>{row.family.name || 'No family assigned'}<p className="mt-1 text-xs capitalize text-slate-500">{row.household.badges.join(' · ')}</p></td><td className={cell}>{row.participation.current} current · {row.participation.upcoming} upcoming</td><td className={cell}><Status value={row.portalAccess.status} /></td><td className={cell}><div className="flex gap-2"><button className={button} onClick={() => onSelect(row.id)}>View</button>{row.family.id && allowed(access, 'billing.view') ? <button className={button} onClick={() => onBilling({ familyId: row.family.id!, memberId: row.id })}>Billing</button> : null}</div></td></tr>)}</tbody></table> : <Empty>No members match these filters.</Empty>}<Pager data={data.data} onPage={setPage} /></div> : null}
      </>}
    </>}
    {wizard != null ? <Dialog title={wizard === 'new' ? 'Create family account' : 'Edit family account'} onClose={() => setWizard(null)}><Suspense fallback={<Loading />}><FamilyWizard mode={wizard === 'new' ? 'admin' : 'admin-edit'} editMemberId={wizard === 'new' ? null : wizard} onCancel={() => setWizard(null)} onComplete={() => { setWizard(null); refresh() }} /></Suspense></Dialog> : null}
  </section>
}

function MemberProfile({ id, access, revision, onBack, onSelect, onEdit, onBilling, onChanged }: {
  id: number; access: Access; revision: number; onBack: () => void; onSelect: (id: number) => void; onEdit: () => void; onBilling: (target: BillingTarget) => void; onChanged: () => void
}) {
  const [page, setPage] = useState(1)
  const [enrollment, setEnrollment] = useState<number | null>(null)
  const [newEnrollment, setNewEnrollment] = useState(false)
  const data = useRead<MemberDetail>(`/api/admin/new-admin/members/${id}?page=${page}&pageSize=25`, revision)
  const detail = data.data
  const canEnroll = allowed(access, 'scheduling.manage') && allowed(access, 'members.edit')
  return <div className="space-y-4"><button className={button} onClick={onBack}><ArrowLeft className="h-4 w-4" />All members</button><ErrorNotice message={data.error} onRetry={onChanged} />{data.loading ? <Loading label="Loading member and household…" /> : detail ? <>
    <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-xl font-bold">{detail.member.firstName} {detail.member.lastName}</h3><p className="mt-2 text-sm text-slate-500">Member #{id} · {detail.member.email || 'No email'} · {detail.member.phone || 'No phone'}</p><p className="mt-1 text-sm text-slate-500">Date of birth: {detail.member.dateOfBirth?.slice(0, 10) || 'Not recorded'}</p></div><div className="flex flex-wrap gap-2">{allowed(access, 'members.edit') ? <button className={button} onClick={onEdit}>Edit account</button> : null}{detail.household && allowed(access, 'billing.view') ? <button className={primary} onClick={() => onBilling({ familyId: detail.household!.id, memberId: id })}><CreditCard className="h-4 w-4" />Billing & history</button> : null}</div></div></div>
    <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 font-bold"><Users className="h-4 w-4" />{detail.household?.name || 'Household'}</h3>{detail.household ? <div className="mt-4 flex flex-wrap gap-2">{detail.household.members.map(person => <button className={button} key={person.id} onClick={() => onSelect(person.id)}>{person.firstName} {person.lastName}{person.isPayer || person.id === detail.household?.payerMemberId ? ' · Payer' : ''}</button>)}</div> : <p className="mt-3 text-sm text-slate-500">No household is assigned.</p>}</div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between gap-3 p-5"><h3 className="font-bold">Class enrollments</h3>{canEnroll ? <button className={button} onClick={() => setNewEnrollment(true)}><Plus className="h-4 w-4" />Enroll member</button> : null}</div>{detail.enrollments.length ? <table className="w-full text-sm"><thead className="bg-slate-100"><tr>{['Class', 'Status', 'Start date', 'Actions'].map(title => <th className={cell} key={title}>{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{detail.enrollments.map(row => <tr key={row.id}><td className={cell}>{row.className}<p className="text-xs text-slate-500">{row.historical ? 'Historical registration' : `Enrollment #${row.id}`} </p></td><td className={cell}><Status value={row.status} />{row.cancelEffectiveDate ? <p className="mt-1 text-xs text-slate-500">Cancels {row.cancelEffectiveDate.slice(0, 10)}</p> : null}</td><td className={cell}>{row.startDate?.slice(0, 10) || '—'}</td><td className={cell}>{canEnroll && !row.historical ? <button className={button} onClick={() => setEnrollment(row.id)}>Manage enrollment</button> : null}</td></tr>)}</tbody></table> : <Empty>This member has no class enrollments.</Empty>}{detail.enrollmentPagination ? <Pager data={detail.enrollmentPagination} onPage={setPage} /> : null}</div>
    {newEnrollment ? <Suspense fallback={<Loading />}><NewEnrollment members={(detail.household?.members ?? [detail.member]).map(person => ({ ...person, name: `${person.firstName} ${person.lastName}` }))} initialMemberId={id} onClose={() => setNewEnrollment(false)} onCreated={() => { setNewEnrollment(false); onChanged() }} /></Suspense> : null}
    {enrollment != null ? <EnrollmentActions memberId={id} enrollmentId={enrollment} onClose={() => setEnrollment(null)} onChanged={() => { setEnrollment(null); onChanged() }} /> : null}
  </> : null}</div>
}
