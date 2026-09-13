import { useEffect, useRef, useState, type FormEvent } from 'react'
import { coachFetch } from '../../coach/api'
import type { Taxonomy } from '../../coach/taxonomy'
import { activeProgrammingComponents, COMPONENT_LABELS, programmingError, programmingRequestForSubmit, type CoachWorkoutRequest, type SessionComponentKey } from '../../coach/workoutProgramming'
import type { AcceptedExerciseProposal, ExerciseProposalPage, ExerciseProposalResult, ExerciseProposalReview,
  WorkoutExerciseDemand, WorkoutExerciseGapResearch, WorkoutExerciseGapResearchInput } from '../../coach/workoutExerciseProposals'
import { actionClass, controlClass, Field, MultiChoice } from './ProgrammingControls'
import { CanonicalCardEditor } from './CanonicalCardEditor'
import type { CanonicalCard } from './canonicalCardTypes'
import { ExerciseResearchEvidence, ProgrammingExerciseReview } from './ProgrammingExerciseReview'
import { ProgrammingProfileRevision } from './ProgrammingProfileRevision'

const base = '/api/coach/workout-programming'
const blankNeed: WorkoutExerciseDemand = { canonicalName: '', description: '', aliases: [], familyKey: null, movementPatterns: [], bodyRegions: [], requiredEquipment: [] }

export function ProgrammingExerciseLibrary({ request, disabled, aiEnabled, onBusy }: { request: CoachWorkoutRequest; disabled: boolean;
  aiEnabled: boolean; onBusy: (busy: boolean) => void }) {
  const [need, setNeed] = useState<WorkoutExerciseDemand>(blankNeed)
  const [componentKey, setComponentKey] = useState<SessionComponentKey>('strength')
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null)
  const [page, setPage] = useState<ExerciseProposalPage>({ items: [], nextCursor: null })
  const [access, setAccess] = useState(false)
  const [research, setResearch] = useState<{ result: WorkoutExerciseGapResearch; fingerprint: string } | null>(null)
  const [assessment, setAssessment] = useState<ExerciseProposalResult | null>(null)
  const [review, setReview] = useState<ExerciseProposalReview | null>(null)
  const [editor, setEditor] = useState<CanonicalCard | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [stagedDirty, setStagedDirty] = useState(false)
  const active = useRef<AbortController | null>(null)
  const input: WorkoutExerciseGapResearchInput = { request: programmingRequestForSubmit(request), componentKey,
    need: { ...need, aliases: [...new Set(need.aliases.map((alias) => alias.trim()).filter(Boolean))] } }
  const fingerprint = JSON.stringify(input)
  const currentResearch = research?.fingerprint === fingerprint
  const busy = disabled || operation !== null || stagedDirty
  const components = activeProgrammingComponents(request)

  const run = async (name: string, action: (signal: AbortSignal) => Promise<void>) => {
    if (active.current || disabled) return
    const controller = new AbortController(); active.current = controller
    setOperation(name); setError(null)
    try { await action(controller.signal) }
    catch (error) { if (!controller.signal.aborted) {
      setError(programmingError(error))
      if (error instanceof Error && 'status' in error && error.status === 403) {
        setAccess(false); setPage({ items: [], nextCursor: null }); setReview(null); setEditor(null); setResearch(null); setAssessment(null)
      }
    } }
    finally { if (active.current === controller) { active.current = null; setOperation(null) } }
  }
  useEffect(() => () => { active.current?.abort() }, [])
  useEffect(() => { onBusy(operation !== null || stagedDirty); return () => onBusy(false) }, [operation, stagedDirty, onBusy])
  const loadPage = async (signal: AbortSignal, more = false) => {
    const params = new URLSearchParams()
    if (more && page.nextCursor) { params.set('beforeCreatedAt', page.nextCursor.createdAt); params.set('beforeId', page.nextCursor.id) }
    const result = await coachFetch<ExerciseProposalPage>(`${base}/exercise-proposals?${params}`, { signal })
    if (!signal.aborted) {
      setPage((previous) => ({ ...result, items: more ? [...previous.items, ...result.items.filter((item) => !previous.items.some((old) => old.draftAuditId === item.draftAuditId))] : result.items }))
      setAccess(true)
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    void Promise.allSettled([
      coachFetch<Taxonomy>('/api/coach/taxonomy', { signal: controller.signal }),
      coachFetch<ExerciseProposalPage>(`${base}/exercise-proposals`, { signal: controller.signal }),
    ]).then(([vocabulary, history]) => {
      if (controller.signal.aborted) return
      if (vocabulary.status === 'fulfilled') setTaxonomy(vocabulary.value)
      if (history.status === 'fulfilled') { setPage(history.value); setAccess(true) }
      else { setAccess(false); setPage({ items: [], nextCursor: null }); setReview(null) }
      if (vocabulary.status === 'rejected' || history.status === 'rejected') setError('Exercise library review could not load. This workspace requires workout and library management access.')
    })
    return () => controller.abort()
  }, [reload])
  const openReview = async (id: string, signal: AbortSignal) => {
    if (review?.record.draftAuditId !== id) setReview(null)
    const result = await coachFetch<ExerciseProposalReview>(`${base}/exercise-proposals/${id}/review`, { signal })
    if (!signal.aborted) { setReview(result); setAssessment(null) }
  }
  const openCard = (id: string) => void run('Opening canonical card', async (signal) => {
    const result = await coachFetch<CanonicalCard>(`/api/coach/canonical/cards/${id}`, { signal })
    if (!signal.aborted) setEditor(result)
  })
  const search = (event: FormEvent) => {
    event.preventDefault()
    void run('Researching canonical coverage', async (signal) => {
      const result = await coachFetch<WorkoutExerciseGapResearch>(`${base}/exercise-gap/research`, { method: 'POST', signal, body: JSON.stringify(input) })
      if (!signal.aborted) { setResearch({ result, fingerprint }); setAssessment(null) }
    })
  }
  const propose = () => {
    if (!currentResearch) return
    void run('Assessing the gap and proposing content', async (signal) => {
      const result = await coachFetch<ExerciseProposalResult>(`${base}/exercise-gap/propose`, { method: 'POST', signal, body: JSON.stringify(input) })
      if (signal.aborted) return
      setAssessment(result); setReview(null)
      if (result.draftAuditId) {
        await openReview(result.draftAuditId, signal)
        await loadPage(signal)
      }
    })
  }
  const accept = () => {
    if (!review || review.acceptance || review.record.proposal?.kind !== 'new_card') return
    void run('Accepting canonical draft', async (signal) => {
      const result = await coachFetch<AcceptedExerciseProposal>(`${base}/exercise-proposals/${review.record.draftAuditId}/accept`, {
        method: 'POST', signal, body: JSON.stringify({ expectedProposalHash: review.record.contentHash }),
      })
      if (!signal.aborted) setReview({ ...review, acceptance: result })
    })
  }

  return <section className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4" aria-label="Exercise library research">
    <header><h4 className="font-bold">Research an exercise need</h4><p className="mt-1 text-sm text-gray-600">Use the current session controls to search canonical coverage first. A confirmed gap can produce a quarantined proposal for human review.</p></header>
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}
      <button type="button" disabled={busy} className="ml-2 underline" onClick={() => { setError(null); setReload((value) => value + 1) }}>Reload library controls</button></p>}
    <form onSubmit={search}><fieldset disabled={busy || !access || !taxonomy} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Exercise need component"><select className={controlClass} value={componentKey} onChange={(event) => setComponentKey(event.target.value as SessionComponentKey)}>
          {!components.includes(componentKey) && <option value={componentKey} disabled>Choose a scheduled component</option>}
          {components.map((key) => <option key={key} value={key}>{COMPONENT_LABELS[key]}</option>)}</select></Field>
        <Field label="Movement name"><input required maxLength={160} className={controlClass} value={need.canonicalName} onChange={(event) => setNeed({ ...need, canonicalName: event.target.value })} /></Field>
      </div>
      <Field label="Unmet movement demand"><textarea required minLength={20} maxLength={2000} rows={3} className={controlClass} value={need.description}
        placeholder="Describe the stimulus, athlete needs and why the existing choices may not cover it."
        onChange={(event) => setNeed({ ...need, description: event.target.value })} /></Field>
      <Field label="Other names for this movement" hint="Optional. One name per line."><textarea rows={2} className={controlClass} value={need.aliases.join('\n')}
        onChange={(event) => setNeed({ ...need, aliases: event.target.value.split('\n') })} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <MultiChoice label="Demand movement patterns" options={(taxonomy?.patterns ?? []).map((term) => ({ id: term.key, name: term.name }))} selected={need.movementPatterns} onChange={(movementPatterns) => setNeed({ ...need, movementPatterns })} />
        <MultiChoice label="Demand body regions" options={(taxonomy?.bodyRegions ?? []).map((term) => ({ id: term.key, name: term.name }))} selected={need.bodyRegions} onChange={(bodyRegions) => setNeed({ ...need, bodyRegions })} />
        <MultiChoice label="Demand required equipment" options={(taxonomy?.equipment ?? []).map((term) => ({ id: term.key, name: term.name }))} selected={need.requiredEquipment} onChange={(requiredEquipment) => setNeed({ ...need, requiredEquipment })} />
      </div>
      <button type="submit" className={actionClass} disabled={!components.includes(componentKey) || !need.movementPatterns.length || !need.bodyRegions.length}>Research library coverage</button>
    </fieldset></form>
    {research && <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      <h5 className="font-semibold">Coverage research for {research.result.need.canonicalName}</h5>
      {!currentResearch && <p role="status" className="text-sm text-amber-900">The session controls or exercise need changed. Research coverage again before proposing content.</p>}
      <ExerciseResearchEvidence research={research.result} disabled={busy} onOpenCard={openCard} />
      <button type="button" className={actionClass} disabled={busy || !aiEnabled || !currentResearch} onClick={propose}>Assess gap & propose content</button>
      <p className="text-xs text-gray-600">The Director reassesses current sources and may recommend existing content or request clarification. The Creator runs only for a confirmed gap.</p>
    </div>}
    {assessment && !assessment.draftAuditId && <div role="status" className="space-y-2 rounded-lg bg-white p-3 text-sm">
      <h5 className="font-semibold">{assessment.state === 'REUSE_EXISTING' ? 'Reuse existing canonical content' : 'Coach review needed'}</h5>
      <p>{assessment.assessment.judgment?.summary}</p>
      <ul className="list-disc pl-5">{assessment.assessment.issues.map((issue, index) => <li key={index}>{issue.detail}</li>)}{assessment.assessment.judgment?.questions.map((question, index) => <li key={`question:${index}`}>{question}</li>)}</ul>
      {assessment.assessment.reusableDefinitionIds.map((id) => <button key={id} type="button" className={actionClass} disabled={busy} onClick={() => openCard(id)}>Open {assessment.assessment.research.relatedDefinitions.find((card) => card.id === id)?.displayName ?? 'existing card'}</button>)}
    </div>}
    {operation && <p role="status" className="text-sm">{operation}… <button type="button" className="ml-2 underline" onClick={() => {
      active.current?.abort(); setError('Request canceled. Refresh proposal history or status before retrying.')
    }}>Cancel library request</button></p>}
    <details><summary className="cursor-pointer font-semibold">Exercise proposal history · {page.items.length}</summary><div className="mt-3 space-y-2">
      <button type="button" disabled={busy} className={actionClass} onClick={() => void run('Loading proposal history', (signal) => loadPage(signal))}>Refresh proposal history</button>
      {page.items.map((item) => <button key={item.draftAuditId} type="button" disabled={busy} className="block w-full rounded-lg border border-gray-200 bg-white p-3 text-left text-sm disabled:opacity-50"
        onClick={() => void run('Opening exercise proposal', (signal) => openReview(item.draftAuditId, signal))}>
        <span className="block font-semibold">{item.name}</span><span>{COMPONENT_LABELS[item.componentKey]} · {new Date(item.createdAt).toLocaleString()} · {item.kind ? 'Proposal recorded' : 'Attempt needs review'}</span></button>)}
      {!page.items.length && <p className="text-sm text-gray-600">Recorded proposals and failed attempts appear here for later review.</p>}
      {page.nextCursor && <button type="button" disabled={busy} className={actionClass} onClick={() => void run('Loading more proposals', (signal) => loadPage(signal, true))}>Load older proposals</button>}
    </div></details>
    {review && <ProgrammingExerciseReview key={review.record.draftAuditId} review={review} disabled={busy} onOpenCard={openCard} onAccept={accept}
      onRefresh={() => void run('Refreshing proposal status', (signal) => openReview(review.record.draftAuditId, signal))} />}
    {review?.record.proposal?.kind === 'delivery_profile' && <ProgrammingProfileRevision key={`revision:${review.record.draftAuditId}`} review={review} taxonomy={taxonomy}
      disabled={disabled || operation !== null} run={run} onDirty={setStagedDirty} />}
    {editor && <CanonicalCardEditor source={editor} onClose={() => { setEditor(null); if (review) void run('Refreshing proposal status', (signal) => openReview(review.record.draftAuditId, signal)) }} onSaved={setEditor} />}
  </section>
}
