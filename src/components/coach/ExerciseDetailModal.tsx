import { useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import type { Exercise, ExercisePhaseProfile, ExerciseTag } from '../../coach/types'
import type { FacetType, Taxonomy } from '../../coach/taxonomy'
import { FACET_LABELS } from '../../coach/taxonomy'
import { exerciseFitnessGoal, exerciseToCard, phaseSubroleLabel } from '../../coach/exerciseCard'
import { participantStructureLabel, SCALING_COHORT_KEYS } from '../../coach/types'

type DetailTab =
  | 'identity'
  | 'requirements'
  | 'taxonomy'
  | 'phase'
  | 'why'
  | 'execution'
  | 'dosage'
  | 'scaling'
  | 'pairing'
  | 'safety'
  | 'media'

const TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'identity', label: 'Identity' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'taxonomy', label: 'Taxonomy' },
  { id: 'phase', label: 'Phase' },
  { id: 'why', label: 'Why' },
  { id: 'execution', label: 'Execution' },
  { id: 'dosage', label: 'Dosage' },
  { id: 'scaling', label: 'Scaling' },
  { id: 'pairing', label: 'Pairing' },
  { id: 'safety', label: 'Safety' },
  { id: 'media', label: 'Media & Docs' },
]

function facetNameMap(taxonomy: Taxonomy | null): Map<string, string> {
  const map = new Map<string, string>()
  if (!taxonomy) return map
  const groups: Array<{ type: FacetType; items?: Array<{ id?: number; name: string }> }> = [
    { type: 'tenet', items: taxonomy.tenets },
    { type: 'methodology', items: taxonomy.methodologies },
    { type: 'physiology', items: taxonomy.physiology },
    { type: 'pattern', items: taxonomy.patterns },
    { type: 'equipment', items: taxonomy.equipment },
    { type: 'sport', items: taxonomy.sports },
    { type: 'body_region', items: taxonomy.bodyRegions },
  ]
  for (const g of groups) {
    for (const item of g.items ?? []) {
      if (item.id != null) map.set(`${g.type}:${item.id}`, item.name)
    }
  }
  return map
}

const EXERCISE_MODAL_SHELL =
  'bg-white rounded-xl w-full max-w-4xl h-[min(85vh,720px)] overflow-hidden flex flex-col shadow-xl'

const EXERCISE_MODAL_BODY = 'flex-1 min-h-0 overflow-y-auto p-5 space-y-4'

function ReadOnlyField({ label, value }: { label: string; value?: string | number | null }) {
  const text = value != null && String(value).trim() !== '' ? String(value) : null
  if (!text) return null
  return (
    <div className="text-sm">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <p className="text-gray-800 mt-0.5 whitespace-pre-wrap">{text}</p>
    </div>
  )
}

function ReadOnlyList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="text-sm">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <ul className="mt-1 list-disc ml-4 text-gray-800 space-y-0.5">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  )
}

function BoolRow({ label, value }: { label: string; value?: boolean }) {
  if (value == null) return null
  return (
    <div className="text-sm flex items-center justify-between gap-4 py-1 border-b border-gray-50 last:border-0">
      <span className="text-gray-700">{label}</span>
      <span className={`text-xs font-medium rounded px-2 py-0.5 ${value ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
        {value ? 'Yes' : 'No'}
      </span>
    </div>
  )
}

function PhaseProfileView({ profile }: { profile: ExercisePhaseProfile }) {
  const details: string[] = []
  details.push(`Role: ${profile.role}`)
  details.push(`Fit ${profile.fitWeight}/5`)
  if (profile.orderSlot) details.push(`Order slot: ${profile.orderSlot}`)
  if (profile.freshnessRequired) details.push('Freshness required')
  if (profile.fatigueCost != null) details.push(`Fatigue cost ${profile.fatigueCost}`)
  if (profile.impactLevel != null) details.push(`Impact ${profile.impactLevel}`)
  if (profile.fatigueSensitivity != null) details.push(`Fatigue sensitivity ${profile.fatigueSensitivity}`)
  if (profile.intensityCeiling) details.push(`Intensity ceiling: ${profile.intensityCeiling}`)
  if (profile.notes) details.push(profile.notes)
  return (
    <div className="border border-gray-200 rounded-lg p-3 text-sm">
      <div className="font-semibold text-gray-900">{profile.phaseName}</div>
      <p className="text-gray-600 mt-1 text-xs">{details.join(' · ')}</p>
    </div>
  )
}

export default function ExerciseDetailModal({
  exerciseId,
  preview,
  onClose,
  onEdit,
}: {
  exerciseId: number
  preview?: Exercise | null
  onClose: () => void
  onEdit?: () => void
}) {
  const { taxonomy } = useTaxonomy()
  const [exercise, setExercise] = useState<Exercise | null>(preview ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<DetailTab>('identity')

  const facetNames = useMemo(() => facetNameMap(taxonomy), [taxonomy])
  const tenetName = useMemo(() => {
    const map = new Map<number, string>()
    taxonomy?.tenets.forEach((t) => { if (t.id != null) map.set(Number(t.id), t.name) })
    return map
  }, [taxonomy])

  useEffect(() => {
    setLoading(true)
    setError(null)
    coachFetch<Exercise>(`/api/coach/exercises/${exerciseId}`)
      .then(setExercise)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load exercise'))
      .finally(() => setLoading(false))
  }, [exerciseId])

  const tagsByFacet = useMemo(() => {
    const grouped = new Map<FacetType, ExerciseTag[]>()
    for (const tag of exercise?.tags ?? []) {
      if (tag.facetType === 'intent') continue
      const list = grouped.get(tag.facetType) ?? []
      list.push(tag)
      grouped.set(tag.facetType, list)
    }
    return grouped
  }, [exercise?.tags])

  const card = useMemo(() => (exercise ? exerciseToCard(exercise, taxonomy) : null), [exercise, taxonomy])

  const why = exercise?.why

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={EXERCISE_MODAL_SHELL}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-gray-900 truncate">{exercise?.name ?? preview?.name ?? 'Exercise'}</h3>
            {exercise && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{exerciseFitnessGoal(exercise, tenetName)}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <button type="button" onClick={onEdit} className="flex items-center gap-1 text-sm text-vortex-red font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:border-vortex-red">
                <Pencil className="w-4 h-4" /> Edit
              </button>
            )}
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading && !exercise && (
          <div className="flex-1 min-h-0 flex items-center justify-center gap-2 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading exercise...
          </div>
        )}
        {error && (
          <div className={`${EXERCISE_MODAL_BODY} flex items-start`}>
            <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm w-full">{error}</div>
          </div>
        )}

        {exercise && !error && (
          <>
            <div className="px-5 pt-3 flex flex-wrap gap-1 border-b border-gray-100 shrink-0 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${tab === t.id ? 'bg-vortex-red text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className={EXERCISE_MODAL_BODY}>
              {card && tab === 'identity' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <ReadOnlyField label="Card summary" value={card.movement_identity.card_summary} />
                  <ReadOnlyField label="Movement family" value={card.movement_identity.movement_family} />
                  <ReadOnlyField label="Primary phase" value={card.movement_identity.phase_key?.replace(/_/g, ' ')} />
                  <ReadOnlyField label="Phase subrole" value={phaseSubroleLabel(card.movement_identity.phase_subrole)} />
                  <ReadOnlyField label="Order slot" value={card.movement_identity.order_slot} />
                  <ReadOnlyField label="Sport" value={card.movement_identity.sport_name ?? 'Universal'} />
                  <ReadOnlyField label="Skill level" value={card.movement_identity.skill_level?.replace(/_/g, ' ')} />
                  <ReadOnlyField label="Visibility" value={card.movement_identity.visibility === 'private' ? 'Private' : 'Facility (shared)'} />
                  <ReadOnlyField label="Participants" value={participantStructureLabel(card.movement_identity.participant_structure)} />
                  <ReadOnlyField label="Coach language" value={card.movement_identity.coach_language} />
                  <ReadOnlyField label="Athlete language" value={card.movement_identity.athlete_language} />
                </div>
              )}

              {card && tab === 'requirements' && (
                <div className="space-y-4">
                  <ReadOnlyList label="Joint actions" items={card.movement_requirements.primary_joint_actions ?? []} />
                  <ReadOnlyList label="Tissues" items={card.movement_requirements.primary_tissues ?? []} />
                  <ReadOnlyList label="Motor control" items={card.movement_requirements.primary_motor_control_demands ?? []} />
                  <div className="grid md:grid-cols-2 gap-4">
                    <ReadOnlyField label="Postural shape" value={card.movement_requirements.postural_shape} />
                    <ReadOnlyField label="Breathing demand" value={card.movement_requirements.breathing_demand} />
                    <ReadOnlyField label="Balance demand" value={card.movement_requirements.balance_demand} />
                    <ReadOnlyField label="Coordination demand" value={card.movement_requirements.coordination_demand} />
                    <ReadOnlyField label="Impact level" value={card.movement_requirements.impact_level} />
                  </div>
                </div>
              )}

              {tab === 'taxonomy' && (
                <div className="space-y-4">
                  {Array.from(tagsByFacet.entries()).map(([facetType, tags]) => (
                    <div key={facetType}>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{FACET_LABELS[facetType]}</div>
                      <div className="flex flex-wrap gap-2">
                        {tags.sort((a, b) => b.weight - a.weight).map((tag) => (
                          <span key={`${tag.facetType}-${tag.facetId}`} className="text-xs rounded-full border border-vortex-red bg-red-50 text-vortex-red px-2.5 py-1">
                            {facetNames.get(`${tag.facetType}:${tag.facetId}`) ?? `#${tag.facetId}`}
                            <span className="text-red-400 ml-1">×{tag.weight}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {tagsByFacet.size === 0 && <p className="text-sm text-gray-500">No tags assigned.</p>}
                </div>
              )}

              {tab === 'phase' && (
                <div className="space-y-3">
                  {card?.phase_profile && (
                    <div className="border border-vortex-red/30 bg-red-50/40 rounded-lg p-3 text-sm mb-3">
                      <div className="font-semibold text-gray-900">Primary card profile</div>
                      <p className="text-xs text-gray-600 mt-1">
                        Role {card.phase_profile.role} · Fit {card.phase_profile.fit_weight}/5
                        {card.phase_profile.daily_ok ? ' · Daily OK' : ''}
                      </p>
                    </div>
                  )}
                  {(exercise.phase_profiles ?? []).length > 0
                    ? (exercise.phase_profiles ?? []).map((p) => <PhaseProfileView key={p.phaseKey} profile={p} />)
                    : <p className="text-sm text-gray-500">No session phase profiles.</p>}
                </div>
              )}

              {tab === 'why' && (
                <div className="space-y-4">
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
                    <ReadOnlyField key={key} label={label} value={why?.[key]} />
                  ))}
                  {!why && <p className="text-sm text-gray-500">No why-layer content yet.</p>}
                </div>
              )}

              {card && tab === 'execution' && (
                <div className="space-y-4">
                  <ReadOnlyField label="Movement description" value={card.coaching_execution.movement_description} />
                  <ReadOnlyList label="Setup" items={card.coaching_execution.setup ?? []} />
                  <ReadOnlyList label="Execution steps" items={card.coaching_execution.execution_steps ?? []} />
                  <ReadOnlyList label="Breathing cues" items={card.coaching_execution.breathing_cues ?? []} />
                  <ReadOnlyList label="Coach cues" items={card.coaching_execution.coach_cues ?? []} />
                  <ReadOnlyList label="Athlete cues" items={card.coaching_execution.athlete_cues ?? []} />
                  <ReadOnlyList label="Quality gates" items={card.coaching_execution.quality_gate ?? []} />
                  <ReadOnlyList label="Common faults" items={card.coaching_execution.common_faults ?? []} />
                  <ReadOnlyList label="Stop signs" items={card.coaching_execution.stop_signs ?? []} />
                </div>
              )}

              {card && tab === 'dosage' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <ReadOnlyField label="Volume unit" value={card.dosage.volume_unit} />
                  <ReadOnlyField label="Est. seconds per set" value={card.dosage.est_seconds_per_set} />
                  <ReadOnlyField label="Default sets" value={card.dosage.default_sets} />
                  <ReadOnlyField label="Default reps" value={card.dosage.default_reps} />
                  <ReadOnlyField label="Work seconds" value={card.dosage.default_work_seconds} />
                  <ReadOnlyField label="Rest seconds" value={card.dosage.default_rest_seconds} />
                  <ReadOnlyField label="RPE range" value={card.dosage.rpe_range} />
                  <ReadOnlyField label="Session volume" value={
                    card.dosage.session_volume_min != null || card.dosage.session_volume_max != null
                      ? `${card.dosage.session_volume_min ?? '—'} – ${card.dosage.session_volume_max ?? '—'}`
                      : null
                  } />
                </div>
              )}

              {card && tab === 'scaling' && (
                <div className="space-y-3">
                  {(card.scaling.scalable_variables?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {card.scaling.scalable_variables.map((v) => (
                        <span key={v} className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-0.5">{v}</span>
                      ))}
                    </div>
                  )}
                  <ReadOnlyField label="Gender-specific notes" value={card.scaling.gender_specific_notes} />
                  {SCALING_COHORT_KEYS.map((key) => {
                    const s = card.scaling.cohorts[key]
                    if (!s) return null
                    return (
                      <div key={key} className="border border-gray-200 rounded-lg p-3 text-sm">
                        <div className="font-semibold text-gray-900 capitalize">{key.replace(/_/g, ' ')}</div>
                        {s.requires_medical_clearance && <p className="text-xs text-amber-700 mt-1">Medical clearance required</p>}
                        <ReadOnlyField label="Load guidance" value={s.load_guidance} />
                        <ReadOnlyField label="Complexity guidance" value={s.complexity_guidance} />
                        <ReadOnlyField label="Coach notes" value={s.coach_notes} />
                      </div>
                    )
                  })}
                </div>
              )}

              {card && tab === 'pairing' && (
                <div className="space-y-4">
                  <ReadOnlyList label="Pairs well before" items={card.pairing_logic.pairs_well_before ?? []} />
                  <ReadOnlyList label="Pairs well after" items={card.pairing_logic.pairs_well_after ?? []} />
                  <ReadOnlyList label="Good for sessions" items={card.pairing_logic.good_for_sessions ?? []} />
                  <ReadOnlyList label="Avoid before" items={card.pairing_logic.avoid_before ?? []} />
                  <ReadOnlyList label="Avoid after" items={card.pairing_logic.avoid_after ?? []} />
                  <ReadOnlyList label="Do not use when" items={card.pairing_logic.do_not_use_when ?? []} />
                </div>
              )}

              {card && tab === 'safety' && card.safety_profile ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <ReadOnlyField label="Risk level" value={card.safety_profile.risk_level} />
                    <ReadOnlyField label="Impact level" value={card.safety_profile.impact_level} />
                    <ReadOnlyField label="Supervision" value={card.safety_profile.requires_supervision} />
                  </div>
                  <BoolRow label="Requires spotting" value={card.safety_profile.requires_spotting} />
                  <ReadOnlyList label="Readiness checks" items={card.safety_profile.readiness_checks ?? []} />
                  <ReadOnlyList label="Contraindications" items={card.safety_profile.contraindications ?? []} />
                  <ReadOnlyList label="Substitutions" items={card.safety_profile.substitutions ?? []} />
                </div>
              ) : tab === 'safety' ? (
                <p className="text-sm text-gray-500">No safety profile.</p>
              ) : null}

              {card && tab === 'media' && (
                <div className="space-y-4">
                  <ReadOnlyList label="Demo videos" items={card.media_and_document_library.demo_video_sources ?? []} />
                  <ReadOnlyList label="Coaching articles" items={card.media_and_document_library.coaching_articles ?? []} />
                  <ReadOnlyList label="References" items={card.media_and_document_library.clinical_or_sport_science_references ?? []} />
                  <ReadOnlyList label="Internal notes" items={card.media_and_document_library.internal_notes ?? []} />
                  {(card.media_and_document_library.media ?? []).length > 0 && (
                    <ul className="space-y-2">
                      {(card.media_and_document_library.media ?? []).map((m, i) => (
                        <li key={m.id ?? i} className="border border-gray-100 rounded-lg p-3 text-sm">
                          <div className="font-medium capitalize">{m.kind}</div>
                          <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-vortex-red text-xs break-all hover:underline">{m.url}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className="px-5 py-3 border-t border-gray-100 text-right shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
