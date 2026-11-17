import { Link2 } from 'lucide-react'
import type { MessageThread } from './types'
import { threadListTitle } from './messagingLayout'

interface MessagingContextBannerProps {
  linkedThread?: MessageThread | null
  linkedThreadId?: number | null
  linkedThreadTitle?: string | null
  onJump?: (threadId: number) => void
}

export default function MessagingContextBanner({
  linkedThread,
  linkedThreadId,
  linkedThreadTitle,
  onJump,
}: MessagingContextBannerProps) {
  const threadId = linkedThread?.id ?? linkedThreadId
  if (threadId == null) return null

  const title =
    linkedThreadTitle?.trim()
    || (linkedThread ? threadListTitle(linkedThread) : null)
    || `Thread #${threadId}`

  return (
    <div className="shrink-0 mx-4 mt-3 mb-1 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2 text-sm">
      <Link2 className="w-4 h-4 text-blue-600 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-blue-700 font-semibold">Linked thread</div>
        <div className="text-gray-800 truncate font-medium">{title}</div>
      </div>
      {onJump && (
        <button
          type="button"
          onClick={() => onJump(threadId)}
          className="shrink-0 text-xs font-semibold text-vortex-red hover:underline"
        >
          Open
        </button>
      )}
    </div>
  )
}
