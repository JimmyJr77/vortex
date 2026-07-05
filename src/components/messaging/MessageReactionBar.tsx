import { useState } from 'react'
import type { MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

export interface MessageReactionGroup {
  emoji: string
  count: number
}

interface MessageReactionBarProps {
  role: MessagingRole
  threadId: number
  messageId: number
  fetcher: Fetcher
  reactions?: MessageReactionGroup[]
  onUpdated?: (reactions: MessageReactionGroup[]) => void
  disabled?: boolean
  className?: string
}

const QUICK_EMOJI = ['👍', '❤️', '😂', '🎉', '👀']

const REACTION_PATH: Record<MessagingRole, (threadId: number, messageId: number) => string> = {
  coach: (t, m) => `/api/coach/messages/${t}/messages/${m}/reactions`,
  member: (t, m) => `/api/member/messages/${t}/messages/${m}/reactions`,
  admin: (t, m) => `/api/admin/messages/${t}/messages/${m}/reactions`,
}

export default function MessageReactionBar({
  role,
  threadId,
  messageId,
  fetcher,
  reactions = [],
  onUpdated,
  disabled = false,
  className = '',
}: MessageReactionBarProps) {
  const [busy, setBusy] = useState(false)

  const toggleReaction = async (emoji: string) => {
    if (disabled || busy) return
    setBusy(true)
    try {
      const existing = reactions.find((r) => r.emoji === emoji)
      if (existing && existing.count > 0) {
        const encoded = encodeURIComponent(emoji)
        const updated = await fetcher(
          `${REACTION_PATH[role](threadId, messageId)}/${encoded}`,
          { method: 'DELETE' },
        ) as MessageReactionGroup[]
        onUpdated?.(updated)
      } else {
        const updated = await fetcher(REACTION_PATH[role](threadId, messageId), {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        }) as MessageReactionGroup[]
        onUpdated?.(updated)
      }
    } catch {
      /* best-effort */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 min-w-0 ${className}`.trim()}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          disabled={disabled || busy}
          onClick={() => void toggleReaction(r.emoji)}
          className="inline-flex items-center gap-0.5 rounded-full bg-white/80 border border-gray-200 px-1.5 py-0.5 text-[11px] hover:bg-gray-50 disabled:opacity-50"
        >
          <span>{r.emoji}</span>
          <span className="font-semibold text-gray-600">{r.count}</span>
        </button>
      ))}
      {!disabled && QUICK_EMOJI.filter((e) => !reactions.some((r) => r.emoji === e)).map((emoji) => (
        <button
          key={emoji}
          type="button"
          disabled={busy}
          onClick={() => void toggleReaction(emoji)}
          className="rounded-full px-1 py-0.5 text-[11px] opacity-50 hover:opacity-100 hover:bg-white/60 disabled:opacity-30"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
