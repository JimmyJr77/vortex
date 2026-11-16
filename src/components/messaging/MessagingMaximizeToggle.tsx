import { Maximize2, Minimize2 } from 'lucide-react'

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
      className="grid size-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      title={maximized ? 'Exit full screen' : 'Full screen'}
    >
      {maximized ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
    </button>
  )
}
