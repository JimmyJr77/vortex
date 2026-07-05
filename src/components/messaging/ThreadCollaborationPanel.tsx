import { X } from 'lucide-react'
import PollSheetPanel from './PollSheetPanel'
import SignupSheetPanel from './SignupSheetPanel'
import type { ThreadCollaborationPanelMode } from './useThreadCollaboration'
import type { MessageChecklist, MessagePoll, MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface ThreadCollaborationPanelProps {
  mode: ThreadCollaborationPanelMode
  polls: MessagePoll[]
  signups: MessageChecklist[]
  activePoll: MessagePoll | null
  activeSignup: MessageChecklist | null
  role: MessagingRole
  threadId: number
  fetcher: Fetcher
  loading?: boolean
  error?: string | null
  onDismiss: () => void
  onCreatePoll: (payload: { question: string; options: string[]; closes_at?: string | null }) => Promise<unknown>
  onCreateSignup: (payload: {
    title: string
    sheet_type: 'rsvp' | 'items' | 'support'
    items?: { text: string }[]
    config?: Record<string, unknown>
    closes_at?: string | null
  }) => Promise<unknown>
  onPickPoll: (poll: MessagePoll) => void
  onPickSignup: (signup: MessageChecklist) => void
  onRefresh: () => Promise<void>
  onClosePoll: (pollId: number, closed: boolean) => Promise<void>
  onCloseSignup: (signupId: number, closed: boolean) => Promise<void>
}

export default function ThreadCollaborationPanel({
  mode,
  polls,
  signups,
  activePoll,
  activeSignup,
  role,
  threadId,
  fetcher,
  loading = false,
  error = null,
  onDismiss,
  onCreatePoll,
  onCreateSignup,
  onPickPoll,
  onPickSignup,
  onRefresh,
  onClosePoll,
  onCloseSignup,
}: ThreadCollaborationPanelProps) {
  if (!mode) return null

  const isPollMode = mode === 'create-poll' || mode === 'pick-poll' || mode === 'view-poll'
  const title = isPollMode ? 'Polls' : 'Signup lists'

  return (
    <div className="shrink-0 mx-4 mt-3 mb-1 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-3 py-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          {loading && <div className="text-xs text-gray-500">Refreshing…</div>}
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
        <button
          type="button"
          aria-label={`Close ${title}`}
          onClick={onDismiss}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3">
        {isPollMode ? (
          <PollSheetPanel
            mode={mode === 'create-poll' ? 'create' : mode === 'pick-poll' ? 'pick' : 'view'}
            polls={polls}
            activePoll={activePoll}
            role={role}
            threadId={threadId}
            fetcher={fetcher}
            onCreate={onCreatePoll}
            onPick={onPickPoll}
            onRefresh={onRefresh}
            onClosePoll={onClosePoll}
          />
        ) : (
          <SignupSheetPanel
            mode={mode === 'create-signup' ? 'create' : mode === 'pick-signup' ? 'pick' : 'view'}
            signups={signups}
            activeSignup={activeSignup}
            role={role}
            threadId={threadId}
            fetcher={fetcher}
            onCreate={onCreateSignup}
            onPick={onPickSignup}
            onRefresh={onRefresh}
            onCloseSignup={onCloseSignup}
          />
        )}
      </div>
    </div>
  )
}
