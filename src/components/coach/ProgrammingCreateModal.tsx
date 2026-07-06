import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { phaseDisplayName } from '../../coach/sessionPhaseKeys'

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

export default function ProgrammingCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0])
  const [bestPhase, setBestPhase] = useState('sustained_capacity')
  const [programmingType, setProgrammingType] = useState('custom')
  const [definition, setDefinition] = useState('')
  const [coachSummary, setCoachSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await coachFetch('/api/coach/programming-methods', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          category,
          programming_type: programmingType,
          best_session_phase: bestPhase,
          definition: definition.trim() || null,
          coach_summary: coachSummary.trim() || null,
          is_published: false,
          visibility: 'private',
        }),
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create programming method')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-900">New Programming Method</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
          <label className="block text-sm">
            <span className="font-semibold text-gray-700">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-gray-700">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-gray-700">Best session phase</span>
            <select value={bestPhase} onChange={(e) => setBestPhase(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              {['prepare_and_access', 'movement_intelligence', 'output', 'capacity', 'resilience', 'sustained_capacity', 'restore'].map((k) => (
                <option key={k} value={k}>{phaseDisplayName(k)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-gray-700">Programming type</span>
            <select value={programmingType} onChange={(e) => setProgrammingType(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              {['custom', 'emom', 'amrap', 'interval', 'circuit', 'density', 'timed_work_capacity', 'repeat_shuttle', 'game'].map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-gray-700">Definition</span>
            <textarea value={definition} onChange={(e) => setDefinition(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-gray-700">Coach summary</span>
            <textarea value={coachSummary} onChange={(e) => setCoachSummary(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving} className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create draft
          </button>
        </div>
      </div>
    </div>
  )
}
