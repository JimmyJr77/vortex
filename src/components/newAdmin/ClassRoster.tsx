import { useState } from 'react'
import { allowed, useRead, useSearch, type Access, type Page } from './api'
import { button, cell, Empty, ErrorNotice, input, Loading, Pager, Status } from './shared'

export interface RosterRow {
  id: number; memberId: number | null; firstName: string; lastName: string; status: string
  enrollmentStatus: string; startDate: string | null; slotGroupId: number | null; timeSlotId?: number | null; waitlistPosition?: number | null
}
export interface ScheduleSelection { groupId: number; slotId: number | null; label: string }
const statusLabels: Record<string, string> = {
  active: 'Active', paused: 'Paused', disenrolled: 'Disenrolled', waitlisted: 'Wait listed',
  pending_setup: 'Pending setup and payment', reservation_expired: 'Reservation expired', requested: 'Requested',
}

export default function ClassRoster({ classId, selection, revision, access, onMember, onManage }: {
  classId: number; selection: ScheduleSelection | null; revision: number; access: Access
  onMember: (id: number) => void; onManage: (row: RosterRow) => void
}) {
  const [query, setQuery] = useState('')
  const search = useSearch(query)
  const [status, setStatus] = useState('all')
  const [retry, setRetry] = useState(0)
  const filterKey = `${selection?.groupId ?? ''}:${selection?.slotId ?? ''}:${status}:${search}`
  const [paging, setPaging] = useState({ key: filterKey, page: 1 })
  if (paging.key !== filterKey) setPaging({ key: filterKey, page: 1 })
  const page = paging.key === filterKey ? paging.page : 1
  const params = new URLSearchParams({ page: String(page), pageSize: '25', search, status })
  if (selection) params.set('slotGroupId', String(selection.groupId))
  if (selection?.slotId != null) params.set('timeSlotId', String(selection.slotId))
  const data = useRead<Page<RosterRow>>(`/api/admin/new-admin/classes/${classId}/roster?${params}`, revision + retry)
  return <section aria-label="Class roster" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="space-y-4 p-5">
      <div><h3 className="font-bold">Enrolled members</h3><p className="mt-1 text-sm text-slate-500">{selection ? selection.label : 'All schedules for this class'}</p></div>
      <div className="flex flex-wrap gap-3">
        <label className="min-w-48 flex-1 text-sm font-medium">Search athletes<input className={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="Athlete first or last name" /></label>
        <label className="text-sm font-medium">Enrollment status<select className={input} value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="disenrolled">Disenrolled</option><option value="waitlisted">Wait listed</option>
        </select></label>
      </div>
    </div>
    <ErrorNotice message={data.error} onRetry={() => setRetry(value => value + 1)} />
    {data.loading ? <Loading label="Loading enrolled members…" /> : data.data ? <>
      <div className="overflow-x-auto">{data.data.rows.length ? <table className="w-full text-sm"><thead className="bg-slate-100"><tr>{['Member', 'Status', 'Start date', 'Schedule', 'Actions'].map(title => <th key={title} className={cell}>{title}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{data.data.rows.map(row => <tr key={row.id}>
          <td className={cell}><button className="font-semibold underline decoration-slate-300 underline-offset-4" disabled={!row.memberId} onClick={() => row.memberId && onMember(row.memberId)}>{row.firstName} {row.lastName}</button>{row.waitlistPosition ? <p className="mt-1 text-xs font-medium text-amber-700">Waitlist #{row.waitlistPosition}</p> : null}</td>
          <td className={cell}><Status value={statusLabels[row.enrollmentStatus] ?? row.enrollmentStatus ?? row.status} /></td>
          <td className={cell}>{row.startDate?.slice(0, 10) || '—'}</td><td className={cell}>{row.slotGroupId != null ? `#${row.slotGroupId}` : '—'}</td>
          <td className={cell}>{row.memberId && !['pending_setup','reservation_expired'].includes(row.enrollmentStatus) && allowed(access, 'scheduling.manage') && allowed(access, 'members.edit') ? <button className={button} onClick={() => onManage(row)}>Manage enrollment</button> : null}</td>
        </tr>)}</tbody></table> : <Empty>No athletes match this schedule, status, and search.</Empty>}</div>
      <Pager data={data.data} onPage={next => setPaging({ key: filterKey, page: next })} />
    </> : null}
  </section>
}
