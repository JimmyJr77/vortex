import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, Trash2 } from 'lucide-react'
import type { MessagingRole, MessageThread } from './types'
import type { ThreadFaqRow } from './MessagingThreadFaq'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface MessagingFaqMasterPanelProps {
  role: Extract<MessagingRole, 'coach' | 'admin'>
  fetcher: Fetcher
  threads?: MessageThread[]
}

const LIBRARY_PATH: Record<MessagingFaqMasterPanelProps['role'], string> = {
  coach: '/api/coach/messages/faq-library',
  admin: '/api/admin/messages/faq-library',
}

export default function MessagingFaqMasterPanel({
  role,
  fetcher,
  threads = [],
}: MessagingFaqMasterPanelProps) {
  const [items, setItems] = useState<ThreadFaqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [threadId, setThreadId] = useState<string>('')
  const [inMasterList, setInMasterList] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editInMasterList, setEditInMasterList] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetcher(LIBRARY_PATH[role]) as ThreadFaqRow[]
      setItems(Array.isArray(rows) ? rows : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [fetcher, role])

  useEffect(() => {
    void load()
  }, [load])

  const q = search.trim().toLowerCase()
  const visibleItems = useMemo(() => {
    if (!q) return items
    return items.filter((item) =>
      item.question.toLowerCase().includes(q)
      || item.answer.toLowerCase().includes(q)
      || (item.thread_subject ?? '').toLowerCase().includes(q),
    )
  }, [items, q])

  const createFaq = async () => {
    if (!question.trim() || !answer.trim()) return
    setSaving(true)
    try {
      await fetcher(LIBRARY_PATH[role], {
        method: 'POST',
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim(),
          thread_id: threadId ? Number(threadId) : null,
          in_master_list: inMasterList,
        }),
      })
      setQuestion('')
      setAnswer('')
      setThreadId('')
      setInMasterList(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async (faqId: number) => {
    if (!editQuestion.trim() || !editAnswer.trim()) return
    setSaving(true)
    try {
      await fetcher(`${LIBRARY_PATH[role]}/${faqId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          question: editQuestion.trim(),
          answer: editAnswer.trim(),
          in_master_list: editInMasterList,
        }),
      })
      setEditingId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const toggleMasterList = async (item: ThreadFaqRow) => {
    try {
      await fetcher(`${LIBRARY_PATH[role]}/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ in_master_list: !item.in_master_list }),
      })
      await load()
    } catch {
      /* best-effort */
    }
  }

  const removeFaq = async (faqId: number) => {
    try {
      await fetcher(`${LIBRARY_PATH[role]}/${faqId}`, { method: 'DELETE' })
      if (editingId === faqId) setEditingId(null)
      await load()
    } catch {
      /* best-effort */
    }
  }

  const startEdit = (item: ThreadFaqRow) => {
    setEditingId(item.id)
    setEditQuestion(item.question)
    setEditAnswer(item.answer)
    setEditInMasterList(Boolean(item.in_master_list))
  }

  return (
    <div className="messaging-panel flex flex-col min-h-0 h-full max-h-full overflow-hidden bg-white">
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="text-sm font-semibold text-gray-900">FAQ library</div>
        <p className="text-xs text-gray-500 mt-0.5">All conversation FAQs. Check “Member FAQs” to publish to the member menu.</p>
      </div>
      <div className="px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all FAQs…"
            aria-label="Search FAQ library"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="messaging-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No FAQ entries yet.</p>
        ) : (
          visibleItems.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-200 p-3 space-y-2">
              {editingId === item.id ? (
                <>
                  <input
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                  />
                  <textarea
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                  />
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={editInMasterList}
                      onChange={(e) => setEditInMasterList(e.target.checked)}
                    />
                    Show in member FAQs menu
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveEdit(item.id)}
                      className="text-xs font-semibold text-vortex-red disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    {item.thread_subject && (
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 truncate">
                        {item.thread_subject}
                      </div>
                    )}
                    <div className="text-sm font-semibold text-gray-900">{item.question}</div>
                    <div className="text-sm text-gray-600 whitespace-pre-wrap">{item.answer}</div>
                    <label className="flex items-center gap-2 text-xs text-gray-700 pt-1">
                      <input
                        type="checkbox"
                        checked={Boolean(item.in_master_list)}
                        onChange={() => void toggleMasterList(item)}
                      />
                      Member FAQs menu
                    </label>
                  </div>
                  <div className="shrink-0 flex flex-col gap-1">
                    <button
                      type="button"
                      aria-label="Delete FAQ"
                      onClick={() => void removeFaq(item.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="text-[10px] font-semibold text-gray-600 hover:text-gray-900 px-1"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="shrink-0 p-3 border-t border-gray-100 space-y-2 bg-gray-50">
        <div className="text-xs font-semibold text-gray-800">New FAQ</div>
        <select
          value={threadId}
          onChange={(e) => setThreadId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          <option value="">No thread (facility-wide)</option>
          {threads.map((thread) => (
            <option key={thread.id} value={thread.id}>
              {thread.subject || `Thread #${thread.id}`}
            </option>
          ))}
        </select>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question"
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
        />
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Answer"
          rows={2}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
        />
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={inMasterList}
            onChange={(e) => setInMasterList(e.target.checked)}
          />
          Show in member FAQs menu
        </label>
        <button
          type="button"
          onClick={() => void createFaq()}
          disabled={saving || !question.trim() || !answer.trim()}
          className="inline-flex items-center gap-1 text-sm font-semibold text-vortex-red disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> Add FAQ
        </button>
      </div>
    </div>
  )
}
