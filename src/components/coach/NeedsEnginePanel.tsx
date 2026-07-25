import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles, Plus, Trash2, ArrowRight, Save, RotateCcw } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import { useCoachBuilderStore } from '../../coach/useCoachBuilderStore'
import { listNeedsEngineRequirements, saveNeedsEngineRequirements } from '../../coach/needsEngineRequirementsStorage'
import {
  deleteEquipmentSetup,
  listSavedEquipmentSetups,
  saveEquipmentSetup,
  type SavedEquipmentSetup,
} from '../../coach/equipmentSetupsStorage'
import { useNeedsEngineStore, type NeedsEnginePhaseRowState, snapshotNeedsEngineState, applyNeedsEngineSnapshot } from '../../coach/useNeedsEngineStore'
import {
  buildPhasePlan,
  redistributeOnDelete,
  PREPARE_PINNED_MINUTES,
  type WorkMode,
  type NeedsEnginePhaseRow,
  type FocusFacetType,
  type OtherPhaseKind,
} from '../../coach/phaseArchitect'
import { SESSION_OBJECTIVE_OPTIONS, type SessionObjective } from '../../coach/phasePlan'
import {
  buildSpecificGoalPlan,
  SPECIFIC_GOAL_PRESETS,
  specificGoalPreset,
  type SpecificGoalKey,
} from '../../coach/specificGoalPresets'
import { standardDifficultyCap, suggestedDifficultyCap } from '../../coach/ageDifficultyPolicy'
import type {
  AudienceSplit,
  CoachPhaseTemplate,
  CoachNeedsEngineRequirements,
  PrescriptionResult,
  ProgrammingMethod,
  SessionPhaseTemplate,
  Workout,
  WorkoutBlock,
  PhaseFocusTarget,
} from '../../coach/types'
import { applyProgrammingMethodDefaults } from '../../coach/programmingBlockDefaults'
import { CanonicalWorkoutGeneratorPanel } from './CanonicalWorkoutGeneratorPanel'
import { splitVariantLabel, splitVariantTextTone, splitVariantsForItem } from '../../coach/splitVariants'
import { CANONICAL_PHASE_ORDER, phaseDisplayName } from '../../coach/sessionPhaseKeys'
import { focusKeysForPhase } from '../../../backend/platform/focusApplicability.js'
import SmartCombobox, { type ComboboxOption } from './SmartCombobox'

const FOCUS_LABELS: Record<FocusFacetType, string> = {
  tenet: 'Tenet',
  methodology: 'Methodology',
  physiology: 'Physiology',
  pattern: 'Movement Pattern',
  body_region: 'Muscle Group',
  order_slot: 'Movement Slot',
}

const OTHER_KIND_LABELS: Record<OtherPhaseKind, string> = {
  skills: 'Skills',
  games: 'Games',
}


function phaseName(taxonomy: ReturnType<typeof useTaxonomy>['taxonomy'], phaseKey: string) {
  if (phaseKey === 'other') return 'Other'
  return taxonomy?.sessionPhases?.find((p) => p.key === phaseKey)?.name ?? phaseDisplayName(phaseKey)
}

function rowsWithLabels(rows: NeedsEnginePhaseRowState[], taxonomy: ReturnType<typeof useTaxonomy>['taxonomy']): NeedsEnginePhaseRowState[] {
  return rows.map((r) => {
    const focusTargets = taxonomy
      ? (r.focusTargets ?? []).filter((target) =>
        focusFacetList(target.facetType, taxonomy, r.phaseKey)
          ?.some((item) => taxonomyFacetIdsMatch(item.id, target.facetId)),
      )
      : (r.focusTargets ?? [])
    const requestedFocusType = focusTargets[0]?.facetType ?? r.focusFacetType ?? ''
    const focusFacetType = requestedFocusType && (
      !taxonomy || (focusFacetList(requestedFocusType, taxonomy, r.phaseKey)?.length ?? 0) > 0
    )
      ? requestedFocusType
      : ''
    return {
      ...r,
      label: r.label ?? (r.phaseKey === 'other'
        ? OTHER_KIND_LABELS[r.otherKind ?? 'skills']
        : phaseName(taxonomy, r.phaseKey)),
      focusTargets,
      focusFacetType,
    }
  })
}

function focusTargetWeight(facetType: FocusFacetType | '' | undefined): number {
  if (facetType === 'tenet') return 6
  if (facetType === 'methodology') return 5
  return 4
}

function difficultyTo100(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null
  return Math.round(Number(value) * 10)
}

function difficultyFrom100(value: string): number | '' {
  if (!value) return ''
  const score = Number(value)
  return Number.isFinite(score) ? Math.min(100, Math.max(1, score)) / 10 : ''
}

function prescribedDoseLabel(item: {
  sets: number
  reps?: number | null
  work_seconds?: number | null
  distance?: number | null
  contacts?: number | null
  rounds?: number | null
  volume_unit?: string | null
}): string {
  if (item.reps != null) return `${item.sets}×${item.reps}`
  if (item.contacts != null) return `${item.sets}×${item.contacts} contacts`
  if (item.distance != null) return `${item.sets}×${item.distance} distance`
  if (item.rounds != null) return `${item.rounds} rounds`
  if (item.volume_unit === 'attempts') return `${item.sets} attempts`
  if (item.work_seconds != null) return `${item.sets}×${item.work_seconds}s`
  return `${item.sets} sets`
}

/** Taxonomy rows from Postgres/JSON may use string ids; focus targets store numeric facetId. */
function taxonomyFacetIdsMatch(
  taxonomyId: number | string | null | undefined,
  facetId: number | string | null | undefined,
): boolean {
  const a = Number(taxonomyId)
  const b = Number(facetId)
  return Number.isFinite(a) && Number.isFinite(b) && a === b
}

function focusFacetList(
  facetType: FocusFacetType,
  taxonomy: ReturnType<typeof useTaxonomy>['taxonomy'],
  phaseKey?: string,
) {
  if (!taxonomy) return undefined
  if (facetType === 'tenet' || facetType === 'methodology' || facetType === 'physiology') {
    const items = facetType === 'tenet'
      ? taxonomy.tenets
      : facetType === 'methodology'
        ? taxonomy.methodologies
        : taxonomy.physiology
    if (!phaseKey || phaseKey === 'other') return items
    const allowedKeys = new Set(focusKeysForPhase(phaseKey, facetType))
    return items.filter((item) => allowedKeys.has(item.key))
  }
  if (facetType === 'order_slot') {
    return taxonomy.phaseOrderSlots?.filter(
      (s) => !phaseKey || phaseKey === 'other' || s.phase_key === phaseKey,
    )
  }
  if (facetType === 'pattern') return taxonomy.patterns
  if (facetType === 'body_region') return taxonomy.bodyRegions
  return undefined
}

function focusTargetDisplayName(
  t: PhaseFocusTarget,
  taxonomy: ReturnType<typeof useTaxonomy>['taxonomy'],
  phaseKey?: string,
): string {
  const list = focusFacetList(t.facetType, taxonomy, phaseKey)
  const match = list?.find((row) => taxonomyFacetIdsMatch(row.id, t.facetId))
  return match?.name ?? String(t.facetId)
}

function focusTargetComboboxId(t: PhaseFocusTarget): string {
  return `${t.facetType}:${t.facetId}`
}

function focusTargetToComboboxOption(
  t: PhaseFocusTarget,
  phaseKey: string,
  taxonomy: ReturnType<typeof useTaxonomy>['taxonomy'],
): ComboboxOption {
  const name = focusTargetDisplayName(t, taxonomy, phaseKey)
  return {
    id: focusTargetComboboxId(t),
    label: name,
    meta: FOCUS_LABELS[t.facetType],
  }
}

function comboboxSelectionToFocusTargets(sel: ComboboxOption[]): PhaseFocusTarget[] {
  return sel.map((s) => {
    const raw = String(s.id)
    const sep = raw.indexOf(':')
    const facetType = raw.slice(0, sep) as FocusFacetType
    const facetId = Number(raw.slice(sep + 1))
    return {
      facetType,
      facetId,
      weight: focusTargetWeight(facetType),
    }
  })
}

function resolveFocusLabels(
  targets: PhaseFocusTarget[] | undefined,
  taxonomy: ReturnType<typeof useTaxonomy>['taxonomy'],
): string[] {
  if (!targets?.length || !taxonomy) return []
  return targets.map((t) => focusTargetDisplayName(t, taxonomy))
}

function nearestDurationKey(minutes: number): 60 | 90 | 120 {
  if (minutes <= 75) return 60
  if (minutes <= 105) return 90
  return 120
}

export default function NeedsEnginePanel({ onSendToBuilder }: { onSendToBuilder?: () => void }) {
  const { taxonomy } = useTaxonomy()
  const { setWorkout, setWizardComplete } = useCoachBuilderStore()
  const {
    workMode,
    sessionObjective,
    specificGoal,
    muscleFocus,
    sessionMinutes,
    customMinutes,
    sportId,
    skillLevel,
    ageMin,
    ageMax,
    difficultyOverride,
    audienceSplits,
    equipmentUsePolicy,
    allowBodyweight,
    equipmentAvailable,
    equipmentUse,
    equipmentAvoid,
    avoidTokens,
    phaseRows,
    userEditedPrepare,
    architectAdjustments,
    selectedTemplateKey,
    result,
    blockProgramming,
    nlPrompt,
    patch,
    reset: resetNeedsEngine,
  } = useNeedsEngineStore()

  const [avoidSearchOptions, setAvoidSearchOptions] = useState<ComboboxOption[]>([])
  const [systemTemplates, setSystemTemplates] = useState<SessionPhaseTemplate[]>([])
  const [savedTemplates, setSavedTemplates] = useState<CoachPhaseTemplate[]>([])
  const [savedRequirements, setSavedRequirements] = useState<CoachNeedsEngineRequirements[]>([])
  const [selectedRequirementsId, setSelectedRequirementsId] = useState<number | ''>('')
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [saveRequirementsModalOpen, setSaveRequirementsModalOpen] = useState(false)
  const [saveRequirementsName, setSaveRequirementsName] = useState('')
  const [saveRequirementsError, setSaveRequirementsError] = useState<string | null>(null)
  const [saveRequirementsLoading, setSaveRequirementsLoading] = useState(false)
  const [skillOptions, setSkillOptions] = useState<ComboboxOption[]>([])
  const [gameOptions, setGameOptions] = useState<ComboboxOption[]>([])
  const [loading, setLoading] = useState(false)
  const [hasPrescription, setHasPrescription] = useState(Boolean(result))
  const [error, setError] = useState<string | null>(null)
  const [nlLoading, setNlLoading] = useState(false)
  const [equipmentSetups, setEquipmentSetups] = useState<SavedEquipmentSetup[]>([])
  const [selectedEquipmentSetupId, setSelectedEquipmentSetupId] = useState('')
  const [equipmentSetupName, setEquipmentSetupName] = useState('')
  const [savingEquipmentSetup, setSavingEquipmentSetup] = useState(false)

  const setPhaseRows = useCallback((next: NeedsEnginePhaseRowState[] | ((rows: NeedsEnginePhaseRowState[]) => NeedsEnginePhaseRowState[])) => {
    patch({ phaseRows: typeof next === 'function' ? next(useNeedsEngineStore.getState().phaseRows) : next })
  }, [patch])

  const effectiveMinutes = customMinutes !== '' ? Number(customMinutes) : sessionMinutes
  const ageMinNum = ageMin === '' ? null : Number(ageMin)
  const ageMaxNum = ageMax === '' ? null : Number(ageMax)
  const canApplyPlan = workMode && effectiveMinutes > 0 && (ageMinNum != null || ageMaxNum != null)

  const standardCap = standardDifficultyCap(ageMinNum, ageMaxNum, difficultyOverride === '' ? null : Number(difficultyOverride))

  const equipmentOptions = useMemo<ComboboxOption[]>(
    () => (taxonomy?.equipment ?? []).map((eq) => ({ id: eq.id, label: eq.name })),
    [taxonomy?.equipment],
  )

  const selectableEquipmentUseOptions = useMemo(
    () => equipmentAvailable.length > 0 ? equipmentAvailable : equipmentOptions,
    [equipmentAvailable, equipmentOptions],
  )

  useEffect(() => {
    setEquipmentSetups(listSavedEquipmentSetups())
  }, [])

  const bodyRegionOptions = useMemo<ComboboxOption[]>(
    () => (taxonomy?.bodyRegions ?? []).map((br) => ({ id: `br:${br.id}`, label: br.name, meta: 'body region' })),
    [taxonomy?.bodyRegions],
  )

  const muscleGroupOptions = useMemo<ComboboxOption[]>(
    () => (taxonomy?.bodyRegions ?? []).map((br) => ({ id: br.id, label: br.name, meta: 'muscle group' })),
    [taxonomy?.bodyRegions],
  )

  const sessionPhaseOptions = useMemo(
    () => taxonomy?.sessionPhases?.length
      ? taxonomy.sessionPhases.map((phase) => ({ key: phase.key, name: phase.name }))
      : CANONICAL_PHASE_ORDER.map((key) => ({ key, name: phaseDisplayName(key) })),
    [taxonomy?.sessionPhases],
  )

  const focusOptionsFor = useCallback((facetType: FocusFacetType | '', phaseKey: string): ComboboxOption[] => {
    if (!facetType || !taxonomy) return []
    return (focusFacetList(facetType, taxonomy, phaseKey) ?? []).map((item) => ({
      id: Number(item.id),
      label: item.name,
      meta: 'phase_key' in item ? item.phase_key : undefined,
    }))
  }, [taxonomy])

  const loadTemplates = useCallback(async () => {
    try {
      const [system, saved, requirements] = await Promise.all([
        coachFetch<SessionPhaseTemplate[]>('/api/coach/session-templates'),
        coachFetch<CoachPhaseTemplate[]>('/api/coach/phase-templates'),
        listNeedsEngineRequirements(),
      ])
      setSystemTemplates(system.filter((template) => !/tumbl|tramp/i.test(template.key)))
      setSavedTemplates(saved.filter((t) => {
        const plan = t.phase_plan as unknown
        return !/tumbl|tramp/i.test(t.name)
          && !(typeof plan === 'object' && plan !== null && (plan as { __kind?: string }).__kind === 'needs_engine_requirements')
      }))
      setSavedRequirements(requirements)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load saved sessions')
    }
  }, [])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    if (!taxonomy) return
    patch({ phaseRows: rowsWithLabels(useNeedsEngineStore.getState().phaseRows, taxonomy) })
  }, [taxonomy, patch])

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
    patch({ phaseRows: rowsWithLabels(plan as NeedsEnginePhaseRow[], taxonomy), architectAdjustments: adjustments })
  }

  const applySpecificGoal = useCallback((goal: SpecificGoalKey, selectedMuscles = muscleFocus, duration = effectiveMinutes) => {
    if (!goal) {
      patch({ specificGoal: '', muscleFocus: selectedMuscles, architectAdjustments: [] })
      return
    }
    const preset = specificGoalPreset(goal)
    if (!preset || !taxonomy) {
      patch({ specificGoal: goal, muscleFocus: selectedMuscles })
      return
    }
    const muscleIds = selectedMuscles.map((item) => Number(item.id)).filter(Number.isFinite)
    const plan = buildSpecificGoalPlan(preset.key, duration, taxonomy, muscleIds)
    patch({
      specificGoal: goal,
      muscleFocus: selectedMuscles,
      sessionObjective: preset.objective,
      phaseRows: rowsWithLabels(plan, taxonomy),
      userEditedPrepare: false,
      selectedTemplateKey: '',
      architectAdjustments: [
        `${preset.label} preset applied at ${duration} minutes.`,
        'Prepare & Access and Restore remain work-derived; muscle emphasis is applied to the work phases.',
      ],
    })
  }, [effectiveMinutes, muscleFocus, patch, taxonomy])

  const loadTemplatePlan = (key: string) => {
    patch({ selectedTemplateKey: key })
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
        body: JSON.stringify({
          name,
          phase_plan_json: phaseRows.map(({ focusFacetType, ...row }) => {
            void focusFacetType
            return row
          }),
        }),
      })
      setSaveModalOpen(false)
      setSaveTemplateName('')
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save phasing')
    }
  }

  const saveRequirements = async () => {
    const name = saveRequirementsName.trim()
    if (!name) {
      setSaveRequirementsError('Enter a session name.')
      return
    }
    setSaveRequirementsLoading(true)
    setSaveRequirementsError(null)
    try {
      const snapshot = snapshotNeedsEngineState(useNeedsEngineStore.getState())
      const saved = await saveNeedsEngineRequirements(name, snapshot)
      setSaveRequirementsModalOpen(false)
      setSaveRequirementsName('')
      setSelectedRequirementsId(saved.id)
      await loadTemplates()
    } catch (err) {
      setSaveRequirementsError(err instanceof Error ? err.message : 'Could not save requirements')
    } finally {
      setSaveRequirementsLoading(false)
    }
  }

  const recallRequirements = () => {
    if (selectedRequirementsId === '') return
    const entry = savedRequirements.find((r) => r.id === selectedRequirementsId)
    if (!entry?.requirements) return
    const applied = applyNeedsEngineSnapshot(entry.requirements)
    if (applied.phaseRows) {
      applied.phaseRows = rowsWithLabels(applied.phaseRows, taxonomy)
    }
    patch(applied)
    setHasPrescription(false)
    setError(null)
  }

  const updateRow = (index: number, rowPatch: Partial<NeedsEnginePhaseRowState>) => {
    setPhaseRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...rowPatch } : r)))
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
    const newRow: NeedsEnginePhaseRowState = {
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

  const updateSplit = (index: number, splitPatch: Partial<AudienceSplit>) => {
    patch({
      audienceSplits: audienceSplits.map((s, j) => {
        if (j !== index) return s
        const next = { ...s, ...splitPatch }
        if ('ageMin' in splitPatch || 'ageMax' in splitPatch) {
          next.difficultyOverride = suggestedDifficultyCap(next.ageMin, next.ageMax)
        }
        return next
      }),
    })
  }

  const updateSplitCap = (index: number, value: number | null) => {
    patch({
      audienceSplits: audienceSplits.map((s, j) => (j === index ? { ...s, difficultyOverride: value } : s)),
    })
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
    setLoading(true)
    setError(null)
    const excludeExerciseIds = result
      ? result.blocks.flatMap((b) => b.items.map((it) => Number(it.exercise_id))).filter(Number.isFinite)
      : []
    patch({ result: null, blockProgramming: [] })
    try {
      if (equipmentUsePolicy === 'use_only' && equipmentUse.length === 0) {
        throw new Error('Select at least one item in Equipment [Use only].')
      }
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
        equipmentAvailableIds: equipmentAvailable.map((e) => Number(e.id)).filter(Number.isFinite),
        equipmentUseIds: equipmentUse.map((e) => Number(e.id)).filter(Number.isFinite),
        equipmentUsePolicy,
        allowBodyweight,
        equipmentAvoidIds: equipmentUsePolicy === 'use_only'
          ? []
          : equipmentAvoid.map((e) => Number(e.id)).filter(Number.isFinite),
        ...avoid,
        sessionObjective,
        specificGoal: specificGoal || null,
        muscleFocusIds: muscleFocus.map((item) => Number(item.id)).filter(Number.isFinite),
        durationMinutes: effectiveMinutes,
        phasePlan: phaseRows.map((r) => ({
          phaseKey: r.phaseKey,
          label: r.label,
          minutes: r.minutes,
          focusTargets: r.focusTargets ?? [],
          otherKind: r.otherKind,
          otherItemIds: r.otherItemIds ?? [],
          pinned: r.pinned,
        })),
        regenerationSeed: Date.now(),
        excludeExerciseIds,
      }
      const data = await coachFetch<PrescriptionResult>('/api/coach/needs-engine/prescribe', { method: 'POST', body: JSON.stringify(body) })
      const nextPatch: Parameters<typeof patch>[0] = { result: data }
      if (data.audience_profile?.impliedSkillLevel && !skillLevel) {
        nextPatch.skillLevel = data.audience_profile.impliedSkillLevel
      }
      patch(nextPatch)
      setHasPrescription(true)
      const youth = ageMaxNum != null && ageMaxNum <= 14
      const progPicks = await Promise.all(
        phaseRows.map(async (b) => {
          if (b.phaseKey === 'other') return null
          if (!['capacity', 'resilience', 'sustained_capacity'].includes(b.phaseKey)) return null
          try {
            const methodologyTarget = (b.focusTargets ?? []).find((t) => t.facetType === 'methodology')
            const methodologyRow = methodologyTarget
              ? taxonomy?.methodologies?.find((m) => taxonomyFacetIdsMatch(m.id, methodologyTarget.facetId))
              : null
            const pick = await coachFetch<{ selected: ProgrammingMethod | null }>('/api/coach/needs-engine/prescribe-programming-method', {
              method: 'POST',
              body: JSON.stringify({
                phaseKey: b.phaseKey,
                youth,
                lowImpact: avoid.excludeBodyRegionIds.length > 0,
                groupSize: 12,
                desiredAdaptation: sessionObjective,
                focusTargets: b.focusTargets ?? [],
                blockMinutes: b.minutes,
                methodologyKey: methodologyRow?.key ?? null,
              }),
            })
            return pick.selected
          } catch {
            return null
          }
        }),
      )
      patch({ blockProgramming: progPicks })
    } catch (err) {
      const e = err as Error & {
        status?: number
        details?: {
          code?: string
          unsatisfiable_equipment?: Array<{ name: string }>
          unsatisfied_versions?: Array<{ split_label?: string | null }>
          violations?: Array<{ exercise_name: string; block_label?: string }>
          blocking_requirements?: Array<{ message: string }>
          suggested_relaxations?: Array<{ suggestion: string }>
        }
      }
      if (e.status === 422 && e.details?.unsatisfiable_equipment?.length) {
        const equipmentNames = e.details.unsatisfiable_equipment.map((x) => x.name).join(', ')
        const splitNames = e.details.unsatisfied_versions
          ?.map((version) => version.split_label)
          .filter((label): label is string => Boolean(label))
        setError(
          `Required equipment could not be placed with the current session constraints: ${equipmentNames}.`
          + (splitNames?.length ? ` Affected workout versions: ${splitNames.join(', ')}.` : ''),
        )
      } else if (e.status === 422 && e.details?.violations?.length) {
        setError(`Prescription includes avoided equipment: ${e.details.violations.map((x) => x.exercise_name).join(', ')}`)
      } else if (e.status === 422 && e.details?.blocking_requirements?.length) {
        const reasons = e.details.blocking_requirements.map((item) => item.message).join(' ')
        const relaxations = e.details.suggested_relaxations?.map((item) => item.suggestion).join(' ')
        setError(`${reasons}${relaxations ? ` Suggested change: ${relaxations}` : ''}`)
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
        '/api/coach/ai/nl-needs', {
          method: 'POST',
          body: JSON.stringify({
            prompt: nlPrompt,
            defaults: {
              workMode,
              sportId: sportId || null,
              skillLevel: skillLevel || null,
              ageMin: ageMinNum,
              ageMax: ageMaxNum,
              sessionObjective,
              durationMinutes: effectiveMinutes,
              phasePlan: phaseRows,
              userEditedPrepare,
              equipmentAvailableIds: equipmentAvailable.map((item) => Number(item.id)).filter(Number.isFinite),
              equipmentUseIds: equipmentUse.map((item) => Number(item.id)).filter(Number.isFinite),
              equipmentUsePolicy,
              allowBodyweight,
              equipmentAvoidIds: equipmentAvoid.map((item) => Number(item.id)).filter(Number.isFinite),
              specificGoal: specificGoal || null,
              muscleFocusIds: muscleFocus.map((item) => Number(item.id)).filter(Number.isFinite),
            },
          }),
        },
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
      const nlPatch: Parameters<typeof patch>[0] = {}
      if (p.sportId != null) nlPatch.sportId = p.sportId
      if (p.skillLevel != null) nlPatch.skillLevel = p.skillLevel
      if (p.ageMin != null) nlPatch.ageMin = p.ageMin
      if (p.ageMax != null) nlPatch.ageMax = p.ageMax
      if (p.sessionObjective) {
        nlPatch.sessionObjective = p.sessionObjective
      }
      if (Array.isArray(p.equipmentIds) && p.equipmentIds.length > 0) {
        nlPatch.equipmentUse = p.equipmentIds.map((id) => {
          const eq = taxonomy?.equipment?.find((e) => e.id === id)
          return { id, label: eq?.name ?? `Equipment ${id}` }
        })
      }
      if (Array.isArray(p.blocks) && p.blocks.length > 0) {
        nlPatch.phaseRows = rowsWithLabels(p.blocks.map((b) => ({
          phaseKey: b.phaseKey ?? 'capacity',
          minutes: b.minutes,
          label: b.label,
        })), taxonomy)
      }
      nlPatch.result = {
        blocks: data.blocks,
        candidates: data.candidates,
        audience_profile: data.audience_profile,
        age_fit_warnings: data.age_fit_warnings,
      }
      if (p.sessionObjective) {
        const state = useNeedsEngineStore.getState()
        const { plan, adjustments } = buildPhasePlan({
          workMode: state.workMode,
          sessionObjective: p.sessionObjective,
          durationMinutes: state.customMinutes !== '' ? Number(state.customMinutes) : state.sessionMinutes,
          ageMin: nlPatch.ageMin != null ? Number(nlPatch.ageMin) : (state.ageMin === '' ? null : Number(state.ageMin)),
          ageMax: nlPatch.ageMax != null ? Number(nlPatch.ageMax) : (state.ageMax === '' ? null : Number(state.ageMax)),
          existingRows: nlPatch.phaseRows ?? state.phaseRows,
          userEditedPrepare: state.userEditedPrepare,
        })
        nlPatch.phaseRows = rowsWithLabels(plan as NeedsEnginePhaseRow[], taxonomy)
        nlPatch.architectAdjustments = adjustments
      }
      patch(nlPatch)
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
        watch_points: result.split_variant_warnings?.length
          ? result.split_variant_warnings.slice(0, 5)
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

  const selectAllEquipmentAvoid = () => patch({ equipmentAvoid: [...equipmentOptions] })
  const deselectAllEquipmentAvoid = () => patch({ equipmentAvoid: [] })

  const applyEquipmentSetup = (id: string) => {
    setSelectedEquipmentSetupId(id)
    const setup = equipmentSetups.find((row) => row.id === id)
    if (!setup) return
    const available = setup.equipment.filter((saved) =>
      equipmentOptions.some((option) => String(option.id) === String(saved.id)),
    )
    const availableIds = new Set(available.map((option) => String(option.id)))
    patch({
      equipmentAvailable: available,
      equipmentUse: equipmentUse.filter((option) => availableIds.has(String(option.id))),
    })
  }

  const handleSaveEquipmentSetup = () => {
    try {
      setEquipmentSetups(saveEquipmentSetup(equipmentSetupName, equipmentAvailable))
      setEquipmentSetupName('')
      setSavingEquipmentSetup(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save equipment setup.')
    }
  }

  const handleDeleteEquipmentSetup = () => {
    if (!selectedEquipmentSetupId) return
    setEquipmentSetups(deleteEquipmentSetup(selectedEquipmentSetupId))
    setSelectedEquipmentSetupId('')
  }

  const handleReset = () => {
    if (result && !window.confirm('Clear the Needs Engine form and prescription?')) return
    resetNeedsEngine()
    setHasPrescription(false)
    setError(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Sparkles className="w-6 h-6 text-vortex-red" /> Needs Engine</h2>
          <p className="text-sm text-gray-500">Configure mode, audience, equipment, and per-phase focus — then prescribe a time-packed session.</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-vortex-red hover:text-vortex-red"
        >
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>

      <CanonicalWorkoutGeneratorPanel />

      <div className="flex flex-col sm:flex-row sm:items-end gap-2 bg-white border border-gray-200 rounded-xl p-3">
        <label className="flex-1 text-sm">
          <span className="block font-semibold text-gray-700 mb-1">Saved session</span>
          <select
            value={selectedRequirementsId}
            onChange={(e) => setSelectedRequirementsId(e.target.value ? Number(e.target.value) : '')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">Select a saved session…</option>
            {savedRequirements.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={recallRequirements}
          disabled={selectedRequirementsId === ''}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-vortex-red hover:text-vortex-red disabled:opacity-40"
        >
          Recall
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      <div className="bg-gray-50 border-2 border-vortex-red rounded-xl p-4">
        <label className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-vortex-red" /> Describe the need in plain language</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={nlPrompt}
            onChange={(e) => patch({ nlPrompt: e.target.value })}
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
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Work session</span>
              <div className="inline-flex rounded border border-gray-300 overflow-hidden text-xs">
                {(['exercise', 'skill'] as WorkMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => patch({ workMode: mode })}
                    className={`px-2 py-1 capitalize ${workMode === mode ? 'bg-vortex-red text-white' : 'bg-white'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              <span className="block font-semibold text-gray-700 mb-1">Session objective</span>
              <select value={sessionObjective} onChange={(e) => patch({ sessionObjective: e.target.value as SessionObjective, specificGoal: '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {SESSION_OBJECTIVE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <div className="text-sm col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
              <label>
                <span className="block font-semibold text-gray-700 mb-1">Specific Goal preset</span>
                <select
                  value={specificGoal}
                  onChange={(e) => applySpecificGoal(e.target.value as SpecificGoalKey)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">Custom / no preset</option>
                  {SPECIFIC_GOAL_PRESETS.map((preset) => (
                    <option key={preset.key} value={preset.key}>{preset.label}</option>
                  ))}
                </select>
              </label>
              {specificGoalPreset(specificGoal) && (
                <div className="text-xs text-gray-600 space-y-1">
                  <p>{specificGoalPreset(specificGoal)?.description}</p>
                  <p><span className="font-semibold text-gray-700">Recommended session:</span> {specificGoalPreset(specificGoal)?.recommendedMinutes}</p>
                  <p><span className="font-semibold text-gray-700">Programming:</span> {specificGoalPreset(specificGoal)?.coachingSpecifics}</p>
                </div>
              )}
              <div>
                <span className="block font-semibold text-gray-700 mb-1">Muscle groups to emphasize</span>
                <SmartCombobox
                  options={muscleGroupOptions}
                  selected={muscleFocus}
                  onChange={(selected) => applySpecificGoal(specificGoal, selected)}
                  placeholder="Optional muscle-group focus…"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Applied to the work phases; preparation and restoration are generated from the resulting workload.
                </p>
              </div>
            </div>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Session length</span>
              <select
                value={customMinutes !== '' ? 'custom' : sessionMinutes}
                onChange={(e) => {
                  if (e.target.value === 'custom') patch({ customMinutes: sessionMinutes })
                  else {
                    const minutes = Number(e.target.value)
                    patch({ customMinutes: '', sessionMinutes: minutes })
                    if (specificGoal) applySpecificGoal(specificGoal, muscleFocus, minutes)
                  }
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
                <input
                  type="number"
                  min={15}
                  max={180}
                  value={customMinutes}
                  onChange={(e) => {
                    const minutes = e.target.value ? Number(e.target.value) : ''
                    patch({ customMinutes: minutes })
                    if (specificGoal && minutes !== '') applySpecificGoal(specificGoal, muscleFocus, minutes)
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </label>
            )}
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Sport</span>
              <select value={sportId} onChange={(e) => patch({ sportId: e.target.value ? Number(e.target.value) : '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Universal</option>
                {taxonomy?.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Age min</span>
              <input type="number" value={ageMin} onChange={(e) => patch({ ageMin: e.target.value ? Number(e.target.value) : '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Age max</span>
              <input type="number" value={ageMax} onChange={(e) => patch({ ageMax: e.target.value ? Number(e.target.value) : '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Skill level</span>
              <select value={skillLevel} onChange={(e) => patch({ skillLevel: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Any</option>
                <option value="N/A">N/A</option>
                <option value="EARLY_STAGE">Early Stage</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </label>
            {(ageMinNum != null || ageMaxNum != null) && (
              <div className="col-span-2 flex flex-wrap items-center gap-2">
                <span className="text-xs rounded-full bg-blue-50 text-blue-800 px-2.5 py-1 font-medium">
                  Standard difficulty: {difficultyTo100(standardCap)}/100
                </span>
                <label className="text-xs flex items-center gap-1">
                  Override
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={difficultyOverride === '' ? '' : difficultyTo100(difficultyOverride) ?? ''}
                    onChange={(e) => patch({ difficultyOverride: difficultyFrom100(e.target.value) })}
                    className="w-16 border border-gray-300 rounded px-2 py-0.5"
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
                  patch({
                    audienceSplits: [...audienceSplits, {
                      label: `Split ${audienceSplits.length + 1}`,
                      ageMin: min,
                      ageMax: max,
                      difficultyOverride: suggestedDifficultyCap(min, max),
                    }],
                  })
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
                    max={100}
                    step={1}
                    value={difficultyTo100(split.difficultyOverride ?? suggestedDifficultyCap(split.ageMin, split.ageMax)) ?? ''}
                    onChange={(e) => updateSplitCap(i, e.target.value ? Number(e.target.value) / 10 : null)}
                    className="border border-gray-300 rounded px-2 py-1"
                    title="Difficulty cap"
                  />
                  <button type="button" onClick={() => patch({ audienceSplits: audienceSplits.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Avoid list */}
          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-2">Avoid</span>
            <SmartCombobox
              options={avoidSearchOptions}
              selected={avoidTokens}
              onChange={(sel) => patch({ avoidTokens: sel })}
              placeholder="Exercises, movement families, body regions…"
              allowCustom
              onCustomAdd={(text) => ({ id: `custom:${text}`, label: text })}
            />
            <p className="text-xs text-gray-400 mt-1">Type to search exercises; free text saved as avoid notes.</p>
          </div>

          {/* Equipment */}
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-gray-800">Equipment <span className="text-vortex-red">[Available]</span></span>
                  <p className="text-xs text-gray-500">Sets the equipment pool the workout can choose from.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSavingEquipmentSetup((open) => !open)}
                  className="text-xs font-medium text-vortex-red hover:underline"
                >
                  Save setup
                </button>
              </div>

              <div className="flex gap-2">
                <select
                  value={selectedEquipmentSetupId}
                  onChange={(event) => applyEquipmentSetup(event.target.value)}
                  className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                  aria-label="Saved equipment setup"
                >
                  <option value="">Saved equipment setups…</option>
                  {equipmentSetups.map((setup) => (
                    <option key={setup.id} value={setup.id}>{setup.name}</option>
                  ))}
                </select>
                {selectedEquipmentSetupId && (
                  <button
                    type="button"
                    onClick={handleDeleteEquipmentSetup}
                    className="rounded border border-gray-300 bg-white p-1.5 text-gray-500 hover:text-red-600"
                    aria-label="Delete saved equipment setup"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {savingEquipmentSetup && (
                <div className="flex gap-2">
                  <input
                    value={equipmentSetupName}
                    onChange={(event) => setEquipmentSetupName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleSaveEquipmentSetup()
                      }
                    }}
                    placeholder="Setup name (for example, Main gym)"
                    className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                    autoFocus
                  />
                  <button type="button" onClick={handleSaveEquipmentSetup} className="rounded bg-vortex-red px-3 py-1.5 text-xs font-medium text-white">
                    Save
                  </button>
                </div>
              )}

              <SmartCombobox
                options={equipmentOptions}
                selected={equipmentAvailable}
                onChange={(selected) => {
                  const availableIds = new Set(selected.map((option) => String(option.id)))
                  patch({
                    equipmentAvailable: selected,
                    equipmentUse: equipmentUse.filter((option) => availableIds.has(String(option.id))),
                  })
                  setSelectedEquipmentSetupId('')
                }}
                placeholder="All catalog equipment is available until a selection is made."
              />
              {equipmentAvailable.length === 0 && (
                <p className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                  No availability setup selected: the generator will treat every catalog equipment item as available.
                </p>
              )}
              <label className="text-xs flex items-center gap-1.5 text-gray-700">
                <input
                  type="checkbox"
                  checked={allowBodyweight}
                  onChange={(e) => patch({ allowBodyweight: e.target.checked })}
                  className="rounded border-gray-300 text-vortex-red focus:ring-vortex-red"
                />
                Bodyweight / no-equipment exercises are available
              </label>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Equipment <span className="text-vortex-red">[{equipmentUsePolicy === 'must_use' ? 'Must use' : 'Use only'}]</span>
                </span>
                <span className="text-xs text-gray-500">Selection behavior:</span>
              <div className="inline-flex rounded border border-gray-300 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => patch({ equipmentUsePolicy: 'must_use' })}
                  className={`px-2 py-1 ${equipmentUsePolicy === 'must_use' ? 'bg-vortex-red text-white' : 'bg-white'}`}
                >
                  Must use
                </button>
                <button
                  type="button"
                  onClick={() => patch({ equipmentUsePolicy: 'use_only', equipmentAvoid: [] })}
                  className={`px-2 py-1 ${equipmentUsePolicy === 'use_only' ? 'bg-vortex-red text-white' : 'bg-white'}`}
                >
                  Use only
                </button>
              </div>
            </div>
            <SmartCombobox
              options={selectableEquipmentUseOptions}
              selected={equipmentUse}
              onChange={(sel) => patch({ equipmentUse: sel })}
              placeholder={
                equipmentUsePolicy === 'use_only'
                  ? 'Only this equipment may be used; every selected item does not have to appear.'
                  : 'Every selected item must appear; other available equipment may also be used.'
              }
            />
              <p className="text-xs text-gray-500">
                {equipmentUsePolicy === 'use_only'
                  ? `Nothing outside this list will be prescribed${allowBodyweight ? ', except bodyweight.' : '.'}`
                  : 'These items are guaranteed requirements, not the complete allowed list.'}
              </p>
            </div>

            <div className={equipmentUsePolicy === 'use_only' ? 'opacity-50 pointer-events-none' : ''}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
                <span className="text-sm font-semibold text-gray-700">Additional equipment exclusions</span>
                <div className="inline-flex rounded border border-gray-300 overflow-hidden text-xs">
                  <span className="px-2 py-1 bg-vortex-red text-white">Don&apos;t Use</span>
                </div>
              </div>
              {equipmentUsePolicy === 'must_use' && (
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={selectAllEquipmentAvoid} className="text-xs text-gray-600 hover:text-vortex-red">Select all</button>
                  <button type="button" onClick={deselectAllEquipmentAvoid} className="text-xs text-gray-600 hover:text-vortex-red">Deselect all</button>
                </div>
              )}
              <SmartCombobox
                options={equipmentOptions}
                selected={equipmentAvoid}
                onChange={(sel) => patch({ equipmentAvoid: sel })}
                placeholder={
                  equipmentUsePolicy === 'use_only'
                    ? 'All other equipment is excluded by default (except bodyweight when allowed).'
                    : 'Equipment to exclude…'
                }
              />
            </div>
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
            <div className="space-y-2">
              {phaseRows.map((row, i) => {
                const focusType = row.focusFacetType ?? ''
                const availableFocusTypes = (Object.entries(FOCUS_LABELS) as [FocusFacetType, string][])
                  .filter(([facetType]) => focusOptionsFor(facetType, row.phaseKey).length > 0)
                const focusSelections: ComboboxOption[] = (row.focusTargets ?? [])
                  .filter((target) => target.facetType === focusType)
                  .map((target) => focusTargetToComboboxOption(target, row.phaseKey, taxonomy))
                const focusOptionsForRow = focusType
                  ? focusOptionsFor(focusType, row.phaseKey).map((o) => ({
                    id: `${focusType}:${o.id}`,
                    label: o.label,
                    meta: o.meta ?? FOCUS_LABELS[focusType as FocusFacetType],
                  }))
                  : []
                const isOther = row.phaseKey === 'other'
                return (
                  <div key={`${row.phaseKey}-${i}`} className="flex gap-1.5 items-start border border-gray-100 rounded-lg p-1.5">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="grid grid-cols-[1fr_1fr_70px] gap-2 items-center text-sm">
                        <select
                          value={row.phaseKey}
                          onChange={(e) => {
                            const phaseKey = e.target.value
                            const label = phaseKey === 'other' ? 'Other' : phaseName(taxonomy, phaseKey)
                            updateRow(i, {
                              phaseKey,
                              label,
                              otherKind: phaseKey === 'other' ? (row.otherKind ?? 'skills') : undefined,
                              focusFacetType: '',
                              focusTargets: [],
                            })
                          }}
                          className="border border-gray-300 rounded px-2 py-1 min-w-0"
                        >
                          {sessionPhaseOptions.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                          <option value="other">Other</option>
                        </select>
                        {isOther ? (
                          <select
                            value={row.otherKind ?? 'skills'}
                            onChange={(e) => updateRow(i, { otherKind: e.target.value as OtherPhaseKind, otherItemIds: [] })}
                            className="border border-gray-300 rounded px-2 py-1 text-sm min-w-0"
                          >
                            {Object.entries(OTHER_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        ) : (
                          <select
                            value={focusType}
                            onChange={(e) => updateRow(i, {
                              focusFacetType: e.target.value as FocusFacetType | '',
                              focusTargets: [],
                            })}
                            className="border border-gray-300 rounded px-2 py-1 text-sm min-w-0"
                          >
                            <option value="">Focus…</option>
                            {availableFocusTypes.map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        )}
                        <input
                          type="number"
                          value={row.minutes}
                          onChange={(e) => {
                            const minutes = Number(e.target.value) || 0
                            if (row.pinned) patch({ userEditedPrepare: true })
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
                        </div>
                      )}
                      {!isOther && (focusType || focusSelections.length > 0) && (
                        <SmartCombobox
                          options={focusOptionsForRow}
                          selected={focusSelections}
                          onChange={(sel) => updateRow(i, {
                            focusTargets: comboboxSelectionToFocusTargets(sel),
                          })}
                          placeholder={focusType
                            ? `Select ${FOCUS_LABELS[focusType as FocusFacetType].toLowerCase()}…`
                            : 'Choose a focus type above to add more…'}
                          allowCustom={false}
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => deleteRow(i)}
                        disabled={row.pinned}
                        className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30"
                        title="Remove phase"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertPhaseRowAfter(i)}
                        className="p-1 text-gray-400 hover:text-vortex-red"
                        title="Add phase below"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() => {
                  setSaveRequirementsError(null)
                  setSaveRequirementsName('')
                  setSaveRequirementsModalOpen(true)
                }}
                className="text-xs text-vortex-red flex items-center gap-1 hover:underline"
              >
                <Save className="w-3 h-3" /> Save requirements
              </button>
              <button type="button" onClick={() => setSaveModalOpen(true)} className="text-xs text-vortex-red flex items-center gap-1 hover:underline">
                <Save className="w-3 h-3" /> Save phasing
              </button>
            </div>
          </div>

          <button type="button" onClick={() => void prescribe()} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-vortex-red text-white py-2.5 rounded-lg font-semibold disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {hasPrescription ? 'Regenerate Session' : 'Prescribe Session'}
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
                    {' · '}Max difficulty {difficultyTo100(result.audience_profile.caps.maxOverall)}/100
                    {result.audience_profile.scalingCohort ? ` · Cohort ${result.audience_profile.scalingCohort.replace(/_/g, ' ')}` : ''}
                    {result.audience_profile.impliedSkillLevel ? ` · ${result.audience_profile.impliedSkillLevel}` : ''}
                  </p>
                  {(result.age_fit_warnings?.length ?? 0) > 0 && (
                    <ul className="mt-2 text-xs text-amber-800 list-disc ml-4">
                      {result.age_fit_warnings!.slice(0, 4).map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  )}
                  {(result.split_variant_warnings?.length ?? 0) > 0 && (
                    <ul className="mt-2 text-xs text-amber-800 list-disc ml-4">
                      {result.split_variant_warnings!.slice(0, 4).map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {((result.constraint_report?.equipment_avoid?.excluded_count ?? 0) > 0
                || (result.constraint_report?.empty_phase_reasons?.length ?? 0) > 0
                || (result.constraint_report?.phase_fill?.some((p) => p.fill_pct < 80) ?? false)) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="font-semibold text-amber-900">Constraint report</div>
                  {(result.constraint_report?.equipment_avoid?.excluded_count ?? 0) > 0 && (
                    <p className="text-xs text-amber-800 mt-1">
                      Equipment avoid filtered {result.constraint_report!.equipment_avoid!.excluded_count} candidates
                      {(result.constraint_report!.equipment_avoid!.sample_names?.length ?? 0) > 0
                        ? ` (e.g. ${result.constraint_report!.equipment_avoid!.sample_names!.slice(0, 3).join(', ')})`
                        : ''}.
                    </p>
                  )}
                  {(result.constraint_report?.phase_fill?.length ?? 0) > 0 && (
                    <ul className="mt-2 text-xs text-amber-800 list-disc ml-4">
                      {result.constraint_report!.phase_fill!
                        .filter((p) => p.fill_pct < 80)
                        .slice(0, 4)
                        .map((p) => (
                          <li key={p.phase_key}>
                            {p.phase_key.replace(/_/g, ' ')}: {p.estimated_minutes}m / {p.target_minutes}m ({p.fill_pct}%)
                            {(p.split_rejects ?? 0) > 0 ? ` · ${p.split_rejects} split rejects` : ''}
                          </li>
                        ))}
                    </ul>
                  )}
                  {(result.constraint_report?.empty_phase_reasons?.length ?? 0) > 0 && (
                    <ul className="mt-2 text-xs text-amber-800 list-disc ml-4">
                      {result.constraint_report!.empty_phase_reasons!.slice(0, 4).map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {(result.audience_splits?.length ?? 0) > 0 && (
                <div className="rounded-lg border border-purple-100 bg-purple-50 p-3 text-sm">
                  <div className="font-semibold text-purple-900">Age splits — one session, per-group variants</div>
                  <ul className="mt-2 space-y-1 text-xs text-purple-800">
                    {result.audience_splits!.map((split) => (
                      <li key={split.label}>
                        <span className="font-medium">{split.label}</span>
                        {split.ageMin != null || split.ageMax != null ? ` (ages ${split.ageMin ?? '?'}-${split.ageMax ?? '?'})` : ''}
                        {' · '}cap {difficultyTo100(split.caps.maxOverall)}/100
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(result.phase_rationales ?? []).map((pr, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="font-semibold text-gray-800">{pr.phase_name ?? pr.phase_key}</div>
                  {pr.phase_rationale && <p className="text-gray-600 mt-1 text-xs">{pr.phase_rationale}</p>}
                </div>
              ))}
              {result.blocks.map((b, i) => {
                const focusLabels = resolveFocusLabels(b.focus_targets, taxonomy)
                return (
                <div key={i} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-800">{b.label}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-2">
                      ~{b.estimated_minutes}m / {b.target_minutes}m
                      {(b.fill_pct ?? Math.round((b.estimated_minutes / Math.max(b.target_minutes, 1)) * 100)) < 80 && (
                        <span className="text-amber-700 font-medium">Underfilled</span>
                      )}
                    </span>
                  </div>
                  {Number(b.transition_minutes ?? 0) > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      {b.exercise_minutes}m exercise dose + {b.transition_minutes}m transitions, setup, and coaching resets
                    </p>
                  )}
                  {focusLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {focusLabels.map((label) => (
                        <span key={label} className="text-xs rounded-full bg-indigo-50 text-indigo-800 px-2 py-0.5">{label}</span>
                      ))}
                    </div>
                  )}
                  {blockProgramming[i] && (() => {
                    const rules = blockProgramming[i]?.workout_builder_rules ?? {}
                    const workSeconds = typeof rules.work_seconds === 'number' ? rules.work_seconds : null
                    const restSeconds = typeof rules.rest_seconds === 'number' ? rules.rest_seconds : null
                    return (
                      <div className="text-xs text-indigo-700 mt-1">
                        Format: {blockProgramming[i]?.name}
                        {workSeconds != null && (
                          <span className="text-gray-500">
                            {' '}· {workSeconds}s work / {restSeconds ?? '—'}s rest
                          </span>
                        )}
                      </div>
                    )
                  })()}
                  {b.other_kind && <div className="text-xs text-indigo-600 mt-1">Other · {OTHER_KIND_LABELS[b.other_kind] ?? b.other_kind}</div>}
                  <ul className="mt-2 space-y-2">
                    {b.items.map((it, j) => {
                      const splitVariants = splitVariantsForItem(it)
                      return (
                      <li key={`${it.exercise_id}-${j}`} className={`text-sm border-t border-gray-50 first:border-t-0 pt-2 first:pt-0 ${it.age_fit === 'over_cap' || it.age_fit === 'stretch' ? 'bg-amber-50/80 -mx-2 px-2 rounded' : ''}`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-gray-700">{it.exercise_name} <span className="text-gray-400">{prescribedDoseLabel(it)}</span></span>
                          <span className="flex items-center gap-2 text-xs">
                            {it.difficulty?.overall != null && <span className="text-gray-600">D{difficultyTo100(it.difficulty.overall)}/100</span>}
                            {it.age_fit === 'good' && <span className="text-green-700">Age OK</span>}
                            {it.age_fit === 'stretch' && <span className="text-amber-700">Stretch</span>}
                            {it.age_fit === 'over_cap' && <span className="text-amber-800 font-medium">Over cap</span>}
                          </span>
                        </div>
                        {splitVariants.length > 0 && (
                          <div className="mt-2 overflow-x-auto">
                            <table className="min-w-full text-xs border border-purple-100 rounded-lg overflow-hidden">
                              <thead className="bg-purple-50 text-purple-900">
                                <tr>
                                  <th className="text-left px-2 py-1 font-semibold">Group</th>
                                  <th className="text-left px-2 py-1 font-semibold">Exercise</th>
                                  <th className="text-left px-2 py-1 font-semibold">Variant</th>
                                  <th className="text-left px-2 py-1 font-semibold">Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {splitVariants.map((ps) => (
                                  <tr key={ps.split_label} className="border-t border-purple-50">
                                    <td className="px-2 py-1 text-gray-700">{ps.split_label}</td>
                                    <td className="px-2 py-1 text-gray-800">{ps.exercise_name}</td>
                                    <td className="px-2 py-1">
                                      <span className={splitVariantTextTone(ps)}>
                                        {splitVariantLabel(ps)}
                                      </span>
                                    </td>
                                    <td className="px-2 py-1 text-gray-500">
                                      {ps.difficulty?.overall != null ? `D${difficultyTo100(ps.difficulty.overall)}/100` : '—'}
                                      {ps.scaling_guidance ? ` · ${ps.scaling_guidance}` : ''}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {it.selection_rationale && <p className="text-xs text-gray-500 mt-1">{it.selection_rationale}</p>}
                      </li>
                    )})}
                    {b.items.length === 0 && <li className="text-xs text-gray-400">No matching exercises.</li>}
                  </ul>
                </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {saveRequirementsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm space-y-3">
            <h4 className="font-semibold text-gray-900">Save requirements</h4>
            <p className="text-xs text-gray-500">Saves session inputs and the current prescription so you can recall them later.</p>
            <input
              value={saveRequirementsName}
              onChange={(e) => {
                setSaveRequirementsName(e.target.value)
                if (saveRequirementsError) setSaveRequirementsError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveRequirements()
              }}
              placeholder="Session name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            {saveRequirementsError && (
              <p className="text-sm text-red-600">{saveRequirementsError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setSaveRequirementsModalOpen(false)} className="px-3 py-1.5 text-sm border rounded-lg">Cancel</button>
              <button type="button" onClick={() => void saveRequirements()} disabled={saveRequirementsLoading} className="px-3 py-1.5 text-sm bg-vortex-red text-white rounded-lg font-medium disabled:opacity-60">
                {saveRequirementsLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

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
