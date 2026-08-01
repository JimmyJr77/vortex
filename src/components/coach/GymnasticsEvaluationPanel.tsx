import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, ChevronDown, Plus, Save } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useRosterMembers } from './useRosterMembers'

type Component = { key: string; label: string; defaultIssues: string[] }
type Movement = { key: string; label: string; variants?: string[]; components: Component[] }
type Tag = { id: number; movement_key: string; component_key: string; label: string }
type Entry = { score: number | ''; issues: string[]; note: string }
type MovementState = { overall: number | ''; overridden: boolean; components: Record<string, Entry> }
const scoreOptions = [1, 2, 3, 4, 5]

function stateFor(movement: Movement): MovementState {
  return { overall: '', overridden: false, components: Object.fromEntries(movement.components.map((component) => [component.key, { score: '', issues: [], note: '' }])) }
}
function stateKey(movement: Movement, variant = '') { return `${movement.key}:${variant}` }

export default function GymnasticsEvaluationPanel() {
  const { members } = useRosterMembers()
  const [movements, setMovements] = useState<Movement[]>([])
  const [customTags, setCustomTags] = useState<Tag[]>([])
  const [values, setValues] = useState<Record<string, MovementState>>({})
  const [memberId, setMemberId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [coachNote, setCoachNote] = useState('')
  const [history, setHistory] = useState<Array<{ id: number; evaluated_at: string; report: { focus?: Array<{ text: string }>; strengths?: Array<{ text: string }> } }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    coachFetch<{ movements: Movement[]; customIssueTags: Tag[] }>('/api/coach/gymnastics-evaluations/definition')
      .then((data) => {
        setMovements(data.movements)
        setCustomTags(data.customIssueTags)
        const initial: Record<string, MovementState> = {}
        data.movements.forEach((movement) => (movement.variants?.length ? movement.variants : ['']).forEach((variant) => { initial[stateKey(movement, variant)] = stateFor(movement) }))
        setValues(initial)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load the evaluation form.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!memberId) { setHistory([]); return }
    coachFetch<Array<{ id: number; evaluated_at: string; report: { focus?: Array<{ text: string }>; strengths?: Array<{ text: string }> } }>>(`/api/coach/athletes/${memberId}/gymnastics-evaluations`)
      .then(setHistory).catch(() => setHistory([]))
  }, [memberId])

  const complete = useMemo(() => movements.every((movement) => (movement.variants?.length ? movement.variants : ['']).every((variant) => movement.components.every((component) => values[stateKey(movement, variant)]?.components[component.key]?.score !== ''))), [movements, values])
  const update = (key: string, updater: (current: MovementState) => MovementState) => setValues((current) => ({ ...current, [key]: updater(current[key]) }))
  const setComponentScore = (movement: Movement, variant: string, component: Component, score: number) => {
    const key = stateKey(movement, variant)
    update(key, (current) => {
      const components = { ...current.components, [component.key]: { ...current.components[component.key], score } }
      const numeric = Object.values(components).map((entry) => entry.score).filter((value): value is number => typeof value === 'number')
      return { ...current, components, overall: current.overridden ? current.overall : (numeric.length ? Math.round(numeric.reduce((sum, value) => sum + value, 0) / numeric.length) : '') }
    })
  }
  const toggleIssue = (movement: Movement, variant: string, component: Component, issue: string) => {
    const key = stateKey(movement, variant)
    update(key, (current) => {
      const entry = current.components[component.key]
      const issues = entry.issues.includes(issue) ? entry.issues.filter((item) => item !== issue) : [...entry.issues, issue]
      return { ...current, components: { ...current.components, [component.key]: { ...entry, issues } } }
    })
  }
  const addIssue = async (movement: Movement, variant: string, component: Component) => {
    const key = stateKey(movement, variant); const entry = values[key].components[component.key]; const label = entry.note.trim()
    if (!label) return
    try {
      const tag = await coachFetch<Tag>('/api/coach/gymnastics-evaluations/issue-tags', { method: 'POST', body: JSON.stringify({ movement_key: movement.key, component_key: component.key, label }) })
      setCustomTags((current) => current.some((item) => item.id === tag.id) ? current : [...current, tag])
      update(key, (current) => ({ ...current, components: { ...current.components, [component.key]: { ...current.components[component.key], note: '', issues: [...current.components[component.key].issues, tag.label] } } }))
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save issue.') }
  }
  const save = async () => {
    if (!memberId || !complete) return
    setSaving(true); setError(null); setMessage(null)
    const payload = movements.flatMap((movement) => (movement.variants?.length ? movement.variants : ['']).map((variant) => {
      const current = values[stateKey(movement, variant)]
      return { key: movement.key, label: movement.label, variant: variant || null, overall_score: current.overall || null, components: movement.components.map((component) => ({ key: component.key, label: component.label, score: current.components[component.key].score || null, issues: current.components[component.key].issues })) }
    }))
    try {
      await coachFetch('/api/coach/gymnastics-evaluations', { method: 'POST', body: JSON.stringify({ member_id: Number(memberId), evaluated_at: date, coach_note: coachNote || null, movements: payload }) })
      setMessage('Evaluation published to the athlete’s Progress tab.')
      setCoachNote('')
      const refreshed = await coachFetch<Array<{ id: number; evaluated_at: string; report: { focus?: Array<{ text: string }>; strengths?: Array<{ text: string }> } }>>(`/api/coach/athletes/${memberId}/gymnastics-evaluations`)
      setHistory(refreshed)
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to publish evaluation.') } finally { setSaving(false) }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading evaluation form…</div>
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-vortex-red" /> Gymnastics Evaluation</h2><p className="text-sm text-gray-500">Score each movement, capture coaching observations, and publish a constructive focus report.</p></div></div>
    {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}{message && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>}
    <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-3"><label className="text-sm"><span className="mb-1 block text-xs font-semibold text-gray-500">Athlete</span><select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="w-full rounded border border-gray-300 px-2 py-2"><option value="">Select athlete…</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label className="text-sm"><span className="mb-1 block text-xs font-semibold text-gray-500">Evaluation date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded border border-gray-300 px-2 py-2" /></label><label className="text-sm md:col-span-1"><span className="mb-1 block text-xs font-semibold text-gray-500">Coach note</span><input value={coachNote} onChange={(event) => setCoachNote(event.target.value)} placeholder="Optional encouragement or context" className="w-full rounded border border-gray-300 px-2 py-2" /></label></div>
    <div className="space-y-4">{movements.map((movement) => (movement.variants?.length ? movement.variants : ['']).map((variant) => <MovementCard key={stateKey(movement, variant)} movement={movement} variant={variant} value={values[stateKey(movement, variant)]} customTags={customTags} onScore={setComponentScore} onIssue={toggleIssue} onOverall={(score) => update(stateKey(movement, variant), (current) => ({ ...current, overall: score, overridden: true }))} onNote={(component, note) => update(stateKey(movement, variant), (current) => ({ ...current, components: { ...current.components, [component.key]: { ...current.components[component.key], note } } }))} onAddIssue={addIssue} />))}</div>
    <button type="button" disabled={!memberId || !complete || saving} onClick={() => void save()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-vortex-red px-4 py-3 font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Publishing…' : 'Save & publish evaluation report'}</button>
    {memberId && history.length > 0 && <div className="rounded-xl border border-gray-200 bg-white p-4"><h3 className="mb-3 font-semibold text-gray-900">Published evaluations</h3><div className="space-y-3">{history.map((item) => <div key={item.id} className="rounded-lg border border-gray-100 p-3 text-sm"><div className="font-medium">{new Date(item.evaluated_at).toLocaleDateString()}</div>{item.report.focus?.slice(0, 3).map((focus, index) => <div key={index} className="mt-1 text-gray-600">{focus.text}</div>)}</div>)}</div></div>}
  </div>
}

function MovementCard({ movement, variant, value, customTags, onScore, onIssue, onOverall, onNote, onAddIssue }: { movement: Movement; variant: string; value: MovementState; customTags: Tag[]; onScore: (movement: Movement, variant: string, component: Component, score: number) => void; onIssue: (movement: Movement, variant: string, component: Component, issue: string) => void; onOverall: (score: number) => void; onNote: (component: Component, note: string) => void; onAddIssue: (movement: Movement, variant: string, component: Component) => void }) {
  return <details open className="rounded-xl border border-gray-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between p-4 font-bold text-gray-900">{movement.label}{variant ? ` — ${variant}` : ''}<ChevronDown className="h-4 w-4" /></summary><div className="space-y-4 border-t border-gray-100 p-4">{movement.components.map((component) => { const entry = value.components[component.key]; const issues = [...component.defaultIssues, ...customTags.filter((tag) => tag.movement_key === movement.key && tag.component_key === component.key).map((tag) => tag.label)].filter((item, index, list) => list.indexOf(item) === index); return <div key={component.key} className="rounded-lg bg-gray-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-sm text-gray-800">{component.label}</div><ScoreSelect value={entry.score} label={`${component.label} score`} onChange={(score) => onScore(movement, variant, component, score)} /></div><div className="mt-3 flex flex-wrap gap-2">{issues.map((issue) => <label key={issue} className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${entry.issues.includes(issue) ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600'}`}><input type="checkbox" checked={entry.issues.includes(issue)} onChange={() => onIssue(movement, variant, component, issue)} className="sr-only" />{issue}</label>)}</div><select aria-label={`Add issue for ${component.label}`} defaultValue="" onChange={(event) => { if (event.target.value) { onIssue(movement, variant, component, event.target.value); event.currentTarget.value = '' } }} className="mt-3 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"><option value="">Add an issue from the list…</option>{issues.filter((issue) => !entry.issues.includes(issue)).map((issue) => <option key={issue} value={issue}>{issue}</option>)}</select><div className="mt-3 flex gap-2"><input value={entry.note} onChange={(event) => onNote(component, event.target.value)} placeholder="Add a new issue for this component" className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" /><button type="button" onClick={() => void onAddIssue(movement, variant, component)} className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium"><Plus className="h-3 w-3" />Save issue</button></div></div> })}<div className="flex justify-end border-t border-gray-200 pt-3"><ScoreSelect value={value.overall} label="Overall movement score" onChange={onOverall} /></div></div></details>
}
function ScoreSelect({ value, label, onChange }: { value: number | ''; label: string; onChange: (score: number) => void }) { return <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">{label}<select value={value} onChange={(event) => { if (event.target.value) onChange(Number(event.target.value)) }} className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"><option value="">Score</option>{scoreOptions.map((score) => <option key={score} value={score}>{score}/5</option>)}</select></label> }
