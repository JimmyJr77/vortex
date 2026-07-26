import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Gauge, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { coachFetch } from '../../coach/api'

const DIMENSIONS = [
  'technicalComplexity', 'absoluteLoadDemand', 'supervisionDemand',
  'failureConsequence', 'impact', 'workCapacityDemand',
  'gripDemand', 'spinalLoading', 'eccentricStress',
  'localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity',
  'impactAccumulation',
] as const

const DIMENSION_LABELS: Partial<Record<(typeof DIMENSIONS)[number], string>> = {
  technicalComplexity: 'Technical complexity',
  absoluteLoadDemand: 'Physical difficulty',
}

interface Candidate {
  variant_id: string
  exercise_name: string
  variant_name: string
  family_key: string
  difficulty_json: Record<string, number>
  load_profile_json: Record<string, number | string>
  fatigue_profile_json: Record<string, number>
}

interface Calibration {
  id: string
  exercise_name: string
  variant_name: string
  dimension: string
  proposed_score: number
  anchor_tier: number
  rationale: string
  status: 'review' | 'approved' | 'rejected' | 'superseded'
  creator_name: string | null
  reviewer_name: string | null
  review_notes: string | null
}

function currentScore(candidate: Candidate | undefined, dimension: string): number | null {
  if (!candidate) return null
  const value = candidate.difficulty_json[dimension]
    ?? candidate.load_profile_json[dimension]
    ?? candidate.fatigue_profile_json[dimension]
  return typeof value === 'number' ? value : null
}

export function CanonicalCalibrationWorkspace() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [calibrations, setCalibrations] = useState<Calibration[]>([])
  const [variantId, setVariantId] = useState('')
  const [dimension, setDimension] = useState<string>('technicalComplexity')
  const [score, setScore] = useState(40)
  const [tier, setTier] = useState(40)
  const [rationale, setRationale] = useState('')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [candidateRows, calibrationRows] = await Promise.all([
        coachFetch<Candidate[]>('/api/coach/canonical/calibration-candidates'),
        coachFetch<Calibration[]>('/api/coach/canonical/calibrations'),
      ])
      setCandidates(candidateRows)
      setCalibrations(calibrationRows)
      setVariantId((current) => current || candidateRows[0]?.variant_id || '')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load calibration workspace.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const propose = async () => {
    if (!variantId || rationale.trim().length < 20) return
    setSaving(true)
    setError(null)
    try {
      await coachFetch('/api/coach/canonical/calibrations', {
        method: 'POST',
        body: JSON.stringify({
          variantId,
          dimension,
          proposedScore: score,
          anchorTier: tier,
          rationale,
        }),
      })
      setRationale('')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit calibration proposal.')
    } finally {
      setSaving(false)
    }
  }

  const review = async (id: string, decision: 'approved' | 'rejected') => {
    const notes = reviewNotes[id]?.trim() || ''
    if (notes.length < 10) return
    setSaving(true)
    setError(null)
    try {
      await coachFetch(`/api/coach/canonical/calibrations/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes }),
      })
      setReviewNotes((current) => ({ ...current, [id]: '' }))
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not review calibration proposal.')
    } finally {
      setSaving(false)
    }
  }

  const selected = candidates.find((candidate) => candidate.variant_id === variantId)

  return (
    <section className="space-y-5" aria-labelledby="calibration-heading">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="calibration-heading" className="flex items-center gap-2 text-lg font-bold text-gray-950"><Gauge className="h-5 w-5 text-blue-700" />Score calibration workspace</h3>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">Compare published variants to 20/40/60/80 anchors. Technical complexity and physical difficulty are assessed independently; overall difficulty is derived from them. Proposals require an independent reviewer and preserve their full history.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />Refresh</button>
      </header>

      {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h4 className="font-semibold text-blue-950">Propose an anchor</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">Published variant
            <select value={variantId} onChange={(event) => setVariantId(event.target.value)} className="mt-1 w-full rounded border border-blue-200 bg-white px-3 py-2">
              {candidates.map((candidate) => <option key={candidate.variant_id} value={candidate.variant_id}>{candidate.exercise_name} · {candidate.variant_name}</option>)}
            </select>
          </label>
          <label className="text-sm">Dimension
            <select value={dimension} onChange={(event) => setDimension(event.target.value)} className="mt-1 w-full rounded border border-blue-200 bg-white px-3 py-2">
              {DIMENSIONS.map((value) => <option key={value} value={value}>{DIMENSION_LABELS[value] ?? value}</option>)}
            </select>
          </label>
          <label className="text-sm">Proposed score (current: {currentScore(selected, dimension) ?? 'unset'})
            <input type="number" min={1} max={100} value={score} onChange={(event) => setScore(Number(event.target.value))} className="mt-1 w-full rounded border border-blue-200 px-3 py-2" />
          </label>
          <label className="text-sm">Anchor tier
            <select value={tier} onChange={(event) => setTier(Number(event.target.value))} className="mt-1 w-full rounded border border-blue-200 bg-white px-3 py-2">
              {[20, 40, 60, 80].map((value) => <option key={value} value={value}>{value} — {value <= 20 ? 'low' : value <= 40 ? 'moderate' : value <= 60 ? 'high' : 'very high'}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-sm">Evidence and comparison rationale
          <textarea rows={3} minLength={20} maxLength={2000} value={rationale} onChange={(event) => setRationale(event.target.value)} className="mt-1 w-full rounded border border-blue-200 px-3 py-2" placeholder="Explain the observable criteria and which approved anchors support this score." />
        </label>
        <button type="button" disabled={saving || !variantId || rationale.trim().length < 20} onClick={() => void propose()} className="mt-3 rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Submit for independent review</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading calibration queue</div>
      ) : (
        <div className="space-y-3">
          {calibrations.length === 0 && <p className="rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500">No calibration proposals yet.</p>}
          {calibrations.map((item) => (
            <article key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-gray-950">{item.exercise_name} · {item.variant_name}</h4>
                  <p className="text-sm text-gray-700">{item.dimension}: <strong>{item.proposed_score}</strong> · anchor {item.anchor_tier}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : item.status === 'rejected' ? 'bg-red-100 text-red-800' : item.status === 'review' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>{item.status}</span>
              </div>
              <p className="mt-2 text-sm text-gray-700">{item.rationale}</p>
              <p className="mt-1 text-xs text-gray-500">Proposed by {item.creator_name ?? 'unknown reviewer'}{item.reviewer_name ? ` · reviewed by ${item.reviewer_name}` : ''}</p>
              {item.status === 'review' && (
                <div className="mt-3">
                  <label className="text-sm">Independent review notes
                    <textarea rows={2} value={reviewNotes[item.id] ?? ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
                  </label>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={saving || (reviewNotes[item.id]?.trim().length ?? 0) < 10} onClick={() => void review(item.id, 'approved')} className="inline-flex items-center gap-1 rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Approve anchor</button>
                    <button type="button" disabled={saving || (reviewNotes[item.id]?.trim().length ?? 0) < 10} onClick={() => void review(item.id, 'rejected')} className="inline-flex items-center gap-1 rounded bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><XCircle className="h-4 w-4" />Reject</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
