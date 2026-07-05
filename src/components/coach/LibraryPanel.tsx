import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, X, Clock, Pencil, Trash2, Sparkles, CheckCircle2 } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import type { Exercise, ExerciseTag, ExerciseMedia, ExerciseCue, ExercisePhaseProfile, ExerciseWhy, ExerciseSafetyProfile, ExerciseRegimenRule } from '../../coach/types'
import type { FacetType, TaxonomyItem } from '../../coach/taxonomy'
import { formatExerciseCardSummary, whyPreview } from '../../coach/exerciseCard'

interface PrerequisiteRow {
  prerequisite_exercise_id: number
  name: string
  note?: string | null
}

interface FilterState {
  q: string
  sport: number | ''
  tenet: number | ''
  methodology: number | ''
  physiology: number | ''
  intent: number | ''
  phase: number | ''
}

const emptyFilters: FilterState = { q: '', sport: '', tenet: '', methodology: '', physiology: '', intent: '', phase: '' }

export default function LibraryPanel() {
  const { taxonomy } = useTaxonomy()
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.q) params.set('q', filters.q)
      if (filters.sport) params.set('sport', String(filters.sport))
      if (filters.tenet) params.set('tenet', String(filters.tenet))
      if (filters.methodology) params.set('method', String(filters.methodology))
      if (filters.physiology) params.set('physio', String(filters.physiology))
      if (filters.intent) params.set('intent', String(filters.intent))
      if (filters.phase) params.set('phase', String(filters.phase))
      const data = await coachFetch<Exercise[]>(`/api/coach/exercises?${params.toString()}`)
      setExercises(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [load])

  const tenetName = useMemo(() => {
    const map = new Map<number, string>()
    taxonomy?.tenets.forEach((t) => {
      if (t.id != null) map.set(Number(t.id), t.name)
    })
    return map
  }, [taxonomy])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Exercise Library</h2>
          <p className="text-sm text-gray-500">Search and filter the tagged movement library.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
        >
          <Plus className="w-4 h-4" /> New Exercise
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="md:col-span-2 lg:col-span-1">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search exercises..."
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>
        <FacetSelect label="Sport" items={taxonomy?.sports} value={filters.sport} onChange={(v) => setFilters((f) => ({ ...f, sport: v }))} />
        <FacetSelect label="Tenet" items={taxonomy?.tenets as TaxonomyItem[] | undefined} value={filters.tenet} onChange={(v) => setFilters((f) => ({ ...f, tenet: v }))} />
        <FacetSelect label="Methodology" items={taxonomy?.methodologies as TaxonomyItem[] | undefined} value={filters.methodology} onChange={(v) => setFilters((f) => ({ ...f, methodology: v }))} />
        <FacetSelect label="Physiology" items={taxonomy?.physiology as TaxonomyItem[] | undefined} value={filters.physiology} onChange={(v) => setFilters((f) => ({ ...f, physiology: v }))} />
        <FacetSelect label="Phase/Intent" items={taxonomy?.intents} value={filters.intent} onChange={(v) => setFilters((f) => ({ ...f, intent: v }))} />
        <FacetSelect label="Session Phase" items={taxonomy?.sessionPhases as TaxonomyItem[] | undefined} value={filters.phase} onChange={(v) => setFilters((f) => ({ ...f, phase: v }))} />
        <button type="button" onClick={() => setFilters(emptyFilters)} className="self-end text-sm text-gray-500 hover:text-gray-800 underline">
          Clear filters
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading library...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {exercises.map((ex) => (
            <div key={ex.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-gray-900">{ex.name}</h3>
                <button type="button" onClick={() => setEditing(ex)} className="text-gray-400 hover:text-vortex-red">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
              {ex.sport_name && <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{ex.sport_name}</span>}
              {ex.description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{formatExerciseCardSummary(ex)}</p>}
              {ex.primary_phase && (
                <span className="inline-block mt-2 text-[11px] bg-blue-50 text-blue-800 rounded px-2 py-0.5">{ex.primary_phase.phaseName}</span>
              )}
              {whyPreview(ex.why) && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{whyPreview(ex.why)}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-3">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {ex.est_seconds_per_set}s/set</span>
                {ex.default_sets && <span>{ex.default_sets}x{ex.default_reps ?? '-'}</span>}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {(ex.tags ?? []).filter((t) => t.facetType === 'tenet').slice(0, 4).map((t: ExerciseTag) => (
                  <span key={t.facetId} className="text-[11px] bg-red-50 text-vortex-red rounded px-2 py-0.5">
                    {tenetName.get(Number(t.facetId)) ?? 'Unknown tenet'}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {exercises.length === 0 && <div className="text-sm text-gray-500">No exercises match these filters.</div>}
        </div>
      )}

      {(creating || editing) && (
        <ExerciseEditor
          exercise={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function FacetSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items?: TaxonomyItem[]
  value: number | ''
  onChange: (value: number | '') => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      >
        <option value="">All</option>
        {(items ?? []).map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function ExerciseEditor({ exercise, onClose, onSaved }: { exercise: Exercise | null; onClose: () => void; onSaved: () => void }) {
  const { taxonomy } = useTaxonomy()
  const [form, setForm] = useState({
    name: exercise?.name ?? '',
    description: exercise?.description ?? '',
    instructions: exercise?.instructions ?? '',
    sport_id: exercise?.sport_id ?? '',
    skill_level: exercise?.skill_level ?? '',
    default_sets: exercise?.default_sets ?? '',
    default_reps: exercise?.default_reps ?? '',
    default_rest_seconds: exercise?.default_rest_seconds ?? '',
    est_seconds_per_set: exercise?.est_seconds_per_set ?? 45,
    visibility: exercise?.visibility ?? 'facility',
  })
  const [tags, setTags] = useState<ExerciseTag[]>(exercise?.tags ?? [])
  const [media, setMedia] = useState<ExerciseMedia[]>(exercise?.media ?? [])
  const [cues, setCues] = useState<ExerciseCue[]>(exercise?.cues ?? [])
  const [prerequisites, setPrerequisites] = useState<PrerequisiteRow[]>(exercise?.prerequisites ?? [])
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'basics' | 'tags' | 'why' | 'phase' | 'dosage' | 'safety' | 'regimen' | 'media'>('basics')
  const [why, setWhy] = useState<ExerciseWhy>({})
  const [phaseProfiles, setPhaseProfiles] = useState<ExercisePhaseProfile[]>([])
  const [safetyProfile, setSafetyProfile] = useState<ExerciseSafetyProfile>({})
  const [regimenRule, setRegimenRule] = useState<ExerciseRegimenRule>({})
  const [publishCheck, setPublishCheck] = useState<{ ready: boolean; issues: string[] } | null>(null)

  const editorTabs: Array<{ id: typeof tab; label: string }> = [
    { id: 'basics', label: 'Basics' },
    { id: 'tags', label: 'Tags' },
    { id: 'why', label: 'Why' },
    { id: 'phase', label: 'Phase' },
    { id: 'dosage', label: 'Dosage' },
    { id: 'safety', label: 'Safety' },
    { id: 'regimen', label: 'Regimen' },
    { id: 'media', label: 'Media & Cues' },
  ]

  // Load full detail (media/cues/prerequisites) when editing so a save does not wipe them.
  useEffect(() => {
    if (!exercise) return
    coachFetch<Exercise>(`/api/coach/exercises/${exercise.id}`)
      .then((full) => {
        setTags(full.tags ?? [])
        setMedia(full.media ?? [])
        setCues(full.cues ?? [])
        setPrerequisites((full.prerequisites ?? []) as PrerequisiteRow[])
        setWhy(full.why ?? {})
        setPhaseProfiles(full.phase_profiles ?? [])
        setSafetyProfile(full.safety_profile ?? {})
        setRegimenRule(full.regimen_rule ?? {})
      })
      .catch(() => {/* keep list-provided values */})
    coachFetch<{ ready: boolean; issues: string[] }>(`/api/coach/exercises/${exercise.id}/publish-check`)
      .then(setPublishCheck)
      .catch(() => setPublishCheck(null))
  }, [exercise])

  // Options for the prerequisite picker.
  useEffect(() => {
    coachFetch<Exercise[]>('/api/coach/exercises').then(setAllExercises).catch(() => setAllExercises([]))
  }, [])

  const toggleTag = (facetType: FacetType, facetId: number) => {
    setTags((current) => {
      const exists = current.find((t) => t.facetType === facetType && t.facetId === facetId)
      if (exists) return current.filter((t) => !(t.facetType === facetType && t.facetId === facetId))
      return [...current, { facetType, facetId, weight: 3 }]
    })
  }

  const setWeight = (facetType: FacetType, facetId: number, weight: number) => {
    setTags((current) => current.map((t) => (t.facetType === facetType && t.facetId === facetId ? { ...t, weight } : t)))
  }

  const suggestTags = async () => {
    try {
      const data = await coachFetch<{ suggestions: Array<{ facetType: FacetType; facetId: number; weight: number }> }>(
        '/api/coach/ai/autotag', { method: 'POST', body: JSON.stringify({ name: form.name, description: form.description, cues }) },
      )
      setTags((current) => {
        const merged = [...current]
        for (const s of data.suggestions) {
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

  const uploadMediaFile = async (index: number, file: File) => {
    try {
      const sig = await coachFetch<{ configured: boolean; uploadUrl?: string; apiKey?: string; timestamp?: number; folder?: string; signature?: string }>('/api/coach/media/upload-signature')
      if (!sig.configured || !sig.uploadUrl) {
        setError('Media upload is not configured on the server. Paste a hosted URL instead.')
        return
      }
      const fd = new FormData()
      fd.append('file', file)
      fd.append('api_key', sig.apiKey!)
      fd.append('timestamp', String(sig.timestamp))
      fd.append('folder', sig.folder!)
      fd.append('signature', sig.signature!)
      const resp = await fetch(sig.uploadUrl, { method: 'POST', body: fd })
      const data = (await resp.json()) as { secure_url?: string; error?: { message?: string } }
      if (data.secure_url) {
        setMedia((cur) => cur.map((x, j) => (j === index ? { ...x, url: data.secure_url as string } : x)))
      } else {
        setError(data.error?.message || 'Upload failed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const body = {
        ...form,
        sport_id: form.sport_id || null,
        skill_level: form.skill_level || null,
        default_sets: form.default_sets || null,
        default_reps: form.default_reps || null,
        default_rest_seconds: form.default_rest_seconds || null,
        est_seconds_per_set: Number(form.est_seconds_per_set) || 45,
        tags,
        media: media.filter((m) => m.url.trim()),
        cues: cues.filter((c) => c.body.trim()),
        prerequisites: prerequisites.map((p) => ({ prerequisite_exercise_id: p.prerequisite_exercise_id, note: p.note ?? null })),
        why,
        phase_profiles: phaseProfiles,
        safety_profile: safetyProfile,
        regimen_rule: regimenRule,
        dosage_profile: {
          default_sets: form.default_sets || null,
          default_reps: form.default_reps || null,
          default_rest_seconds: form.default_rest_seconds || null,
          est_seconds_per_set: Number(form.est_seconds_per_set) || 45,
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
    { type: 'intent', label: 'Phase/Intent', items: taxonomy?.intents },
    { type: 'body_region', label: 'Body Regions', items: taxonomy?.bodyRegions },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-lg">{exercise ? 'Edit Exercise' : 'New Exercise'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
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
          <div className="flex flex-wrap gap-1 border-b border-gray-100 pb-2">
            {editorTabs.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === t.id ? 'bg-vortex-red text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'basics' && (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="md:col-span-2 text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="md:col-span-2 text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Description</span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Sport</span>
              <select value={form.sport_id} onChange={(e) => setForm({ ...form, sport_id: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Universal</option>
                {taxonomy?.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Skill Level</span>
              <select value={form.skill_level} onChange={(e) => setForm({ ...form, skill_level: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Any</option>
                <option value="EARLY_STAGE">Early Stage</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Default Sets</span>
              <input type="number" value={form.default_sets} onChange={(e) => setForm({ ...form, default_sets: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Default Reps</span>
              <input type="number" value={form.default_reps} onChange={(e) => setForm({ ...form, default_reps: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Est. seconds / set</span>
              <input type="number" value={form.est_seconds_per_set} onChange={(e) => setForm({ ...form, est_seconds_per_set: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Visibility</span>
              <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as 'facility' | 'private' })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="facility">Facility (shared)</option>
                <option value="private">Private (only me)</option>
              </select>
            </label>
          </div>
          )}

          {tab === 'tags' && (
          <>
          <div className="flex justify-end">
            <button type="button" onClick={() => void suggestTags()} disabled={!form.name} className="flex items-center gap-1 text-sm text-vortex-red border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-50">
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
                        <select
                          value={active.weight}
                          onChange={(e) => setWeight(group.type, item.id, Number(e.target.value))}
                          className="bg-transparent text-[11px] outline-none"
                          title="Emphasis weight"
                        >
                          {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>{w}</option>)}
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          </>
          )}

          {tab === 'why' && (
            <div className="space-y-3 text-sm">
              {([
                ['training_purpose', 'Training purpose'],
                ['phase_rationale', 'Phase rationale'],
                ['fatigue_rationale', 'Fatigue rationale'],
                ['scaling_rationale', 'Scaling rationale'],
                ['regimen_rationale', 'Regimen rationale'],
                ['common_misuse', 'Common misuse'],
              ] as const).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="font-semibold text-gray-700">{label}</span>
                  <textarea
                    value={why[key] ?? ''}
                    onChange={(e) => setWhy({ ...why, [key]: e.target.value })}
                    rows={2}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </label>
              ))}
            </div>
          )}

          {tab === 'phase' && (
            <div className="space-y-3">
              {(taxonomy?.sessionPhases ?? []).map((phase) => {
                const profile = phaseProfiles.find((p) => p.phaseKey === phase.key)
                return (
                  <div key={phase.id} className="border border-gray-200 rounded-lg p-3 text-sm grid md:grid-cols-4 gap-2 items-center">
                    <div className="font-semibold text-gray-800">{phase.name}</div>
                    <select
                      value={profile?.role ?? ''}
                      onChange={(e) => {
                        const role = e.target.value as ExercisePhaseProfile['role'] | ''
                        const rest = phaseProfiles.filter((p) => p.phaseKey !== phase.key)
                        if (!role) { setPhaseProfiles(rest); return }
                        setPhaseProfiles([...rest, {
                          phaseId: phase.id,
                          phaseKey: phase.key,
                          phaseName: phase.name,
                          fitWeight: profile?.fitWeight ?? 3,
                          role,
                        }])
                      }}
                      className="border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="">Not set</option>
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="conditional">Conditional</option>
                      <option value="avoid">Avoid</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={profile?.fitWeight ?? 3}
                      disabled={!profile}
                      onChange={(e) => setPhaseProfiles(phaseProfiles.map((p) => p.phaseKey === phase.key ? { ...p, fitWeight: Number(e.target.value) } : p))}
                      className="border border-gray-300 rounded px-2 py-1"
                      placeholder="Fit 1-5"
                    />
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'dosage' && (
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <label><span className="font-semibold text-gray-700">Default sets</span><input type="number" value={form.default_sets} onChange={(e) => setForm({ ...form, default_sets: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
              <label><span className="font-semibold text-gray-700">Default reps</span><input type="number" value={form.default_reps} onChange={(e) => setForm({ ...form, default_reps: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
              <label><span className="font-semibold text-gray-700">Rest (sec)</span><input type="number" value={form.default_rest_seconds} onChange={(e) => setForm({ ...form, default_rest_seconds: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
              <label><span className="font-semibold text-gray-700">Est sec/set</span><input type="number" value={form.est_seconds_per_set} onChange={(e) => setForm({ ...form, est_seconds_per_set: Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
            </div>
          )}

          {tab === 'safety' && (
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <label><span className="font-semibold text-gray-700">Risk level (1-5)</span><input type="number" value={safetyProfile.risk_level ?? 2} onChange={(e) => setSafetyProfile({ ...safetyProfile, risk_level: Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
              <label><span className="font-semibold text-gray-700">Impact level (0-5)</span><input type="number" value={safetyProfile.impact_level ?? 1} onChange={(e) => setSafetyProfile({ ...safetyProfile, impact_level: Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
              <label className="md:col-span-2"><span className="font-semibold text-gray-700">Stop signs (comma separated)</span><input value={(safetyProfile.stop_signs ?? []).join(', ')} onChange={(e) => setSafetyProfile({ ...safetyProfile, stop_signs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
            </div>
          )}

          {tab === 'regimen' && (
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={regimenRule.can_be_daily ?? false} onChange={(e) => setRegimenRule({ ...regimenRule, can_be_daily: e.target.checked })} /> Can be daily</label>
              <label><span className="font-semibold text-gray-700">Weekly max frequency</span><input type="number" value={regimenRule.weekly_max_frequency ?? 3} onChange={(e) => setRegimenRule({ ...regimenRule, weekly_max_frequency: Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
              <label className="md:col-span-2"><span className="font-semibold text-gray-700">Recovery notes</span><textarea value={regimenRule.recovery_notes ?? ''} onChange={(e) => setRegimenRule({ ...regimenRule, recovery_notes: e.target.value })} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
            </div>
          )}

          {tab === 'media' && (
          <>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Media (videos / images)</span>
              <button type="button" onClick={() => setMedia([...media, { kind: 'video', url: '', caption: '' }])} className="text-vortex-red text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
            </div>
            <div className="space-y-2">
              {media.map((m, i) => (
                <div key={i} className="grid grid-cols-[90px_1fr_1fr_auto] gap-2 items-center text-sm">
                  <select value={m.kind} onChange={(e) => setMedia(media.map((x, j) => j === i ? { ...x, kind: e.target.value as ExerciseMedia['kind'] } : x))} className="border border-gray-300 rounded px-2 py-1">
                    <option value="video">Video</option>
                    <option value="image">Image</option>
                    <option value="diagram">Diagram</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <input value={m.url} onChange={(e) => setMedia(media.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://..." className="flex-1 border border-gray-300 rounded px-2 py-1" />
                    <label className="cursor-pointer text-xs text-vortex-red border border-gray-200 rounded px-2 py-1 whitespace-nowrap" title="Upload file">
                      Upload
                      <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadMediaFile(i, f) }} />
                    </label>
                  </div>
                  <input value={m.caption ?? ''} onChange={(e) => setMedia(media.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))} placeholder="Caption" className="border border-gray-300 rounded px-2 py-1" />
                  <button type="button" onClick={() => setMedia(media.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {media.length === 0 && <div className="text-xs text-gray-400">No media yet.</div>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Coaching cues & faults</span>
              <button type="button" onClick={() => setCues([...cues, { cue_type: 'cue', body: '' }])} className="text-vortex-red text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
            </div>
            <div className="space-y-2">
              {cues.map((c, i) => (
                <div key={i} className="grid grid-cols-[90px_1fr_auto] gap-2 items-center text-sm">
                  <select value={c.cue_type} onChange={(e) => setCues(cues.map((x, j) => j === i ? { ...x, cue_type: e.target.value as ExerciseCue['cue_type'] } : x))} className="border border-gray-300 rounded px-2 py-1">
                    <option value="cue">Cue</option>
                    <option value="fault">Fault</option>
                  </select>
                  <input value={c.body} onChange={(e) => setCues(cues.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} placeholder="e.g. Brace the core and drive the knees out." className="border border-gray-300 rounded px-2 py-1" />
                  <button type="button" onClick={() => setCues(cues.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {cues.length === 0 && <div className="text-xs text-gray-400">No cues yet.</div>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Prerequisites (progression graph)</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {prerequisites.map((p) => (
                <span key={p.prerequisite_exercise_id} className="flex items-center gap-1 rounded-full border border-vortex-red bg-red-50 text-vortex-red px-2 py-1 text-xs">
                  {p.name}
                  <button type="button" onClick={() => setPrerequisites(prerequisites.filter((x) => x.prerequisite_exercise_id !== p.prerequisite_exercise_id))}><X className="w-3 h-3" /></button>
                </span>
              ))}
              {prerequisites.length === 0 && <span className="text-xs text-gray-400">No prerequisites.</span>}
            </div>
            <select
              value=""
              onChange={(e) => {
                const id = Number(e.target.value)
                if (!id || prerequisites.some((p) => p.prerequisite_exercise_id === id)) return
                if (exercise && id === exercise.id) return
                const found = allExercises.find((x) => x.id === id)
                if (found) setPrerequisites([...prerequisites, { prerequisite_exercise_id: id, name: found.name }])
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Add a prerequisite exercise...</option>
              {allExercises.filter((x) => !exercise || x.id !== exercise.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          </>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving || !form.name} className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Exercise'}
          </button>
        </div>
      </div>
    </div>
  )
}
