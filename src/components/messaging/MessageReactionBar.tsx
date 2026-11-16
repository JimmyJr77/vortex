import { useId } from 'react'
import type { MessageReactionGroup } from './types'

interface MessageReactionBarProps {
  reactions: MessageReactionGroup[]
  onToggle: (reaction: MessageReactionGroup, trigger: HTMLButtonElement) => void
  disabled?: boolean
  className?: string
  mode?: 'selected' | 'picker'
}

const QUICK_REACTIONS = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😂', label: 'Laughing' },
  { emoji: '🎉', label: 'Celebration' },
  { emoji: '👀', label: 'Eyes' },
]

export default function MessageReactionBar({
  reactions,
  onToggle,
  disabled = false,
  className = '',
  mode = 'selected',
}: MessageReactionBarProps) {
  const id = useId()
  const visible: MessageReactionGroup[] = mode === 'picker'
    ? QUICK_REACTIONS.map(({ emoji }) => reactions.find((reaction) => reaction.emoji === emoji) ?? { emoji, count: 0 })
    : reactions

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-1 ${className}`.trim()}>
      {visible.map((reaction, index) => {
        const label = QUICK_REACTIONS.find(({ emoji }) => emoji === reaction.emoji)?.label ?? reaction.emoji
        const pressed = reaction.reacted_by_viewer === true
        const countId = `${id}-${index}`

        return (
          <button
            key={reaction.emoji}
            type="button"
            disabled={disabled}
            onClick={(event) => onToggle(reaction, event.currentTarget)}
            className={
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vortex-red disabled:opacity-50 aria-pressed:bg-red-100 '
              + (mode === 'picker'
                ? 'grid h-8 w-8 place-items-center rounded-lg text-base hover:bg-slate-100 aria-pressed:ring-1 aria-pressed:ring-inset aria-pressed:ring-red-300'
                : 'inline-flex h-7 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 text-xs hover:border-slate-300 hover:bg-slate-50 aria-pressed:border-red-300')
            }
            aria-label={`${label} reaction`}
            aria-pressed={pressed}
            aria-describedby={reaction.count > 0 ? countId : undefined}
            title={`${pressed ? 'Remove your' : 'Add'} ${label.toLowerCase()} reaction`}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            {mode === 'selected' && <span aria-hidden="true" className="font-semibold text-slate-600">{reaction.count}</span>}
            {reaction.count > 0 && (
              <span id={countId} className="sr-only">{reaction.count} {reaction.count === 1 ? 'reaction' : 'reactions'}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
