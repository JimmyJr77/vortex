import { useCallback, useEffect, useState } from 'react'
import { Loader2, Video, Share2, CheckCircle2 } from 'lucide-react'
import { coachFetch } from '../../coach/api'

interface SubmissionRow {
  id: number
  member_id: number
  first_name?: string | null
  last_name?: string | null
  exercise_id?: number | null
  exercise_name?: string | null
  subject?: string | null
  video_url: string
  status: string
  visibility_scope: string
  duration_seconds?: number | null
  created_at: string
}

interface RubricCriterion {
  id: number
  rubric_id: number
  name: string
  description?: string | null
}

interface Rubric {
  id: number
  name: string
  scale_min: number
  scale_max: number
  criteria: RubricCriterion[]
}

interface ReviewDetail {
  submission: SubmissionRow
  response: { criterion_scores?: Record<string, number>; note?: string | null } | null
  rubrics: Rubric[]
}

export default function FormReviewPanel() {
  const [pending, setPending] = useState<SubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReviewDetail | null>(null)
  const [selectedRubricId, setSelectedRubricId] = useState<number | ''>('')
  const [scores, setScores] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadPending = useCallback(async () => {
    setLoading(true)
    try {
      setPending(await coachFetch<SubmissionRow[]>('/api/coach/form-reviews?status=pending'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  const openSubmission = async (id: number) => {
    setError(null)
    try {
      const data = await coachFetch<ReviewDetail>(`/api/coach/form-reviews/${id}`)
      setDetail(data)
      setSelectedRubricId(data.rubrics[0]?.id ?? '')
      setScores({})
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission')
    }
  }

  const selectedRubric = detail?.rubrics.find((r) => r.id === selectedRubricId)

  const submitReview = async () => {
    if (!detail) return
    setSubmitting(true)
    try {
      const criterion_scores: Record<string, number> = {}
      for (const [k, v] of Object.entries(scores)) {
        if (v !== '') criterion_scores[k] = Number(v)
      }
      await coachFetch(`/api/coach/form-reviews/${detail.submission.id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          rubric_id: selectedRubricId !== '' ? selectedRubricId : null,
          criterion_scores,
          note: note.trim() || null,
        }),
      })
      setDetail(null)
      await loadPending()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const shareCircle = async () => {
    if (!detail) return
    try {
      await coachFetch(`/api/coach/form-reviews/${detail.submission.id}/share-circle`, { method: 'PATCH' })
      setDetail((d) => d ? { ...d, submission: { ...d.submission, visibility_scope: 'coaching_circle' } } : d)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Video className="w-6 h-6 text-vortex-red" /> Form Review
        </h2>
        <p className="text-sm text-gray-500">Review athlete form-check videos and leave rubric feedback.</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading queue...</div>
      ) : pending.length === 0 ? (
        <div className="text-gray-500 text-sm">No pending form videos. Athletes submit from Member portal → Progress.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pending.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => void openSubmission(s.id)}
              className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-vortex-red/40 transition-colors"
            >
              <div className="text-xs text-gray-400">{new Date(s.created_at).toLocaleString()}</div>
              <div className="font-semibold text-gray-900 mt-1">
                {s.first_name} {s.last_name}
              </div>
              <div className="text-sm text-gray-600 mt-0.5">
                {s.exercise_name || s.subject || 'General upload'}
              </div>
              {s.duration_seconds != null && (
                <div className="text-xs text-gray-400 mt-1">{s.duration_seconds}s video</div>
              )}
            </button>
          ))}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-lg">
                  {detail.submission.first_name} {detail.submission.last_name}
                </h3>
                <p className="text-sm text-gray-500">
                  {detail.submission.exercise_name || detail.submission.subject || 'General upload'}
                </p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="text-gray-500 text-sm">Close</button>
            </div>
            <div className="p-5 space-y-4">
              <video src={detail.submission.video_url} controls className="w-full rounded-lg bg-black max-h-64" />

              {detail.submission.visibility_scope !== 'coaching_circle' && (
                <button
                  type="button"
                  onClick={() => void shareCircle()}
                  className="flex items-center gap-2 text-sm text-gray-700 border border-gray-300 px-3 py-2 rounded-lg"
                >
                  <Share2 className="w-4 h-4" /> Share with coaching circle
                </button>
              )}

              {detail.rubrics.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Rubric</label>
                  <select
                    value={selectedRubricId}
                    onChange={(e) => setSelectedRubricId(e.target.value ? Number(e.target.value) : '')}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                  >
                    {detail.rubrics.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedRubric && selectedRubric.criteria.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-700">Scores ({selectedRubric.scale_min}–{selectedRubric.scale_max})</div>
                  {selectedRubric.criteria.map((c) => (
                    <label key={c.id} className="flex items-center justify-between gap-3 text-sm">
                      <span>{c.name}</span>
                      <input
                        type="number"
                        min={selectedRubric.scale_min}
                        max={selectedRubric.scale_max}
                        value={scores[String(c.id)] ?? ''}
                        onChange={(e) => setScores({ ...scores, [String(c.id)]: e.target.value })}
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1"
                      />
                    </label>
                  ))}
                </div>
              )}

              <label className="block text-sm">
                <span className="font-semibold text-gray-700">Coach notes</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="What looked good? What to fix?"
                />
              </label>

              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitReview()}
                className="flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Submit review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
