import { Suspense, useState, type FormEvent } from 'react'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import EnrollmentActions from './EnrollmentActions'
import { button, cell, Dialog, Empty, ErrorNotice, input, Loading, Pager, primary, Status } from './shared'
import { allowed, request, useRead, useSearch, type Access, type Page } from './api'

const Scheduling = lazyWithRetry(() => import('./ScheduleEditor'))
const ClassModal = lazyWithRetry(() => import('../programs/ClassEventModal'))
interface ClassRow { id: number; formId: number | null; programsId: number | null; name: string; programName: string | null; isActive: boolean; capacity: number; enrolledCount: number; waitlistCount: number }
interface Slot { id: number; dayOfWeek: number; weekLetter: string | null; specificDate: string | null; startTime: string; endTime: string; scheduleMode: string; isActive: boolean }
interface Group { id: number; capacity: number; enrolledCount: number; waitlistCount: number; activeStart: string | null; activeEnd: string | null; slots: Slot[] }
interface RosterRow { id: number; memberId: number; firstName: string; lastName: string; status: string; startDate: string | null; slotGroupId: number }
interface Detail { class: ClassRow; groups: Group[]; roster: Page<RosterRow>; scheduleTruncated?: boolean }

export default function Classes({ access, revision, onMember }: { access: Access; revision: number; onMember: (id: number) => void }) {
  const [query, setQuery] = useState('')
  const search = useSearch(query)
  const [page, setPage] = useState(1)
  const [id, setId] = useState<number | null>(null)
  const [version, setVersion] = useState(0)
  const [create, setCreate] = useState(false)
  const refresh = () => setVersion(value => value + 1)
  const data = useRead<Page<ClassRow>>(id == null ? `/api/admin/new-admin/classes?${new URLSearchParams({ search, page: String(page), pageSize: '25' })}` : null, revision + version)
  return <section><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Classes & schedules</h2><p className="mt-1 text-sm text-slate-500">Capacity, schedules, and enrolled members in one place.</p></div>{allowed(access, 'classes.manage') ? <button className={primary} onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Create class</button> : null}</div>
    {id != null ? <ClassDetail key={id} id={id} access={access} revision={revision + version} onBack={() => setId(null)} onMember={onMember} onChanged={refresh} /> : <><label className="mb-4 block max-w-xl text-sm font-medium"><span className="flex items-center gap-2"><Search className="h-4 w-4" />Search classes</span><input className={input} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Class or program name" /></label><ErrorNotice message={data.error} onRetry={refresh} />{data.loading ? <Loading label="Loading classes…" /> : data.data ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">{data.data.rows.length ? <table className="w-full text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr>{['Class', 'Program', 'Enrolled', 'Capacity', 'Waitlisted', 'Status'].map(title => <th className={cell} key={title}>{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.data.rows.map(row => <tr key={row.id}><td className={cell}><button className="font-semibold underline decoration-slate-300 underline-offset-4 hover:text-red-700" disabled={!allowed(access, 'members.view')} onClick={() => setId(row.id)}>{row.name}</button><p className="mt-1 text-xs text-slate-500">Class #{row.id}</p></td><td className={cell}>{row.programName || 'Unassigned'}</td><td className={cell}>{row.enrolledCount}</td><td className={cell}>{row.capacity}</td><td className={cell}>{row.waitlistCount}</td><td className={cell}><Status value={row.isActive ? 'active' : 'inactive'} /></td></tr>)}</tbody></table> : <Empty>No classes match this search.</Empty>}<Pager data={data.data} onPage={setPage} /></div> : null}</>}
    {create ? <ClassCreator onClose={() => setCreate(false)} onSaved={() => { setCreate(false); refresh() }} /> : null}
  </section>
}

function ClassDetail({ id, access, revision, onBack, onMember, onChanged }: { id: number; access: Access; revision: number; onBack: () => void; onMember: (id: number) => void; onChanged: () => void }) {
  const [page, setPage] = useState(1)
  const [schedule, setSchedule] = useState(false)
  const [action, setAction] = useState<RosterRow | null>(null)
  const data = useRead<Detail>(`/api/admin/new-admin/classes/${id}?rosterPage=${page}&pageSize=25`, revision)
  const detail = data.data
  return <div className="space-y-4"><button className={button} onClick={onBack}><ArrowLeft className="h-4 w-4" />All classes</button><ErrorNotice message={data.error} onRetry={onChanged} />{data.loading ? <Loading label="Loading class schedules and roster…" /> : detail ? <>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5"><div><h3 className="text-xl font-bold">{detail.class.name}</h3><p className="mt-1 text-sm text-slate-500">{detail.class.programName || 'Unassigned program'} · {detail.class.enrolledCount} enrolled · {detail.class.capacity} total spaces</p></div>{allowed(access, 'scheduling.manage') ? <button className={button} onClick={() => setSchedule(true)}>Edit schedules</button> : null}</div>
    <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="mb-4 font-bold">Schedules & capacity</h3>{detail.scheduleTruncated ? <p className="mb-4 text-sm text-amber-800">Showing the first schedules. Open schedule editing to view all.</p> : null}{detail.groups.length ? <div className="grid gap-3 lg:grid-cols-2">{detail.groups.map(group => <div key={group.id} className="rounded-lg border border-slate-200 p-4"><p className="font-semibold">Schedule #{group.id}</p><p className="mt-1 text-xs text-slate-500">{group.activeStart?.slice(0, 10) || 'Start not set'} — {group.activeEnd?.slice(0, 10) || 'Ongoing'}</p>{group.slots.map(slot => <p key={slot.id} className="mt-2 text-sm">{slot.specificDate?.slice(0, 10) || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][slot.dayOfWeek]} {slot.weekLetter ? `· Week ${slot.weekLetter}` : ''} · {slot.startTime?.slice(0, 5)}–{slot.endTime?.slice(0, 5)}{!slot.isActive ? ' · Inactive' : ''}</p>)}<p className="my-3 text-sm text-slate-600">{group.enrolledCount} enrolled · {group.waitlistCount} waiting</p>{allowed(access, 'scheduling.manage') ? <Capacity group={group} onChanged={onChanged} /> : <p className="text-sm">Capacity: {group.capacity}</p>}</div>)}</div> : <Empty>No schedules have been created for this class.</Empty>}</section>
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><h3 className="p-5 font-bold">Enrolled members</h3>{detail.roster.rows.length ? <table className="w-full text-sm"><thead className="bg-slate-100"><tr>{['Member', 'Status', 'Start date', 'Schedule', 'Actions'].map(title => <th key={title} className={cell}>{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{detail.roster.rows.map(row => <tr key={row.id}><td className={cell}><button className="font-semibold underline decoration-slate-300 underline-offset-4" onClick={() => onMember(row.memberId)}>{row.firstName} {row.lastName}</button></td><td className={cell}><Status value={row.status} /></td><td className={cell}>{row.startDate?.slice(0, 10) || '—'}</td><td className={cell}>#{row.slotGroupId}</td><td className={cell}>{allowed(access, 'scheduling.manage') && allowed(access, 'members.edit') ? <button className={button} onClick={() => setAction(row)}>Manage enrollment</button> : null}</td></tr>)}</tbody></table> : <Empty>No members are enrolled in this class.</Empty>}<Pager data={detail.roster} onPage={setPage} /></section>
    {schedule ? <Dialog title={`Schedules · ${detail.class.name}`} onClose={() => { setSchedule(false); onChanged() }}><Suspense fallback={<Loading />}><Scheduling classId={id} formId={detail.class.formId} /></Suspense></Dialog> : null}
    {action ? <EnrollmentActions memberId={action.memberId} enrollmentId={action.id} onClose={() => setAction(null)} onChanged={() => { setAction(null); onChanged() }} /> : null}
  </> : null}</div>
}

function Capacity({ group, onChanged }: { group: Group; onChanged: () => void }) {
  const [value, setValue] = useState(String(group.capacity))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null)
    try { await request(`/api/admin/new-admin/groups/${group.id}`, { method: 'PATCH', body: JSON.stringify({ maxParticipants: Number(value) }) }); onChanged() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update capacity.') }
    finally { setBusy(false) }
  }
  return <form onSubmit={save}><div className="flex items-end gap-2"><label className="text-xs font-semibold text-slate-600">Capacity<input className={input} type="number" min="1" max="10000" step="1" required disabled={busy} value={value} onChange={event => setValue(event.target.value)} /></label><button className={button} disabled={busy || Number(value) === group.capacity}>{busy ? 'Saving…' : 'Save'}</button></div><ErrorNotice message={error} /></form>
}

function ClassCreator({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const programs = useRead<Array<{ id: number; displayName: string; isActive?: boolean; primarySportId?: number | null }>>('/api/admin/programs-top?archived=false')
  const options = programs.data?.map(program => ({ ...program, id: Number(program.id), primarySportId: program.primarySportId == null ? null : Number(program.primarySportId) }))
  if (options?.length) return <Suspense fallback={<Loading />}><ClassModal open programsId={options[0].id} availablePrograms={options} onClose={onClose} onSaved={onSaved} /></Suspense>
  return <Dialog title="Create class" onClose={onClose}>{programs.loading ? <Loading label="Loading programs…" /> : <ErrorNotice message={programs.error || 'Create a parent program in Admin before adding a class.'} />}</Dialog>
}
