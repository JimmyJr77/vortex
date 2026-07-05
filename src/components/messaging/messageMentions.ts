import type { MessageRow, ThreadParticipant } from './types'
import type { MessageViewer } from './messageBubbleStyle'
import { formatMessageSenderDisplayName } from './messageFormatting'

export interface MessageMentionPayload {
  userId?: number
  memberId?: number
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function mentionableParticipants(
  participants: ThreadParticipant[],
  viewer?: MessageViewer,
): ThreadParticipant[] {
  return participants.filter((p) => {
    const name = p.name?.trim()
    if (!name) return false
    if (viewer?.memberId != null && p.member_id != null && Number(p.member_id) === Number(viewer.memberId)) {
      return false
    }
    if (viewer?.userId != null && p.user_id != null && Number(p.user_id) === Number(viewer.userId)) {
      return false
    }
    return true
  })
}

export function mentionPayloadFromParticipant(p: ThreadParticipant): MessageMentionPayload | null {
  if (p.user_id != null) return { userId: Number(p.user_id) }
  if (p.member_id != null) return { memberId: Number(p.member_id) }
  return null
}

export function mentionKey(payload: MessageMentionPayload): string | null {
  if (payload.userId != null) return `user:${payload.userId}`
  if (payload.memberId != null) return `member:${payload.memberId}`
  return null
}

export function findActiveMentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const before = text.slice(0, caret)
  const match = before.match(/@([^@\n]{0,40})$/)
  if (!match) return null
  return { start: caret - match[0].length, query: match[1] }
}

export function filterParticipantsForMentionQuery(
  participants: ThreadParticipant[],
  query: string,
  viewer?: MessageViewer,
): ThreadParticipant[] {
  const q = query.trim().toLowerCase()
  return mentionableParticipants(participants, viewer).filter((p) => {
    if (!q) return true
    return (p.name ?? '').toLowerCase().includes(q)
  })
}

export function tokenizeMentionsInBody(
  text: string,
  mentions: MessageMentionPayload[],
  participants: ThreadParticipant[],
): string {
  let body = text
  for (const mention of mentions) {
    const participant = participants.find((p) => {
      if (mention.userId != null && p.user_id != null) return Number(p.user_id) === Number(mention.userId)
      if (mention.memberId != null && p.member_id != null) return Number(p.member_id) === Number(mention.memberId)
      return false
    })
    const name = participant?.name?.trim()
    if (!name) continue
    const pattern = new RegExp(`@${escapeRegex(name)}(?=\\s|$|[.,!?;:])`, 'g')
    const token =
      mention.userId != null ? `@user:${mention.userId}` : `@member:${mention.memberId}`
    body = body.replace(pattern, token)
  }
  return body
}

export function formatMentionTokensForDisplay(
  body: string,
  participants: ThreadParticipant[],
): string {
  let text = body
  for (const p of participants) {
    const name = p.name?.trim()
    if (!name) continue
    if (p.user_id != null) {
      text = text.replace(new RegExp(`@user:${p.user_id}\\b`, 'g'), `@${name}`)
    }
    if (p.member_id != null) {
      text = text.replace(new RegExp(`@member:${p.member_id}\\b`, 'g'), `@${name}`)
    }
  }
  return text
}

export function viewerIsMentioned(message: MessageRow, viewer: MessageViewer): boolean {
  const mentions = message.mentions ?? []
  if (viewer.memberId != null) {
    return mentions.some(
      (m) => m.member_id != null && Number(m.member_id) === Number(viewer.memberId),
    )
  }
  if (viewer.userId != null) {
    return mentions.some(
      (m) => m.user_id != null && Number(m.user_id) === Number(viewer.userId),
    )
  }
  return false
}

export function mentionPayloadFromMessage(
  message: Pick<MessageRow, 'sender_user_id' | 'sender_member_id'>,
): MessageMentionPayload | null {
  if (message.sender_member_id != null) return { memberId: Number(message.sender_member_id) }
  if (message.sender_user_id != null) return { userId: Number(message.sender_user_id) }
  return null
}

export function mergeMentionPayloads(...lists: MessageMentionPayload[][]): MessageMentionPayload[] {
  const seen = new Set<string>()
  const out: MessageMentionPayload[] = []
  for (const list of lists) {
    for (const m of list) {
      const key = mentionKey(m)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(m)
    }
  }
  return out
}

export function tokenizeReplyMentionPrefix(
  text: string,
  mention: MessageMentionPayload,
  replyTarget: Pick<MessageRow, 'sender_name' | 'sender_portal' | 'sender_kind' | 'sender_member_id'>,
  participants: ThreadParticipant[],
): string {
  const token = mention.userId != null ? `@user:${mention.userId}` : `@member:${mention.memberId}`
  const displayName = formatMessageSenderDisplayName(replyTarget)
  let body = text.replace(new RegExp(`^@${escapeRegex(displayName)}:`), `${token}:`)
  if (body !== text) return body

  const participant = participants.find((p) => {
    if (mention.userId != null && p.user_id != null) return Number(p.user_id) === Number(mention.userId)
    if (mention.memberId != null && p.member_id != null) return Number(p.member_id) === Number(mention.memberId)
    return false
  })
  const name = participant?.name?.trim()
  if (name) {
    body = text.replace(new RegExp(`^@${escapeRegex(name)}:`), `${token}:`)
    if (body !== text) return body
  }
  return text.replace(/^@[^:\n]+:/, `${token}:`)
}

export function prepareMessageBodyForSend(
  text: string,
  composerMentions: MessageMentionPayload[],
  replyTarget: MessageRow | null,
  participants: ThreadParticipant[],
): { body: string; mentions: MessageMentionPayload[] } {
  const replyMention = replyTarget ? mentionPayloadFromMessage(replyTarget) : null
  const mentions = mergeMentionPayloads(composerMentions, replyMention ? [replyMention] : [])
  let body = text
  if (replyMention && replyTarget) {
    body = tokenizeReplyMentionPrefix(body, replyMention, replyTarget, participants)
  }
  body = tokenizeMentionsInBody(body, composerMentions, participants)
  return { body, mentions }
}

export interface MentionSegment {
  text: string
  isMention: boolean
  isSelfMention: boolean
}

export type MessageBodySegment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; text: string; isSelfMention: boolean }
  | { kind: 'quote'; text: string }

function splitLineForMentions(
  line: string,
  participants: ThreadParticipant[],
  viewer: MessageViewer,
): MentionSegment[] {
  const names = mentionableParticipants(participants)
    .map((p) => p.name?.trim())
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => b.length - a.length)

  if (names.length === 0) {
    return [{ text: line, isMention: false, isSelfMention: false }]
  }

  const pattern = new RegExp(`@(${names.map(escapeRegex).join('|')})(?=\\s|:|$|[.,!?;])`, 'g')
  const segments: MentionSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: line.slice(lastIndex, match.index),
        isMention: false,
        isSelfMention: false,
      })
    }
    const mentionName = match[1]
    const participant = participants.find((p) => p.name?.trim() === mentionName)
    const isSelfMention = participant
      ? ((viewer.memberId != null &&
          participant.member_id != null &&
          Number(participant.member_id) === Number(viewer.memberId)) ||
        (viewer.userId != null &&
          participant.user_id != null &&
          Number(participant.user_id) === Number(viewer.userId)))
      : false
    segments.push({
      text: match[0],
      isMention: true,
      isSelfMention,
    })
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), isMention: false, isSelfMention: false })
  }

  return segments.length > 0 ? segments : [{ text: line, isMention: false, isSelfMention: false }]
}

export function splitMessageBodyForDisplay(
  body: string,
  participants: ThreadParticipant[],
  viewer: MessageViewer,
): MessageBodySegment[] {
  const display = formatMentionTokensForDisplay(body, participants)
  const lines = display.split('\n')
  const segments: MessageBodySegment[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const suffix = i < lines.length - 1 ? '\n' : ''

    if (line.startsWith('> ')) {
      segments.push({ kind: 'quote', text: line + suffix })
      continue
    }

    for (const part of splitLineForMentions(line + suffix, participants, viewer)) {
      if (part.isMention) {
        segments.push({ kind: 'mention', text: part.text, isSelfMention: part.isSelfMention })
      } else {
        segments.push({ kind: 'text', text: part.text })
      }
    }
  }

  return segments.length > 0 ? segments : [{ kind: 'text', text: display }]
}

export function splitMessageBodyForMentions(
  body: string,
  participants: ThreadParticipant[],
  viewer: MessageViewer,
): MentionSegment[] {
  const segments: MentionSegment[] = []
  for (const segment of splitMessageBodyForDisplay(body, participants, viewer)) {
    if (segment.kind === 'mention') {
      segments.push({ text: segment.text, isMention: true, isSelfMention: segment.isSelfMention })
    } else {
      segments.push({ text: segment.text, isMention: false, isSelfMention: false })
    }
  }
  return segments
}
