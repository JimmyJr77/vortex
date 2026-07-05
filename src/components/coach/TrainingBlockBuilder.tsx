import { useCallback, useEffect, useState } from 'react'
import { CalendarRange, Loader2, Plus, Save } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type { TrainingBlockTemplate } from '../../coach/types'

export default function TrainingBlockBuilder() {
  const [blocks, setBlocks] = useState<TrainingBlockTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<TrainingBlockTemplate>({
    name: '',
    description: '',
    duration_days: 7,
    sessions_per_week: 3,
    sessions: [{ day_index: 1, session_name: 'Day 1', duration_minutes: 60 }],
    regimen_rationale_json: { weekly_why: 'Balance neural, strength, skill, and recovery across the week.' },
  })
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setBlocks(await coachFetch<TrainingBlockTemplate[]>('/api/coach/training-blocks'))
    } catch {
      setBlocks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    setMessage(null)
    try {
      await coachFetch('/api/coach/training-blocks', { method: 'POST', body: JSON.stringify(draft) })
      setMessage('Block saved.')
      setDraft({ name: '', description: '', duration_days: 7, sessions_per_week: 3, sessions: [{ day_index: 1, session_name: 'Day 1', duration_minutes: 60 }] })
      void load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CalendarRange className="w-6 h-6 text-vortex-red" /> Training Block Builder</h2>
        <p className="text-sm text-gray-500">Multi-day block templates with weekly session grid and regimen rationale.</p>
      </div>
      {message && <div className="rounded-lg bg-gray-100 text-gray-800 px-4 py-2 text-sm">{message}</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Block name" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          <textarea value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          <textarea
            value={String((draft.regimen_rationale_json as { weekly_why?: string })?.weekly_why ?? '')}
            onChange={(e) => setDraft({ ...draft, regimen_rationale_json: { ...draft.regimen_rationale_json, weekly_why: e.target.value } })}
            placeholder="Weekly why / rationale"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          {(draft.sessions ?? []).map((s, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 text-sm">
              <input type="number" value={s.day_index} onChange={(e) => setDraft({ ...draft, sessions: draft.sessions!.map((x, j) => j === i ? { ...x, day_index: Number(e.target.value) } : x) })} className="border border-gray-300 rounded px-2 py-1" placeholder="Day" />
              <input value={s.session_name ?? ''} onChange={(e) => setDraft({ ...draft, sessions: draft.sessions!.map((x, j) => j === i ? { ...x, session_name: e.target.value } : x) })} className="border border-gray-300 rounded px-2 py-1 col-span-2" placeholder="Session name" />
            </div>
          ))}
          <button type="button" onClick={() => setDraft({ ...draft, sessions: [...(draft.sessions ?? []), { day_index: (draft.sessions?.length ?? 0) + 1, session_name: `Day ${(draft.sessions?.length ?? 0) + 1}`, duration_minutes: 60 }] })} className="text-sm text-vortex-red flex items-center gap-1"><Plus className="w-4 h-4" /> Add day</button>
          <button type="button" onClick={() => void save()} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-vortex-red text-white py-2 rounded-lg font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save block
          </button>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Saved blocks</h3>
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : blocks.length === 0 ? <p className="text-sm text-gray-500">No blocks yet.</p> : (
            <ul className="space-y-2">
              {blocks.map((b) => (
                <li key={b.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="font-semibold text-gray-900">{b.name}</div>
                  <div className="text-xs text-gray-500">{b.duration_days} days · {b.sessions_per_week}/wk</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
