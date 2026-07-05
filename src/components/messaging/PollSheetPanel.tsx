import { useState } from 'react'
import { voteThreadPoll } from './messagingApi'
import type { MessagePoll, MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface PollSheetPanelProps {
  mode: 'list' | 'create' | 'pick' | 'view'
  polls: MessagePoll[]
  activePoll: MessagePoll | null
  role: MessagingRole
  threadId: number
  fetcher: Fetcher
  onCreate: (payload: { question: string; options: string[]; closes_at?: string | null }) => Promise<unknown>
  onPick: (poll: MessagePoll) => void
  onRefresh: () => Promise<void>
  onClosePoll: (pollId: number, closed: boolean) => Promise<void>
  onIgnorePoll: (pollId: number) => Promise<void>
}

function PollVoteCard({
  poll,
  role,
  threadId,
  fetcher,
  onRefresh,
  onClosePoll,
  onIgnorePoll,
  canStaffClose,
}: {
  poll: MessagePoll
  role: MessagingRole
  threadId: number
  fetcher: Fetcher
  onRefresh: () => Promise<void>
  onClosePoll: (pollId: number, closed: boolean) => Promise<void>
  onIgnorePoll: (pollId: number) => Promise<void>
  canStaffClose: boolean
}) {
  const optionList = Array.isArray(poll.options) ? poll.options : []
  const votes = Array.isArray(poll.votes) ? poll.votes : []
  const counts = optionList.map((_, index) => votes.filter((vote) => Number(vote.option_index) === index).length)
  const total = counts.reduce((sum, count) => sum + count, 0)
  const messageId = Number(poll.message_id)

  const vote = async (index: number) => {
    if (!Number.isFinite(messageId) || poll.is_closed) return
    await voteThreadPoll(role, threadId, messageId, fetcher, index)
    await onRefresh()
  }

  const ignore = async () => {
    if (poll.id == null) return
    await onIgnorePoll(Number(poll.id))
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{poll.question}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {poll.is_closed ? 'Closed' : 'Open'} · {poll.vote_count ?? votes.length} votes
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {poll.actionable && poll.id != null && (
            <button
              type="button"
              onClick={() => void ignore()}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              Ignore
            </button>
          )}
          {canStaffClose && poll.id != null && (
            <button
              type="button"
              onClick={() => void onClosePoll(Number(poll.id), !poll.is_closed)}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900"
            >
              {poll.is_closed ? 'Reopen' : 'Close'}
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {optionList.map((option, index) => {
          const count = counts[index] ?? 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const isMine = poll.my_vote != null && Number(poll.my_vote.option_index) === index
          return (
            <button
              key={index}
              type="button"
              disabled={poll.is_closed}
              onClick={() => void vote(index)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-60 ${
                isMine ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{String(option)}</span>
                <span className="text-xs text-gray-500">{count}{total > 0 ? ` · ${pct}%` : ''}</span>
              </div>
              {total > 0 && (
                <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-blue-500/70" style={{ width: `${pct}%` }} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function PollSheetPanel({
  mode,
  polls,
  activePoll,
  role,
  threadId,
  fetcher,
  onCreate,
  onPick,
  onRefresh,
  onClosePoll,
  onIgnorePoll,
}: PollSheetPanelProps) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [saving, setSaving] = useState(false)
  const canStaffClose = role !== 'member'

  const submit = async () => {
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean)
    if (!question.trim() || cleanOptions.length < 2) return
    setSaving(true)
    try {
      await onCreate({ question: question.trim(), options: cleanOptions })
      setQuestion('')
      setOptions(['', ''])
    } finally {
      setSaving(false)
    }
  }

  if (mode === 'create') {
    return (
      <div className="space-y-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-800">New poll</div>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What should people vote on?"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          {options.map((option, index) => (
            <input
              key={index}
              value={option}
              onChange={(e) => {
                const next = [...options]
                next[index] = e.target.value
                setOptions(next)
              }}
              placeholder={`Option ${index + 1}`}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {options.length < 6 && (
            <button type="button" onClick={() => setOptions([...options, ''])} className="text-xs font-semibold text-vortex-red hover:underline">
              Add option
            </button>
          )}
          <button
            type="button"
            disabled={saving || !question.trim() || options.map((o) => o.trim()).filter(Boolean).length < 2}
            onClick={() => void submit()}
            className="ml-auto rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Create poll
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'pick') {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-800">Respond to poll</div>
        {polls.length === 0 ? (
          <div className="text-sm text-gray-500">No polls have been created in this thread yet.</div>
        ) : (
          polls.map((poll) => (
            <button
              key={poll.id}
              type="button"
              onClick={() => onPick(poll)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <div className="font-semibold text-gray-900">{poll.question}</div>
              <div className="text-xs text-gray-500">{poll.is_closed ? 'Closed' : 'Open'} · {poll.vote_count ?? poll.votes?.length ?? 0} votes</div>
            </button>
          ))
        )}
      </div>
    )
  }

  if (mode === 'list') {
    if (polls.length === 0) {
      return <div className="text-sm text-gray-500">No polls in this thread yet.</div>
    }
    return (
      <div className="space-y-3">
        {polls.map((poll) => (
          <PollVoteCard
            key={poll.id}
            poll={poll}
            role={role}
            threadId={threadId}
            fetcher={fetcher}
            onRefresh={onRefresh}
            onClosePoll={onClosePoll}
            onIgnorePoll={onIgnorePoll}
            canStaffClose={canStaffClose}
          />
        ))}
      </div>
    )
  }

  if (!activePoll) return <div className="text-sm text-gray-500">Choose a poll to respond.</div>

  return (
    <PollVoteCard
      poll={activePoll}
      role={role}
      threadId={threadId}
      fetcher={fetcher}
      onRefresh={onRefresh}
      onClosePoll={onClosePoll}
      onIgnorePoll={onIgnorePoll}
      canStaffClose={canStaffClose}
    />
  )
}
