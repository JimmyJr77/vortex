import { useEffect, useState } from 'react'
import { CheckCircle2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type {
  Exercise,
  ExerciseDifficultyProfile,
  ExerciseCoachingExecution,
  ExerciseMedia,
  ExerciseMovementRequirements,
  ExercisePairingLogic,
  ExercisePhaseProfile,
  ExerciseRegimenRule,
  ExerciseSafetyProfile,
  ExerciseScalingProfile,
  ExerciseTag,
  ExerciseWhy,
  ExerciseMediaLibrary,
  ParticipantStructure,
  PhaseSubrole,
  ScalingCohortKey,
} from '../../coach/types'
import { PARTICIPANT_STRUCTURE_OPTIONS, PHASE_SUBROLE_OPTIONS, SCALING_COHORT_KEYS } from '../../coach/types'
import type { FacetType, TaxonomyItem } from '../../coach/taxonomy'
import { capacitySubroleSequence, orderSlotsForSubrole, outputSubroleSequence, prepareAccessSubroleSequence, skillMovementSubroleSequence, subroleForOrderSlot } from '../../coach/taxonomy'
import { phaseSubroleLabel } from '../../coach/exerciseCard'
import { useTaxonomy } from './useTaxonomy'

function GroupedOrderSlotSelect({
  phaseKey,
  value,
  onChange,
  disabled,
  taxonomy,
  className,
}: {
  phaseKey: string
  value: string
  onChange: (key: string) => void
  disabled?: boolean
  taxonomy: ReturnType<typeof useTaxonomy>['taxonomy']
  className?: string
}) {
  if (phaseKey === 'prepare_and_access' || phaseKey === 'movement_intelligence' || phaseKey === 'capacity' || phaseKey === 'output') {
    const subroles = phaseKey === 'prepare_and_access'
      ? prepareAccessSubroleSequence(taxonomy)
      : phaseKey === 'movement_intelligence'
        ? skillMovementSubroleSequence(taxonomy)
        : phaseKey === 'capacity'
          ? capacitySubroleSequence(taxonomy)
          : outputSubroleSequence(taxonomy)
    const hint = phaseKey === 'prepare_and_access'
      ? 'RAMP sequence: Raise → Mobilize → Activate → Integrate → Potentiate Bridge.'
      : phaseKey === 'movement_intelligence'
        ? 'Shape → Rotation → Locomotion → Balance → Perception-Action.'
        : phaseKey === 'capacity'
          ? 'Squat → Hinge → Push → Pull/Hang → Carry/Trunk → Tissue capacity.'
          : 'Acceleration → Max velocity → Elastic → Jump/throw → Decel/COD → Reactive.'
    return (
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={className} title={hint}>
        <option value="">Order slot</option>
        {subroles.map((sr) => (
          <optgroup key={sr.key} label={sr.name}>
            {orderSlotsForSubrole(taxonomy, phaseKey, sr.key).map((s) => (
              <option key={s.id} value={s.key}>{s.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    )
  }
  const slots = (taxonomy?.phaseOrderSlots ?? []).filter((s) => s.phase_key === phaseKey)
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">Order slot</option>
      {slots.map((s) => <option key={s.id} value={s.key}>{s.name}</option>)}
    </select>
  )
}

type EditorTab =
  | 'identity'
  | 'requirements'
  | 'taxonomy'
  | 'phase'
  | 'why'
  | 'execution'
  | 'dosage'
  | 'scaling'
  | 'difficulty'
  | 'pairing'
  | 'safety'
  | 'media'

const EDITOR_TABS: Array<{ id: EditorTab; label: string }> = [
  { id: 'identity', label: 'Movement Identity' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'taxonomy', label: 'Taxonomy' },
  { id: 'phase', label: 'Phase Profiles' },
  { id: 'why', label: 'Why Layer' },
  { id: 'execution', label: 'Coaching Execution' },
  { id: 'dosage', label: 'Dosage' },
  { id: 'scaling', label: 'Scaling' },
  { id: 'difficulty', label: 'Difficulty & Age' },
  { id: 'pairing', label: 'Pairing Logic' },
  { id: 'safety', label: 'Safety' },
  { id: 'media', label: 'Media & Docs' },
]

const COHORT_LABELS: Record<ScalingCohortKey, string> = {
  youth_beginner: 'Youth beginner',
  youth_intermediate: 'Youth intermediate',
  teen: 'Teen',
  adult_beginner: 'Adult beginner',
  adult_advanced: 'Adult advanced',
  older_adult: 'Older adult',
  pregnancy_postpartum: 'Pregnancy / postpartum',
}

const SCALABLE_VAR_OPTIONS = ['sets', 'reps', 'rest_seconds', 'height', 'load', 'complexity', 'distance', 'tempo', 'rom']

function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <button type="button" onClick={() => onChange([...items, ''])} className="text-vortex-red text-xs flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={placeholder}
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
            />
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="text-xs text-gray-400">None yet.</div>}
      </div>
    </div>
  )
}

function CommaListInput({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-gray-700">{label}</span>
      <input
        value={value.join(', ')}
        onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
      />
    </label>
  )
}

export default function ExerciseEditor({
  exercise,
  onClose,
  onSaved,
}: {
  exercise: Exercise | null
  onClose: () => void
  onSaved: () => void
}) {
  const { taxonomy } = useTaxonomy()
  const [tab, setTab] = useState<EditorTab>('identity')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publishCheck, setPublishCheck] = useState<{ ready: boolean; issues: string[] } | null>(null)

  const [name, setName] = useState(exercise?.name ?? '')
  const [cardSummary, setCardSummary] = useState(exercise?.card_summary ?? '')
  const [coachLanguage, setCoachLanguage] = useState(exercise?.coach_language ?? '')
  const [athleteLanguage, setAthleteLanguage] = useState(exercise?.athlete_language ?? '')
  const [movementFamily, setMovementFamily] = useState(exercise?.movement_family ?? '')
  const [primaryPhaseKey, setPrimaryPhaseKey] = useState(exercise?.primary_phase_key ?? '')
  const [phaseSubrole, setPhaseSubrole] = useState<PhaseSubrole | ''>(exercise?.phase_subrole ?? '')
  const [subroleOverride, setSubroleOverride] = useState(false)
  const [primaryOrderSlot, setPrimaryOrderSlot] = useState(exercise?.primary_order_slot ?? '')
  const [sportId, setSportId] = useState<number | ''>(exercise?.sport_id ?? '')
  const [skillLevel, setSkillLevel] = useState(exercise?.skill_level ?? '')
  const [visibility, setVisibility] = useState<'facility' | 'private'>(exercise?.visibility ?? 'facility')
  const [participantStructure, setParticipantStructure] = useState<ParticipantStructure>(exercise?.participant_structure ?? 'individual')

  const [requirements, setRequirements] = useState<ExerciseMovementRequirements>(exercise?.movement_requirements ?? {})
  const [tags, setTags] = useState<ExerciseTag[]>(exercise?.tags ?? [])
  const [phaseProfiles, setPhaseProfiles] = useState<ExercisePhaseProfile[]>(exercise?.phase_profiles ?? [])
  const [why, setWhy] = useState<ExerciseWhy>(exercise?.why ?? {})
  const [coachingExec, setCoachingExec] = useState<ExerciseCoachingExecution>(exercise?.coaching_execution ?? {})
  const [dosage, setDosage] = useState({
    default_sets: exercise?.default_sets ?? '',
    default_reps: exercise?.default_reps ?? '',
    default_work_seconds: exercise?.default_work_seconds ?? '',
    default_rest_seconds: exercise?.default_rest_seconds ?? '',
    est_seconds_per_set: exercise?.est_seconds_per_set ?? 45,
    volume_unit: exercise?.dosage_profiles?.[0]?.volume_unit ?? 'reps',
    session_volume_min: exercise?.dosage_profiles?.[0]?.session_volume_min ?? '',
    session_volume_max: exercise?.dosage_profiles?.[0]?.session_volume_max ?? '',
    default_rpe_min: exercise?.dosage_profiles?.[0]?.default_rpe_min ?? '',
    default_rpe_max: exercise?.dosage_profiles?.[0]?.default_rpe_max ?? '',
  })
  const [cohortScaling, setCohortScaling] = useState<Partial<Record<ScalingCohortKey, ExerciseScalingProfile>>>({})
  const [genderSpecificNotes, setGenderSpecificNotes] = useState('')
  const [scalableVariables, setScalableVariables] = useState<string[]>(exercise?.scalable_variables ?? [])
  const [pairing, setPairing] = useState<ExercisePairingLogic>(exercise?.pairing_logic ?? {})
  const [safetyProfile, setSafetyProfile] = useState<ExerciseSafetyProfile>(exercise?.safety_profile ?? {})
  const [regimenRule, setRegimenRule] = useState<ExerciseRegimenRule>(exercise?.regimen_rule ?? {})
  const [mediaLib, setMediaLib] = useState<ExerciseMediaLibrary>(exercise?.media_library ?? {})
  const [media, setMedia] = useState<ExerciseMedia[]>(exercise?.media ?? [])
  const [ageMin, setAgeMin] = useState<number | ''>(exercise?.age_min ?? '')
  const [ageMax, setAgeMax] = useState<number | ''>(exercise?.age_max ?? '')
  const [difficultyProfile, setDifficultyProfile] = useState<Partial<ExerciseDifficultyProfile>>(exercise?.difficulty_profile ?? {
    technical: 3,
    load: 3,
    complexity: 3,
    overall: 3,
    attention_demand: 'low',
  })

  const computedOverall = Math.max(
    Number(difficultyProfile.technical) || 1,
    Number(difficultyProfile.load) || 1,
    Number(difficultyProfile.complexity) || 1,
  )

  useEffect(() => {
    if (!exercise) return
    coachFetch<Exercise>(`/api/coach/exercises/${exercise.id}`)
      .then((full) => {
        setName(full.name)
        setCardSummary(full.card_summary ?? '')
        setCoachLanguage(full.coach_language ?? '')
        setAthleteLanguage(full.athlete_language ?? '')
        setMovementFamily(full.movement_family ?? '')
        setPrimaryPhaseKey(full.primary_phase_key ?? full.primary_phase?.phaseKey ?? '')
        setPhaseSubrole((full.phase_subrole as PhaseSubrole) ?? '')
        setPrimaryOrderSlot(full.primary_order_slot ?? full.primary_phase?.orderSlot ?? '')
        setSportId(full.sport_id ?? '')
        setSkillLevel(full.skill_level ?? '')
        setVisibility(full.visibility ?? 'facility')
        setParticipantStructure(full.participant_structure ?? 'individual')
        setRequirements(full.movement_requirements ?? {})
        setTags((full.tags ?? []).filter((t) => t.facetType !== 'intent'))
        setPhaseProfiles(full.phase_profiles ?? [])
        setWhy(full.why ?? {})
        setCoachingExec(full.coaching_execution ?? { movement_description: full.description ?? '' })
        setDosage({
          default_sets: full.default_sets ?? full.dosage_profiles?.[0]?.default_sets ?? '',
          default_reps: full.default_reps ?? full.dosage_profiles?.[0]?.default_reps ?? '',
          default_work_seconds: full.default_work_seconds ?? full.dosage_profiles?.[0]?.default_work_seconds ?? '',
          default_rest_seconds: full.default_rest_seconds ?? full.dosage_profiles?.[0]?.default_rest_seconds ?? '',
          est_seconds_per_set: full.est_seconds_per_set ?? full.dosage_profiles?.[0]?.est_seconds_per_set ?? 45,
          volume_unit: full.dosage_profiles?.[0]?.volume_unit ?? 'reps',
          session_volume_min: full.dosage_profiles?.[0]?.session_volume_min ?? '',
          session_volume_max: full.dosage_profiles?.[0]?.session_volume_max ?? '',
          default_rpe_min: full.dosage_profiles?.[0]?.default_rpe_min ?? '',
          default_rpe_max: full.dosage_profiles?.[0]?.default_rpe_max ?? '',
        })
        const cohorts: Partial<Record<ScalingCohortKey, ExerciseScalingProfile>> = {}
        for (const key of SCALING_COHORT_KEYS) {
          const row = (full.scaling_profiles ?? []).find((s) => s.cohort_key === key)
          if (row) cohorts[key] = row
        }
        setCohortScaling(cohorts)
        const notesRow = (full.scaling_profiles ?? []).find((s) => s.gender_specific_notes)
        setGenderSpecificNotes(notesRow?.gender_specific_notes ?? '')
        setScalableVariables(full.scalable_variables ?? [])
        setPairing(full.pairing_logic ?? {
          pairs_well_before: full.programming_logic?.recommended_preceded_by,
          pairs_well_after: full.programming_logic?.recommended_followed_by,
          good_for_sessions: full.programming_logic?.best_used_for,
          do_not_use_when: full.programming_logic?.avoid_when,
        })
        setSafetyProfile(full.safety_profile ?? {})
        setRegimenRule(full.regimen_rule ?? {})
        setMediaLib(full.media_library ?? {})
        setMedia(full.media ?? [])
        setAgeMin(full.age_min ?? full.difficulty_profile?.recommended_age_min ?? '')
        setAgeMax(full.age_max ?? full.difficulty_profile?.recommended_age_max ?? '')
        setDifficultyProfile(full.difficulty_profile ?? {
          technical: 3,
          load: 3,
          complexity: 3,
          overall: 3,
          attention_demand: 'low',
        })
      })
      .catch(() => {/* keep defaults */})
    coachFetch<{ ready: boolean; issues: string[] }>(`/api/coach/exercises/${exercise.id}/publish-check`)
      .then(setPublishCheck)
      .catch(() => setPublishCheck(null))
  }, [exercise])

  const toggleTag = (facetType: FacetType, facetId: number) => {
    setTags((current) => {
      const exists = current.find((t) => t.facetType === facetType && t.facetId === facetId)
      if (exists) return current.filter((t) => !(t.facetType === facetType && t.facetId === facetId))
      return [...current, { facetType, facetId, weight: 3 }]
    })
  }

  const suggestTags = async () => {
    try {
      const data = await coachFetch<{ suggestions: Array<{ facetType: FacetType; facetId: number; weight: number }> }>(
        '/api/coach/ai/autotag',
        { method: 'POST', body: JSON.stringify({ name, description: coachingExec.movement_description }) },
      )
      setTags((current) => {
        const merged = [...current]
        for (const s of data.suggestions) {
          if (s.facetType === 'intent') continue
          if (!merged.some((t) => t.facetType === s.facetType && t.facetId === s.facetId)) {
            merged.push({ facetType: s.facetType, facetId: s.facetId, weight: s.weight })
          }
        }
        return merged
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not suggest tags')
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const scaling: Record<string, unknown> = { gender_specific_notes: genderSpecificNotes || null }
      for (const key of SCALING_COHORT_KEYS) {
        const c = cohortScaling[key]
        if (c) scaling[key] = { ...c, cohort_key: key, label: c.label || COHORT_LABELS[key] }
      }

      const body = {
        name,
        description: coachingExec.movement_description || null,
        sport_id: sportId || null,
        skill_level: skillLevel || null,
        age_min: ageMin === '' ? null : Number(ageMin),
        age_max: ageMax === '' ? null : Number(ageMax),
        default_sets: dosage.default_sets || null,
        default_reps: dosage.default_reps || null,
        default_work_seconds: dosage.default_work_seconds || null,
        default_rest_seconds: dosage.default_rest_seconds || null,
        est_seconds_per_set: Number(dosage.est_seconds_per_set) || 45,
        visibility,
        participant_structure: participantStructure,
        card_summary: cardSummary || null,
        coach_language: coachLanguage || null,
        athlete_language: athleteLanguage || null,
        movement_identity: {
          movement_family: movementFamily || null,
          phase_key: primaryPhaseKey || null,
          phase_subrole: displayedSubrole || null,
          order_slot: primaryOrderSlot || null,
          subrole_override: subroleOverride,
        },
        subrole_override: subroleOverride,
        movement_requirements: requirements,
        coaching_execution: coachingExec,
        pairing_logic: pairing,
        media_library: mediaLib,
        media: media.filter((m) => m.url.trim()),
        tags,
        why,
        why_layer: why,
        phase_profiles: phaseProfiles,
        scaling,
        scalable_variables: scalableVariables,
        safety_profile: {
          ...safetyProfile,
          requires_coach_supervision: safetyProfile.requires_coach_supervision ?? 'none',
        },
        regimen_rule: regimenRule,
        difficulty_profile: {
          technical: Number(difficultyProfile.technical) || 1,
          load: Number(difficultyProfile.load) || 1,
          complexity: Number(difficultyProfile.complexity) || 1,
          overall: computedOverall,
          recommended_age_min: ageMin === '' ? null : Number(ageMin),
          recommended_age_max: ageMax === '' ? null : Number(ageMax),
          attention_demand: difficultyProfile.attention_demand ?? 'low',
          notes: difficultyProfile.notes ?? null,
          source: 'authored',
        },
        dosage: {
          volume_unit: dosage.volume_unit,
          default_sets: dosage.default_sets || null,
          default_reps: dosage.default_reps || null,
          default_work_seconds: dosage.default_work_seconds || null,
          default_rest_seconds: dosage.default_rest_seconds || null,
          est_seconds_per_set: Number(dosage.est_seconds_per_set) || 45,
          session_volume_min: dosage.session_volume_min || null,
          session_volume_max: dosage.session_volume_max || null,
          default_rpe_min: dosage.default_rpe_min || null,
          default_rpe_max: dosage.default_rpe_max || null,
        },
      }
      if (exercise) {
        await coachFetch(`/api/coach/exercises/${exercise.id}`, { method: 'PUT', body: JSON.stringify(body) })
        const check = await coachFetch<{ ready: boolean; issues: string[] }>(`/api/coach/exercises/${exercise.id}/publish-check`)
        setPublishCheck(check)
      } else {
        await coachFetch('/api/coach/exercises', { method: 'POST', body: JSON.stringify(body) })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save exercise')
    } finally {
      setSaving(false)
    }
  }

  const facetGroups: Array<{ type: FacetType; label: string; items?: TaxonomyItem[] }> = [
    { type: 'tenet', label: 'Tenets', items: taxonomy?.tenets as TaxonomyItem[] | undefined },
    { type: 'methodology', label: 'Methodologies', items: taxonomy?.methodologies as TaxonomyItem[] | undefined },
    { type: 'physiology', label: 'Physiological Emphasis', items: taxonomy?.physiology as TaxonomyItem[] | undefined },
    { type: 'pattern', label: 'Movement Patterns', items: taxonomy?.patterns },
    { type: 'equipment', label: 'Equipment', items: taxonomy?.equipment },
    { type: 'body_region', label: 'Body Regions', items: taxonomy?.bodyRegions },
  ]

  const derivedSubrole = (primaryPhaseKey === 'prepare_and_access' || primaryPhaseKey === 'movement_intelligence' || primaryPhaseKey === 'capacity' || primaryPhaseKey === 'output') && primaryOrderSlot
    ? subroleForOrderSlot(taxonomy, primaryPhaseKey, primaryOrderSlot)
    : null
  const displayedSubrole = subroleOverride ? phaseSubrole : (derivedSubrole ?? phaseSubrole)

  const handlePrimaryOrderSlotChange = (slotKey: string) => {
    setPrimaryOrderSlot(slotKey)
    if (!subroleOverride && (primaryPhaseKey === 'prepare_and_access' || primaryPhaseKey === 'movement_intelligence' || primaryPhaseKey === 'capacity' || primaryPhaseKey === 'output') && slotKey) {
      const derived = subroleForOrderSlot(taxonomy, primaryPhaseKey, slotKey)
      if (derived) setPhaseSubrole(derived as PhaseSubrole)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[min(85vh,720px)] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-bold text-lg">{exercise ? 'Edit Exercise' : 'New Exercise'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 pt-3 flex flex-wrap gap-1 border-b border-gray-100 shrink-0 overflow-x-auto">
          {EDITOR_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${tab === t.id ? 'bg-vortex-red text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
          {publishCheck && (
            <div className={`rounded-lg px-4 py-2 text-sm flex items-start gap-2 ${publishCheck.ready ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>
              <CheckCircle2 className={`w-4 h-4 mt-0.5 ${publishCheck.ready ? 'text-green-600' : 'text-amber-600'}`} />
              <div>
                <div className="font-semibold">{publishCheck.ready ? 'Publish ready' : 'Publish checklist'}</div>
                {!publishCheck.ready && (
                  <ul className="list-disc ml-4 mt-1 text-xs">{publishCheck.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
                )}
              </div>
            </div>
          )}

          {tab === 'identity' && (
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <label className="md:col-span-2"><span className="font-semibold text-gray-700">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label className="md:col-span-2"><span className="font-semibold text-gray-700">Card summary</span>
                <textarea value={cardSummary} onChange={(e) => setCardSummary(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Movement family</span>
                <input value={movementFamily} onChange={(e) => setMovementFamily(e.target.value)} placeholder="e.g. Dynamic hip opener" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Primary session phase</span>
                <select value={primaryPhaseKey} onChange={(e) => setPrimaryPhaseKey(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">Select...</option>
                  {(taxonomy?.sessionPhases ?? []).map((p) => <option key={p.id} value={p.key}>{p.name}</option>)}
                </select>
              </label>
              {(primaryPhaseKey === 'prepare_and_access' || primaryPhaseKey === 'movement_intelligence') && (
                <>
                  <label className="md:col-span-2"><span className="font-semibold text-gray-700">Order slot (fine programming layer)</span>
                    <GroupedOrderSlotSelect
                      phaseKey={primaryPhaseKey}
                      value={primaryOrderSlot}
                      onChange={handlePrimaryOrderSlotChange}
                      taxonomy={taxonomy}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {primaryPhaseKey === 'prepare_and_access'
                        ? 'RAMP sequence: Raise → Mobilize → Activate → Integrate → Potentiate Bridge. Pick the fine slot; subrole is derived automatically.'
                        : 'Skill sequence: Shape → Rotation → Locomotion → Balance → Perception-Action. Pick the fine slot; subrole is derived automatically.'}
                    </p>
                  </label>
                  <div>
                    <span className="font-semibold text-gray-700">Phase subrole (derived)</span>
                    <div className="mt-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800">
                      {phaseSubroleLabel(displayedSubrole) ?? '—'}
                    </div>
                    <label className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                      <input type="checkbox" checked={subroleOverride} onChange={(e) => setSubroleOverride(e.target.checked)} />
                      Override subrole manually (edge cases only)
                    </label>
                  </div>
                  {subroleOverride && (
                    <label><span className="font-semibold text-gray-700">Manual subrole override</span>
                      <select value={phaseSubrole} onChange={(e) => setPhaseSubrole(e.target.value as PhaseSubrole | '')} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                        <option value="">None</option>
                        {PHASE_SUBROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  )}
                </>
              )}
              {primaryPhaseKey && primaryPhaseKey !== 'prepare_and_access' && primaryPhaseKey !== 'movement_intelligence' && (
                <label className="md:col-span-2"><span className="font-semibold text-gray-700">Order slot</span>
                  <GroupedOrderSlotSelect
                    phaseKey={primaryPhaseKey}
                    value={primaryOrderSlot}
                    onChange={setPrimaryOrderSlot}
                    taxonomy={taxonomy}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </label>
              )}
              <label><span className="font-semibold text-gray-700">Sport</span>
                <select value={sportId} onChange={(e) => setSportId(e.target.value ? Number(e.target.value) : '')} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">Universal</option>
                  {taxonomy?.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label><span className="font-semibold text-gray-700">Skill level</span>
                <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">Any</option>
                  {['EARLY_STAGE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((l) => <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
              <label className="md:col-span-2"><span className="font-semibold text-gray-700">Coach language</span>
                <textarea value={coachLanguage} onChange={(e) => setCoachLanguage(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label className="md:col-span-2"><span className="font-semibold text-gray-700">Athlete language</span>
                <textarea value={athleteLanguage} onChange={(e) => setAthleteLanguage(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Visibility</span>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'facility' | 'private')} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="facility">Facility (shared)</option>
                  <option value="private">Private</option>
                </select>
              </label>
              <label><span className="font-semibold text-gray-700">Participants</span>
                <select value={participantStructure} onChange={(e) => setParticipantStructure(e.target.value as ParticipantStructure)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  {PARTICIPANT_STRUCTURE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">How many athletes the drill needs. Spotters don't count as pairs.</p>
              </label>
            </div>
          )}

          {tab === 'requirements' && (
            <div className="space-y-4 text-sm">
              <CommaListInput label="Primary joint actions" value={requirements.primary_joint_actions ?? []} onChange={(v) => setRequirements({ ...requirements, primary_joint_actions: v })} />
              <CommaListInput label="Primary tissues" value={requirements.primary_tissues ?? []} onChange={(v) => setRequirements({ ...requirements, primary_tissues: v })} />
              <CommaListInput label="Motor control demands" value={requirements.primary_motor_control_demands ?? []} onChange={(v) => setRequirements({ ...requirements, primary_motor_control_demands: v })} />
              <div className="grid md:grid-cols-2 gap-3">
                {(['postural_shape', 'breathing_demand', 'balance_demand', 'coordination_demand'] as const).map((key) => (
                  <label key={key}><span className="font-semibold text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                    <input value={requirements[key] ?? ''} onChange={(e) => setRequirements({ ...requirements, [key]: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </label>
                ))}
                <label><span className="font-semibold text-gray-700">Impact level (0-5)</span>
                  <input type="number" min={0} max={5} value={requirements.impact_level ?? ''} onChange={(e) => setRequirements({ ...requirements, impact_level: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
              </div>
            </div>
          )}

          {tab === 'taxonomy' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button type="button" onClick={() => void suggestTags()} disabled={!name} className="flex items-center gap-1 text-sm text-vortex-red border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-50">
                  <Sparkles className="w-4 h-4" /> Suggest tags
                </button>
              </div>
              {facetGroups.map((group) => (
                <div key={group.type}>
                  <div className="text-sm font-semibold text-gray-700 mb-2">{group.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {(group.items ?? []).map((item) => {
                      const active = tags.find((t) => t.facetType === group.type && t.facetId === item.id)
                      return (
                        <div key={item.id} className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${active ? 'border-vortex-red bg-red-50 text-vortex-red' : 'border-gray-200 text-gray-600'}`}>
                          <button type="button" onClick={() => toggleTag(group.type, item.id)}>{item.name}</button>
                          {active && (
                            <select value={active.weight} onChange={(e) => setTags(tags.map((t) => (t.facetType === group.type && t.facetId === item.id ? { ...t, weight: Number(e.target.value) } : t)))} className="bg-transparent text-[11px] outline-none">
                              {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>{w}</option>)}
                            </select>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'phase' && (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-gray-500">Full multi-phase matrix for Needs Engine. Primary role syncs to Movement Identity on save.</p>
              {(taxonomy?.sessionPhases ?? []).map((phase) => {
                const profile = phaseProfiles.find((p) => p.phaseKey === phase.key)
                const upsert = (patch: Partial<ExercisePhaseProfile>) => {
                  const rest = phaseProfiles.filter((p) => p.phaseKey !== phase.key)
                  if (!profile && !patch.role) return
                  setPhaseProfiles([...rest, { ...profile, phaseId: phase.id, phaseKey: phase.key, phaseName: phase.name, fitWeight: 3, role: 'secondary', ...patch } as ExercisePhaseProfile])
                }
                return (
                  <div key={phase.id} className={`border rounded-lg p-3 space-y-2 ${profile?.role === 'primary' ? 'border-vortex-red bg-red-50/30' : 'border-gray-200'}`}>
                    <div className="font-semibold text-gray-800 flex items-center gap-2">
                      {phase.name}
                      {profile?.role === 'primary' && <span className="text-[10px] bg-vortex-red text-white rounded px-1.5 py-0.5">Primary for card</span>}
                    </div>
                    <div className="grid md:grid-cols-4 gap-2">
                      <select value={profile?.role ?? ''} onChange={(e) => {
                        const role = e.target.value as ExercisePhaseProfile['role'] | ''
                        const rest = phaseProfiles.filter((p) => p.phaseKey !== phase.key)
                        if (!role) { setPhaseProfiles(rest); return }
                        setPhaseProfiles([...rest, { phaseId: phase.id, phaseKey: phase.key, phaseName: phase.name, fitWeight: profile?.fitWeight ?? 3, role }])
                      }} className="border border-gray-300 rounded px-2 py-1">
                        <option value="">Not set</option>
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                        <option value="conditional">Conditional</option>
                        <option value="avoid">Avoid</option>
                      </select>
                      <input type="number" min={1} max={5} value={profile?.fitWeight ?? 3} disabled={!profile} onChange={(e) => upsert({ fitWeight: Number(e.target.value) })} className="border border-gray-300 rounded px-2 py-1" placeholder="Fit 1-5" />
                      <GroupedOrderSlotSelect
                        phaseKey={phase.key}
                        value={profile?.orderSlot ?? ''}
                        disabled={!profile}
                        onChange={(key) => upsert({ orderSlot: key || null })}
                        taxonomy={taxonomy}
                        className="border border-gray-300 rounded px-2 py-1 md:col-span-2"
                      />
                    </div>
                    {profile && (
                      <div className="grid md:grid-cols-4 gap-2">
                        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={profile.freshnessRequired ?? false} onChange={(e) => upsert({ freshnessRequired: e.target.checked })} /> Freshness</label>
                        <input type="number" min={1} max={5} value={profile.fatigueCost ?? 3} onChange={(e) => upsert({ fatigueCost: Number(e.target.value) })} className="border border-gray-300 rounded px-2 py-1" placeholder="Fatigue cost" />
                        <input type="number" min={0} max={5} value={profile.impactLevel ?? 1} onChange={(e) => upsert({ impactLevel: Number(e.target.value) })} className="border border-gray-300 rounded px-2 py-1" placeholder="Impact" />
                        <select value={profile.intensityCeiling ?? ''} onChange={(e) => upsert({ intensityCeiling: e.target.value || null })} className="border border-gray-300 rounded px-2 py-1">
                          <option value="">Intensity ceiling</option>
                          <option value="low">Low</option>
                          <option value="moderate">Moderate</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={regimenRule.can_be_daily ?? false} onChange={(e) => setRegimenRule({ ...regimenRule, can_be_daily: e.target.checked })} /> Daily OK (regimen)</label>
            </div>
          )}

          {tab === 'why' && (
            <div className="space-y-3 text-sm">
              {([
                ['training_purpose', 'Training purpose'],
                ['why_it_works', 'Why it works'],
                ['tenet_rationale', 'Tenet rationale'],
                ['methodology_rationale', 'Methodology rationale'],
                ['physiological_rationale', 'Physiological rationale'],
                ['phase_rationale', 'Phase rationale'],
                ['order_rationale', 'Order rationale'],
                ['fatigue_rationale', 'Fatigue rationale'],
                ['scaling_rationale', 'Scaling rationale'],
                ['common_misuse', 'Common misuse'],
              ] as const).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="font-semibold text-gray-700">{label}</span>
                  <textarea value={why[key] ?? ''} onChange={(e) => setWhy({ ...why, [key]: e.target.value })} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
              ))}
            </div>
          )}

          {tab === 'execution' && (
            <div className="space-y-4 text-sm">
              <label className="block"><span className="font-semibold text-gray-700">Movement description</span>
                <textarea value={coachingExec.movement_description ?? ''} onChange={(e) => setCoachingExec({ ...coachingExec, movement_description: e.target.value })} rows={3} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <StringListEditor label="Setup" items={coachingExec.setup ?? []} onChange={(v) => setCoachingExec({ ...coachingExec, setup: v })} placeholder="Setup step" />
              <StringListEditor label="Execution steps" items={coachingExec.execution_steps ?? []} onChange={(v) => setCoachingExec({ ...coachingExec, execution_steps: v })} placeholder="Step" />
              <StringListEditor label="Breathing cues" items={coachingExec.breathing_cues ?? []} onChange={(v) => setCoachingExec({ ...coachingExec, breathing_cues: v })} />
              <StringListEditor label="Coach cues" items={coachingExec.coach_cues ?? []} onChange={(v) => setCoachingExec({ ...coachingExec, coach_cues: v })} />
              <StringListEditor label="Athlete cues" items={coachingExec.athlete_cues ?? []} onChange={(v) => setCoachingExec({ ...coachingExec, athlete_cues: v })} />
              <StringListEditor label="Quality gates" items={coachingExec.quality_gate ?? []} onChange={(v) => setCoachingExec({ ...coachingExec, quality_gate: v })} />
              <StringListEditor label="Common faults" items={coachingExec.common_faults ?? []} onChange={(v) => setCoachingExec({ ...coachingExec, common_faults: v })} />
              <StringListEditor label="Stop signs" items={coachingExec.stop_signs ?? []} onChange={(v) => setCoachingExec({ ...coachingExec, stop_signs: v })} />
            </div>
          )}

          {tab === 'dosage' && (
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <label><span className="font-semibold text-gray-700">Volume unit</span>
                <select value={dosage.volume_unit} onChange={(e) => setDosage({ ...dosage, volume_unit: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  {['reps', 'seconds', 'breaths', 'distance', 'contacts', 'rounds', 'attempts', 'intervals'].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label><span className="font-semibold text-gray-700">Est sec/set</span>
                <input type="number" value={dosage.est_seconds_per_set} onChange={(e) => setDosage({ ...dosage, est_seconds_per_set: Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Default sets</span>
                <input type="number" value={dosage.default_sets} onChange={(e) => setDosage({ ...dosage, default_sets: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Default reps</span>
                <input type="number" value={dosage.default_reps} onChange={(e) => setDosage({ ...dosage, default_reps: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Work seconds</span>
                <input type="number" value={dosage.default_work_seconds} onChange={(e) => setDosage({ ...dosage, default_work_seconds: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Rest seconds</span>
                <input type="number" value={dosage.default_rest_seconds} onChange={(e) => setDosage({ ...dosage, default_rest_seconds: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">RPE min</span>
                <input type="number" min={1} max={10} value={dosage.default_rpe_min} onChange={(e) => setDosage({ ...dosage, default_rpe_min: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">RPE max</span>
                <input type="number" min={1} max={10} value={dosage.default_rpe_max} onChange={(e) => setDosage({ ...dosage, default_rpe_max: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Session volume min</span>
                <input type="number" value={dosage.session_volume_min} onChange={(e) => setDosage({ ...dosage, session_volume_min: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Session volume max</span>
                <input type="number" value={dosage.session_volume_max} onChange={(e) => setDosage({ ...dosage, session_volume_max: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
            </div>
          )}

          {tab === 'scaling' && (
            <div className="space-y-4 text-sm">
              <p className="text-xs text-gray-500">Scale by age, training age, mobility, coordination, and readiness — not gender-specific default prescriptions. Youth: keep varied and age-appropriate. Pregnancy/postpartum: medical clearance when flagged.</p>
              <div>
                <span className="font-semibold text-gray-700">Scalable variables</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {SCALABLE_VAR_OPTIONS.map((v) => {
                    const active = scalableVariables.includes(v)
                    return (
                      <button key={v} type="button" onClick={() => setScalableVariables(active ? scalableVariables.filter((x) => x !== v) : [...scalableVariables, v])} className={`rounded-full border px-2 py-1 text-xs ${active ? 'border-vortex-red bg-red-50 text-vortex-red' : 'border-gray-200 text-gray-600'}`}>{v}</button>
                    )
                  })}
                </div>
              </div>
              <label className="block"><span className="font-semibold text-gray-700">Gender-specific notes (optional, not separate prescriptions)</span>
                <textarea value={genderSpecificNotes} onChange={(e) => setGenderSpecificNotes(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              {SCALING_COHORT_KEYS.map((key) => {
                const c = cohortScaling[key] ?? { label: COHORT_LABELS[key] }
                const setC = (patch: Partial<ExerciseScalingProfile>) => setCohortScaling({ ...cohortScaling, [key]: { ...c, ...patch, cohort_key: key } })
                return (
                  <div key={key} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="font-semibold text-gray-800">{COHORT_LABELS[key]}</div>
                    {key === 'pregnancy_postpartum' && (
                      <label className="flex items-center gap-2 text-xs text-amber-800">
                        <input type="checkbox" checked={c.requires_medical_clearance ?? false} onChange={(e) => setC({ requires_medical_clearance: e.target.checked })} />
                        Requires medical clearance (ACOG: continue/modify with provider guidance)
                      </label>
                    )}
                    <textarea value={c.load_guidance ?? ''} onChange={(e) => setC({ load_guidance: e.target.value })} placeholder="Load guidance" rows={2} className="w-full border border-gray-300 rounded px-2 py-1" />
                    <textarea value={c.complexity_guidance ?? ''} onChange={(e) => setC({ complexity_guidance: e.target.value })} placeholder="Complexity / coaching modifications" rows={2} className="w-full border border-gray-300 rounded px-2 py-1" />
                    <textarea value={c.coach_notes ?? ''} onChange={(e) => setC({ coach_notes: e.target.value })} placeholder="Coach notes" rows={2} className="w-full border border-gray-300 rounded px-2 py-1" />
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'difficulty' && (
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <p className="md:col-span-2 text-xs text-gray-500">
                Rate each exercise 1–10. Overall is computed as the max of technical, load, and complexity. Used by Needs Engine and library filters for age-appropriate programming.
              </p>
              <label><span className="font-semibold text-gray-700">Technical difficulty (1–10)</span>
                <input type="number" min={1} max={10} value={difficultyProfile.technical ?? 3} onChange={(e) => setDifficultyProfile({ ...difficultyProfile, technical: Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Load difficulty (1–10)</span>
                <input type="number" min={1} max={10} value={difficultyProfile.load ?? 3} onChange={(e) => setDifficultyProfile({ ...difficultyProfile, load: Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Complexity / attention (1–10)</span>
                <input type="number" min={1} max={10} value={difficultyProfile.complexity ?? 3} onChange={(e) => setDifficultyProfile({ ...difficultyProfile, complexity: Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Overall (computed)</span>
                <input type="number" value={computedOverall} readOnly className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50" />
              </label>
              <label><span className="font-semibold text-gray-700">Recommended age min</span>
                <input type="number" min={0} value={ageMin} onChange={(e) => setAgeMin(e.target.value ? Number(e.target.value) : '')} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Recommended age max</span>
                <input type="number" min={0} value={ageMax} onChange={(e) => setAgeMax(e.target.value ? Number(e.target.value) : '')} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Attention demand</span>
                <select value={difficultyProfile.attention_demand ?? 'low'} onChange={(e) => setDifficultyProfile({ ...difficultyProfile, attention_demand: e.target.value as ExerciseDifficultyProfile['attention_demand'] })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="md:col-span-2"><span className="font-semibold text-gray-700">Notes</span>
                <textarea value={difficultyProfile.notes ?? ''} onChange={(e) => setDifficultyProfile({ ...difficultyProfile, notes: e.target.value })} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="e.g. Fine for attentive 5s with regression" />
              </label>
            </div>
          )}

          {tab === 'pairing' && (
            <div className="space-y-3 text-sm">
              <CommaListInput label="Pairs well before" value={pairing.pairs_well_before ?? []} onChange={(v) => setPairing({ ...pairing, pairs_well_before: v })} />
              <CommaListInput label="Pairs well after" value={pairing.pairs_well_after ?? []} onChange={(v) => setPairing({ ...pairing, pairs_well_after: v })} />
              <CommaListInput label="Good for sessions" value={pairing.good_for_sessions ?? []} onChange={(v) => setPairing({ ...pairing, good_for_sessions: v })} />
              <CommaListInput label="Avoid before" value={pairing.avoid_before ?? []} onChange={(v) => setPairing({ ...pairing, avoid_before: v })} />
              <CommaListInput label="Avoid after" value={pairing.avoid_after ?? []} onChange={(v) => setPairing({ ...pairing, avoid_after: v })} />
              <CommaListInput label="Do not use when" value={pairing.do_not_use_when ?? []} onChange={(v) => setPairing({ ...pairing, do_not_use_when: v })} />
            </div>
          )}

          {tab === 'safety' && (
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <label><span className="font-semibold text-gray-700">Risk level (1-5)</span>
                <input type="number" min={1} max={5} value={safetyProfile.risk_level ?? 2} onChange={(e) => setSafetyProfile({ ...safetyProfile, risk_level: Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Impact level (0-5)</span>
                <input type="number" min={0} max={5} value={safetyProfile.impact_level ?? 1} onChange={(e) => setSafetyProfile({ ...safetyProfile, impact_level: Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label><span className="font-semibold text-gray-700">Supervision</span>
                <select value={safetyProfile.requires_coach_supervision ?? 'none'} onChange={(e) => setSafetyProfile({ ...safetyProfile, requires_coach_supervision: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="none">None</option>
                  <option value="recommended">Recommended</option>
                  <option value="required">Required</option>
                </select>
              </label>
              <label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" checked={safetyProfile.requires_spotting ?? false} onChange={(e) => setSafetyProfile({ ...safetyProfile, requires_spotting: e.target.checked })} /> Requires spotting</label>
              <div className="md:col-span-2"><CommaListInput label="Readiness checks" value={safetyProfile.readiness_checks ?? []} onChange={(v) => setSafetyProfile({ ...safetyProfile, readiness_checks: v })} /></div>
              <div className="md:col-span-2"><CommaListInput label="Contraindications" value={safetyProfile.contraindications ?? []} onChange={(v) => setSafetyProfile({ ...safetyProfile, contraindications: v })} /></div>
              <div className="md:col-span-2"><CommaListInput label="Substitutions" value={safetyProfile.common_substitutions ?? []} onChange={(v) => setSafetyProfile({ ...safetyProfile, common_substitutions: v })} /></div>
            </div>
          )}

          {tab === 'media' && (
            <div className="space-y-4 text-sm">
              <StringListEditor label="Demo video URLs" items={mediaLib.demo_video_sources ?? []} onChange={(v) => setMediaLib({ ...mediaLib, demo_video_sources: v })} placeholder="https://..." />
              <StringListEditor label="Coaching articles" items={mediaLib.coaching_articles ?? []} onChange={(v) => setMediaLib({ ...mediaLib, coaching_articles: v })} />
              <StringListEditor label="Clinical / sport science references" items={mediaLib.clinical_or_sport_science_references ?? []} onChange={(v) => setMediaLib({ ...mediaLib, clinical_or_sport_science_references: v })} />
              <StringListEditor label="Internal notes" items={mediaLib.internal_notes ?? []} onChange={(v) => setMediaLib({ ...mediaLib, internal_notes: v })} />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-700">Hosted media (Cloudinary)</span>
                  <button type="button" onClick={() => setMedia([...media, { kind: 'video', url: '', caption: '' }])} className="text-vortex-red text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
                </div>
                {media.map((m, i) => (
                  <div key={i} className="grid grid-cols-[90px_1fr_auto] gap-2 items-center mb-2">
                    <select value={m.kind} onChange={(e) => setMedia(media.map((x, j) => j === i ? { ...x, kind: e.target.value as ExerciseMedia['kind'] } : x))} className="border border-gray-300 rounded px-2 py-1">
                      <option value="video">Video</option>
                      <option value="image">Image</option>
                      <option value="diagram">Diagram</option>
                    </select>
                    <input value={m.url} onChange={(e) => setMedia(media.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="URL" className="border border-gray-300 rounded px-2 py-1" />
                    <button type="button" onClick={() => setMedia(media.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving || !name} className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Exercise'}
          </button>
        </div>
      </div>
    </div>
  )
}
