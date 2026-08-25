import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Save, ShieldCheck, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type { TaxonomyV2Catalog } from '../../coach/taxonomy'
import { useTaxonomy } from './useTaxonomy'
import type {
  CanonicalCard,
  CanonicalCardStatus,
  CanonicalTaxonomyV2Block,
  CanonicalVariant,
} from './canonicalCardTypes'

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
] as const

const DIFFICULTY_LABELS: Record<(typeof EDITABLE_DIFFICULTY_FIELDS)[number], string> = {
  technicalComplexity: 'Technical complexity',
  absoluteLoadDemand: 'Physical difficulty',
}

const LOAD_FIELDS = ['gripDemand', 'spinalLoading', 'eccentricStress'] as const
const FATIGUE_FIELDS = ['localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity', 'impactAccumulation'] as const
const PLANES = ['sagittal', 'frontal', 'transverse', 'multiplanar'] as const
const LATERALITY = ['bilateral', 'unilateral', 'alternating', 'asymmetrical'] as const
const LOAD_METHODS = ['bodyweight', 'fixed_external', 'relative_external', 'velocity_targeted', 'distance_targeted', 'coach_selected'] as const
const TASK_DEMAND_FIELDS = [
  'strengthDemand', 'powerDemand', 'mobilityDemand', 'balanceDemand',
  'coordinationDemand', 'conditioningDemand', 'impactToleranceDemand',
  'eccentricControlDemand', 'bodyControlDemand', 'perceptualDemand',
  'attentionDemand', 'supervisionDemand', 'failureConsequence',
] as const
const SCALING_DIMENSIONS = [
  'external_load', 'range_of_motion', 'movement_velocity', 'height', 'impact',
  'stability', 'base_of_support', 'complexity', 'coordination', 'reactive_uncertainty',
  'assistance', 'resistance', 'volume', 'work_duration', 'rest_duration', 'distance',
  'contacts', 'partner_pressure', 'laterality',
] as const
const SCALING_BOUNDARIES = [
  'prescription', 'delivery_profile', 'exact_variant', 'exercise_definition',
] as const
const GEOMETRY_OPTIONS = {
  planes: ['sagittal', 'frontal', 'transverse', 'multiplanar'],
  projections: ['vertical', 'horizontal', 'diagonal', 'rotational'],
  directions: ['forward', 'backward', 'lateral', 'multidirectional'],
  supports: ['bilateral', 'unilateral', 'alternating'],
  stances: ['square', 'split', 'staggered', 'tandem'],
  limbRelationships: ['symmetrical', 'asymmetrical', 'ipsilateral', 'contralateral'],
} as const

const TAXONOMY_FACETS_BY_SCOPE = {
  definition: ['training_family', 'movement_character'],
  variant: ['movement_character', 'force_velocity'],
  delivery_profile: [
    'tenet',
    'methodology',
    'athletic_niche',
    'programming_set_structure',
    'programming_clock_structure',
    'conditioning_protocol',
    'physiology_mechanism',
  ],
} as const

const TAXONOMY_FACET_LABELS: Record<string, string> = {
  tenet: 'Athleticism tenet',
  methodology: 'Methodology',
  training_family: 'Training family',
  athletic_niche: 'Athletic niche',
  force_velocity: 'Force–velocity emphasis',
  movement_character: 'Movement character',
  programming_set_structure: 'Set structure',
  programming_clock_structure: 'Clock structure',
  conditioning_protocol: 'Conditioning protocol',
  physiology_mechanism: 'Physiology mechanism',
}

function TaxonomyV2ScopeEditor({
  title,
  scope,
  block,
  catalog,
  disabled,
  onChange,
}: {
  title: string
  scope: keyof typeof TAXONOMY_FACETS_BY_SCOPE
  block: CanonicalTaxonomyV2Block | null | undefined
  catalog: TaxonomyV2Catalog | undefined
  disabled: boolean
  onChange: (next: CanonicalTaxonomyV2Block) => void
}) {
  const value = block ?? { assignments: [], decisions: [] }
  const updateDecision = (facetType: string, decision: 'classified' | 'not_applicable' | null) => {
    const withoutFacet = value.decisions.filter((entry) => entry.facetType !== facetType)
    onChange({
      ...value,
      assignments: decision === 'not_applicable'
        ? value.assignments.filter((entry) => entry.facetType !== facetType)
        : value.assignments,
      decisions: decision == null ? withoutFacet : [...withoutFacet, {
        facetType,
        scope,
        decision,
        rationale: decision === 'not_applicable' ? '' : null,
        confidence: 50,
        reviewStatus: 'suggested',
      }],
    })
  }
  return (
    <fieldset className="rounded-lg border border-gray-200 p-3">
      <legend className="px-1 text-sm font-semibold text-gray-900">{title}</legend>
      <div className="space-y-3">
        {TAXONOMY_FACETS_BY_SCOPE[scope].map((facetType) => {
          const assignments = value.assignments.filter((entry) => entry.facetType === facetType)
          const decision = value.decisions.find((entry) => entry.facetType === facetType)
          const terms = catalog?.facets[facetType] ?? []
          return (
            <div key={facetType} className="rounded border border-gray-100 bg-gray-50 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-800">{TAXONOMY_FACET_LABELS[facetType] ?? facetType}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${assignments.length || decision?.decision === 'not_applicable' ? decision?.reviewStatus === 'approved' || assignments.some((entry) => entry.reviewStatus === 'approved') ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                  {assignments.length || decision?.decision === 'not_applicable'
                    ? decision?.reviewStatus === 'approved' || assignments.some((entry) => entry.reviewStatus === 'approved') ? 'reviewed' : 'review required'
                    : 'missing'}
                </span>
              </div>
              {!disabled && decision?.decision !== 'not_applicable' && (
                <select
                  value=""
                  onChange={(event) => {
                    const term = terms.find((entry) => entry.key === event.target.value)
                    if (!term || assignments.some((entry) => entry.key === term.key)) return
                    onChange({
                      assignments: [...value.assignments, {
                        facetType,
                        key: term.key,
                        name: term.name,
                        scope,
                        role: assignments.length === 0 ? 'primary' : 'secondary',
                        weight: assignments.length === 0 ? 5 : 3,
                        confidence: 50,
                        reviewStatus: 'suggested',
                      }],
                      decisions: [
                        ...value.decisions.filter((entry) => entry.facetType !== facetType),
                        { facetType, scope, decision: 'classified', confidence: 50, reviewStatus: 'suggested' },
                      ],
                    })
                  }}
                  className="mt-2 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="">Add controlled term…</option>
                  {terms.filter((term) => !assignments.some((entry) => entry.key === term.key)).map((term) => (
                    <option key={term.id} value={term.key}>{term.name}{term.domain ? ` · ${term.domain.replaceAll('_', ' ')}` : ''}</option>
                  ))}
                </select>
              )}
              <div className="mt-2 space-y-1">
                {assignments.map((assignment) => (
                  <div key={`${facetType}:${assignment.key}`} className="flex flex-wrap items-center gap-2 rounded bg-white px-2 py-1 text-xs">
                    <span className="min-w-32 flex-1 font-medium">{assignment.name ?? terms.find((term) => term.key === assignment.key)?.name ?? assignment.key}</span>
                    <select disabled={disabled} value={assignment.role} onChange={(event) => onChange({
                      ...value,
                      assignments: value.assignments.map((entry) => entry === assignment ? { ...entry, role: event.target.value as typeof entry.role, reviewStatus: 'suggested' } : entry),
                    })} className="rounded border border-gray-300 px-1 py-0.5">
                      {['primary', 'secondary', 'compatible', 'incompatible', 'default'].map((role) => <option key={role}>{role}</option>)}
                    </select>
                    <label>weight <input disabled={disabled} type="number" min={1} max={5} value={assignment.weight} onChange={(event) => onChange({
                      ...value,
                      assignments: value.assignments.map((entry) => entry === assignment ? { ...entry, weight: Number(event.target.value), reviewStatus: 'suggested' } : entry),
                    })} className="w-12 rounded border border-gray-300 px-1 py-0.5" /></label>
                    {!disabled && <button type="button" onClick={() => {
                      const remaining = value.assignments.filter((entry) => entry !== assignment)
                      onChange({
                        assignments: remaining,
                        decisions: remaining.some((entry) => entry.facetType === facetType)
                          ? value.decisions
                          : value.decisions.filter((entry) => entry.facetType !== facetType),
                      })
                    }} className="text-red-700">Remove</button>}
                  </div>
                ))}
              </div>
              {!disabled && assignments.length === 0 && (
                <button type="button" onClick={() => updateDecision(facetType, decision?.decision === 'not_applicable' ? null : 'not_applicable')} className="mt-2 text-xs font-medium text-indigo-700">
                  {decision?.decision === 'not_applicable' ? 'Clear not-applicable decision' : 'Mark not applicable'}
                </button>
              )}
              {decision?.decision === 'not_applicable' && (
                <label className="mt-2 block text-xs">Required rationale
                  <input disabled={disabled} value={decision.rationale ?? ''} onChange={(event) => onChange({
                    ...value,
                    decisions: value.decisions.map((entry) => entry === decision ? { ...entry, rationale: event.target.value, reviewStatus: 'suggested' } : entry),
                  })} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5" />
                </label>
              )}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

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
    movementGeometry: {
      planes: [], projections: [], directions: [], supports: [],
      stances: [], limbRelationships: [],
    },
    anatomyProfile: { assignments: [] },
    equipmentRoles: [],
    taskDemands: Object.fromEntries(TASK_DEMAND_FIELDS.map((field) => [field, null])),
    stressProfile: {
      jointStress: null, tissueStress: null, neuralDemand: null, impactStress: null,
      localMuscularFatigue: null, systemicFatigue: null, gripFatigue: null,
      conditioningFatigue: null, recoveryCost: null,
      bodyRegionStress: [], jointStressTargets: [], tissueStressTargets: [],
    },
    scalingHandles: [],
    compositionProfile: {},
    structuredProfileReview: {
      reviewStatus: 'suggested',
      provenance: { sourceType: 'canonical_authoring', humanReviewRequired: true, approvalCreated: false },
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
    taxonomyV2: { assignments: [], decisions: [] },
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
      taxonomyV2: { assignments: [], decisions: [] },
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
    taxonomyV2: { assignments: [], decisions: [] },
    variants: [initialVariant()],
  }
}

interface CanonicalCardEditorProps {
  source: CanonicalCard | null
  initialVariantId?: string | null
  onClose: () => void
  onSaved: (card: CanonicalCard) => void
}

export function CanonicalCardEditor({ source, initialVariantId = null, onClose, onSaved }: CanonicalCardEditorProps) {
  const { taxonomy } = useTaxonomy()
  const [card, setCard] = useState<CanonicalCard>(() => source ?? initialCard())
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(() => (
    source?.variants.find((item) => item.id === initialVariantId)?.id
      ?? source?.variants[0]?.id
      ?? null
  ))
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => (
    source?.variants.find((item) => item.id === initialVariantId)?.profiles[0]?.id
      ?? source?.variants[0]?.profiles[0]?.id
      ?? null
  ))
  useEffect(() => {
    const next = source ?? initialCard()
    const selected = next.variants.find((item) => item.id === initialVariantId) ?? next.variants[0]
    setCard(next)
    setSelectedVariantId(selected?.id ?? null)
    setSelectedProfileId(selected?.profiles[0]?.id ?? null)
  }, [initialVariantId, source])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changeSummary, setChangeSummary] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [relationshipReviewNotes, setRelationshipReviewNotes] = useState<Record<string, string>>({})
  const [mediaScore, setMediaScore] = useState<number | ''>('')
  const [mediaLinkStatus, setMediaLinkStatus] = useState<'healthy' | 'broken' | 'mismatched' | ''>('')
  const [mediaExactVariantMatch, setMediaExactVariantMatch] = useState<boolean | null>(null)
  const [mediaReviewNotes, setMediaReviewNotes] = useState('')
  const [mediaReviewBasis, setMediaReviewBasis] = useState({
    playbackReviewed: false,
    exactVariantCompared: false,
    linkChecked: false,
    accessibilityChecked: false,
  })
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
  const updateJsonArray = (
    label: string,
    value: string,
    apply: (parsed: unknown[]) => void,
  ) => {
    try {
      const parsed: unknown = JSON.parse(value)
      if (!Array.isArray(parsed)) throw new Error('must be a JSON array')
      apply(parsed)
      setError(null)
    } catch (caught) {
      setError(`${label} ${caught instanceof Error ? caught.message : 'must be valid JSON'}.`)
    }
  }
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false)
  const variant = card.variants.find((item) => item.id === selectedVariantId) ?? card.variants[0] ?? initialVariant()
  const profile = variant.profiles.find((item) => item.id === selectedProfileId) ?? variant.profiles[0] ?? initialVariant().profiles[0]
  const editable = ['draft', 'review'].includes(card.status)

  const updateVariant = (updates: Partial<CanonicalVariant>) => {
    setCard((current) => ({
      ...current,
      variants: current.variants.map((item) => (
        item === variant || (variant.id != null && item.id === variant.id)
          ? { ...item, ...updates }
          : item
      )),
    }))
  }

  const updateProfile = (updates: Partial<typeof profile>) => {
    updateVariant({
      profiles: variant.profiles.map((item) => (
        item === profile || (profile.id != null && item.id === profile.id)
          ? { ...item, ...updates }
          : item
      )),
    })
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
    if (!card.id || reviewNotes.trim().length < 20) return
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
    if (!card.id || !card.approvedVideoUrl || typeof mediaScore !== 'number'
      || !mediaLinkStatus || mediaExactVariantMatch == null || mediaReviewNotes.trim().length < 20
      || !Object.values(mediaReviewBasis).every(Boolean)) return
    setSaving(true)
    setError(null)
    try {
      await coachFetch(`/api/coach/canonical/cards/${card.id}/media-review`, {
        method: 'POST',
        body: JSON.stringify({
          url: card.approvedVideoUrl,
          exactVariantMatch: mediaExactVariantMatch,
          demonstrationQualityScore: mediaScore,
          linkStatus: mediaLinkStatus,
          notes: mediaReviewNotes.trim(),
          reviewBasis: { reviewMethod: 'manual_playback', ...mediaReviewBasis },
        }),
      })
      const refreshed = await coachFetch<CanonicalCard>(`/api/coach/canonical/cards/${card.id}`)
      setCard(refreshed)
      onSaved(refreshed)
      setMediaReviewNotes('')
      setMediaExactVariantMatch(null)
      setMediaLinkStatus('')
      setMediaScore('')
      setMediaReviewBasis({
        playbackReviewed: false,
        exactVariantCompared: false,
        linkChecked: false,
        accessibilityChecked: false,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not record media review.')
    } finally {
      setSaving(false)
    }
  }

  const reviewRelationship = async (relationshipId: string, decision: 'approved' | 'rejected') => {
    const notes = String(relationshipReviewNotes[relationshipId] ?? '').trim()
    if (!card.id || notes.length < 20) return
    setSaving(true)
    setError(null)
    try {
      await coachFetch(`/api/coach/canonical/relationships/${relationshipId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes }),
      })
      const refreshed = await coachFetch<CanonicalCard>(`/api/coach/canonical/cards/${card.id}`)
      setCard(refreshed)
      onSaved(refreshed)
      setRelationshipReviewNotes((current) => ({ ...current, [relationshipId]: '' }))
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

          <section aria-labelledby="variant-context-heading" className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <h3 id="variant-context-heading" className="text-sm font-semibold text-indigo-950">Exact-variant editing context</h3>
            <p className="mt-1 text-xs text-indigo-800">All exact variants and their delivery profiles are independently selectable. Review-queue links open the specific variant, not an arbitrary baseline.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-indigo-950">Exact variant
                <select
                  value={variant.id ?? ''}
                  onChange={(event) => {
                    const next = card.variants.find((item) => item.id === event.target.value)
                    if (!next) return
                    setSelectedVariantId(next.id ?? null)
                    setSelectedProfileId(next.profiles[0]?.id ?? null)
                  }}
                  className="mt-1 w-full rounded border border-indigo-200 bg-white px-3 py-2"
                >
                  {card.variants.map((item) => <option key={item.id ?? item.variantKey} value={item.id ?? ''}>{item.displayName} · {item.variantKey}</option>)}
                </select>
              </label>
              <label className="text-sm text-indigo-950">Delivery profile
                <select
                  value={profile.id ?? ''}
                  onChange={(event) => setSelectedProfileId(event.target.value || null)}
                  className="mt-1 w-full rounded border border-indigo-200 bg-white px-3 py-2"
                >
                  {variant.profiles.map((item) => <option key={item.id ?? item.profileKey} value={item.id ?? ''}>{item.profileKey} · {item.phaseKey}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section aria-labelledby="taxonomy-v2-heading">
            <h3 id="taxonomy-v2-heading" className="font-semibold text-gray-900">Taxonomy v2 classification</h3>
            <p className="mt-1 text-xs text-gray-500">Assignments are scoped to where they are true. Saving creates review-required suggestions; it never creates an approval.</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <TaxonomyV2ScopeEditor title="Exercise concept" scope="definition" block={card.taxonomyV2} catalog={taxonomy?.taxonomyV2} disabled={!editable} onChange={(taxonomyV2) => setCard({ ...card, taxonomyV2 })} />
              <TaxonomyV2ScopeEditor title="Exact variant" scope="variant" block={variant.taxonomyV2} catalog={taxonomy?.taxonomyV2} disabled={!editable} onChange={(taxonomyV2) => updateVariant({ taxonomyV2 })} />
              <TaxonomyV2ScopeEditor title="Delivery profile" scope="delivery_profile" block={profile.taxonomyV2} catalog={taxonomy?.taxonomyV2} disabled={!editable} onChange={(taxonomyV2) => updateProfile({ taxonomyV2 })} />
            </div>
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

          <section aria-labelledby="structured-profile-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 id="structured-profile-heading" className="font-semibold text-gray-900">Exact-variant movement, fit, stress, and composition</h3>
                <p className="mt-1 text-xs text-gray-500">These fields are separate from difficulty. Saving a revision resets them to human review-required evidence.</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${variant.structuredProfileReview.reviewStatus === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {variant.structuredProfileReview.reviewStatus === 'approved' ? 'independently reviewed' : 'review required'}
              </span>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {Object.entries(GEOMETRY_OPTIONS).map(([field, options]) => {
                const geometryField = field as keyof CanonicalVariant['movementGeometry']
                return (
                  <fieldset key={field} className="rounded border border-gray-200 p-2">
                    <legend className="px-1 text-xs font-semibold text-gray-700">{field.replace(/([A-Z])/g, ' $1').toLowerCase()}</legend>
                    <div className="flex flex-wrap gap-2">
                      {options.map((option) => (
                        <label key={option} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            disabled={!editable}
                            checked={variant.movementGeometry[geometryField].includes(option)}
                            onChange={(event) => updateVariant({
                              movementGeometry: {
                                ...variant.movementGeometry,
                                [geometryField]: event.target.checked
                                  ? [...new Set([...variant.movementGeometry[geometryField], option])]
                                  : variant.movementGeometry[geometryField].filter((value) => value !== option),
                              },
                            })}
                          />
                          {option.replaceAll('_', ' ')}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )
              })}
            </div>

            <fieldset className="mt-3 rounded border border-gray-200 p-3">
              <legend className="px-1 text-sm font-semibold text-gray-800">Athlete task demands (1–100; null only when genuinely irrelevant)</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {TASK_DEMAND_FIELDS.map((field) => (
                  <label key={field} className="text-xs">{field.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    <input
                      disabled={!editable}
                      type="number"
                      min={1}
                      max={100}
                      value={variant.taskDemands[field] ?? ''}
                      onChange={(event) => updateVariant({
                        taskDemands: {
                          ...variant.taskDemands,
                          [field]: event.target.value === '' ? null : Number(event.target.value),
                        },
                      })}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100"
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">Anatomy assignments with role
                <textarea disabled={!editable} rows={8} defaultValue={JSON.stringify(variant.anatomyProfile.assignments, null, 2)} onBlur={(event) => updateJsonArray('Anatomy assignments', event.target.value, (assignments) => updateVariant({ anatomyProfile: { assignments: assignments as CanonicalVariant['anatomyProfile']['assignments'] } }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs disabled:bg-gray-100" />
              </label>
              <label className="text-sm">Equipment assignments with role
                <textarea disabled={!editable} rows={8} defaultValue={JSON.stringify(variant.equipmentRoles, null, 2)} onBlur={(event) => updateJsonArray('Equipment assignments', event.target.value, (equipmentRoles) => updateVariant({ equipmentRoles: equipmentRoles as CanonicalVariant['equipmentRoles'] }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs disabled:bg-gray-100" />
              </label>
              <label className="text-sm">Stress vector
                <textarea disabled={!editable} rows={9} defaultValue={JSON.stringify(variant.stressProfile, null, 2)} onBlur={(event) => updateJsonObject('Stress vector', event.target.value, (stressProfile) => updateVariant({ stressProfile: stressProfile as CanonicalVariant['stressProfile'] }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs disabled:bg-gray-100" />
              </label>
              <fieldset className="rounded border border-gray-200 p-3 md:col-span-2">
                <legend className="px-1 text-sm font-semibold text-gray-800">Scaling handles and identity boundaries</legend>
                <p className="text-xs text-gray-500">Document an approved scaling direction for this exact variant. The boundary states whether changing the handle preserves this prescription, delivery profile, exact variant, or only the broader exercise concept.</p>
                <div className="mt-3 space-y-3">
                  {(variant.scalingHandles ?? []).map((handle, index) => (
                    <div key={`${handle.dimension}-${handle.boundary}-${index}`} className="rounded border border-gray-200 bg-gray-50 p-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="text-xs">Scaling dimension
                          <select
                            disabled={!editable}
                            value={handle.dimension}
                            onChange={(event) => updateVariant({
                              scalingHandles: variant.scalingHandles.map((item, itemIndex) => itemIndex === index ? { ...item, dimension: event.target.value } : item),
                            })}
                            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 disabled:bg-gray-100"
                          >
                            {SCALING_DIMENSIONS.map((dimension) => <option key={dimension} value={dimension}>{dimension.replaceAll('_', ' ')}</option>)}
                          </select>
                        </label>
                        <label className="text-xs">Identity boundary
                          <select
                            disabled={!editable}
                            value={handle.boundary}
                            onChange={(event) => updateVariant({
                              scalingHandles: variant.scalingHandles.map((item, itemIndex) => itemIndex === index ? { ...item, boundary: event.target.value as CanonicalVariant['scalingHandles'][number]['boundary'] } : item),
                            })}
                            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 disabled:bg-gray-100"
                          >
                            {SCALING_BOUNDARIES.map((boundary) => <option key={boundary} value={boundary}>{boundary.replaceAll('_', ' ')}</option>)}
                          </select>
                        </label>
                        <label className="text-xs">Easier direction
                          <input
                            disabled={!editable}
                            value={handle.easier ?? ''}
                            onChange={(event) => updateVariant({
                              scalingHandles: variant.scalingHandles.map((item, itemIndex) => itemIndex === index ? { ...item, easier: event.target.value || null } : item),
                            })}
                            placeholder="For example: reduce repetitions"
                            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 disabled:bg-gray-100"
                          />
                        </label>
                        <label className="text-xs">Harder direction
                          <input
                            disabled={!editable}
                            value={handle.harder ?? ''}
                            onChange={(event) => updateVariant({
                              scalingHandles: variant.scalingHandles.map((item, itemIndex) => itemIndex === index ? { ...item, harder: event.target.value || null } : item),
                            })}
                            placeholder="For example: add repetitions within the profile cap"
                            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 disabled:bg-gray-100"
                          />
                        </label>
                      </div>
                      <label className="mt-2 block text-xs">Author limits (optional JSON object)
                        <textarea
                          key={`${handle.dimension}-${handle.boundary}-${index}-${JSON.stringify(handle.limits)}`}
                          disabled={!editable}
                          rows={2}
                          defaultValue={JSON.stringify(handle.limits, null, 2)}
                          onBlur={(event) => updateJsonObject('Scaling handle limits', event.target.value, (limits) => updateVariant({
                            scalingHandles: variant.scalingHandles.map((item, itemIndex) => itemIndex === index ? { ...item, limits } : item),
                          }))}
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 font-mono text-xs disabled:bg-gray-100"
                        />
                      </label>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => updateVariant({ scalingHandles: variant.scalingHandles.filter((_, itemIndex) => itemIndex !== index) })}
                          className="mt-2 text-xs font-medium text-red-700"
                        >
                          Remove handle
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {editable && (
                  <button
                    type="button"
                    onClick={() => updateVariant({
                      scalingHandles: [...(variant.scalingHandles ?? []), {
                        dimension: 'volume',
                        boundary: 'prescription',
                        easier: null,
                        harder: null,
                        limits: {},
                      }],
                    })}
                    className="mt-3 rounded border border-indigo-300 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                  >
                    Add scaling handle
                  </button>
                )}
                {(variant.scalingHandles ?? []).length === 0 && <p className="mt-3 text-xs text-amber-700">No scaling handle is recorded. Add only directions supported by your review evidence.</p>}
              </fieldset>
              <label className="text-sm md:col-span-2">Composition and interference profile
                <textarea disabled={!editable} rows={8} defaultValue={JSON.stringify(variant.compositionProfile, null, 2)} onBlur={(event) => updateJsonObject('Composition profile', event.target.value, (compositionProfile) => updateVariant({ compositionProfile }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs disabled:bg-gray-100" />
                <span className="mt-1 block text-xs text-gray-500">Narrative pairing and interference guidance remains review context. Deterministic constraints must use <code>constraints</code> with <code>avoid_same_session</code> or <code>avoid_after</code>, targeting a variant, definition, family, movement pattern, body region, or approved taxonomy term. They take effect only after independent structured-profile review.</span>
              </label>
            </div>
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
                <label className="text-sm">Observed demonstration quality (1–100)<input type="number" min={1} max={100} value={mediaScore} onChange={(event) => setMediaScore(event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 w-full rounded border border-indigo-200 px-3 py-2" /></label>
                <label className="text-sm">Playback status<select value={mediaLinkStatus} onChange={(event) => setMediaLinkStatus(event.target.value as typeof mediaLinkStatus)} className="mt-1 w-full rounded border border-indigo-200 px-3 py-2"><option value="">Select observed status</option><option value="healthy">Healthy</option><option value="broken">Broken</option><option value="mismatched">Mismatched</option></select></label>
                <label className="text-sm">Exact card match<select value={mediaExactVariantMatch == null ? '' : mediaExactVariantMatch ? 'yes' : 'no'} onChange={(event) => setMediaExactVariantMatch(event.target.value === '' ? null : event.target.value === 'yes')} className="mt-1 w-full rounded border border-indigo-200 px-3 py-2"><option value="">Select observed match</option><option value="yes">Yes — exact match</option><option value="no">No — not exact</option></select></label>
              </div>
              <label className="mt-3 block text-sm">Observed review evidence<textarea rows={3} minLength={20} value={mediaReviewNotes} onChange={(event) => setMediaReviewNotes(event.target.value)} placeholder="Document playback behavior, exact task comparison, and any accessibility limitation observed." className="mt-1 w-full rounded border border-indigo-200 px-3 py-2" /></label>
              <fieldset className="mt-3 rounded border border-indigo-200 bg-white p-3">
                <legend className="px-1 text-xs font-semibold text-indigo-950">Manual-review attestations</legend>
                <p className="mb-2 text-xs text-indigo-900">These record what you personally checked; they do not make a candidate video approved on their own.</p>
                {([
                  ['playbackReviewed', 'I watched the current asset through its relevant demonstration.'],
                  ['exactVariantCompared', 'I compared the demonstrated task with this card’s exact variant.'],
                  ['linkChecked', 'I checked that the selected URL resolves to the observed asset.'],
                  ['accessibilityChecked', 'I checked captions, transcript, stills, or other access support that is available.'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="mt-1 flex items-start gap-2 text-xs text-gray-800"><input type="checkbox" checked={mediaReviewBasis[key]} onChange={(event) => setMediaReviewBasis((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>
                ))}
              </fieldset>
              <button type="button" disabled={saving || !card.approvedVideoUrl || typeof mediaScore !== 'number' || mediaScore < 1 || mediaScore > 100 || !mediaLinkStatus || mediaExactVariantMatch == null || mediaReviewNotes.trim().length < 20 || !Object.values(mediaReviewBasis).every(Boolean)} onClick={() => void reviewMedia()} className="mt-2 rounded border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-900 disabled:opacity-50">Record documented media review</button>
              {card.status === 'review' && (
                <div className="mt-4">
                  <label className="text-sm">Reviewer evidence<textarea rows={2} minLength={20} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Document observed evidence and the review decision (20+ characters)." className="mt-1 w-full rounded border border-indigo-200 px-3 py-2" /></label>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={saving || reviewNotes.trim().length < 20 || !card.readiness?.ready || card.testPacket?.status === 'failed'} onClick={() => void review('approve')} className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve</button>
                    <button type="button" disabled={saving || reviewNotes.trim().length < 20} onClick={() => void review('request_changes')} className="rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Request changes</button>
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
                      <div className="mt-3">
                        <label className="text-xs text-gray-700">Independent relationship review evidence
                          <textarea rows={2} minLength={20} value={relationshipReviewNotes[edge.id] ?? ''} onChange={(event) => setRelationshipReviewNotes((current) => ({ ...current, [edge.id]: event.target.value }))} placeholder="Document why this exact relationship is safe and appropriate (20+ characters)." className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
                        </label>
                        <div className="mt-2 flex gap-2">
                          <button type="button" disabled={saving || (relationshipReviewNotes[edge.id]?.trim().length ?? 0) < 20} onClick={() => void reviewRelationship(edge.id, 'approved')} className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Approve edge</button>
                          <button type="button" disabled={saving || (relationshipReviewNotes[edge.id]?.trim().length ?? 0) < 20} onClick={() => void reviewRelationship(edge.id, 'rejected')} className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Reject edge</button>
                        </div>
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
