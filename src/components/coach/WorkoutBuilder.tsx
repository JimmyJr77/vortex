import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock, Loader2, Plus, Save, Search, Trash2, ChevronUp, ChevronDown, FolderOpen, GripVertical, X, Pencil, Sparkles, ChevronRight, ChevronDown as ChevronDownIcon } from 'lucide-react'
import { coachFetch, type CoachLibraryPage } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import { useCoachBuilderStore, blockSeconds, workoutSeconds } from '../../coach/useCoachBuilderStore'
import WorkoutSetupWizard from './WorkoutSetupWizard'
import { validationStatusLabel, allValidationIssues } from '../../coach/validationMessages'
import { exerciseDosageLabel, exerciseFitnessGoal, exerciseSubroleAndSlotLine, exerciseTenetLabels, movementFamilyLabel, phaseFitBadge, phaseSubroleLabel } from '../../coach/exerciseCard'
import { orderSlotsForSubrole, prepareAccessSubroleSequence } from '../../coach/taxonomy'
import type { BlockFormat, Exercise, ProgrammingMethod, ProgrammingMethodSummary, ValidationResult, Workout, WorkoutType } from '../../coach/types'
import { applyProgrammingMethodDefaults } from '../../coach/programmingBlockDefaults'
import { parseExerciseCompatibility, programmingExerciseFit, type ProgrammingExerciseFit } from '../../coach/programmingExerciseCompat'
import { splitVariantLabel, splitVariantTone, splitVariantsForItem } from '../../coach/splitVariants'

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

const BLOCK_FORMAT_LABELS: Record<BlockFormat, string> = {
  straight_sets: 'Straight Sets',
  circuit: 'Circuit',
  amrap: 'AMRAP',
  emom: 'EMOM',
  for_time: 'For Time',
  stations: 'Stations',
  interval: 'Interval',
  density: 'Density',
  tempo: 'Tempo',
  relay: 'Relay',
  game: 'Game',
}

export default function WorkoutBuilder({ defaultType = 'workout' }: { defaultType?: WorkoutType }) {
  const { taxonomy } = useTaxonomy()
  const { workout, patchWorkout, applyPhasePlan, addBlock, updateBlock, removeBlock, addItem, updateItem, removeItem, moveItem, reorderItem, reset, setWorkout, validation, setValidation, wizardComplete, setWizardComplete } =
    useCoachBuilderStore()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickerBlock, setPickerBlock] = useState<number | null>(null)
  const [saved, setSaved] = useState<Workout[]>([])
  const [previewWorkout, setPreviewWorkout] = useState<Workout | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showWizard, setShowWizard] = useState(defaultType === 'workout' && !wizardComplete)
  const [openPhaseEdu, setOpenPhaseEdu] = useState<number | null>(null)
  const [phaseEducation, setPhaseEducation] = useState<Map<string, { short_summary?: string | null; why_it_matters?: string | null; programming_guidance?: string | null; why_this_order?: string | null }>>(new Map())
  const [overrideReason, setOverrideReason] = useState('')
  const [showOverride, setShowOverride] = useState(false)
  const [programmingMethods, setProgrammingMethods] = useState<ProgrammingMethodSummary[]>([])
  const [programmingCompatByBlock, setProgrammingCompatByBlock] = useState<Map<number, ReturnType<typeof parseExerciseCompatibility>>>(new Map())

  useEffect(() => {
    if (!workout.title && workout.blocks.length <= 1 && workout.type !== defaultType) {
      reset(defaultType)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultType])

  const [minMinutes, setMinMinutes] = useState<number | ''>('')
  const [maxMinutes, setMaxMinutes] = useState<number | ''>('')
  const [drag, setDrag] = useState<{ block: number; index: number } | null>(null)

  const loadSaved = useCallback(async () => {
    try {
      const params = new URLSearchParams({ type: defaultType })
      if (minMinutes !== '') params.set('minMinutes', String(minMinutes))
      if (maxMinutes !== '') params.set('maxMinutes', String(maxMinutes))
      const data = await coachFetch<Workout[]>(`/api/coach/workouts?${params.toString()}`)
      setSaved(data)
    } catch {
      /* non-fatal */
    }
  }, [defaultType, minMinutes, maxMinutes])

  useEffect(() => {
    void loadSaved()
  }, [loadSaved])

  const totalSeconds = workoutSeconds(workout)

  const phaseName = useMemo(() => {
    const map = new Map<string, string>()
    taxonomy?.sessionPhases?.forEach((p) => map.set(p.key, p.name))
    return map
  }, [taxonomy])

  useEffect(() => {
    coachFetch<ProgrammingMethodSummary[]>('/api/coach/programming-methods')
      .then(setProgrammingMethods)
      .catch(() => setProgrammingMethods([]))
  }, [])

  const methodsForPhase = useCallback((phaseKey?: string | null) => {
    if (!phaseKey) return programmingMethods
    return programmingMethods.filter(
      (m) => m.best_session_phase === phaseKey || m.compatible_session_phases?.includes(phaseKey),
    )
  }, [programmingMethods])

  const selectProgrammingMethod = async (blockIndex: number, methodId: number | null) => {
    if (!methodId) {
      updateBlock(blockIndex, { programming_method_id: null, programming_method_slug: null, programming_method_name: null })
      setProgrammingCompatByBlock((prev) => {
        const next = new Map(prev)
        next.delete(blockIndex)
        return next
      })
      return
    }
    try {
      const method = await coachFetch<ProgrammingMethod>(`/api/coach/programming-methods/${methodId}`)
      updateBlock(blockIndex, applyProgrammingMethodDefaults(method, workout.blocks[blockIndex]))
      setProgrammingCompatByBlock((prev) => new Map(prev).set(blockIndex, parseExerciseCompatibility(method)))
    } catch {
      /* non-fatal */
    }
  }

  useEffect(() => {
    coachFetch<Array<{ entity_key: string; short_summary?: string | null; why_it_matters?: string | null; programming_guidance?: string | null; why_this_order?: string | null }>>(
      '/api/coach/education?entity_type=session_phase',
    )
      .then((rows) => {
        const map = new Map<string, { short_summary?: string | null; why_it_matters?: string | null; programming_guidance?: string | null; why_this_order?: string | null }>()
        for (const row of rows) map.set(row.entity_key, row)
        setPhaseEducation(map)
      })
      .catch(() => setPhaseEducation(new Map()))
  }, [])

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (workout.blocks.every((b) => b.items.length === 0)) {
        setValidation(null)
        return
      }
      try {
        const draft = {
          duration_minutes: workout.duration_minutes ?? workout.target_minutes,
          target_minutes: workout.target_minutes,
          blocks: workout.blocks.map((b) => ({
            label: b.label,
            phase_key: b.phase_key,
            phase_id: b.phase_id,
            rounds: b.rounds,
            rest_between_rounds_seconds: b.rest_between_rounds_seconds,
            block_format: b.block_format,
            programming_method_id: b.programming_method_id,
            programming_method_slug: b.programming_method_slug,
            quality_standard: b.quality_standard,
            stop_rules_json: b.stop_rules_json,
            work_seconds: b.work_seconds,
            rest_seconds: b.rest_seconds,
            cap_minutes: b.cap_minutes,
            station_count: b.station_count,
            density_target: b.density_target,
            scoring_mode: b.scoring_mode,
            items: b.items.map((it) => ({
              exercise_id: it.exercise_id,
              exercise_name: it.exercise_name,
              sets: it.sets,
              reps: it.reps,
              rest_seconds: it.rest_seconds,
              work_seconds: it.work_seconds,
              est_seconds_per_set: it.est_seconds_per_set,
            })),
          })),
        }
        const result = await coachFetch<ValidationResult>('/api/coach/workouts/validate', { method: 'POST', body: JSON.stringify(draft) })
        const progIssues: ValidationResult['warnings'] = []
        for (let i = 0; i < workout.blocks.length; i += 1) {
          const block = workout.blocks[i]
          if (!block.programming_method_id) continue
          try {
            const prog = await coachFetch<{ issues: Array<{ severity: string; message: string; ruleKey?: string }> }>(
              '/api/coach/workout-builder/validate-programming-block',
              {
                method: 'POST',
                body: JSON.stringify({
                  block: {
                    phase_key: block.phase_key,
                    programming_method_id: block.programming_method_id,
                    work_seconds: block.work_seconds,
                    rest_seconds: block.rest_seconds,
                    quality_standard: block.quality_standard,
                    items: block.items,
                  },
                }),
              },
            )
            for (const issue of prog.issues ?? []) {
              if (issue.severity === 'error' || issue.severity === 'strong_warning' || issue.severity === 'warning') {
                progIssues.push({
                  severity: issue.severity === 'error' ? 'error' : 'warning',
                  rule_key: issue.ruleKey ?? 'programming_block',
                  message: issue.message,
                })
              }
            }
          } catch {
            /* optional */
          }
        }
        if (progIssues.length > 0) {
          setValidation({
            ...result,
            warnings: [...(result.warnings ?? []), ...progIssues.filter((w) => w.severity === 'warning')],
            errors: [...(result.errors ?? []), ...progIssues.filter((w) => w.severity === 'error')],
            status: progIssues.some((w) => w.severity === 'error') ? 'error' : result.status,
          })
        } else {
          setValidation(result)
        }
      } catch {
        setValidation(null)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [workout.blocks, workout.target_minutes, workout.duration_minutes, setValidation])

  const save = async (force = false) => {
    if (validation?.errors?.length && !force) {
      setError('Fix validation errors before saving.')
      return
    }
    if (validation?.warnings?.length && !force && !overrideReason.trim()) {
      setShowOverride(true)
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        ...workout,
        type: workout.type || defaultType,
        validation_snapshot_json: validation ?? undefined,
        validation_override_reason: overrideReason || null,
      }
      const body = JSON.stringify(payload)
      const result = workout.id
        ? await coachFetch<Workout>(`/api/coach/workouts/${workout.id}`, { method: 'PUT', body })
        : await coachFetch<Workout>('/api/coach/workouts', { method: 'POST', body })
      setWorkout(result)
      setShowOverride(false)
      setMessage('Saved.')
      void loadSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workout')
    } finally {
      setSaving(false)
    }
  }

  const openPreview = async (id?: number) => {
    if (!id) return
    setPreviewLoading(true)
    setError(null)
    try {
      const data = await coachFetch<Workout>(`/api/coach/workouts/${id}`)
      setPreviewWorkout(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open workout')
    } finally {
      setPreviewLoading(false)
    }
  }

  const loadIntoBuilder = (workout: Workout) => {
    setWorkout(workout)
    setPreviewWorkout(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 capitalize">{defaultType} Builder</h2>
          <p className="text-sm text-gray-500">Assemble blocks and exercises; the clock updates live.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black text-white rounded-lg px-4 py-2">
            <Clock className="w-4 h-4 text-vortex-red" />
            <span className="font-bold text-lg">{fmt(totalSeconds)}</span>
            {workout.target_minutes ? <span className="text-xs text-gray-300">/ {workout.target_minutes}m target</span> : null}
          </div>
          <button type="button" onClick={() => reset(defaultType)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">New</button>
          {defaultType === 'workout' && (
            <button type="button" onClick={() => setShowWizard(true)} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm">
              <Sparkles className="w-4 h-4 text-vortex-red" /> Setup
            </button>
          )}
          <button type="button" onClick={() => void save()} disabled={saving || !workout.title} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {message && <div className="rounded-lg bg-green-50 text-green-700 px-4 py-2 text-sm">{message}</div>}

      {validation && validation.status !== 'valid' && (
        <div className={`rounded-lg px-4 py-3 text-sm ${validation.errors.length ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
          <div className="flex items-center gap-2 font-semibold mb-2"><AlertTriangle className="w-4 h-4" /> Validation: {validationStatusLabel(validation)}</div>
          <ul className="space-y-2">
            {allValidationIssues(validation).slice(0, 6).map((issue, i) => (
              <li key={i}>
                <div>{issue.message}</div>
                {issue.why && <div className="text-xs opacity-80 mt-0.5">{issue.why}</div>}
                {issue.recommendation && <div className="text-xs font-medium mt-0.5">{issue.recommendation}</div>}
              </li>
            ))}
          </ul>
          {validation.time?.budget_minutes != null && (
            <div className="text-xs mt-2 opacity-80">
              Time: {Number(validation.time.planned_minutes ?? 0)} min planned / {Number(validation.time.budget_minutes)} min budget
            </div>
          )}
        </div>
      )}

      {wizardComplete && workout.phase_plan_json && workout.phase_plan_json.length > 0 && (
        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          Phase canvas active — blocks follow the session setup plan. Use Setup to reconfigure.
        </div>
      )}

      {workout.session_objective && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Session objective</div>
          <p className="text-gray-800">{workout.session_objective}</p>
          {workout.coach_rationale_json?.session_why && <p className="text-gray-600 mt-2 text-xs">{workout.coach_rationale_json.session_why}</p>}
        </div>
      )}

      {(workout.audience_splits_json?.length ?? 0) > 0 && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm">
          <div className="text-xs font-semibold text-purple-900 uppercase mb-1">Age splits</div>
          <ul className="space-y-1 text-xs text-purple-800">
            {workout.audience_splits_json!.map((split) => (
              <li key={split.label}>
                <span className="font-medium">{split.label}</span>
                {' '}(ages {split.ageMin}-{split.ageMax})
                {split.difficultyOverride != null ? ` · cap ${split.difficultyOverride}/10` : ''}
              </li>
            ))}
          </ul>
          <p className="text-xs text-purple-700 mt-2">Each exercise below can show a different variant per group.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm md:col-span-2">
              <span className="block font-semibold text-gray-700 mb-1">Title</span>
              <input value={workout.title} onChange={(e) => patchWorkout({ title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder={`${defaultType} name`} />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Sport</span>
              <select value={workout.sport_id ?? ''} onChange={(e) => patchWorkout({ sport_id: e.target.value ? Number(e.target.value) : null })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Universal</option>
                {taxonomy?.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Target minutes</span>
              <input type="number" value={workout.target_minutes ?? ''} onChange={(e) => patchWorkout({ target_minutes: e.target.value ? Number(e.target.value) : null })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
          </div>

          {workout.blocks.map((block, bi) => (
            <div key={bi} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    value={block.label ?? ''}
                    onChange={(e) => updateBlock(bi, { label: e.target.value })}
                    className="font-semibold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-vortex-red outline-none"
                    placeholder="Block label"
                  />
                  {block.phase_key && (
                    <span className="text-[11px] bg-gray-100 text-gray-700 rounded px-2 py-0.5">{phaseName.get(block.phase_key) ?? block.phase_key}</span>
                  )}
                  {block.programming_method_name && (
                    <span className="text-[11px] bg-indigo-50 text-indigo-800 rounded px-2 py-0.5">{block.programming_method_name}</span>
                  )}
                  {block.minutes_budget != null && (
                    <span className="text-[11px] text-gray-500">{Math.round(blockSeconds(block) / 60)}m / {block.minutes_budget}m budget</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <select
                    value={block.phase_key ?? ''}
                    onChange={(e) => {
                      const key = e.target.value || null
                      const phase = taxonomy?.sessionPhases?.find((p) => p.key === key)
                      updateBlock(bi, { phase_key: key, phase_id: phase?.id ?? null, label: block.label || phase?.name || block.label })
                    }}
                    className="border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="">No phase</option>
                    {taxonomy?.sessionPhases?.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                  </select>
                  <select
                    value={block.programming_method_id ?? ''}
                    onChange={(e) => void selectProgrammingMethod(bi, e.target.value ? Number(e.target.value) : null)}
                    className="border border-gray-300 rounded px-2 py-1 max-w-[160px]"
                    title="Programming method"
                  >
                    <option value="">No format</option>
                    {methodsForPhase(block.phase_key).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <select value={block.block_format} onChange={(e) => updateBlock(bi, { block_format: e.target.value as BlockFormat })} className="border border-gray-300 rounded px-2 py-1">
                    <option value="straight_sets">Straight Sets</option>
                    <option value="circuit">Circuit</option>
                    <option value="amrap">AMRAP</option>
                    <option value="emom">EMOM</option>
                    <option value="for_time">For Time</option>
                    <option value="stations">Stations</option>
                  </select>
                  <label className="flex items-center gap-1">Rounds
                    <input type="number" value={block.rounds} min={1} onChange={(e) => updateBlock(bi, { rounds: Number(e.target.value) || 1 })} className="w-14 border border-gray-300 rounded px-2 py-1" />
                  </label>
                  <span className="text-gray-500">{fmt(blockSeconds(block))}</span>
                  <button type="button" onClick={() => removeBlock(bi)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              {block.phase_key && (
                <button type="button" onClick={() => setOpenPhaseEdu(openPhaseEdu === bi ? null : bi)} className="mt-2 flex items-center gap-1 text-xs text-vortex-red">
                  {openPhaseEdu === bi ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Why this phase
                </button>
              )}
              {openPhaseEdu === bi && block.phase_key && (
                <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 space-y-1">
                  {phaseEducation.get(block.phase_key)?.short_summary && (
                    <p>{phaseEducation.get(block.phase_key)?.short_summary}</p>
                  )}
                  {phaseEducation.get(block.phase_key)?.why_it_matters && (
                    <p><span className="font-semibold">Why it matters:</span> {phaseEducation.get(block.phase_key)?.why_it_matters}</p>
                  )}
                  {phaseEducation.get(block.phase_key)?.programming_guidance && (
                    <p><span className="font-semibold">Programming:</span> {phaseEducation.get(block.phase_key)?.programming_guidance}</p>
                  )}
                  {!phaseEducation.get(block.phase_key) && (
                    <p>{workout.coach_rationale_json?.order_why ?? `Exercises in ${phaseName.get(block.phase_key) ?? block.phase_key} should match freshness and phase fit for this slot in the session.`}</p>
                  )}
                </div>
              )}

              {(block.work_seconds != null || block.rest_seconds != null || block.quality_standard) && (
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  {(block.work_seconds != null || block.rest_seconds != null) && (
                    <div>
                      Work/rest: {block.work_seconds ?? '—'}s / {block.rest_seconds ?? '—'}s
                      {block.cap_minutes != null ? ` · ${block.cap_minutes}m cap` : ''}
                    </div>
                  )}
                  {block.quality_standard && <div>Quality: {block.quality_standard}</div>}
                </div>
              )}

              <div className="mt-3 space-y-2">
                {block.items.map((item, ii) => (
                  <div
                    key={ii}
                    draggable
                    onDragStart={() => setDrag({ block: bi, index: ii })}
                    onDragOver={(e) => { if (drag && drag.block === bi) e.preventDefault() }}
                    onDrop={(e) => { e.preventDefault(); if (drag && drag.block === bi) reorderItem(bi, drag.index, ii); setDrag(null) }}
                    onDragEnd={() => setDrag(null)}
                    className={`grid grid-cols-[16px_1fr_repeat(3,56px)_auto] gap-2 items-center text-sm rounded ${drag && drag.block === bi && drag.index === ii ? 'opacity-50' : ''}`}
                  >
                    <span className="cursor-grab text-gray-300 hover:text-gray-500" title="Drag to reorder"><GripVertical className="w-4 h-4" /></span>
                    <div className="font-medium text-gray-800 truncate">{item.exercise_name ?? 'Exercise'}</div>
                    <input type="number" value={item.sets ?? ''} placeholder="sets" onChange={(e) => updateItem(bi, ii, { sets: e.target.value ? Number(e.target.value) : null })} className="border border-gray-300 rounded px-2 py-1" />
                    <input type="number" value={item.reps ?? ''} placeholder="reps" onChange={(e) => updateItem(bi, ii, { reps: e.target.value ? Number(e.target.value) : null })} className="border border-gray-300 rounded px-2 py-1" />
                    <input type="number" value={item.rest_seconds ?? ''} placeholder="rest" onChange={(e) => updateItem(bi, ii, { rest_seconds: e.target.value ? Number(e.target.value) : null })} className="border border-gray-300 rounded px-2 py-1" />
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveItem(bi, ii, -1)} className="text-gray-300 hover:text-gray-700"><ChevronUp className="w-4 h-4" /></button>
                      <button type="button" onClick={() => moveItem(bi, ii, 1)} className="text-gray-300 hover:text-gray-700"><ChevronDown className="w-4 h-4" /></button>
                      <button type="button" onClick={() => removeItem(bi, ii)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    {splitVariantsForItem(item).length > 0 && (
                      <div className="col-span-full mt-1 space-y-1">
                        {splitVariantsForItem(item).map((variant) => (
                          <div key={variant.split_label} className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-medium text-gray-600">{variant.split_label}:</span>
                            <span className="text-gray-800">{variant.exercise_name}</span>
                            <span className={`rounded-full px-2 py-0.5 ${splitVariantTone(variant)}`}>{splitVariantLabel(variant)}</span>
                            {variant.scaling_guidance && <span className="text-gray-500">{variant.scaling_guidance}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setPickerBlock(bi)} className="flex items-center gap-1 text-sm text-vortex-red font-medium mt-1">
                  <Plus className="w-4 h-4" /> Add exercise
                </button>
              </div>
            </div>
          ))}

          {!wizardComplete && (
          <button type="button" onClick={addBlock} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:border-vortex-red hover:text-vortex-red">
            <Plus className="w-4 h-4" /> Add block
          </button>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 h-fit">
          <div className="flex items-center gap-2 font-semibold text-gray-700 mb-2"><FolderOpen className="w-4 h-4" /> Saved {defaultType}s</div>
          <div className="flex items-center gap-2 mb-2 text-xs">
            <input type="number" value={minMinutes} onChange={(e) => setMinMinutes(e.target.value ? Number(e.target.value) : '')} placeholder="min" className="w-16 border border-gray-300 rounded px-2 py-1" />
            <span className="text-gray-400">-</span>
            <input type="number" value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value ? Number(e.target.value) : '')} placeholder="max" className="w-16 border border-gray-300 rounded px-2 py-1" />
            <span className="text-gray-400">min</span>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {saved.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => void openPreview(w.id)}
                className="w-full text-left border border-gray-100 rounded-lg px-3 py-2.5 hover:bg-gray-50 hover:border-gray-200 transition-colors"
              >
                <div className="font-medium text-gray-800">{w.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {w.sport_name ?? 'Universal'} · {w.computed_minutes ?? 0} min
                </div>
              </button>
            ))}
            {saved.length === 0 && <div className="text-sm text-gray-500">None saved yet.</div>}
          </div>
        </div>
      </div>

      {previewLoading && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl px-5 py-4 flex items-center gap-2 text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading workout...
          </div>
        </div>
      )}

      {previewWorkout && (
        <WorkoutPreviewModal
          workout={previewWorkout}
          onClose={() => setPreviewWorkout(null)}
          onEdit={() => loadIntoBuilder(previewWorkout)}
        />
      )}

      {pickerBlock !== null && (
        <ExercisePicker
          phaseKey={workout.blocks[pickerBlock]?.phase_key ?? null}
          programmingCompat={programmingCompatByBlock.get(pickerBlock) ?? null}
          onClose={() => setPickerBlock(null)}
          onPick={(ex) => {
            addItem(pickerBlock, {
              exercise_id: ex.id,
              exercise_name: ex.name,
              sets: ex.default_sets ?? 3,
              reps: ex.default_reps ?? null,
              rest_seconds: ex.default_rest_seconds ?? 30,
              work_seconds: ex.default_work_seconds ?? null,
              est_seconds_per_set: ex.est_seconds_per_set,
            })
            setPickerBlock(null)
          }}
        />
      )}

      {showWizard && (
        <WorkoutSetupWizard
          workout={workout}
          onClose={() => setShowWizard(false)}
          onApply={(patch) => {
            patchWorkout(patch)
            if (patch.phase_plan_json?.length) applyPhasePlan(patch.phase_plan_json)
          }}
          onComplete={() => {
            setWizardComplete(true)
            setShowWizard(false)
          }}
        />
      )}

      {showOverride && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-bold text-lg">Override validation warnings</h3>
            <p className="text-sm text-gray-600">Explain why you are keeping this order despite warnings.</p>
            <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowOverride(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
              <button type="button" disabled={!overrideReason.trim()} onClick={() => void save(true)} className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-50">Save with override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WorkoutPreviewModal({
  workout,
  onClose,
  onEdit,
}: {
  workout: Workout
  onClose: () => void
  onEdit: () => void
}) {
  const totalSeconds = workoutSeconds(workout)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{workout.title}</h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
              <span className="capitalize">{workout.type}</span>
              <span>{workout.sport_name ?? 'Universal'}</span>
              <span>{fmt(totalSeconds)} total</span>
              {workout.computed_minutes != null && <span>{workout.computed_minutes} min computed</span>}
              {workout.target_minutes != null && <span>{workout.target_minutes} min target</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {workout.description && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{workout.description}</p>
            </div>
          )}
          {workout.notes && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{workout.notes}</p>
            </div>
          )}
          {workout.coach_rationale_json && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase">Coach rationale</div>
              {workout.coach_rationale_json.session_why && <p><span className="font-semibold">Session:</span> {workout.coach_rationale_json.session_why}</p>}
              {workout.coach_rationale_json.order_why && <p><span className="font-semibold">Order:</span> {workout.coach_rationale_json.order_why}</p>}
              {(workout.coach_rationale_json.watch_points ?? []).map((w, i) => (
                <p key={i} className="text-amber-800">Watch: {w}</p>
              ))}
            </div>
          )}

          {workout.blocks.map((block, bi) => (
            <div key={block.id ?? bi} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="font-semibold text-gray-900">{block.label || `Block ${bi + 1}`}</div>
                <span className="text-xs text-gray-500">{fmt(blockSeconds(block))}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                <span>{BLOCK_FORMAT_LABELS[block.block_format] ?? block.block_format}</span>
                {block.programming_method_name && <span>{block.programming_method_name}</span>}
                <span>{block.rounds} round{block.rounds === 1 ? '' : 's'}</span>
                {block.rest_between_rounds_seconds > 0 && (
                  <span>{block.rest_between_rounds_seconds}s rest between rounds</span>
                )}
                {block.cap_minutes != null && <span>{block.cap_minutes} min cap</span>}
                {(block.work_seconds != null || block.rest_seconds != null) && (
                  <span>{block.work_seconds ?? '—'}s work / {block.rest_seconds ?? '—'}s rest</span>
                )}
              </div>
              {block.quality_standard && (
                <p className="text-xs text-gray-600 mt-2">Quality standard: {block.quality_standard}</p>
              )}
              {(block.stop_rules_json ?? []).length > 0 && (
                <ul className="text-xs text-amber-800 mt-1 list-disc pl-4">
                  {(block.stop_rules_json ?? []).slice(0, 3).map((rule) => <li key={rule}>{rule}</li>)}
                </ul>
              )}
              <ul className="mt-3 space-y-2">
                {block.items.map((item, ii) => (
                  <li key={item.id ?? ii} className="text-sm border-t border-gray-100 first:border-t-0 first:pt-0 pt-2">
                    <div className="font-medium text-gray-800">{item.exercise_name ?? 'Exercise'}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                      {item.sets != null && <span>{item.sets} sets</span>}
                      {item.reps != null && <span>{item.reps} reps</span>}
                      {item.work_seconds != null && <span>{item.work_seconds}s work</span>}
                      {item.rest_seconds != null && <span>{item.rest_seconds}s rest</span>}
                      {item.load && <span>Load: {item.load}</span>}
                      {item.tempo && <span>Tempo: {item.tempo}</span>}
                    </div>
                    {splitVariantsForItem(item).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {splitVariantsForItem(item).map((variant) => (
                          <div key={variant.split_label} className="text-xs flex flex-wrap gap-2">
                            <span className="font-medium text-purple-800">{variant.split_label}:</span>
                            <span>{variant.exercise_name}</span>
                            <span className={`rounded-full px-2 py-0.5 ${splitVariantTone(variant)}`}>{splitVariantLabel(variant)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {item.coaching_note && (
                      <p className="text-xs text-gray-600 mt-1 italic">{item.coaching_note}</p>
                    )}
                  </li>
                ))}
                {block.items.length === 0 && <li className="text-xs text-gray-400">No exercises in this block.</li>}
              </ul>
            </div>
          ))}
          {workout.blocks.length === 0 && <div className="text-sm text-gray-500">This workout has no blocks yet.</div>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">
            Close
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold"
          >
            <Pencil className="w-4 h-4" /> Edit in Builder
          </button>
        </div>
      </div>
    </div>
  )
}

function ExercisePicker({
  phaseKey,
  programmingCompat,
  onClose,
  onPick,
}: {
  phaseKey?: string | null
  programmingCompat?: ReturnType<typeof parseExerciseCompatibility> | null
  onClose: () => void
  onPick: (ex: Exercise) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'ideal' | 'all'>('ideal')
  const [progMode, setProgMode] = useState<'compatible' | 'all'>(programmingCompat ? 'compatible' : 'all')
  const [subroleFilter, setSubroleFilter] = useState<string>('')
  const [slotFilter, setSlotFilter] = useState<string>('')
  const { taxonomy } = useTaxonomy()
  const prepareSubroles = phaseKey === 'prepare_and_access' ? prepareAccessSubroleSequence(taxonomy) : []
  const slotOptions = phaseKey === 'prepare_and_access' && subroleFilter
    ? orderSlotsForSubrole(taxonomy, 'prepare_and_access', subroleFilter)
    : []
  const tenetName = useMemo(() => {
    const map = new Map<number, string>()
    taxonomy?.tenets.forEach((t) => {
      if (t.id != null) map.set(Number(t.id), t.name)
    })
    return map
  }, [taxonomy])

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q })
        if (phaseKey === 'prepare_and_access' && subroleFilter) params.set('subrole', subroleFilter)
        if (slotFilter) params.set('order_slot', slotFilter)
        const data = await coachFetch<CoachLibraryPage<Exercise>>(`/api/coach/exercises?${params.toString()}`)
        const filtered = phaseKey && mode === 'ideal'
          ? data.items.filter((ex) => {
              const fit = phaseFitBadge(ex, phaseKey)
              return fit === 'strong' || fit === 'conditional'
            })
          : data.items
        const progFiltered = programmingCompat && progMode === 'compatible'
          ? filtered.filter((ex) => {
              const fit = programmingExerciseFit(ex, programmingCompat)
              return fit === 'compatible' || fit === 'conditional'
            })
          : filtered
        setResults(progFiltered.length > 0 || !phaseKey || mode === 'all' ? progFiltered : filtered)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [q, phaseKey, mode, progMode, programmingCompat, subroleFilter, slotFilter])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 space-y-2">
          {programmingCompat && (
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => setProgMode('compatible')} className={`rounded-full px-2 py-1 ${progMode === 'compatible' ? 'bg-indigo-600 text-white' : 'border border-gray-200'}`}>Compatible only</button>
              <button type="button" onClick={() => setProgMode('all')} className={`rounded-full px-2 py-1 ${progMode === 'all' ? 'bg-indigo-600 text-white' : 'border border-gray-200'}`}>All exercises</button>
            </div>
          )}
          {phaseKey && (
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => setMode('ideal')} className={`rounded-full px-2 py-1 ${mode === 'ideal' ? 'bg-vortex-red text-white' : 'border border-gray-200'}`}>Ideal / conditional</button>
              <button type="button" onClick={() => setMode('all')} className={`rounded-full px-2 py-1 ${mode === 'all' ? 'bg-vortex-red text-white' : 'border border-gray-200'}`}>All (with warnings)</button>
            </div>
          )}
          {phaseKey === 'prepare_and_access' && prepareSubroles.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => { setSubroleFilter(''); setSlotFilter('') }} className={`rounded-full px-2 py-1 text-xs ${!subroleFilter ? 'bg-vortex-red text-white' : 'border border-gray-200'}`}>All</button>
                {prepareSubroles.map((sr) => (
                  <button key={sr.key} type="button" onClick={() => { setSubroleFilter(sr.key); setSlotFilter('') }} className={`rounded-full px-2 py-1 text-xs ${subroleFilter === sr.key ? 'bg-vortex-red text-white' : 'border border-gray-200'}`}>{sr.name}</button>
                ))}
              </div>
              {subroleFilter && slotOptions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => setSlotFilter('')} className={`rounded-full px-2 py-0.5 text-[10px] ${!slotFilter ? 'bg-gray-800 text-white' : 'border border-gray-200'}`}>All slots</button>
                  {slotOptions.map((s) => (
                    <button key={s.key} type="button" onClick={() => setSlotFilter(s.key)} className={`rounded-full px-2 py-0.5 text-[10px] ${slotFilter === s.key ? 'bg-gray-800 text-white' : 'border border-gray-200'}`}>{s.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises..." className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm" />
          </div>
        </div>
        <div className="overflow-y-auto p-2">
          {loading && <div className="flex items-center gap-2 text-gray-500 text-sm p-3"><Loader2 className="w-4 h-4 animate-spin" /> Searching...</div>}
          {results.map((ex) => {
            const fit = phaseKey ? phaseFitBadge(ex, phaseKey) : null
            const progFit: ProgrammingExerciseFit | null = programmingCompat ? programmingExerciseFit(ex, programmingCompat) : null
            const tenets = exerciseTenetLabels(ex, tenetName)
            const identityBits = phaseKey === 'prepare_and_access'
              ? exerciseSubroleAndSlotLine(ex, taxonomy)
              : [movementFamilyLabel(ex.movement_family), phaseSubroleLabel(ex.phase_subrole)].filter(Boolean).join(' · ')
            return (
              <button key={ex.id} type="button" onClick={() => onPick(ex)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-gray-800">{ex.name}</div>
                  {fit && fit !== 'unknown' && (
                    <span className={`text-[10px] rounded px-1.5 py-0.5 ${fit === 'strong' ? 'bg-green-50 text-green-700' : fit === 'avoid' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                      {fit === 'strong' ? 'Strong fit' : fit === 'avoid' ? 'Poor fit' : 'Conditional'}
                    </span>
                  )}
                  {progFit && progFit !== 'unknown' && (
                    <span className={`text-[10px] rounded px-1.5 py-0.5 ${progFit === 'compatible' ? 'bg-indigo-50 text-indigo-700' : progFit === 'avoid' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                      {progFit === 'compatible' ? 'Format OK' : progFit === 'avoid' ? 'Avoid in format' : 'Format conditional'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-700 mt-1 line-clamp-2">{exerciseFitnessGoal(ex, tenetName)}</div>
                {identityBits && <div className="text-[10px] text-gray-500 mt-0.5">{identityBits}</div>}
                <div className="text-[11px] text-gray-500 mt-1">
                  {ex.sport_name ?? 'Universal'} · {exerciseDosageLabel(ex)}
                  {tenets.length > 0 ? ` · ${tenets.slice(0, 2).join(', ')}` : ''}
                </div>
              </button>
            )
          })}
          {!loading && results.length === 0 && <div className="text-sm text-gray-500 p-3">No matches.</div>}
        </div>
        <div className="p-3 border-t border-gray-100 text-right">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Close</button>
        </div>
      </div>
    </div>
  )
}
