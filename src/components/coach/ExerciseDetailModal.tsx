import { useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import type { Exercise, ExerciseCue, ExercisePhaseProfile, ExerciseTag } from '../../coach/types'
import type { FacetType, Taxonomy } from '../../coach/taxonomy'
import { FACET_LABELS } from '../../coach/taxonomy'
import { exerciseFitnessGoal } from '../../coach/exerciseCard'

type DetailTab = 'basics' | 'tags' | 'why' | 'phase' | 'dosage' | 'scaling' | 'logic' | 'safety' | 'regimen' | 'media'

const TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'basics', label: 'Basics' },
  { id: 'tags', label: 'Tags' },
  { id: 'why', label: 'Why' },
  { id: 'phase', label: 'Session Phase' },
  { id: 'dosage', label: 'Dosage' },
  { id: 'scaling', label: 'Scaling' },
  { id: 'logic', label: 'Programming Logic' },
  { id: 'safety', label: 'Safety' },
  { id: 'regimen', label: 'Regimen' },
  { id: 'media', label: 'Media & Cues' },
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
  const [tab, setTab] = useState<DetailTab>('basics')

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

  const why = exercise?.why
  const logic = exercise?.programming_logic
  const safety = exercise?.safety_profile
  const regimen = exercise?.regimen_rule

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
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
          <div className="flex items-center justify-center gap-2 p-12 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading exercise...
          </div>
        )}
        {error && (
          <div className="m-5 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
        )}

        {exercise && (
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

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {tab === 'basics' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <ReadOnlyField label="Description" value={exercise.description} />
                  <ReadOnlyField label="Instructions" value={exercise.instructions} />
                  <ReadOnlyField label="Sport" value={exercise.sport_name ?? 'Universal'} />
                  <ReadOnlyField label="Skill level" value={exercise.skill_level?.replace(/_/g, ' ')} />
                  <ReadOnlyField label="Age range" value={
                    exercise.age_min != null || exercise.age_max != null
                      ? `${exercise.age_min ?? '—'} – ${exercise.age_max ?? '—'}`
                      : null
                  } />
                  <ReadOnlyField label="Visibility" value={exercise.visibility === 'private' ? 'Private' : 'Facility (shared)'} />
                  <ReadOnlyField label="Published" value={exercise.is_published ? 'Yes' : 'No'} />
                  <ReadOnlyField label="Card summary" value={exercise.card_summary} />
                  <ReadOnlyField label="Coach language" value={exercise.coach_language} />
                  <ReadOnlyField label="Athlete language" value={exercise.athlete_language} />
                  <ReadOnlyField label="Tempo" value={exercise.tempo} />
                  <ReadOnlyField label="Load note" value={exercise.load_note} />
                </div>
              )}

              {tab === 'tags' && (
                <div className="space-y-4">
                  {Array.from(tagsByFacet.entries()).map(([facetType, tags]) => (
                    <div key={facetType}>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{FACET_LABELS[facetType]}</div>
                      <div className="flex flex-wrap gap-2">
                        {tags
                          .sort((a, b) => b.weight - a.weight)
                          .map((tag) => (
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

              {tab === 'why' && (
                <div className="space-y-4">
                  {([
                    ['training_purpose', 'Training purpose'],
                    ['tenet_rationale', 'Tenet rationale'],
                    ['methodology_rationale', 'Methodology rationale'],
                    ['physiological_rationale', 'Physiological rationale'],
                    ['phase_rationale', 'Phase rationale'],
                    ['order_rationale', 'Order rationale'],
                    ['fatigue_rationale', 'Fatigue rationale'],
                    ['scaling_rationale', 'Scaling rationale'],
                    ['regimen_rationale', 'Regimen rationale'],
                    ['common_misuse', 'Common misuse'],
                    ['short_summary', 'Short summary'],
                    ['coach_cues', 'Coach cues'],
                  ] as const).map(([key, label]) => (
                    <ReadOnlyField key={key} label={label} value={why?.[key]} />
                  ))}
                  {!why && <p className="text-sm text-gray-500">No why-layer content yet.</p>}
                </div>
              )}

              {tab === 'phase' && (
                <div className="space-y-3">
                  {(exercise.phase_profiles ?? []).length > 0
                    ? (exercise.phase_profiles ?? []).map((p) => <PhaseProfileView key={p.phaseKey} profile={p} />)
                    : <p className="text-sm text-gray-500">No session phase profiles.</p>}
                </div>
              )}

              {tab === 'dosage' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <ReadOnlyField label="Default sets" value={exercise.default_sets} />
                  <ReadOnlyField label="Default reps" value={exercise.default_reps} />
                  <ReadOnlyField label="Work seconds" value={exercise.default_work_seconds} />
                  <ReadOnlyField label="Rest seconds" value={exercise.default_rest_seconds} />
                  <ReadOnlyField label="Est. seconds per set" value={exercise.est_seconds_per_set} />
                  {(exercise.dosage_profiles ?? []).map((d, i) => (
                    <div key={i} className="md:col-span-2 border border-gray-100 rounded-lg p-3 space-y-2">
                      {d.profile_name && <div className="font-semibold text-sm text-gray-800">{d.profile_name}</div>}
                      <div className="grid md:grid-cols-2 gap-3">
                        <ReadOnlyField label="Session volume" value={
                          d.session_volume_min != null || d.session_volume_max != null
                            ? `${d.session_volume_min ?? '—'} – ${d.session_volume_max ?? '—'}`
                            : null
                        } />
                        <ReadOnlyField label="Weekly volume max" value={d.weekly_volume_max} />
                        <ReadOnlyField label="RPE range" value={
                          d.default_rpe_min != null || d.default_rpe_max != null
                            ? `${d.default_rpe_min ?? '—'} – ${d.default_rpe_max ?? '—'}`
                            : null
                        } />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'scaling' && (
                <div className="space-y-3">
                  {(exercise.scaling_profiles ?? []).length > 0
                    ? (exercise.scaling_profiles ?? []).map((s, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 text-sm">
                        <div className="font-semibold text-gray-900">{s.label}</div>
                        {s.scale_direction && <div className="text-xs text-gray-500 capitalize">{s.scale_direction}</div>}
                        <ReadOnlyField label="Load guidance" value={s.load_guidance} />
                        <ReadOnlyField label="Complexity guidance" value={s.complexity_guidance} />
                        <ReadOnlyField label="Coach notes" value={s.coach_notes} />
                        {(s.age_min != null || s.age_max != null || s.skill_level) && (
                          <p className="text-xs text-gray-500">
                            {[s.skill_level?.replace(/_/g, ' '), s.age_min != null ? `ages ${s.age_min}+` : null, s.age_max != null ? `up to ${s.age_max}` : null].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    ))
                    : <p className="text-sm text-gray-500">No scaling profiles.</p>}
                </div>
              )}

              {tab === 'logic' && (
                <div className="space-y-4">
                  <ReadOnlyField label="Training effect" value={logic?.training_effect} />
                  <ReadOnlyList label="Best used for" items={logic?.best_used_for ?? []} />
                  <ReadOnlyList label="Avoid when" items={logic?.avoid_when ?? []} />
                  <ReadOnlyList label="Recommended preceded by" items={logic?.recommended_preceded_by ?? []} />
                  <ReadOnlyList label="Recommended followed by" items={logic?.recommended_followed_by ?? []} />
                  {(exercise.scalable_variables?.length ?? 0) > 0 && (
                    <div className="text-sm">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scalable variables</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(exercise.scalable_variables ?? []).map((v) => (
                          <span key={v} className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-0.5">{v}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'safety' && safety ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <ReadOnlyField label="Risk level" value={safety.risk_level} />
                    <ReadOnlyField label="Impact level" value={safety.impact_level} />
                    <ReadOnlyField label="Minimum age" value={safety.minimum_age_recommended} />
                    <ReadOnlyField label="Minimum skill level" value={safety.minimum_skill_level?.replace(/_/g, ' ')} />
                    <ReadOnlyField label="Coach supervision" value={safety.requires_coach_supervision} />
                  </div>
                  <BoolRow label="Requires spotting" value={safety.requires_spotting} />
                  <ReadOnlyList label="Readiness checks" items={safety.readiness_checks ?? []} />
                  <ReadOnlyList label="Stop signs" items={safety.stop_signs ?? []} />
                  <ReadOnlyList label="Common substitutions" items={safety.common_substitutions ?? []} />
                </div>
              ) : tab === 'safety' ? (
                <p className="text-sm text-gray-500">No safety profile.</p>
              ) : null}

              {tab === 'regimen' && regimen ? (
                <div className="space-y-2">
                  <BoolRow label="Can be daily" value={regimen.can_be_daily} />
                  <BoolRow label="Counts as high intensity" value={regimen.counts_as_high_intensity} />
                  <BoolRow label="Counts as high impact" value={regimen.counts_as_high_impact} />
                  <BoolRow label="Counts as neural" value={regimen.counts_as_neural} />
                  <BoolRow label="Counts as tissue stress" value={regimen.counts_as_tissue_stress} />
                  <BoolRow label="Counts as conditioning" value={regimen.counts_as_conditioning} />
                  <ReadOnlyField label="Weekly max frequency" value={regimen.weekly_max_frequency} />
                  <ReadOnlyField label="Min hours between hard exposures" value={regimen.minimum_hours_between_hard_exposures} />
                  <ReadOnlyField label="Recovery notes" value={regimen.recovery_notes} />
                </div>
              ) : tab === 'regimen' ? (
                <p className="text-sm text-gray-500">No regimen rules.</p>
              ) : null}

              {tab === 'media' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Media</div>
                    {(exercise.media ?? []).length > 0 ? (
                      <ul className="space-y-3">
                        {(exercise.media ?? []).map((m, i) => (
                          <li key={m.id ?? i} className="border border-gray-100 rounded-lg p-3 text-sm">
                            <div className="font-medium text-gray-800 capitalize">{m.kind}</div>
                            {m.caption && <p className="text-gray-600 mt-1">{m.caption}</p>}
                            <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-vortex-red text-xs mt-1 inline-block break-all hover:underline">
                              {m.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No media.</p>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Coaching cues & faults</div>
                    {(exercise.cues ?? []).length > 0 ? (
                      <ul className="space-y-2">
                        {(exercise.cues ?? []).map((c: ExerciseCue, i) => (
                          <li key={c.id ?? i} className={`text-sm rounded-lg px-3 py-2 ${c.cue_type === 'fault' ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-800'}`}>
                            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{c.cue_type}</span>
                            <p className="mt-0.5">{c.body}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No cues.</p>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prerequisites</div>
                    {(exercise.prerequisites ?? []).length > 0 ? (
                      <ul className="space-y-2 text-sm">
                        {(exercise.prerequisites ?? []).map((p) => (
                          <li key={p.prerequisite_exercise_id} className="border border-gray-100 rounded-lg px-3 py-2">
                            <span className="font-medium text-gray-800">{p.name}</span>
                            {p.note && <p className="text-gray-500 text-xs mt-1">{p.note}</p>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No prerequisites.</p>
                    )}
                  </div>
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
