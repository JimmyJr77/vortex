export type AdminEnrollmentStatusKey =
  | 'active'
  | 'requested'
  | 'waitlisted'
  | 'paused'
  | 'completed'
  | 'cancelled'

export function normalizeAdminEnrollmentStatus(raw: string): AdminEnrollmentStatusKey {
  switch (raw) {
    case 'confirmed':
    case 'active':
      return 'active'
    case 'requested':
      return 'requested'
    case 'waitlisted':
      return 'waitlisted'
    case 'paused':
      return 'paused'
    case 'completed':
      return 'completed'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'active'
  }
}
