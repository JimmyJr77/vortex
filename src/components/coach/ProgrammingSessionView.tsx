import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { COMPONENT_LABELS, durationLabel, type SavedProgrammingWorkout, type ProgrammingRevalidation } from '../../coach/workoutProgramming'
import { actionClass } from './ProgrammingControls'
import { ProgrammingActivitySchedule } from './ProgrammingActivitySchedule'
import type { ProgrammingRosterMember } from './ProgrammingAthletes'

const REVIEW_MESSAGES: Readonly<Record<string, string>> = {
  candidate_eligibility_review_required: 'The available choices cannot satisfy this component with the current evidence and locks. Attach reviewed observations or choose eligible alternatives.',
  invalid_builder_proposal: 'The exercise and method selections need a complete programming review.',
  invalid_preparation_proposal: 'Prepare & Access still needs to match the Vortex framework and the demands of this session.',
  stale_preparation_demand: 'Update Prepare & Access to match the current exercises and doses.',
  schedule_requires_composition: 'Some booked time still needs a complete activity, coaching, or recovery plan.',
  stale_schedule: 'The saved timetable must be rebuilt and checked against current exercises and resources.',
  stale_load: 'The session workload must be checked again against current exercise prescriptions.',
  stale_coverage: 'The session priorities and movement coverage need another check.',
  incomplete_staff_draft: 'Complete session programming before the final coaching review.',
}

export function ProgrammingSessionView({ saved, revalidation, checking, onRevalidate, onReuse, onModify, onOpenSource, members }: {
  saved: SavedProgrammingWorkout; revalidation: ProgrammingRevalidation | null; checking: boolean; onRevalidate: () => void; onReuse: () => void;
  onModify: () => void; onOpenSource: (id: string) => void; members: readonly ProgrammingRosterMember[]
}) {
  const workout = saved.workout
  const current = revalidation?.savedContentHash === workout.contentHash ? revalidation : null
  const historical = !current && saved.validationFreshness === 'historical_snapshot'
  const passed = current ? current.validatedWorkout : !historical && workout.validatedWorkout
  const findings = [...(current?.validation.findings ?? workout.validation.findings)].sort((left, right) =>
    Number(right.code === 'candidate_eligibility_review_required') - Number(left.code === 'candidate_eligibility_review_required'))
  const { draft } = workout.workflow
  const parent = workout.workflow.sessionIntent.modification
  const memberNames = new Map(members.map((member) => [String(member.id), member.name]))
  const athleteNames = new Map(draft.request.athletes.flatMap((cohort, group) => Array.from({ length: cohort.athleteCount }, (_, athlete) =>
    [`${cohort.key}:${athlete + 1}`, memberNames.get(cohort.memberIds[athlete]) ?? `Group ${group + 1}, athlete ${athlete + 1}`] as const)))
  return <section aria-label="Generated programming session" className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">{passed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
        {passed ? 'Session checks passed' : historical && workout.validatedWorkout ? 'Saved session · check current evidence' : 'Coach review needed'}</h3>
        <p className="mt-1 text-sm text-gray-500">{draft.request.athletes.reduce((sum, group) => sum + group.athleteCount, 0)} athletes · {draft.request.logistics.totalBookedMinutes} minutes · saved {new Date(saved.createdAt).toLocaleString()}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className={actionClass} disabled={checking} onClick={onRevalidate}>{checking ? 'Checking…' : 'Check current evidence'}</button>
        <button type="button" className={actionClass} disabled={checking} onClick={onModify}>Modify this session</button>
        <button type="button" className={actionClass} disabled={checking} onClick={onReuse}>Use controls for a new session</button></div>
    </div>
    {historical && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Library records and athlete observations may have changed since this session was saved. Check current evidence before using it.</p>}
    {parent && <div aria-label="Revision history" className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
      <p>This revision is saved separately from its source session. <button type="button" className="font-medium text-vortex-red underline" disabled={checking} onClick={() => onOpenSource(parent.sourceWorkoutId)}>Open source session</button></p>
      <p>Opened for adjustment: {['Prepare & Access', ...parent.mutableComponentKeys.map((key) => COMPONENT_LABELS[key])].join(', ')}.</p>
      {parent.preservedComponentKeys.length > 0 && <p>Preserved: {parent.preservedComponentKeys.map((key) => COMPONENT_LABELS[key]).join(', ')}.</p>}
    </div>}
    <p className="text-sm leading-relaxed text-gray-700">{workout.explanation.session}</p>
    {findings.length > 0 && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3"><h4 className="font-semibold text-amber-950">Review before coaching</h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">{findings.slice(0, 15).map((finding, index) => <li key={`${finding.code}:${index}`}>
        {finding.componentKeys.map((key) => COMPONENT_LABELS[key]).join(', ')}{finding.componentKeys.length ? ': ' : ''}
        {REVIEW_MESSAGES[finding.code] ?? finding.message}
      </li>)}</ul>{findings.length > 15 && <p className="mt-2 text-xs text-amber-800">{findings.length - 15} further findings are retained in the saved review.</p>}
    </div>}
    <ol className="space-y-4">{draft.schedule.components.map((component) => <li key={component.key} className="overflow-hidden rounded-xl border border-gray-200">
      <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3"><h4 className="font-semibold text-gray-900">{COMPONENT_LABELS[component.key]}</h4>
        <span className="shrink-0 text-sm tabular-nums text-gray-600">{durationLabel(component.startSeconds)}–{durationLabel(component.endSeconds)}</span></div>
      <div className="space-y-3 p-4">
        {component.key === 'prepare_and_access' && workout.explanation.preparation && <p className="text-sm text-gray-600">{workout.explanation.preparation}</p>}
        {draft.activities.filter((activity) => activity.componentKey === component.key).map((activity) => {
          const schedule = component.activities.find((entry) => entry.activityId === activity.activityId)
          const media = activity.card.media?.approvedVideoUrl
          return <article key={activity.activityId} className="rounded-lg border border-gray-200 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h5 className="font-semibold text-gray-900">{activity.card.displayName ?? activity.card.canonicalName ?? 'Reviewed exercise'}</h5>
              {schedule && <span className="text-xs tabular-nums text-gray-500">{durationLabel(schedule.startSeconds)}–{durationLabel(schedule.endSeconds)} · {schedule.waveCount} {schedule.waveCount === 1 ? 'wave' : 'waves'}</span>}</div>
            <p className="mt-1 font-medium text-gray-800">{activity.dose.sets} {activity.dose.sets === 1 ? 'set' : 'sets'}{activity.dose.reps != null ? ` × ${activity.dose.reps} reps` : ''} · {activity.dose.workSeconds}s work / {activity.dose.restSeconds}s rest</p>
            <p className="mt-1 text-xs text-gray-500">{activity.method.name ?? 'Reviewed programming method'}{activity.dose.highImpactContacts > 0 ? ` · ${activity.dose.highImpactContacts} planned high-impact contacts per athlete` : ''}</p>
            <p className="mt-1 text-sm text-gray-600">{activity.rationale}</p>
            {activity.profile.coachInstructions && <p className="mt-2 text-sm text-gray-700">{activity.profile.coachInstructions}</p>}
            <p className="mt-2 text-sm"><strong>Quality:</strong> {activity.dose.qualityGate}</p>
            <ul className="mt-1 list-disc pl-5 text-xs text-gray-600">{activity.dose.stopRules.map((rule, index) => <li key={index}>{rule}</li>)}</ul>
            {media && /^https?:\/\//i.test(media) && <a className="mt-2 inline-block text-sm font-medium text-vortex-red underline" href={media} target="_blank" rel="noreferrer">Exercise demonstration</a>}
            {schedule && <ProgrammingActivitySchedule key={schedule.doseHash + schedule.startSeconds} schedule={schedule} athleteNames={athleteNames} />}
          </article>
        })}
        {!draft.activities.some((activity) => activity.componentKey === component.key) && <p className="text-sm text-amber-800">This component needs eligible exercise choices before it can be coached.</p>}
        {component.reserveUsage && <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700"><strong>{durationLabel(component.reserveUsage.startSeconds)}–{durationLabel(component.reserveUsage.endSeconds)} · {component.reserveUsage.purpose === 'readiness_check' ? 'Readiness check' : component.reserveUsage.purpose === 'coaching' ? 'Coaching' : 'Recovery'}</strong>
          <p className="mt-1">{component.reserveUsage.rationale}</p></div>}
      </div>
    </li>)}</ol>
    {draft.schedule.sessionReserveSeconds > 0 && <p className="text-sm text-gray-600">Additional booked time: {durationLabel(draft.schedule.sessionReserveSeconds)}.</p>}
    <details className="rounded-lg bg-gray-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-gray-800">Programming review</summary>
      <div className="mt-2 space-y-2 text-sm text-gray-600"><p>{workout.workflow.qa.critic?.summary ?? 'Independent coaching review is incomplete.'}</p>
        <p>{workout.workflow.repairPasses} revision passes · {workout.workflow.trace.calls.length} specialist calls · library {draft.libraryRelease.version}</p>
        <p>{current ? `Evidence checked ${new Date(current.checkedAt).toLocaleString()}.` : 'Review describes the saved source and athlete evidence.'}</p>
      </div>
    </details>
  </section>
}
