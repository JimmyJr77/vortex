import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Search, Timer, Users } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type { ProgrammingMethodSummary } from '../../coach/types'
import { phaseDisplayName } from '../../coach/sessionPhaseKeys'
import LibraryExportControls from './LibraryExportControls'
import ProgrammingDetailModal from './ProgrammingDetailModal'
import ProgrammingCreateModal from './ProgrammingCreateModal'
import LibraryResultCount from './LibraryResultCount'

interface FilterState {
  q: string
  category: string
  phase: string
  groupFriendly: boolean
}

const emptyFilters: FilterState = { q: '', category: '', phase: '', groupFriendly: false }

const CATEGORY_OPTIONS = [
  'Timed Work Capacity',
  'Interval Training',
  'HIIT',
  'EMOM / AMRAP / Density',
  'Circuit Training',
  'Density Blocks',
  'Tempo Conditioning',
  'Repeat Sprint / Shuttle',
  'Aerobic Base / Zone 2',
  'Mixed-Modal Conditioning',
  'Partner / Team Relay',
  'Game-Based Conditioning',
  'Recovery / Restoration',
]

type ExportFormat = 'full-json' | 'simple-json'

function exportProgramming(methods: ProgrammingMethodSummary[], format: ExportFormat) {
  const blob = new Blob([
    JSON.stringify(
      format === 'simple-json'
        ? methods.map((m) => ({ name: m.name, definition: m.definition ?? m.coach_summary }))
        : methods,
      null,
      2,
    ),
  ], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `programming-library-${format === 'simple-json' ? 'simple' : 'full'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ProgrammingLibraryPanel() {
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [methods, setMethods] = useState<ProgrammingMethodSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.q) params.set('q', filters.q)
      if (filters.category) params.set('category', filters.category)
      if (filters.phase) params.set('phase', filters.phase)
      if (filters.groupFriendly) params.set('groupFriendly', 'true')
      const data = await coachFetch<ProgrammingMethodSummary[]>(`/api/coach/programming-methods?${params.toString()}`)
      setMethods(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load programming library')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Programming Methods</h2>
          <p className="text-sm text-gray-500">Reusable formats for organizing work — EMOM, intervals, circuits, density, repeat sprints, and more. These define HOW training is structured, not which movements to use.</p>
        </div>
        <LibraryExportControls
          disabled={loading || methods.length === 0}
          filenameStem="programming-library"
          options={[
            { value: 'full-json', label: 'Full JSON' },
            { value: 'simple-json', label: 'Simple JSON (name & definition)' },
          ]}
          onExport={(format) => exportProgramming(methods, format as ExportFormat)}
        />
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center justify-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
        >
          <Plus className="w-4 h-4" /> New Method
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search programming methods..."
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Category</label>
          <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Best phase</label>
          <select value={filters.phase} onChange={(e) => setFilters((f) => ({ ...f, phase: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Any phase</option>
            {['prepare_and_access', 'movement_intelligence', 'output', 'capacity', 'resilience', 'sustained_capacity', 'restore'].map((k) => (
              <option key={k} value={k}>{phaseDisplayName(k)}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm self-end pb-2 lg:col-span-4">
          <input type="checkbox" checked={filters.groupFriendly} onChange={(e) => setFilters((f) => ({ ...f, groupFriendly: e.target.checked }))} />
          Group friendly
        </label>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <LibraryResultCount count={methods.length} loading={loading} singular="method" plural="methods" />

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading programming library...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {methods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => setViewingId(method.id)}
              className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-indigo-200 transition-shadow w-full"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] uppercase tracking-wide text-indigo-700 font-semibold">{method.category}</span>
                  <h3 className="font-bold text-gray-900 mt-1">{method.name}</h3>
                </div>
              </div>
              <p className="text-sm text-gray-700 mt-2 line-clamp-2">{method.coach_summary ?? method.definition}</p>
              <div className="flex flex-wrap gap-1 mt-3">
                {method.best_session_phase && (
                  <span className="text-[11px] bg-blue-50 text-blue-800 rounded px-2 py-0.5">{phaseDisplayName(method.best_session_phase)}</span>
                )}
                {method.fatigue_level && (
                  <span className="text-[11px] bg-amber-50 text-amber-800 rounded px-2 py-0.5">Fatigue: {method.fatigue_level}</span>
                )}
                {method.group_friendly && (
                  <span className="text-[11px] bg-green-50 text-green-800 rounded px-2 py-0.5 inline-flex items-center gap-1"><Users className="w-3 h-3" /> Group</span>
                )}
                {method.requires_timer && (
                  <span className="text-[11px] bg-gray-100 text-gray-700 rounded px-2 py-0.5 inline-flex items-center gap-1"><Timer className="w-3 h-3" /> Timer</span>
                )}
              </div>
              {method.sample_work_rest && (
                <p className="text-xs text-gray-500 mt-2">Typical: {method.sample_work_rest}</p>
              )}
              {method.why_preview && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{method.why_preview}</p>
              )}
            </button>
          ))}
          {methods.length === 0 && <div className="text-sm text-gray-500 col-span-full">No programming methods match your filters.</div>}
        </div>
      )}

      {viewingId != null && (
        <ProgrammingDetailModal methodId={viewingId} onClose={() => setViewingId(null)} />
      )}
      {creating && (
        <ProgrammingCreateModal onClose={() => setCreating(false)} onCreated={() => void load()} />
      )}
    </div>
  )
}
