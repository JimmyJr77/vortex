import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'

export interface MemberEnrollmentRow {
  id: number
  member_id: number
  member_first_name: string
  member_last_name: string
  class_name: string
  program_id?: number | null
  form_id?: number | null
  slot_label: string
  status: string
  total_slots_for_member?: number | null
  created_at?: string | null
  source?: 'scheduling' | 'legacy'
}

interface Props {
  enrollments: MemberEnrollmentRow[]
  loading: boolean
  currentMemberId?: number | null
}

type ViewMode = 'class' | 'member'

function memberDisplayName(row: MemberEnrollmentRow, currentMemberId?: number | null) {
  const name = `${row.member_first_name} ${row.member_last_name}`.trim() || 'Member'
  if (currentMemberId != null && row.member_id === currentMemberId) {
    return `${name} (You)`
  }
  return name
}

function statusBadge(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === 'confirmed' || normalized === 'enrolled') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 capitalize">
        {normalized === 'enrolled' ? 'Enrolled' : 'Confirmed'}
      </span>
    )
  }
  if (normalized === 'waitlisted') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 capitalize">
        Waitlisted
      </span>
    )
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 capitalize">
      {status}
    </span>
  )
}

function EnrollmentTable({
  rows,
  columns,
}: {
  rows: MemberEnrollmentRow[]
  columns: Array<{ key: string; header: string; cell: (row: MemberEnrollmentRow) => ReactNode }>
}) {
  if (rows.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm table-auto border-collapse [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:align-top [&_td]:align-top">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-600">
            {columns.map((col) => (
              <th key={col.key} className="py-2 pr-4 font-semibold">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.source || 'row'}-${row.id}`} className="border-b border-gray-100">
              {columns.map((col) => (
                <td key={col.key} className="py-3 pr-4 text-gray-900">
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function MemberEnrollmentsPanel({
  enrollments,
  loading,
  currentMemberId,
}: Props) {
  const [view, setView] = useState<ViewMode>('class')

  const byClass = useMemo(() => {
    const groups = new Map<string, MemberEnrollmentRow[]>()
    for (const row of enrollments) {
      const key = row.class_name || 'Class'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(row)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [enrollments])

  const byMember = useMemo(() => {
    const groups = new Map<number, MemberEnrollmentRow[]>()
    for (const row of enrollments) {
      if (!groups.has(row.member_id)) groups.set(row.member_id, [])
      groups.get(row.member_id)!.push(row)
    }
    return [...groups.entries()].sort(([aId], [bId]) => {
      if (currentMemberId != null) {
        if (aId === currentMemberId) return -1
        if (bId === currentMemberId) return 1
      }
      const aName = groups.get(aId)?.[0]
      const bName = groups.get(bId)?.[0]
      const aLabel = `${aName?.member_first_name || ''} ${aName?.member_last_name || ''}`.trim()
      const bLabel = `${bName?.member_first_name || ''} ${bName?.member_last_name || ''}`.trim()
      return aLabel.localeCompare(bLabel)
    })
  }, [enrollments, currentMemberId])

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6 border-b border-gray-200 bg-gray-50/80">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-vortex-red" />
            Current Enrollments
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Active class signups for your family, including day and time for each slot.
          </p>
        </div>
        {enrollments.length > 0 && (
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setView('class')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                view === 'class' ? 'bg-vortex-red text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              By Class
            </button>
            <button
              type="button"
              onClick={() => setView('member')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                view === 'member' ? 'bg-vortex-red text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              By Family Member
            </button>
          </div>
        )}
      </div>

      <div className="p-4 md:p-6">
        {loading ? (
          <div className="text-center py-12 text-gray-600">Loading enrollments…</div>
        ) : enrollments.length === 0 ? (
          <p className="text-gray-600 flex items-center gap-2 py-4">
            <Calendar className="w-4 h-4 shrink-0" />
            No enrollments yet. Sign up for a class from the offerings below.
          </p>
        ) : view === 'class' ? (
          <div className="space-y-6">
            {byClass.map(([className, rows]) => (
              <section key={className}>
                <h3 className="text-lg font-bold text-black mb-3">{className}</h3>
                <EnrollmentTable
                  rows={rows}
                  columns={[
                    {
                      key: 'member',
                      header: 'Member',
                      cell: (row) => memberDisplayName(row, currentMemberId),
                    },
                    {
                      key: 'slot',
                      header: 'Time',
                      cell: (row) => (
                        <span className="inline-flex flex-col gap-0.5">
                          {row.slot_label.split('; ').map((line) => (
                            <span key={line}>{line}</span>
                          ))}
                        </span>
                      ),
                    },
                    {
                      key: 'total',
                      header: 'Total slots',
                      cell: (row) =>
                        row.total_slots_for_member != null ? row.total_slots_for_member : '—',
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      cell: (row) => statusBadge(row.status),
                    },
                  ]}
                />
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {byMember.map(([memberId, rows]) => {
              const label = memberDisplayName(rows[0], currentMemberId)
              return (
                <section key={memberId}>
                  <h3 className="text-lg font-bold text-black mb-3">{label}</h3>
                  <EnrollmentTable
                    rows={rows}
                    columns={[
                      {
                        key: 'class',
                        header: 'Class',
                        cell: (row) => row.class_name,
                      },
                      {
                        key: 'slot',
                        header: 'Time',
                        cell: (row) => (
                          <span className="inline-flex flex-col gap-0.5">
                            {row.slot_label.split('; ').map((line) => (
                              <span key={line}>{line}</span>
                            ))}
                          </span>
                        ),
                      },
                      {
                        key: 'total',
                        header: 'Total slots',
                        cell: (row) =>
                          row.total_slots_for_member != null ? row.total_slots_for_member : '—',
                      },
                      {
                        key: 'status',
                        header: 'Status',
                        cell: (row) => statusBadge(row.status),
                      },
                    ]}
                  />
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
