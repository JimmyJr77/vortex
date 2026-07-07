import { useEffect, useRef } from 'react'
import SignupSheetPanel from './SignupSheetPanel'
import { scrollToEndWithinContainer } from './scrollMessagingContainer'
import type { ThreadCollaborationPanelMode } from './useThreadCollaboration'
import type { MessageChecklist, MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface MessagingThreadSignupsPanelProps {
  mode: Exclude<ThreadCollaborationPanelMode, null | 'list-poll' | 'create-poll' | 'pick-poll' | 'view-poll'>
  signups: MessageChecklist[]
  activeSignup: MessageChecklist | null
  role: MessagingRole
  threadId: number
  fetcher: Fetcher
  viewerUserId?: number | null
  viewerMemberId?: number | null
  loading?: boolean
  error?: string | null
  scrollToLatest?: boolean
  onScrollToLatestDone?: () => void
  onCreateSignup: (payload: {
    title: string
    sheet_type: 'rsvp' | 'items' | 'support'
    event_date: string
    items?: { text: string }[]
    config?: Record<string, unknown>
    closes_at?: string | null
  }) => Promise<unknown>
  onPickSignup: (signup: MessageChecklist) => void
  onRefresh: () => Promise<void>
  onCloseSignup: (signupId: number, closed: boolean) => Promise<void>
  onIgnoreSignup: (signupId: number) => Promise<void>
}

function panelModeToSheetMode(mode: MessagingThreadSignupsPanelProps['mode']): 'list' | 'create' | 'pick' | 'view' {
  if (mode === 'create-signup') return 'create'
  if (mode === 'pick-signup') return 'pick'
  if (mode === 'view-signup') return 'view'
  return 'list'
}

export default function MessagingThreadSignupsPanel({
  mode,
  signups,
  activeSignup,
  role,
  threadId,
  fetcher,
  viewerUserId = null,
  viewerMemberId = null,
  loading = false,
  error = null,
  scrollToLatest = false,
  onScrollToLatestDone,
  onCreateSignup,
  onPickSignup,
  onRefresh,
  onCloseSignup,
  onIgnoreSignup,
}: MessagingThreadSignupsPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollToLatest) return
    scrollToEndWithinContainer(bottomRef.current)
    onScrollToLatestDone?.()
  }, [onScrollToLatestDone, scrollToLatest, signups])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
      <div className="max-w-2xl mx-auto space-y-3">
        <div>
          <div className="text-lg font-semibold text-gray-900">Signup lists</div>
          {loading && <div className="text-xs text-gray-500 mt-1">Refreshing…</div>}
          {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
        </div>
        <SignupSheetPanel
          mode={panelModeToSheetMode(mode)}
          signups={signups}
          activeSignup={activeSignup}
          role={role}
          threadId={threadId}
          fetcher={fetcher}
          viewerUserId={viewerUserId}
          viewerMemberId={viewerMemberId}
          onCreate={onCreateSignup}
          onPick={onPickSignup}
          onRefresh={onRefresh}
          onCloseSignup={onCloseSignup}
          onIgnoreSignup={onIgnoreSignup}
        />
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
