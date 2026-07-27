import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Zap, RotateCcw } from 'lucide-react'
import { adminFetchMemberEnrollments, type AdminEnrollmentRow } from '../../../utils/schedulingApi'
import AdminEnrollmentActionModal, {
  AdminEnrollmentStatusBadge,
  normalizeAdminEnrollmentStatus,
} from './AdminEnrollmentActionModal'
import type { MemberFamilyData } from './types'

function money(cents: number | null | undefined) {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

type FamilyMemberRef = {
  id: number
  firstName: string
  lastName: string
}

type MemberEnrollmentGroup = FamilyMemberRef & {
  rows: AdminEnrollmentRow[]
}

function memberLabel(member: { firstName?: string | null; lastName?: string | null }) {
  return `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Member'
}

function EnrollmentTable({
  rows,
  onManage,
}: {
  rows: AdminEnrollmentRow[]
  onManage: (row: AdminEnrollmentRow) => void
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 px-1 py-2">No enrollments on record.</p>
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-600">
          <tr>
            <th className="px-3 py-2 font-semibold">Sport</th>
            <th className="px-3 py-2 font-semibold">Program</th>
            <th className="px-3 py-2 font-semibold">Class</th>
            <th className="px-3 py-2 font-semibold">Offering</th>
            <th className="px-3 py-2 font-semibold">Schedule</th>
            <th className="px-3 py-2 font-semibold text-right">Class Cost</th>
            <th className="px-3 py-2 font-semibold text-right">Adjusted Cost</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const discounted =
              row.adjusted_cost_cents != null &&
              row.class_cost_cents != null &&
              row.adjusted_cost_cents < row.class_cost_cents
            return (
              <tr key={`${row.source}-${row.id}`} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2 text-gray-700">{row.sport_name || '—'}</td>
                <td className="px-3 py-2 text-gray-700">{row.program_name || '—'}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900">{row.class_name || '—'}</div>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {row.offering_label || row.offering_dates || '—'}
                </td>
                <td className="px-3 py-2 text-gray-600">{row.schedule || '—'}</td>
                <td className="px-3 py-2 text-right text-gray-700">{money(row.class_cost_cents)}</td>
                <td className="px-3 py-2 text-right">
                  <span className={discounted ? 'text-green-700 font-medium' : 'text-gray-700'}>
                    {money(row.adjusted_cost_cents)}
                  </span>
                  {row.manual_discount_reason && (
                    <div className="text-[10px] text-gray-400">{row.manual_discount_reason}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <AdminEnrollmentStatusBadge row={row} />
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => onManage(row)}
                    title="Manage enrollment"
                    className="inline-flex items-center justify-center rounded-md border border-gray-200 p-1.5 text-amber-600 hover:bg-amber-50 hover:border-amber-300"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function MemberEnrollmentsTab({
  memberId,
  memberName,
  familyData,
}: {
  memberId: number
  memberName?: string
  familyData?: MemberFamilyData | null
  enrollments?: unknown[]
}) {
  const [groups, setGroups] = useState<MemberEnrollmentGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeRow, setActiveRow] = useState<AdminEnrollmentRow | null>(null)

  const familyMembers = useMemo((): FamilyMemberRef[] => {
    const byId = new Map<number, FamilyMemberRef>()
    const [fallbackFirst = '', ...fallbackRest] = (memberName || '').trim().split(/\s+/)
    byId.set(memberId, {
      id: memberId,
      firstName: fallbackFirst,
      lastName: fallbackRest.join(' '),
    })
    for (const member of familyData?.members ?? []) {
      if (member.id == null) continue
      byId.set(Number(member.id), {
        id: Number(member.id),
        firstName: member.firstName || '',
        lastName: member.lastName || '',
      })
    }
    return [...byId.values()].sort((a, b) => {
      if (a.id === memberId) return -1
      if (b.id === memberId) return 1
      return memberLabel(a).localeCompare(memberLabel(b))
    })
  }, [familyData, memberId, memberName])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(
        familyMembers.map(async (member) => {
          try {
            const data = await adminFetchMemberEnrollments(member.id)
            return {
              id: member.id,
              firstName: data.member?.firstName || member.firstName,
              lastName: data.member?.lastName || member.lastName,
              rows: data.rows ?? [],
            } satisfies MemberEnrollmentGroup
          } catch (err) {
            if (member.id === memberId) throw err
            return {
              ...member,
              rows: [],
            } satisfies MemberEnrollmentGroup
          }
        }),
      )
      setGroups(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments')
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [familyMembers, memberId])

  useEffect(() => {
    void load()
  }, [load])

  const monthlyTotal = useMemo(
    () =>
      groups
        .flatMap((group) => group.rows)
        .filter((r) => {
          const status = normalizeAdminEnrollmentStatus(r.status)
          return status === 'active' || status === 'waitlisted'
        })
        .reduce((sum, r) => sum + (r.adjusted_cost_cents ?? 0), 0),
    [groups],
  )

  const hasAnyRows = groups.some((group) => group.rows.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Enrollments</h4>
          <p className="text-xs text-gray-500">
            Enrollments for this member and their family, grouped by family member. Per-class cost
            reconciles to the estimated monthly total.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading enrollments…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !hasAnyRows && groups.length <= 1 ? (
        <p className="text-sm text-gray-400">No enrollments on record.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section
              key={group.id}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
                <h5 className="text-sm font-bold text-gray-900">
                  {memberLabel(group)}
                  {group.id === memberId ? (
                    <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-vortex-red">
                      Selected
                    </span>
                  ) : null}
                </h5>
                <span className="text-xs text-gray-500">
                  {group.rows.length} enrollment{group.rows.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="p-3">
                <EnrollmentTable rows={group.rows} onManage={setActiveRow} />
              </div>
            </section>
          ))}

          {hasAnyRows ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-gray-900">Estimated family monthly total</span>
              <span className="text-sm font-semibold text-gray-900">{money(monthlyTotal)}</span>
            </div>
          ) : null}
        </div>
      )}

      {activeRow && (
        <AdminEnrollmentActionModal
          row={activeRow}
          onClose={() => setActiveRow(null)}
          onChanged={() => {
            setActiveRow(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
