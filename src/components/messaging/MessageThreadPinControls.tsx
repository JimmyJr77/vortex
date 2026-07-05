import { Pin } from 'lucide-react'
import type { PinFilterMode } from './types'

interface MessageThreadPinControlsProps {
  pinFilter: PinFilterMode
  onPinFilterChange: (mode: 'mine' | 'super') => void
  disabled?: boolean
}

function SuperPinIcon({ active }: { active: boolean }) {
  const color = active ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'
  return (
    <span className="relative inline-flex w-5 h-5" aria-hidden>
      <Pin className={`absolute left-0 top-0 w-3.5 h-3.5 ${color}`} strokeWidth={active ? 0 : 1.75} />
      <Pin className={`absolute right-0 bottom-0 w-3.5 h-3.5 ${color}`} strokeWidth={active ? 0 : 1.75} />
    </span>
  )
}

export default function MessageThreadPinControls({
  pinFilter,
  onPinFilterChange,
  disabled = false,
}: MessageThreadPinControlsProps) {
  return (
    <>
      <button
        type="button"
        aria-label={pinFilter === 'super' ? 'Show all messages' : 'Show everyone\'s pinned messages'}
        aria-pressed={pinFilter === 'super'}
        disabled={disabled}
        onClick={() => onPinFilterChange('super')}
        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-60"
        title="Super pin"
      >
        <SuperPinIcon active={pinFilter === 'super'} />
      </button>
      <button
        type="button"
        aria-label={pinFilter === 'mine' ? 'Show all messages' : 'Show my pinned messages'}
        aria-pressed={pinFilter === 'mine'}
        disabled={disabled}
        onClick={() => onPinFilterChange('mine')}
        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-60"
        title="My pins"
      >
        <Pin
          className={`w-5 h-5 ${pinFilter === 'mine' ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`}
          strokeWidth={pinFilter === 'mine' ? 0 : 1.75}
        />
      </button>
    </>
  )
}
