import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock, Unlock } from 'lucide-react'
import AdminClassSetupOverviewTable from './AdminClassSetupOverviewTable'
import { fetchClassSetupOverview, type ClassSetupOverviewRow } from '../../utils/classSetupOverviewApi'
import { type SchedulingNavigationIntent } from '../../utils/schedulingNavigation'

interface Props {
  onOpenScheduling?: (intent: SchedulingNavigationIntent) => void
}

const AdminClassSetupOverview = ({ onOpenScheduling }: Props) => {
  const [rows, setRows] = useState<ClassSetupOverviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchClassSetupOverview()
      setRows(data.rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load overview')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Class Master</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            All classes in one spreadsheet. Unlock to edit cells; drag column or row borders to resize.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-sm text-gray-500">
              {rows.length} class{rows.length !== 1 ? 'es' : ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => setUnlocked((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border ${
              unlocked
                ? 'border-vortex-red bg-vortex-red/5 text-vortex-red'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {unlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {unlocked ? 'Editing unlocked' : 'Locked'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center text-gray-500 inline-flex items-center gap-2 justify-center w-full">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading class master…
        </div>
      )}

      {!loading && error && (
        <div className="py-8 text-center">
          <p className="text-red-600 mb-3">{error}</p>
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="py-12 text-center text-gray-500 border border-dashed rounded-xl">
          No classes found.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <AdminClassSetupOverviewTable
          rows={rows}
          unlocked={unlocked}
          onRefresh={load}
          onOpenScheduling={onOpenScheduling}
        />
      )}
    </div>
  )
}

export default AdminClassSetupOverview
