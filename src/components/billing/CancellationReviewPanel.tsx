import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Loader2, RefreshCw } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'

interface CancellationRequest {
  id: number
  signup_id: number
  member_name: string | null
  class_name: string
  billing_email: string | null
  request_reason: string | null
  recommended_effective_date: string
  is_fixed_term: boolean
  program_end_date: string | null
  created_at: string
}

export default function CancellationReviewPanel() {
  const [rows, setRows] = useState<CancellationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await adminApiRequest('/api/admin/billing/cancellation-requests?status=pending')
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Failed to load cancellation requests.')
      setRows(body.data ?? [])
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load cancellation requests.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const review = async (row: CancellationRequest, decision: 'approved' | 'declined') => {
    const note = window.prompt(`Required note for ${decision === 'approved' ? 'approving' : 'declining'} this request:`)
    if (!note?.trim()) return
    let effectiveDate: string | null = null
    if (decision === 'approved') {
      effectiveDate = window.prompt('Cancellation effective date:', row.recommended_effective_date.slice(0, 10))
      if (!effectiveDate) return
    }
    setActing(row.id)
    try {
      const response = await adminApiRequest(`/api/admin/billing/cancellation-requests/${row.id}/review`, {
        method: 'POST', body: JSON.stringify({ decision, effectiveDate, reviewNote: note.trim() }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Review failed.')
      await load()
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Review failed.')
    } finally { setActing(null) }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div><h3 className="font-bold text-gray-900">Cancellation review</h3><p className="text-xs text-gray-500">Requests do not change access or billing until Billing approves them.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>
      {error && <p className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!loading && rows.length === 0 && <p className="p-4 text-sm text-gray-500">No cancellation requests await review.</p>}
      <div className="divide-y divide-gray-100">
        {rows.map((row) => <div key={row.id} className="p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold text-gray-900">{row.member_name || 'Family member'} · {row.class_name}</p><p className="text-xs text-gray-500">{row.billing_email || 'No billing email'} · requested {new Date(row.created_at).toLocaleDateString()}</p></div>{row.is_fixed_term && <span className="h-fit rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Fixed-term program · review commitment</span>}</div>
          {row.request_reason && <p className="text-sm text-gray-700">Reason: {row.request_reason}</p>}
          <p className="flex items-center gap-2 text-sm text-gray-600"><CalendarClock className="h-4 w-4" /> Recommended end: {row.recommended_effective_date.slice(0, 10)}{row.program_end_date ? ` · program ends ${row.program_end_date.slice(0, 10)}` : ''}</p>
          <div className="flex gap-2"><button type="button" disabled={acting === row.id} onClick={() => void review(row, 'approved')} className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50">{acting === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve end-of-period'}</button><button type="button" disabled={acting === row.id} onClick={() => void review(row, 'declined')} className="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50">Decline</button></div>
        </div>)}
      </div>
    </section>
  )
}
