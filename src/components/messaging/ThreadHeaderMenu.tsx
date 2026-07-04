import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, MoreHorizontal, Pencil, UserPlus } from 'lucide-react'
import RecipientPicker from './RecipientPicker'
import type { RecipientOption } from './types'

interface ThreadHeaderMenuProps {
  subject: string | null
  subjectLocked?: boolean
  canLock?: boolean
  canEdit?: boolean
  onUpdateSubject: (update: { subject: string | null; subject_locked?: boolean }) => Promise<void>
  recipientOptions?: RecipientOption[]
  existingParticipantKeys?: string[]
  recipientsLoading?: boolean
  onAddRecipients?: (recipients: RecipientOption[]) => Promise<void>
}

export default function ThreadHeaderMenu({
  subject,
  subjectLocked = false,
  canLock = false,
  canEdit = true,
  onUpdateSubject,
  recipientOptions = [],
  existingParticipantKeys = [],
  recipientsLoading = false,
  onAddRecipients,
}: ThreadHeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [addingRecipients, setAddingRecipients] = useState(false)
  const [draft, setDraft] = useState(subject || '')
  const [pickedRecipients, setPickedRecipients] = useState<RecipientOption[]>([])
  const [saving, setSaving] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const canAddRecipients = Boolean(onAddRecipients)
  const existingKeys = useMemo(() => new Set(existingParticipantKeys), [existingParticipantKeys])
  const availableOptions = useMemo(
    () => recipientOptions.filter((o) => !existingKeys.has(o.key)),
    [recipientOptions, existingKeys],
  )

  useEffect(() => {
    setDraft(subject || '')
  }, [subject])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const saveSubject = async () => {
    setSaving(true)
    try {
      await onUpdateSubject({ subject: draft.trim() || null })
      setEditing(false)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const toggleLock = async () => {
    setSaving(true)
    try {
      await onUpdateSubject({ subject: subject ?? null, subject_locked: !subjectLocked })
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const saveRecipients = async () => {
    if (!onAddRecipients || pickedRecipients.length === 0) return
    setSaving(true)
    try {
      await onAddRecipients(pickedRecipients)
      setPickedRecipients([])
      setAddingRecipients(false)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit && !canLock && !canAddRecipients) return null

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Thread options"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {canEdit && !subjectLocked && (
            <button
              type="button"
              onClick={() => { setEditing(true); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
            >
              <Pencil className="w-4 h-4" /> Edit thread name
            </button>
          )}
          {canEdit && subjectLocked && (
            <div className="px-3 py-2 text-xs text-gray-500">Thread name is locked</div>
          )}
          {canAddRecipients && (
            <button
              type="button"
              onClick={() => { setAddingRecipients(true); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
            >
              <UserPlus className="w-4 h-4" /> Add recipients
            </button>
          )}
          {canLock && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void toggleLock()}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 disabled:opacity-60"
            >
              <Lock className="w-4 h-4" />
              {subjectLocked ? 'Unlock thread name' : 'Lock thread name'}
            </button>
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Edit thread name</h3>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Thread name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveSubject()}
                className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg font-semibold disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {addingRecipients && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Add recipients</h3>
            <RecipientPicker
              options={availableOptions}
              selected={pickedRecipients}
              onChange={setPickedRecipients}
              loading={recipientsLoading}
              placeholder="Search people to add…"
              label="Add to this thread"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setAddingRecipients(false); setPickedRecipients([]) }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || pickedRecipients.length === 0}
                onClick={() => void saveRecipients()}
                className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg font-semibold disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
