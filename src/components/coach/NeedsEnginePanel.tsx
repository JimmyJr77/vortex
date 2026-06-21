import { useState } from 'react'
import { Loader2, Sparkles, Plus, Trash2, ArrowRight } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import { useCoachBuilderStore } from '../../coach/useCoachBuilderStore'
import type { FacetType } from '../../coach/taxonomy'
import type { PrescriptionResult, Workout } from '../../coach/types'

interface TargetRow {
  facetType: FacetType
  facetId: number | ''
  weight: number
}

interface BlockRow {
  label: string
  intentId: number | ''
  minutes: number
}

export default function NeedsEnginePanel({ onSendToBuilder }: { onSendToBuilder?: () => void }) {
  const { taxonomy } = useTaxonomy()
  const setWorkout = useCoachBuilderStore((s) => s.setWorkout)
  const [sportId, setSportId] = useState<number | ''>('')
  const [skillLevel, setSkillLevel] = useState('')
  const [ageMin, setAgeMin] = useState<number | ''>('')
  const [ageMax, setAgeMax] = useState<number | ''>('')
  const [equipmentIds, setEquipmentIds] = useState<number[]>([])
  const [excludeBodyRegionIds, setExcludeBodyRegionIds] = useState<number[]>([])
  const [targets, setTargets] = useState<TargetRow[]>([{ facetType: 'tenet', facetId: '', weight: 4 }])
  const [blocks, setBlocks] = useState<BlockRow[]>([
    { label: 'Warmup', intentId: '', minutes: 10 },
    { label: 'Main Work', intentId: '', minutes: 30 },
    { label: 'Conditioning', intentId: '', minutes: 10 },
  ])
  const [result, setResult] = useState<PrescriptionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nlPrompt, setNlPrompt] = useState('')
  const [nlLoading, setNlLoading] = useState(false)

  const facetOptions: Record<string, { id?: number; name: string }[]> = {
    tenet: taxonomy?.tenets ?? [],
    methodology: taxonomy?.methodologies ?? [],
    physiology: taxonomy?.physiology ?? [],
  }

  const prescribe = async () => {
    setLoading(true)
    setError(null)
    try {
      const body = {
        sportId: sportId || null,
        skillLevel: skillLevel || null,
        ageMin: ageMin || null,
        ageMax: ageMax || null,
        equipmentIds,
        excludeBodyRegionIds,
        targets: targets.filter((t) => t.facetId !== '').map((t) => ({ facetType: t.facetType, facetId: t.facetId, weight: t.weight })),
        blocks: blocks.map((b) => ({ label: b.label, intentId: b.intentId || null, minutes: b.minutes })),
      }
      const data = await coachFetch<PrescriptionResult>('/api/coach/needs-engine/prescribe', { method: 'POST', body: JSON.stringify(body) })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prescription failed')
    } finally {
      setLoading(false)
    }
  }

  const runNaturalLanguage = async () => {
    if (!nlPrompt.trim()) return
    setNlLoading(true)
    setError(null)
    try {
      const data = await coachFetch<PrescriptionResult & { parsed: { sportId: number | null; skillLevel: string | null; equipmentIds: number[]; targets: TargetRow[]; blocks: Array<{ label: string; intentId: number | null; minutes: number }> } }>(
        '/api/coach/ai/nl-needs', { method: 'POST', body: JSON.stringify({ prompt: nlPrompt }) },
      )
      const p = data.parsed
      setSportId(p.sportId ?? '')
      setSkillLevel(p.skillLevel ?? '')
      setEquipmentIds(p.equipmentIds ?? [])
      if (Array.isArray(p.targets) && p.targets.length > 0) {
        setTargets(p.targets.map((t) => ({ facetType: t.facetType, facetId: t.facetId, weight: t.weight })))
      }
      if (Array.isArray(p.blocks) && p.blocks.length > 0) {
        setBlocks(p.blocks.map((b) => ({ label: b.label, intentId: b.intentId ?? '', minutes: b.minutes })))
      }
      setResult({ blocks: data.blocks, candidates: data.candidates })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not interpret that request')
    } finally {
      setNlLoading(false)
    }
  }

  const sendToBuilder = () => {
    if (!result) return
    const workout: Workout = {
      title: 'Prescribed Session',
      type: 'workout',
      sport_id: sportId || null,
      target_minutes: blocks.reduce((sum, b) => sum + b.minutes, 0),
      blocks: result.blocks.map((b) => ({
        label: b.label,
        block_format: 'straight_sets',
        rounds: 1,
        rest_between_rounds_seconds: 0,
        items: b.items.map((it) => ({
          exercise_id: it.exercise_id,
          exercise_name: it.exercise_name,
          sets: it.sets,
          reps: it.reps ?? null,
          rest_seconds: it.rest_seconds ?? 30,
          work_seconds: it.work_seconds ?? null,
          est_seconds_per_set: it.est_seconds_per_set,
        })),
      })),
    }
    setWorkout(workout)
    onSendToBuilder?.()
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Sparkles className="w-6 h-6 text-vortex-red" /> Needs Engine</h2>
        <p className="text-sm text-gray-500">Describe the need; get a time-packed, tenet-targeted session back.</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-4 text-white">
        <label className="block text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-vortex-red" /> Describe the need in plain language</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runNaturalLanguage() }}
            placeholder="e.g. 30 minute beginner gymnastics session focused on power and balance with bodyweight only"
            className="flex-1 rounded-lg px-3 py-2 text-gray-900"
          />
          <button type="button" onClick={() => void runNaturalLanguage()} disabled={nlLoading || !nlPrompt.trim()} className="bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {nlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Interpret
          </button>
        </div>
        <p className="text-xs text-white/60 mt-2">Parsed into explicit filters below, then run through the same deterministic engine.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Sport</span>
              <select value={sportId} onChange={(e) => setSportId(e.target.value ? Number(e.target.value) : '')} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Universal</option>
                {taxonomy?.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Skill Level</span>
              <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Any</option>
                <option value="EARLY_STAGE">Early Stage</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Age min</span>
              <input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value ? Number(e.target.value) : '')} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Age max</span>
              <input type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value ? Number(e.target.value) : '')} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
          </div>

          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-2">Available equipment <span className="font-normal text-gray-400">(blank = any)</span></span>
            <div className="flex flex-wrap gap-2">
              {(taxonomy?.equipment ?? []).map((eq) => {
                const active = equipmentIds.includes(eq.id)
                return (
                  <button key={eq.id} type="button" onClick={() => setEquipmentIds(active ? equipmentIds.filter((x) => x !== eq.id) : [...equipmentIds, eq.id])} className={`rounded-full border px-2.5 py-1 text-xs ${active ? 'border-vortex-red bg-red-50 text-vortex-red' : 'border-gray-200 text-gray-600'}`}>
                    {eq.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-2">Avoid (contraindicated regions)</span>
            <div className="flex flex-wrap gap-2">
              {(taxonomy?.bodyRegions ?? []).map((br) => {
                const active = excludeBodyRegionIds.includes(br.id)
                return (
                  <button key={br.id} type="button" onClick={() => setExcludeBodyRegionIds(active ? excludeBodyRegionIds.filter((x) => x !== br.id) : [...excludeBodyRegionIds, br.id])} className={`rounded-full border px-2.5 py-1 text-xs ${active ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600'}`}>
                    {br.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Targets</span>
              <button type="button" onClick={() => setTargets([...targets, { facetType: 'tenet', facetId: '', weight: 3 }])} className="text-vortex-red text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
            </div>
            <div className="space-y-2">
              {targets.map((t, i) => (
                <div key={i} className="grid grid-cols-[110px_1fr_70px_auto] gap-2 items-center text-sm">
                  <select value={t.facetType} onChange={(e) => setTargets(targets.map((x, j) => j === i ? { ...x, facetType: e.target.value as FacetType, facetId: '' } : x))} className="border border-gray-300 rounded px-2 py-1">
                    <option value="tenet">Tenet</option>
                    <option value="methodology">Methodology</option>
                    <option value="physiology">Physiology</option>
                  </select>
                  <select value={t.facetId} onChange={(e) => setTargets(targets.map((x, j) => j === i ? { ...x, facetId: e.target.value ? Number(e.target.value) : '' } : x))} className="border border-gray-300 rounded px-2 py-1">
                    <option value="">Select...</option>
                    {(facetOptions[t.facetType] ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <select value={t.weight} onChange={(e) => setTargets(targets.map((x, j) => j === i ? { ...x, weight: Number(e.target.value) } : x))} className="border border-gray-300 rounded px-2 py-1" title="Priority">
                    {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>P{w}</option>)}
                  </select>
                  <button type="button" onClick={() => setTargets(targets.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Time blocks</span>
              <button type="button" onClick={() => setBlocks([...blocks, { label: 'Block', intentId: '', minutes: 15 }])} className="text-vortex-red text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
            </div>
            <div className="space-y-2">
              {blocks.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_70px_auto] gap-2 items-center text-sm">
                  <input value={b.label} onChange={(e) => setBlocks(blocks.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className="border border-gray-300 rounded px-2 py-1" />
                  <select value={b.intentId} onChange={(e) => setBlocks(blocks.map((x, j) => j === i ? { ...x, intentId: e.target.value ? Number(e.target.value) : '' } : x))} className="border border-gray-300 rounded px-2 py-1">
                    <option value="">Any intent</option>
                    {taxonomy?.intents.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <input type="number" value={b.minutes} onChange={(e) => setBlocks(blocks.map((x, j) => j === i ? { ...x, minutes: Number(e.target.value) || 0 } : x))} className="border border-gray-300 rounded px-2 py-1" />
                  <button type="button" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => void prescribe()} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-vortex-red text-white py-2.5 rounded-lg font-semibold disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Prescribe Session
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Prescription</h3>
            {result && (
              <button type="button" onClick={sendToBuilder} className="flex items-center gap-1 text-sm text-vortex-red font-medium">
                Send to builder <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          {!result && <div className="text-sm text-gray-500">Run a prescription to see results.</div>}
          {result && (
            <div className="space-y-4">
              {result.blocks.map((b, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">{b.label}</span>
                    <span className="text-xs text-gray-500">~{b.estimated_minutes}m / {b.target_minutes}m</span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {b.items.map((it) => (
                      <li key={it.exercise_id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{it.exercise_name} <span className="text-gray-400">{it.sets}x{it.reps ?? '-'}</span></span>
                        <span className="text-xs text-vortex-red font-medium">score {it.score}</span>
                      </li>
                    ))}
                    {b.items.length === 0 && <li className="text-xs text-gray-400">No matching exercises.</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
