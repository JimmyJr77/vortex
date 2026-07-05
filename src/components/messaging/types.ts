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
  is_favorite?: boolean
  favorited_at?: string | null
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
  attachment_url?: string | null
  attachment_name?: string | null
  attachment_mime?: string | null
  created_at: string
}

export interface RecipientOption {
  key: string
  id: number
  kind: 'member' | 'coach' | 'admin'
  name: string
}

export interface EnrollmentGroup {
  key: string
  groupType: 'primary_sport' | 'program' | 'scheduling_class'
  id: number
  name: string
  memberCount?: number
}

export function mergeRecipientOptions(existing: RecipientOption[], added: RecipientOption[]): RecipientOption[] {
  const keys = new Set(existing.map((r) => r.key))
  const next = [...existing]
  for (const r of added) {
    if (!keys.has(r.key)) {
      keys.add(r.key)
      next.push(r)
    }
  }
  return next
}

export function enrollmentGroupLabel(group: EnrollmentGroup): string {
  if (group.groupType === 'primary_sport') return `${group.name} (sport)`
  if (group.groupType === 'program') return `${group.name} (program)`
  return group.name
}

export type MessagingRole = 'member' | 'coach' | 'admin'

export interface ThreadSubjectUpdate {
  subject: string | null
  subject_locked?: boolean
}
