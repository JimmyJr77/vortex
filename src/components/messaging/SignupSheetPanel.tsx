import { useState } from 'react'
import { claimSignupItem, respondToSignupSheet, unclaimSignupItem } from './messagingApi'
import type { MessageChecklist, MessagingRole, SignupResponse, SignupSheetType } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface SignupSheetPanelProps {
  mode: 'list' | 'create' | 'pick' | 'view'
  signups: MessageChecklist[]
  activeSignup: MessageChecklist | null
  role: MessagingRole
  threadId: number
  fetcher: Fetcher
  viewerUserId?: number | null
  viewerMemberId?: number | null
  onCreate: (payload: {
    title: string
    sheet_type: SignupSheetType
    event_date: string
    items?: { text: string }[]
    config?: Record<string, unknown>
    closes_at?: string | null
  }) => Promise<unknown>
  onPick: (signup: MessageChecklist) => void
  onRefresh: () => Promise<void>
  onCloseSignup: (signupId: number, closed: boolean) => Promise<void>
  onIgnoreSignup: (signupId: number) => Promise<void>
}

interface ItemRow {
  id: string
  text: string
}

function itemText(item: unknown): string {
  if (item && typeof item === 'object') return String((item as Record<string, unknown>).text || '')
  return String(item || '')
}

function itemClaimNote(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  return String((item as Record<string, unknown>).claim_note || '').trim()
}

function itemAssignedName(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  return String((item as Record<string, unknown>).assigned_name || '').trim()
}

function itemAssignedPhone(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  return String((item as Record<string, unknown>).assigned_phone || '').trim()
}

function responseNotes(response: SignupResponse): string {
  const value = response.response && typeof response.response === 'object'
    ? String((response.response as Record<string, unknown>).notes || '').trim()
    : ''
  return value
}

function responseGuestCount(response: SignupResponse): number | null {
  if (!response.response || typeof response.response !== 'object') return null
  const raw = (response.response as Record<string, unknown>).guest_count
  if (raw == null || raw === '') return null
  const count = Number(raw)
  return Number.isFinite(count) ? count : null
}

function isClaimed(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const row = item as Record<string, unknown>
  return row.assigned_member_id != null || row.assigned_user_id != null
}

function isClaimedByViewer(
  item: unknown,
  viewerUserId?: number | null,
  viewerMemberId?: number | null,
): boolean {
  if (!item || typeof item !== 'object') return false
  const row = item as Record<string, unknown>
  if (viewerUserId != null && Number(row.assigned_user_id) === Number(viewerUserId)) return true
  if (viewerMemberId != null && Number(row.assigned_member_id) === Number(viewerMemberId)) return true
  return false
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

function SignupParticipateCard({
  signup,
  role,
  threadId,
  fetcher,
  viewerUserId,
  viewerMemberId,
  onRefresh,
  onCloseSignup,
  onIgnoreSignup,
  canStaffClose,
}: {
  signup: MessageChecklist
  role: MessagingRole
  threadId: number
  fetcher: Fetcher
  viewerUserId?: number | null
  viewerMemberId?: number | null
  onRefresh: () => Promise<void>
  onCloseSignup: (signupId: number, closed: boolean) => Promise<void>
  onIgnoreSignup: (signupId: number) => Promise<void>
  canStaffClose: boolean
}) {
  const type = (signup.sheet_type || 'items') as SignupSheetType
  const items = Array.isArray(signup.items) ? signup.items : []
  const responses = Array.isArray(signup.responses) ? signup.responses : []
  const messageId = Number(signup.message_id)
  const [rsvp, setRsvp] = useState<'yes' | 'no' | 'maybe'>('yes')
  const [guestCount, setGuestCount] = useState(1)
  const [notes, setNotes] = useState('')
  const [claimNotes, setClaimNotes] = useState<Record<number, string>>({})

  const submitRsvp = async () => {
    if (!Number.isFinite(messageId) || signup.is_closed) return
    await respondToSignupSheet(role, threadId, messageId, fetcher, {
      status: rsvp,
      guest_count: Math.max(0, Number(guestCount) || 0),
      notes: notes.trim(),
    })
    await onRefresh()
  }

  const claim = async (index: number) => {
    if (!Number.isFinite(messageId) || signup.is_closed) return
    await claimSignupItem(role, threadId, messageId, fetcher, index, claimNotes[index] ?? null)
    await onRefresh()
  }

  const unclaim = async (index: number) => {
    if (!Number.isFinite(messageId) || signup.is_closed) return
    await unclaimSignupItem(role, threadId, messageId, fetcher, index)
    await onRefresh()
  }

  const ignore = async () => {
    if (signup.id == null) return
    await onIgnoreSignup(Number(signup.id))
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{signup.title || 'Signup list'}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {type === 'rsvp' ? 'RSVP' : type === 'support' ? 'Event support' : 'Bring items'}
            {signup.event_date ? ` · Event ${signup.event_date}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {signup.actionable && signup.id != null && (
            <button
              type="button"
              onClick={() => void ignore()}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              Ignore
            </button>
          )}
          {canStaffClose && signup.id != null && (
            <button
              type="button"
              onClick={() => void onCloseSignup(Number(signup.id), !signup.is_closed)}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900"
            >
              {signup.is_closed ? 'Reopen' : 'Close'}
            </button>
          )}
        </div>
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
            disabled={signup.is_closed}
            onClick={() => void submitRsvp()}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Save RSVP
          </button>
          {responses.length > 0 && (
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
              {responses.map((response, index) => {
                const notes = responseNotes(response)
                const guestCount = responseGuestCount(response)
                const name = response.participant_name?.trim() || 'Unknown'
                const phone = response.phone?.trim() || ''
                return (
                  <div key={index} className="px-3 py-2 text-sm space-y-0.5">
                    <div className="font-medium text-gray-900">{name}</div>
                    <div className="text-xs text-gray-600">
                      {responseLabel(response)}
                      {guestCount != null ? ` · ${guestCount} guest${guestCount === 1 ? '' : 's'}` : ''}
                    </div>
                    {phone && <div className="text-xs text-gray-600">{phone}</div>}
                    {notes && <div className="text-xs text-gray-500 italic">{notes}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => {
            const claimed = isClaimed(item)
            const mine = isClaimedByViewer(item, viewerUserId, viewerMemberId)
            const note = itemClaimNote(item)
            const assignedName = itemAssignedName(item)
            const assignedPhone = itemAssignedPhone(item)
            return (
              <li key={index} className="rounded-lg border border-gray-200 px-3 py-2 text-sm space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-800">{itemText(item)}</span>
                  {claimed && !mine && (
                    <span className="shrink-0 text-xs font-semibold text-emerald-700">Claimed</span>
                  )}
                  {mine && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-emerald-700">Claimed</span>
                      <button
                        type="button"
                        disabled={signup.is_closed}
                        onClick={() => void unclaim(index)}
                        className="text-xs font-semibold text-vortex-red hover:underline disabled:opacity-50"
                      >
                        Unclaim
                      </button>
                    </div>
                  )}
                </div>
                {claimed && (
                  <div className="rounded-md bg-gray-50 px-2.5 py-2 text-xs text-gray-600 space-y-0.5">
                    <div className="font-medium text-gray-900">{assignedName || 'Claimed'}</div>
                    {assignedPhone && <div>{assignedPhone}</div>}
                    {note && <div className="italic">{note}</div>}
                  </div>
                )}
                {!claimed && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={claimNotes[index] ?? ''}
                      onChange={(e) => setClaimNotes((prev) => ({ ...prev, [index]: e.target.value }))}
                      placeholder="Optional note"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={signup.is_closed}
                      onClick={() => void claim(index)}
                      className="shrink-0 text-xs font-semibold text-vortex-red hover:underline disabled:opacity-50"
                    >
                      {type === 'support' ? 'I’ll help' : 'I’ll do this'}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function SignupSheetPanel({
  mode,
  signups,
  activeSignup,
  role,
  threadId,
  fetcher,
  viewerUserId = null,
  viewerMemberId = null,
  onCreate,
  onPick,
  onRefresh,
  onCloseSignup,
  onIgnoreSignup,
}: SignupSheetPanelProps) {
  const [title, setTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [sheetType, setSheetType] = useState<SignupSheetType>('rsvp')
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ id: '1', text: '' }])
  const [saving, setSaving] = useState(false)
  const canStaffClose = role !== 'member'

  const create = async () => {
    const items = itemRows.map((row) => row.text.trim()).filter(Boolean).map((text) => ({ text }))
    if (!title.trim() || !eventDate.trim()) return
    if (sheetType !== 'rsvp' && items.length === 0) return
    setSaving(true)
    try {
      await onCreate({
        title: title.trim(),
        sheet_type: sheetType,
        event_date: eventDate.trim(),
        items,
        config: { allow_notes: true, allow_guest_count: sheetType === 'rsvp' },
      })
      setTitle('')
      setEventDate('')
      setItemRows([{ id: '1', text: '' }])
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
        <div>
          <label className="text-xs font-semibold text-gray-700">Event date</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
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
          <div className="space-y-2">
            {itemRows.map((row, index) => (
              <div key={row.id} className="flex items-center gap-2">
                <input
                  value={row.text}
                  onChange={(e) => {
                    const next = [...itemRows]
                    next[index] = { ...next[index], text: e.target.value }
                    setItemRows(next)
                  }}
                  placeholder={sheetType === 'items' ? 'Item to bring' : 'Support slot'}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                {itemRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItemRows(itemRows.filter((_, i) => i !== index))}
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setItemRows([...itemRows, { id: String(Date.now()), text: '' }])}
              className="text-xs font-semibold text-vortex-red hover:underline"
            >
              Add item
            </button>
          </div>
        )}
        <button
          type="button"
          disabled={saving || !title.trim() || !eventDate.trim() || (sheetType !== 'rsvp' && !itemRows.some((row) => row.text.trim()))}
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
              <div className="text-xs text-gray-500">
                {signup.is_closed ? 'Closed' : 'Open'} · {signup.response_count ?? signup.responses?.length ?? 0} responses
                {signup.event_date ? ` · ${signup.event_date}` : ''}
              </div>
            </button>
          ))
        )}
      </div>
    )
  }

  if (mode === 'list') {
    if (signups.length === 0) {
      return <div className="text-sm text-gray-500">No signup lists in this thread yet.</div>
    }
    return (
      <div className="space-y-3">
        {signups.map((signup) => (
          <SignupParticipateCard
            key={signup.id}
            signup={signup}
            role={role}
            threadId={threadId}
            fetcher={fetcher}
            viewerUserId={viewerUserId}
            viewerMemberId={viewerMemberId}
            onRefresh={onRefresh}
            onCloseSignup={onCloseSignup}
            onIgnoreSignup={onIgnoreSignup}
            canStaffClose={canStaffClose}
          />
        ))}
      </div>
    )
  }

  if (!activeSignup) return <div className="text-sm text-gray-500">Choose a signup list.</div>

  return (
    <SignupParticipateCard
      signup={activeSignup}
      role={role}
      threadId={threadId}
      fetcher={fetcher}
      viewerUserId={viewerUserId}
      viewerMemberId={viewerMemberId}
      onRefresh={onRefresh}
      onCloseSignup={onCloseSignup}
      onIgnoreSignup={onIgnoreSignup}
      canStaffClose={canStaffClose}
    />
  )
}
