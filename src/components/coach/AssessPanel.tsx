import { useCallback, useEffect, useState } from 'react'
import { ClipboardCheck, Plus, Trash2, Star } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import { useRosterMembers } from './useRosterMembers'

interface Assessment {
  id: number
  name: string
  assessment_type: string
  unit?: string | null
  tenet_name?: string | null
}

interface RubricCriterion {
  id?: number
  name: string
  description?: string | null
  tenet_id?: number | null
}

interface Rubric {
  id: number
  name: string
  description?: string | null
  scale_min: number
  scale_max: number
  criteria: RubricCriterion[]
}

export default function AssessPanel() {
  const { taxonomy } = useTaxonomy()
  const { members } = useRosterMembers()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [creating, setCreating] = useState(false)
  const [buildingRubric, setBuildingRubric] = useState(false)
  const [form, setForm] = useState({ name: '', assessment_type: 'benchmark', unit: '', tenet_id: '' })
  const [record, setRecord] = useState({ assessmentId: '', memberId: '', value: '', note: '' })
  const [skill, setSkill] = useState({ memberId: '', rubricId: '', rubric_criterion_id: '', skill_label: '', score: '', max_score: '5', note: '' })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        coachFetch<Assessment[]>('/api/coach/assessments'),
        coachFetch<Rubric[]>('/api/coach/rubrics'),
      ])
      setAssessments(a)
      setRubrics(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assessments')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createAssessment = async () => {
    try {
      await coachFetch('/api/coach/assessments', { method: 'POST', body: JSON.stringify({ ...form, tenet_id: form.tenet_id || null }) })
      setCreating(false)
      setForm({ name: '', assessment_type: 'benchmark', unit: '', tenet_id: '' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assessment')
    }
  }

  const recordResult = async () => {
    if (!record.assessmentId || !record.memberId) return
    setMessage(null)
    setError(null)
    try {
      await coachFetch(`/api/coach/assessments/${record.assessmentId}/results`, {
        method: 'POST',
        body: JSON.stringify({ memberId: Number(record.memberId), value: record.value ? Number(record.value) : null, note: record.note || null }),
      })
      setMessage('Result recorded.')
      setRecord({ assessmentId: '', memberId: '', value: '', note: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record result')
    }
  }

  const gradeSkill = async () => {
    if (!skill.memberId || (!skill.rubric_criterion_id && !skill.skill_label)) return
    setMessage(null)
    setError(null)
    try {
      await coachFetch(`/api/coach/athletes/${skill.memberId}/skill-grade`, {
        method: 'POST',
        body: JSON.stringify({
          rubric_criterion_id: skill.rubric_criterion_id ? Number(skill.rubric_criterion_id) : null,
          skill_label: skill.skill_label || null,
          score: skill.score ? Number(skill.score) : null,
          max_score: skill.max_score ? Number(skill.max_score) : null,
          note: skill.note || null,
        }),
      })
      setMessage('Skill grade saved.')
      setSkill({ memberId: '', rubricId: '', rubric_criterion_id: '', skill_label: '', score: '', max_score: '5', note: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save skill grade')
    }
  }

  const selectedRubric = rubrics.find((r) => String(r.id) === skill.rubricId)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-vortex-red" /> Assess & Grade</h2>
          <p className="text-sm text-gray-500">Define benchmarks and rubrics, then record athlete performance over time.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setBuildingRubric(true)} className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg font-semibold text-sm"><Plus className="w-4 h-4" /> New Rubric</button>
          <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold text-sm"><Plus className="w-4 h-4" /> New Assessment</button>
        </div>
      </div>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {message && <div className="rounded-lg bg-green-50 text-green-700 px-4 py-2 text-sm">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Assessments</h3>
          <div className="space-y-2">
            {assessments.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-gray-50 py-2 text-sm">
                <div>
                  <div className="font-medium text-gray-800">{a.name}</div>
                  <div className="text-xs text-gray-500">{a.assessment_type}{a.unit ? ` · ${a.unit}` : ''}{a.tenet_name ? ` · ${a.tenet_name}` : ''}</div>
                </div>
              </div>
            ))}
            {assessments.length === 0 && <div className="text-sm text-gray-500">No assessments yet.</div>}
          </div>
          <h3 className="font-semibold text-gray-800 mb-2 mt-5">Rubrics</h3>
          <div className="space-y-2">
            {rubrics.map((r) => (
              <div key={r.id} className="border-b border-gray-50 py-2 text-sm">
                <div className="font-medium text-gray-800">{r.name} <span className="text-xs text-gray-400">({r.scale_min}-{r.scale_max})</span></div>
                <div className="text-xs text-gray-500">{r.criteria.map((c) => c.name).join(', ') || 'No criteria'}</div>
              </div>
            ))}
            {rubrics.length === 0 && <div className="text-sm text-gray-500">No rubrics yet.</div>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Record a Benchmark Result</h3>
            <label className="text-sm block">
              <span className="block text-xs font-semibold text-gray-500 mb-1">Assessment</span>
              <select value={record.assessmentId} onChange={(e) => setRecord({ ...record, assessmentId: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5">
                <option value="">Select...</option>
                {assessments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">Athlete</span>
                <select value={record.memberId} onChange={(e) => setRecord({ ...record, memberId: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5">
                  <option value="">Select...</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label className="text-sm block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">Value</span>
                <input type="number" value={record.value} onChange={(e) => setRecord({ ...record, value: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5" />
              </label>
            </div>
            <input value={record.note} onChange={(e) => setRecord({ ...record, note: e.target.value })} placeholder="Note (optional)" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <button type="button" onClick={() => void recordResult()} disabled={!record.assessmentId || !record.memberId} className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-60">Record Result</button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Star className="w-4 h-4 text-vortex-red" /> Grade a Skill</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">Athlete</span>
                <select value={skill.memberId} onChange={(e) => setSkill({ ...skill, memberId: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5">
                  <option value="">Select...</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label className="text-sm block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">Rubric</span>
                <select value={skill.rubricId} onChange={(e) => setSkill({ ...skill, rubricId: e.target.value, rubric_criterion_id: '' })} className="w-full border border-gray-300 rounded px-2 py-1.5">
                  <option value="">Freeform</option>
                  {rubrics.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
            </div>
            {selectedRubric ? (
              <label className="text-sm block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">Criterion</span>
                <select value={skill.rubric_criterion_id} onChange={(e) => setSkill({ ...skill, rubric_criterion_id: e.target.value, max_score: String(selectedRubric.scale_max) })} className="w-full border border-gray-300 rounded px-2 py-1.5">
                  <option value="">Select...</option>
                  {selectedRubric.criteria.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            ) : (
              <label className="text-sm block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">Skill label</span>
                <input value={skill.skill_label} onChange={(e) => setSkill({ ...skill, skill_label: e.target.value })} placeholder="e.g. Handstand hold" className="w-full border border-gray-300 rounded px-2 py-1.5" />
              </label>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">Score</span>
                <input type="number" value={skill.score} onChange={(e) => setSkill({ ...skill, score: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5" />
              </label>
              <label className="text-sm block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">Max score</span>
                <input type="number" value={skill.max_score} onChange={(e) => setSkill({ ...skill, max_score: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5" />
              </label>
            </div>
            <input value={skill.note} onChange={(e) => setSkill({ ...skill, note: e.target.value })} placeholder="Note (optional)" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <button type="button" onClick={() => void gradeSkill()} disabled={!skill.memberId || (!skill.rubric_criterion_id && !skill.skill_label)} className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-60">Save Skill Grade</button>
          </div>
        </div>
      </div>

      {creating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-bold text-lg">New Assessment</h3>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (e.g. Broad Jump)" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.assessment_type} onChange={(e) => setForm({ ...form, assessment_type: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2">
                <option value="benchmark">Benchmark</option>
                <option value="rubric">Rubric</option>
                <option value="skill">Skill</option>
              </select>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unit (in, sec...)" className="border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <select value={form.tenet_id} onChange={(e) => setForm({ ...form, tenet_id: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Tenet (optional)</option>
              {taxonomy?.tenets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Cancel</button>
              <button type="button" onClick={() => void createAssessment()} disabled={!form.name} className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60">Create</button>
            </div>
          </div>
        </div>
      )}

      {buildingRubric && <RubricBuilder onClose={() => setBuildingRubric(false)} onSaved={() => { setBuildingRubric(false); void load() }} />}
    </div>
  )
}

function RubricBuilder({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { taxonomy } = useTaxonomy()
  const [form, setForm] = useState({ name: '', description: '', scale_min: 1, scale_max: 5 })
  const [criteria, setCriteria] = useState<RubricCriterion[]>([{ name: '', tenet_id: null }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!form.name) return
    setSaving(true)
    setError(null)
    try {
      await coachFetch('/api/coach/rubrics', {
        method: 'POST',
        body: JSON.stringify({ ...form, criteria: criteria.filter((c) => c.name.trim()).map((c) => ({ ...c, tenet_id: c.tenet_id || null })) }),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rubric')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg">New Rubric</h3>
        {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rubric name (e.g. Cartwheel Form)" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm"><span className="block text-xs font-semibold text-gray-500 mb-1">Scale min</span>
            <input type="number" value={form.scale_min} onChange={(e) => setForm({ ...form, scale_min: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm"><span className="block text-xs font-semibold text-gray-500 mb-1">Scale max</span>
            <input type="number" value={form.scale_max} onChange={(e) => setForm({ ...form, scale_max: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </label>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Criteria</span>
            <button type="button" onClick={() => setCriteria([...criteria, { name: '', tenet_id: null }])} className="text-vortex-red text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
          </div>
          <div className="space-y-2">
            {criteria.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center text-sm">
                <input value={c.name} onChange={(e) => setCriteria(criteria.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Criterion name" className="border border-gray-300 rounded px-2 py-1" />
                <select value={c.tenet_id ?? ''} onChange={(e) => setCriteria(criteria.map((x, j) => j === i ? { ...x, tenet_id: e.target.value ? Number(e.target.value) : null } : x))} className="border border-gray-300 rounded px-2 py-1">
                  <option value="">Tenet (optional)</option>
                  {taxonomy?.tenets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="button" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving || !form.name} className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60">Save Rubric</button>
        </div>
      </div>
    </div>
  )
}
