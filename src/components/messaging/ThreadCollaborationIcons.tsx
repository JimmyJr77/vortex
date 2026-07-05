import { ListChecks, Vote } from 'lucide-react'

interface ThreadCollaborationIconsProps {
  hasActionablePoll?: boolean
  hasActionableSignup?: boolean
  onPollIconClick?: () => void
  onSignupIconClick?: () => void
}

export default function ThreadCollaborationIcons({
  hasActionablePoll = false,
  hasActionableSignup = false,
  onPollIconClick,
  onSignupIconClick,
}: ThreadCollaborationIconsProps) {
  if (!hasActionablePoll && !hasActionableSignup) return null

  return (
    <div className="hidden md:flex items-center gap-0.5 shrink-0">
      {hasActionablePoll && onPollIconClick && (
        <button
          type="button"
          aria-label="Open polls"
          onClick={onPollIconClick}
          className="relative p-1.5 rounded-lg text-blue-700 hover:bg-blue-50"
        >
          <Vote className="w-5 h-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue-600" />
        </button>
      )}
      {hasActionableSignup && onSignupIconClick && (
        <button
          type="button"
          aria-label="Open signup lists"
          onClick={onSignupIconClick}
          className="relative p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50"
        >
          <ListChecks className="w-5 h-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-600" />
        </button>
      )}
    </div>
  )
}
