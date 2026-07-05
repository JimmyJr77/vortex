import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Search, Trash2 } from 'lucide-react'
import type { MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

export interface ThreadFaqRow {
  id: number
  question: string
  answer: string
  sort_order?: number
}

export interface ThreadFaqDraft {
  question: string
  answer: string
}

interface MessagingThreadFaqProps {
  role: MessagingRole
  threadId: number
  fetcher: Fetcher
  canEdit?: boolean
  variant?: 'inline' | 'panel'
  initialDraft?: ThreadFaqDraft | null
  onSaved?: () => void
}

const FAQ_PATH: Record<MessagingRole, (threadId: number) => string> = {
  coach: (id) => `/api/coach/messages/${id}/faq`,
  member: (id) => `/api/member/messages/${id}/faq`,
  admin: (id) => `/api/admin/messages/${id}/faq`,
}

export default function MessagingThreadFaq({
  role,
  threadId,
  fetcher,
  canEdit = false,
  variant = 'inline',
  initialDraft = null,
  onSaved,
}: MessagingThreadFaqProps) {
  const [items, setItems] = useState<ThreadFaqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetcher(FAQ_PATH[role](threadId)) as ThreadFaqRow[]
      setItems(Array.isArray(rows) ? rows : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [fetcher, role, threadId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!initialDraft) return
    setQuestion(initialDraft.question)
    setAnswer(initialDraft.answer)
  }, [initialDraft])

  const addFaq = async () => {
    if (!question.trim() || !answer.trim()) return
    setSaving(true)
    try {
      await fetcher(FAQ_PATH[role](threadId), {
        method: 'POST',
        body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
      })
      setQuestion('')
      setAnswer('')
      await load()
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const removeFaq = async (faqId: number) => {
    try {
      await fetcher(`${FAQ_PATH[role](threadId)}/${faqId}`, { method: 'DELETE' })
      await load()
    } catch {
      /* best-effort */
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading FAQ…
      </div>
    )
  }

  if (items.length === 0 && !canEdit) return null

  const q = search.trim().toLowerCase()
  const visibleItems = q
    ? items.filter((item) =>
      item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q),
    )
    : items
  const rootClass =
    variant === 'panel'
      ? 'h-full bg-white flex flex-col min-h-0'
      : 'mx-4 my-3 rounded-lg border border-gray-200 bg-white p-3 space-y-2'

  const showSearch = variant === 'panel' || items.length > 0

  return (
    <div className={rootClass}>
      <div className={variant === 'panel' ? 'shrink-0 px-4 py-3 border-b border-gray-100 space-y-2' : 'space-y-2'}>
        <div className={variant === 'panel' ? 'text-sm font-semibold text-gray-900' : 'text-xs font-semibold text-gray-800'}>
          Thread FAQ
        </div>
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FAQ…"
              aria-label="Search FAQ"
              className={`w-full border border-gray-300 rounded-lg pl-9 pr-3 text-sm ${
                variant === 'panel' ? 'py-2' : 'py-1.5 text-xs'
              }`}
            />
          </div>
        )}
      </div>
      <div className={variant === 'panel' ? 'flex-1 min-h-0 overflow-y-auto p-4 space-y-3' : 'space-y-2'}>
        {items.length === 0 ? (
          <p className="text-[11px] text-gray-500">No FAQ entries yet.</p>
        ) : visibleItems.length === 0 ? (
          <p className="text-[11px] text-gray-500">No FAQ entries match your search.</p>
        ) : (
          <ul className="space-y-2">
            {visibleItems.map((item) => (
              <li key={item.id} className="text-xs border-b border-gray-100 pb-2 last:border-0">
                <div className="font-semibold text-gray-900">{item.question}</div>
                <div className="text-gray-600 mt-0.5 whitespace-pre-wrap">{item.answer}</div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void removeFaq(item.id)}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-red-600 hover:underline"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {canEdit && (
        <div className={`${variant === 'panel' ? 'shrink-0 p-4 border-t border-gray-100' : 'space-y-1.5 pt-1 border-t border-gray-100'} space-y-1.5`}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Question"
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs"
          />
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer"
            rows={2}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => void addFaq()}
            disabled={saving || !question.trim() || !answer.trim()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-vortex-red disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> Add to FAQ
          </button>
        </div>
      )}
    </div>
  )
}
