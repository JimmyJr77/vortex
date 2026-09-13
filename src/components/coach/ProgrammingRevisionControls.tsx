import { activeProgrammingComponents, COMPONENT_LABELS, durationLabel, type CoachWorkoutRequest, type ProgrammingBlockEdit,
  type ProgrammingComponentControls, type SavedProgrammingWorkout, type WorkoutProgrammingChoices } from '../../coach/workoutProgramming'
import { actionClass, controlClass, Field, NumberField } from './ProgrammingControls'

type Activity = SavedProgrammingWorkout['workout']['workflow']['draft']['activities'][number]
type LockField = NonNullable<ProgrammingComponentControls['lockedBlocks']>[number]['fields'][number]
type Choices = WorkoutProgrammingChoices['components'][number]
const LOCKS = { exercises: 'exercise', method: 'method', dose: 'dose', timing: 'start, work and recovery times' } satisfies Record<LockField, string>

function RevisionBlock({ activity, edit, fields, choices, onEdit, onLock }: {
  activity: Activity; edit: ProgrammingBlockEdit | undefined; fields: readonly LockField[]; choices: Choices | undefined;
  onEdit: (edit: ProgrammingBlockEdit | null) => void; onLock: (fields: LockField[]) => void
}) {
  const original = { exerciseCardId: activity.card.id, variantId: activity.card.variantId,
    deliveryProfileId: activity.profile.id, cardVersion: activity.card.cardVersion }
  const patch = (change: Partial<ProgrammingBlockEdit>) => {
    const next = { ...edit, blockId: activity.activityId, ...change }
    onEdit(next.exercise || next.programmingMethodId || next.dose ? next : null)
  }
  const exercise = edit?.exercise
  const selected = choices?.exercises.find((entry) => entry.ref.deliveryProfileId === (exercise?.deliveryProfileId ?? activity.profile.id))
  const methods = choices?.methods.filter((method) => !selected || selected.methodIds.includes(method.id)) ?? []
  const exerciseOptions = choices?.exercises ?? []
  const changes = [edit?.exercise && 'exercise', edit?.programmingMethodId && 'method', edit?.dose && 'dose'].filter(Boolean)
  return <details className="rounded-lg border border-gray-200 bg-white p-3">
    <summary className="cursor-pointer text-sm font-semibold text-gray-900">{activity.card.displayName ?? activity.card.canonicalName}
      {(changes.length > 0 || fields.length > 0) && <span className="ml-2 font-normal text-vortex-red">{changes.length} edits · {fields.length} locks</span>}</summary>
    <fieldset aria-label={`Revise ${activity.card.displayName ?? activity.card.canonicalName}`} className="mt-3 min-w-0 space-y-3">
      <p className="text-sm text-gray-600">Source: {activity.dose.sets} sets{activity.dose.reps != null ? ` × ${activity.dose.reps} reps` : ''} · {activity.dose.workSeconds}s work / {activity.dose.restSeconds}s rest · {activity.method.name}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Exercise replacement"><select className={controlClass} disabled={fields.includes('exercises')} value={exercise?.deliveryProfileId ?? ''}
          onChange={(event) => patch({ exercise: event.target.value === original.deliveryProfileId ? original : exerciseOptions.find((entry) => entry.ref.deliveryProfileId === event.target.value)?.ref })}>
          <option value="">Let the coach AI choose</option>
          {!exerciseOptions.some((entry) => entry.ref.deliveryProfileId === original.deliveryProfileId) && <option value={original.deliveryProfileId}>Keep source exercise · recheck eligibility</option>}
          {exercise && exercise.deliveryProfileId !== original.deliveryProfileId && !exerciseOptions.some((entry) => entry.ref.deliveryProfileId === exercise.deliveryProfileId)
            && <option value={exercise.deliveryProfileId}>Selected replacement · refresh choices</option>}
          {exerciseOptions.map((entry) => <option key={entry.ref.deliveryProfileId} value={entry.ref.deliveryProfileId} disabled={entry.eligibility === 'INELIGIBLE'}>
            {entry.name}{entry.eligibility === 'ELIGIBLE' ? '' : ' · needs evidence / review'}</option>)}
        </select></Field>
        <Field label="Programming method"><select className={controlClass} disabled={fields.includes('method')} value={edit?.programmingMethodId ?? ''}
          onChange={(event) => patch({ programmingMethodId: event.target.value || undefined })}>
          <option value="">Let the coach AI choose</option>
          {!methods.some((entry) => entry.id === String(activity.method.id)) && <option value={String(activity.method.id)}>{activity.method.name} · recheck compatibility</option>}
          {edit?.programmingMethodId && edit.programmingMethodId !== String(activity.method.id) && !methods.some((entry) => entry.id === edit.programmingMethodId)
            && <option value={edit.programmingMethodId}>Selected method · refresh choices</option>}
          {methods.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!edit?.dose} disabled={fields.includes('dose')}
        onChange={(event) => patch({ dose: event.target.checked ? { sets: activity.dose.sets, reps: activity.dose.reps,
          workSeconds: activity.dose.workSeconds, restSeconds: activity.dose.restSeconds } : undefined })} />Edit dose</label>
      {edit?.dose && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <NumberField label="Sets" min={1} max={100} value={edit.dose.sets} onChange={(sets) => patch({ dose: { ...edit.dose, sets: sets ?? 0 } })} />
        <NumberField label="Repetitions" optional min={1} max={1000} value={edit.dose.reps} onChange={(reps) => patch({ dose: { ...edit.dose, reps } })} />
        <NumberField label="Work seconds" min={1} max={3600} value={edit.dose.workSeconds} onChange={(workSeconds) => patch({ dose: { ...edit.dose, workSeconds: workSeconds ?? 0 } })} />
        <NumberField label="Rest seconds" max={3600} value={edit.dose.restSeconds} onChange={(restSeconds) => patch({ dose: { ...edit.dose, restSeconds: restSeconds ?? 0 } })} />
      </div>}
      <fieldset className="min-w-0"><legend className="text-sm font-medium text-gray-700">Keep source values</legend>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{(Object.keys(LOCKS) as LockField[]).map((field) => <label key={field} className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={fields.includes(field)} disabled={field === 'exercises' ? !!edit?.exercise : field === 'method' ? !!edit?.programmingMethodId : field === 'dose' ? !!edit?.dose : false}
            onChange={(event) => onLock(event.target.checked ? [...fields, field] : fields.filter((entry) => entry !== field))} />Lock {LOCKS[field]}</label>)}</div>
        <p className="mt-2 text-xs text-gray-500">Clear an edit before locking that source value. Locks remain binding when other session controls change.</p>
      </fieldset>
      {edit && <button type="button" className={actionClass} onClick={() => onEdit(null)}>Clear block edits</button>}
    </fieldset>
  </details>
}

export function ProgrammingRevisionControls({ source, request, choices, onChange, onFindChoices, onCancel }: {
  source: SavedProgrammingWorkout; request: CoachWorkoutRequest; choices: WorkoutProgrammingChoices | null;
  onChange: (request: CoachWorkoutRequest) => void; onFindChoices: () => void; onCancel: () => void
}) {
  const modification = request.modification!
  const active = activeProgrammingComponents(request)
  const selected = modification.regenerateComponentKeys ?? active
  const edits = modification.blockEdits ?? []
  const updateEdit = (blockId: string, edit: ProgrammingBlockEdit | null) => onChange({ ...request, modification: { ...modification,
    blockEdits: [...edits.filter((entry) => entry.blockId !== blockId), ...(edit ? [edit] : [])] } })
  const updateLock = (activity: Activity, fields: LockField[]) => onChange({ ...request, components: request.components?.map((component) => component.key !== activity.componentKey ? component : {
    ...component, lockedBlocks: [...(component.lockedBlocks ?? []).filter((entry) => entry.blockId !== activity.activityId), ...(fields.length ? [{ blockId: activity.activityId, fields }] : [])],
  }) })
  return <section aria-label="Revision controls" className="space-y-4 rounded-xl border border-red-200 bg-red-50/40 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-gray-900">Revise a saved session</h4>
      <p className="mt-1 text-sm text-gray-600">Source saved {new Date(source.createdAt).toLocaleString()} · {source.workout.intent.logistics.totalBookedMinutes} minutes. Your revision will be saved separately.</p></div>
      <button type="button" className={actionClass} onClick={onCancel}>Cancel revision</button></div>
    <fieldset><legend className="text-sm font-semibold text-gray-800">Components to regenerate</legend>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{active.map((key) => <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={selected.includes(key)} onChange={(event) => onChange({ ...request, modification: { ...modification,
          regenerateComponentKeys: event.target.checked ? [...selected, key] : selected.filter((entry) => entry !== key),
        } })} />{COMPONENT_LABELS[key]}</label>)}</div>
    </fieldset>
    <p className="text-sm text-gray-600">A changed component also opens later components for adjustment. Earlier components stay fixed. Changes to athletes, equipment or time may affect every component. Prepare & Access is always reviewed against the revised workout.</p>
    <button type="button" className={actionClass} onClick={onFindChoices}>Load revision exercise and method choices</button>
    <p className="text-xs text-gray-600">Edits and locks are checked against current library rules. If a dose or timetable cannot fit, the session will need coach review.</p>
    {source.workout.workflow.draft.schedule.components.map((component) => {
      const controls = request.components?.find((entry) => entry.key === component.key)
      const activities = source.workout.workflow.draft.activities.filter((activity) => activity.componentKey === component.key)
      const enabled = active.includes(component.key)
      const hasChanges = activities.some((activity) => edits.some((entry) => entry.blockId === activity.activityId)) || !!controls?.lockedBlocks?.length
      return <details key={component.key} className="rounded-lg border border-gray-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">{COMPONENT_LABELS[component.key]} · {durationLabel(component.budgetSeconds)} source window{enabled ? '' : ' · omitted'}</summary>
        <div className="mt-3 space-y-3">{!enabled && <p className="text-sm text-amber-800">This component is omitted from the revised session. Clear its block edits and locks before saving.{hasChanges && <button type="button" className="ml-2 underline" onClick={() => onChange({ ...request,
          components: request.components?.map((entry) => entry.key === component.key ? { ...entry, lockedBlocks: [] } : entry),
          modification: { ...modification, blockEdits: edits.filter((edit) => !activities.some((activity) => activity.activityId === edit.blockId)) },
        })}>Clear omitted component changes</button>}</p>}
          {!activities.length && <p className="text-sm text-amber-800">This source component is incomplete. Include it in regeneration.</p>}
          <fieldset disabled={!enabled} className="min-w-0 space-y-3">{activities.map((activity) => <RevisionBlock key={activity.activityId} activity={activity}
            edit={edits.find((entry) => entry.blockId === activity.activityId)} fields={controls?.lockedBlocks?.find((entry) => entry.blockId === activity.activityId)?.fields ?? []}
            choices={choices?.components.find((entry) => entry.key === component.key)} onEdit={(edit) => updateEdit(activity.activityId, edit)} onLock={(fields) => updateLock(activity, fields)} />)}</fieldset>
        </div>
      </details>
    })}
  </section>
}
