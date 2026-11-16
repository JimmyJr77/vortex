// Recurring enrollment reserves a place as soon as it is confirmed, even if
// the athlete starts later. Attendance and single-date bookings use the event date.
export function scheduleSignupCountSql(groupId, status = 'confirmed') {
  if (status !== 'confirmed' && status !== 'waitlisted') throw new Error('Invalid schedule count status')
  return `(SELECT COUNT(*)::int FROM scheduling_signup s
    WHERE s.slot_group_id = ${groupId} AND s.status = '${status}'
      AND s.archived_at IS NULL AND s.orphaned_at IS NULL)`
}

export function scheduleCountsSql(groupId) {
  return `${scheduleSignupCountSql(groupId)} AS signup_count,
    ${scheduleSignupCountSql(groupId, 'waitlisted')} AS waitlist_count,
    pending_registration_holds(${groupId}) AS reserved_count`
}

export function scheduleCapacity(maxParticipants, signupCount, reservedCount = 0) {
  const occupied = Number(signupCount) + Number(reservedCount)
  const capacity = Number(maxParticipants)
  return {
    maxParticipants: capacity,
    signupCount: Number(signupCount),
    reservedCount: Number(reservedCount),
    spotsRemaining: Math.max(0, capacity - occupied),
    isFull: occupied >= capacity,
  }
}
