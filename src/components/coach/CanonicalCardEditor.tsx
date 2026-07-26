import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Save, ShieldCheck, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type { CanonicalCard, CanonicalCardStatus, CanonicalVariant } from './canonicalCardTypes'

const PHASES = [
  'prepare_and_access',
  'movement_intelligence',
  'output',
  'capacity',
  'resilience',
  'sustained_capacity',
  'restore',
] as const

const EDITABLE_DIFFICULTY_FIELDS = [
  'technicalComplexity',
  'absoluteLoadDemand',
  'supervisionDemand',
  'failureConsequence',
  'impact',
  'workCapacityDemand',
] as const

const DIFFICULTY_LABELS: Record<(typeof EDITABLE_DIFFICULTY_FIELDS)[number], string> = {
  technicalComplexity: 'Technical complexity',
  absoluteLoadDemand: 'Physical difficulty',
  supervisionDemand: 'Supervision demand',
  failureConsequence: 'Failure consequence',
  impact: 'Impact',
  workCapacityDemand: 'Work-capacity demand',
}

const LOAD_FIELDS = ['gripDemand', 'spinalLoading', 'eccentricStress'] as const
const FATIGUE_FIELDS = ['localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity', 'impactAccumulation'] as const
const PLANES = ['sagittal', 'frontal', 'transverse', 'multiplanar'] as const
const LATERALITY = ['bilateral', 'unilateral', 'alternating', 'asymmetrical'] as const
const LOAD_METHODS = ['bodyweight', 'fixed_external', 'relative_external', 'velocity_targeted', 'distance_targeted', 'coach_selected'] as const

function splitList(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
}

function withDerivedOverallDifficulty(difficulty: Record<string, number>): Record<string, number> {
  const technical = Number(difficulty.technicalComplexity)
  const physical = Number(difficulty.absoluteLoadDemand)
  if (
    !Number.isInteger(technical)
    || technical < 1
    || technical > 100
    || !Number.isInteger(physical)
    || physical < 1
    || physical > 100
  ) {
    const withoutOverall = { ...difficulty }
    delete withoutOverall.baseOverallDifficulty
    return withoutOverall
  }
  return {
    ...difficulty,
    baseOverallDifficulty: Math.max(technical, physical),
  }
}

function initialVariant(): CanonicalVariant {
  return {
    variantKey: 'baseline',
    displayName: '',
    modifierKeys: [],
    difficulty: {
      ...Object.fromEntries(EDITABLE_DIFFICULTY_FIELDS.map((field) => [field, 50])),
      baseOverallDifficulty: 50,
    },
    loadProfile: {
      gripDemand: 1,
      spinalLoading: 1,
      eccentricStress: 1,
      landingContactsPerRep: 0,
      externalLoadMethod: 'bodyweight',
    },
    fatigueProfile: {
      localMuscleFatigue: 1,
      gripFatigue: 1,
      technicalFatigueSensitivity: 1,
      impactAccumulation: 1,
      recoveryHours: 24,
    },
    requirements: {},
    programming: {},
    profiles: [{
      profileKey: 'capacity-strength',
      phaseKey: 'capacity',
      role: 'primary',
      purpose: '',
      phaseSuitability: 80,
      methodologyAlignment: 80,
      objectiveRelevance: { default: 80 },
      dosage: { sets: [2, 4], reps: [5, 10], restSeconds: [45, 90] },
      qualityGate: '',
      stopRules: ['Stop on pain.', 'Stop when movement quality changes.'],
      coachInstructions: '',
      athleteInstructions: '',
      expectedAdaptation: '',
      equipmentRequired: [],
      logistics: {},
      timeModel: {},
      doseScaling: {},
      measurement: {},
      supportPrompts: {},
    }],
  }
}

function initialCard(): CanonicalCard {
  return {
    slug: '',
    canonicalName: '',
    displayName: '',
    description: null,
    aliases: [],
    familyKey: '',
    status: 'draft',
    contentConfidence: 80,
    scoringConfidence: 80,
    mediaConfidence: 80,
    movementPatterns: [],
    bodyRegions: [],
    requiredEquipment: [],
    optionalEquipment: [],
    environment: {},
    population: {},
    athleteSupport: {},
    coachSupport: {},
    supportOperations: {},
    anatomy: {
      primaryMuscles: [],
      secondaryMuscles: [],
      stabilizers: [],
      joints: [],
      jointActions: [],
      planes: [],
      laterality: 'bilateral',
    },
    approvedVideoUrl: null,
    variants: [initialVariant()],
  }
}

interface CanonicalCardEditorProps {
  source: CanonicalCard | null
  onClose: () => void
  onSaved: (card: CanonicalCard) => void
}

export function CanonicalCardEditor({ source, onClose, onSaved }: CanonicalCardEditorProps) {
  const [card, setCard] = useState<CanonicalCard>(() => source ?? initialCard())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changeSummary, setChangeSummary] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [mediaScore, setMediaScore] = useState(90)
  const [duplicateCandidates, setDuplicateCandidates] = useState<Array<{
    id: string
    displayName: string
    familyKey: string
    score: number
    exactCollision: boolean
  }>>([])
  const updateJsonObject = (
    label: string,
    value: string,
    apply: (parsed: Record<string, unknown>) => void,
  ) => {
    try {
      const parsed: unknown = JSON.parse(value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('must be a JSON object')
      apply(parsed as Record<string, unknown>)
      setError(null)
    } catch (caught) {
      setError(`${label} ${caught instanceof Error ? caught.message : 'must be valid JSON'}.`)
    }
  }
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false)
  const variant = card.variants[0] ?? initialVariant()
  const profile = variant.profiles[0] ?? initialVariant().profiles[0]
  const editable = ['draft', 'review'].includes(card.status)

  const updateVariant = (updates: Partial<CanonicalVariant>) => {
    setCard((current) => ({
      ...current,
      variants: [{ ...variant, ...updates }, ...current.variants.slice(1)],
    }))
  }

  const updateProfile = (updates: Partial<typeof profile>) => {
    updateVariant({ profiles: [{ ...profile, ...updates }, ...variant.profiles.slice(1)] })
  }

  const updateDifficulty = (
    field: (typeof EDITABLE_DIFFICULTY_FIELDS)[number],
    value: number,
  ) => {
    updateVariant({
      difficulty: withDerivedOverallDifficulty({
        ...variant.difficulty,
        [field]: value,
      }),
    })
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const cardForSave = {
        ...card,
        variants: card.variants.map((item) => ({
          ...item,
          difficulty: withDerivedOverallDifficulty(item.difficulty),
        })),
      }
      const duplicates = await coachFetch<typeof duplicateCandidates>('/api/coach/canonical/cards/duplicate-check', {
        method: 'POST',
        body: JSON.stringify(cardForSave),
      })
      setDuplicateCandidates(duplicates)
      if (duplicates.length > 0 && !duplicateAcknowledged) {
        setError('Review the possible duplicate cards before saving this draft.')
        return
      }
      const payload = { ...cardForSave, expectedUpdatedAt: card.updatedAt, changeSummary }
      const saved = await coachFetch<CanonicalCard>(
        card.id ? `/api/coach/canonical/cards/${card.id}` : '/api/coach/canonical/cards',
        { method: card.id ? 'PUT' : 'POST', body: JSON.stringify(payload) },
      )
      setCard(saved)
      onSaved(saved)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save canonical card.')
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (status: CanonicalCardStatus) => {
    if (!card.id) return
    setSaving(true)
    setError(null)
    try {
      const saved = await coachFetch<CanonicalCard>(`/api/coach/canonical/cards/${card.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, expectedUpdatedAt: card.updatedAt, changeSummary }),
      })
      setCard(saved)
      onSaved(saved)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not change card status.')
    } finally {
      setSaving(false)
    }
  }

  const review = async (decision: 'approve' | 'request_changes') => {
    if (!card.id || !reviewNotes.trim()) return
    setSaving(true)
    setError(null)
    try {
      await coachFetch(`/api/coach/canonical/cards/${card.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes: reviewNotes, rubric: { publicationReadiness: 100 } }),
      })
      const refreshed = await coachFetch<CanonicalCard>(`/api/coach/canonical/cards/${card.id}`)
      setCard(refreshed)
      onSaved(refreshed)
      setReviewNotes('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not record review.')
    } finally {
      setSaving(false)
    }
  }

  const reviewMedia = async () => {
    if (!card.id || !card.approvedVideoUrl) return
    setSaving(true)
    setError(null)
    try {
      await coachFetch(`/api/coach/canonical/cards/${card.id}/media-review`, {
        method: 'POST',
        body: JSON.stringify({
          url: card.approvedVideoUrl,
          exactVariantMatch: true,
          demonstrationQualityScore: mediaScore,
          linkStatus: 'healthy',
          notes: 'Reviewed in canonical card authoring.',
        }),
      })
      const refreshed = await coachFetch<CanonicalCard>(`/api/coach/canonical/cards/${card.id}`)
      setCard(refreshed)
      onSaved(refreshed)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not record media review.')
    } finally {
      setSaving(false)
    }
  }

  const reviewRelationship = async (relationshipId: string, decision: 'approved' | 'rejected') => {
    if (!card.id) return
    setSaving(true)
    setError(null)
    try {
      await coachFetch(`/api/coach/canonical/relationships/${relationshipId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      })
      const refreshed = await coachFetch<CanonicalCard>(`/api/coach/canonical/cards/${card.id}`)
      setCard(refreshed)
      onSaved(refreshed)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not review relationship.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="canonical-card-title">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="canonical-card-title" className="text-lg font-bold text-gray-950">
              {card.id ? card.displayName || 'Canonical card' : 'New canonical card'}
            </h2>
            <p className="text-xs text-gray-500">Lifecycle: {card.status} · changes are revisioned and publication requires another reviewer.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close canonical card editor" className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}

          <section aria-labelledby="identity-heading">
            <h3 id="identity-heading" className="font-semibold text-gray-900">Identity and governance</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">Canonical name<input disabled={!editable} value={card.canonicalName} onChange={(event) => setCard({ ...card, canonicalName: event.target.value, displayName: card.displayName || event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Display name<input disabled={!editable} value={card.displayName} onChange={(event) => setCard({ ...card, displayName: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Slug<input disabled={!editable} value={card.slug} onChange={(event) => setCard({ ...card, slug: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs disabled:bg-gray-100" /></label>
              <label className="text-sm">Family key<input disabled={!editable} value={card.familyKey} onChange={(event) => setCard({ ...card, familyKey: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Movement patterns<input disabled={!editable} value={card.movementPatterns.join(', ')} onChange={(event) => setCard({ ...card, movementPatterns: splitList(event.target.value) })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Body regions<input disabled={!editable} value={card.bodyRegions.join(', ')} onChange={(event) => setCard({ ...card, bodyRegions: splitList(event.target.value) })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Required equipment<input disabled={!editable} value={card.requiredEquipment.join(', ')} onChange={(event) => setCard({ ...card, requiredEquipment: splitList(event.target.value) })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Approved video URL<input disabled={!editable} type="url" value={card.approvedVideoUrl ?? ''} onChange={(event) => setCard({ ...card, approvedVideoUrl: event.target.value || null })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
            </div>
            <label className="mt-3 block text-sm">Description<textarea disabled={!editable} rows={3} value={card.description ?? ''} onChange={(event) => setCard({ ...card, description: event.target.value || null })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(['contentConfidence', 'scoringConfidence', 'mediaConfidence'] as const).map((key) => (
                <label key={key} className="text-sm">{key.replace('Confidence', ' confidence')}
                  <input disabled={!editable} type="number" min={1} max={100} value={card[key] ?? ''} onChange={(event) => setCard({ ...card, [key]: Number(event.target.value) })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
                </label>
              ))}
            </div>
            {duplicateCandidates.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-950">Possible duplicate identities</p>
                <ul className="mt-2 space-y-1 text-xs text-amber-900">
                  {duplicateCandidates.map((candidate) => (
                    <li key={candidate.id}>{candidate.displayName} · {candidate.familyKey} · {candidate.score}/100 similarity</li>
                  ))}
                </ul>
                <label className="mt-2 flex items-start gap-2 text-xs text-amber-950">
                  <input type="checkbox" checked={duplicateAcknowledged} onChange={(event) => setDuplicateAcknowledged(event.target.checked)} />
                  I reviewed these cards. This draft represents a distinct canonical movement rather than a variant or alias.
                </label>
              </div>
            )}
          </section>

          <section aria-labelledby="anatomy-heading">
            <h3 id="anatomy-heading" className="font-semibold text-gray-900">Anatomy and movement loading</h3>
            <p className="mt-1 text-xs text-gray-500">Structured fields support coverage scoring, fatigue controls, and safer substitutions.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {([
                ['primaryMuscles', 'Primary muscles'],
                ['secondaryMuscles', 'Secondary muscles'],
                ['stabilizers', 'Stabilizers'],
                ['joints', 'Joints'],
                ['jointActions', 'Joint actions'],
              ] as const).map(([key, label]) => (
                <label key={key} className="text-sm">{label}
                  <input disabled={!editable} value={card.anatomy[key].join(', ')} onChange={(event) => setCard({ ...card, anatomy: { ...card.anatomy, [key]: splitList(event.target.value) } })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
                </label>
              ))}
              <label className="text-sm">Laterality
                <select disabled={!editable} value={card.anatomy.laterality} onChange={(event) => setCard({ ...card, anatomy: { ...card.anatomy, laterality: event.target.value } })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100">
                  {LATERALITY.map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
            </div>
            <fieldset className="mt-3">
              <legend className="text-sm">Movement planes</legend>
              <div className="mt-1 flex flex-wrap gap-3">
                {PLANES.map((plane) => (
                  <label key={plane} className="flex items-center gap-1.5 text-xs">
                    <input disabled={!editable} type="checkbox" checked={card.anatomy.planes.includes(plane)} onChange={(event) => setCard({
                      ...card,
                      anatomy: {
                        ...card.anatomy,
                        planes: event.target.checked
                          ? [...new Set([...card.anatomy.planes, plane])]
                          : card.anatomy.planes.filter((value) => value !== plane),
                      },
                    })} />
                    {plane.replaceAll('_', ' ')}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section aria-labelledby="support-heading">
            <h3 id="support-heading" className="font-semibold text-gray-900">Generation, coach, member, and support operations</h3>
            <p className="mt-1 text-xs text-gray-500">Structured JSON is publication-gated. Invalid JSON is rejected before it changes the draft.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {([
                ['Athlete/member support', card.athleteSupport, (value: Record<string, unknown>) => setCard({ ...card, athleteSupport: value })],
                ['Coach support', card.coachSupport, (value: Record<string, unknown>) => setCard({ ...card, coachSupport: value })],
                ['Support operations', card.supportOperations, (value: Record<string, unknown>) => setCard({ ...card, supportOperations: value })],
                ['Variant programming profile', variant.programming, (value: Record<string, unknown>) => updateVariant({ programming: value })],
                ['Time model', profile.timeModel, (value: Record<string, unknown>) => updateProfile({ timeModel: value })],
                ['Dose scaling', profile.doseScaling, (value: Record<string, unknown>) => updateProfile({ doseScaling: value })],
                ['Measurement', profile.measurement, (value: Record<string, unknown>) => updateProfile({ measurement: value })],
                ['Support prompts', profile.supportPrompts, (value: Record<string, unknown>) => updateProfile({ supportPrompts: value })],
              ] as const).map(([label, value, apply]) => (
                <label key={label} className="text-sm">{label}
                  <textarea
                    disabled={!editable}
                    rows={7}
                    defaultValue={JSON.stringify(value, null, 2)}
                    onBlur={(event) => updateJsonObject(label, event.target.value, apply)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs disabled:bg-gray-100"
                  />
                </label>
              ))}
            </div>
          </section>

          <section aria-labelledby="variant-heading">
            <h3 id="variant-heading" className="font-semibold text-gray-900">Baseline variant and delivery profile</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">Variant key<input disabled={!editable} value={variant.variantKey} onChange={(event) => updateVariant({ variantKey: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Variant name<input disabled={!editable} value={variant.displayName} onChange={(event) => updateVariant({ displayName: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Profile key<input disabled={!editable} value={profile.profileKey} onChange={(event) => updateProfile({ profileKey: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Canonical phase<select disabled={!editable} value={profile.phaseKey} onChange={(event) => updateProfile({ phaseKey: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100">{PHASES.map((phase) => <option key={phase}>{phase}</option>)}</select></label>
              <label className="text-sm md:col-span-2">Equipment for this exact version
                <input
                  disabled={!editable}
                  value={profile.equipmentRequired.join(', ')}
                  onChange={(event) => updateProfile({ equipmentRequired: splitList(event.target.value) })}
                  placeholder="Taxonomy keys, or none for bodyweight"
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100"
                />
                <span className="mt-1 block text-xs text-gray-500">This overrides the card-level equipment for this variant and delivery profile.</span>
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {EDITABLE_DIFFICULTY_FIELDS.map((field) => (
                <label key={field} className="text-xs">{DIFFICULTY_LABELS[field]}
                  <input disabled={!editable} type="number" min={1} max={100} value={variant.difficulty[field] ?? ''} onChange={(event) => updateDifficulty(field, Number(event.target.value))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100" />
                </label>
              ))}
              <label className="text-xs">Overall difficulty (derived)
                <input
                  readOnly
                  aria-describedby="overall-difficulty-help"
                  type="number"
                  value={withDerivedOverallDifficulty(variant.difficulty).baseOverallDifficulty ?? ''}
                  className="mt-1 w-full rounded border border-gray-300 bg-gray-100 px-2 py-1.5"
                />
                <span id="overall-difficulty-help" className="mt-1 block text-[11px] text-gray-500">
                  Greater of technical complexity and physical difficulty.
                </span>
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {LOAD_FIELDS.map((field) => (
                <label key={field} className="text-xs">{field}
                  <input disabled={!editable} type="number" min={1} max={100} value={variant.loadProfile[field]} onChange={(event) => updateVariant({ loadProfile: { ...variant.loadProfile, [field]: Number(event.target.value) } })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100" />
                </label>
              ))}
              <label className="text-xs">landingContactsPerRep
                <input disabled={!editable} type="number" min={0} max={20} value={variant.loadProfile.landingContactsPerRep} onChange={(event) => updateVariant({ loadProfile: { ...variant.loadProfile, landingContactsPerRep: Number(event.target.value) } })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100" />
              </label>
              <label className="text-xs">externalLoadMethod
                <select disabled={!editable} value={variant.loadProfile.externalLoadMethod} onChange={(event) => updateVariant({ loadProfile: { ...variant.loadProfile, externalLoadMethod: event.target.value } })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100">
                  {LOAD_METHODS.map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              {FATIGUE_FIELDS.map((field) => (
                <label key={field} className="text-xs">{field}
                  <input disabled={!editable} type="number" min={1} max={100} value={variant.fatigueProfile[field]} onChange={(event) => updateVariant({ fatigueProfile: { ...variant.fatigueProfile, [field]: Number(event.target.value) } })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100" />
                </label>
              ))}
              <label className="text-xs">recoveryHours
                <input disabled={!editable} type="number" min={0} max={168} value={variant.fatigueProfile.recoveryHours} onChange={(event) => updateVariant({ fatigueProfile: { ...variant.fatigueProfile, recoveryHours: Number(event.target.value) } })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100" />
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">Purpose<textarea disabled={!editable} rows={2} value={profile.purpose} onChange={(event) => updateProfile({ purpose: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Expected adaptation<textarea disabled={!editable} rows={2} value={profile.expectedAdaptation} onChange={(event) => updateProfile({ expectedAdaptation: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Quality gate<textarea disabled={!editable} rows={2} value={profile.qualityGate} onChange={(event) => updateProfile({ qualityGate: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Stop rules<textarea disabled={!editable} rows={2} value={profile.stopRules.join('\n')} onChange={(event) => updateProfile({ stopRules: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Coach instructions<textarea disabled={!editable} rows={3} value={profile.coachInstructions} onChange={(event) => updateProfile({ coachInstructions: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
              <label className="text-sm">Athlete instructions<textarea disabled={!editable} rows={3} value={profile.athleteInstructions} onChange={(event) => updateProfile({ athleteInstructions: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
            </div>
          </section>

          {card.id && (
            <section aria-labelledby="governance-heading" className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <h3 id="governance-heading" className="flex items-center gap-2 font-semibold text-indigo-950"><ShieldCheck className="h-4 w-4" />Review and publication</h3>
              {card.readiness?.ready ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />All automated publication gates pass.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
                  {card.readiness?.issues.map((issue) => <li key={`${issue.path}-${issue.code}`}>{issue.message}</li>)}
                </ul>
              )}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-sm">Revision summary<input value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} className="mt-1 w-full rounded border border-indigo-200 px-3 py-2" /></label>
                <label className="text-sm">Media quality (1–100)<input type="number" min={1} max={100} value={mediaScore} onChange={(event) => setMediaScore(Number(event.target.value))} className="mt-1 w-full rounded border border-indigo-200 px-3 py-2" /></label>
              </div>
              <button type="button" disabled={saving || !card.approvedVideoUrl} onClick={() => void reviewMedia()} className="mt-2 rounded border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-900 disabled:opacity-50">Record exact-match media review</button>
              {card.status === 'review' && (
                <div className="mt-4">
                  <label className="text-sm">Reviewer notes<textarea rows={2} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} className="mt-1 w-full rounded border border-indigo-200 px-3 py-2" /></label>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={saving || !reviewNotes.trim()} onClick={() => void review('approve')} className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve</button>
                    <button type="button" disabled={saving || !reviewNotes.trim()} onClick={() => void review('request_changes')} className="rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Request changes</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {card.id && card.testPacket && (
            <section aria-labelledby="test-packet-heading" className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="test-packet-heading" className="font-semibold text-gray-900">Automated card test packet</h3>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${card.testPacket.status === 'passed' ? 'bg-emerald-100 text-emerald-800' : card.testPacket.status === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{card.testPacket.summary.passed}/{card.testPacket.summary.total} passed</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {card.testPacket.checks.map((check) => (
                  <div key={check.id} className={`rounded border p-2 text-xs ${check.status === 'passed' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
                    <p className="font-semibold">{check.id} · {check.priority}</p>
                    <p className="mt-1">{check.message}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {card.id && (
            <section aria-labelledby="card-relationships-heading">
              <h3 id="card-relationships-heading" className="font-semibold text-gray-900">Progressions and substitutions</h3>
              <div className="mt-3 space-y-2">
                {(card.relationships?.length ?? 0) === 0 && <p className="text-sm text-gray-500">No graph relationships touch this card yet.</p>}
                {card.relationships?.map((edge) => (
                  <article key={edge.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{edge.from_name} → {edge.to_name}</p>
                        <p className="text-xs text-gray-600">{edge.relationship.replaceAll('_', ' ')} · similarity {edge.similarity_score}/100</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${edge.review_status === 'approved' ? 'bg-emerald-100 text-emerald-800' : edge.review_status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{edge.review_status}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">{edge.reason}</p>
                    {edge.dimensions.length > 0 && <p className="mt-1 text-xs text-gray-500">Changes: {edge.dimensions.join(', ')}</p>}
                    {edge.review_status === 'review' && (
                      <div className="mt-3 flex gap-2">
                        <button type="button" disabled={saving} onClick={() => void reviewRelationship(edge.id, 'approved')} className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Approve edge</button>
                        <button type="button" disabled={saving} onClick={() => void reviewRelationship(edge.id, 'rejected')} className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Reject edge</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex gap-2">
            {card.status === 'draft' && card.id && <button type="button" disabled={saving} onClick={() => void changeStatus('review')} className="rounded border border-indigo-300 bg-white px-3 py-2 text-sm font-semibold text-indigo-900">Submit for review</button>}
            {card.status === 'review' && card.id && <button type="button" disabled={saving || !card.readiness?.ready || card.testPacket?.status === 'failed'} onClick={() => void changeStatus('published')} className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Publish</button>}
            {card.status === 'published' && card.id && <button type="button" disabled={saving} onClick={() => void changeStatus('deprecated')} className="rounded border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900">Deprecate</button>}
          </div>
          {editable && <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded bg-vortex-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save revision</button>}
        </footer>
      </div>
    </div>
  )
}
