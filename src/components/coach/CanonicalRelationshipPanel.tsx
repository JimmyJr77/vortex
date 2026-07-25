import { useState } from 'react'
import { AlertTriangle, Loader2, Network } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type { CanonicalCard, CanonicalCardSummary } from './canonicalCardTypes'

const RELATIONSHIPS = [
  'regression',
  'progression',
  'lateral_substitution',
  'equipment_equivalent',
  'phase_equivalent',
  'compatible_pairing',
  'contraindicated_pairing',
] as const

const DIMENSIONS = ['load', 'leverage', 'range', 'speed', 'stability', 'complexity', 'impact', 'decision_demand', 'fatigue'] as const

interface CanonicalRelationshipPanelProps {
  cards: CanonicalCardSummary[]
  onChanged: () => void
}

export function CanonicalRelationshipPanel({ cards, onChanged }: CanonicalRelationshipPanelProps) {
  const [fromCardId, setFromCardId] = useState('')
  const [toCardId, setToCardId] = useState('')
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIPS)[number]>('progression')
  const [similarityScore, setSimilarityScore] = useState(85)
  const [dimensions, setDimensions] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!fromCardId || !toCardId || !reason.trim()) return
    setSaving(true)
    setError(null)
    try {
      const [fromCard, toCard] = await Promise.all([
        coachFetch<CanonicalCard>(`/api/coach/canonical/cards/${fromCardId}`),
        coachFetch<CanonicalCard>(`/api/coach/canonical/cards/${toCardId}`),
      ])
      const fromVariantId = fromCard.variants[0]?.id
      const toVariantId = toCard.variants[0]?.id
      if (!fromVariantId || !toVariantId) throw new Error('Both cards need an authored variant before they can be related.')
      await coachFetch('/api/coach/canonical/relationships', {
        method: 'POST',
        body: JSON.stringify({
          fromVariantId,
          toVariantId,
          relationship,
          similarityScore,
          dimensions,
          reason,
          conditions: {},
        }),
      })
      setReason('')
      setDimensions([])
      onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save relationship.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4" aria-labelledby="relationship-heading">
      <h3 id="relationship-heading" className="flex items-center gap-2 font-semibold text-gray-950"><Network className="h-4 w-4" />Reviewed relationship graph</h3>
      <p className="mt-1 text-xs text-gray-500">New edges enter review state. Progressions and regressions must identify exactly what changes.</p>
      {error && <div role="alert" className="mt-3 flex gap-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm">From card<select value={fromCardId} onChange={(event) => setFromCardId(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2"><option value="">Choose card</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.display_name}</option>)}</select></label>
        <label className="text-sm">To card<select value={toCardId} onChange={(event) => setToCardId(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2"><option value="">Choose card</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.display_name}</option>)}</select></label>
        <label className="text-sm">Relationship<select value={relationship} onChange={(event) => setRelationship(event.target.value as typeof relationship)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2">{RELATIONSHIPS.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm">Similarity score<input type="number" min={1} max={100} value={similarityScore} onChange={(event) => setSimilarityScore(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label>
      </div>
      {['progression', 'regression'].includes(relationship) && (
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-gray-800">Changed dimensions</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIMENSIONS.map((dimension) => (
              <label key={dimension} className="flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs">
                <input type="checkbox" checked={dimensions.includes(dimension)} onChange={(event) => setDimensions((current) => event.target.checked ? [...current, dimension] : current.filter((value) => value !== dimension))} />
                {dimension.replaceAll('_', ' ')}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="mt-3 block text-sm">Reviewed rationale<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label>
      <button type="button" disabled={saving || !fromCardId || !toCardId || fromCardId === toCardId || !reason.trim()} onClick={() => void save()} className="mt-3 inline-flex items-center gap-2 rounded bg-indigo-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save for review</button>
    </section>
  )
}
