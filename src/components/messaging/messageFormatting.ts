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

export function buildReplyQuote(message: { sender_name?: string | null; body?: string | null }): string {
  const name = message.sender_name?.trim() || 'Unknown'
  const body = message.body?.trim()
  if (!body) return `@${name}: `
  const quoted = body.split('\n').map((line) => `> ${line}`).join('\n')
  return `@${name}:\n${quoted}\n\n`
}

export function stripReplyQuote(text: string, quotePrefix: string): string {
  if (!quotePrefix || !text.startsWith(quotePrefix)) return text.trim()
  return text.slice(quotePrefix.length).trim()
}
