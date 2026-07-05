import type { MessageRow, ThreadParticipant } from './types'
import type { MessageViewer } from './messageBubbleStyle'

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

export interface MentionSegment {
  text: string
  isMention: boolean
  isSelfMention: boolean
}

export function splitMessageBodyForMentions(
  body: string,
  participants: ThreadParticipant[],
  viewer: MessageViewer,
): MentionSegment[] {
  const display = formatMentionTokensForDisplay(body, participants)
  const names = mentionableParticipants(participants)
    .map((p) => p.name?.trim())
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => b.length - a.length)

  if (names.length === 0) {
    return [{ text: display, isMention: false, isSelfMention: false }]
  }

  const pattern = new RegExp(`@(${names.map(escapeRegex).join('|')})(?=\\s|$|[.,!?;:])`, 'g')
  const segments: MentionSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(display)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: display.slice(lastIndex, match.index),
        isMention: false,
        isSelfMention: false,
      })
    }
    const mentionName = match[1]
    const participant = names.includes(mentionName)
      ? participants.find((p) => p.name?.trim() === mentionName)
      : undefined
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

  if (lastIndex < display.length) {
    segments.push({ text: display.slice(lastIndex), isMention: false, isSelfMention: false })
  }

  return segments.length > 0 ? segments : [{ text: display, isMention: false, isSelfMention: false }]
}
