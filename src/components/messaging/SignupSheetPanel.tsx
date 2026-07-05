import { useState } from 'react'
import { claimSignupItem, respondToSignupSheet } from './messagingApi'
import type { MessageChecklist, MessagingRole, SignupResponse, SignupSheetType } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface SignupSheetPanelProps {
  mode: 'create' | 'pick' | 'view'
  signups: MessageChecklist[]
  activeSignup: MessageChecklist | null
  role: MessagingRole
  threadId: number
  fetcher: Fetcher
  onCreate: (payload: {
    title: string
    sheet_type: SignupSheetType
    items?: { text: string }[]
    config?: Record<string, unknown>
    closes_at?: string | null
  }) => Promise<unknown>
  onPick: (signup: MessageChecklist) => void
  onRefresh: () => Promise<void>
  onCloseSignup: (signupId: number, closed: boolean) => Promise<void>
}

function itemText(item: unknown): string {
  if (item && typeof item === 'object') return String((item as Record<string, unknown>).text || '')
  return String(item || '')
}

function isClaimed(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const row = item as Record<string, unknown>
  return row.assigned_member_id != null || row.assigned_user_id != null
}

function responseLabel(response: SignupResponse): string {
  const value = response.response && typeof response.response === 'object'
    ? String((response.response as Record<string, unknown>).status || '')
    : ''
  if (value === 'yes') return 'Yes'
  if (value === 'no') return 'No'
  if (value === 'maybe') return 'Maybe'
  return 'Responded'
}

export default function SignupSheetPanel({
  mode,
  signups,
  activeSignup,
  role,
  threadId,
  fetcher,
  onCreate,
  onPick,
  onRefresh,
  onCloseSignup,
}: SignupSheetPanelProps) {
  const [title, setTitle] = useState('')
  const [sheetType, setSheetType] = useState<SignupSheetType>('rsvp')
  const [itemsText, setItemsText] = useState('')
  const [rsvp, setRsvp] = useState<'yes' | 'no' | 'maybe'>('yes')
  const [guestCount, setGuestCount] = useState(1)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    const items = itemsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ text }))
    if (!title.trim()) return
    if (sheetType !== 'rsvp' && items.length === 0) return
    setSaving(true)
    try {
      await onCreate({
        title: title.trim(),
        sheet_type: sheetType,
        items,
        config: { allow_notes: true, allow_guest_count: sheetType === 'rsvp' },
      })
      setTitle('')
      setItemsText('')
      setSheetType('rsvp')
    } finally {
      setSaving(false)
    }
  }

  if (mode === 'create') {
    return (
      <div className="space-y-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">New signup list</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Signup list title"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ['rsvp', 'RSVP'],
            ['items', 'Bring items'],
            ['support', 'Event support'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSheetType(value as SignupSheetType)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                sheetType === value ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {sheetType !== 'rsvp' && (
          <textarea
            value={itemsText}
            onChange={(e) => setItemsText(e.target.value)}
            rows={5}
            placeholder={sheetType === 'items' ? 'One item per line, e.g. Drinks' : 'One support slot per line, e.g. Setup tables'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
          />
        )}
        <button
          type="button"
          disabled={saving || !title.trim() || (sheetType !== 'rsvp' && !itemsText.trim())}
          onClick={() => void create()}
          className="ml-auto flex rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Create signup list
        </button>
      </div>
    )
  }

  if (mode === 'pick') {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Signup now</div>
        {signups.length === 0 ? (
          <div className="text-sm text-gray-500">No signup lists have been created in this thread yet.</div>
        ) : (
          signups.map((signup) => (
            <button
              key={signup.id}
              type="button"
              onClick={() => onPick(signup)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <div className="font-semibold text-gray-900">{signup.title || 'Signup list'}</div>
              <div className="text-xs text-gray-500">{signup.is_closed ? 'Closed' : 'Open'} · {signup.response_count ?? signup.responses?.length ?? 0} responses</div>
            </button>
          ))
        )}
      </div>
    )
  }

  if (!activeSignup) return <div className="text-sm text-gray-500">Choose a signup list.</div>

  const type = (activeSignup.sheet_type || 'items') as SignupSheetType
  const items = Array.isArray(activeSignup.items) ? activeSignup.items : []
  const responses = Array.isArray(activeSignup.responses) ? activeSignup.responses : []
  const messageId = Number(activeSignup.message_id)

  const submitRsvp = async () => {
    if (!Number.isFinite(messageId) || activeSignup.is_closed) return
    await respondToSignupSheet(role, threadId, messageId, fetcher, {
      status: rsvp,
      guest_count: Math.max(0, Number(guestCount) || 0),
      notes: notes.trim(),
    })
    await onRefresh()
  }

  const claim = async (index: number) => {
    if (!Number.isFinite(messageId) || activeSignup.is_closed) return
    await claimSignupItem(role, threadId, messageId, fetcher, index)
    await onRefresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Signup list</div>
          <div className="text-sm font-semibold text-gray-900">{activeSignup.title || 'Signup list'}</div>
          <div className="text-xs text-gray-500">
            {type === 'rsvp' ? 'RSVP' : type === 'support' ? 'Event support' : 'Bring items'}
          </div>
        </div>
        {activeSignup.id != null && (
          <button
            type="button"
            onClick={() => void onCloseSignup(Number(activeSignup.id), !activeSignup.is_closed)}
            className="shrink-0 text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            {activeSignup.is_closed ? 'Reopen' : 'Close'}
          </button>
        )}
      </div>
      {type === 'rsvp' ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ['yes', 'Yes'],
              ['maybe', 'Maybe'],
              ['no', 'No'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRsvp(value as 'yes' | 'no' | 'maybe')}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  rsvp === value ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <input
              type="number"
              min={0}
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              aria-label="How many people"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={activeSignup.is_closed}
            onClick={() => void submitRsvp()}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Save RSVP
          </button>
          {responses.length > 0 && (
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
              {responses.map((response, index) => (
                <div key={index} className="px-3 py-2 text-sm flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-800">{responseLabel(response)}</span>
                  <span className="text-xs text-gray-500">
                    {String((response.response as Record<string, unknown> | undefined)?.guest_count ?? '')}
                    {(response.response as Record<string, unknown> | undefined)?.notes ? ` · ${(response.response as Record<string, unknown>).notes}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li key={index} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <span className="text-gray-800">{itemText(item)}</span>
              {isClaimed(item) ? (
                <span className="shrink-0 text-xs text-gray-500">Claimed</span>
              ) : (
                <button
                  type="button"
                  disabled={activeSignup.is_closed}
                  onClick={() => void claim(index)}
                  className="shrink-0 text-xs font-semibold text-vortex-red hover:underline disabled:opacity-50"
                >
                  {type === 'support' ? 'I’ll help' : 'I’ll bring this'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
