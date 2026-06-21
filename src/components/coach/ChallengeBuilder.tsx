import { useCallback, useEffect, useState } from 'react'
import { Plus, Trophy } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import { useRosterMembers } from './useRosterMembers'
import type { FacetType } from '../../coach/taxonomy'

interface CriterionRow {
  facetType: FacetType
  facetId: number
}

interface Challenge {
  id: number
  title: string
  description?: string | null
  scoring_type: string
  unit?: string | null
  starts_on?: string | null
  ends_on?: string | null
  sport_name?: string | null
  entry_count?: number
}

interface ChallengeDetail extends Challenge {
  entries: Array<{ id: number; member_id: number; first_name: string; last_name: string; value_numeric: number | null; recorded_at: string }>
}

export default function ChallengeBuilder() {
  const { taxonomy } = useTaxonomy()
  const { members } = useRosterMembers()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [detail, setDetail] = useState<ChallengeDetail | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', sport_id: '', scoring_type: 'max_reps', unit: '', starts_on: '', ends_on: '' })
  const [criteria, setCriteria] = useState<CriterionRow[]>([])
  const [entry, setEntry] = useState({ memberId: '', value: '' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setChallenges(await coachFetch<Challenge[]>('/api/coach/challenges'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load challenges')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = async (id: number) => {
    setDetail(await coachFetch<ChallengeDetail>(`/api/coach/challenges/${id}`))
  }

  const create = async () => {
    setSaving(true)
    setError(null)
    try {
      await coachFetch('/api/coach/challenges', {
        method: 'POST',
        body: JSON.stringify({ ...form, sport_id: form.sport_id || null, criteria }),
      })
      setCreating(false)
      setForm({ title: '', description: '', sport_id: '', scoring_type: 'max_reps', unit: '', starts_on: '', ends_on: '' })
      setCriteria([])
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create challenge')
    } finally {
      setSaving(false)
    }
  }

  const addEntry = async () => {
    if (!detail || !entry.memberId) return
    await coachFetch(`/api/coach/challenges/${detail.id}/entries`, {
      method: 'POST',
      body: JSON.stringify({ memberId: Number(entry.memberId), value: entry.value ? Number(entry.value) : null }),
    })
    setEntry({ memberId: '', value: '' })
    await openDetail(detail.id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Trophy className="w-6 h-6 text-vortex-red" /> Challenges</h2>
          <p className="text-sm text-gray-500">Design scored competitions and track the leaderboard.</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold"><Plus className="w-4 h-4" /> New Challenge</button>
      </div>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {challenges.map((c) => (
            <button key={c.id} type="button" onClick={() => void openDetail(c.id)} className={`w-full text-left bg-white border rounded-xl p-4 hover:shadow-md ${detail?.id === c.id ? 'border-vortex-red' : 'border-gray-200'}`}>
              <div className="font-bold text-gray-900">{c.title}</div>
              <div className="text-xs text-gray-500 mt-1">{c.scoring_type.replace('_', ' ')} · {c.entry_count ?? 0} entries</div>
            </button>
          ))}
          {challenges.length === 0 && <div className="text-sm text-gray-500">No challenges yet.</div>}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          {!detail && <div className="text-sm text-gray-500">Select a challenge to view its leaderboard.</div>}
          {detail && (
            <div>
              <h3 className="font-bold text-gray-900">{detail.title}</h3>
              <p className="text-sm text-gray-500">{detail.description}</p>
              <div className="mt-3 flex gap-2 items-end">
                <label className="text-sm flex-1">
                  <span className="block text-xs font-semibold text-gray-500 mb-1">Athlete</span>
                  <select value={entry.memberId} onChange={(e) => setEntry({ ...entry, memberId: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5">
                    <option value="">Select...</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
                <label className="text-sm w-24">
                  <span className="block text-xs font-semibold text-gray-500 mb-1">Score</span>
                  <input type="number" value={entry.value} onChange={(e) => setEntry({ ...entry, value: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5" />
                </label>
                <button type="button" onClick={() => void addEntry()} className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm">Log</button>
              </div>
              <ol className="mt-4 space-y-1">
                {detail.entries.map((e, i) => (
                  <li key={e.id} className="flex justify-between text-sm border-b border-gray-50 py-1">
                    <span><span className="text-gray-400 mr-2">{i + 1}.</span>{e.first_name} {e.last_name}</span>
                    <span className="font-semibold text-vortex-red">{e.value_numeric ?? '-'}</span>
                  </li>
                ))}
                {detail.entries.length === 0 && <li className="text-xs text-gray-400">No entries yet.</li>}
              </ol>
            </div>
          )}
        </div>
      </div>

      {creating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-3">
            <h3 className="font-bold text-lg">New Challenge</h3>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.scoring_type} onChange={(e) => setForm({ ...form, scoring_type: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2">
                <option value="max_reps">Max reps</option>
                <option value="fastest_time">Fastest time</option>
                <option value="max_load">Max load</option>
                <option value="distance">Distance</option>
                <option value="streak">Streak</option>
              </select>
              <select value={form.sport_id} onChange={(e) => setForm({ ...form, sport_id: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Universal</option>
                {taxonomy?.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unit (reps, sec...)" className="border border-gray-300 rounded-lg px-3 py-2" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-2" />
                <input type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-2" />
              </div>
            </div>
            <div>
              <span className="block text-sm font-semibold text-gray-700 mb-2">Focus (tenets)</span>
              <div className="flex flex-wrap gap-2">
                {(taxonomy?.tenets ?? []).map((t) => {
                  const active = criteria.some((c) => c.facetType === 'tenet' && c.facetId === t.id)
                  return (
                    <button key={t.id} type="button" onClick={() => setCriteria(active ? criteria.filter((c) => !(c.facetType === 'tenet' && c.facetId === t.id!)) : [...criteria, { facetType: 'tenet', facetId: t.id! }])} className={`rounded-full border px-2.5 py-1 text-xs ${active ? 'border-vortex-red bg-red-50 text-vortex-red' : 'border-gray-200 text-gray-600'}`}>
                      {t.name}
                    </button>
                  )
                })}
              </div>
              <span className="block text-sm font-semibold text-gray-700 mb-2 mt-3">Focus (methodologies)</span>
              <div className="flex flex-wrap gap-2">
                {(taxonomy?.methodologies ?? []).map((m) => {
                  const active = criteria.some((c) => c.facetType === 'methodology' && c.facetId === m.id)
                  return (
                    <button key={m.id} type="button" onClick={() => setCriteria(active ? criteria.filter((c) => !(c.facetType === 'methodology' && c.facetId === m.id!)) : [...criteria, { facetType: 'methodology', facetId: m.id! }])} className={`rounded-full border px-2.5 py-1 text-xs ${active ? 'border-vortex-red bg-red-50 text-vortex-red' : 'border-gray-200 text-gray-600'}`}>
                      {m.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Cancel</button>
              <button type="button" onClick={() => void create()} disabled={saving || !form.title} className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
