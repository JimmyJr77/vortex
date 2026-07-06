import { useState } from 'react'
import { Loader2, Send, Sparkles } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_PROMPTS = [
  'Where does contrast training belong in a session?',
  'What is the difference between a tenet and a methodology?',
  'When should I use a 90-minute tumbling-first model?',
]

export default function PhilosophyAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = (text?: string) => {
    const question = (text ?? input).trim()
    if (!question || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setLoading(true)
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Philosophy assistant is coming soon. You will be able to ask questions about session phases, tenets, methodologies, order slots, and validation rules — grounded in the Athleticism Accelerator taxonomy.',
        },
      ])
      setLoading(false)
    }, 600)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-vortex-red" />
          Ask about the philosophy
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Get answers about taxonomy, session design, and programming rules. AI integration coming soon.
        </p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => send(prompt)}
                className="text-left text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div className="space-y-3 max-h-52 overflow-y-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-3 py-2 ${
                  m.role === 'user'
                    ? 'bg-gray-900 text-white ml-8'
                    : 'bg-gray-50 text-gray-700 mr-8 border border-gray-100'
                }`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Thinking…
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Ask about phases, tenets, order slots…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-vortex-red/20 focus:border-vortex-red"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="bg-vortex-red text-white px-3.5 py-2.5 rounded-lg disabled:opacity-50 hover:bg-red-700 transition-colors"
            aria-label="Send question"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

}
