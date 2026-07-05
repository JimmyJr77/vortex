import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type { ThreadFaqRow } from './MessagingThreadFaq'

export default function MemberMasterFaqsPanel() {
  const [items, setItems] = useState<ThreadFaqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await coachFetch<ThreadFaqRow[]>('/api/member/faqs')
      setItems(Array.isArray(rows) ? rows : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const q = search.trim().toLowerCase()
  const visibleItems = useMemo(() => {
    if (!q) return items
    return items.filter((item) =>
      item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q),
    )
  }, [items, q])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">FAQs</h2>
        <p className="text-sm text-gray-500 mt-1">Answers curated by your coaches and staff.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search FAQs…"
          aria-label="Search FAQs"
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm bg-white"
        />
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 p-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading FAQs…
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="text-sm text-gray-500 p-6">
            {items.length === 0 ? 'No FAQs have been published yet.' : 'No FAQs match your search.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visibleItems.map((item) => (
              <li key={item.id} className="p-4">
                <div className="text-sm font-semibold text-gray-900">{item.question}</div>
                <div className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{item.answer}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
