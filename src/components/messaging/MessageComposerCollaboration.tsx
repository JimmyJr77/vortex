import { ListChecks, Vote } from 'lucide-react'

export type CollaborationMode = 'off' | 'poll' | 'checklist'

export interface CollaborationDraft {
  mode: CollaborationMode
  pollQuestion: string
  pollOptions: string[]
  checklistItems: string
}

export const EMPTY_COLLABORATION_DRAFT: CollaborationDraft = {
  mode: 'off',
  pollQuestion: '',
  pollOptions: ['', ''],
  checklistItems: '',
}

interface MessageComposerCollaborationProps {
  value: CollaborationDraft
  onChange: (value: CollaborationDraft) => void
  disabled?: boolean
}

export default function MessageComposerCollaboration({
  value,
  onChange,
  disabled = false,
}: MessageComposerCollaborationProps) {
  const setMode = (mode: CollaborationMode) => {
    onChange({
      ...value,
      mode: value.mode === mode ? 'off' : mode,
    })
  }

  const updatePollOption = (index: number, text: string) => {
    const next = [...value.pollOptions]
    next[index] = text
    onChange({ ...value, pollOptions: next })
  }

  return (
    <div className="mb-2 shrink-0 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode('poll')}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
            value.mode === 'poll'
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Vote className="w-3.5 h-3.5" />
          Poll
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode('checklist')}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
            value.mode === 'checklist'
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <ListChecks className="w-3.5 h-3.5" />
          Tasks
        </button>
      </div>

      {value.mode === 'poll' && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <input
            value={value.pollQuestion}
            onChange={(e) => onChange({ ...value, pollQuestion: e.target.value })}
            placeholder="Poll question"
            disabled={disabled}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          {value.pollOptions.map((option, index) => (
            <input
              key={index}
              value={option}
              onChange={(e) => updatePollOption(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          ))}
          {value.pollOptions.length < 6 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, pollOptions: [...value.pollOptions, ''] })}
              className="text-xs font-semibold text-vortex-red hover:underline"
            >
              Add option
            </button>
          )}
        </div>
      )}

      {value.mode === 'checklist' && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <textarea
            value={value.checklistItems}
            onChange={(e) => onChange({ ...value, checklistItems: e.target.value })}
            placeholder={'One task per line\n e.g. Bring drinks\nBring plates'}
            disabled={disabled}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
          />
        </div>
      )}
    </div>
  )
}

export function collaborationDraftIsValid(draft: CollaborationDraft): boolean {
  if (draft.mode === 'poll') {
    const options = draft.pollOptions.map((o) => o.trim()).filter(Boolean)
    return draft.pollQuestion.trim().length > 0 && options.length >= 2
  }
  if (draft.mode === 'checklist') {
    return draft.checklistItems
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean).length > 0
  }
  return true
}

export function buildCollaborationPayload(draft: CollaborationDraft) {
  if (draft.mode === 'poll') {
    return {
      type: 'poll' as const,
      question: draft.pollQuestion.trim(),
      options: draft.pollOptions.map((o) => o.trim()).filter(Boolean),
    }
  }
  if (draft.mode === 'checklist') {
    return {
      type: 'checklist' as const,
      items: draft.checklistItems
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ text })),
    }
  }
  return null
}
