import { ClipboardList, Vote } from 'lucide-react'
import type { MessageChecklist, MessagePoll } from './types'

interface ThreadCollaborationChipsProps {
  polls: MessagePoll[]
  signups: MessageChecklist[]
  activePollId?: number | null
  activeSignupId?: number | null
  onPollClick: (poll: MessagePoll) => void
  onSignupClick: (signup: MessageChecklist) => void
}

function label(text: unknown, fallback: string) {
  const value = String(text || '').trim()
  return value || fallback
}

export default function ThreadCollaborationChips({
  polls,
  signups,
  activePollId,
  activeSignupId,
  onPollClick,
  onSignupClick,
}: ThreadCollaborationChipsProps) {
  const openPolls = polls.filter((poll) => !poll.is_closed)
  const openSignups = signups.filter((signup) => !signup.is_closed)
  if (openPolls.length === 0 && openSignups.length === 0) return null

  return (
    <div className="hidden md:flex items-center gap-1 min-w-0">
      {openPolls.slice(0, 2).map((poll) => (
        <button
          key={`poll-${poll.id}`}
          type="button"
          onClick={() => onPollClick(poll)}
          className={`inline-flex max-w-[150px] items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${
            activePollId === poll.id
              ? 'border-blue-700 bg-blue-100 text-blue-900 ring-1 ring-blue-700'
              : 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
          }`}
        >
          <Vote className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{label(poll.question, 'Poll')}</span>
        </button>
      ))}
      {openSignups.slice(0, 2).map((signup) => (
        <button
          key={`signup-${signup.id}`}
          type="button"
          onClick={() => onSignupClick(signup)}
          className={`inline-flex max-w-[150px] items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${
            activeSignupId === signup.id
              ? 'border-emerald-700 bg-emerald-100 text-emerald-900 ring-1 ring-emerald-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{label(signup.title, 'Signup list')}</span>
        </button>
      ))}
    </div>
  )
}
