import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { coachFetch } from '../../coach/api'

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
  }
  diagnostics: {
    rejectionCounts: Record<string, number>
    candidatePoolDepthByPhase: Record<string, number>
    repairs: string[]
    unmetPreferences: string[]
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
  const [swapCandidates, setSwapCandidates] = useState<Record<string, CanonicalSwapCandidate[]>>({})
  const [swapLoadingKey, setSwapLoadingKey] = useState<string | null>(null)

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
        setError('The canonical generator pilot is not enabled for this environment.')
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
          <fieldset>
            <legend className="text-sm font-semibold text-gray-800">Generation mode</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="canonical-mode" checked={mode === 'deterministic'} onChange={() => setMode('deterministic')} />
                Deterministic
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="canonical-mode" checked={mode === 'ai_assisted'} onChange={() => setMode('ai_assisted')} />
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
            <label className="text-sm">
              <span className="font-medium text-gray-700">Available equipment</span>
              <input value={equipment} onChange={(event) => setEquipment(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="bodyweight, dumbbell:8, medicine_ball:4" />
              <span className="mt-1 block text-xs text-gray-500">Comma-separated controlled keys; append :quantity when limited.</span>
            </label>
            <label className="text-sm">
              <span className="font-medium text-gray-700">Avoid equipment</span>
              <input value={equipmentAvoid} onChange={(event) => setEquipmentAvoid(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="barbell, plyo_box" />
            </label>
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

          <button type="button" onClick={() => void generate()} disabled={loading || !seed.trim() || (mode === 'ai_assisted' && !coachRequest.trim())} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">
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
                  <p>Duration: {result.validation.durationReconciliation.estimatedMinutes}/{result.validation.durationReconciliation.requestedMinutes} min</p>
                  <p>Fatigue budgets: {Object.entries(result.validation.fatigueBudget.cumulative).map(([key, value]) => `${key} ${value}/${result.validation.fatigueBudget.maximum[key]}`).join(' · ')}</p>
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
