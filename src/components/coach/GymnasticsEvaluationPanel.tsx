import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Expand, GripVertical, Minimize, Pencil, Plus, Save, Trash2, Search, Archive, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useRosterMembers } from './useRosterMembers'

type Component = { key: string; label: string; defaultIssues: string[]; variants?: string[] }
type Movement = { key: string; label: string; variants?: string[]; components: Component[] }
type Tag = { id: number; movement_key: string; component_key: string; label: string }
type Entry = { score: number | ''; issues: string[]; filter: string }
type MovementState = { overall: number | ''; overridden: boolean; components: Record<string, Entry> }
type SkillCard = { id: string; movementKey: string; variant: string }
type SavedTemplate = { id: string; name: string; archived?: boolean; cards: SkillCard[] }
type PublishedEvaluation = { id: string; athlete: string; date: string; name: string; score: number }
const scoreOptions = [1, 2, 3, 4, 5]

function stateFor(movement: Movement): MovementState {
  return { overall: '', overridden: false, components: Object.fromEntries(movement.components.map((component) => [component.key, { score: '', issues: [], filter: '' }])) }
}
function stateKey(movementKey: string, variant = '') { return `${movementKey}:${variant}` }
function initialCards(movements: Movement[]): SkillCard[] { return movements.flatMap((movement) => (movement.variants?.length ? movement.variants : ['']).map((variant) => ({ id: stateKey(movement.key, variant), movementKey: movement.key, variant }))) }
function componentsFor(movement: Movement, variant: string) { return movement.components.filter((component) => !component.variants?.length || component.variants.includes(variant)) }

export default function GymnasticsEvaluationPanel() {
  const { members } = useRosterMembers('all')
  const [movements, setMovements] = useState<Movement[]>([])
  const [customTags, setCustomTags] = useState<Tag[]>([])
  const [values, setValues] = useState<Record<string, MovementState>>({})
  const [cards, setCards] = useState<SkillCard[]>([])
  const [memberId, setMemberId] = useState('')
  const [athleteQuery, setAthleteQuery] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [evaluationName, setEvaluationName] = useState('Foundational Floor')
  const [activePanel, setActivePanel] = useState<'history' | 'saved' | null>(null)
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [templates, setTemplates] = useState<SavedTemplate[]>(() => JSON.parse(localStorage.getItem('vortex_eval_templates') || '[]'))
  const [published, setPublished] = useState<PublishedEvaluation[]>(() => JSON.parse(localStorage.getItem('vortex_eval_reports') || '[]'))
  const [showTemplateSave, setShowTemplateSave] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [coachNote, setCoachNote] = useState('')
  const [history, setHistory] = useState<Array<{ id: number; evaluated_at: string; report: { focus?: Array<{ text: string }> } }>>([])
  const [editing, setEditing] = useState(false)
  const [skillQuery, setSkillQuery] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const matchingMembers = useMemo(() => members.filter((member) => member.name.toLowerCase().includes(athleteQuery.toLowerCase())).slice(0, 12), [members, athleteQuery])
  const edited = editing || cards.map((card) => card.id).join('|') !== initialCards(movements).map((card) => card.id).join('|')
  const filteredPublished = published.filter((item) => item.athlete.toLowerCase().includes(historyQuery.toLowerCase()) && (!historyFrom || item.date >= historyFrom) && (!historyTo || item.date <= historyTo))

  useEffect(() => {
    coachFetch<{ movements: Movement[]; customIssueTags: Tag[] }>('/api/coach/gymnastics-evaluations/definition')
      .then((data) => {
        setMovements(data.movements); setCustomTags(data.customIssueTags); setCards(initialCards(data.movements))
        setValues(Object.fromEntries(data.movements.flatMap((movement) => (movement.variants?.length ? movement.variants : ['']).map((variant) => [stateKey(movement.key, variant), stateFor(movement)]))))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load the evaluation form.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    if (!memberId) { setHistory([]); return }
    coachFetch<Array<{ id: number; evaluated_at: string; report: { focus?: Array<{ text: string }> } }>>(`/api/coach/athletes/${memberId}/gymnastics-evaluations`).then(setHistory).catch(() => setHistory([]))
  }, [memberId])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsFullscreen(false) }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [])

  const movementByKey = useMemo(() => new Map(movements.map((movement) => [movement.key, movement])), [movements])
  const selectedIds = new Set(cards.map((card) => card.id))
  const skillOptions = useMemo(() => movements.flatMap((movement) => (movement.variants?.length ? movement.variants : ['']).map((variant) => ({ id: stateKey(movement.key, variant), movement, variant, label: `${movement.label}${variant ? ` — ${variant}` : ''}` }))).filter((option) => option.label.toLowerCase().includes(skillQuery.toLowerCase())), [movements, skillQuery])
  const complete = cards.length > 0 && cards.every((card) => { const movement = movementByKey.get(card.movementKey); return movement && componentsFor(movement, card.variant).every((component) => values[card.id]?.components[component.key]?.score !== '') })
  const update = (id: string, updater: (current: MovementState) => MovementState) => setValues((current) => ({ ...current, [id]: updater(current[id]) }))
  const setComponentScore = (card: SkillCard, _movement: Movement, component: Component, score: number) => update(card.id, (current) => {
    const components = { ...current.components, [component.key]: { ...current.components[component.key], score } }
    const scores = Object.values(components).map((entry) => entry.score).filter((value): value is number => typeof value === 'number')
    return { ...current, components, overall: current.overridden ? current.overall : Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) }
  })
  const toggleIssue = (card: SkillCard, component: Component, issue: string) => update(card.id, (current) => {
    const entry = current.components[component.key]
    return { ...current, components: { ...current.components, [component.key]: { ...entry, issues: entry.issues.includes(issue) ? entry.issues.filter((item) => item !== issue) : [...entry.issues, issue] } } }
  })
  const setFilter = (card: SkillCard, component: Component, filter: string) => update(card.id, (current) => ({ ...current, components: { ...current.components, [component.key]: { ...current.components[component.key], filter } } }))
  const addCustomIssue = async (card: SkillCard, movement: Movement, component: Component) => {
    const label = values[card.id].components[component.key].filter.trim(); if (!label) return
    try {
      const tag = await coachFetch<Tag>('/api/coach/gymnastics-evaluations/issue-tags', { method: 'POST', body: JSON.stringify({ movement_key: movement.key, component_key: component.key, label }) })
      setCustomTags((current) => current.some((item) => item.id === tag.id) ? current : [...current, tag])
      update(card.id, (current) => ({ ...current, components: { ...current.components, [component.key]: { ...current.components[component.key], filter: '', issues: [...current.components[component.key].issues, tag.label] } } }))
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save issue.') }
  }
  const addSkill = (id: string) => { const option = skillOptions.find((item) => item.id === id); if (!option || selectedIds.has(id)) return; setCards((current) => [...current, { id, movementKey: option.movement.key, variant: option.variant }]); setValues((current) => ({ ...current, [id]: current[id] ?? stateFor(option.movement) })); setSkillQuery('') }
  const reorder = (targetId: string) => { if (!draggedId || draggedId === targetId) return; setCards((current) => { const source = current.findIndex((card) => card.id === draggedId); const target = current.findIndex((card) => card.id === targetId); const next = [...current]; next.splice(target, 0, next.splice(source, 1)[0]); return next }); setDraggedId(null) }
  const save = async () => {
    if (!memberId && !recipientEmail) return
    setSaving(true); setError(null); setMessage(null)
    const payload = cards.map((card) => { const movement = movementByKey.get(card.movementKey)!; const value = values[card.id]; return { key: movement.key, label: movement.label, variant: card.variant || null, overall_score: value.overall || null, components: componentsFor(movement, card.variant).map((component) => ({ key: component.key, label: component.label, score: value.components[component.key].score || null, issues: value.components[component.key].issues })) } })
    try {
      await coachFetch('/api/coach/gymnastics-evaluations', { method: 'POST', body: JSON.stringify({ member_id: Number(memberId) || null, recipient_email: recipientEmail || null, evaluated_at: date, evaluation_name: evaluationName, coach_note: coachNote || null, movements: payload }) })
      const score = Math.round(payload.reduce((sum, item) => sum + (item.overall_score || 0), 0) / payload.length)
      const report = { id: crypto.randomUUID(), athlete: members.find((m) => String(m.id) === memberId)?.name || recipientEmail || 'Email recipient', date, name: evaluationName, score }
      const nextReports = [report, ...published]; setPublished(nextReports); localStorage.setItem('vortex_eval_reports', JSON.stringify(nextReports))
      setMessage('Evaluation published to the athlete’s Progress tab.'); setCoachNote('')
      setHistory(await coachFetch(`/api/coach/athletes/${memberId}/gymnastics-evaluations`))
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to publish evaluation.') } finally { setSaving(false) }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading evaluation form…</div>
  return <div className={`${isFullscreen ? 'fixed inset-0 z-[100] overflow-y-auto bg-gray-50 p-4 md:p-8' : ''} space-y-5`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><ClipboardCheck className="h-6 w-6 text-vortex-red" /> Gymnastics Evaluation</h2><p className="text-sm text-gray-500">Quick, component-by-component evaluation with clear coaching focus.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditing((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"><Pencil className="h-4 w-4" />{editing ? 'Done editing' : 'Edit skills'}</button><button type="button" onClick={() => { setEditing(true); setCards([]); setValues({}); setEvaluationName('') }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold">Create an evaluation</button><button type="button" onClick={() => setActivePanel(activePanel === 'history' ? null : 'history')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold">Athlete evaluations</button><button type="button" onClick={() => setActivePanel(activePanel === 'saved' ? null : 'saved')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold">Saved evaluations</button><button type="button" onClick={() => setIsFullscreen((value) => !value)} aria-label="Toggle fullscreen" className="rounded-lg border border-gray-300 p-2">{isFullscreen ? <Minimize className="h-5 w-5" /> : <Expand className="h-5 w-5" />}</button></div></div>
    {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}{message && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>}
    <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm sm:col-span-2 lg:col-span-1"><span className="mb-1 block text-xs font-semibold text-gray-500">Athlete name</span><input value={athleteQuery} onChange={(event) => { setAthleteQuery(event.target.value); setMemberId('') }} placeholder="Search any athlete…" className="h-10 w-full rounded border border-gray-300 px-2" />{athleteQuery && !memberId && <div className="relative z-10"> <div className="absolute mt-1 w-full rounded border bg-white shadow">{matchingMembers.map((member) => <button key={member.id} type="button" onClick={() => { setMemberId(String(member.id)); setAthleteQuery(member.name) }} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">{member.name}</button>)}</div></div>}</label><label className="text-sm"><span className="mb-1 block text-xs font-semibold text-gray-500">Recipient email</span><input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="parent@example.com" className="h-10 w-full rounded border border-gray-300 px-2" /></label><label className="text-sm"><span className="mb-1 block text-xs font-semibold text-gray-500">Evaluation date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 w-full rounded border border-gray-300 px-2" /></label><label className="text-sm"><span className="mb-1 block text-xs font-semibold text-gray-500">Evaluation name</span><input value={evaluationName} onChange={(event) => setEvaluationName(event.target.value)} className="h-10 w-full rounded border border-gray-300 px-2" /></label><label className="text-sm sm:col-span-2 lg:col-span-4"><span className="mb-1 block text-xs font-semibold text-gray-500">Coach note</span><input value={coachNote} onChange={(event) => setCoachNote(event.target.value)} placeholder="Optional encouragement or context" className="h-10 w-full rounded border border-gray-300 px-2" /></label></div>
    {editing && <div className="rounded-xl border border-vortex-red/30 bg-white p-4"><label className="text-sm font-semibold text-gray-800">Add a skill</label><input list="gymnastics-evaluation-skills" value={skillQuery} onChange={(event) => { const next = event.target.value; setSkillQuery(next); const selected = skillOptions.find((option) => option.label === next); if (selected) addSkill(selected.id) }} placeholder="Type to find a skill…" className="mt-2 h-10 w-full rounded border border-gray-300 px-3" /><datalist id="gymnastics-evaluation-skills">{skillOptions.map((option) => <option key={option.id} value={option.label} />)}</datalist><div className="mt-3 flex flex-wrap gap-2">{skillOptions.filter((option) => !selectedIds.has(option.id)).map((option) => <button key={option.id} type="button" onClick={() => addSkill(option.id)} className="rounded-full border border-gray-300 px-3 py-1 text-sm hover:border-vortex-red hover:text-vortex-red">+ {option.label}</button>)}</div></div>}
    {activePanel === 'history' && <div className="rounded-xl border border-gray-200 bg-white p-4"><div className="mb-3 flex flex-wrap gap-2"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" /><input value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} placeholder="Filter evaluations by athlete…" className="h-9 w-full rounded border border-gray-300 pl-8 pr-2 text-sm" /></div><input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className="h-9 rounded border border-gray-300 px-2 text-sm" /><input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className="h-9 rounded border border-gray-300 px-2 text-sm" /></div>{filteredPublished.length ? filteredPublished.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-3 text-sm"><span className="font-semibold">{item.athlete}</span><span>{new Date(item.date).toLocaleDateString()}</span><span>{item.name}</span><span className="font-bold text-vortex-red">{item.score}/5</span></div>) : <p className="text-sm text-gray-500">No evaluations match your filters.</p>}</div>}
    {activePanel === 'saved' && <div className="rounded-xl border border-gray-200 bg-white p-4"><h3 className="mb-2 font-semibold">Saved evaluation forms</h3>{templates.filter((template) => !template.archived).length ? templates.filter((template) => !template.archived).map((template) => <div key={template.id} className="flex items-center justify-between border-t py-2 text-sm"><span>{template.name}</span><div className="flex gap-2"><button type="button" className="text-vortex-red" onClick={() => { setCards(template.cards); setEditing(false) }}>Use form</button><button type="button" className="text-gray-500" onClick={() => { const name = window.prompt('Rename evaluation form', template.name); if (name) { const next = templates.map((item) => item.id === template.id ? { ...item, name } : item); setTemplates(next); localStorage.setItem('vortex_eval_templates', JSON.stringify(next)) } }}>Rename</button><button type="button" className="text-gray-500" onClick={() => { const next = templates.map((item) => item.id === template.id ? { ...item, archived: true } : item); setTemplates(next); localStorage.setItem('vortex_eval_templates', JSON.stringify(next)) }}><Archive className="h-4 w-4" /></button></div></div>) : <p className="text-sm text-gray-500">No saved forms yet.</p>}</div>}
    <div className="space-y-4">{cards.map((card) => { const movement = movementByKey.get(card.movementKey); return movement ? <SkillCard key={card.id} card={card} movement={movement} value={values[card.id]} customTags={customTags} editing={editing} compact={draggedId !== null} onDragStart={() => setDraggedId(card.id)} onDragEnd={() => setDraggedId(null)} onDrop={() => reorder(card.id)} onDelete={() => setCards((current) => current.filter((item) => item.id !== card.id))} onScore={setComponentScore} onIssue={toggleIssue} onOverall={(score) => update(card.id, (current) => ({ ...current, overall: score, overridden: true }))} onFilter={setFilter} onAddIssue={addCustomIssue} /> : null })}</div>
    <button type="button" disabled={(!memberId && !recipientEmail) || !complete || saving} onClick={() => void save()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-vortex-red px-4 py-3 font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Publishing…' : 'Save & publish evaluation report'}</button>
    {edited && <button type="button" onClick={() => { setTemplateName(evaluationName || 'Foundational Floor'); setShowTemplateSave(true) }} className="w-full rounded-lg border border-vortex-red px-4 py-3 font-semibold text-vortex-red">Save new evaluation template</button>}
    {showTemplateSave && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Save evaluation template</h3><button type="button" onClick={() => setShowTemplateSave(false)}><X className="h-5 w-5" /></button></div><input autoFocus value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Form name" className="h-10 w-full rounded border border-gray-300 px-3" /><button type="button" onClick={() => { const next = [{ id: crypto.randomUUID(), name: templateName.trim() || 'Foundational Floor', cards }, ...templates]; setTemplates(next); localStorage.setItem('vortex_eval_templates', JSON.stringify(next)); setShowTemplateSave(false); setMessage('Evaluation template saved.') }} className="mt-4 w-full rounded-lg bg-vortex-red px-4 py-2 font-semibold text-white">Save</button></div></div>}
    {memberId && history.length > 0 && <div className="rounded-xl border border-gray-200 bg-white p-4"><h3 className="mb-3 font-semibold text-gray-900">Published evaluations</h3>{history.map((item) => <div key={item.id} className="border-t border-gray-100 py-3 text-sm first:border-t-0"><div className="font-medium">{new Date(item.evaluated_at).toLocaleDateString()}</div>{item.report.focus?.slice(0, 3).map((focus, index) => <div key={index} className="mt-1 text-gray-600">{focus.text}</div>)}</div>)}</div>}
  </div>
}

function SkillCard({ card, movement, value, customTags, editing, compact, onDragStart, onDragEnd, onDrop, onDelete, onScore, onIssue, onOverall, onFilter, onAddIssue }: { card: SkillCard; movement: Movement; value: MovementState; customTags: Tag[]; editing: boolean; compact: boolean; onDragStart: () => void; onDragEnd: () => void; onDrop: () => void; onDelete: () => void; onScore: (card: SkillCard, movement: Movement, component: Component, score: number) => void; onIssue: (card: SkillCard, component: Component, issue: string) => void; onOverall: (score: number) => void; onFilter: (card: SkillCard, component: Component, filter: string) => void; onAddIssue: (card: SkillCard, movement: Movement, component: Component) => void }) {
  const title = `${movement.label}${card.variant ? ` — ${card.variant}` : ''}`
  return <article onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="rounded-xl border border-gray-200 bg-white"><div className="flex items-center gap-2 p-4">{editing && <button type="button" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} aria-label={`Reorder ${title}`} className="cursor-grab rounded p-1 text-gray-400 active:cursor-grabbing"><GripVertical className="h-5 w-5" /></button>}<h3 className="flex-1 font-bold text-gray-900">{title}</h3>{editing && <button type="button" onClick={onDelete} aria-label={`Delete ${title}`} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}</div>{!compact && <div className="space-y-4 border-t border-gray-100 p-4">{componentsFor(movement, card.variant).map((component) => { const entry = value.components[component.key]; const allTags = [...component.defaultIssues, ...customTags.filter((tag) => tag.movement_key === movement.key && tag.component_key === component.key).map((tag) => tag.label)].filter((tag, index, list) => list.indexOf(tag) === index); const filtered = allTags.filter((tag) => tag.toLowerCase().includes(entry.filter.toLowerCase())); return <section key={component.key} className="rounded-lg bg-gray-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-gray-800">{component.label}</h4><ScoreSelect value={entry.score} label={`${component.label} score`} onChange={(score) => onScore(card, movement, component, score)} /></div><div className="mt-3 flex gap-2"><input value={entry.filter} onChange={(event) => onFilter(card, component, event.target.value)} placeholder="Search tags or add a new issue…" className="h-9 min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 text-sm" /><button type="button" disabled={!entry.filter.trim()} onClick={() => void onAddIssue(card, movement, component)} className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 text-xs font-medium disabled:opacity-50"><Plus className="h-3 w-3" />Add</button></div><div className="mt-3 flex flex-wrap gap-2">{filtered.map((tag) => <button key={tag} type="button" onClick={() => onIssue(card, component, tag)} className={`rounded-full border px-2.5 py-1 text-xs ${entry.issues.includes(tag) ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600'}`}>{tag}</button>)}{filtered.length === 0 && <span className="text-xs text-gray-400">No matching fail tags yet.</span>}</div></section> })}<div className="flex justify-end border-t border-gray-200 pt-3"><ScoreSelect value={value.overall} label="Overall movement score" onChange={onOverall} /></div></div>}</article>
}
function ScoreSelect({ value, label, onChange }: { value: number | ''; label: string; onChange: (score: number) => void }) { return <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">{label}<select value={value} onChange={(event) => { if (event.target.value) onChange(Number(event.target.value)) }} className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"><option value="">Score</option>{scoreOptions.map((score) => <option key={score} value={score}>{score}/5</option>)}</select></label> }
