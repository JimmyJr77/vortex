export interface MessageThread {
  id: number
  subject?: string | null
  subject_locked?: boolean
  member_id?: number | null
  coach_user_id?: number | null
  thread_scope?: 'assigned_coach' | 'coaching_circle'
  first_name?: string
  last_name?: string
  last_message_body?: string | null
  last_message_created_at?: string | null
  last_message_at?: string | null
  created_at?: string | null
  status?: 'open' | 'archived'
  participant_names?: string | null
  participants?: ThreadParticipant[]
}

export interface ThreadParticipant {
  user_id?: number | null
  member_id?: number | null
  name?: string | null
}

export function participantKey(p: ThreadParticipant): string | null {
  if (p.user_id) return `user:${p.user_id}`
  if (p.member_id) return `member:${p.member_id}`
  return null
}

export interface MessageRow {
  id: number
  body: string
  sender_name?: string | null
  sender_kind?: 'member' | 'coach' | 'admin'
  sender_portal?: 'member' | 'coach' | 'admin'
  sender_user_id?: number | null
  sender_member_id?: number | null
  created_at: string
}

export interface RecipientOption {
  key: string
  id: number
  kind: 'member' | 'coach' | 'admin'
  name: string
}

export type MessagingRole = 'member' | 'coach' | 'admin'

export interface ThreadSubjectUpdate {
  subject: string | null
  subject_locked?: boolean
}
