import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  ClipboardCheck,
  Expand,
  GripVertical,
  Minimize,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useRosterMembers } from './useRosterMembers'

type Component = { key: string; label: string; defaultIssues: string[]; variants?: string[] }
type Movement = { key: string; label: string; variants?: string[]; components: Component[] }
type Tag = { id: number; movement_key: string; component_key: string; label: string }
type Entry = { score: number | ''; issues: string[]; filter: string }
type MovementState = { overall: number | ''; overridden: boolean; components: Record<string, Entry> }
type SkillCard = { id: string; movementKey: string; variant: string }
type SavedTemplate = { id: string; name: string; archived?: boolean; cards: SkillCard[] }
type EvaluationReportItem = { movement: string; component: string; text: string }
type EvaluationReport = {
  focus?: EvaluationReportItem[]
  strengths?: EvaluationReportItem[]
  coachNote?: string | null
}
type EvaluationListItem = {
  id: number
  member_id: number | null
  evaluated_at: string
  evaluation_name: string
  recipient_email?: string | null
  coach_note?: string | null
  report: EvaluationReport
  athlete_name?: string | null
  coach_name?: string | null
}
type EvaluationDetail = EvaluationListItem & {
  movements: Array<{
    id: number
    movement_key: string
    movement_label: string
    variant_label?: string | null
    overall_score?: number | null
    components: Array<{
      id: number
      key: string
      label: string
      score?: number | null
      issues: string[]
    }>
  }>
}
type ViewMode = 'evaluate' | 'create-form' | 'edit-form' | 'history' | 'saved'

function athleteLabel(item: Pick<EvaluationListItem, 'athlete_name' | 'recipient_email'>) {
  return item.athlete_name || item.recipient_email || 'Athlete'
}

function evaluationDateLabel(value: string) {
  const parsed = new Date(value.includes('T') ? value : `${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
}

const scoreOptions = [1, 2, 3, 4, 5]
const DEFAULT_FORM_ID = '__foundational_floor__'
const DEFAULT_FORM_NAME = 'Foundational Floor'

function stateFor(movement: Movement): MovementState {
  return {
    overall: '',
    overridden: false,
    components: Object.fromEntries(
      movement.components.map((component) => [component.key, { score: '', issues: [], filter: '' }]),
    ),
  }
}
function stateKey(movementKey: string, variant = '') {
  return `${movementKey}:${variant}`
}
function initialCards(movements: Movement[]): SkillCard[] {
  return movements.flatMap((movement) =>
    (movement.variants?.length ? movement.variants : ['']).map((variant) => ({
      id: stateKey(movement.key, variant),
      movementKey: movement.key,
      variant,
    })),
  )
}
function componentsFor(movement: Movement, variant: string) {
  return movement.components.filter(
    (component) => !component.variants?.length || component.variants.includes(variant),
  )
}
function parseRecipientEmails(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean),
    ),
  ]
}
function cardsSignature(cards: SkillCard[]): string {
  return cards.map((card) => card.id).join('|')
}
function valuesForCards(movements: Movement[], cards: SkillCard[]): Record<string, MovementState> {
  const byKey = new Map(movements.map((movement) => [movement.key, movement]))
  return Object.fromEntries(
    cards.map((card) => {
      const movement = byKey.get(card.movementKey)
      return [card.id, movement ? stateFor(movement) : { overall: '', overridden: false, components: {} }]
    }),
  )
}

export default function GymnasticsEvaluationPanel() {
  const { members } = useRosterMembers('all')
  const [movements, setMovements] = useState<Movement[]>([])
  const [customTags, setCustomTags] = useState<Tag[]>([])
  const [values, setValues] = useState<Record<string, MovementState>>({})
  const [cards, setCards] = useState<SkillCard[]>([])
  const [memberId, setMemberId] = useState('')
  const [athleteQuery, setAthleteQuery] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [selectedFormId, setSelectedFormId] = useState(DEFAULT_FORM_ID)
  const [viewMode, setViewMode] = useState<ViewMode>('evaluate')
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [historyItems, setHistoryItems] = useState<EvaluationListItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null)
  const [historyDetail, setHistoryDetail] = useState<EvaluationDetail | null>(null)
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false)
  const [templates, setTemplates] = useState<SavedTemplate[]>(() =>
    JSON.parse(localStorage.getItem('vortex_eval_templates') || '[]'),
  )
  const [showTemplateSave, setShowTemplateSave] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [editingFormId, setEditingFormId] = useState<string | null>(null)
  const [editingFormName, setEditingFormName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [coachNote, setCoachNote] = useState('')
  const [editingSkills, setEditingSkills] = useState(false)
  const [skillQuery, setSkillQuery] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [missingFields, setMissingFields] = useState<string[]>([])

  const matchingMembers = useMemo(
    () =>
      members
        .filter((member) => member.name.toLowerCase().includes(athleteQuery.toLowerCase()))
        .slice(0, 12),
    [members, athleteQuery],
  )
  const activeTemplates = useMemo(
    () => templates.filter((template) => !template.archived),
    [templates],
  )
  const defaultCards = useMemo(() => initialCards(movements), [movements])
  const selectedFormName = useMemo(() => {
    if (selectedFormId === DEFAULT_FORM_ID) return DEFAULT_FORM_NAME
    return activeTemplates.find((template) => template.id === selectedFormId)?.name || DEFAULT_FORM_NAME
  }, [selectedFormId, activeTemplates])
  const baselineCards = useMemo(() => {
    if (selectedFormId === DEFAULT_FORM_ID) return defaultCards
    return activeTemplates.find((template) => template.id === selectedFormId)?.cards || defaultCards
  }, [selectedFormId, defaultCards, activeTemplates])
  const formModified =
    viewMode === 'evaluate' && cardsSignature(cards) !== cardsSignature(baselineCards)
  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase()
    return historyItems.filter((item) => {
      const date = String(item.evaluated_at || '').slice(0, 10)
      const haystack = [
        athleteLabel(item),
        item.evaluation_name,
        item.coach_name || '',
        item.recipient_email || '',
      ]
        .join(' ')
        .toLowerCase()
      return (
        (!query || haystack.includes(query)) &&
        (!historyFrom || date >= historyFrom) &&
        (!historyTo || date <= historyTo)
      )
    })
  }, [historyItems, historyQuery, historyFrom, historyTo])

  const loadHistory = async () => {
    setHistoryLoading(true)
    setError(null)
    try {
      const rows = await coachFetch<EvaluationListItem[]>('/api/coach/gymnastics-evaluations')
      setHistoryItems(Array.isArray(rows) ? rows : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load athlete evaluations.')
      setHistoryItems([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const openHistoryDetail = async (id: number) => {
    setSelectedHistoryId(id)
    setHistoryDetailLoading(true)
    setError(null)
    try {
      const detail = await coachFetch<EvaluationDetail>(`/api/coach/gymnastics-evaluations/${id}`)
      setHistoryDetail(detail)
    } catch (err) {
      setHistoryDetail(null)
      setError(err instanceof Error ? err.message : 'Unable to load evaluation details.')
    } finally {
      setHistoryDetailLoading(false)
    }
  }

  useEffect(() => {
    coachFetch<{ movements: Movement[]; customIssueTags: Tag[] }>(
      '/api/coach/gymnastics-evaluations/definition',
    )
      .then((data) => {
        const cardsNext = initialCards(data.movements)
        setMovements(data.movements)
        setCustomTags(data.customIssueTags)
        setCards(cardsNext)
        setValues(valuesForCards(data.movements, cardsNext))
        setSelectedFormId(DEFAULT_FORM_ID)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Unable to load the evaluation form.'),
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (viewMode !== 'history') return
    void loadHistory()
  }, [viewMode])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const movementByKey = useMemo(
    () => new Map(movements.map((movement) => [movement.key, movement])),
    [movements],
  )
  const selectedIds = new Set(cards.map((card) => card.id))
  const skillOptions = useMemo(
    () =>
      movements
        .flatMap((movement) =>
          (movement.variants?.length ? movement.variants : ['']).map((variant) => ({
            id: stateKey(movement.key, variant),
            movement,
            variant,
            label: `${movement.label}${variant ? ` — ${variant}` : ''}`,
          })),
        )
        .filter((option) => option.label.toLowerCase().includes(skillQuery.toLowerCase())),
    [movements, skillQuery],
  )

  const applyFormCards = (nextCards: SkillCard[], formId: string, resetScores = true) => {
    setCards(nextCards)
    setValues((current) => {
      if (resetScores) return valuesForCards(movements, nextCards)
      const next = { ...current }
      for (const card of nextCards) {
        if (!next[card.id]) {
          const movement = movementByKey.get(card.movementKey)
          if (movement) next[card.id] = stateFor(movement)
        }
      }
      return next
    })
    setSelectedFormId(formId)
  }

  const returnToEvaluationForm = () => {
    // Create-form clears the skill list; restore Foundational Floor so evaluate is usable.
    if (viewMode === 'create-form' || cards.length === 0) {
      applyFormCards(defaultCards, DEFAULT_FORM_ID, true)
    }
    setViewMode('evaluate')
    setEditingFormId(null)
    setEditingFormName('')
    setEditingSkills(false)
    setSkillQuery('')
    setSelectedHistoryId(null)
    setHistoryDetail(null)
    setMessage(null)
    setError(null)
  }

  const leaveFocusedMode = () => {
    if (viewMode === 'edit-form') {
      setViewMode('saved')
      setEditingFormId(null)
      setEditingFormName('')
      setSkillQuery('')
      return
    }
    if (viewMode === 'history' && selectedHistoryId != null) {
      setSelectedHistoryId(null)
      setHistoryDetail(null)
      return
    }
    returnToEvaluationForm()
  }

  const openAthleteEvaluations = () => {
    setSelectedHistoryId(null)
    setHistoryDetail(null)
    setViewMode('history')
  }

  const startNewEvaluation = () => {
    applyFormCards(defaultCards, DEFAULT_FORM_ID, true)
    setMemberId('')
    setAthleteQuery('')
    setRecipientEmail('')
    setCoachNote('')
    setDate(new Date().toISOString().slice(0, 10))
    setViewMode('evaluate')
    setEditingSkills(false)
    setEditingFormId(null)
    setMessage(null)
    setError(null)
  }

  const startCreateForm = () => {
    setViewMode('create-form')
    setEditingFormId(null)
    setEditingFormName('')
    setCards([])
    setValues({})
    setSkillQuery('')
    setMessage(null)
    setError(null)
  }

  const startEditForm = (formId: string) => {
    if (formId === DEFAULT_FORM_ID) {
      setEditingFormId(DEFAULT_FORM_ID)
      setEditingFormName(DEFAULT_FORM_NAME)
      setCards(defaultCards.map((card) => ({ ...card })))
      setValues(valuesForCards(movements, defaultCards))
    } else {
      const template = templates.find((item) => item.id === formId)
      if (!template) return
      setEditingFormId(template.id)
      setEditingFormName(template.name)
      setCards(template.cards.map((card) => ({ ...card })))
      setValues(valuesForCards(movements, template.cards))
    }
    setViewMode('edit-form')
    setSkillQuery('')
    setMessage(null)
    setError(null)
  }

  const useFormNow = (formId: string) => {
    if (formId === DEFAULT_FORM_ID) {
      applyFormCards(defaultCards, DEFAULT_FORM_ID, true)
    } else {
      const template = templates.find((item) => item.id === formId)
      if (!template) return
      applyFormCards(template.cards, template.id, true)
    }
    setViewMode('evaluate')
    setEditingSkills(false)
    setEditingFormId(null)
    setMessage(`Loaded ${formId === DEFAULT_FORM_ID ? DEFAULT_FORM_NAME : activeTemplates.find((t) => t.id === formId)?.name || 'form'} for a new evaluation.`)
  }

  const loadFormById = (formId: string) => {
    if (formId === DEFAULT_FORM_ID) {
      applyFormCards(defaultCards, DEFAULT_FORM_ID, true)
      return
    }
    const template = templates.find((item) => item.id === formId)
    if (!template) return
    applyFormCards(template.cards, template.id, true)
  }

  const archiveForm = (formId: string) => {
    if (formId === DEFAULT_FORM_ID) return
    const next = templates.map((item) =>
      item.id === formId ? { ...item, archived: true } : item,
    )
    setTemplates(next)
    localStorage.setItem('vortex_eval_templates', JSON.stringify(next))
    if (selectedFormId === formId) applyFormCards(defaultCards, DEFAULT_FORM_ID, true)
    if (editingFormId === formId) returnToEvaluationForm()
    setMessage('Evaluation form archived.')
  }

  const collectMissingFields = (): string[] => {
    const missing: string[] = []
    const emails = parseRecipientEmails(recipientEmail)
    if (!memberId && emails.length === 0) missing.push('Athlete name or recipient email')
    if (!date) missing.push('Evaluation date')
    if (!selectedFormName.trim()) missing.push('Evaluation type')
    if (cards.length === 0) missing.push('At least one skill')
    for (const card of cards) {
      const movement = movementByKey.get(card.movementKey)
      if (!movement) continue
      const skillLabel = `${movement.label}${card.variant ? ` — ${card.variant}` : ''}`
      const value = values[card.id]
      for (const component of componentsFor(movement, card.variant)) {
        if (
          value?.components[component.key]?.score === '' ||
          value?.components[component.key]?.score == null
        ) {
          missing.push(`${skillLabel}: ${component.label} score`)
        }
      }
      if (value?.overall === '' || value?.overall == null) {
        missing.push(`${skillLabel}: overall score`)
      }
    }
    return missing
  }

  const update = (id: string, updater: (current: MovementState) => MovementState) =>
    setValues((current) => ({ ...current, [id]: updater(current[id]) }))

  const setComponentScore = (
    card: SkillCard,
    _movement: Movement,
    component: Component,
    score: number,
  ) =>
    update(card.id, (current) => {
      const components = {
        ...current.components,
        [component.key]: { ...current.components[component.key], score },
      }
      const scores = Object.values(components)
        .map((entry) => entry.score)
        .filter((value): value is number => typeof value === 'number')
      return {
        ...current,
        components,
        overall: current.overridden
          ? current.overall
          : Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length),
      }
    })

  const toggleIssue = (card: SkillCard, component: Component, issue: string) =>
    update(card.id, (current) => {
      const entry = current.components[component.key]
      return {
        ...current,
        components: {
          ...current.components,
          [component.key]: {
            ...entry,
            issues: entry.issues.includes(issue)
              ? entry.issues.filter((item) => item !== issue)
              : [...entry.issues, issue],
          },
        },
      }
    })

  const setFilter = (card: SkillCard, component: Component, filter: string) =>
    update(card.id, (current) => ({
      ...current,
      components: {
        ...current.components,
        [component.key]: { ...current.components[component.key], filter },
      },
    }))

  const addCustomIssue = async (card: SkillCard, movement: Movement, component: Component) => {
    const label = values[card.id].components[component.key].filter.trim()
    if (!label) return
    try {
      const tag = await coachFetch<Tag>('/api/coach/gymnastics-evaluations/issue-tags', {
        method: 'POST',
        body: JSON.stringify({
          movement_key: movement.key,
          component_key: component.key,
          label,
        }),
      })
      setCustomTags((current) =>
        current.some((item) => item.id === tag.id) ? current : [...current, tag],
      )
      update(card.id, (current) => ({
        ...current,
        components: {
          ...current.components,
          [component.key]: {
            ...current.components[component.key],
            filter: '',
            issues: [...current.components[component.key].issues, tag.label],
          },
        },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save issue.')
    }
  }

  const addSkill = (id: string) => {
    const option = skillOptions.find((item) => item.id === id)
    if (!option || selectedIds.has(id)) return
    setCards((current) => [
      ...current,
      { id, movementKey: option.movement.key, variant: option.variant },
    ])
    setValues((current) => ({
      ...current,
      [id]: current[id] ?? stateFor(option.movement),
    }))
    setSkillQuery('')
  }

  const reorder = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    setCards((current) => {
      const source = current.findIndex((card) => card.id === draggedId)
      const target = current.findIndex((card) => card.id === targetId)
      const next = [...current]
      next.splice(target, 0, next.splice(source, 1)[0])
      return next
    })
    setDraggedId(null)
  }

  const save = async () => {
    setPublishConfirmOpen(false)
    setSaving(true)
    setError(null)
    setMessage(null)
    const emails = parseRecipientEmails(recipientEmail)
    const payload = cards.map((card) => {
      const movement = movementByKey.get(card.movementKey)!
      const value = values[card.id]
      return {
        key: movement.key,
        label: movement.label,
        variant: card.variant || null,
        overall_score: value?.overall || null,
        components: componentsFor(movement, card.variant).map((component) => ({
          key: component.key,
          label: component.label,
          score: value?.components[component.key]?.score || null,
          issues: value?.components[component.key]?.issues || [],
        })),
      }
    })
    try {
      await coachFetch('/api/coach/gymnastics-evaluations', {
        method: 'POST',
        body: JSON.stringify({
          member_id: Number(memberId) || null,
          recipient_email: emails.join(', ') || null,
          evaluated_at: date,
          evaluation_name: selectedFormName,
          coach_note: coachNote || null,
          movements: payload,
        }),
      })
      setMessage('Evaluation published to the athlete’s Progress tab.')
      setCoachNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish evaluation.')
    } finally {
      setSaving(false)
    }
  }

  const requestPublish = () => {
    setError(null)
    const missing = collectMissingFields()
    if (missing.length === 0) {
      void save()
      return
    }
    setMissingFields(missing)
    setPublishConfirmOpen(true)
  }

  const saveTemplateAsNew = () => {
    const name = templateName.trim() || 'Custom evaluation'
    const next = [{ id: crypto.randomUUID(), name, cards }, ...templates]
    setTemplates(next)
    localStorage.setItem('vortex_eval_templates', JSON.stringify(next))
    setShowTemplateSave(false)
    setSelectedFormId(next[0].id)
    setViewMode('evaluate')
    setEditingSkills(false)
    setMessage('Evaluation form saved.')
  }

  const saveEditedForm = () => {
    const name = editingFormName.trim() || 'Custom evaluation'
    if (editingFormId === DEFAULT_FORM_ID) {
      // Editing the default creates a new saved form rather than overwriting the built-in.
      const next = [{ id: crypto.randomUUID(), name, cards }, ...templates]
      setTemplates(next)
      localStorage.setItem('vortex_eval_templates', JSON.stringify(next))
      setSelectedFormId(next[0].id)
      setMessage('Saved as a new evaluation form.')
    } else if (editingFormId) {
      const next = templates.map((item) =>
        item.id === editingFormId ? { ...item, name, cards } : item,
      )
      setTemplates(next)
      localStorage.setItem('vortex_eval_templates', JSON.stringify(next))
      setSelectedFormId(editingFormId)
      setMessage('Evaluation form updated.')
    }
    setViewMode('saved')
    setEditingFormId(null)
    setEditingFormName('')
  }

  const inFormBuilder = viewMode === 'create-form' || viewMode === 'edit-form'
  const showSkillEditor = inFormBuilder || (viewMode === 'evaluate' && editingSkills)
  const focusedMode = viewMode === 'history' || viewMode === 'saved' || inFormBuilder

  if (loading) return <div className="text-sm text-gray-500">Loading evaluation form…</div>

  return (
    <div
      className={`${isFullscreen ? 'fixed inset-0 z-[100] overflow-y-auto bg-gray-50 p-4 md:p-8' : ''} space-y-5`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ClipboardCheck className="h-6 w-6 text-vortex-red" /> Gymnastics Evaluation
          </h2>
          <p className="text-sm text-gray-500">
            {viewMode === 'history'
              ? selectedHistoryId != null
                ? 'Review the finalized evaluation report and scores.'
                : 'Browse published athlete evaluations by date.'
              : viewMode === 'saved'
                ? 'Manage reusable evaluation forms.'
                : viewMode === 'create-form'
                  ? 'Build a reusable set of skills for coaches to evaluate.'
                  : viewMode === 'edit-form'
                    ? 'Edit this evaluation form’s name and skill list.'
                    : 'Quick, component-by-component evaluation with clear coaching focus.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {focusedMode ? (
            <button
              type="button"
              onClick={leaveFocusedMode}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
            >
              {viewMode === 'edit-form'
                ? 'Return to saved forms'
                : viewMode === 'history' && selectedHistoryId != null
                  ? 'Back to evaluation list'
                  : 'Return to evaluation form'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={startNewEvaluation}
                className="rounded-lg bg-vortex-red px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                New evaluation
              </button>
              <button
                type="button"
                onClick={() => setEditingSkills((value) => !value)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
              >
                <Pencil className="h-4 w-4" />
                {editingSkills ? 'Done editing' : 'Edit skills'}
              </button>
              <button
                type="button"
                onClick={startCreateForm}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
              >
                Create an evaluation
              </button>
              <button
                type="button"
                onClick={openAthleteEvaluations}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
              >
                View athlete evaluations
              </button>
              <button
                type="button"
                onClick={() => setViewMode('saved')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
              >
                Saved evaluation forms
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsFullscreen((value) => !value)}
            aria-label="Toggle fullscreen"
            className="rounded-lg border border-gray-300 p-2"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {message && (
        <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>
      )}

      {viewMode === 'evaluate' && (
        <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block text-xs font-semibold text-gray-500">Athlete name</span>
            <input
              value={athleteQuery}
              onChange={(event) => {
                setAthleteQuery(event.target.value)
                setMemberId('')
              }}
              placeholder="Search any athlete…"
              className="h-10 w-full rounded border border-gray-300 px-2"
            />
            {athleteQuery && !memberId && (
              <div className="relative z-10">
                <div className="absolute mt-1 w-full rounded border bg-white shadow">
                  {matchingMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setMemberId(String(member.id))
                        setAthleteQuery(member.name)
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-gray-500">Recipient email</span>
            <input
              type="text"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              placeholder="parent@example.com, coach@example.com"
              className="h-10 w-full rounded border border-gray-300 px-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-gray-500">Evaluation date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-10 w-full rounded border border-gray-300 px-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-gray-500">Evaluation type</span>
            <select
              value={selectedFormId || DEFAULT_FORM_ID}
              onChange={(event) => loadFormById(event.target.value)}
              className="h-10 w-full rounded border border-gray-300 px-2"
            >
              <option value={DEFAULT_FORM_ID}>{DEFAULT_FORM_NAME}</option>
              {activeTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2 lg:col-span-4">
            <span className="mb-1 block text-xs font-semibold text-gray-500">Coach note</span>
            <input
              value={coachNote}
              onChange={(event) => setCoachNote(event.target.value)}
              placeholder="Optional encouragement or context"
              className="h-10 w-full rounded border border-gray-300 px-2"
            />
          </label>
        </div>
      )}

      {viewMode === 'history' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          {selectedHistoryId != null ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setSelectedHistoryId(null)
                  setHistoryDetail(null)
                }}
                className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" /> Back to evaluation list
              </button>
              {historyDetailLoading || !historyDetail ? (
                <p className="text-sm text-gray-500">Loading evaluation…</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {historyDetail.evaluation_name || DEFAULT_FORM_NAME}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {athleteLabel(historyDetail)} · {evaluationDateLabel(historyDetail.evaluated_at)}
                      {historyDetail.coach_name ? ` · ${historyDetail.coach_name}` : ''}
                    </p>
                  </div>

                  {(historyDetail.report?.focus?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-vortex-red">
                        Focus next
                      </div>
                      <ul className="mt-1 space-y-1 text-sm text-gray-700">
                        {historyDetail.report.focus?.map((item, index) => (
                          <li key={`focus-${index}`}>{item.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(historyDetail.report?.strengths?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-green-700">
                        Strengths
                      </div>
                      <ul className="mt-1 space-y-1 text-sm text-gray-700">
                        {historyDetail.report.strengths?.map((item, index) => (
                          <li key={`strength-${index}`}>{item.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(historyDetail.report?.coachNote || historyDetail.coach_note) && (
                    <p className="text-sm italic text-gray-600">
                      {historyDetail.report?.coachNote || historyDetail.coach_note}
                    </p>
                  )}

                  <div className="space-y-3 border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-900">Scored movements</h4>
                    {historyDetail.movements?.length ? (
                      historyDetail.movements.map((movement) => (
                        <div
                          key={movement.id}
                          className="rounded-lg border border-gray-100 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-gray-900">
                            <span>
                              {movement.movement_label}
                              {movement.variant_label ? ` — ${movement.variant_label}` : ''}
                            </span>
                            <span className="text-vortex-red">
                              {movement.overall_score != null
                                ? `${movement.overall_score}/5`
                                : 'Not scored'}
                            </span>
                          </div>
                          <ul className="mt-2 space-y-1 text-sm text-gray-700">
                            {movement.components.map((component) => (
                              <li key={component.id} className="flex flex-wrap justify-between gap-2">
                                <span>
                                  {component.label}
                                  {component.issues?.length
                                    ? ` · Needs practice: ${component.issues.join(', ')}`
                                    : ''}
                                </span>
                                <span className="font-medium text-gray-900">
                                  {component.score != null ? `${component.score}/5` : '—'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No scored movements recorded.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="mb-3 font-semibold text-gray-900">Athlete evaluations</h3>
              <div className="mb-3 flex flex-wrap gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    placeholder="Search by athlete, form, or coach…"
                    className="h-9 w-full rounded border border-gray-300 pl-8 pr-2 text-sm"
                  />
                </div>
                <input
                  type="date"
                  value={historyFrom}
                  onChange={(e) => setHistoryFrom(e.target.value)}
                  className="h-9 rounded border border-gray-300 px-2 text-sm"
                />
                <input
                  type="date"
                  value={historyTo}
                  onChange={(e) => setHistoryTo(e.target.value)}
                  className="h-9 rounded border border-gray-300 px-2 text-sm"
                />
              </div>
              {historyLoading ? (
                <p className="text-sm text-gray-500">Loading evaluations…</p>
              ) : filteredHistory.length ? (
                <div className="divide-y divide-gray-100">
                  {filteredHistory.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void openHistoryDetail(item.id)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="font-semibold text-gray-900">{athleteLabel(item)}</span>
                      <span className="text-gray-600">
                        {evaluationDateLabel(item.evaluated_at)}
                      </span>
                      <span className="text-gray-700">{item.evaluation_name || DEFAULT_FORM_NAME}</span>
                      <span className="text-xs font-semibold text-vortex-red">View report</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No published evaluations yet.</p>
              )}
            </>
          )}
        </div>
      )}

      {viewMode === 'saved' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-semibold text-gray-900">Saved evaluation forms</h3>
          <FormListRow
            name={DEFAULT_FORM_NAME}
            onEdit={() => startEditForm(DEFAULT_FORM_ID)}
            onUse={() => useFormNow(DEFAULT_FORM_ID)}
            onArchive={null}
            defaultBadge
          />
          {activeTemplates.map((template) => (
            <FormListRow
              key={template.id}
              name={template.name}
              onEdit={() => startEditForm(template.id)}
              onUse={() => useFormNow(template.id)}
              onArchive={() => archiveForm(template.id)}
            />
          ))}
        </div>
      )}

      {viewMode === 'create-form' && (
        <div className="rounded-xl border border-vortex-red/30 bg-white p-4">
          <h3 className="font-semibold text-gray-900">Create evaluation form</h3>
          <p className="mt-1 text-sm text-gray-600">
            Add and reorder skills below, then save this as a reusable evaluation form.
          </p>
        </div>
      )}

      {viewMode === 'edit-form' && (
        <div className="rounded-xl border border-vortex-red/30 bg-white p-4">
          <label className="text-sm font-semibold text-gray-800">
            Form name
            <input
              value={editingFormName}
              onChange={(event) => setEditingFormName(event.target.value)}
              className="mt-2 h-10 w-full rounded border border-gray-300 px-3 font-normal"
              placeholder="Evaluation form name"
            />
          </label>
          {editingFormId === DEFAULT_FORM_ID && (
            <p className="mt-2 text-xs text-gray-500">
              Editing Foundational Floor will save as a new form (the default stays unchanged).
            </p>
          )}
        </div>
      )}

      {showSkillEditor && (
        <div className="rounded-xl border border-vortex-red/30 bg-white p-4">
          <label className="text-sm font-semibold text-gray-800">Add a skill</label>
          <input
            list="gymnastics-evaluation-skills"
            value={skillQuery}
            onChange={(event) => {
              const next = event.target.value
              setSkillQuery(next)
              const selected = skillOptions.find((option) => option.label === next)
              if (selected) addSkill(selected.id)
            }}
            placeholder="Type to find a skill…"
            className="mt-2 h-10 w-full rounded border border-gray-300 px-3"
          />
          <datalist id="gymnastics-evaluation-skills">
            {skillOptions.map((option) => (
              <option key={option.id} value={option.label} />
            ))}
          </datalist>
          <div className="mt-3 flex flex-wrap gap-2">
            {skillOptions
              .filter((option) => !selectedIds.has(option.id))
              .map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => addSkill(option.id)}
                  className="rounded-full border border-gray-300 px-3 py-1 text-sm hover:border-vortex-red hover:text-vortex-red"
                >
                  + {option.label}
                </button>
              ))}
          </div>
        </div>
      )}

      {(viewMode === 'evaluate' || inFormBuilder) && (
        <div className="space-y-4">
          {cards.map((card) => {
            const movement = movementByKey.get(card.movementKey)
            return movement ? (
              <SkillCard
                key={card.id}
                card={card}
                movement={movement}
                value={values[card.id]}
                customTags={customTags}
                editing={showSkillEditor}
                compact={draggedId !== null}
                onDragStart={() => setDraggedId(card.id)}
                onDragEnd={() => setDraggedId(null)}
                onDrop={() => reorder(card.id)}
                onDelete={() =>
                  setCards((current) => current.filter((item) => item.id !== card.id))
                }
                onScore={setComponentScore}
                onIssue={toggleIssue}
                onOverall={(score) =>
                  update(card.id, (current) => ({
                    ...current,
                    overall: score,
                    overridden: true,
                  }))
                }
                onFilter={setFilter}
                onAddIssue={addCustomIssue}
              />
            ) : null
          })}
          {inFormBuilder && cards.length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
              Add skills above to build this evaluation form.
            </p>
          )}
        </div>
      )}

      {viewMode === 'evaluate' && (
        <button
          type="button"
          disabled={saving}
          onClick={requestPublish}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-vortex-red px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Publishing…' : 'Save & publish evaluation report'}
        </button>
      )}

      {viewMode === 'evaluate' && formModified && (
        <button
          type="button"
          onClick={() => {
            setTemplateName(`${selectedFormName} (custom)`)
            setShowTemplateSave(true)
          }}
          className="w-full rounded-lg border border-vortex-red px-4 py-3 font-semibold text-vortex-red"
        >
          Save new evaluation template
        </button>
      )}

      {viewMode === 'create-form' && (
        <button
          type="button"
          onClick={() => {
            setTemplateName('')
            setShowTemplateSave(true)
          }}
          className="w-full rounded-lg border border-vortex-red px-4 py-3 font-semibold text-vortex-red"
        >
          Save evaluation form
        </button>
      )}

      {viewMode === 'edit-form' && (
        <button
          type="button"
          onClick={saveEditedForm}
          className="w-full rounded-lg bg-vortex-red px-4 py-3 font-semibold text-white"
        >
          Save form changes
        </button>
      )}

      {showTemplateSave && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Save evaluation form</h3>
              <button type="button" onClick={() => setShowTemplateSave(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              autoFocus
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Form name"
              className="h-10 w-full rounded border border-gray-300 px-3"
            />
            <button
              type="button"
              onClick={saveTemplateAsNew}
              className="mt-4 w-full rounded-lg bg-vortex-red px-4 py-2 font-semibold text-white"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {publishConfirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Incomplete evaluation</h3>
              <button type="button" onClick={() => setPublishConfirmOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Some fields are still missing. Fail tags are optional and are not listed here. Do you
              want to keep evaluating, or publish now as-is?
            </p>
            <ul className="mt-4 max-h-56 list-disc space-y-1 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPublishConfirmOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Continue evaluating
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-lg bg-vortex-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Publish now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FormListRow({
  name,
  onEdit,
  onUse,
  onArchive,
  defaultBadge = false,
}: {
  name: string
  onEdit: () => void
  onUse: () => void
  onArchive: (() => void) | null
  defaultBadge?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t py-3 text-sm first:border-t-0">
      <div className="min-w-0">
        <span className="font-medium text-gray-900">{name}</span>
        {defaultBadge && (
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            Default
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${name}`}
          title="Edit form"
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-vortex-red"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onUse}
          aria-label={`Use ${name}`}
          title="Use this form for a new evaluation"
          className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"
        >
          <Zap className="h-4 w-4" />
        </button>
        {onArchive ? (
          <button
            type="button"
            onClick={onArchive}
            aria-label={`Archive ${name}`}
            title="Archive form"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <Archive className="h-4 w-4" />
          </button>
        ) : (
          <span className="inline-block w-8" aria-hidden />
        )}
      </div>
    </div>
  )
}

function SkillCard({
  card,
  movement,
  value,
  customTags,
  editing,
  compact,
  onDragStart,
  onDragEnd,
  onDrop,
  onDelete,
  onScore,
  onIssue,
  onOverall,
  onFilter,
  onAddIssue,
}: {
  card: SkillCard
  movement: Movement
  value: MovementState
  customTags: Tag[]
  editing: boolean
  compact: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDrop: () => void
  onDelete: () => void
  onScore: (card: SkillCard, movement: Movement, component: Component, score: number) => void
  onIssue: (card: SkillCard, component: Component, issue: string) => void
  onOverall: (score: number) => void
  onFilter: (card: SkillCard, component: Component, filter: string) => void
  onAddIssue: (card: SkillCard, movement: Movement, component: Component) => void
}) {
  const title = `${movement.label}${card.variant ? ` — ${card.variant}` : ''}`
  return (
    <article
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className="rounded-xl border border-gray-200 bg-white"
    >
      <div className="flex items-center gap-2 p-4">
        {editing && (
          <button
            type="button"
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            aria-label={`Reorder ${title}`}
            className="cursor-grab rounded p-1 text-gray-400 active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <h3 className="flex-1 font-bold text-gray-900">{title}</h3>
        {editing && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${title}`}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {!compact && value && (
        <div className="space-y-4 border-t border-gray-100 p-4">
          {componentsFor(movement, card.variant).map((component) => {
            const entry = value.components[component.key] || {
              score: '' as const,
              issues: [],
              filter: '',
            }
            const allTags = [
              ...component.defaultIssues,
              ...customTags
                .filter(
                  (tag) =>
                    tag.movement_key === movement.key && tag.component_key === component.key,
                )
                .map((tag) => tag.label),
            ].filter((tag, index, list) => list.indexOf(tag) === index)
            const filtered = allTags.filter((tag) =>
              tag.toLowerCase().includes(entry.filter.toLowerCase()),
            )
            return (
              <section key={component.key} className="rounded-lg bg-gray-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-800">{component.label}</h4>
                  <ScoreSelect
                    value={entry.score}
                    label={`${component.label} score`}
                    onChange={(score) => onScore(card, movement, component, score)}
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={entry.filter}
                    onChange={(event) => onFilter(card, component, event.target.value)}
                    placeholder="Search tags or add a new issue…"
                    className="h-9 min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!entry.filter.trim()}
                    onClick={() => void onAddIssue(card, movement, component)}
                    className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 text-xs font-medium disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {filtered.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onIssue(card, component, tag)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        entry.issues.includes(tag)
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : 'border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <span className="text-xs text-gray-400">No matching fail tags yet.</span>
                  )}
                </div>
              </section>
            )
          })}
          <div className="flex justify-end border-t border-gray-200 pt-3">
            <ScoreSelect
              value={value.overall}
              label="Overall movement score"
              onChange={onOverall}
            />
          </div>
        </div>
      )}
    </article>
  )
}

function ScoreSelect({
  value,
  label,
  onChange,
}: {
  value: number | ''
  label: string
  onChange: (score: number) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">
      {label}
      <select
        value={value}
        onChange={(event) => {
          if (event.target.value) onChange(Number(event.target.value))
        }}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
      >
        <option value="">Score</option>
        {scoreOptions.map((score) => (
          <option key={score} value={score}>
            {score}/5
          </option>
        ))}
      </select>
    </label>
  )
}
