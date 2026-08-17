import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, ThumbsUp, XCircle } from 'lucide-react'
import { coachFetch } from '../../coach/api'

interface CoverageRow {
  subjectScope: 'definition' | 'variant' | 'delivery_profile'
  facetType: string
  subjectCount: number
  evidenceCount: number
  approvedCount: number
  missingCount: number
}

interface GovernanceReport {
  version: string
  releaseReady: boolean
  coverage: CoverageRow[]
  assignmentReviewStatus: Array<{ review_status: string; count: number }>
  decisionReviewStatus: Array<{ review_status: string; count: number }>
  legacyMappings: Array<{ mapping_state: string; count: number }>
  equipmentAliases: Array<{ resolution_state: string; count: number }>
  structuredProfileReviewStatus: Array<{ review_status: string; count: number }>
}

interface CanonicalDataQualityReport {
  coverage: {
    totalDefinitions: number
    publishedDefinitions: number
    publishedVariants: number
    publishedCurrentCardReviewPercent: number | null
    publishedVerifiedManualMediaPercent: number | null
    publishedStructuredProfileCompletePercent: number | null
    publishedStructuredProfileApprovedPercent: number | null
  }
  graph: { approvedEdges: number }
  coachPilot: { reviewCount: number }
  governance: {
    approvedCalibrationAnchors: number
    exactIdentityCollisions: number
    structuredProfilesPendingReview: number
  }
}

interface ReviewQueueRecord {
  recordType: 'assignment' | 'decision'
  id: string
  subjectScope: CoverageRow['subjectScope']
  subjectName: string
  facetType: string
  termKey?: string
  termName?: string
  decision?: string
  rationale?: string | null
  role?: string
  weight?: number
  confidence: number
  reviewStatus: 'suggested' | 'review'
  createdBy: number | null
}

interface StructuredProfileReviewRecord {
  id: string
  definitionId: string
  subjectName: string
  variantKey: string
  reviewStatus: 'suggested' | 'review'
  createdBy: number | null
  profile: {
    movementGeometry: Record<string, string[]>
    anatomyProfile: { assignments?: unknown[] }
    equipmentRoles: unknown[]
    taskDemands: Record<string, number | null>
    stressProfile: Record<string, number | string[] | null>
    scalingHandles: unknown[]
    compositionProfile: Record<string, unknown>
  }
  completeness: { complete: boolean; issues: Array<{ field: string; code: string }> }
  validationError?: string | null
  reviewPriority: number
}

interface StructuredProfileReviewQueue {
  items: StructuredProfileReviewRecord[]
  total: number
  totalPending: number
  offset: number
  limit: number
  status: 'pending' | 'suggested' | 'review'
  missingField: string | null
  sort: 'closest_to_complete' | 'alphabetical'
  eligibleForApprovalCount: number
  reviewStatusCounts: Record<'suggested' | 'review', number>
  missingFieldCounts: Array<{ field: string; count: number }>
}

interface MediaVerificationQueue {
  items: Array<{
    definitionId: string
    subjectName: string
    canonicalName: string
    cardStatus: 'draft' | 'review' | 'published'
    approvedVideoUrl: string
    cardVersion: number
    reviewedAt: string | null
    issues: string[]
  }>
  total: number
  offset: number
  limit: number
  publishedCount: number
}

interface CardReviewQueue {
  items: Array<{
    definitionId: string
    subjectName: string
    canonicalName: string
    cardVersion: number
    updatedAt: string
    reviewCount: number
    latestDecision: 'approve' | 'request_changes' | null
    latestReviewedAt: string | null
  }>
  total: number
  offset: number
  limit: number
}

interface RelationshipReviewQueue {
  items: Array<{
    id: string
    relationship: string
    similarityScore: number
    dimensions: string[]
    reason: string
    conditions: Record<string, unknown>
    createdBy: number | null
    createdAt: string
    from: { definitionId: string; variantId: string; name: string }
    to: { definitionId: string; variantId: string; name: string }
  }>
  total: number
  offset: number
  limit: number
}

const label = (value: string) => value.replaceAll('_', ' ')

export function CanonicalTaxonomyGovernance({ onOpenCard }: {
  onOpenCard?: (definitionId: string, variantId: string | null) => void
}) {
  const [report, setReport] = useState<GovernanceReport | null>(null)
  const [dataQuality, setDataQuality] = useState<CanonicalDataQualityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [queue, setQueue] = useState<ReviewQueueRecord[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [structuredQueue, setStructuredQueue] = useState<StructuredProfileReviewQueue | null>(null)
  const [structuredMissingField, setStructuredMissingField] = useState('')
  const [structuredStatus, setStructuredStatus] = useState<'pending' | 'suggested' | 'review'>('pending')
  const [structuredSort, setStructuredSort] = useState<'closest_to_complete' | 'alphabetical'>('closest_to_complete')
  const [structuredOffset, setStructuredOffset] = useState(0)
  const [mediaQueue, setMediaQueue] = useState<MediaVerificationQueue | null>(null)
  const [mediaOffset, setMediaOffset] = useState(0)
  const [cardQueue, setCardQueue] = useState<CardReviewQueue | null>(null)
  const [cardOffset, setCardOffset] = useState(0)
  const [relationshipQueue, setRelationshipQueue] = useState<RelationshipReviewQueue | null>(null)
  const [relationshipOffset, setRelationshipOffset] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({
        limit: '25',
        offset: String(structuredOffset),
        status: structuredStatus,
        sort: structuredSort,
      })
      if (structuredMissingField) query.set('missingField', structuredMissingField)
      const [nextReport, nextQueue, nextStructuredQueue, nextCardQueue, nextMediaQueue, nextRelationshipQueue, nextDataQuality] = await Promise.all([
        coachFetch<GovernanceReport>('/api/coach/taxonomy-v2/governance'),
        coachFetch<ReviewQueueRecord[]>('/api/coach/taxonomy-v2/review-queue?limit=100').catch(() => []),
        coachFetch<StructuredProfileReviewQueue>(`/api/coach/canonical/structured-profiles/review-queue?${query}`).catch(() => null),
        coachFetch<CardReviewQueue>(`/api/coach/canonical/cards/review-queue?limit=25&offset=${cardOffset}`).catch(() => null),
        coachFetch<MediaVerificationQueue>(`/api/coach/canonical/media-verification-queue?limit=25&offset=${mediaOffset}`).catch(() => null),
        coachFetch<RelationshipReviewQueue>(`/api/coach/canonical/relationships/review-queue?limit=25&offset=${relationshipOffset}`).catch(() => null),
        coachFetch<CanonicalDataQualityReport>('/api/coach/canonical/data-quality').catch(() => null),
      ])
      setReport(nextReport)
      setQueue(nextQueue)
      setStructuredQueue(nextStructuredQueue)
      setCardQueue(nextCardQueue)
      setMediaQueue(nextMediaQueue)
      setRelationshipQueue(nextRelationshipQueue)
      setDataQuality(nextDataQuality)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load taxonomy governance.')
    } finally {
      setLoading(false)
    }
  }, [cardOffset, mediaOffset, relationshipOffset, structuredMissingField, structuredOffset, structuredSort, structuredStatus])

  const reviewStructured = async (record: StructuredProfileReviewRecord, outcome: 'approve' | 'reject') => {
    const key = `structured:${record.id}`
    const reviewNotes = String(notes[key] ?? '').trim()
    if (reviewNotes.length < 20) return
    setReviewing(key)
    setError(null)
    try {
      await coachFetch(`/api/coach/canonical/structured-profiles/${record.id}/review`, {
        method: 'POST', body: JSON.stringify({ outcome, notes: reviewNotes }),
      })
      setNotes((current) => ({ ...current, [key]: '' }))
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not record the structured profile review.')
    } finally {
      setReviewing(null)
    }
  }

  useEffect(() => { void load() }, [load])

  const review = async (record: ReviewQueueRecord, outcome: 'approve' | 'reject') => {
    const key = `${record.recordType}:${record.id}`
    const reviewNotes = String(notes[key] ?? '').trim()
    if (reviewNotes.length < 20) return
    setReviewing(key)
    setError(null)
    try {
      await coachFetch(`/api/coach/taxonomy-v2/${record.recordType}/${record.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ outcome, notes: reviewNotes }),
      })
      setNotes((current) => ({ ...current, [key]: '' }))
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not record the independent review.')
    } finally {
      setReviewing(null)
    }
  }

  const reviewRelationship = async (record: RelationshipReviewQueue['items'][number], outcome: 'approved' | 'rejected') => {
    const key = `relationship:${record.id}`
    const reviewNotes = String(notes[key] ?? '').trim()
    if (reviewNotes.length < 20) return
    setReviewing(key)
    setError(null)
    try {
      await coachFetch(`/api/coach/canonical/relationships/${record.id}/review`, {
        method: 'POST', body: JSON.stringify({ decision: outcome, notes: reviewNotes }),
      })
      setNotes((current) => ({ ...current, [key]: '' }))
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not record the relationship review.')
    } finally {
      setReviewing(null)
    }
  }

  if (loading && !report) return <div className="flex items-center gap-2 p-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading taxonomy governance</div>
  if (error && !report) return <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="h-4 w-4" />{error}</div>
  if (!report) return null

  const missing = report.coverage.reduce((sum, row) => sum + row.missingCount, 0)
  const pending = report.coverage.reduce((sum, row) => sum + row.evidenceCount - row.approvedCount, 0)
  const structuredPending = report.structuredProfileReviewStatus
    .filter((row) => row.review_status !== 'approved')
    .reduce((sum, row) => sum + Number(row.count), 0)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-950"><ShieldAlert className="h-5 w-5 text-indigo-700" />Taxonomy v2 governance</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">Coverage is counted at concept, exact-variant, and delivery-profile scope. Automated backfill is evidence only; independent review is required before release.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />Refresh</button>
      </header>

      <div className={`rounded-lg border p-4 ${report.releaseReady ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <p className="flex items-center gap-2 font-semibold">
          {report.releaseReady ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-amber-700" />}
          {report.releaseReady ? 'Taxonomy release gate passes' : 'Taxonomy release remains blocked'}
        </p>
        <p className="mt-1 text-sm">{missing.toLocaleString()} required classifications are missing; {pending.toLocaleString()} taxonomy records and {structuredPending.toLocaleString()} exact-variant profiles still need independent approval.</p>
      </div>

      {dataQuality && (
        <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-4" aria-labelledby="canonical-release-evidence">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 id="canonical-release-evidence" className="text-sm font-semibold text-indigo-950">Canonical release evidence</h3>
              <p className="mt-1 text-xs text-indigo-900">These are release inputs, not a publication action. Human media, relationship, calibration, and floor-pilot approval remain separate gates.</p>
            </div>
            <span className="text-xs font-medium text-indigo-800">{dataQuality.coverage.publishedDefinitions} / {dataQuality.coverage.totalDefinitions} cards published</span>
          </div>
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-indigo-800">Published exact variants</dt><dd className="mt-0.5 text-lg font-semibold text-indigo-950">{dataQuality.coverage.publishedVariants}</dd></div>
            <div><dt className="text-indigo-800">Current card approvals</dt><dd className="mt-0.5 text-lg font-semibold text-indigo-950">{dataQuality.coverage.publishedCurrentCardReviewPercent ?? 0}%</dd></div>
            <div><dt className="text-indigo-800">Documented media verification</dt><dd className="mt-0.5 text-lg font-semibold text-indigo-950">{dataQuality.coverage.publishedVerifiedManualMediaPercent ?? 0}%</dd></div>
            <div><dt className="text-indigo-800">Complete published profiles</dt><dd className="mt-0.5 text-lg font-semibold text-indigo-950">{dataQuality.coverage.publishedStructuredProfileCompletePercent ?? 0}%</dd></div>
            <div><dt className="text-indigo-800">Independently reviewed profiles</dt><dd className="mt-0.5 text-lg font-semibold text-indigo-950">{dataQuality.coverage.publishedStructuredProfileApprovedPercent ?? 0}%</dd></div>
            <div><dt className="text-indigo-800">Pending exact-variant reviews</dt><dd className="mt-0.5 text-lg font-semibold text-indigo-950">{dataQuality.governance.structuredProfilesPendingReview}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-indigo-900">Approved relationships: {dataQuality.graph.approvedEdges} · approved calibration anchors: {dataQuality.governance.approvedCalibrationAnchors} · coach-pilot reviews: {dataQuality.coachPilot.reviewCount} · exact identity collisions: {dataQuality.governance.exactIdentityCollisions}</p>
        </section>
      )}

      <section className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2">Scope</th><th className="px-3 py-2">Facet</th><th className="px-3 py-2 text-right">Subjects</th><th className="px-3 py-2 text-right">Evidence</th><th className="px-3 py-2 text-right">Approved</th><th className="px-3 py-2 text-right">Missing</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {report.coverage.map((row) => (
              <tr key={`${row.subjectScope}:${row.facetType}`}>
                <td className="px-3 py-2">{label(row.subjectScope)}</td>
                <td className="px-3 py-2 font-medium">{label(row.facetType)}</td>
                <td className="px-3 py-2 text-right">{row.subjectCount.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{row.evidenceCount.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-emerald-700">{row.approvedCount.toLocaleString()}</td>
                <td className={`px-3 py-2 text-right ${row.missingCount ? 'font-semibold text-red-700' : 'text-gray-500'}`}>{row.missingCount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Whole-card approval queue</h3>
            <p className="mt-1 text-xs text-gray-500">Each item lacks an independent approval for its current card version. Open the card to inspect its complete execution, support, profile, media, and test-packet evidence before deciding.</p>
          </div>
          <span className="text-xs text-gray-500">{cardQueue ? `${cardQueue.total} awaiting approval` : 'Loading queue…'}</span>
        </div>
        {!cardQueue && <p className="mt-3 rounded bg-gray-50 p-3 text-sm text-gray-500">Loading whole-card approval queue…</p>}
        {cardQueue?.items.length === 0 && <p className="mt-3 rounded bg-gray-50 p-3 text-sm text-gray-500">Every card currently in review has an independent approval for its current version.</p>}
        <div className="mt-3 space-y-2">
          {cardQueue?.items.map((record) => (
            <article key={record.definitionId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{record.subjectName}</p>
                <p className="mt-1 text-xs text-gray-600">version {record.cardVersion} · {record.reviewCount} current-version review{record.reviewCount === 1 ? '' : 's'} · latest {record.latestDecision ? label(record.latestDecision) : 'no decision'}</p>
              </div>
              {onOpenCard && <button type="button" onClick={() => onOpenCard(record.definitionId, null)} className="rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs font-semibold text-indigo-800">Open card to review</button>}
            </article>
          ))}
        </div>
        {cardQueue && cardQueue.total > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-600">
            <span>Showing {cardQueue.offset + 1}–{Math.min(cardQueue.offset + cardQueue.items.length, cardQueue.total)} of {cardQueue.total}</span>
            <div className="flex gap-2">
              <button type="button" disabled={cardQueue.offset === 0} onClick={() => setCardOffset((current) => Math.max(0, current - cardQueue.limit))} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50">Previous</button>
              <button type="button" disabled={cardQueue.offset + cardQueue.items.length >= cardQueue.total} onClick={() => setCardOffset((current) => current + cardQueue.limit)} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Relationship graph review queue</h3>
            <p className="mt-1 text-xs text-gray-500">Review the exact variants, phase intent, task differences, and substitution consequences. A decision snapshots the edge and requires an independent reviewer note.</p>
          </div>
          <span className="text-xs text-gray-500">{relationshipQueue ? `${relationshipQueue.total} pending edges` : 'Loading queue…'}</span>
        </div>
        {!relationshipQueue && <p className="mt-3 rounded bg-gray-50 p-3 text-sm text-gray-500">Loading relationship review queue…</p>}
        {relationshipQueue?.items.length === 0 && <p className="mt-3 rounded bg-gray-50 p-3 text-sm text-gray-500">No relationship edges are awaiting review.</p>}
        <div className="mt-3 space-y-2">
          {relationshipQueue?.items.map((record) => {
            const key = `relationship:${record.id}`
            const reviewNotes = notes[key] ?? ''
            return (
              <article key={record.id} className="rounded border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">{record.from.name} <span className="font-normal text-gray-500">→ {label(record.relationship)} →</span> {record.to.name}</p>
                <p className="mt-1 text-xs text-gray-600">Similarity {record.similarityScore}/100 · dimensions {record.dimensions.map(label).join(', ') || 'not applicable'}</p>
                <p className="mt-1 text-xs text-gray-700">Author rationale: {record.reason}</p>
                <div className="mt-2 flex flex-col gap-2 md:flex-row">
                  <input aria-label={`Relationship review notes for ${record.from.name} to ${record.to.name}`} value={reviewNotes} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} placeholder="Required independent review evidence (20+ characters)" className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs" />
                  {onOpenCard && <button type="button" onClick={() => onOpenCard(record.from.definitionId, record.from.variantId)} className="rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs font-semibold text-indigo-800">Open source</button>}
                  {onOpenCard && <button type="button" onClick={() => onOpenCard(record.to.definitionId, record.to.variantId)} className="rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs font-semibold text-indigo-800">Open target</button>}
                  <button type="button" disabled={reviewNotes.trim().length < 20 || reviewing === key} onClick={() => void reviewRelationship(record, 'approved')} className="rounded bg-emerald-700 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Approve</button>
                  <button type="button" disabled={reviewNotes.trim().length < 20 || reviewing === key} onClick={() => void reviewRelationship(record, 'rejected')} className="rounded bg-red-700 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Reject</button>
                </div>
              </article>
            )
          })}
        </div>
        {relationshipQueue && relationshipQueue.total > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-600">
            <span>Showing {relationshipQueue.offset + 1}–{Math.min(relationshipQueue.offset + relationshipQueue.items.length, relationshipQueue.total)} of {relationshipQueue.total}</span>
            <div className="flex gap-2">
              <button type="button" disabled={relationshipQueue.offset === 0} onClick={() => setRelationshipOffset((current) => Math.max(0, current - relationshipQueue.limit))} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50">Previous</button>
              <button type="button" disabled={relationshipQueue.offset + relationshipQueue.items.length >= relationshipQueue.total} onClick={() => setRelationshipOffset((current) => current + relationshipQueue.limit)} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Exact-match media verification queue</h3>
            <p className="mt-1 text-xs text-gray-500">Open each card, play the approved media, compare it to the exact variation, and document the observed evidence. This queue never certifies media automatically.</p>
          </div>
          <span className="text-xs text-gray-500">{mediaQueue ? `${mediaQueue.total} missing current evidence · ${mediaQueue.publishedCount} published` : 'Loading queue…'}</span>
        </div>
        {!mediaQueue && <p className="mt-3 rounded bg-gray-50 p-3 text-sm text-gray-500">Loading media verification queue…</p>}
        {mediaQueue?.items.length === 0 && <p className="mt-3 rounded bg-gray-50 p-3 text-sm text-gray-500">No cards with approved media are waiting for documented verification.</p>}
        <div className="mt-3 space-y-2">
          {mediaQueue?.items.map((record) => (
            <article key={record.definitionId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{record.subjectName}</p>
                <p className="mt-1 text-xs text-gray-600">{record.cardStatus} · version {record.cardVersion} · missing {record.issues.map(label).join(', ')}</p>
              </div>
              {onOpenCard && <button type="button" onClick={() => onOpenCard(record.definitionId, null)} className="rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs font-semibold text-indigo-800">Open card to review</button>}
            </article>
          ))}
        </div>
        {mediaQueue && mediaQueue.total > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-600">
            <span>Showing {mediaQueue.offset + 1}–{Math.min(mediaQueue.offset + mediaQueue.items.length, mediaQueue.total)} of {mediaQueue.total}</span>
            <div className="flex gap-2">
              <button type="button" disabled={mediaQueue.offset === 0} onClick={() => setMediaOffset((current) => Math.max(0, current - mediaQueue.limit))} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50">Previous</button>
              <button type="button" disabled={mediaQueue.offset + mediaQueue.items.length >= mediaQueue.total} onClick={() => setMediaOffset((current) => current + mediaQueue.limit)} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Exact-variant biomechanics and stress review</h3>
            <p className="mt-1 text-xs text-gray-500">Review geometry, anatomy roles, equipment roles, task demand, stress, scaling, and composition together. Automated migration never approves these profiles.</p>
          </div>
          <span className="text-xs text-gray-500">{structuredQueue ? `${structuredQueue.totalPending} pending · ${structuredQueue.eligibleForApprovalCount} approval-ready` : 'Loading queue…'}</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <label className="text-xs text-gray-700">Review state
            <select value={structuredStatus} onChange={(event) => { setStructuredStatus(event.target.value as typeof structuredStatus); setStructuredMissingField(''); setStructuredOffset(0) }} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5">
              <option value="pending">All pending</option>
              <option value="suggested">Suggested</option>
              <option value="review">In review</option>
            </select>
          </label>
          <label className="text-xs text-gray-700">Prioritize
            <select value={structuredSort} onChange={(event) => { setStructuredSort(event.target.value as typeof structuredSort); setStructuredOffset(0) }} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5">
              <option value="closest_to_complete">Closest to complete</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </label>
          <label className="text-xs text-gray-700 md:col-span-2">Missing field
            <select value={structuredMissingField} onChange={(event) => { setStructuredMissingField(event.target.value); setStructuredOffset(0) }} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5">
              <option value="">Any missing field</option>
              {(structuredQueue?.missingFieldCounts ?? []).map((entry) => <option key={entry.field} value={entry.field}>{label(entry.field)} ({entry.count})</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 max-h-[38rem] space-y-2 overflow-y-auto pr-1">
          {!structuredQueue && <p className="rounded bg-gray-50 p-3 text-sm text-gray-500">Loading exact-variant profiles…</p>}
          {structuredQueue?.items.length === 0 && <p className="rounded bg-gray-50 p-3 text-sm text-gray-500">No pending exact-variant profiles match this review batch.</p>}
          {structuredQueue?.items.map((record) => {
            const key = `structured:${record.id}`
            const reviewNotes = notes[key] ?? ''
            const profile = record.profile
            return (
              <article key={key} className="rounded border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">{record.subjectName}</p>
                <p className="mt-1 text-xs text-gray-600">
                  planes {profile.movementGeometry.planes?.join(', ') || 'missing'} · anatomy {profile.anatomyProfile.assignments?.length ?? 0} · equipment {profile.equipmentRoles.length} · scaling {profile.scalingHandles.length}
                </p>
                {!record.completeness.complete && <p className="mt-1 text-xs font-medium text-red-700">Cannot approve: {record.completeness.issues.map((issue) => issue.field).join(', ')}</p>}
                {record.validationError && <p className="mt-1 text-xs text-red-700">Invalid controlled value: {record.validationError}</p>}
                <details className="mt-2 rounded bg-gray-50 p-2 text-xs">
                  <summary className="cursor-pointer font-medium">Inspect task, stress, and composition JSON</summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(profile, null, 2)}</pre>
                </details>
                <div className="mt-2 flex flex-col gap-2 md:flex-row">
                  <input aria-label={`Independent review notes for ${record.subjectName}`} minLength={20} value={reviewNotes} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} placeholder="Required independent review evidence (20+ characters)" className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs" />
                  {onOpenCard && <button type="button" onClick={() => onOpenCard(record.definitionId, record.id)} className="inline-flex items-center justify-center rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs font-semibold text-indigo-800">Open exact variant</button>}
                  <button type="button" disabled={!record.completeness.complete || reviewNotes.trim().length < 20 || reviewing === key} onClick={() => void reviewStructured(record, 'approve')} className="inline-flex items-center justify-center gap-1 rounded bg-emerald-700 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><ThumbsUp className="h-3.5 w-3.5" />Approve</button>
                  <button type="button" disabled={reviewNotes.trim().length < 20 || reviewing === key} onClick={() => void reviewStructured(record, 'reject')} className="inline-flex items-center justify-center gap-1 rounded bg-red-700 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><XCircle className="h-3.5 w-3.5" />Reject</button>
                </div>
              </article>
            )
          })}
        </div>
        {structuredQueue && structuredQueue.total > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-600">
            <span>Showing {structuredQueue.offset + 1}–{Math.min(structuredQueue.offset + structuredQueue.items.length, structuredQueue.total)} of {structuredQueue.total}</span>
            <div className="flex gap-2">
              <button type="button" disabled={structuredQueue.offset === 0} onClick={() => setStructuredOffset((current) => Math.max(0, current - structuredQueue.limit))} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50">Previous</button>
              <button type="button" disabled={structuredQueue.offset + structuredQueue.items.length >= structuredQueue.total} onClick={() => setStructuredOffset((current) => current + structuredQueue.limit)} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Independent review queue</h3>
            <p className="mt-1 text-xs text-gray-500">Approval and rejection both require 20+ characters of reviewer evidence. The author cannot approve their own evidence.</p>
          </div>
          <span className="text-xs text-gray-500">Showing {queue.length} highest-confidence records</span>
        </div>
        {queue.length === 0 ? (
          <p className="mt-3 rounded bg-gray-50 p-3 text-sm text-gray-500">No manageable pending records are available for this account.</p>
        ) : (
          <div className="mt-3 max-h-[38rem] space-y-2 overflow-y-auto pr-1">
            {queue.map((record) => {
              const key = `${record.recordType}:${record.id}`
              const reviewNotes = notes[key] ?? ''
              return (
                <article key={key} className="rounded border border-gray-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{record.subjectName}</p>
                      <p className="text-xs text-gray-600">{label(record.subjectScope)} · {label(record.facetType)} · {record.termName ?? label(record.decision ?? '')}</p>
                      {record.rationale && <p className="mt-1 text-xs text-gray-500">NA rationale: {record.rationale}</p>}
                    </div>
                    <span className="rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800">confidence {record.confidence}/100</span>
                  </div>
                  <div className="mt-2 flex flex-col gap-2 md:flex-row">
                    <input
                      aria-label={`Independent taxonomy review notes for ${record.subjectName}`}
                      minLength={20}
                      value={reviewNotes}
                      onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))}
                      placeholder="Required independent review evidence (20+ characters)"
                      className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs"
                    />
                    <button type="button" disabled={reviewNotes.trim().length < 20 || reviewing === key} onClick={() => void review(record, 'approve')} className="inline-flex items-center justify-center gap-1 rounded bg-emerald-700 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><ThumbsUp className="h-3.5 w-3.5" />Approve</button>
                    <button type="button" disabled={reviewNotes.trim().length < 20 || reviewing === key} onClick={() => void review(record, 'reject')} className="inline-flex items-center justify-center gap-1 rounded bg-red-700 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><XCircle className="h-3.5 w-3.5" />Reject</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-3">
          <h3 className="text-sm font-semibold">Legacy mapping disposition</h3>
          <ul className="mt-2 space-y-1 text-sm">{report.legacyMappings.map((row) => <li key={row.mapping_state} className="flex justify-between"><span>{label(row.mapping_state)}</span><span>{row.count}</span></li>)}</ul>
        </section>
        <section className="rounded-lg border border-gray-200 bg-white p-3">
          <h3 className="text-sm font-semibold">Equipment alias disposition</h3>
          <ul className="mt-2 space-y-1 text-sm">{report.equipmentAliases.map((row) => <li key={row.resolution_state} className="flex justify-between"><span>{label(row.resolution_state)}</span><span>{row.count}</span></li>)}</ul>
        </section>
      </div>
    </div>
  )
}
