import type { TaxonomyV2Catalog } from '../../coach/taxonomy'
import { CANONICAL_EQUIPMENT_OPTIONS } from '../../coach/canonicalEquipmentOptions'
import { COMPONENT_LABELS, activeProgrammingComponents, type CoachWorkoutRequest, type ProgrammingInterpretationResult, type SavedProgrammingWorkout } from '../../coach/workoutProgramming'
import { actionClass } from './ProgrammingControls'

const words = (value: string) => value.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
const FIELD_NAMES: Record<string, string> = { budgetSeconds: 'Budget seconds', selection: 'Selection', programmingMethodId: 'Method',
  workSeconds: 'Work seconds', restSeconds: 'Rest seconds', regenerateComponentKeys: 'Regenerate', lockedBlocks: 'Block locks' }

export function ProgrammingInterpretationPreview({ result, baseline, source, taxonomy, stale, onApply, onDismiss }: {
  result: ProgrammingInterpretationResult; baseline: CoachWorkoutRequest; source: SavedProgrammingWorkout; taxonomy: TaxonomyV2Catalog | null;
  stale: boolean; onApply: () => void; onDismiss: () => void
}) {
  const exercises = [...(result.reviewReferences?.exercises ?? []), ...source.workout.workflow.draft.activities.map((activity) => ({
    ref: { deliveryProfileId: activity.profile.id, exerciseCardId: activity.card.id, cardVersion: activity.card.cardVersion },
    name: activity.card.displayName ?? activity.card.canonicalName, purpose: activity.profile.purpose,
  }))]
  const methods = new Map([...source.workout.workflow.draft.activities.map((activity) => [String(activity.method.id), activity.method.name] as const),
    ...(result.reviewReferences?.methods.map((entry) => [entry.id, entry.name] as const) ?? [])])
  const equipment = new Map<string, string>(CANONICAL_EQUIPMENT_OPTIONS)
  const format = (value: unknown, path: string, depth = 0): string => {
    if (value == null) return 'Not set'
    if (depth > 5) return 'Additional controls'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') return String(value)
    if (typeof value === 'string') {
      if (path.includes('ProgrammingMethod') || path.includes('programmingMethod')) return methods.get(value) ?? 'Recorded programming method'
      if (path.includes('ExerciseCard') || path.includes('exerciseCard')) return exercises.find((entry) => entry.ref.exerciseCardId === value)?.name ?? 'Recorded exercise'
      return COMPONENT_LABELS[value as keyof typeof COMPONENT_LABELS] ?? equipment.get(value) ?? words(value)
    }
    if (Array.isArray(value)) return value.length ? value.map((entry) => format(entry, path, depth + 1)).join('; ') : 'None'
    if (typeof value === 'object') {
      const object = value as Record<string, unknown>
      if (typeof object.deliveryProfileId === 'string') {
        const exercise = exercises.find((entry) => entry.ref.deliveryProfileId === object.deliveryProfileId && entry.ref.cardVersion === object.cardVersion)
        return exercise ? `${exercise.name}${exercise.purpose ? ` · ${exercise.purpose}` : ''}` : 'Canonical exercise requiring current library details'
      }
      if (typeof object.facet === 'string' && typeof object.value === 'string') {
        const term = taxonomy?.facets[object.facet]?.find((entry) => entry.key === object.value)
        return `${term?.name ?? words(object.value)} · ${words(String(object.strength))}${object.weight == null ? '' : ` · weight ${object.weight}`}`
      }
      const entries = Object.entries(object).filter(([key, entry]) => !['key', 'blockId'].includes(key) && entry !== undefined)
      return entries.map(([key, entry]) => `${FIELD_NAMES[key] ?? words(key)}: ${format(entry, `${path}.${key}`, depth + 1)}`).join('; ') || 'Default controls'
    }
    return 'Unrecognized value'
  }
  const ready = result.status === 'READY_FOR_REVIEW' && !!result.proposedRequest
  return <section aria-label="Instruction preview" className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
    <h4 className="font-semibold text-gray-900">{ready ? 'Review proposed control changes' : 'Clarify the requested changes'}</h4>
    <p className="text-sm text-gray-700">{result.summary}</p>
    {stale && <p role="status" className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">The controls or instruction changed after this preview. Preview the instruction again before applying it.</p>}
    {result.questions.length > 0 && <div className="text-sm text-gray-700"><ol className="list-decimal space-y-1 pl-5">{result.questions.map((question, index) => <li key={index}>{question}</li>)}</ol>
      <p className="mt-2">Add your answers to Coaching intent, then preview the instruction again.</p></div>}
    {result.issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">{result.issues.map((issue, index) => <li key={`${issue.code}:${index}`}>{issue.detail}</li>)}</ul>}
    {ready && <>
      {result.changes.length ? <dl className="space-y-3">{result.changes.map((change) => {
        const key = change.path.startsWith('components.') ? change.path.slice('components.'.length) : null
        const previous = change.before === null && key && !activeProgrammingComponents(baseline).includes(key as keyof typeof COMPONENT_LABELS)
          ? baseline.components?.find((component) => component.key === key) ?? change.before : change.before
        return <div key={change.path} className="rounded-lg border border-gray-200 bg-white p-3">
          <dt className="text-sm font-semibold text-gray-900">{change.label}</dt>
          <dd className="mt-2 grid min-w-0 gap-2 text-sm sm:grid-cols-2">
            <div className="min-w-0 break-words"><span className="block text-xs font-medium uppercase tracking-wide text-gray-500">Current</span><p className="mt-1 whitespace-pre-wrap text-gray-600">{format(previous, change.path)}</p></div>
            <div className="min-w-0 break-words"><span className="block text-xs font-medium uppercase tracking-wide text-gray-500">Proposed</span><p className="mt-1 whitespace-pre-wrap text-gray-900">{format(change.after, change.path)}</p></div>
          </dd>
        </div>
      })}</dl> : <p className="text-sm text-gray-600">No structured control changes were proposed. Your coaching instruction still guides the full-session review.</p>}
      {!!result.operations?.length && <details className="text-sm text-gray-600"><summary className="cursor-pointer font-medium">Instruction used for these changes</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">{[...new Set(result.operations.map((operation) => operation.instructionQuote))].map((quote) => <li key={quote}>{quote}</li>)}</ul></details>}
      <p className="text-sm text-gray-600">Applying this preview updates the form. Review & save revision runs the complete session checks and saves a separate session.</p>
    </>}
    <div className="flex flex-wrap gap-2">{ready && <button type="button" className="rounded-lg bg-vortex-red px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={stale} onClick={onApply}>Apply proposed controls</button>}
      <button type="button" className={actionClass} onClick={onDismiss}>Use current controls instead</button></div>
  </section>
}
