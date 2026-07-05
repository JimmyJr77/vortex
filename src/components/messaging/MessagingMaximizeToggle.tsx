import { Minimize2, Square } from 'lucide-react'

interface MessagingMaximizeToggleProps {
  maximized: boolean
  onToggle: () => void
}

export default function MessagingMaximizeToggle({ maximized, onToggle }: MessagingMaximizeToggleProps) {
  return (
    <button
      type="button"
      aria-label={maximized ? 'Exit full screen messages' : 'Full screen messages'}
      aria-pressed={maximized}
      onClick={onToggle}
      className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      title={maximized ? 'Exit full screen' : 'Full screen'}
    >
      {maximized ? <Minimize2 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
    </button>
  )
}
