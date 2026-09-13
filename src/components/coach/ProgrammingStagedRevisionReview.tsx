import { useEffect, useState } from 'react'
import type { StagedCanonicalReviewInput, StagedCanonicalRevisionView } from '../../coach/workoutExerciseProposals'
import { CanonicalCardEditor } from './CanonicalCardEditor'
import { CanonicalMediaReviewFields } from './CanonicalMediaReviewFields'
import { emptyMediaReviewDraft, mediaReviewDraftComplete } from './canonicalMediaReviewDraft'
import { actionClass, controlClass, Field } from './ProgrammingControls'

const accessReasons = {
  source_changed: 'The published source changed. Review is paused until a new revision is prepared against the current card.',
  not_submitted: 'Submit this revision for review before recording evidence.',
  independent_reviewer_required: 'An independent coach must review this revision. Its source author and revision contributors cannot record review evidence.',
}

export function ProgrammingStagedRevisionReview({ view, disabled, needsReload, onReview, onDirty }: {
  view: StagedCanonicalRevisionView; disabled: boolean; needsReload: boolean;
  onReview: (input: StagedCanonicalReviewInput) => void; onDirty: (dirty: boolean) => void;
}) {
  const { event, review, reviewAccess } = view
  const profile = event.card.variants.find((item) => item.id === event.target.variantId)?.profiles.find((item) => item.profileKey === event.target.profileKey)
  const [inspect, setInspect] = useState(false)
  const [kind, setKind] = useState<'taxonomy' | 'media' | 'card'>('taxonomy')
  const [record, setRecord] = useState('')
  const [outcome, setOutcome] = useState<'' | 'approve' | 'reject'>('')
  const [notes, setNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [media, setMedia] = useState(emptyMediaReviewDraft)
  const dirty = !!record || !!outcome || !!notes || confirmed || JSON.stringify(media) !== JSON.stringify(emptyMediaReviewDraft())
  useEffect(() => { onDirty(dirty); return () => onDirty(false) }, [dirty, onDirty])
  const records = [
    ...(profile?.taxonomyV2?.assignments ?? []).map((item) => ({ key: JSON.stringify(['assignment', item.facetType, item.key]),
      label: `${item.facetType}: ${item.name ?? item.key}`, description: `Assignment · ${item.key} · ${item.role} · weight ${item.weight}`,
      recordType: 'assignment' as const, facetType: item.facetType, termKey: item.key })),
    ...(profile?.taxonomyV2?.decisions ?? []).map((item) => ({ key: JSON.stringify(['decision', item.facetType]),
      label: `${item.facetType}: ${item.decision.replaceAll('_', ' ')}`, description: `Decision · ${item.rationale || 'No rationale recorded'}`,
      recordType: 'decision' as const, facetType: item.facetType, termKey: null })),
  ]
  const selected = records.find((item) => item.key === record)
  const blocked = disabled || needsReload || !reviewAccess.canReview
  const notesValid = notes.trim().length >= 20 && notes.length <= 2000
  const discard = () => { setRecord(''); setOutcome(''); setNotes(''); setConfirmed(false); setMedia(emptyMediaReviewDraft()) }
  const recordClassification = () => {
    if (blocked || !selected || !outcome || !notesValid) return
    const base = { expectedEventHash: event.contentHash, notes, kind: 'taxonomy' as const, facetType: selected.facetType, outcome }
    onReview(selected.recordType === 'assignment' ? { ...base, recordType: 'assignment', termKey: selected.termKey }
      : { ...base, recordType: 'decision' })
  }
  const recordMedia = () => {
    if (blocked || !event.card.approvedVideoUrl || !mediaReviewDraftComplete(media) || typeof media.score !== 'number' || !media.linkStatus || media.exactVariantMatch == null) return
    onReview({ expectedEventHash: event.contentHash, kind: 'media', notes: media.notes, url: event.card.approvedVideoUrl,
      demonstrationQualityScore: media.score, linkStatus: media.linkStatus, exactVariantMatch: media.exactVariantMatch,
      reviewBasis: { reviewMethod: 'manual_playback', playbackReviewed: true, exactVariantCompared: true, linkChecked: true, accessibilityChecked: true } })
  }
  const recordCard = (decision: 'approve' | 'request_changes') => {
    if (blocked || !notesValid || !confirmed || (decision === 'approve' && !reviewAccess.canApprove)) return
    onReview({ expectedEventHash: event.contentHash, kind: 'card', decision, notes })
  }
  return <section aria-label="Independent staged revision review" className="space-y-4 border-t border-indigo-200 pt-4">
    <h5 className="font-bold">Independent coach review</h5>
    <p className="text-sm text-gray-600">Review the complete proposed card, including its existing content and new profile. Each decision applies to this saved revision. Editing the profile clears its review evidence.</p>
    <button type="button" className={actionClass} disabled={disabled || needsReload} onClick={() => setInspect(true)}>Inspect complete proposed card</button>
    {reviewAccess.reason && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{accessReasons[reviewAccess.reason]}</p>}
    <p role="status" className="text-sm">{review.approval
      ? `Candidate approved by coach ${review.approval.reviewerUserId} · ${new Date(review.approval.reviewedAt).toLocaleString()}. Publication is still pending.`
      : 'This candidate has no current full-card approval.'}</p>
    <p className="text-sm">Automated checks: {review.testPacket.status}. {review.readiness.ready ? 'All publication readiness gates pass.' : `${review.readiness.issues.length} publication readiness findings remain.`}</p>
    <details><summary className="cursor-pointer text-sm font-semibold">Recorded review evidence · {review.evidence.length}</summary>
      <ul className="mt-2 space-y-3 text-sm">{review.evidence.map((item) => <li key={item.reviewEventId} className="rounded-lg bg-gray-50 p-3">
        <p className="font-semibold">{item.kind === 'taxonomy' ? `${item.details.facetType}${item.details.termKey ? ` · ${item.details.termKey}` : ''}: ${item.details.outcome}`
          : item.kind === 'media' ? `Media: ${item.details.linkStatus} · quality ${item.details.demonstrationQualityScore} · ${item.details.exactVariantMatch ? 'exact match' : 'not an exact match'}`
            : `Full card: ${item.details.decision.replaceAll('_', ' ')}`}</p>
        <p>Coach {item.reviewerUserId} · {new Date(item.reviewedAt).toLocaleString()}</p><p className="whitespace-pre-wrap break-words">{item.notes}</p>
        {item.kind === 'media' && <p>Media review expires {new Date(item.details.nextReviewAt).toLocaleString()}.</p>}
      </li>)}</ul>
      <p className="mt-2 text-xs text-gray-600">Recorded evidence can remain visible after it expires or later evidence changes. Current readiness and full-card approval above determine eligibility.</p>
    </details>
    {reviewAccess.canReview && <div className="space-y-3">
      <Field label="Review category"><select value={kind} disabled={disabled || needsReload || dirty} className={controlClass}
        onChange={(e) => setKind(e.target.value as typeof kind)}>
        <option value="taxonomy">Profile classification</option><option value="media">Demonstration media</option><option value="card">Complete card</option>
      </select></Field>
      {kind === 'taxonomy' && <fieldset disabled={blocked} className="min-w-0 space-y-3">
        <legend className="sr-only">Review a profile classification</legend>
        <Field label="Classification to review"><select className={controlClass} value={record} onChange={(e) => setRecord(e.target.value)}>
          <option value="">Select a classification</option>{records.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select></Field>
        {selected && <p className="text-sm">{selected.description}</p>}
        <Field label="Classification decision"><select className={controlClass} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
          <option value="">Select a decision</option><option value="approve">Approve classification</option><option value="reject">Reject classification</option>
        </select></Field>
      </fieldset>}
      {kind === 'media' ? <div className="space-y-3">
        <p className="break-all text-sm">Selected demonstration: {event.card.approvedVideoUrl
          ? <a href={event.card.approvedVideoUrl} target="_blank" rel="noreferrer" className="text-indigo-700 underline">{event.card.approvedVideoUrl}</a>
          : 'No demonstration URL is available. Request changes to the source card.'}</p>
        <CanonicalMediaReviewFields value={media} onChange={setMedia} disabled={blocked} />
      </div> : <Field label="Staged reviewer evidence" hint="Document your observations and rationale (20–2000 characters).">
        <textarea rows={3} minLength={20} maxLength={2000} disabled={blocked} value={notes} onChange={(e) => setNotes(e.target.value)} className={controlClass} />
      </Field>}
      {kind === 'card' && <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={blocked} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I personally reviewed this complete candidate, its new profile, recorded evidence, and current readiness findings.</label>}
      {dirty && <p role="status" className="text-sm text-amber-900">Unsaved review evidence. Record or discard it before editing the profile, refreshing, or leaving this proposal.</p>}
      <div className="flex flex-wrap gap-2">
        {kind === 'taxonomy' && <button type="button" className={actionClass} disabled={blocked || !selected || !outcome || !notesValid} onClick={recordClassification}>Record classification review</button>}
        {kind === 'media' && <button type="button" className={actionClass} disabled={blocked || !event.card.approvedVideoUrl || !mediaReviewDraftComplete(media)} onClick={recordMedia}>Record staged media review</button>}
        {kind === 'card' && <><button type="button" className={actionClass} disabled={blocked || !notesValid || !confirmed || !reviewAccess.canApprove} onClick={() => recordCard('approve')}>Approve complete candidate</button>
          <button type="button" className={actionClass} disabled={blocked || !notesValid || !confirmed} onClick={() => recordCard('request_changes')}>Request candidate changes</button></>}
        {dirty && <button type="button" className={actionClass} disabled={disabled} onClick={discard}>Discard review evidence</button>}
      </div>
    </div>}
    {inspect && <CanonicalCardEditor readOnly initialVariantId={event.target.variantId} initialProfileKey={event.target.profileKey}
      source={{ ...event.card, readiness: { ready: review.readiness.ready, issues: review.readiness.issues.map((issue) => ({ ...issue, path: issue.path ?? '' })) }, testPacket: review.testPacket }}
      onClose={() => setInspect(false)} onSaved={() => {}} />}
  </section>
}
