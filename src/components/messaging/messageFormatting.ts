export function messageDayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function isFirstMessageOfDay(messages: { created_at: string }[], index: number): boolean {
  if (index === 0) return true
  return messageDayKey(messages[index - 1].created_at) !== messageDayKey(messages[index].created_at)
}

export function formatMessageDayLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (messageDayKey(iso) === messageDayKey(today.toISOString())) return 'Today'
  if (messageDayKey(iso) === messageDayKey(yesterday.toISOString())) return 'Yesterday'

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

/** Local time without seconds, e.g. 5:45 PM */
export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatFirstNameLastInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Unknown'
  if (parts.length === 1) return parts[0]
  const first = parts[0]
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase()
  return lastInitial ? `${first} ${lastInitial}` : first
}

function resolveSenderPortalForDisplay(message: {
  sender_portal?: string | null
  sender_kind?: string | null
  sender_member_id?: number | null
}): 'member' | 'coach' | 'admin' {
  if (message.sender_portal === 'admin' || message.sender_portal === 'coach' || message.sender_portal === 'member') {
    return message.sender_portal
  }
  if (message.sender_member_id != null) return 'member'
  if (message.sender_kind === 'admin') return 'admin'
  if (message.sender_kind === 'coach') return 'coach'
  return 'member'
}

/** Staff replies show as "Coach Jimmy O" or "Admin Ali C"; members keep their display name. */
export function formatMessageSenderDisplayName(message: {
  sender_name?: string | null
  sender_portal?: string | null
  sender_kind?: string | null
  sender_member_id?: number | null
}): string {
  const portal = resolveSenderPortalForDisplay(message)
  const rawName = message.sender_name?.trim() || 'Unknown'
  if (portal === 'coach') return `Coach ${formatFirstNameLastInitial(rawName)}`
  if (portal === 'admin') return `Admin ${formatFirstNameLastInitial(rawName)}`
  return rawName
}

export function buildReplyQuote(message: {
  sender_name?: string | null
  body?: string | null
  sender_portal?: string | null
  sender_kind?: string | null
  sender_member_id?: number | null
}): string {
  const name = formatMessageSenderDisplayName(message)
  const body = message.body?.trim()
  if (!body) return `@${name}: `
  const quoted = body.split('\n').map((line) => `> ${line}`).join('\n')
  return `@${name}:\n${quoted}\n\n`
}

export function stripReplyQuote(text: string, quotePrefix: string): string {
  if (!quotePrefix || !text.startsWith(quotePrefix)) return text.trim()
  return text.slice(quotePrefix.length).trim()
}
