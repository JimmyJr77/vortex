import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles, Plus, Trash2, ArrowRight, Save } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import { useCoachBuilderStore } from '../../coach/useCoachBuilderStore'
import {
  buildPhasePlan,
  redistributeOnDelete,
  defaultPhaseRows,
  PREPARE_PINNED_MINUTES,
  type WorkMode,
  type NeedsEnginePhaseRow,
  type FocusFacetType,
  type OtherPhaseKind,
} from '../../coach/phaseArchitect'
import { SESSION_OBJECTIVE_OPTIONS, type SessionObjective } from '../../coach/phasePlan'
import { standardDifficultyCap, suggestedDifficultyCap } from '../../coach/ageDifficultyPolicy'
import type {
  AudienceSplit,
  CoachPhaseTemplate,
  PrescriptionResult,
  ProgrammingMethod,
  SessionPhaseTemplate,
  Workout,
  WorkoutBlock,
  PhaseFocusTarget,
} from '../../coach/types'
import { applyProgrammingMethodDefaults } from '../../coach/programmingBlockDefaults'
import SmartCombobox, { type ComboboxOption } from './SmartCombobox'

const FOCUS_LABELS: Record<FocusFacetType, string> = {
  tenet: 'Tenet',
  methodology: 'Methodology',
  physiology: 'Physiology',
  order_slot: 'Movement Slot',
}

const OTHER_KIND_LABELS: Record<OtherPhaseKind, string> = {
  skills: 'Skills',
  games: 'Games',
  tramp_tumble: 'Tramp & Tumble',
}

interface PhaseRowUi extends NeedsEnginePhaseRow {
  focusFacetType?: FocusFacetType | ''
}

function phaseName(taxonomy: ReturnType<typeof useTaxonomy>['taxonomy'], phaseKey: string) {
  if (phaseKey === 'other') return 'Other'
  return taxonomy?.sessionPhases?.find((p) => p.key === phaseKey)?.name ?? phaseKey
}

function rowsWithLabels(rows: NeedsEnginePhaseRow[], taxonomy: ReturnType<typeof useTaxonomy>['taxonomy']): PhaseRowUi[] {
  return rows.map((r) => ({
    ...r,
    label: r.label ?? (r.phaseKey === 'other'
      ? OTHER_KIND_LABELS[r.otherKind ?? 'skills']
      : phaseName(taxonomy, r.phaseKey)),
    focusFacetType: r.focusTargets?.[0]?.facetType ?? '',
  }))
}

function nearestDurationKey(minutes: number) {
  if (minutes <= 75) return 60
  if (minutes <= 105) return 90
  return 120
}

export default function NeedsEnginePanel({ onSendToBuilder }: { onSendToBuilder?: () => void }) {
  const { taxonomy } = useTaxonomy()
  const { setWorkout, setWizardComplete } = useCoachBuilderStore()

  const [workMode, setWorkMode] = useState<WorkMode>('exercise')
  const [sessionObjective, setSessionObjective] = useState<SessionObjective>('general_athletic_development')
  const [sessionMinutes, setSessionMinutes] = useState(60)
  const [customMinutes, setCustomMinutes] = useState<number | ''>('')
  const [sportId, setSportId] = useState<number | ''>('')
  const [skillLevel, setSkillLevel] = useState('')
  const [ageMin, setAgeMin] = useState<number | ''>('')
  const [ageMax, setAgeMax] = useState<number | ''>('')
  const [difficultyOverride, setDifficultyOverride] = useState<number | ''>('')
  const [audienceSplits, setAudienceSplits] = useState<AudienceSplit[]>([])
  const [equipmentMode, setEquipmentMode] = useState<'use' | 'avoid'>('use')
  const [equipmentUse, setEquipmentUse] = useState<ComboboxOption[]>([])
  const [equipmentAvoid, setEquipmentAvoid] = useState<ComboboxOption[]>([])
  const [avoidTokens, setAvoidTokens] = useState<ComboboxOption[]>([])
  const [avoidSearchOptions, setAvoidSearchOptions] = useState<ComboboxOption[]>([])
  const [phaseRows, setPhaseRows] = useState<PhaseRowUi[]>(() => rowsWithLabels(defaultPhaseRows(60) as NeedsEnginePhaseRow[], null))
  const [userEditedPrepare, setUserEditedPrepare] = useState(false)
  const [architectAdjustments, setArchitectAdjustments] = useState<string[]>([])
  const [systemTemplates, setSystemTemplates] = useState<SessionPhaseTemplate[]>([])
  const [savedTemplates, setSavedTemplates] = useState<CoachPhaseTemplate[]>([])
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('')
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [skillOptions, setSkillOptions] = useState<ComboboxOption[]>([])
  const [gameOptions, setGameOptions] = useState<ComboboxOption[]>([])
  const [result, setResult] = useState<PrescriptionResult | null>(null)
  const [blockProgramming, setBlockProgramming] = useState<(ProgrammingMethod | null)[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nlPrompt, setNlPrompt] = useState('')
  const [nlLoading, setNlLoading] = useState(false)

  const effectiveMinutes = customMinutes !== '' ? Number(customMinutes) : sessionMinutes
  const ageMinNum = ageMin === '' ? null : Number(ageMin)
  const ageMaxNum = ageMax === '' ? null : Number(ageMax)
  const canApplyPlan = workMode && effectiveMinutes > 0 && (ageMinNum != null || ageMaxNum != null)

  const standardCap = standardDifficultyCap(ageMinNum, ageMaxNum, difficultyOverride === '' ? null : Number(difficultyOverride))

  const equipmentOptions = useMemo<ComboboxOption[]>(
    () => (taxonomy?.equipment ?? []).map((eq) => ({ id: eq.id, label: eq.name })),
    [taxonomy?.equipment],
  )

  const bodyRegionOptions = useMemo<ComboboxOption[]>(
    () => (taxonomy?.bodyRegions ?? []).map((br) => ({ id: `br:${br.id}`, label: br.name, meta: 'body region' })),
    [taxonomy?.bodyRegions],
  )

  const focusOptionsFor = useCallback((facetType: FocusFacetType | '', phaseKey: string): ComboboxOption[] => {
    if (!facetType || !taxonomy) return []
    if (facetType === 'tenet') return (taxonomy.tenets ?? []).map((t) => ({ id: t.id!, label: t.name }))
    if (facetType === 'methodology') return (taxonomy.methodologies ?? []).map((t) => ({ id: t.id!, label: t.name }))
    if (facetType === 'physiology') return (taxonomy.physiology ?? []).map((t) => ({ id: t.id!, label: t.name }))
    if (facetType === 'order_slot') {
      return (taxonomy.phaseOrderSlots ?? [])
        .filter((s) => !phaseKey || phaseKey === 'other' || s.phase_key === phaseKey)
        .map((s) => ({ id: s.id, label: s.name, meta: s.phase_key }))
    }
    return []
  }, [taxonomy])

  const loadTemplates = useCallback(async () => {
    try {
      const [system, saved] = await Promise.all([
        coachFetch<SessionPhaseTemplate[]>('/api/coach/session-templates'),
        coachFetch<CoachPhaseTemplate[]>('/api/coach/phase-templates'),
      ])
      setSystemTemplates(system)
      setSavedTemplates(saved)
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    if (!taxonomy) return
    setPhaseRows((rows) => rowsWithLabels(rows, taxonomy))
  }, [taxonomy])

  useEffect(() => {
    void coachFetch<Array<{ id: number; name: string }>>('/api/coach/skills')
      .then((rows) => setSkillOptions(rows.map((s) => ({ id: s.id, label: s.name }))))
      .catch(() => {})
    void coachFetch<Array<{ id: number; name: string }>>('/api/coach/games')
      .then((rows) => setGameOptions(rows.map((g) => ({ id: g.id, label: g.name }))))
      .catch(() => {})
  }, [])

  const searchAvoidOptions = useCallback(async (query: string) => {
    const base = bodyRegionOptions
    if (!query.trim()) {
      setAvoidSearchOptions(base)
      return
    }
    try {
      const exercises = await coachFetch<{ items: Array<{ id: number; name: string; slug?: string }> }>(
        `/api/coach/exercises?q=${encodeURIComponent(query.trim())}`,
      )
      setAvoidSearchOptions([
        ...base,
        ...exercises.items.slice(0, 20).map((e) => ({ id: `eq:${e.id}`, label: e.name, meta: e.slug ?? 'exercise' })),
      ])
    } catch {
      setAvoidSearchOptions(base)
    }
  }, [bodyRegionOptions])

  useEffect(() => {
    void searchAvoidOptions('')
  }, [searchAvoidOptions])

  const applyObjectivePlan = () => {
    const { plan, adjustments } = buildPhasePlan({
      workMode,
      sessionObjective,
      durationMinutes: effectiveMinutes,
      ageMin: ageMinNum,
      ageMax: ageMaxNum,
      existingRows: phaseRows,
      userEditedPrepare,
    })
    setPhaseRows(rowsWithLabels(plan as NeedsEnginePhaseRow[], taxonomy))
    setArchitectAdjustments(adjustments)
  }

  const loadTemplatePlan = (key: string) => {
    setSelectedTemplateKey(key)
    if (!key) return
    if (key.startsWith('sys:')) {
      const tpl = systemTemplates.find((t) => `sys:${t.key}` === key)
      if (tpl?.phase_plan?.length) {
        setPhaseRows(rowsWithLabels(tpl.phase_plan.map((p) => ({
          phaseKey: p.phaseKey,
          minutes: p.minutes,
          label: p.label,
        })), taxonomy))
      }
      return
    }
    if (key.startsWith('coach:')) {
      const tpl = savedTemplates.find((t) => `coach:${t.id}` === key)
      if (tpl?.phase_plan?.length) {
        setPhaseRows(rowsWithLabels(tpl.phase_plan, taxonomy))
      }
    }
  }

  const savePhasing = async () => {
    const name = saveTemplateName.trim()
    if (!name) return
    try {
      await coachFetch('/api/coach/phase-templates', {
        method: 'POST',
        body: JSON.stringify({ name, phase_plan_json: phaseRows.map(({ focusFacetType: _, ...row }) => row) }),
      })
      setSaveModalOpen(false)
      setSaveTemplateName('')
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save phasing')
    }
  }

  const updateRow = (index: number, patch: Partial<PhaseRowUi>) => {
    setPhaseRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const deleteRow = (index: number) => {
    const deleted = phaseRows[index]
    if (!deleted) return
    const durKey = nearestDurationKey(effectiveMinutes)
    const pinned = PREPARE_PINNED_MINUTES[durKey] ?? 7
    const next = redistributeOnDelete(phaseRows, deleted.phaseKey, effectiveMinutes, pinned)
    setPhaseRows(rowsWithLabels(next as NeedsEnginePhaseRow[], taxonomy))
  }

  const insertPhaseRowAfter = (index: number) => {
    const newRow: PhaseRowUi = {
      phaseKey: 'capacity',
      minutes: 15,
      label: phaseName(taxonomy, 'capacity'),
      focusFacetType: '',
      focusTargets: [],
    }
    setPhaseRows((rows) => [
      ...rows.slice(0, index + 1),
      newRow,
      ...rows.slice(index + 1),
    ])
  }

  const updateSplit = (index: number, patch: Partial<AudienceSplit>) => {
    setAudienceSplits((splits) => splits.map((s, j) => {
      if (j !== index) return s
      const next = { ...s, ...patch }
      if ('ageMin' in patch || 'ageMax' in patch) {
        next.difficultyOverride = suggestedDifficultyCap(next.ageMin, next.ageMax)
      }
      return next
    }))
  }

  const updateSplitCap = (index: number, value: number | null) => {
    setAudienceSplits((splits) => splits.map((s, j) => (j === index ? { ...s, difficultyOverride: value } : s)))
  }

  const parseAvoidPayload = () => {
    const excludeBodyRegionIds: number[] = []
    const avoidExerciseIds: number[] = []
    const avoidExerciseSlugs: string[] = []
    for (const token of avoidTokens) {
      const id = String(token.id)
      if (id.startsWith('br:')) {
        excludeBodyRegionIds.push(Number(id.slice(3)))
      } else if (id.startsWith('eq:')) {
        avoidExerciseIds.push(Number(id.slice(3)))
      } else if (id.startsWith('custom:')) {
        avoidExerciseSlugs.push(id.slice(7))
      } else if (Number.isFinite(Number(token.id))) {
        avoidExerciseIds.push(Number(token.id))
      } else {
        avoidExerciseSlugs.push(token.label.toLowerCase().replace(/\s+/g, '-'))
      }
    }
    return { excludeBodyRegionIds, avoidExerciseIds, avoidExerciseSlugs }
  }

  const prescribe = async () => {
    if (result && !window.confirm('Replace the current prescription? The previous result will be overwritten.')) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const avoid = parseAvoidPayload()
      const capsOverride = difficultyOverride !== ''
        ? { maxOverall: Number(difficultyOverride), maxTechnical: Number(difficultyOverride), maxLoad: Number(difficultyOverride) }
        : null

      const body = {
        workMode,
        sportId: sportId || null,
        skillLevel: skillLevel || null,
        ageMin: ageMinNum,
        ageMax: ageMaxNum,
        capsOverride,
        audienceSplits: audienceSplits.map((s) => ({
          label: s.label,
          ageMin: s.ageMin,
          ageMax: s.ageMax,
          difficultyOverride: s.difficultyOverride ?? suggestedDifficultyCap(s.ageMin, s.ageMax),
        })),
        equipmentUseIds: equipmentUse.map((e) => Number(e.id)).filter(Number.isFinite),
        equipmentAvoidIds: equipmentAvoid.map((e) => Number(e.id)).filter(Number.isFinite),
        ...avoid,
        sessionObjective,
        durationMinutes: effectiveMinutes,
        phasePlan: phaseRows.map((r) => ({
          phaseKey: r.phaseKey,
          label: r.label,
          minutes: r.minutes,
          focusTargets: r.focusTargets ?? [],
          otherKind: r.otherKind,
          otherItemIds: r.otherItemIds ?? [],
          contains_tumbling: r.contains_tumbling,
          pinned: r.pinned,
        })),
      }
      const data = await coachFetch<PrescriptionResult>('/api/coach/needs-engine/prescribe', { method: 'POST', body: JSON.stringify(body) })
      setResult(data)
      if (data.audience_profile?.impliedSkillLevel && !skillLevel) {
        setSkillLevel(data.audience_profile.impliedSkillLevel)
      }
      const youth = ageMaxNum != null && ageMaxNum <= 14
      const progPicks = await Promise.all(
        phaseRows.map(async (b) => {
          if (b.phaseKey === 'other') return null
          try {
            const pick = await coachFetch<{ selected: ProgrammingMethod | null }>('/api/coach/needs-engine/prescribe-programming-method', {
              method: 'POST',
              body: JSON.stringify({
                phaseKey: b.phaseKey,
                youth,
                lowImpact: avoid.excludeBodyRegionIds.length > 0,
                groupSize: 12,
                desiredAdaptation: sessionObjective,
              }),
            })
            return pick.selected
          } catch {
            return null
          }
        }),
      )
      setBlockProgramming(progPicks)
    } catch (err) {
      const e = err as Error & { status?: number; details?: { unsatisfiable_equipment?: Array<{ name: string }> } }
      if (e.status === 422 && e.details?.unsatisfiable_equipment?.length) {
        setError(`No workout exists for that equipment: ${e.details.unsatisfiable_equipment.map((x) => x.name).join(', ')}`)
      } else {
        setError(e.message || 'Prescription failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const runNaturalLanguage = async () => {
    if (!nlPrompt.trim()) return
    setNlLoading(true)
    setError(null)
    try {
      const data = await coachFetch<PrescriptionResult & { parsed: Record<string, unknown> }>(
        '/api/coach/ai/nl-needs', { method: 'POST', body: JSON.stringify({ prompt: nlPrompt }) },
      )
      const p = data.parsed as {
        sportId?: number | null
        skillLevel?: string | null
        ageMin?: number | null
        ageMax?: number | null
        sessionObjective?: SessionObjective | null
        equipmentIds?: number[]
        blocks?: Array<{ label: string; phaseKey?: string; minutes: number }>
      }
      setSportId(p.sportId ?? '')
      setSkillLevel(p.skillLevel ?? '')
      if (p.ageMin != null) setAgeMin(p.ageMin)
      if (p.ageMax != null) setAgeMax(p.ageMax)
      if (p.sessionObjective) {
        setSessionObjective(p.sessionObjective)
        applyObjectivePlan()
      }
      if (Array.isArray(p.equipmentIds)) {
        setEquipmentUse(p.equipmentIds.map((id) => {
          const eq = taxonomy?.equipment?.find((e) => e.id === id)
          return { id, label: eq?.name ?? `Equipment ${id}` }
        }))
      }
      if (Array.isArray(p.blocks) && p.blocks.length > 0) {
        setPhaseRows(rowsWithLabels(p.blocks.map((b) => ({
          phaseKey: b.phaseKey ?? 'capacity',
          minutes: b.minutes,
          label: b.label,
        })), taxonomy))
      }
      setResult({
        blocks: data.blocks,
        candidates: data.candidates,
        audience_profile: data.audience_profile,
        age_fit_warnings: data.age_fit_warnings,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not interpret that request')
    } finally {
      setNlLoading(false)
    }
  }

  const sendToBuilder = () => {
    if (!result) return
    const plan = phaseRows.map((b) => ({
      phaseKey: b.phaseKey,
      minutes: b.minutes,
      label: b.label,
      focusTargets: b.focusTargets,
      otherKind: b.otherKind,
      otherItemIds: b.otherItemIds,
    }))
    const workout: Workout = {
      title: 'Prescribed Session',
      type: 'workout',
      sport_id: sportId || null,
      session_objective: sessionObjective,
      target_minutes: phaseRows.reduce((sum, b) => sum + b.minutes, 0),
      duration_minutes: effectiveMinutes,
      phase_plan_json: plan,
      audience_splits_json: audienceSplits.length > 0 ? audienceSplits : undefined,
      audience_json: {
        age_min: ageMinNum,
        age_max: ageMaxNum,
        skill_level: skillLevel === 'N/A' ? null : (skillLevel || result.audience_profile?.impliedSkillLevel || null),
        sport_id: sportId || null,
      },
      coach_rationale_json: {
        session_why: SESSION_OBJECTIVE_OPTIONS.find((o) => o.value === sessionObjective)?.label,
        order_why: `Prescribed via Needs Engine v2 (${workMode} mode).`,
        audience_notes: result.age_fit_warnings?.length
          ? result.age_fit_warnings.slice(0, 5).join('; ')
          : undefined,
      },
      blocks: result.blocks.map((b, i) => {
        const base: WorkoutBlock = {
          label: b.label,
          block_format: b.other_kind === 'games' ? 'game' : 'straight_sets',
          rounds: 1,
          rest_between_rounds_seconds: 0,
          phase_key: b.phase_key ?? null,
          phase_id: b.phase_id ?? null,
          minutes_budget: b.target_minutes,
          items: b.items.map((it) => ({
            exercise_id: it.exercise_id,
            exercise_name: it.exercise_name,
            sets: it.sets,
            reps: it.reps ?? null,
            rest_seconds: it.rest_seconds ?? 30,
            work_seconds: it.work_seconds ?? null,
            est_seconds_per_set: it.est_seconds_per_set,
            split_alternates_json: it.split_alternates_json ?? it.per_split ?? null,
          })),
        }
        const prog = blockProgramming[i]
        return prog ? { ...base, ...applyProgrammingMethodDefaults(prog, base) } : base
      }),
    }
    setWorkout(workout)
    setWizardComplete(true)
    onSendToBuilder?.()
  }

  const selectAllEquipmentAvoid = () => setEquipmentAvoid([...equipmentOptions])
  const deselectAllEquipmentAvoid = () => setEquipmentAvoid([])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Sparkles className="w-6 h-6 text-vortex-red" /> Needs Engine</h2>
        <p className="text-sm text-gray-500">Configure mode, audience, equipment, and per-phase focus — then prescribe a time-packed session.</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      <div className="bg-gray-50 border-2 border-vortex-red rounded-xl p-4">
        <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-vortex-red" /> Describe the need in plain language</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runNaturalLanguage() }}
            placeholder="e.g. 60 min skill session for ages 9-12 with rings required"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          />
          <button type="button" onClick={() => void runNaturalLanguage()} disabled={nlLoading || !nlPrompt.trim()} className="bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {nlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Interpret
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          {/* Work session mode */}
          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-2">Work session</span>
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              {(['exercise', 'skill'] as WorkMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setWorkMode(mode)}
                  className={`px-4 py-2 text-sm font-medium capitalize ${workMode === mode ? 'bg-vortex-red text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              <span className="block font-semibold text-gray-700 mb-1">Session objective</span>
              <select value={sessionObjective} onChange={(e) => setSessionObjective(e.target.value as SessionObjective)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {SESSION_OBJECTIVE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Session length</span>
              <select
                value={customMinutes !== '' ? 'custom' : sessionMinutes}
                onChange={(e) => {
                  if (e.target.value === 'custom') setCustomMinutes(sessionMinutes)
                  else { setCustomMinutes(''); setSessionMinutes(Number(e.target.value)) }
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {[60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
                <option value="custom">Custom</option>
              </select>
            </label>
            {customMinutes !== '' && (
              <label className="text-sm">
                <span className="block font-semibold text-gray-700 mb-1">Custom minutes</span>
                <input type="number" min={15} max={180} value={customMinutes} onChange={(e) => setCustomMinutes(e.target.value ? Number(e.target.value) : '')} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
            )}
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Sport</span>
              <select value={sportId} onChange={(e) => setSportId(e.target.value ? Number(e.target.value) : '')} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Universal</option>
                {taxonomy?.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Skill level</span>
              <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Any</option>
                <option value="N/A">N/A</option>
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
            {(ageMinNum != null || ageMaxNum != null) && (
              <div className="col-span-2 flex flex-wrap items-center gap-2">
                <span className="text-xs rounded-full bg-blue-50 text-blue-800 px-2.5 py-1 font-medium">
                  Standard difficulty: {standardCap}/10
                </span>
                <label className="text-xs flex items-center gap-1">
                  Override
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={difficultyOverride}
                    onChange={(e) => setDifficultyOverride(e.target.value ? Number(e.target.value) : '')}
                    className="w-14 border border-gray-300 rounded px-2 py-0.5"
                    placeholder="—"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Age splits */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Age splits</span>
              <button
                type="button"
                onClick={() => {
                  const min = ageMinNum ?? 6
                  const max = ageMaxNum ?? 8
                  setAudienceSplits([...audienceSplits, {
                    label: `Split ${audienceSplits.length + 1}`,
                    ageMin: min,
                    ageMax: max,
                    difficultyOverride: suggestedDifficultyCap(min, max),
                  }])
                }}
                className="text-vortex-red text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add split
              </button>
            </div>
            {audienceSplits.length === 0 && <p className="text-xs text-gray-400">Optional — one workout with per-split exercise substitutions.</p>}
            <div className="space-y-2">
              {audienceSplits.map((split, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_60px_60px_auto] gap-2 items-center text-sm">
                  <input value={split.label} onChange={(e) => updateSplit(i, { label: e.target.value })} className="border border-gray-300 rounded px-2 py-1" placeholder="Label" />
                  <input type="number" value={split.ageMin} onChange={(e) => updateSplit(i, { ageMin: Number(e.target.value) || 0 })} className="border border-gray-300 rounded px-2 py-1" title="Min age" />
                  <input type="number" value={split.ageMax} onChange={(e) => updateSplit(i, { ageMax: Number(e.target.value) || 0 })} className="border border-gray-300 rounded px-2 py-1" title="Max age" />
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={split.difficultyOverride ?? suggestedDifficultyCap(split.ageMin, split.ageMax)}
                    onChange={(e) => updateSplitCap(i, e.target.value ? Number(e.target.value) : null)}
                    className="border border-gray-300 rounded px-2 py-1"
                    title="Difficulty cap"
                  />
                  <button type="button" onClick={() => setAudienceSplits(audienceSplits.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Equipment Use / Avoid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Equipment</span>
              <div className="inline-flex rounded border border-gray-300 overflow-hidden text-xs">
                <button type="button" onClick={() => setEquipmentMode('use')} className={`px-2 py-1 ${equipmentMode === 'use' ? 'bg-vortex-red text-white' : 'bg-white'}`}>Use</button>
                <button type="button" onClick={() => setEquipmentMode('avoid')} className={`px-2 py-1 ${equipmentMode === 'avoid' ? 'bg-vortex-red text-white' : 'bg-white'}`}>Avoid</button>
              </div>
            </div>
            {equipmentMode === 'use' ? (
              <SmartCombobox
                options={equipmentOptions}
                selected={equipmentUse}
                onChange={setEquipmentUse}
                placeholder="Required equipment (hard constraint)…"
                allowCustom
                onCustomAdd={(text) => ({ id: `custom:${text}`, label: text })}
              />
            ) : (
              <>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={selectAllEquipmentAvoid} className="text-xs text-gray-600 hover:text-vortex-red">Select all</button>
                  <button type="button" onClick={deselectAllEquipmentAvoid} className="text-xs text-gray-600 hover:text-vortex-red">Deselect all</button>
                </div>
                <SmartCombobox
                  options={equipmentOptions}
                  selected={equipmentAvoid}
                  onChange={setEquipmentAvoid}
                  placeholder="Equipment to exclude…"
                />
              </>
            )}
          </div>

          {/* Avoid list */}
          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-2">Avoid</span>
            <SmartCombobox
              options={avoidSearchOptions}
              selected={avoidTokens}
              onChange={setAvoidTokens}
              placeholder="Exercises, movement families, body regions…"
              allowCustom
              onCustomAdd={(text) => ({ id: `custom:${text}`, label: text })}
            />
            <p className="text-xs text-gray-400 mt-1">Type to search exercises; free text saved as avoid notes.</p>
          </div>

          {canApplyPlan && (
            <div>
              <button type="button" onClick={applyObjectivePlan} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium hover:border-vortex-red hover:text-vortex-red">
                Apply phase plan
              </button>
              {architectAdjustments.length > 0 && (
                <ul className="mt-2 text-xs text-gray-600 space-y-0.5">
                  {architectAdjustments.map((a) => <li key={a}>• {a}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Session phases */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-sm font-semibold text-gray-700">Session phases</span>
              <select
                value={selectedTemplateKey}
                onChange={(e) => loadTemplatePlan(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 max-w-[180px]"
              >
                <option value="">Saved phasing…</option>
                <optgroup label="My phasing">
                  {savedTemplates.map((t) => <option key={t.id} value={`coach:${t.id}`}>{t.name}</option>)}
                </optgroup>
                <optgroup label="System templates">
                  {systemTemplates.map((t) => <option key={t.key} value={`sys:${t.key}`}>{t.title}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="space-y-3">
              {phaseRows.map((row, i) => {
                const focusType = row.focusFacetType ?? ''
                const focusSelections: ComboboxOption[] = (row.focusTargets ?? []).map((t) => {
                  const opts = focusOptionsFor(t.facetType, row.phaseKey)
                  const match = opts.find((o) => Number(o.id) === t.facetId)
                  return { id: t.facetId, label: match?.label ?? String(t.facetId) }
                })
                const isOther = row.phaseKey === 'other'
                return (
                  <div key={`${row.phaseKey}-${i}`} className="relative border border-gray-100 rounded-lg p-2 pt-8 pb-8 space-y-2">
                    <button
                      type="button"
                      onClick={() => deleteRow(i)}
                      disabled={row.pinned}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-600 disabled:opacity-30"
                      title="Remove phase"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPhaseRowAfter(i)}
                      className="absolute bottom-2 right-2 text-gray-400 hover:text-vortex-red"
                      title="Add phase below"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-[1fr_1fr_70px] gap-2 items-center text-sm pr-6">
                      <select
                        value={row.phaseKey}
                        onChange={(e) => {
                          const phaseKey = e.target.value
                          const label = phaseKey === 'other' ? 'Other' : phaseName(taxonomy, phaseKey)
                          updateRow(i, {
                            phaseKey,
                            label,
                            otherKind: phaseKey === 'other' ? (row.otherKind ?? 'skills') : undefined,
                            focusFacetType: phaseKey === 'other' ? '' : row.focusFacetType,
                            focusTargets: phaseKey === 'other' ? [] : row.focusTargets,
                          })
                        }}
                        className="border border-gray-300 rounded px-2 py-1"
                      >
                        {(taxonomy?.sessionPhases ?? []).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                        <option value="other">Other</option>
                      </select>
                      {isOther ? (
                        <select
                          value={row.otherKind ?? 'skills'}
                          onChange={(e) => updateRow(i, { otherKind: e.target.value as OtherPhaseKind, otherItemIds: [] })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {Object.entries(OTHER_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      ) : (
                        <select
                          value={focusType}
                          onChange={(e) => updateRow(i, { focusFacetType: e.target.value as FocusFacetType | '', focusTargets: [] })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="">Focus…</option>
                          {(Object.entries(FOCUS_LABELS) as [FocusFacetType, string][]).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      )}
                      <input
                        type="number"
                        value={row.minutes}
                        onChange={(e) => {
                          const minutes = Number(e.target.value) || 0
                          if (row.pinned) setUserEditedPrepare(true)
                          updateRow(i, { minutes })
                        }}
                        className="border border-gray-300 rounded px-2 py-1"
                        title="Minutes"
                        readOnly={row.pinned}
                      />
                    </div>
                    {isOther && (
                      <div>
                        {(row.otherKind === 'skills' || !row.otherKind) && (
                          <SmartCombobox
                            options={skillOptions}
                            selected={(row.otherItemIds ?? []).map((id) => {
                              const opt = skillOptions.find((o) => Number(o.id) === id)
                              return { id, label: opt?.label ?? `Skill ${id}` }
                            })}
                            onChange={(sel) => updateRow(i, { otherItemIds: sel.map((s) => Number(s.id)).filter(Number.isFinite) })}
                            placeholder="Pick skills…"
                            allowCustom={false}
                          />
                        )}
                        {row.otherKind === 'games' && (
                          <SmartCombobox
                            options={gameOptions}
                            selected={(row.otherItemIds ?? []).map((id) => {
                              const opt = gameOptions.find((o) => Number(o.id) === id)
                              return { id, label: opt?.label ?? `Game ${id}` }
                            })}
                            onChange={(sel) => updateRow(i, { otherItemIds: sel.map((s) => Number(s.id)).filter(Number.isFinite) })}
                            placeholder="Pick games…"
                            allowCustom={false}
                          />
                        )}
                        {row.otherKind === 'tramp_tumble' && (
                          <span className="text-xs text-gray-500">Placeholder time block — no exercise selection.</span>
                        )}
                      </div>
                    )}
                    {!isOther && focusType && (
                      <SmartCombobox
                        options={focusOptionsFor(focusType, row.phaseKey)}
                        selected={focusSelections}
                        onChange={(sel) => updateRow(i, {
                          focusTargets: sel.map((s): PhaseFocusTarget => ({
                            facetType: focusType as FocusFacetType,
                            facetId: Number(s.id),
                            weight: 4,
                          })),
                        })}
                        placeholder={`Select ${FOCUS_LABELS[focusType as FocusFacetType].toLowerCase()}…`}
                        allowCustom={false}
                      />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end mt-2">
              <button type="button" onClick={() => setSaveModalOpen(true)} className="text-xs text-vortex-red flex items-center gap-1 hover:underline">
                <Save className="w-3 h-3" /> Save phasing
              </button>
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
              {result.audience_profile && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
                  <div className="font-semibold text-blue-900">Audience profile</div>
                  <p className="text-xs text-blue-800 mt-1">
                    {result.audience_profile.ageBandLabel}
                    {' · '}Max difficulty {result.audience_profile.caps.maxOverall}/10
                    {result.audience_profile.scalingCohort ? ` · Cohort ${result.audience_profile.scalingCohort.replace(/_/g, ' ')}` : ''}
                    {result.audience_profile.impliedSkillLevel ? ` · ${result.audience_profile.impliedSkillLevel}` : ''}
                  </p>
                  {(result.age_fit_warnings?.length ?? 0) > 0 && (
                    <ul className="mt-2 text-xs text-amber-800 list-disc ml-4">
                      {result.age_fit_warnings!.slice(0, 4).map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {(result.phase_rationales ?? []).map((pr, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="font-semibold text-gray-800">{pr.phase_name ?? pr.phase_key}</div>
                  {pr.phase_rationale && <p className="text-gray-600 mt-1 text-xs">{pr.phase_rationale}</p>}
                </div>
              ))}
              {result.blocks.map((b, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">{b.label}</span>
                    <span className="text-xs text-gray-500">~{b.estimated_minutes}m / {b.target_minutes}m</span>
                  </div>
                  {b.other_kind && <div className="text-xs text-indigo-600 mt-1">Other · {OTHER_KIND_LABELS[b.other_kind] ?? b.other_kind}</div>}
                  {blockProgramming[i] && (
                    <div className="text-xs text-indigo-700 mt-1">Format: {blockProgramming[i]?.name}</div>
                  )}
                  <ul className="mt-2 space-y-2">
                    {b.items.map((it, j) => (
                      <li key={`${it.exercise_id}-${j}`} className={`text-sm border-t border-gray-50 first:border-t-0 pt-2 first:pt-0 ${it.age_fit === 'over_cap' || it.age_fit === 'stretch' ? 'bg-amber-50/80 -mx-2 px-2 rounded' : ''}`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-gray-700">{it.exercise_name} <span className="text-gray-400">{it.sets}x{it.reps ?? '-'}</span></span>
                          <span className="flex items-center gap-2 text-xs">
                            {it.difficulty?.overall != null && <span className="text-gray-600">D{it.difficulty.overall}/10</span>}
                            {it.age_fit === 'good' && <span className="text-green-700">Age OK</span>}
                            {it.age_fit === 'stretch' && <span className="text-amber-700">Stretch</span>}
                            {it.age_fit === 'over_cap' && <span className="text-amber-800 font-medium">Over cap</span>}
                            <span className="text-vortex-red font-medium">score {it.score}</span>
                          </span>
                        </div>
                        {(it.per_split ?? it.split_alternates_json)?.map((ps) => (
                          <span key={ps.split_label} className="inline-block mr-1 mt-1 text-xs rounded-full bg-purple-50 text-purple-700 px-2 py-0.5">
                            {ps.split_label}: {ps.exercise_name}{ps.substituted ? ' (alt)' : ''}
                          </span>
                        ))}
                        {it.selection_rationale && <p className="text-xs text-gray-500 mt-1">{it.selection_rationale}</p>}
                      </li>
                    ))}
                    {b.items.length === 0 && <li className="text-xs text-gray-400">{b.other_kind === 'tramp_tumble' ? 'Reserved time block.' : 'No matching exercises.'}</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm space-y-3">
            <h4 className="font-semibold text-gray-900">Save phasing template</h4>
            <input
              value={saveTemplateName}
              onChange={(e) => setSaveTemplateName(e.target.value)}
              placeholder="Template name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setSaveModalOpen(false)} className="px-3 py-1.5 text-sm border rounded-lg">Cancel</button>
              <button type="button" onClick={() => void savePhasing()} className="px-3 py-1.5 text-sm bg-vortex-red text-white rounded-lg font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
