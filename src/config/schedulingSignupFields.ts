export type SchedulingSignupFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'number'
  | 'date'
  | 'email_list'

export interface SchedulingSignupFieldDef {
  key: string
  label: string
  type: SchedulingSignupFieldType
  group: 'athlete' | 'parent' | 'other'
  required?: boolean
}

export const DEFAULT_SIGNUP_FIELDS = ['first_name', 'last_name', 'email'] as const

export const MANDATE_WAIVER_PARENT_FIELDS = [
  'parent_first_name',
  'parent_last_name',
  'parent_email',
] as const

export function isParentFieldLockedByWaiver(key: string, mandateWaiver: boolean) {
  return mandateWaiver && MANDATE_WAIVER_PARENT_FIELDS.includes(key as (typeof MANDATE_WAIVER_PARENT_FIELDS)[number])
}

export function mergeSignupFieldsForSave(signupFields: string[], mandateWaiver: boolean) {
  const base = [...new Set([...DEFAULT_SIGNUP_FIELDS, ...signupFields])]
  if (!mandateWaiver) return base
  return [...new Set([...base, ...MANDATE_WAIVER_PARENT_FIELDS])]
}

export const SCHEDULING_SIGNUP_FIELD_CATALOG: SchedulingSignupFieldDef[] = [
  { key: 'first_name', label: 'First Name', type: 'text', group: 'athlete', required: true },
  { key: 'last_name', label: 'Last Name', type: 'text', group: 'athlete', required: true },
  { key: 'phone', label: 'Phone Number', type: 'phone', group: 'athlete' },
  { key: 'email', label: 'Email Address', type: 'email', group: 'athlete', required: true },
  { key: 'home_address', label: 'Home Address', type: 'textarea', group: 'athlete' },
  { key: 'current_school', label: 'Current School', type: 'text', group: 'athlete' },
  { key: 'graduation_year', label: 'High School Graduation Year', type: 'number', group: 'athlete' },
  { key: 'date_of_birth', label: 'Date of Birth', type: 'date', group: 'athlete' },
  { key: 'parent_first_name', label: "Parent or Guardian's First Name", type: 'text', group: 'parent' },
  { key: 'parent_last_name', label: "Parent or Guardian's Last Name", type: 'text', group: 'parent' },
  { key: 'parent_email', label: "Parent or Guardian's Email", type: 'email', group: 'parent' },
  { key: 'parent_phone', label: "Parent or Guardian's Phone", type: 'phone', group: 'parent' },
  { key: 'notify_friends', label: 'Notify Friends', type: 'email_list', group: 'other' },
]

export const SIGNUP_FIELD_GROUPS = [
  { id: 'athlete' as const, label: 'Athlete' },
  { id: 'parent' as const, label: 'Parent / Guardian' },
  { id: 'other' as const, label: 'Other' },
]

export function getSignupFieldDef(key: string) {
  return SCHEDULING_SIGNUP_FIELD_CATALOG.find((f) => f.key === key)
}
