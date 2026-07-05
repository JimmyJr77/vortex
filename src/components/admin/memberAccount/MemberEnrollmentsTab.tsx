import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Zap, RotateCcw } from 'lucide-react'
import { adminFetchMemberEnrollments, type AdminEnrollmentRow } from '../../../utils/schedulingApi'
import AdminEnrollmentActionModal, {
  AdminEnrollmentStatusBadge,
  normalizeAdminEnrollmentStatus,
} from './AdminEnrollmentActionModal'

function money(cents: number | null | undefined) {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default function MemberEnrollmentsTab({ memberId }: { memberId: number; enrollments?: unknown[] }) {
  const [rows, setRows] = useState<AdminEnrollmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeRow, setActiveRow] = useState<AdminEnrollmentRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetchMemberEnrollments(memberId)
      setRows(data.rows ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments')
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    void load()
  }, [load])

  const monthlyTotal = useMemo(
    () =>
      rows
        .filter((r) => {
          const status = normalizeAdminEnrollmentStatus(r.status)
          return status === 'active' || status === 'waitlisted'
        })
        .reduce((sum, r) => sum + (r.adjusted_cost_cents ?? 0), 0),
    [rows],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Enrollments</h4>
          <p className="text-xs text-gray-500">
            Everything this account is enrolled in. Per-class cost reconciles to the monthly total.
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
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">No enrollments on record.</p>
      ) : (
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
                        onClick={() => setActiveRow(row)}
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
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={6} className="px-3 py-2 text-right font-semibold text-gray-900">
                  Estimated monthly total
                </td>
                <td className="px-3 py-2 text-right font-semibold text-gray-900">{money(monthlyTotal)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
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
