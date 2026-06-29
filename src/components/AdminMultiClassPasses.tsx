import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Loader2 } from 'lucide-react'
import AdminClassPicker from './admin/AdminClassPicker'
import { adminFetchMultiClassPasses, type AdminMultiClassPassRow, type ClassEvent } from '../utils/programsApi'

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const AdminMultiClassPasses = () => {
  const [selectedClassEvent, setSelectedClassEvent] = useState<ClassEvent | null>(null)
  const [passes, setPasses] = useState<AdminMultiClassPassRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPasses = useCallback(async (classEvent: ClassEvent | null) => {
    setLoading(true)
    setError(null)
    try {
      const rows = await adminFetchMultiClassPasses(
        classEvent ? { classEventId: classEvent.id } : undefined,
      )
      setPasses(rows)
    } catch (e) {
      setPasses([])
      setError(e instanceof Error ? e.message : 'Failed to load multi-class passes')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelectClass = (classEvent: ClassEvent) => {
    setSelectedClassEvent(classEvent)
    void loadPasses(classEvent)
  }

  const handleShowAll = () => {
    setSelectedClassEvent(null)
    void loadPasses(null)
  }

  useEffect(() => {
    void loadPasses(null)
  }, [loadPasses])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-vortex-red" />
          Multi-Class Passes
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Active and historical multi-class pass balances for programs that offer prepaid packages.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <AdminClassPicker
          selectedClassEventId={selectedClassEvent?.id ?? null}
          onSelectClass={handleSelectClass}
        />
        <button
          type="button"
          onClick={handleShowAll}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Show all programs
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-vortex-red" />
        </div>
      )}

      {!loading && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Member</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Program</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Package</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Purchased</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Remaining</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Purchased on</th>
                </tr>
              </thead>
              <tbody>
                {passes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {selectedClassEvent
                        ? 'No multi-class passes for this class program yet.'
                        : 'No multi-class passes on file yet.'}
                    </td>
                  </tr>
                ) : (
                  passes.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.memberName}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.programDisplayName ?? `Program #${row.programsId}`}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.packageLabel ?? row.packageId}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{row.classCountPurchased}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {row.classesRemaining}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatMoney(row.priceCents)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(row.purchasedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminMultiClassPasses
