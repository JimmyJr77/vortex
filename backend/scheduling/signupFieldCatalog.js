export const DEFAULT_SIGNUP_FIELDS = ['first_name', 'last_name', 'email']

export const MANDATE_WAIVER_PARENT_FIELDS = [
  'parent_first_name',
  'parent_last_name',
  'parent_email',
]

export const SIGNUP_FIELD_CATALOG = [
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

export function getFieldDef(key) {
  return SIGNUP_FIELD_CATALOG.find((f) => f.key === key)
}

export function mergeSignupFieldsForSave(signupFields, mandateWaiver) {
  const base = [...new Set([...DEFAULT_SIGNUP_FIELDS, ...signupFields])]
  if (!mandateWaiver) return base
  return [...new Set([...base, ...MANDATE_WAIVER_PARENT_FIELDS])]
}

export function validateSignupResponses(enabledKeys, responses, { mandateWaiver = false } = {}) {
  const errors = []
  const keysToCheck = [...new Set(enabledKeys)]
  if (mandateWaiver) {
    for (const key of MANDATE_WAIVER_PARENT_FIELDS) {
      if (!keysToCheck.includes(key)) keysToCheck.push(key)
    }
  }

  for (const key of keysToCheck) {
    const def = getFieldDef(key)
    if (!def) continue
    const val = responses[key]
    const isEmpty =
      val === undefined ||
      val === null ||
      val === '' ||
      (Array.isArray(val) && val.length === 0)
    const isRequired =
      def.required ||
      DEFAULT_SIGNUP_FIELDS.includes(key) ||
      (mandateWaiver && MANDATE_WAIVER_PARENT_FIELDS.includes(key))
    if (isRequired && isEmpty) {
      errors.push(`Required field missing: ${def.label}`)
    }
    if (key === 'email' || key === 'parent_email') {
      if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
        errors.push(`Invalid email: ${def.label}`)
      }
    }
    if (key === 'notify_friends' && Array.isArray(val)) {
      for (const e of val) {
        if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e))) {
          errors.push('Invalid email in Notify Friends')
        }
      }
    }
  }
  return errors
}
