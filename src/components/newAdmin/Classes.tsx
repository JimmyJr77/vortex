import { confirmArchive } from '../../utils/confirmArchive'
import { Suspense, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowDown, ArrowUp, ArrowUpDown, Plus, Search } from 'lucide-react'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import { archiveClassEvent, type ClassEventFormData } from '../../utils/programsApi'
import ClassRoster, { type RosterRow, type ScheduleSelection } from './ClassRoster'
import ClassPriceFields from './ClassPriceFields'
import ProgramEditor from './ProgramEditor'
import EnrollmentActions from './EnrollmentActions'
import { button, cell, Dialog, Empty, ErrorNotice, input, Loading, Pager, primary, Status } from './shared'
import { allowed, request, useRead, useSearch, type Access, type Page } from './api'

const Scheduling = lazyWithRetry(() => import('./ScheduleEditor'))
const ClassModal = lazyWithRetry(() => import('../programs/ClassEventModal'))
interface ClassRow { monthlyPriceCents?: number | null; costAmountCents?: number; costUnit?: string; schedules?: Array<Slot & { activeStart?: string | null; activeEnd?: string | null }>; id: number; formId: number | null; programsId: number | null; name: string; programName: string | null; isActive: boolean; capacity: number; enrolledCount: number; waitlistCount: number; reservedCount?: number; details: ClassEventFormData }
interface Slot { id: number; dayOfWeek: number; weekLetter: string | null; specificDate: string | null; startTime: string; endTime: string; scheduleMode: string; isActive: boolean }
interface Group { id: number; capacity: number; enrolledCount: number; waitlistCount: number; reservedCount?: number; activeStart: string | null; activeEnd: string | null; slots: Slot[] }

interface Detail { class: ClassRow; groups: Group[]; roster: Page<RosterRow>; scheduleTruncated?: boolean }

const classColumns = [
  { key: 'program', label: 'Program' }, { key: 'class', label: 'Class' },
  { key: 'cost', label: 'Class Cost' }, { key: 'schedule', label: 'Days & times' },
  { key: 'enrolled', label: 'Enrolled' }, { key: 'capacity', label: 'Capacity' },
  { key: 'waitlisted', label: 'Waitlisted' }, { key: 'status', label: 'Status' },
] as const

const ClassMaster = lazyWithRetry(() => import('../classSetup/AdminClassSetupOverview'))
type ClassesProps = { access: Access; revision: number; onMember: (id: number) => void }

export default function Classes(props: ClassesProps) {
  const [tab, setTab] = useState<'classes' | 'master'>('classes')
  return <div className="space-y-4">
    <nav aria-label="Classes & schedules tabs" className="flex gap-1 border-b border-gray-200">
      {([['classes', 'Classes & schedules'], ['master', 'Class Master']] as const).map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)} className={`px-5 py-3 text-sm font-semibold border-b-2 ${tab === id ? 'border-vortex-red text-gray-900' : 'border-transparent text-gray-500'}`}>{label}</button>)}
    </nav>
    {tab === 'classes' ? <ClassesList {...props} /> : <Suspense fallback={<Loading />}><ClassMaster key={props.revision} /></Suspense>}
  </div>
}

function ClassesList({ access, revision, onMember }: ClassesProps) {
  const [query, setQuery] = useState('')
  const search = useSearch(query)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<(typeof classColumns)[number]['key']>('class')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const sortBy = (key: (typeof classColumns)[number]['key']) => {
    setDirection(sort === key && direction === 'asc' ? 'desc' : 'asc')
    setSort(key)
    setPage(1)
  }
  const [id, setId] = useState<number | null>(null)
  const [version, setVersion] = useState(0)
  const [create, setCreate] = useState(false)
  const [edit, setEdit] = useState<ClassRow | null>(null)
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const openEdit = (row: ClassRow) => { setEdit(row); setMonthlyPrice(row.monthlyPriceCents == null ? '' : (row.monthlyPriceCents / 100).toFixed(2)) }
  const [programMode, setProgramMode] = useState<'create' | 'edit' | null>(null)
  const canManage = allowed(access, 'classes.manage')
  const editing = useMemo(() => edit ? { ...edit.details, id: edit.id, programsId: edit.programsId } : null, [edit])
  const refresh = () => setVersion(value => value + 1)
  const data = useRead<Page<ClassRow>>(id == null ? `/api/admin/new-admin/classes?${new URLSearchParams({ search, page: String(page), pageSize: '25', sort, direction })}` : null, revision + version)
  return <section><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Classes & schedules</h2><p className="mt-1 text-sm text-slate-500">Capacity, schedules, and enrolled members in one place.</p></div>{canManage ? <div className="flex flex-wrap gap-2"><button className={button} onClick={() => setProgramMode('edit')}>Edit program</button><button className={button} onClick={() => setProgramMode('create')}><Plus className="h-4 w-4" />Create program</button><button className={primary} onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Create class</button></div> : null}</div>
    {id != null ? <ClassDetail key={id} id={id} access={access} revision={revision + version} onBack={() => setId(null)} onMember={onMember} onChanged={refresh} onEdit={openEdit} /> : <><label className="mb-4 block max-w-xl text-sm font-medium"><span className="flex items-center gap-2"><Search className="h-4 w-4" />Search classes</span><input className={input} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Class or program name" /></label><ErrorNotice message={data.error} onRetry={refresh} />{data.loading ? <Loading label="Loading classes…" /> : data.data ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">{data.data.rows.length ? <table className="w-full text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr>{classColumns.map(column => <th className={cell} key={column.key} aria-sort={sort === column.key ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="inline-flex items-center gap-1 whitespace-nowrap font-semibold uppercase hover:text-vortex-red" onClick={() => sortBy(column.key)}>{column.label}{sort === column.key ? direction === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5" />}</button></th>)}<th className={cell}>Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{data.data.rows.map(row => <tr key={row.id}><td className={cell}>{row.programName || 'Unassigned'}</td><td className={cell}><button className="font-semibold underline decoration-slate-300 underline-offset-4 hover:text-red-700" disabled={!allowed(access, 'members.view')} onClick={() => setId(row.id)}>{row.name}</button><p className="mt-1 text-xs text-slate-500">Class #{row.id}</p></td><td className={cell}>{row.costAmountCents == null ? 'Not set' : `${(row.costAmountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} / ${(row.costUnit || 'per_month').replace('per_', '')}`}</td><td className={`${cell} min-w-56`}>{row.schedules?.length ? row.schedules.map(slot => <p key={slot.id} className="whitespace-nowrap">{slot.specificDate || ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][slot.dayOfWeek]}{slot.weekLetter ? ` · Week ${slot.weekLetter}` : ''} · {formatTime(slot.startTime)}–{formatTime(slot.endTime)}{slot.activeStart || slot.activeEnd ? <span className="text-xs text-slate-500"> · {slot.activeStart || 'Open start'} – {slot.activeEnd || 'Ongoing'}</span> : null}</p>) : 'No available schedules'}</td><td className={cell}>{row.enrolledCount}</td><td className={cell}>{row.capacity}</td><td className={cell}>{row.waitlistCount}</td><td className={cell}><Status value={row.isActive ? 'active' : 'inactive'} /></td><td className={cell}>{canManage && <button className={button} aria-label={`Edit class: ${row.name}`} onClick={() => openEdit(row)}>Edit class</button>}</td></tr>)}</tbody></table> : <Empty>No classes match this search.</Empty>}<Pager data={data.data} onPage={setPage} /></div> : null}</>}
    {create ? <ClassCreator onClose={() => setCreate(false)} onSaved={() => { setCreate(false); refresh() }} /> : null}
    {edit && editing ? <Suspense fallback={<Loading />}><ClassModal open editing={editing} programsId={edit.programsId ?? 0} programsDisplayName={edit.programName ?? undefined} lockProgram hideSportTags pricingFields={<ClassPriceFields value={monthlyPrice} onChange={setMonthlyPrice} legacyUnit={edit.costUnit !== 'per_month' ? edit.costUnit : undefined} />} saveClass={async (_programId, details) => { await request(`/api/admin/new-admin/classes/${edit.id}`, { method: 'PUT', body: JSON.stringify({ ...details, ...(monthlyPrice !== '' && Math.round(Number(monthlyPrice) * 100) !== edit.monthlyPriceCents ? { monthlyPriceCents: Math.round(Number(monthlyPrice) * 100) } : {}) }) }) }} onClose={() => setEdit(null)} onSaved={refresh} /></Suspense> : null}
    {programMode ? <ProgramEditor mode={programMode} onClose={() => setProgramMode(null)} onSaved={refresh} /> : null}
  </section>
}

function ClassDetail({ id, access, revision, onBack, onMember, onChanged, onEdit }: { id: number; access: Access; revision: number; onBack: () => void; onMember: (id: number) => void; onChanged: () => void; onEdit: (row: ClassRow) => void }) {
  const [selection, setSelection] = useState<ScheduleSelection | null>(null)
  const selectSchedule = (next: ScheduleSelection) => setSelection(current => current?.groupId === next.groupId && current.slotId === next.slotId ? null : next)
  const [schedule, setSchedule] = useState(false)
  const [action, setAction] = useState<RosterRow | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const archive = async () => {
    if (!await confirmArchive(detail?.class.name || 'This class')) return
    setArchiving(true); setArchiveError(null)
    try { await archiveClassEvent(id,true); onChanged(); onBack() }
    catch (caught) { setArchiveError(caught instanceof Error ? caught.message : 'Unable to archive class.') }
    finally { setArchiving(false) }
  }
  const data = useRead<Detail>(`/api/admin/new-admin/classes/${id}?pageSize=25`, revision)
  const detail = data.data
  return <div className="space-y-4"><button className={button} onClick={onBack}><ArrowLeft className="h-4 w-4" />All classes</button><ErrorNotice message={archiveError || data.error} onRetry={onChanged} />{data.loading ? <Loading label="Loading class schedules and roster…" /> : detail ? <>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5"><div><h3 className="text-xl font-bold">{detail.class.name}</h3><p className="mt-1 text-sm text-slate-500">{detail.class.programName || 'Unassigned program'} · {detail.class.enrolledCount} enrolled · {detail.class.reservedCount || 0} reserved · {detail.class.capacity} total spaces</p></div><div className="flex flex-wrap gap-2">{allowed(access, 'classes.manage') && <button className={button} onClick={() => onEdit(detail.class)}>Edit class</button>}{allowed(access, 'scheduling.manage') && <button className={button} onClick={() => setSchedule(true)}>Edit schedules</button>}{allowed(access, 'classes.manage') && <button className={`${button} text-red-700`} disabled={archiving} onClick={() => void archive()}>{archiving ? 'Archiving…' : 'Archive class'}</button>}</div></div>
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Schedules & capacity</h3><p className="mt-1 text-sm text-slate-500">Select a schedule or time below to filter the roster.</p></div><button type="button" className={selection ? button : primary} aria-pressed={!selection} onClick={() => setSelection(null)}>All schedules</button></div>
      {detail.scheduleTruncated ? <p className="mb-4 text-sm text-amber-800">Showing the first schedules. Open schedule editing to view all.</p> : null}
      {detail.groups.length ? <div className="grid gap-3 lg:grid-cols-2">{detail.groups.map(group => <div key={group.id} className={`rounded-lg border p-4 ${selection?.groupId === group.id ? 'border-vortex-red bg-red-50 ring-1 ring-vortex-red' : 'border-slate-200'}`}>
        <button type="button" aria-pressed={selection?.groupId === group.id && selection.slotId == null} onClick={() => selectSchedule({ groupId: group.id, slotId: null, label: `Schedule #${group.id} · All times` })} className="w-full rounded text-left focus-visible:outline-vortex-red">
          <span className="font-semibold">Schedule #{group.id}</span><span className="mt-1 block text-xs text-slate-500">{group.activeStart?.slice(0, 10) || 'Start not set'} — {group.activeEnd?.slice(0, 10) || 'Ongoing'}</span>
        </button>
        <div className="mt-2 space-y-2">{group.slots.map(slot => {
          const label = `${slot.specificDate?.slice(0, 10) || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][slot.dayOfWeek]}${slot.weekLetter ? ` · Week ${slot.weekLetter}` : ''} · ${formatTime(slot.startTime)}–${formatTime(slot.endTime)}${!slot.isActive ? ' · Inactive' : ''}`
          const selected = selection?.groupId === group.id && selection.slotId === slot.id
          return <button type="button" key={slot.id} aria-pressed={selected} onClick={() => selectSchedule({ groupId: group.id, slotId: slot.id, label: `Schedule #${group.id} · ${label}` })} className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${selected ? 'border-vortex-red bg-vortex-red text-white' : 'border-slate-200 bg-white hover:border-vortex-red'}`}>{label}</button>
        })}</div>
        <p className="my-3 text-sm text-slate-600">{group.enrolledCount} enrolled · {group.reservedCount || 0} reserved · {group.waitlistCount} waiting</p>
        {allowed(access, 'scheduling.manage') ? <Capacity group={group} onChanged={onChanged} /> : <p className="text-sm">Capacity: {group.capacity}</p>}
      </div>)}</div> : <Empty>No schedules have been created for this class.</Empty>}
    </section>
    <ClassRoster classId={id} selection={selection} revision={revision} access={access} onMember={onMember} onManage={setAction} />
    {schedule ? <Dialog title={`Schedules · ${detail.class.name}`} onClose={() => { setSchedule(false); onChanged() }}><Suspense fallback={<Loading />}><Scheduling classId={id} formId={detail.class.formId} /></Suspense></Dialog> : null}
    {action ? <EnrollmentActions memberId={action.memberId!} enrollmentId={action.id} onClose={() => setAction(null)} onChanged={() => { setAction(null); onChanged() }} /> : null}
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

function formatTime(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}

function ClassCreator({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const programs = useRead<Array<{ id: number; displayName: string; isActive?: boolean; primarySportId?: number | null }>>('/api/admin/programs-top?archived=false')
  const options = programs.data?.map(program => ({ ...program, id: Number(program.id), primarySportId: program.primarySportId == null ? null : Number(program.primarySportId) }))
  if (options?.length) return <Suspense fallback={<Loading />}><ClassModal open programsId={options[0].id} availablePrograms={options} hideSportTags pricingFields={<ClassPriceFields value={monthlyPrice} onChange={setMonthlyPrice} />} saveClass={async (programsId, details) => { await request('/api/admin/new-admin/classes', { method: 'POST', body: JSON.stringify({ ...details, programsId, monthlyPriceCents: Math.round(Number(monthlyPrice) * 100) }) }) }} onClose={onClose} onSaved={onSaved} /></Suspense>
  return <Dialog title="Create class" onClose={onClose}>{programs.loading ? <Loading label="Loading programs…" /> : <ErrorNotice message={programs.error || 'Use Create program before adding your first class.'} />}</Dialog>
}
