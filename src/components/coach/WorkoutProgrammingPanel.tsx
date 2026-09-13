import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type { TaxonomyV2Catalog } from '../../coach/taxonomy'
import { CANONICAL_EQUIPMENT_OPTIONS } from '../../coach/canonicalEquipmentOptions'
import { activeProgrammingComponents, COMPONENT_KEYS, COMPONENT_LABELS, newProgrammingRequest, programmingControlsFingerprint, programmingError, programmingRequestForSubmit, requestFromSaved, requestFromInterpretation, revisionRequestFromSaved,
  type CoachWorkoutRequest, type ProgrammingComponentControls, type ProgrammingWorkoutListItem, type ProgrammingWorkoutCursor,
  type ProgrammingInterpretationResult, type ProgrammingRevalidation, type SavedProgrammingWorkout, type WorkoutProgrammingChoices } from '../../coach/workoutProgramming'
import { actionClass, controlClass, BooleanField, EquipmentControls, Field, LibraryChoiceControls, MultiChoice, NumberField, PriorityControls } from './ProgrammingControls'
import { ProgrammingAthletes, type ProgrammingRosterMember } from './ProgrammingAthletes'
import { ProgrammingSessionView } from './ProgrammingSessionView'
import { ProgrammingRevisionControls } from './ProgrammingRevisionControls'
import { ProgrammingInterpretationPreview } from './ProgrammingInterpretationPreview'
import { ProgrammingExerciseLibrary } from './ProgrammingExerciseLibrary'

interface RolloutStatus { coachGeneration: { enabled: boolean }; aiIntent: { enabled: boolean } }
interface SavedPage { items: ProgrammingWorkoutListItem[]; nextCursor: ProgrammingWorkoutCursor | null }
const localDateTime = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function WorkoutProgrammingPanel() {
  const [request, setRequest] = useState<CoachWorkoutRequest>(newProgrammingRequest)
  const [taxonomy, setTaxonomy] = useState<TaxonomyV2Catalog | null>(null)
  const [members, setMembers] = useState<ProgrammingRosterMember[]>([])
  const [rollout, setRollout] = useState<RolloutStatus | null>(null)
  const [savedPage, setSavedPage] = useState<SavedPage>({ items: [], nextCursor: null })
  const [saved, setSaved] = useState<SavedProgrammingWorkout | null>(null)
  const [revisionSource, setRevisionSource] = useState<SavedProgrammingWorkout | null>(null)
  const [interpretation, setInterpretation] = useState<{ result: ProgrammingInterpretationResult; baseline: CoachWorkoutRequest; fingerprint: string } | null>(null)
  const [appliedPreview, setAppliedPreview] = useState<string | null>(null)
  const [revalidation, setRevalidation] = useState<ProgrammingRevalidation | null>(null)
  const [choices, setChoices] = useState<WorkoutProgrammingChoices | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false)
  const [libraryBusy, setLibraryBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [reload, setReload] = useState(0)
  const active = useRef<AbortController | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setInitializing(true)
    const initialize = async () => {
      const outcomes = await Promise.allSettled([
        coachFetch<TaxonomyV2Catalog>('/api/coach/taxonomy-v2', { signal: controller.signal }),
        coachFetch<ProgrammingRosterMember[]>('/api/coach/members?scope=all', { signal: controller.signal }),
        coachFetch<RolloutStatus>('/api/coach/canonical/rollout-status', { signal: controller.signal }),
      ])
      if (controller.signal.aborted) return
      if (outcomes[0].status === 'fulfilled') setTaxonomy(outcomes[0].value)
      if (outcomes[1].status === 'fulfilled') setMembers(outcomes[1].value)
      if (outcomes[2].status === 'fulfilled') {
        setRollout(outcomes[2].value)
        if (outcomes[2].value.coachGeneration.enabled) {
          try { const page = await coachFetch<SavedPage>('/api/coach/workout-programming', { signal: controller.signal }); if (!controller.signal.aborted) setSavedPage(page) }
          catch (error) { if (!controller.signal.aborted) setError(programmingError(error)) }
        }
      }
      if (outcomes.some((entry) => entry.status === 'rejected')) setError('Some roster or library controls could not load. Retry loading them before generating.')
      if (!controller.signal.aborted) setInitializing(false)
    }
    void initialize()
    return () => controller.abort()
  }, [reload])
  useEffect(() => () => active.current?.abort(), [])

  const run = async (name: string, action: (signal: AbortSignal) => Promise<void>) => {
    if (active.current) return
    const controller = new AbortController(); active.current = controller
    setOperation(name); setError(null)
    try { await action(controller.signal) }
    catch (error) { if (!controller.signal.aborted) setError(programmingError(error)) }
    finally { if (active.current === controller) { active.current = null; setOperation(null) } }
  }
  const update = (patch: Partial<CoachWorkoutRequest>) => setRequest((current) => ({ ...current, ...patch }))
  const updateLogistics = (patch: Partial<CoachWorkoutRequest['logistics']>) => setRequest((current) => {
    const logistics = { ...current.logistics, ...patch }
    if (patch.athleticMinutes !== undefined || patch.tumblingMinutes !== undefined) logistics.totalBookedMinutes = logistics.athleticMinutes + (logistics.tumblingMinutes ?? 0)
    return { ...current, logistics }
  })
  const updateComponent = (key: ProgrammingComponentControls['key'], patch: Partial<ProgrammingComponentControls>) => setRequest((current) => ({ ...current,
    components: current.components?.map((component) => component.key === key ? { ...component, ...patch } : component),
  }))
  const findChoices = () => {
    if (!formRef.current?.reportValidity()) return
    if (invalidRevisionScope) { setError('Select at least one scheduled component to regenerate.'); return }
    void run('Finding library choices', async (signal) => {
      const result = await coachFetch<WorkoutProgrammingChoices>('/api/coach/workout-programming/resources', { method: 'POST', signal, body: JSON.stringify(programmingRequestForSubmit(request)) })
      if (!signal.aborted) setChoices(result)
    })
  }
  const generate = (event: FormEvent) => {
    event.preventDefault()
    if (request.mode === 'modify_existing' && interpretation) { setError('Apply the proposed changes or choose the current controls before saving.'); return }
    if (invalidRevisionScope) { setError('Select at least one scheduled component to regenerate.'); return }
    const submitted = { ...programmingRequestForSubmit(request), requestId: crypto.randomUUID(), revision: crypto.randomUUID() }
    void run('Building and reviewing your session', async (signal) => {
      const result = await coachFetch<SavedProgrammingWorkout>('/api/coach/workout-programming', { method: 'POST', signal, body: JSON.stringify(submitted) })
      if (signal.aborted) return
      setSaved(result); setRevalidation(null)
      if (submitted.mode === 'modify_existing') { setRevisionSource(null); setRequest(requestFromSaved(result)); setChoices(null); setInterpretation(null); setAppliedPreview(null) }
      const item: ProgrammingWorkoutListItem = { persistedWorkoutId: result.persistedWorkoutId, createdAt: result.createdAt, createdBy: result.createdBy,
        status: result.workout.status, revision: result.workout.revision, objective: result.workout.intent.objective, logistics: result.workout.intent.logistics,
        summary: result.workout.explanation.session, requiresRevalidation: true }
      setSavedPage((page) => ({ ...page, items: [item, ...page.items.filter((entry) => entry.persistedWorkoutId !== item.persistedWorkoutId)] }))
    })
  }
  const interpretInstruction = () => {
    if (!formRef.current?.reportValidity() || !revisionSource || invalidRevisionScope) return
    const baseline = structuredClone(request)
    setInterpretation(null); setAppliedPreview(null)
    void run('Interpreting your revision instruction', async (signal) => {
      const result = await coachFetch<ProgrammingInterpretationResult>('/api/coach/workout-programming/interpret', { method: 'POST', signal,
        body: JSON.stringify({ request: programmingRequestForSubmit(baseline), instruction: baseline.instruction }) })
      if (!signal.aborted) setInterpretation({ result, baseline, fingerprint: programmingControlsFingerprint(baseline) })
    })
  }
  const applyInterpretation = () => {
    if (!interpretation) return
    try {
      const controls = requestFromInterpretation(interpretation.result, request, interpretation.fingerprint)
      setRequest(controls); setChoices(null); setInterpretation(null); setError(null); setAppliedPreview(programmingControlsFingerprint(controls))
    } catch (error) { setError(programmingError(error)) }
  }
  const openSaved = (id: string) => void run('Opening saved session', async (signal) => {
    const result = await coachFetch<SavedProgrammingWorkout>(`/api/coach/workout-programming/${encodeURIComponent(id)}`, { signal })
    if (!signal.aborted) { setSaved(result); setRevalidation(null) }
  })
  const refreshSaved = (more = false) => void run('Loading saved sessions', async (signal) => {
    const cursor = more ? savedPage.nextCursor : null
    const query = cursor ? `?${new URLSearchParams({ beforeCreatedAt: cursor.createdAt, beforeId: cursor.id })}` : ''
    const page = await coachFetch<SavedPage>(`/api/coach/workout-programming${query}`, { signal })
    if (!signal.aborted) setSavedPage((previous) => ({ ...page, items: more ? [...previous.items, ...page.items.filter((item) => !previous.items.some((old) => old.persistedWorkoutId === item.persistedWorkoutId))] : page.items }))
  })
  const checkSaved = () => {
    if (!saved) return
    void run('Checking current evidence', async (signal) => {
      const result = await coachFetch<ProgrammingRevalidation>(`/api/coach/workout-programming/${saved.persistedWorkoutId}/revalidate`, { method: 'POST', signal, body: '{}' })
      if (!signal.aborted) setRevalidation(result)
    })
  }
  const busy = operation !== null || libraryBusy
  const invalidRevisionScope = request.mode === 'modify_existing' && request.modification?.regenerateComponentKeys != null
    && !request.modification.regenerateComponentKeys.some((key) => activeProgrammingComponents(request).includes(key))
  const globalChoices = choices ? {
    exercises: [...new Map(choices.components.flatMap((component) => component.exercises).map((entry) => [entry.ref.deliveryProfileId, entry])).values()],
    methods: [...new Map(choices.components.flatMap((component) => component.methods).map((entry) => [entry.id, entry])).values()],
  } : undefined
  return <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
    <div><h3 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Sparkles className="h-5 w-5 text-vortex-red" /> Vortex session programming</h3>
      <p className="mt-1 text-sm text-gray-600">Plan one coherent session around your athletes, priorities, equipment, and coaching capacity.</p>
      <p className="mt-3 text-xs font-semibold leading-6 text-gray-600">Prepare & Access → Explosiveness → Strength → Capacity / Competition → Body Control / Tumbling</p>
    </div>
    {initializing && <p role="status" className="text-sm text-gray-600">Loading coach controls…</p>}
    {rollout && (!rollout.coachGeneration.enabled || !rollout.aiIntent.enabled) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">AI session programming is not enabled for this facility. Your existing generator remains available.</p>}
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}
      <button type="button" className="ml-3 underline" disabled={busy} onClick={() => { setError(null); setReload((value) => value + 1) }}>Reload controls</button></div>}
    <form ref={formRef} onSubmit={generate} className="space-y-4">
      <fieldset disabled={busy || initializing} className="min-w-0 space-y-5">
        {revisionSource && request.mode === 'modify_existing' && <ProgrammingRevisionControls source={revisionSource} request={request} choices={choices}
          onChange={setRequest} onFindChoices={findChoices} onCancel={() => { setRequest(requestFromSaved(revisionSource)); setRevisionSource(null); setChoices(null); setError(null); setInterpretation(null); setAppliedPreview(null) }} />}
        {invalidRevisionScope && <p className="text-sm text-amber-800">Select at least one scheduled component to regenerate.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Programming control"><select className={controlClass} value={request.mode} disabled={request.mode === 'modify_existing'} onChange={(event) => update({ mode: event.target.value as CoachWorkoutRequest['mode'] })}>
            <option value="generate_for_me">Generate for me</option><option value="guided">Guided by my priorities</option><option value="coach_directed">Coach-directed choices</option>
            {request.mode === 'modify_existing' && <option value="modify_existing">Modify existing session</option>}
          </select></Field>
          <Field label="Overall objective"><select className={controlClass} value={request.objective} onChange={(event) => update({ objective: event.target.value })}>
            <option value="general_athletic_development">General athletic development</option><option value="speed_priority">Speed</option><option value="explosiveness_power_priority">Explosiveness / power</option>
            <option value="strength_priority">Strength</option><option value="agility_priority">Agility</option><option value="mobility_control_priority">Mobility / control</option><option value="fitness_priority">Conditioning</option><option value="recovery_low_intensity">Recovery / low intensity</option>
          </select></Field>
        </div>
        <Field label="Coaching intent"><textarea className={controlClass} rows={3} maxLength={4000} required={request.mode === 'modify_existing'} value={request.instruction} onChange={(event) => update({ instruction: event.target.value })}
          placeholder="What should these athletes develop today? Include coaching preferences and relevant context." /></Field>
        {request.mode === 'modify_existing' && <div className="space-y-3">
          <p className="text-sm text-gray-600">Describe changes to athletes, time, equipment or coaching emphasis, then preview the proposed controls. You can also edit the controls directly.</p>
          <button type="button" className={actionClass} disabled={!rollout?.aiIntent.enabled || !rollout.coachGeneration.enabled || invalidRevisionScope || (request.instruction?.trim().length ?? 0) < 3}
            onClick={interpretInstruction}>Preview instruction changes</button>
          {interpretation && revisionSource && <ProgrammingInterpretationPreview result={interpretation.result} baseline={interpretation.baseline} source={revisionSource} taxonomy={taxonomy}
            stale={programmingControlsFingerprint(request) !== interpretation.fingerprint} onApply={applyInterpretation} onDismiss={() => { setInterpretation(null); setError(null) }} />}
          {appliedPreview === programmingControlsFingerprint(request) && <p role="status" className="text-sm text-emerald-800">Proposed controls applied. Review the updated form, then save your revision.</p>}
        </div>}
        {request.mode === 'coach_directed' && <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">Choose preferred or locked exercises and methods for every scheduled component. AI stays within those choices; all sessions still undergo complete validation.</p>}
        {request.athletes.map((cohort, index) => <ProgrammingAthletes key={cohort.key} cohort={cohort} index={index} members={members}
          sessionDate={request.logistics.sessionDate} unavailableMemberIds={request.athletes.filter((entry) => entry.key !== cohort.key).flatMap((entry) => entry.memberIds ?? [])}
          onChange={(updated) => setRequest((current) => ({ ...current, athletes: current.athletes.map((entry) => entry.key === cohort.key ? updated : entry) }))}
          onRemove={request.athletes.length > 1 ? () => update({ athletes: request.athletes.filter((entry) => entry.key !== cohort.key) }) : undefined} />)}
        <button type="button" className={actionClass} disabled={request.athletes.length >= 20} onClick={() => update({ athletes: [...request.athletes,
          { key: crypto.randomUUID(), athleteCount: 1, ageMin: 8, ageMax: 10, trainingExperience: 'beginner', memberIds: [], evidenceReferences: [] }] })}>Add athlete group</button>
        <fieldset className="space-y-3"><legend className="font-semibold text-gray-900">Time and coaching logistics</legend>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <NumberField label="Athletic minutes" min={15} max={240} value={request.logistics.athleticMinutes} onChange={(value) => updateLogistics({ athleticMinutes: value ?? 0 })} />
            <NumberField label="Tumbling minutes" max={120} value={request.logistics.tumblingMinutes} onChange={(value) => updateLogistics({ tumblingMinutes: value ?? 0 })} />
            <NumberField label="Total booked minutes" min={15} max={240} value={request.logistics.totalBookedMinutes} onChange={(value) => updateLogistics({ totalBookedMinutes: value ?? 0 })} />
            <Field label="Session start (local time)"><input type="datetime-local" className={controlClass} value={localDateTime(request.logistics.sessionStartsAt)} onChange={(event) => {
              const date = event.target.value ? new Date(event.target.value) : null
              if (date && Number.isNaN(date.getTime())) return
              updateLogistics({ sessionStartsAt: date?.toISOString() ?? null, sessionDate: date?.toISOString().slice(0, 10) ?? null })
            }} /></Field>
            <NumberField label="Coaches" min={1} max={20} value={request.logistics.coachCount} onChange={(value) => updateLogistics({ coachCount: value ?? 0 })} />
            <NumberField label="Lanes" max={100} value={request.logistics.laneCount} onChange={(value) => updateLogistics({ laneCount: value ?? 0 })} />
            <NumberField label="Stations" min={1} max={100} value={request.logistics.stationCount} onChange={(value) => updateLogistics({ stationCount: value ?? 0 })} />
            <Field label="Environment"><select className={controlClass} value={request.logistics.space?.environment ?? 'indoor'} onChange={(event) => updateLogistics({ space: { ...request.logistics.space, environment: event.target.value as 'indoor' | 'outdoor' } })}><option value="indoor">Indoor</option><option value="outdoor">Outdoor</option></select></Field>
            <NumberField label="Floor area (sq ft)" optional min={1} value={request.logistics.space?.floorAreaSquareFeet} onChange={(floorAreaSquareFeet) => updateLogistics({ space: { ...request.logistics.space, floorAreaSquareFeet } })} />
            <NumberField label="Lane length (ft)" optional min={1} value={request.logistics.space?.laneLengthFeet} onChange={(laneLengthFeet) => updateLogistics({ space: { ...request.logistics.space, laneLengthFeet } })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <BooleanField label="Timer available" value={request.logistics.timerAvailable} onChange={(timerAvailable) => updateLogistics({ timerAvailable })} />
            <BooleanField label="Score tracking available" value={request.logistics.scoreTrackingAvailable} onChange={(scoreTrackingAvailable) => updateLogistics({ scoreTrackingAvailable })} />
            <BooleanField label="Clear runout confirmed" value={request.logistics.clearRunoutConfirmed} onChange={(clearRunoutConfirmed) => updateLogistics({ clearRunoutConfirmed })} />
          </div>
        </fieldset>
        <EquipmentControls value={request.equipment} onChange={(equipment) => update({ equipment })} />
        <PriorityControls label="Overall" values={request.priorities} taxonomy={taxonomy} onChange={(priorities) => update({ priorities })} />
        <details className="rounded-xl border border-gray-200 p-3"><summary className="cursor-pointer font-medium text-gray-800">Exercise and method preferences across the session</summary>
          <div className="mt-3"><LibraryChoiceControls choices={globalChoices} value={request} allowLocks={false} onChange={(patch) => update(patch)} /></div>
        </details>
        <div className="space-y-3"><h4 className="font-semibold text-gray-900">Component priorities and choices</h4>
          {COMPONENT_KEYS.map((key) => {
            const component = request.components?.find((entry) => entry.key === key) ?? { key }
            const omitted = key === 'body_control' && !request.logistics.tumblingMinutes
            return <details key={key} className="rounded-xl border border-gray-200 p-3"><summary className="cursor-pointer font-medium text-gray-800">{COMPONENT_LABELS[key]}{omitted ? ' · add tumbling minutes to schedule' : ''}</summary>
              <div className="mt-3 space-y-4">
                <div className="grid gap-3 md:grid-cols-2"><NumberField label={`${COMPONENT_LABELS[key]} seconds`} optional max={14400} value={component.budgetSeconds} onChange={(budgetSeconds) => updateComponent(key, { budgetSeconds })} />
                  <Field label="Exercise selection"><select className={controlClass} value={component.selection ?? 'auto'} onChange={(event) => updateComponent(key, { selection: event.target.value as 'auto' | 'directed' })}><option value="auto">AI within my priorities and locks</option><option value="directed">Only my chosen exercises and methods</option></select></Field></div>
                <PriorityControls label={COMPONENT_LABELS[key]} values={component.priorities} taxonomy={taxonomy} onChange={(priorities) => updateComponent(key, { priorities })} />
                <div className="grid gap-3 sm:grid-cols-3">{(['allowed', 'preferred', 'excluded'] as const).map((field) => <MultiChoice key={field} label={`${field === 'allowed' ? 'Limit to' : field === 'preferred' ? 'Prefer' : 'Avoid'} equipment`}
                  options={CANONICAL_EQUIPMENT_OPTIONS.filter(([value]) => request.equipment.available.includes(value)).map(([id, name]) => ({ id, name }))}
                  selected={component.equipment?.[field] ?? []} onChange={(values) => updateComponent(key, { equipment: { ...component.equipment, [field]: field === 'allowed' && !values.length ? undefined : values } })} />)}</div>
                <LibraryChoiceControls value={component} choices={choices?.components.find((entry) => entry.key === key)} onChange={(patch) => updateComponent(key, patch)} />
              </div>
            </details>
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={actionClass} disabled={!rollout?.coachGeneration.enabled} onClick={findChoices}>Find canonical choices</button>
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={!rollout?.coachGeneration.enabled || !rollout.aiIntent.enabled || !taxonomy || invalidRevisionScope || request.mode === 'modify_existing' && !!interpretation}><Sparkles className="h-4 w-4" />{request.mode === 'modify_existing' ? 'Review & save revision' : 'Generate & review session'}</button>
        </div>
        {choices && <p role="status" className="text-sm text-gray-600">{choices.components.reduce((sum, component) => sum + component.exercises.length, 0)} canonical profile choices loaded. {choices.findings.length ? 'Review the roster and evidence findings before generation.' : 'Open each component to set preferences and locks.'}{!choices.release && ' No published release is available.'}{!choices.searchComplete && ' The programming library search is incomplete.'}</p>}
        {!!choices?.findings.length && <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">{choices.findings.map((finding, index) => <li key={`${finding.code}:${index}`}>{finding.detail}</li>)}</ul>}
      </fieldset>
    </form>
    <button type="button" className={actionClass} aria-expanded={showExerciseLibrary} disabled={busy || initializing || !rollout?.coachGeneration.enabled}
      onClick={() => setShowExerciseLibrary((shown) => !shown)}>{showExerciseLibrary ? 'Hide exercise library research' : 'Research exercise needs & proposals'}</button>
    {showExerciseLibrary && <ProgrammingExerciseLibrary request={request} disabled={operation !== null || initializing || !rollout?.coachGeneration.enabled}
      aiEnabled={!!rollout?.aiIntent.enabled} onBusy={setLibraryBusy} />}
    {operation && <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{operation}…
      <button type="button" className="ml-auto underline" onClick={() => { active.current?.abort(); setError(operation === 'Interpreting your revision instruction'
        ? 'Instruction preview canceled. Your current controls were kept.' : 'Cancellation requested. Refresh saved sessions before retrying generation.') }}>Cancel</button></div>}
    <details className="rounded-lg border border-gray-200 p-3"><summary className="cursor-pointer font-semibold text-gray-800">Saved programming sessions · {savedPage.items.length}</summary>
      <div className="mt-3 space-y-2"><button type="button" className={actionClass} disabled={busy || !rollout?.coachGeneration.enabled} onClick={() => refreshSaved()}>Refresh saved sessions</button>
        {savedPage.items.map((item) => <button key={item.persistedWorkoutId} type="button" disabled={busy} onClick={() => openSaved(item.persistedWorkoutId)} className="block w-full rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50 disabled:opacity-50">
          <span className="font-medium">{new Date(item.createdAt).toLocaleString()} · {item.logistics.totalBookedMinutes} min</span><span className="ml-2 text-xs text-gray-500">{item.status === 'QA_PASSED' ? 'Passed when saved' : 'Needs coach review'}</span>
          <span className="mt-1 block text-sm text-gray-600">{item.summary}</span></button>)}
        {!savedPage.items.length && <p className="text-sm text-gray-500">Generated sessions and their review history appear here.</p>}
        {savedPage.nextCursor && <button type="button" className={actionClass} disabled={busy} onClick={() => refreshSaved(true)}>Load older sessions</button>}
      </div>
    </details>
    {saved && <ProgrammingSessionView saved={saved} revalidation={revalidation} checking={busy} members={members} onRevalidate={checkSaved} onOpenSource={openSaved} onModify={() => {
      setRequest(revisionRequestFromSaved(saved)); setRevisionSource(saved); setChoices(null); setError(null); setInterpretation(null); setAppliedPreview(null); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }} onReuse={() => {
      setRequest(requestFromSaved(saved)); setRevisionSource(null); setChoices(null); setError(null); setInterpretation(null); setAppliedPreview(null); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }} />}
  </div>
}
