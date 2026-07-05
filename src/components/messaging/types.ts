export type ThreadKind = 'general' | 'canonical' | 'discussion' | 'announcement'

export type ThreadLinkObjectType =
  | 'event'
  | 'scheduling_form'
  | 'program'
  | 'scheduling_offering'
  | 'family'
  | 'scheduling_time_slot'

export interface ThreadTag {
  id: number
  slug: string
  label: string
}

export interface ThreadLink {
  id?: number
  object_type: ThreadLinkObjectType | string
  object_id: number
  link_role?: 'canonical' | 'discussion' | 'related'
}

export interface MessageFile {
  id?: number
  url: string
  name: string
  mime?: string | null
  size_bytes?: number | null
  tag_slug?: string | null
}

export interface MessageThread {
  id: number
  subject?: string | null
  subject_locked?: boolean
  member_id?: number | null
  coach_user_id?: number | null
  thread_scope?: 'assigned_coach' | 'coaching_circle'
  kind?: ThreadKind | string
  linked_thread_id?: number | null
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
  tags?: ThreadTag[]
  unread_count?: number
  links?: ThreadLink[]
  info_json?: Record<string, unknown> | null
  has_files?: boolean
  file_count?: number
  is_calendar_inbox_row?: boolean
  calendar_item_id?: number
  target_thread_id?: number
  calendar_event_name?: string | null
  is_schedule_inbox_row?: boolean
  schedule_row_key?: string
  schedule_source?: 'event' | 'class' | 'calendar_item'
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

export interface MessageMention {
  user_id?: number | null
  member_id?: number | null
}

export interface MessageRow {
  id: number
  body: string
  mentions?: MessageMention[]
  sender_name?: string | null
  sender_kind?: 'member' | 'coach' | 'admin'
  sender_portal?: 'member' | 'coach' | 'admin'
  sender_user_id?: number | null
  sender_member_id?: number | null
  attachment_url?: string | null
  attachment_name?: string | null
  attachment_mime?: string | null
  is_critical?: boolean
  requires_ack?: boolean
  edited_at?: string | null
  deleted_at?: string | null
  files?: MessageFile[]
  reactions?: { emoji: string; count: number }[]
  poll?: MessagePoll | null
  checklist?: MessageChecklist | null
  created_at: string
}

export interface MessagePollVote {
  option_index: number
  user_id?: number | null
  member_id?: number | null
  voted_at?: string
}

export interface MessagePoll {
  id?: number
  message_id?: number
  question: string
  options: unknown[]
  closes_at?: string | null
  expires_at?: string | null
  is_closed?: boolean
  votes?: MessagePollVote[]
  vote_count?: number
  my_vote?: MessagePollVote | null
  ignored?: boolean
  participated?: boolean
  actionable?: boolean
  created_at?: string
}

export type SignupSheetType = 'rsvp' | 'items' | 'support'

export interface SignupResponse {
  user_id?: number | null
  member_id?: number | null
  response?: {
    status?: 'yes' | 'no' | 'maybe'
    guest_count?: number
    notes?: string
  } | Record<string, unknown>
  responded_at?: string
}

export interface MessageChecklist {
  id?: number
  message_id?: number
  title?: string | null
  sheet_type?: SignupSheetType | string
  items: unknown[]
  config?: Record<string, unknown> | null
  closes_at?: string | null
  event_date?: string | null
  expires_at?: string | null
  is_closed?: boolean
  responses?: SignupResponse[]
  response_count?: number
  my_response?: SignupResponse | null
  ignored?: boolean
  participated?: boolean
  actionable?: boolean
  created_at?: string
}

export type ThreadPollSummary = MessagePoll
export type ThreadSignupSummary = MessageChecklist

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

export interface CriticalComposeFlags {
  is_critical: boolean
  requires_ack: boolean
}

export interface MessagePinGroup {
  id: number
  thread_id: number
  user_id?: number | null
  member_id?: number | null
  created_at: string
  message_ids: number[]
}

export interface SuperPinGroup {
  message_ids: number[]
  created_at: string
  source_group_ids?: number[]
}

export type PinFilterMode = 'off' | 'mine' | 'super'

export interface MessageDisplayGroup {
  groupId?: number
  messageIds: number[]
}
