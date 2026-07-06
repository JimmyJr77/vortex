import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Search, X, Link2 } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import type { Exercise, Skill, SkillEvaluationMode, SkillKind, SkillComponentRow, SkillPrerequisiteRow } from '../../coach/types'
import type { TaxonomyItem } from '../../coach/taxonomy'
import { exportSkills, type LibraryExportFormat } from '../../coach/libraryExport'
import { EVALUATION_LABELS, formatSkillMetric } from '../../coach/skillCard'
import SkillDetailModal from './SkillDetailModal'
import LibraryCardMenu from './LibraryCardMenu'
import LibraryCard from './LibraryCard'
import LibraryExportControls from './LibraryExportControls'

interface FilterState {
  q: string
  sport: number | ''
  kind: SkillKind | ''
  evaluation: SkillEvaluationMode | ''
  level: string
}

const emptyFilters: FilterState = { q: '', sport: '', kind: '', evaluation: '', level: '' }

function kindBadgeClass(kind: SkillKind) {
  return kind === 'combo' ? 'bg-purple-50 text-purple-800' : 'bg-blue-50 text-blue-800'
}

function evaluationBadgeClass(mode: SkillEvaluationMode) {
  if (mode === 'duration') return 'bg-amber-50 text-amber-800'
  if (mode === 'repetitions') return 'bg-green-50 text-green-800'
  return 'bg-indigo-50 text-indigo-800'
}

export default function SkillLibraryPanel() {
  const { taxonomy } = useTaxonomy()
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Skill | null>(null)
  const [editing, setEditing] = useState<Skill | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.q) params.set('q', filters.q)
      if (filters.sport) params.set('sport', String(filters.sport))
      if (filters.kind) params.set('kind', filters.kind)
      if (filters.evaluation) params.set('evaluation', filters.evaluation)
      if (filters.level) params.set('level', filters.level)
      const data = await coachFetch<Skill[]>(`/api/coach/skills?${params.toString()}`)
      setSkills(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [load])

  const handleExport = (format: LibraryExportFormat) => {
    if (skills.length === 0) return
    exportSkills(skills, format, 'skill-library')
  }

  const handleDelete = async (sk: Skill) => {
    if (!window.confirm(`Delete "${sk.name}"? This cannot be undone.`)) return
    try {
      await coachFetch(`/api/coach/skills/${sk.id}`, { method: 'DELETE' })
      if (viewing?.id === sk.id) setViewing(null)
      if (editing?.id === sk.id) setEditing(null)
      void load()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete skill')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Skills</h2>
          <p className="text-sm text-gray-500">Demonstrated abilities — evaluated by execution quality, hold duration, or rep count. May link to a related exercise for training.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <LibraryExportControls
            disabled={loading || skills.length === 0}
            filenameStem="skill-library"
            onExport={(format) => handleExport(format as LibraryExportFormat)}
          />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center justify-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
          >
            <Plus className="w-4 h-4" /> New Skill
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search skills..."
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>
        <FacetSelect label="Sport" items={taxonomy?.sports} value={filters.sport} onChange={(v) => setFilters((f) => ({ ...f, sport: v }))} />
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Structure</label>
          <select value={filters.kind} onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value as SkillKind | '' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All</option>
            <option value="skill">Single skill</option>
            <option value="combo">Combo</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Evaluated by</label>
          <select value={filters.evaluation} onChange={(e) => setFilters((f) => ({ ...f, evaluation: e.target.value as SkillEvaluationMode | '' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Any</option>
            <option value="execution">Execution</option>
            <option value="duration">Duration</option>
            <option value="repetitions">Repetitions</option>
          </select>
        </div>
        <div className="lg:col-span-5 grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Skill level</label>
            <select value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Any</option>
              <option value="EARLY_STAGE">Early Stage</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </div>
          <button type="button" onClick={() => setFilters(emptyFilters)} className="self-end text-sm text-gray-500 hover:text-gray-800 underline">
            Clear filters
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading skills...</div>
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((sk) => {
            const metric = formatSkillMetric(sk)
            return (
              <LibraryCard
                key={sk.id}
                onClick={() => setViewing(sk)}
                menu={
                  <LibraryCardMenu
                    itemLabel={sk.name}
                    onEdit={() => setEditing(sk)}
                    onDelete={() => { void handleDelete(sk) }}
                  />
                }
              >
                <h3 className="pr-8 font-bold leading-snug text-gray-900">{sk.name}</h3>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className={`text-[11px] rounded px-2 py-0.5 ${kindBadgeClass(sk.skill_kind)}`}>
                    {sk.skill_kind === 'combo' ? 'Combo' : 'Skill'}
                  </span>
                  <span className={`text-[11px] rounded px-2 py-0.5 ${evaluationBadgeClass(sk.evaluation_mode ?? 'execution')}`}>
                    {EVALUATION_LABELS[sk.evaluation_mode ?? 'execution']}
                  </span>
                  {sk.sport_name && <span className="text-[11px] bg-gray-100 text-gray-600 rounded px-2 py-0.5">{sk.sport_name}</span>}
                </div>
                {metric && <p className="text-xs text-gray-700 mt-2 font-medium">{metric}</p>}
                {sk.exercise_name && (
                  <p className="text-xs text-gray-500 mt-1">Trains via: {sk.exercise_name}</p>
                )}
                {sk.assistance_note && (
                  <span className="inline-block mt-2 text-[11px] bg-green-50 text-green-800 rounded px-2 py-0.5">{sk.assistance_note}</span>
                )}
                {sk.description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{sk.description}</p>}
                {sk.skill_kind === 'combo' && (sk.components?.length ?? 0) > 0 && (
                  <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                    <Link2 className="w-3 h-3 mt-0.5 shrink-0" />
                    {(sk.components ?? []).map((c) => c.name).filter(Boolean).join(' → ')}
                  </p>
                )}
              </LibraryCard>
            )
          })}
          {skills.length === 0 && <div className="text-sm text-gray-500 col-span-full">No skills match your filters.</div>}
        </div>
      )}

      {viewing && (
        <SkillDetailModal
          skillId={viewing.id}
          preview={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null) }}
        />
      )}

      {(creating || editing) && (
        <SkillEditor
          skill={editing}
          allSkills={skills}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => { setCreating(false); setEditing(null); void load() }}
        />
      )}
    </div>
  )
}

function FacetSelect({ label, items, value, onChange }: { label: string; items?: TaxonomyItem[]; value: number | ''; onChange: (v: number | '') => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
        <option value="">All</option>
        {(items ?? []).map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
    </div>
  )
}

function SkillEditor({ skill, allSkills, onClose, onSaved }: { skill: Skill | null; allSkills: Skill[]; onClose: () => void; onSaved: () => void }) {
  const { taxonomy } = useTaxonomy()
  const [form, setForm] = useState({
    name: skill?.name ?? '',
    description: skill?.description ?? '',
    instructions: skill?.instructions ?? '',
    sport_id: skill?.sport_id ?? '',
    skill_level: skill?.skill_level ?? '',
    skill_kind: (skill?.skill_kind ?? 'skill') as SkillKind,
    evaluation_mode: (skill?.evaluation_mode ?? 'execution') as SkillEvaluationMode,
    exercise_id: skill?.exercise_id ?? '',
    min_hold_seconds: skill?.min_hold_seconds ?? '',
    default_hold_seconds: skill?.default_hold_seconds ?? '',
    min_reps: skill?.min_reps ?? '',
    default_reps: skill?.default_reps ?? '',
    target_reps: skill?.target_reps ?? '',
    execution_max_score: skill?.execution_max_score ?? '',
    assistance_note: skill?.assistance_note ?? '',
  })
  const [components, setComponents] = useState<SkillComponentRow[]>(skill?.components ?? [])
  const [prerequisites, setPrerequisites] = useState<SkillPrerequisiteRow[]>(skill?.prerequisites ?? [])
  const [skillOptions, setSkillOptions] = useState<Skill[]>(allSkills)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!skill) return
    coachFetch<Skill>(`/api/coach/skills/${skill.id}`)
      .then((full) => {
        setForm({
          name: full.name,
          description: full.description ?? '',
          instructions: full.instructions ?? '',
          sport_id: full.sport_id ?? '',
          skill_level: full.skill_level ?? '',
          skill_kind: full.skill_kind,
          evaluation_mode: full.evaluation_mode ?? 'execution',
          exercise_id: full.exercise_id ?? '',
          min_hold_seconds: full.min_hold_seconds ?? '',
          default_hold_seconds: full.default_hold_seconds ?? '',
          min_reps: full.min_reps ?? '',
          default_reps: full.default_reps ?? '',
          target_reps: full.target_reps ?? '',
          execution_max_score: full.execution_max_score ?? '',
          assistance_note: full.assistance_note ?? '',
        })
        setComponents(full.components ?? [])
        setPrerequisites(full.prerequisites ?? [])
      })
      .catch(() => {/* keep list values */})
  }, [skill])

  useEffect(() => {
    coachFetch<Skill[]>('/api/coach/skills').then(setSkillOptions).catch(() => setSkillOptions(allSkills))
    coachFetch<Exercise[]>('/api/coach/exercises').then(setExercises).catch(() => setExercises([]))
  }, [allSkills])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        instructions: form.instructions || null,
        sport_id: form.sport_id || null,
        skill_level: form.skill_level || null,
        skill_kind: form.skill_kind,
        evaluation_mode: form.evaluation_mode,
        exercise_id: form.exercise_id || null,
        min_hold_seconds: form.evaluation_mode === 'duration' && form.min_hold_seconds !== '' ? Number(form.min_hold_seconds) : null,
        default_hold_seconds: form.evaluation_mode === 'duration' && form.default_hold_seconds !== '' ? Number(form.default_hold_seconds) : null,
        min_reps: form.evaluation_mode === 'repetitions' && form.min_reps !== '' ? Number(form.min_reps) : null,
        default_reps: form.evaluation_mode === 'repetitions' && form.default_reps !== '' ? Number(form.default_reps) : null,
        target_reps: form.evaluation_mode === 'repetitions' && form.target_reps !== '' ? Number(form.target_reps) : null,
        execution_max_score: form.evaluation_mode === 'execution' && form.execution_max_score !== '' ? Number(form.execution_max_score) : null,
        assistance_note: form.assistance_note || null,
        components: form.skill_kind === 'combo'
          ? components.map((c, i) => ({ component_skill_id: c.component_skill_id, sort_order: c.sort_order ?? i }))
          : [],
        prerequisites: prerequisites.map((p) => ({ prerequisite_skill_id: p.prerequisite_skill_id, note: p.note ?? null })),
      }
      if (skill) {
        await coachFetch(`/api/coach/skills/${skill.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await coachFetch('/api/coach/skills', { method: 'POST', body: JSON.stringify(body) })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save skill')
    } finally {
      setSaving(false)
    }
  }

  const comboCandidates = skillOptions.filter((s) => s.id !== skill?.id && s.skill_kind !== 'combo')

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-lg">{skill ? 'Edit Skill' : 'New Skill'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="md:col-span-2 text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Structure</span>
              <select value={form.skill_kind} onChange={(e) => setForm({ ...form, skill_kind: e.target.value as SkillKind })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="skill">Single skill</option>
                <option value="combo">Combo</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Evaluated by</span>
              <select value={form.evaluation_mode} onChange={(e) => setForm({ ...form, evaluation_mode: e.target.value as SkillEvaluationMode })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="execution">Execution quality</option>
                <option value="duration">Hold duration</option>
                <option value="repetitions">Repetitions</option>
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block font-semibold text-gray-700 mb-1">Linked exercise (optional training drill)</span>
              <select value={form.exercise_id} onChange={(e) => setForm({ ...form, exercise_id: e.target.value ? Number(e.target.value) : '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">None — skill only</option>
                {exercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Sport</span>
              <select value={form.sport_id} onChange={(e) => setForm({ ...form, sport_id: e.target.value ? Number(e.target.value) : '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Universal</option>
                {taxonomy?.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Skill level</span>
              <select value={form.skill_level} onChange={(e) => setForm({ ...form, skill_level: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Any</option>
                <option value="EARLY_STAGE">Early Stage</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block font-semibold text-gray-700 mb-1">Assistance / variation note</span>
              <input value={form.assistance_note} onChange={(e) => setForm({ ...form, assistance_note: e.target.value })} placeholder="e.g. Wall assisted" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            {form.evaluation_mode === 'duration' && (
              <>
                <label className="text-sm">
                  <span className="block font-semibold text-gray-700 mb-1">Minimum hold (seconds)</span>
                  <input type="number" value={form.min_hold_seconds} onChange={(e) => setForm({ ...form, min_hold_seconds: e.target.value ? Number(e.target.value) : '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
                <label className="text-sm">
                  <span className="block font-semibold text-gray-700 mb-1">Target hold (seconds)</span>
                  <input type="number" value={form.default_hold_seconds} onChange={(e) => setForm({ ...form, default_hold_seconds: e.target.value ? Number(e.target.value) : '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
              </>
            )}
            {form.evaluation_mode === 'repetitions' && (
              <>
                <label className="text-sm">
                  <span className="block font-semibold text-gray-700 mb-1">Minimum reps</span>
                  <input type="number" value={form.min_reps} onChange={(e) => setForm({ ...form, min_reps: e.target.value ? Number(e.target.value) : '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
                <label className="text-sm">
                  <span className="block font-semibold text-gray-700 mb-1">Typical reps</span>
                  <input type="number" value={form.default_reps} onChange={(e) => setForm({ ...form, default_reps: e.target.value ? Number(e.target.value) : '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
                <label className="text-sm">
                  <span className="block font-semibold text-gray-700 mb-1">Target reps</span>
                  <input type="number" value={form.target_reps} onChange={(e) => setForm({ ...form, target_reps: e.target.value ? Number(e.target.value) : '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
              </>
            )}
            {form.evaluation_mode === 'execution' && (
              <label className="text-sm">
                <span className="block font-semibold text-gray-700 mb-1">Max score (optional)</span>
                <input type="number" value={form.execution_max_score} onChange={(e) => setForm({ ...form, execution_max_score: e.target.value ? Number(e.target.value) : '' })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
            )}
            <label className="md:col-span-2 text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Description</span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
            <label className="md:col-span-2 text-sm">
              <span className="block font-semibold text-gray-700 mb-1">Coaching notes</span>
              <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>
          </div>

          {form.skill_kind === 'combo' && (
            <div>
              <span className="block text-sm font-semibold text-gray-700 mb-2">Combo sequence (in order)</span>
              <div className="flex flex-wrap gap-2 mb-2">
                {components.map((c, i) => (
                  <span key={`${c.component_skill_id}-${i}`} className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-800 rounded px-2 py-1">
                    {i + 1}. {c.name ?? `Skill #${c.component_skill_id}`}
                    <button type="button" onClick={() => setComponents(components.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <select
                value=""
                onChange={(e) => {
                  const id = Number(e.target.value)
                  if (!id || components.some((c) => c.component_skill_id === id)) return
                  const found = comboCandidates.find((s) => s.id === id)
                  if (found) setComponents([...components, { component_skill_id: id, name: found.name, sort_order: components.length }])
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Add component skill...</option>
                {comboCandidates.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-2">Prerequisites</span>
            <div className="flex flex-wrap gap-2 mb-2">
              {prerequisites.map((p) => (
                <span key={p.prerequisite_skill_id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded px-2 py-1">
                  {p.name ?? `Skill #${p.prerequisite_skill_id}`}
                  <button type="button" onClick={() => setPrerequisites(prerequisites.filter((x) => x.prerequisite_skill_id !== p.prerequisite_skill_id))}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <select
              value=""
              onChange={(e) => {
                const id = Number(e.target.value)
                if (!id || prerequisites.some((p) => p.prerequisite_skill_id === id)) return
                if (skill && id === skill.id) return
                const found = skillOptions.find((s) => s.id === id)
                if (found) setPrerequisites([...prerequisites, { prerequisite_skill_id: id, name: found.name }])
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Add prerequisite skill...</option>
              {skillOptions.filter((s) => !skill || s.id !== skill.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving || !form.name} className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Skill'}
          </button>
        </div>
      </div>
    </div>
  )
}
