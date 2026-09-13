import { useEffect, useState } from 'react'
import { coachFetch } from '../../coach/api'
import type { Taxonomy } from '../../coach/taxonomy'
import { programmingError } from '../../coach/workoutProgramming'
import type { ExerciseProposalReview, StagedCanonicalEvent, StagedCanonicalRevisionChange, StagedCanonicalRevisionView } from '../../coach/workoutExerciseProposals'
import { actionClass } from './ProgrammingControls'
import { ProgrammingStagedProfileForm } from './ProgrammingStagedProfileForm'

const base = '/api/coach/workout-programming'
type Run = (name: string, action: (signal: AbortSignal) => Promise<void>) => Promise<void>
const status = (error: unknown) => error instanceof Error && 'status' in error ? error.status : null

export function ProgrammingProfileRevision({ review, taxonomy, disabled, run, onDirty }: {
  review: ExerciseProposalReview; taxonomy: Taxonomy | null; disabled: boolean; run: Run; onDirty: (dirty: boolean) => void;
}) {
  const { draftAuditId, contentHash } = review.record
  const [revision, setRevision] = useState<StagedCanonicalEvent | null>(null)
  const [view, setView] = useState<StagedCanonicalRevisionView | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [needsReload, setNeedsReload] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        let event: StagedCanonicalEvent
        try { event = await coachFetch<StagedCanonicalEvent>(`${base}/exercise-proposals/${draftAuditId}/staged-revision`, { signal: controller.signal }) }
        catch (error) {
          if (status(error) !== 404) throw error
          if (!controller.signal.aborted) { setRevision(null); setView(null); setLoaded(true); setError(null) }
          return
        }
        if (controller.signal.aborted) return
        setRevision(event)
        const result = await coachFetch<StagedCanonicalRevisionView>(`${base}/staged-card-revisions/${event.stagedRevisionId}`, { signal: controller.signal })
        if (!controller.signal.aborted) { setView(result); setLoaded(true); setError(null); setNeedsReload(false) }
      } catch (error) {
        if (!controller.signal.aborted) { setView(null); setLoaded(false); setError(programmingError(error)) }
      }
    })()
    return () => controller.abort()
  }, [draftAuditId, reload])
  const load = async (id: string, signal: AbortSignal) => {
    const result = await coachFetch<StagedCanonicalRevisionView>(`${base}/staged-card-revisions/${id}`, { signal })
    if (!signal.aborted) { setView(result); setRevision(result.event); setLoaded(true); setNeedsReload(false); setError(null) }
  }
  const stage = () => void run('Staging delivery profile revision', async (signal) => {
    if (!loaded || !confirmed || revision) return
    const result = await coachFetch<{ event: StagedCanonicalEvent; alreadyStaged: boolean }>(`${base}/exercise-proposals/${draftAuditId}/stage-revision`, {
      method: 'POST', signal, body: JSON.stringify({ expectedProposalHash: contentHash }),
    })
    if (signal.aborted) return
    setRevision(result.event); setView(null)
    await load(result.event.stagedRevisionId, signal)
  })
  const change = (input: StagedCanonicalRevisionChange) => void run('Saving staged revision', async (signal) => {
    if (!revision) return
    try {
      const event = await coachFetch<StagedCanonicalEvent>(`${base}/staged-card-revisions/${revision.stagedRevisionId}/change`, {
        method: 'POST', signal, body: JSON.stringify(input),
      })
      if (signal.aborted) return
      setRevision(event); setView(null)
      await load(event.stagedRevisionId, signal)
    } catch (error) {
      if (!signal.aborted) {
        if ([403, 404].includes(Number(status(error)))) { setView(null); setRevision(null); setLoaded(false) }
        if (status(error) === 409) { setNeedsReload(true); setError('The source or staged revision changed. Discard any unsaved edits and refresh before continuing.') }
      }
      throw error
    }
  })
  const refresh = () => void run('Refreshing staged revision', async (signal) => {
    if (revision) await load(revision.stagedRevisionId, signal)
  })
  return <section aria-label="Staged delivery profile revision" className="space-y-4 rounded-xl border border-indigo-200 bg-white p-4">
    <h4 className="text-lg font-bold">Delivery profile revision</h4>
    {error && <p role="alert" className="text-sm text-amber-900">{error}</p>}
    {!loaded && !error && <p role="status" className="text-sm">Checking for an existing staged revision…</p>}
    {!view && (!loaded || revision) && <button type="button" className={actionClass} disabled={disabled} onClick={() => { setError(null); setReload((value) => value + 1) }}>Recover staged revision</button>}
    {loaded && !revision && <div className="space-y-3 text-sm">
      <p>Stage the proposed profile on its existing card for editing and human review. The published version remains available during review.</p>
      <label className="flex items-start gap-2"><input type="checkbox" disabled={disabled} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I reviewed this proposal and want to stage an unapproved revision of the existing card.</label>
      <button type="button" className={actionClass} disabled={disabled || !confirmed} onClick={stage}>Stage profile revision</button>
    </div>}
    {view && <ProgrammingStagedProfileForm key={view.event.contentHash} view={view} needsReload={needsReload}
      taxonomy={taxonomy} disabled={disabled} onChange={change} onReload={refresh} onDirty={onDirty} />}
  </section>
}
