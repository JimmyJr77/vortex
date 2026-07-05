import { useEffect, useRef } from 'react'
import PollSheetPanel from './PollSheetPanel'
import type { ThreadCollaborationPanelMode } from './useThreadCollaboration'
import type { MessagePoll, MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface MessagingThreadPollsPanelProps {
  mode: Exclude<ThreadCollaborationPanelMode, null | 'list-signup' | 'create-signup' | 'pick-signup' | 'view-signup'>
  polls: MessagePoll[]
  activePoll: MessagePoll | null
  role: MessagingRole
  threadId: number
  fetcher: Fetcher
  loading?: boolean
  error?: string | null
  scrollToLatest?: boolean
  onScrollToLatestDone?: () => void
  onCreatePoll: (payload: { question: string; options: string[]; closes_at?: string | null }) => Promise<unknown>
  onPickPoll: (poll: MessagePoll) => void
  onRefresh: () => Promise<void>
  onClosePoll: (pollId: number, closed: boolean) => Promise<void>
  onIgnorePoll: (pollId: number) => Promise<void>
}

function panelModeToSheetMode(mode: MessagingThreadPollsPanelProps['mode']): 'list' | 'create' | 'pick' | 'view' {
  if (mode === 'create-poll') return 'create'
  if (mode === 'pick-poll') return 'pick'
  if (mode === 'view-poll') return 'view'
  return 'list'
}

export default function MessagingThreadPollsPanel({
  mode,
  polls,
  activePoll,
  role,
  threadId,
  fetcher,
  loading = false,
  error = null,
  scrollToLatest = false,
  onScrollToLatestDone,
  onCreatePoll,
  onPickPoll,
  onRefresh,
  onClosePoll,
  onIgnorePoll,
}: MessagingThreadPollsPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollToLatest) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    onScrollToLatestDone?.()
  }, [onScrollToLatestDone, polls, scrollToLatest])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
      <div className="max-w-2xl mx-auto space-y-3">
        <div>
          <div className="text-lg font-semibold text-gray-900">Polls</div>
          {loading && <div className="text-xs text-gray-500 mt-1">Refreshing…</div>}
          {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
        </div>
        <PollSheetPanel
          mode={panelModeToSheetMode(mode)}
          polls={polls}
          activePoll={activePoll}
          role={role}
          threadId={threadId}
          fetcher={fetcher}
          onCreate={onCreatePoll}
          onPick={onPickPoll}
          onRefresh={onRefresh}
          onClosePoll={onClosePoll}
          onIgnorePoll={onIgnorePoll}
        />
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
