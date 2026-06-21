import { useEffect, useState } from 'react'
import { Loader2, Sparkles, Send } from 'lucide-react'
import { coachFetch } from '../../coach/api'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

interface CoachAssistantChatProps {
  memberId: number | ''
  athleteName?: string
}

export default function CoachAssistantChat({ memberId, athleteName }: CoachAssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (memberId === '') {
      setMessages([])
      return
    }
    coachFetch<ChatMessage[]>(`/api/coach/ai/assistant/${memberId}/history`)
      .then(setMessages)
      .catch(() => setMessages([]))
  }, [memberId])

  const syncEmbeddings = async () => {
    if (memberId === '') return
    setSyncing(true)
    try {
      await coachFetch(`/api/coach/ai/embeddings/sync/${memberId}`, { method: 'POST' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const send = async () => {
    if (memberId === '' || !input.trim()) return
    setLoading(true)
    setError(null)
    const question = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    try {
      const data = await coachFetch<{ answer: string }>(`/api/coach/ai/assistant/${memberId}`, {
        method: 'POST',
        body: JSON.stringify({ message: question }),
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant failed')
    } finally {
      setLoading(false)
    }
  }

  if (memberId === '') return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-vortex-red" /> Coach assistant
          {athleteName ? <span className="text-gray-500 font-normal">— {athleteName}</span> : null}
        </h3>
        <button
          type="button"
          onClick={() => void syncEmbeddings()}
          disabled={syncing}
          className="text-xs border border-gray-300 px-2 py-1 rounded-lg text-gray-600 disabled:opacity-60"
        >
          {syncing ? 'Syncing…' : 'Sync athlete data'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Ask about training focus, readiness, or progress. Answers use this athlete&apos;s logs, assessments, and wellness data.
      </p>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm mb-3">{error}</div>}
      <div className="space-y-2 max-h-56 overflow-y-auto mb-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-sm text-gray-500">No messages yet. Try: &quot;What should we focus on this week?&quot;</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === 'user' ? 'text-gray-900' : 'text-gray-700'}`}>
            <span className="font-semibold">{m.role === 'user' ? 'You' : 'Assistant'}:</span> {m.content}
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-3 h-3 animate-spin" /> Thinking…</div>}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          placeholder="Ask about this athlete…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          className="bg-black text-white px-3 py-2 rounded-lg disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
