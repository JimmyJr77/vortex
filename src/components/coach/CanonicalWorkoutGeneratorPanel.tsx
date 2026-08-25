import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Plus, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type { TaxonomyV2Catalog } from '../../coach/taxonomy'

interface CanonicalPrescription {
  exerciseId: string
  variantId: string
  phaseKey: string
  exerciseName: string
  deliveryProfileId: string
  purpose: string
  dose: {
    sets: number
    reps: number | null
    workSeconds: number
    restSeconds: number
    tempo: string | null
    rpe: number | null
  }
  coachInstructions?: string | null
  athleteInstructions?: string | null
  qualityGate: string
  stopRules: string[]
  predictedChallengeScore: number
  technicalRiskScore: number
  selectionScore: {
    total: number
    components: Record<string, number>
  }
}

interface CanonicalPhase {
  phaseKey: string
  label: string
  purpose: string
  targetMinutes: number
  estimatedMinutes: number
  phaseRationale: string
  phaseQualityScore: number
  prescriptions: CanonicalPrescription[]
}

interface CanonicalWorkoutResult {
  persistedWorkoutId: string
  workoutId: string
  generatorVersion: string
  libraryVersion: string
  ruleVersion: string
  randomSeed: string
  overallQualityScore: number
  aiUnavailable?: boolean
  aiInterpretation?: {
    interpretedObjective?: string
    assumptions?: string[]
    uncertainties?: string[]
    confidence?: Record<string, number>
  } | null
  phases: CanonicalPhase[]
  validation: {
    status: 'passed' | 'failed'
    errors: string[]
    warnings: string[]
    durationReconciliation: {
      requestedMinutes: number
      estimatedMinutes: number
      toleranceMinutes: number
    }
    fatigueBudget: {
      cumulative: Record<string, number>
      maximum: Record<string, number>
      withinBudget: boolean
    }
    stressBudget: {
      cumulative: Record<string, number>
      maximum: Record<string, number>
      withinBudget: boolean
    }
  }
  diagnostics: {
    rejectionCounts: Record<string, number>
    candidatePoolDepthByPhase: Record<string, number>
    repairs: string[]
    unmetPreferences: string[]
  }
  selectionArchitecture: {
    strategy: 'anchor_first'
    anchorPhaseKeys: string[]
    selectionOrder: string[]
  }
}

interface CanonicalSwapCandidate {
  exerciseId: string
  variantId: string
  exerciseName: string
  relationshipId: string
  relationshipType: string
  similarityScore: number
  combinedScore: number
  changedDimensions: string[]
  rationale: string
}

interface CanonicalRolloutStatus {
  coachGeneration: {
    enabled: boolean
    reason: 'environment_disabled' | 'facility_not_enrolled' | 'facility_flag_disabled' | 'rollout_schema_unavailable' | null
  }
  aiIntent: {
    enabled: boolean
    reason: 'environment_disabled' | 'facility_not_enrolled' | 'facility_flag_disabled' | 'rollout_schema_unavailable' | null
  }
  rollout: {
    rolloutStage: 'disabled' | 'shadow' | 'coach' | 'member'
  } | null
}

const OBJECTIVES = [
  ['general_athletic_development', 'General athletic development'],
  ['speed_priority', 'Speed'],
  ['explosiveness_power_priority', 'Explosiveness / power'],
  ['strength_priority', 'Strength'],
  ['agility_priority', 'Agility'],
  ['mobility_control_priority', 'Mobility / control'],
  ['fitness_priority', 'Conditioning'],
  ['recovery_low_intensity', 'Recovery / low intensity'],
] as const

const PHASES = [
  ['prepare_and_access', 'Prepare & Access'],
  ['movement_intelligence', 'Movement Intelligence'],
  ['output', 'Output'],
  ['capacity', 'Capacity'],
  ['resilience', 'Resilience'],
  ['sustained_capacity', 'Sustained Capacity'],
  ['restore', 'Restore'],
] as const

const FOCUS_FACETS = [
  ['training_family', 'Training Family'],
  ['athletic_niche', 'Athletic Niche'],
  ['tenet', 'Tenet'],
  ['methodology', 'Methodology'],
  ['force_velocity', 'Force–Velocity'],
  ['movement_character', 'Movement Character'],
  ['programming_set_structure', 'Set Structure'],
  ['programming_clock_structure', 'Clock Structure'],
  ['conditioning_protocol', 'Conditioning Protocol'],
  ['physiology_mechanism', 'Physiology Mechanism'],
] as const

const FOCUS_SCOPES = [
  ['anchor_exercises', 'Anchor exercises'],
  ['main_work', 'Main work'],
  ['prepare_restore', 'Prepare + Restore'],
  ['accessories', 'Accessories'],
  ['conditioning', 'Conditioning'],
  ['whole_session', 'Whole session'],
  ...PHASES,
] as const

/**
 * These are the controlled equipment keys exposed to coaches. “Bodyweight” is
 * retained as the request alias for `none` so legacy availability matching and
 * the user-facing language remain compatible.
 */
const EQUIPMENT_OPTIONS = [
  ['bodyweight', 'Bodyweight (none)'],
  ['kettlebell', 'Kettlebell'],
  ['medicine_ball', 'Medicine ball'],
  ['wall_ball', 'Wall ball'],
  ['slam_ball', 'Slam ball'],
  ['jump_rope', 'Jump rope'],
  ['barbell', 'Barbell'],
  ['dumbbell', 'Dumbbell'],
  ['battle_rope', 'Rope — battle'],
  ['climbing_rope', 'Rope — climbing'],
  ['resistance_band', 'Bands — resistance'],
  ['mini_band', 'Bands — mini'],
  ['cones', 'Cones'],
  ['mini_hurdles', 'Mini-hurdles'],
  ['trap_bar', 'Trap bar'],
  ['sandbag', 'Sandbags'],
  ['agility_ladder', 'Agility ladder'],
  ['timing_gates', 'Timing gates'],
  ['force_plate', 'Force plate'],
] as const

interface WorkoutFocusDraft {
  id: string
  facet: string
  value: string
  scope: string
  strength: 'required' | 'strong_preference' | 'preferred' | 'exclude'
  weight: number
  preserveOnSubstitution: boolean
}

function parseList(value: string): string[] {
  return [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))]
}

function parseEquipment(value: string): { available: string[]; quantities: Record<string, number> } {
  const available: string[] = []
  const quantities: Record<string, number> = {}
  for (const token of parseList(value)) {
    const [key, rawQuantity] = token.split(':').map((part) => part.trim())
    if (!key) continue
    available.push(key)
    if (rawQuantity && Number.isInteger(Number(rawQuantity)) && Number(rawQuantity) >= 0) {
      quantities[key] = Number(rawQuantity)
    }
  }
  return { available, quantities }
}

function serializeEquipment(available: string[], quantities: Record<string, number>): string {
  return [...new Set(available)].map((key) => (
    quantities[key] == null ? key : `${key}:${quantities[key]}`
  )).join(', ')
}

function rolloutMessage(reason: CanonicalRolloutStatus['coachGeneration']['reason']): string {
  if (reason === 'environment_disabled') return 'The global canonical-generator kill switch is off.'
  if (reason === 'rollout_schema_unavailable') return 'The facility rollout migration is unavailable; generation stays disabled until deployment is complete.'
  if (reason === 'facility_not_enrolled') return 'This facility has not been enrolled in the canonical-generator pilot.'
  if (reason === 'facility_flag_disabled') return 'This facility is enrolled, but coach generation is not enabled at its current rollout stage.'
  return 'Canonical coach generation is enabled for this facility.'
}

export function CanonicalWorkoutGeneratorPanel() {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CanonicalWorkoutResult | null>(null)
  const [mode, setMode] = useState<'deterministic' | 'ai_assisted'>('deterministic')
  const [coachRequest, setCoachRequest] = useState('')
  const [duration, setDuration] = useState(60)
  const [objective, setObjective] = useState<(typeof OBJECTIVES)[number][0]>('general_athletic_development')
  const [athleteCount, setAthleteCount] = useState(12)
  const [coachCount, setCoachCount] = useState(1)
  const [ageMin, setAgeMin] = useState(8)
  const [ageMax, setAgeMax] = useState(10)
  const [trainingExperience, setTrainingExperience] = useState('beginner')
  const [seed, setSeed] = useState('coach-pilot-1')
  const [equipment, setEquipment] = useState('bodyweight')
  const [equipmentAvoid, setEquipmentAvoid] = useState('')
  const [limitations, setLimitations] = useState('')
  const [maxDifficulty, setMaxDifficulty] = useState(60)
  const [maxTechnicalRisk, setMaxTechnicalRisk] = useState(60)
  const [fatigueBudgets, setFatigueBudgets] = useState({
    grip: 65,
    localMuscle: 65,
    spinalLoading: 55,
    eccentricStress: 60,
    impactAccumulation: 55,
    technicalSensitivity: 60,
  })
  const [stressBudgets, setStressBudgets] = useState({
    jointStress: 55,
    tissueStress: 55,
    neuralDemand: 65,
    impactStress: 55,
    localMuscularFatigue: 65,
    systemicFatigue: 65,
    gripFatigue: 65,
    conditioningFatigue: 65,
    recoveryCost: 65,
  })
  const [taxonomyV2, setTaxonomyV2] = useState<TaxonomyV2Catalog | null>(null)
  const [rolloutStatus, setRolloutStatus] = useState<CanonicalRolloutStatus | null>(null)
  const [phaseEmphasis, setPhaseEmphasis] = useState<Record<string, number>>(
    Object.fromEntries(PHASES.map(([key]) => [key, 50])),
  )
  const [focuses, setFocuses] = useState<WorkoutFocusDraft[]>([])
  const [swapCandidates, setSwapCandidates] = useState<Record<string, CanonicalSwapCandidate[]>>({})
  const [swapLoadingKey, setSwapLoadingKey] = useState<string | null>(null)

  useEffect(() => {
    if (!expanded || (taxonomyV2 && rolloutStatus)) return
    const taxonomyRequest = taxonomyV2
      ? Promise.resolve(taxonomyV2)
      : coachFetch<TaxonomyV2Catalog>('/api/coach/taxonomy-v2')
    const rolloutRequest = rolloutStatus
      ? Promise.resolve(rolloutStatus)
      : coachFetch<CanonicalRolloutStatus>('/api/coach/canonical/rollout-status')
    void Promise.all([taxonomyRequest, rolloutRequest])
      .then(([taxonomy, rollout]) => {
        setTaxonomyV2(taxonomy)
        setRolloutStatus(rollout)
      })
      .catch(() => undefined)
  }, [expanded, rolloutStatus, taxonomyV2])

  const addFocus = () => {
    const facet = FOCUS_FACETS[0][0]
    setFocuses((current) => [...current, {
      id: globalThis.crypto?.randomUUID?.() ?? `focus-${Date.now()}-${current.length}`,
      facet,
      value: taxonomyV2?.facets[facet]?.[0]?.key ?? '',
      scope: 'anchor_exercises',
      strength: 'preferred',
      weight: 85,
      preserveOnSubstitution: true,
    }])
  }

  const updateFocus = (id: string, patch: Partial<WorkoutFocusDraft>) => {
    setFocuses((current) => current.map((focus) => {
      if (focus.id !== id) return focus
      const next = { ...focus, ...patch }
      if (patch.facet) next.value = taxonomyV2?.facets[patch.facet]?.[0]?.key ?? ''
      return next
    }))
  }

  const updateAvailableEquipment = (available: string[]) => {
    setEquipment((current) => {
      const parsed = parseEquipment(current)
      return serializeEquipment(available, parsed.quantities)
    })
  }

  const updateEquipmentQuantity = (key: string, rawQuantity: string) => {
    setEquipment((current) => {
      const parsed = parseEquipment(current)
      const quantities = { ...parsed.quantities }
      if (rawQuantity === '') delete quantities[key]
      else {
        const quantity = Number(rawQuantity)
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000) return current
        quantities[key] = quantity
      }
      return serializeEquipment(parsed.available, quantities)
    })
  }

  const availableEquipment = parseEquipment(equipment)
  const avoidedEquipment = parseList(equipmentAvoid)

  const generate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const parsedEquipment = parseEquipment(equipment)
      const defaults = {
        mode: 'deterministic',
        objective,
        durationMinutes: duration,
        athleteCount,
        coachCount,
        ageMin,
        ageMax,
        trainingExperience,
        randomSeed: seed,
        equipmentAvailable: parsedEquipment.available,
        equipmentQuantities: parsedEquipment.quantities,
        equipmentAvoid: parseList(equipmentAvoid),
        limitations: parseList(limitations),
        maxDifficulty,
        maxTechnicalRisk,
        fatigueBudgets,
        stressBudgets,
        phaseEmphasis,
        focuses: focuses.map((focus) => ({
          facet: focus.facet,
          value: focus.value,
          scope: focus.scope,
          strength: focus.strength,
          weight: focus.weight,
          preserveOnSubstitution: focus.preserveOnSubstitution,
        })),
        space: { environment: 'indoor' },
      }
      const endpoint = mode === 'ai_assisted'
        ? '/api/coach/needs-engine/prescribe-canonical-ai'
        : '/api/coach/needs-engine/prescribe-canonical'
      const body = mode === 'ai_assisted' ? { request: coachRequest, defaults } : defaults
      const data = await coachFetch<CanonicalWorkoutResult>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setResult(data)
    } catch (caught) {
      const requestError = caught as Error & { status?: number; details?: { code?: string } }
      if (requestError.status === 404) {
        setError(rolloutMessage(rolloutStatus?.coachGeneration.reason ?? null))
      } else if (requestError.status === 409) {
        setError(requestError.message)
      } else {
        setError(requestError.details?.code ? `${requestError.message} (${requestError.details.code})` : requestError.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadSwaps = async (item: CanonicalPrescription) => {
    if (!result?.persistedWorkoutId) return
    const key = `${item.phaseKey}:${item.variantId}`
    setSwapLoadingKey(key)
    setError(null)
    try {
      const params = new URLSearchParams({
        phaseKey: item.phaseKey,
        variantId: item.variantId,
        exerciseId: item.exerciseId,
      })
      const candidates = await coachFetch<CanonicalSwapCandidate[]>(
        `/api/coach/canonical/workouts/${result.persistedWorkoutId}/swaps?${params}`,
      )
      setSwapCandidates((current) => ({ ...current, [key]: candidates }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load reviewed substitutions.')
    } finally {
      setSwapLoadingKey(null)
    }
  }

  const applySwap = async (item: CanonicalPrescription, candidate: CanonicalSwapCandidate) => {
    if (!result?.persistedWorkoutId) return
    const key = `${item.phaseKey}:${item.variantId}`
    setSwapLoadingKey(key)
    setError(null)
    try {
      const updated = await coachFetch<CanonicalWorkoutResult>(
        `/api/coach/canonical/workouts/${result.persistedWorkoutId}/swaps`,
        {
          method: 'POST',
          body: JSON.stringify({
            phaseKey: item.phaseKey,
            sourceVariantId: item.variantId,
            sourceExerciseId: item.exerciseId,
            targetVariantId: candidate.variantId,
          }),
        },
      )
      setResult(updated)
      setSwapCandidates({})
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not apply reviewed substitution.')
    } finally {
      setSwapLoadingKey(null)
    }
  }

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/40">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <span>
          <span className="flex items-center gap-2 font-semibold text-indigo-950">
            <ShieldCheck className="h-4 w-4" /> Canonical generator pilot
          </span>
          <span className="mt-0.5 block text-xs text-indigo-800">
            Seeded 1–100 scoring, approved-card gates, logistics, and validation.
          </span>
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-indigo-700" /> : <ChevronDown className="h-4 w-4 text-indigo-700" />}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-indigo-200 p-4">
          {rolloutStatus && (
            <div role="status" className={`rounded-lg border p-3 text-sm ${rolloutStatus.coachGeneration.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <p className="font-semibold">{rolloutStatus.coachGeneration.enabled ? 'Coach pilot enabled' : 'Coach pilot not enabled'}</p>
              <p className="mt-1 text-xs">{rolloutMessage(rolloutStatus.coachGeneration.reason)}{rolloutStatus.rollout ? ` Current rollout stage: ${rolloutStatus.rollout.rolloutStage}.` : ''}</p>
              {rolloutStatus.coachGeneration.enabled && !rolloutStatus.aiIntent.enabled && <p className="mt-1 text-xs">AI-assisted intent remains off for this facility; deterministic generation is still available.</p>}
            </div>
          )}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-800">Generation mode</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="canonical-mode" checked={mode === 'deterministic'} onChange={() => setMode('deterministic')} />
                Deterministic
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="canonical-mode" disabled={rolloutStatus != null && !rolloutStatus.aiIntent.enabled} checked={mode === 'ai_assisted'} onChange={() => setMode('ai_assisted')} />
                AI-assisted intent
              </label>
            </div>
          </fieldset>

          {mode === 'ai_assisted' && (
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Coach intent, concerns, and preferences</span>
              <textarea
                value={coachRequest}
                onChange={(event) => setCoachRequest(event.target.value)}
                rows={4}
                maxLength={4000}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Example: Build a low-impact strength session for 12 beginners ages 8–10. Avoid jumping and protect confidence around overhead work."
              />
              <span className="mt-1 block text-xs text-gray-500">
                AI interprets intent only. The deterministic engine still controls exercises, dosage, safety, and validation.
              </span>
            </label>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="font-medium text-gray-700">Objective</span>
              <select value={objective} onChange={(event) => setObjective(event.target.value as typeof objective)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                {OBJECTIVES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium text-gray-700">Duration</span>
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                {[60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium text-gray-700">Athletes</span>
              <input type="number" min={1} max={100} value={athleteCount} onChange={(event) => setAthleteCount(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="font-medium text-gray-700">Coaches</span>
              <input type="number" min={1} max={20} value={coachCount} onChange={(event) => setCoachCount(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="font-medium text-gray-700">Minimum age</span>
              <input type="number" min={5} max={99} value={ageMin} onChange={(event) => setAgeMin(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="font-medium text-gray-700">Maximum age</span>
              <input type="number" min={5} max={99} value={ageMax} onChange={(event) => setAgeMax(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="font-medium text-gray-700">Training experience</span>
              <select value={trainingExperience} onChange={(event) => setTrainingExperience(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                {['beginner', 'intermediate', 'advanced'].map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium text-gray-700">Random seed</span>
              <input value={seed} onChange={(event) => setSeed(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs" />
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <fieldset className="text-sm">
              <legend className="font-medium text-gray-700">Available equipment</legend>
              <select
                multiple
                value={availableEquipment.available}
                onChange={(event) => updateAvailableEquipment([...event.currentTarget.selectedOptions].map((option) => option.value))}
                className="mt-1 h-40 w-full rounded-lg border border-gray-300 px-3 py-2"
                aria-describedby="canonical-equipment-help"
              >
                {EQUIPMENT_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <span id="canonical-equipment-help" className="mt-1 block text-xs text-gray-500">Select all equipment on hand. Rope and band types remain distinct so a card cannot silently substitute one for another.</span>
              {availableEquipment.available.filter((key) => key !== 'bodyweight').length > 0 && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {availableEquipment.available.filter((key) => key !== 'bodyweight').map((key) => (
                    <label key={key} className="text-xs text-gray-600">
                      {EQUIPMENT_OPTIONS.find(([optionKey]) => optionKey === key)?.[1] ?? key} quantity (optional)
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={availableEquipment.quantities[key] ?? ''}
                        onChange={(event) => updateEquipmentQuantity(key, event.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
                        placeholder="Unlimited / untracked"
                      />
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <fieldset className="text-sm">
              <legend className="font-medium text-gray-700">Avoid equipment</legend>
              <select
                multiple
                value={avoidedEquipment}
                onChange={(event) => setEquipmentAvoid([...event.currentTarget.selectedOptions].map((option) => option.value).join(','))}
                className="mt-1 h-40 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {EQUIPMENT_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <span className="mt-1 block text-xs text-gray-500">Excluded equipment is a hard constraint, even when it is available.</span>
            </fieldset>
            <label className="text-sm">
              <span className="font-medium text-gray-700">Limitations</span>
              <input value={limitations} onChange={(event) => setLimitations(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="no_jumping, low_impact" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="font-medium text-gray-700">Difficulty cap</span>
                <input type="number" min={1} max={100} value={maxDifficulty} onChange={(event) => setMaxDifficulty(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
              <label className="text-sm">
                <span className="font-medium text-gray-700">Risk cap</span>
                <input type="number" min={1} max={100} value={maxTechnicalRisk} onChange={(event) => setMaxTechnicalRisk(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
            </div>
          </div>

          <fieldset className="rounded-lg border border-indigo-200 bg-white p-3">
            <legend className="px-1 text-sm font-semibold text-gray-800">Phase emphasis</legend>
            <p className="mb-3 text-xs text-gray-500">Weights change minute allocation, never the canonical phase sequence.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PHASES.map(([phaseKey, label]) => (
                <label key={phaseKey} className="text-xs text-gray-700">
                  <span className="flex justify-between gap-2"><span>{label}</span><strong>{phaseEmphasis[phaseKey]}</strong></span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={phaseEmphasis[phaseKey]}
                    onChange={(event) => setPhaseEmphasis((current) => ({
                      ...current,
                      [phaseKey]: Number(event.target.value),
                    }))}
                    className="mt-1 w-full"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-lg border border-indigo-200 bg-white p-3">
            <legend className="px-1 text-sm font-semibold text-gray-800">Exact-variant stress budgets</legend>
            <p className="mb-3 text-xs text-gray-500">Independent joint, tissue, neural, impact, local, systemic, grip, conditioning, and recovery limits prevent hidden stress stacking.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(stressBudgets).map(([field, value]) => (
                <label key={field} className="text-xs">{field.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  <input type="number" min={1} max={100} value={value} onChange={(event) => setStressBudgets((current) => ({ ...current, [field]: Number(event.target.value) }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-lg border border-indigo-200 bg-white p-3">
            <legend className="px-1 text-sm font-semibold text-gray-800">Scoped workout focuses</legend>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <p className="max-w-3xl text-xs text-gray-500">Required and excluded focuses are hard constraints. Preferences influence scoring. “Preserve” prevents reviewed substitutions from changing the reason an exercise was selected.</p>
              <button type="button" onClick={addFocus} disabled={!taxonomyV2} className="inline-flex items-center gap-1 rounded border border-indigo-300 px-2 py-1 text-xs font-semibold text-indigo-800 disabled:opacity-50">
                <Plus className="h-3.5 w-3.5" /> Add focus
              </button>
            </div>
            {!taxonomyV2 && <p className="text-xs text-gray-500">Loading controlled taxonomy…</p>}
            <div className="space-y-2">
              {focuses.map((focus) => (
                <div key={focus.id} className="grid gap-2 rounded border border-gray-200 bg-gray-50 p-2 md:grid-cols-[1.1fr_1.3fr_1.1fr_1.1fr_auto_auto]">
                  <label className="text-xs">Facet
                    <select value={focus.facet} onChange={(event) => updateFocus(focus.id, { facet: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5">
                      {FOCUS_FACETS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs">Value
                    <select value={focus.value} onChange={(event) => updateFocus(focus.id, { value: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5">
                      {(taxonomyV2?.facets[focus.facet] ?? []).map((term) => <option key={term.key} value={term.key}>{term.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs">Scope
                    <select value={focus.scope} onChange={(event) => updateFocus(focus.id, { scope: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5">
                      {FOCUS_SCOPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs">Strength
                    <select value={focus.strength} onChange={(event) => updateFocus(focus.id, { strength: event.target.value as WorkoutFocusDraft['strength'] })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5">
                      <option value="required">Required</option>
                      <option value="strong_preference">Strong preference</option>
                      <option value="preferred">Preferred</option>
                      <option value="exclude">Exclude</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1 self-end pb-1 text-xs">
                    <input type="checkbox" checked={focus.preserveOnSubstitution} onChange={(event) => updateFocus(focus.id, { preserveOnSubstitution: event.target.checked })} /> Preserve
                  </label>
                  <button type="button" aria-label="Remove focus" onClick={() => setFocuses((current) => current.filter((entry) => entry.id !== focus.id))} className="self-end rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-lg border border-indigo-200 bg-white p-3">
            <legend className="px-1 text-sm font-semibold text-gray-800">Cumulative fatigue budgets</legend>
            <p className="mb-3 text-xs text-gray-500">The selector rejects exercises whose projected contribution would exceed any session-wide budget.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(fatigueBudgets).map(([field, value]) => (
                <label key={field} className="text-xs">{field.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  <input type="number" min={1} max={100} value={value} onChange={(event) => setFatigueBudgets((current) => ({ ...current, [field]: Number(event.target.value) }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
                </label>
              ))}
            </div>
          </fieldset>

          <button type="button" onClick={() => void generate()} disabled={loading || !seed.trim() || (mode === 'ai_assisted' && !coachRequest.trim()) || (rolloutStatus != null && (!rolloutStatus.coachGeneration.enabled || (mode === 'ai_assisted' && !rolloutStatus.aiIntent.enabled)))} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate validated workout
          </button>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <span className="flex items-center gap-2 font-semibold text-emerald-900">
                  <CheckCircle2 className="h-4 w-4" /> Validated · {result.overallQualityScore}/100
                </span>
                <span className="font-mono text-xs text-emerald-800">{result.libraryVersion} · {result.randomSeed}</span>
              </div>
              {result.aiUnavailable && (
                <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  AI interpretation was unavailable. The workout was generated entirely from the deterministic form inputs.
                </div>
              )}
              {result.aiInterpretation && (
                <details className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-indigo-950">Interpreted coach intent</summary>
                  <div className="mt-2 space-y-1 text-xs text-indigo-900">
                    <p>Objective: {result.aiInterpretation.interpretedObjective?.replaceAll('_', ' ')}</p>
                    {(result.aiInterpretation.assumptions?.length ?? 0) > 0 && <p>Assumptions: {result.aiInterpretation.assumptions!.join(' ')}</p>}
                    {(result.aiInterpretation.uncertainties?.length ?? 0) > 0 && <p>Uncertainties: {result.aiInterpretation.uncertainties!.join(' ')}</p>}
                  </div>
                </details>
              )}
              {result.phases.map((phase) => (
                <article key={phase.phaseKey} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-semibold capitalize text-gray-900">{phase.label}</h4>
                    <span className="text-xs text-gray-500">{phase.estimatedMinutes}/{phase.targetMinutes} min · quality {phase.phaseQualityScore}/100</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">{phase.phaseRationale}</p>
                  <div className="mt-3 space-y-2">
                    {phase.prescriptions.map((item) => (
                      <details key={`${item.exerciseId}-${item.deliveryProfileId}`} className="rounded-md border border-gray-100 bg-gray-50 p-2">
                        <summary className="cursor-pointer text-sm font-medium text-gray-900">
                          {item.exerciseName} · {item.dose.sets} sets
                          {item.dose.reps != null ? ` × ${item.dose.reps}` : ` × ${item.dose.workSeconds}s`}
                        </summary>
                        <div className="mt-2 grid gap-2 text-xs text-gray-700 md:grid-cols-2">
                          <div><strong>Coach:</strong> {item.coachInstructions || item.purpose}</div>
                          <div><strong>Athlete:</strong> {item.athleteInstructions || item.purpose}</div>
                          <div><strong>Quality gate:</strong> {item.qualityGate}</div>
                          <div><strong>Stop:</strong> {item.stopRules.join(' ')}</div>
                          <div><strong>Challenge:</strong> {item.predictedChallengeScore}/100</div>
                          <div><strong>Technical risk:</strong> {item.technicalRiskScore}/100</div>
                        </div>
                        <div className="mt-3 border-t border-gray-200 pt-2">
                          <button type="button" disabled={swapLoadingKey === `${item.phaseKey}:${item.variantId}`} onClick={() => void loadSwaps(item)} className="rounded border border-indigo-300 bg-white px-2 py-1 text-xs font-semibold text-indigo-800 disabled:opacity-50">
                            {swapLoadingKey === `${item.phaseKey}:${item.variantId}` ? 'Checking…' : 'Reviewed substitutions'}
                          </button>
                          {swapCandidates[`${item.phaseKey}:${item.variantId}`] && (
                            <div className="mt-2 space-y-2">
                              {swapCandidates[`${item.phaseKey}:${item.variantId}`].length === 0 && <p className="text-xs text-gray-500">No approved graph substitution satisfies this workout’s hard constraints.</p>}
                              {swapCandidates[`${item.phaseKey}:${item.variantId}`].map((candidate) => (
                                <div key={candidate.relationshipId} className="flex flex-wrap items-start justify-between gap-2 rounded border border-indigo-100 bg-indigo-50 p-2 text-xs">
                                  <div>
                                    <p className="font-semibold text-indigo-950">{candidate.exerciseName} · {candidate.similarityScore}/100 similar</p>
                                    <p className="text-indigo-800">{candidate.relationshipType.replaceAll('_', ' ')} · {candidate.rationale}</p>
                                    {candidate.changedDimensions.length > 0 && <p className="text-indigo-700">Changes: {candidate.changedDimensions.join(', ')}</p>}
                                  </div>
                                  <button type="button" disabled={swapLoadingKey === `${item.phaseKey}:${item.variantId}`} onClick={() => void applySwap(item, candidate)} className="rounded bg-indigo-700 px-2 py-1 font-semibold text-white disabled:opacity-50">Apply and revalidate</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </article>
              ))}
              <details className="rounded-lg border border-gray-200 bg-white p-3">
                <summary className="cursor-pointer text-sm font-semibold text-gray-800">Validation and traceability</summary>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p>Stored result: <span className="font-mono">{result.persistedWorkoutId}</span></p>
                  <p>Generator: {result.generatorVersion} · Rules: {result.ruleVersion}</p>
                  <p>Selection: anchor-first · anchors {result.selectionArchitecture.anchorPhaseKeys.map((key) => key.replaceAll('_', ' ')).join(', ')}</p>
                  <p>Duration: {result.validation.durationReconciliation.estimatedMinutes}/{result.validation.durationReconciliation.requestedMinutes} min</p>
                  <p>Fatigue budgets: {Object.entries(result.validation.fatigueBudget.cumulative).map(([key, value]) => `${key} ${value}/${result.validation.fatigueBudget.maximum[key]}`).join(' · ')}</p>
                  <p>Stress budgets: {Object.entries(result.validation.stressBudget.cumulative).map(([key, value]) => `${key} ${value}/${result.validation.stressBudget.maximum[key]}`).join(' · ')}</p>
                  <p>Rejected candidates: {Object.values(result.diagnostics.rejectionCounts).reduce((sum, count) => sum + count, 0)}</p>
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
