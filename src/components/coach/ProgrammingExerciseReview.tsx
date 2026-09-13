import { useState } from 'react'
import type { ExerciseProposalReview, QuarantinedExerciseProfile, WorkoutExerciseGapResearch } from '../../coach/workoutExerciseProposals'
import { EXERCISE_DELIVERY_LABELS } from '../../coach/workoutExerciseProposals'
import { COMPONENT_LABELS } from '../../coach/workoutProgramming'
import { actionClass } from './ProgrammingControls'

export function ExerciseResearchEvidence({ research, onOpenCard, disabled }: { research: WorkoutExerciseGapResearch;
  onOpenCard: (id: string) => void; disabled: boolean }) {
  return <div className="space-y-3">
    <p className="text-sm text-gray-600">Searched {research.coverage.definitionCount} canonical definitions across all library states. {research.relatedDefinitions.length} related definitions found.</p>
    {(!research.coverage.catalogSearchComplete || research.coverage.evidenceTruncated) && <p className="text-sm text-amber-900">The search is incomplete. Resolve the coverage findings before proposing content.</p>}
    {!!research.issues.length && <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">{research.issues.map((issue, index) => <li key={index}>{issue.detail}</li>)}</ul>}
    <details><summary className="cursor-pointer text-sm font-semibold">Related canonical content</summary>
      <ul className="mt-2 space-y-2">{research.relatedDefinitions.map((card) => <li key={card.id} className="rounded-lg border border-gray-200 p-3 text-sm">
        <button type="button" className="font-semibold text-indigo-700 underline" disabled={disabled} onClick={() => onOpenCard(card.id)}>{card.displayName}</button>
        <p>{card.status} · version {card.cardVersion} · {card.inCurrentRelease ? 'In current release' : 'Outside current release'} · {card.eligibleProfileIds.length} eligible profiles</p>
        {card.description && <p className="mt-1 text-gray-600">{card.description}</p>}
      </li>)}</ul>
      {!research.relatedDefinitions.length && <p className="mt-2 text-sm text-gray-600">No related definitions found in this search. Coaching assessment is still required.</p>}
    </details>
  </div>
}

const range = (values: readonly [number, number]) => values[0] === values[1] ? String(values[0]) : `${values[0]}–${values[1]}`
const difficultyLabels = { technicalComplexity: 'Technical complexity', absoluteLoadDemand: 'Physical difficulty', supervisionDemand: 'Supervision demand',
  failureConsequence: 'Failure consequence', impact: 'Impact', workCapacityDemand: 'Work capacity demand' } as const
function Profile({ profile }: { profile: QuarantinedExerciseProfile }) {
  return <section className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm" aria-label="Proposed delivery profile">
    <h5 className="font-semibold">{EXERCISE_DELIVERY_LABELS[profile.phaseKey] ?? profile.phaseKey}</h5>
    <p>{profile.purpose}</p>
    <p className="font-medium">{range(profile.dosage.sets)} sets · {profile.dosage.reps ? `${range(profile.dosage.reps)} reps` : 'Timed work'}
      {profile.dosage.workSeconds != null && ` · ${profile.dosage.workSeconds} seconds work`} · {profile.dosage.restSeconds} seconds rest</p>
    <p><strong>Quality gate:</strong> {profile.qualityGate}</p>
    <ul className="list-disc pl-5">{profile.stopRules.map((rule, index) => <li key={index}>{rule}</li>)}</ul>
    <p><strong>Coach instructions:</strong> {profile.coachInstructions}</p>
    <p><strong>Athlete instructions:</strong> {profile.athleteInstructions}</p>
    <p><strong>Expected adaptation:</strong> {profile.expectedAdaptation}</p>
    <p><strong>Equipment:</strong> {profile.equipmentRequired.join(', ') || 'No additional equipment specified'}</p>
  </section>
}

export function ProgrammingExerciseReview({ review, disabled, onAccept, onOpenCard, onRefresh }: { review: ExerciseProposalReview;
  disabled: boolean; onAccept: () => void; onOpenCard: (id: string) => void; onRefresh: () => void }) {
  const [confirmed, setConfirmed] = useState(false)
  const { record, acceptance } = review
  const session = record.request.request
  const proposal = record.proposal
  const origin = proposal?.kind === 'new_card' ? proposal.draft.provenance : proposal?.provenance
  return <section className="space-y-4 rounded-xl border border-indigo-200 bg-white p-4" aria-label="Exercise proposal review">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-lg font-bold">{record.request.need.canonicalName}</h4>
      <p className="text-sm text-gray-600">{COMPONENT_LABELS[record.request.componentKey]} · Recorded {new Date(record.createdAt).toLocaleString()}</p></div>
      <button type="button" className={actionClass} disabled={disabled} onClick={onRefresh}>Refresh proposal status</button></header>
    <div className="rounded-lg bg-indigo-50 p-3 text-sm"><p className="font-semibold">Original session demand</p><p>{record.request.need.description}</p>
      <p className="mt-1">{session.logistics.totalBookedMinutes} minutes · {session.athletes.reduce((sum, group) => sum + group.athleteCount, 0)} athletes · ages {Math.min(...session.athletes.map((group) => group.ageMin))}–{Math.max(...session.athletes.map((group) => group.ageMax))}</p></div>
    {acceptance ? <div role="status" className="space-y-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
      <p>Accepted into the canonical library as a draft. Current status: <strong>{acceptance.status}</strong> · version {acceptance.cardVersion}.</p>
      <p>Accepted {new Date(acceptance.acceptedAt).toLocaleString()}. Publication follows the existing independent-review process.</p>
      <button type="button" className={actionClass} disabled={disabled} onClick={() => onOpenCard(acceptance.canonicalCardId)}>Open canonical card</button>
    </div> : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{proposal ? 'Unverified AI proposal. Review the movement, dosage, instructions and uncertainties before accepting it as a draft.' : 'This attempt needs coach review and has no proposal to accept.'}</p>}
    <p className="text-sm">{record.assessment.judgment?.needRationale ?? record.assessment.exerciseGap?.needRationale}</p>
    {!!record.issues.length && <ul className="list-disc pl-5 text-sm text-amber-900">{record.issues.map((issue, index) => <li key={index}>{issue.detail}</li>)}</ul>}
    {proposal?.kind === 'new_card' && <div className="space-y-3">
      <h5 className="font-semibold">Proposed exercise card</h5><p className="text-sm">{String(proposal.draft.description ?? '')}</p>
      <p className="text-sm">Display name: {proposal.draft.displayName} · Family: {proposal.draft.familyKey}</p>
      {!!proposal.draft.aliases.length && <p className="text-sm">Aliases: {proposal.draft.aliases.join(', ')}</p>}
      <p className="text-sm">Patterns: {proposal.draft.movementPatterns.join(', ')} · Body regions: {proposal.draft.bodyRegions.join(', ')}</p>
      <p className="text-sm">Required equipment: {proposal.draft.requiredEquipment.join(', ') || 'None specified'} · Content confidence: {proposal.draft.contentConfidence}/100</p>
      {proposal.draft.variants.map((variant) => <div key={variant.variantKey} className="space-y-2"><h5 className="font-medium">{variant.displayName}</h5>
        <details><summary className="cursor-pointer text-sm font-semibold">Proposed difficulty and coaching demands</summary>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">{(Object.keys(difficultyLabels) as Array<keyof typeof difficultyLabels>).map((key) => <div key={key}>
            <dt className="text-gray-600">{difficultyLabels[key]}</dt><dd>{variant.difficulty[key]}/100</dd></div>)}</dl></details>
        {variant.profiles.map((profile) => <Profile key={profile.profileKey} profile={profile} />)}</div>)}
      <details><summary className="cursor-pointer text-sm font-semibold">Publication readiness findings · {proposal.readiness.issues.length}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{proposal.readiness.issues.map((issue, index) => <li key={index}>{String(issue.message ?? issue.detail ?? 'Additional human review required.')}</li>)}</ul></details>
    </div>}
    {proposal?.kind === 'delivery_profile' && <div className="space-y-3"><Profile profile={proposal.profile} />
      <p className="text-sm text-amber-900">This proposal adds a delivery profile to its existing card. Use the revision workspace below to stage it for human review.</p>
      <button type="button" className={actionClass} disabled={disabled} onClick={() => onOpenCard(proposal.target.exerciseCardId)}>Inspect source card</button></div>}
    {origin && <div className="grid gap-3 sm:grid-cols-2">{([{ title: 'Assumptions', values: origin.assumptions }, { title: 'Uncertainties', values: origin.uncertainties }]).map(({ title, values }) => <div key={title}>
      <h5 className="text-sm font-semibold">{title}</h5><ul className="list-disc pl-5 text-sm">{values.map((value, index) => <li key={index}>{value}</li>)}</ul></div>)}</div>}
    <ExerciseResearchEvidence research={record.assessment.research} disabled={disabled} onOpenCard={onOpenCard} />
    {!!record.assessment.judgment?.alternatives.length && <details><summary className="cursor-pointer text-sm font-semibold">Director’s assessment of alternatives</summary>
      <ul className="mt-2 space-y-2 text-sm">{record.assessment.judgment.alternatives.map((alternative) => <li key={alternative.definitionId}>
        <strong>{record.assessment.research.relatedDefinitions.find((card) => card.id === alternative.definitionId)?.displayName ?? 'Canonical card'}:</strong> {alternative.rationale}</li>)}</ul></details>}
    {proposal?.kind === 'new_card' && !acceptance && <div className="space-y-3 border-t border-gray-200 pt-4">
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        I reviewed this proposal and want to add it as an unapproved canonical draft.</label>
      <button type="button" disabled={disabled || !confirmed} className={actionClass} onClick={onAccept}>Accept as canonical draft</button>
      <p className="text-xs text-gray-600">Acceptance preserves the AI audit and does not make this exercise eligible for generated sessions.</p>
    </div>}
  </section>
}
