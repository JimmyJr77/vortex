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
  mode?: 'selected' | 'picker'
  onPicked?: () => void
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
  mode = 'selected',
  onPicked,
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
      onPicked?.()
    } catch {
      /* best-effort */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 min-w-0 ${className}`.trim()}>
      {(mode === 'picker' ? QUICK_EMOJI.map((emoji) => ({ emoji, count: reactions.find((reaction) => reaction.emoji === emoji)?.count ?? 0 })) : reactions).map((r) => (
        <button
          key={r.emoji}
          type="button"
          disabled={disabled || busy}
          onClick={() => void toggleReaction(r.emoji)}
          className={mode === 'picker' ? 'inline-flex h-8 w-8 items-center justify-center rounded-full text-base hover:bg-gray-100 disabled:opacity-50' : 'inline-flex items-center gap-0.5 rounded-full bg-white border border-gray-200 px-1.5 py-0.5 text-[11px] shadow-sm hover:bg-gray-50 disabled:opacity-50'}
          aria-label={`${r.count > 0 ? 'Remove' : 'Add'} ${r.emoji} reaction`}
        >
          <span>{r.emoji}</span>
          {mode === 'selected' ? <span className="font-semibold text-gray-600">{r.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
