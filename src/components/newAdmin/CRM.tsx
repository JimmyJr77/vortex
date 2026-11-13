import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react'
import { formatDateShort } from '../../utils/dateUtils'
import { useRead, useSearch, type Page } from './api'
import { button, cell, Dialog, Empty, ErrorNotice, input, Loading, Pager, Status } from './shared'

const crmPath = '/api/admin/new-admin/crm'
const unknown = '—'

type Kind = 'member' | 'lead' | 'staff' | 'family'
type SortKey = 'name' | 'family' | 'age' | 'email' | 'phone' | 'status' | 'familyActive' | 'recent' | 'children'
type Direction = 'asc' | 'desc'

interface PersonRow {
  id: number
  kind: Kind
  name: string
  email: string | null
  phone: string | null
  age: number | null
  dateOfBirth: string | null
  familyId: number | null
  familyName: string | null
  status: 'active' | 'inactive' | 'lead'
  familyActive: boolean
  leadStatus: string | null
  archived: boolean
  childCount: number
  memberCount: number
  updatedAt: string | null
}

interface RelatedPerson {
  id: number
  name: string
  age: number | null
  dateOfBirth: string | null
  email: string | null
  phone: string | null
  isActive: boolean
}

interface Child {
  id: number | null
  name: string
  age: number | null
  dateOfBirth: string | null
  gender: string | null
}

interface ClassHistoryRow {
  key: string
  memberName: string | null
  className: string
  programName: string | null
  status: string
  startDate: string | null
  endDate: string | null
  source: string | null
}

interface Inquiry {
  id: number
  firstName: string
  lastName: string
  status: string
  message: string | null
  notes: string | null
  createdAt: string | null
  source?: string | null
  interest?: string | null
  interests?: string[]
  classTypes?: string[]
  contacted?: boolean
  followUp?: boolean
}

interface CRMDetail {
  person: PersonRow
  people: RelatedPerson[]
  children: Child[]
  classes: Page<ClassHistoryRow>
  inquiries: Inquiry[]
  address: string | null
  gender: string | null
  username: string | null
}

const kinds: Record<Kind, string> = { member: 'Member', lead: 'Lead', staff: 'Staff', family: 'Family' }
const sortColumns: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' }, { key: 'family', label: 'Family' }, { key: 'age', label: 'Age' },
  { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'children', label: 'Children' },
  { key: 'status', label: 'Activity' }, { key: 'familyActive', label: 'Family activity' }, { key: 'recent', label: 'Last updated' },
]

const emptyFilters = { source: '', status: '', familyActive: '', record: '', leadStatus: '', ageGroup: '', minAge: '', maxAge: '', participation: '', contact: '', hasChildren: '' }

function displayAge(age: number | null) {
  return age == null ? unknown : String(age)
}

function displayDate(date: string | null) {
  return formatDateShort(date) || unknown
}

function inquiryInterests(inquiry: Inquiry) {
  return [...new Set([inquiry.interest, ...(inquiry.interests ?? []), ...(inquiry.classTypes ?? [])].filter(Boolean))].join(', ')
}

function FamilyActivity({ person }: { person: PersonRow }) {
  if (person.familyId == null && person.kind !== 'family') return <span className="text-slate-600">No household</span>
  return <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${person.familyActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
    {person.familyActive ? 'Family active' : 'Family inactive'}
  </span>
}

function Activity({ person }: { person: PersonRow }) {
  const colors = { active: 'bg-emerald-50 text-emerald-800', inactive: 'bg-slate-100 text-slate-700', lead: 'bg-amber-50 text-amber-900' }
  return <div className="flex flex-wrap items-center gap-1">
    <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${colors[person.status]}`}>{person.status}</span>
    {person.leadStatus ? <span className="text-xs capitalize text-slate-600">{person.leadStatus}</span> : null}
    {person.archived ? <span className="text-xs text-slate-600">Archived</span> : null}
  </div>
}

function CRMDetails({ row, revision, onClose, onMember, onFamily }: {
  row: PersonRow; revision: number; onClose: () => void; onMember: (id: number) => void; onFamily: (id: number) => void
}) {
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const recordPath = `${crmPath}/${row.kind}/${row.id}`
  const detail = useRead<CRMDetail>(`${recordPath}?page=1&pageSize=15`, revision + retry)
  const history = useRead<CRMDetail>(page === 1 ? null : `${recordPath}?page=${page}&pageSize=15`, revision + retry)
  const data = detail.data
  const person = data?.person ?? row
  const classes = page === 1 ? data?.classes : history.data?.classes
  return <Dialog title={person.name} onClose={onClose}>
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-slate-700">{kinds[person.kind]}</span>
        <Activity person={person} />
        <FamilyActivity person={person} />
        {person.kind === 'member' ? <button type="button" className={button} onClick={() => onMember(person.id)}>Open member account</button> : null}
        {person.familyId != null ? <button type="button" className={button} onClick={() => onFamily(person.familyId!)}>Open family workspace</button> : null}
      </div>
      <ErrorNotice message={detail.error} onRetry={() => setRetry(value => value + 1)} />
      {detail.loading ? <Loading label="Loading record…" /> : null}
      {data ? <>
        <section aria-label="Contact and profile" className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-950">Contact and profile</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {([
              ['Email', person.email], ['Phone', person.phone], ['Address', data.address],
              ...(person.kind === 'family' ? [] : [['Age', displayAge(person.age)], ['Date of birth', displayDate(person.dateOfBirth)], ['Gender', data.gender], ['Username', data.username]]),
              ['Family', person.familyName], ['Last updated', displayDate(person.updatedAt)],
            ] as [string, string | null][]).map(([label, value]) => <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="break-words text-sm text-slate-900">{value || unknown}</dd>
            </div>)}
          </dl>
        </section>
        {data.children.length ? <section aria-label="Children" className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-950">Children</h3>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.children.map((child, index) => <li key={child.id ?? `reported-${index}`} className="min-w-0 rounded-lg bg-slate-50 p-3 text-sm">
              {child.id == null ? <span className="font-semibold">{child.name || 'Name unavailable'}</span> : <button type="button" className="font-semibold underline decoration-slate-300 underline-offset-4" onClick={() => onMember(child.id!)}>{child.name}</button>}
              <p className="mt-1 text-slate-600">{child.age != null ? `Age ${child.age}` : 'Age unknown'}{child.gender ? ` · ${child.gender}` : ''}</p>
              {child.dateOfBirth ? <p className="text-slate-600">Born {displayDate(child.dateOfBirth)}</p> : null}
            </li>)}
          </ul>
        </section> : null}
        {data.people.length ? <section aria-label="Household members" className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-950">Household members</h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {data.people.map(related => <li key={related.id} className="grid gap-1 py-2 text-sm sm:grid-cols-[minmax(9rem,1fr)_4rem_minmax(10rem,1fr)_minmax(8rem,auto)] sm:gap-3">
              <div><button type="button" className="text-left font-semibold underline decoration-slate-300 underline-offset-4" onClick={() => onMember(related.id)}>{related.name}</button>{!related.isActive ? <span className="ml-2 text-xs text-slate-600">Inactive</span> : null}</div>
              <span className="text-slate-600">{related.age != null ? `Age ${related.age}` : unknown}</span>
              <span className="break-all text-slate-600">{related.email || unknown}</span><span className="text-slate-600">{related.phone || unknown}</span>
            </li>)}
          </ul>
        </section> : null}
        <section aria-label="Class history" className="overflow-hidden rounded-xl border border-slate-200">
          <h3 className="px-4 pt-4 font-semibold text-slate-950">Class history</h3>
          <ErrorNotice message={history.error} onRetry={() => setRetry(value => value + 1)} />
          {history.loading ? <Loading label="Loading class history…" /> : null}
          {classes?.rows.length ? <>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[37rem] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-700"><tr>{['Class', 'Athlete', 'Status', 'Start', 'End'].map(label => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{classes.rows.map(enrollment => <tr key={enrollment.key}>
                  <td className={cell}><div className="font-semibold">{enrollment.className}</div>{enrollment.programName ? <div className="text-slate-600">{enrollment.programName}</div> : null}{enrollment.source ? <div className="text-xs text-slate-500">{enrollment.source}</div> : null}</td>
                  <td className={cell}>{enrollment.memberName || unknown}</td><td className={cell}><Status value={enrollment.status} /></td>
                  <td className={`${cell} whitespace-nowrap`}>{displayDate(enrollment.startDate)}</td><td className={`${cell} whitespace-nowrap`}>{displayDate(enrollment.endDate)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </> : classes ? <p className="p-4 text-sm text-slate-600">No class history on this page.</p> : null}
          {data.classes.totalPages > 1 ? <Pager data={{ ...data.classes, page }} onPage={setPage} /> : null}
        </section>
        {data.inquiries.length ? <section aria-label="Lead history" className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-950">Lead history</h3>
          <ul className="mt-2 divide-y divide-slate-100">{data.inquiries.map(inquiry => {
            const interests = inquiryInterests(inquiry)
            return <li key={inquiry.id} className="space-y-1 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{inquiry.firstName} {inquiry.lastName}</span><Status value={inquiry.status} /><span className="text-slate-600">{displayDate(inquiry.createdAt)}</span></div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                {inquiry.source ? <span>{inquiry.source}</span> : null}
                {inquiry.contacted ? <span>Contacted</span> : null}
                {inquiry.followUp ? <span className="font-medium text-amber-800">Follow-up needed</span> : null}
              </div>
              {interests ? <p className="break-words text-slate-700"><span className="font-semibold">Interests</span> · {interests}</p> : null}
              {inquiry.message ? <p className="whitespace-pre-wrap break-words text-slate-700">{inquiry.message}</p> : null}
              {inquiry.notes ? <p className="whitespace-pre-wrap break-words text-slate-600">{inquiry.notes}</p> : null}
            </li>
          })}</ul>
        </section> : null}
      </> : null}
    </div>
  </Dialog>
}

export default function CRM({ revision, onMember, onFamily }: {
  revision: number; onMember: (id: number) => void; onFamily: (id: number) => void
}) {
  const [query, setQuery] = useState('')
  const [classQuery, setClassQuery] = useState('')
  const [familiesOnly, setFamiliesOnly] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<Direction>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('25')
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<PersonRow | null>(null)
  const search = useSearch(query)
  const classSearch = useSearch(classQuery)
  const { minAge, maxAge } = filters
  const invalidAge = [minAge, maxAge].some(value => value !== '' && (!/^\d{1,3}$/.test(value) || Number(value) > 130))
    || (minAge !== '' && maxAge !== '' && Number(minAge) > Number(maxAge))
  const params = new URLSearchParams({ search, classSearch, familiesOnly: String(familiesOnly), ...filters, sortBy, sortDir, page: String(page), pageSize })
  const state = useRead<Page<PersonRow>>(invalidAge ? null : `${crmPath}?${params}`, revision + retry)
  const updateFilter = (key: keyof typeof emptyFilters, value: string) => {
    setFilters(current => ({ ...current, [key]: value }))
    setPage(1)
  }
  const sort = (key: SortKey, direction?: Direction) => {
    setSortBy(key)
    setSortDir(direction ?? (key === sortBy && sortDir === 'asc' ? 'desc' : 'asc'))
    setPage(1)
  }
  const reset = () => {
    setFilters(emptyFilters)
    setQuery('')
    setClassQuery('')
    setFamiliesOnly(false)
    setPage(1)
  }

  return <section aria-label="CRM" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-bold text-slate-950">CRM</h2><p className="mt-1 text-sm text-slate-600">Find members, families, leads, and staff.</p></div>
      <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
        <input type="checkbox" checked={familiesOnly} onChange={event => {
          setFamiliesOnly(event.target.checked)
          setFilters(current => ({ ...current, source: '', leadStatus: '', status: current.status === 'lead' ? '' : current.status }))
          if (sortBy === 'age') sort('name', 'asc')
          setPage(1)
        }} className="h-4 w-4 rounded border-slate-300 accent-vortex-red" />Families only
      </label>
    </div>
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-semibold"><span className="inline-flex items-center gap-2"><Search className="h-4 w-4" aria-hidden="true" />Search people and families</span>
          <input type="search" className={input} placeholder="Name, family, email, or phone" maxLength={200} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
        </label>
        <label className="min-w-0 text-sm font-semibold">Search class history
          <input type="search" className={input} placeholder="Class or program" maxLength={200} value={classQuery} onChange={event => { setClassQuery(event.target.value); setPage(1) }} />
        </label>
      </div>
      <fieldset className="mt-4"><legend className="mb-1 text-sm font-semibold text-slate-800">Filters</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {!familiesOnly ? <label className="min-w-0 text-sm font-medium">Record type<select className={input} value={filters.source} onChange={event => updateFilter('source', event.target.value)}>
            <option value="">All people</option><option value="member">Members</option><option value="lead">Leads</option><option value="staff">Staff</option>
          </select></label> : null}
          <label className="min-w-0 text-sm font-medium">Activity<select className={input} value={filters.status} onChange={event => updateFilter('status', event.target.value)}>
            <option value="">Any activity</option><option value="active">Active</option><option value="inactive">Inactive</option>
            {!familiesOnly ? <option value="lead">Lead</option> : null}
          </select></label>
          <label className="min-w-0 text-sm font-medium">Family activity<select className={input} value={filters.familyActive} onChange={event => updateFilter('familyActive', event.target.value)}>
            <option value="">Any family activity</option><option value="true">Family active</option><option value="false">Family inactive</option>
          </select></label>
          <label className="min-w-0 text-sm font-medium">Record state<select className={input} value={filters.record} onChange={event => updateFilter('record', event.target.value)}>
            <option value="">All records</option><option value="active">Current records</option><option value="archived">Archived records</option>
          </select></label>
          {!familiesOnly ? <label className="min-w-0 text-sm font-medium">Lead stage<select className={input} value={filters.leadStatus} onChange={event => updateFilter('leadStatus', event.target.value)}>
            <option value="">Any lead stage</option><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="closed">Closed</option>
          </select></label> : null}
          <label className="min-w-0 text-sm font-medium">Age group<select className={input} value={filters.ageGroup} onChange={event => updateFilter('ageGroup', event.target.value)}>
            <option value="">Any age group</option><option value="youth">Youth</option><option value="adult">Adult</option><option value="unknown">Unknown</option>
          </select></label>
          <label className="min-w-0 text-sm font-medium">Minimum age<input className={input} type="number" min={0} max={130} step={1} placeholder="Any" value={minAge} onChange={event => updateFilter('minAge', event.target.value)} /></label>
          <label className="min-w-0 text-sm font-medium">Maximum age<input className={input} type="number" min={0} max={130} step={1} placeholder="Any" value={maxAge} onChange={event => updateFilter('maxAge', event.target.value)} /></label>
          <label className="min-w-0 text-sm font-medium">Class participation<select className={input} value={filters.participation} onChange={event => updateFilter('participation', event.target.value)}>
            <option value="">Any participation</option><option value="current">Current classes</option><option value="past">Past classes</option><option value="none">No class history</option>
          </select></label>
          <label className="min-w-0 text-sm font-medium">Contact details<select className={input} value={filters.contact} onChange={event => updateFilter('contact', event.target.value)}>
            <option value="">Any contact details</option><option value="email">Has email</option><option value="phone">Has phone</option><option value="missing">No email or phone</option>
          </select></label>
          <label className="min-w-0 text-sm font-medium">Children<select className={input} value={filters.hasChildren} onChange={event => updateFilter('hasChildren', event.target.value)}>
            <option value="">Any</option><option value="true">Has children listed</option><option value="false">No children listed</option>
          </select></label>
          <div className="flex items-end"><button type="button" className={button} onClick={reset}>Reset filters</button></div>
        </div>
      </fieldset>
      <p className="mt-3 text-xs text-slate-600">Active means a current membership, current class, or a drop-in in the past two months. Family activity reflects everyone in the household.</p>
    </div>
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex sm:flex-wrap sm:items-end">
      <label className="min-w-0 text-sm font-medium sm:min-w-44">Sort by<select className={input} value={sortBy} onChange={event => sort(event.target.value as SortKey, 'asc')}>
        {sortColumns.filter(column => !familiesOnly || column.key !== 'age').map(column => <option key={column.key} value={column.key}>{column.label}</option>)}
      </select></label>
      <label className="min-w-0 text-sm font-medium sm:min-w-36">Sort order<select className={input} value={sortDir} onChange={event => sort(sortBy, event.target.value as Direction)}>
        <option value="asc">Ascending</option><option value="desc">Descending</option>
      </select></label>
      <label className="min-w-0 text-sm font-medium sm:ml-auto sm:min-w-32">Rows per page<select className={input} value={pageSize} onChange={event => { setPageSize(event.target.value); setPage(1) }}>
        <option value="25">25</option><option value="50">50</option><option value="100">100</option>
      </select></label>
    </div>
    <ErrorNotice message={invalidAge ? 'Enter whole ages from 0 to 130, with the minimum no greater than the maximum.' : state.error} onRetry={state.error ? () => setRetry(value => value + 1) : undefined} />
    {state.loading ? <Loading label="Loading CRM records…" /> : null}
    {state.data ? <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {state.data.rows.length ? <>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[58rem] text-sm" aria-label="CRM records">
            <thead className="bg-slate-100 text-xs text-slate-700"><tr>{sortColumns.map(column => {
              const current = sortBy === column.key
              const Icon = current ? sortDir === 'asc' ? ArrowUp : ArrowDown : ChevronsUpDown
              return <th key={column.key} scope="col" aria-sort={current ? sortDir === 'asc' ? 'ascending' : 'descending' : undefined} className="px-3 py-3 text-left">
                {familiesOnly && column.key === 'age' ? column.label : <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap font-semibold hover:text-vortex-red" onClick={() => sort(column.key)}>{column.label}<Icon aria-hidden="true" className="h-3.5 w-3.5" /></button>}
              </th>
            })}</tr></thead>
            <tbody className="divide-y divide-slate-100">{state.data.rows.map(row => <tr key={`${row.kind}-${row.id}`}>
              <td className="px-3 py-3 align-top"><button type="button" className="text-left font-semibold underline decoration-slate-300 underline-offset-4 hover:text-vortex-red" onClick={() => setSelected(row)}>{row.name}</button><p className="mt-0.5 text-xs text-slate-600">{kinds[row.kind]}</p></td>
              <td className="px-3 py-3 align-top">{row.kind === 'family' ? `${row.memberCount} ${row.memberCount === 1 ? 'person' : 'people'}` : row.familyName || unknown}</td><td className="px-3 py-3 align-top">{displayAge(row.age)}</td>
              <td className="max-w-52 break-all px-3 py-3 align-top">{row.email || unknown}</td><td className="whitespace-nowrap px-3 py-3 align-top">{row.phone || unknown}</td>
              <td className="px-3 py-3 align-top">{row.childCount ?? 0}</td><td className="px-3 py-3 align-top"><Activity person={row} /></td><td className="px-3 py-3 align-top"><FamilyActivity person={row} /></td><td className="whitespace-nowrap px-3 py-3 align-top">{displayDate(row.updatedAt)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <ul aria-label="CRM records" className="divide-y divide-slate-100 lg:hidden">{state.data.rows.map(row => <li key={`${row.kind}-${row.id}`} className="space-y-2 p-4 text-sm">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><button type="button" className="break-words text-left font-semibold underline decoration-slate-300 underline-offset-4" onClick={() => setSelected(row)}>{row.name}</button><p className="text-xs text-slate-600">{kinds[row.kind]}{row.familyName && row.kind !== 'family' ? ` · ${row.familyName}` : ''}</p></div><Activity person={row} /></div>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-slate-700"><span className="break-all">{row.email || 'No email'}</span><span>{row.phone || 'No phone'}</span></p>
          <p className="text-xs text-slate-600">{row.kind === 'family' ? `${row.memberCount} ${row.memberCount === 1 ? 'person' : 'people'} · ` : row.age != null ? `Age ${row.age} · ` : ''}{row.childCount ?? 0} {(row.childCount ?? 0) === 1 ? 'child' : 'children'}</p>
          <div className="text-xs"><FamilyActivity person={row} /></div>
        </li>)}</ul>
      </> : <Empty>No CRM records match these filters.</Empty>}
      <Pager data={state.data} onPage={setPage} />
    </div> : null}
    {selected ? <CRMDetails key={`${selected.kind}-${selected.id}`} row={selected} revision={revision} onClose={() => setSelected(null)} onMember={onMember} onFamily={onFamily} /> : null}
  </section>
}
