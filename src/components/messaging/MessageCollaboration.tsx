import type { MessageChecklist, MessagePoll, MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface MessagePollBlockProps {
  poll: MessagePoll
  messageId: number
  threadId: number
  role: MessagingRole
  fetcher: Fetcher
  viewerMemberId?: number | null
  viewerUserId?: number | null
  onPollUpdated?: (poll: MessagePoll) => void
  onOpenInPanel?: (poll: MessagePoll) => void
}

export function MessagePollBlock({
  poll,
  messageId,
  threadId,
  role,
  fetcher,
  viewerMemberId,
  viewerUserId,
  onPollUpdated,
  onOpenInPanel,
}: MessagePollBlockProps) {
  const options = Array.isArray(poll.options) ? poll.options : []
  const votes = Array.isArray(poll.votes) ? poll.votes : []
  const voteCounts = options.map((_, index) =>
    votes.filter((v) => Number(v.option_index) === index).length,
  )
  const totalVotes = voteCounts.reduce((sum, n) => sum + n, 0)
  const myVote = votes.find(
    (v) =>
      (viewerMemberId != null && Number(v.member_id) === viewerMemberId)
      || (viewerUserId != null && Number(v.user_id) === viewerUserId),
  )

  const castVote = async (optionIndex: number) => {
    const raw = await fetcher(
      `/api/${role}/messages/${threadId}/messages/${messageId}/poll/vote`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option_index: optionIndex }),
      },
    ) as MessagePoll & { options_json?: unknown[] }
    onPollUpdated?.({
      ...raw,
      options: raw.options ?? raw.options_json ?? options,
      votes: raw.votes ?? [],
    })
  }

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-white/80 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-gray-900">{poll.question}</div>
        {onOpenInPanel && (
          <button type="button" onClick={() => onOpenInPanel(poll)} className="shrink-0 text-xs font-semibold text-blue-700 hover:underline">
            Open in panel
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {options.map((option, index) => {
          const count = voteCounts[index] ?? 0
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const selected = myVote != null && Number(myVote.option_index) === index
          return (
            <button
              key={index}
              type="button"
              onClick={() => void castVote(index)}
              className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                selected ? 'border-vortex-red bg-red-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{String(option)}</span>
                <span className="text-xs text-gray-500">{count}{totalVotes > 0 ? ` · ${pct}%` : ''}</span>
              </div>
              {totalVotes > 0 && (
                <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-vortex-red/70" style={{ width: `${pct}%` }} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface MessageChecklistBlockProps {
  checklist: MessageChecklist
  messageId: number
  threadId: number
  role: MessagingRole
  fetcher: Fetcher
  onChecklistUpdated?: (checklist: MessageChecklist) => void
  onOpenInPanel?: (checklist: MessageChecklist) => void
}

export function MessageChecklistBlock({
  checklist,
  messageId,
  threadId,
  role,
  fetcher,
  onChecklistUpdated,
  onOpenInPanel,
}: MessageChecklistBlockProps) {
  const items = Array.isArray(checklist.items) ? checklist.items : []

  const claimItem = async (itemIndex: number) => {
    const updated = await fetcher(
      `/api/${role}/messages/${threadId}/messages/${messageId}/checklist/claim`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_index: itemIndex }),
      },
    ) as { items_json?: unknown[] }
    onChecklistUpdated?.({
      ...checklist,
      items: Array.isArray(updated?.items_json) ? updated.items_json : checklist.items,
    })
  }

  if (items.length === 0) return null

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-white/80 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Signup list</div>
          {checklist.title && <div className="text-sm font-semibold text-gray-900">{checklist.title}</div>}
        </div>
        {onOpenInPanel && (
          <button type="button" onClick={() => onOpenInPanel(checklist)} className="shrink-0 text-xs font-semibold text-emerald-700 hover:underline">
            Open in panel
          </button>
        )}
      </div>
      <ul className="space-y-1.5">
        {items.map((item, index) => {
          const row = item && typeof item === 'object' ? item as Record<string, unknown> : { text: String(item) }
          const text = String(row.text ?? item ?? '')
          const assigned = row.assigned_member_id != null || row.assigned_user_id != null
          const assignedName = String(row.assigned_name || '').trim()
          const assignedPhone = String(row.assigned_phone || '').trim()
          const claimNote = String(row.claim_note || '').trim()
          return (
            <li key={index} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className="text-gray-800">{text}</span>
                {assigned && (
                  <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                    <div className="font-medium text-gray-900">{assignedName || 'Claimed'}</div>
                    {assignedPhone && <div>{assignedPhone}</div>}
                    {claimNote && <div className="italic">{claimNote}</div>}
                  </div>
                )}
              </div>
              {assigned ? (
                <span className="shrink-0 text-xs font-semibold text-emerald-700">Claimed</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void claimItem(index)}
                  className="shrink-0 text-xs font-semibold text-vortex-red hover:underline"
                >
                  I&apos;ll do this
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
