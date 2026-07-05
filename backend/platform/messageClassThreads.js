/**
 * Class-linked message thread options and provisioning.
 */

import { provisionSchedulingFormThread } from './messageSchedulingThreads.js'

const ACTIVE_SIGNUP = `
  s.member_id IS NOT NULL
  AND s.orphaned_at IS NULL
  AND s.status IN ('confirmed', 'waitlisted')
`

function mapClassOption(row) {
  return {
    id: Number(row.id),
    name: row.name || `Class ${row.id}`,
    member_count: row.member_count != null ? Number(row.member_count) : undefined,
    is_assigned: Boolean(row.is_assigned),
  }
}

/** Member: enrolled classes only. */
export async function queryMemberClassMessageOptions(pool, facilityId, memberId) {
  const r = await pool.query(
    `SELECT sf.id, sf.title AS name, COUNT(DISTINCT s2.member_id)::int AS member_count,
            FALSE AS is_assigned
     FROM scheduling_signup s
     JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL AND sf.is_active = TRUE
     JOIN scheduling_signup s2 ON s2.form_id = sf.id AND ${ACTIVE_SIGNUP}
     JOIN member m ON m.id = s2.member_id AND m.facility_id = $1 AND m.is_active = TRUE
     WHERE s.member_id = $2 AND ${ACTIVE_SIGNUP}
     GROUP BY sf.id, sf.title
     ORDER BY sf.title`,
    [facilityId, memberId],
  )
  return r.rows.map(mapClassOption)
}

/** Admin: all active classes with enrollment. */
export async function queryStaffClassMessageOptions(pool, facilityId, { coachUserId = null } = {}) {
  const assignedJoin = coachUserId != null
    ? `LEFT JOIN coach_class_assignment cca
         ON cca.scheduling_form_id = sf.id AND cca.coach_user_id = $2`
    : ''
  const params = coachUserId != null ? [facilityId, coachUserId] : [facilityId]
  const assignedSelect = coachUserId != null ? ', (cca.id IS NOT NULL) AS is_assigned' : ', FALSE AS is_assigned'
  const orderBy = coachUserId != null
    ? 'ORDER BY (cca.id IS NOT NULL) DESC, sf.title'
    : 'ORDER BY sf.title'

  const r = await pool.query(
    `SELECT sf.id, sf.title AS name, COUNT(DISTINCT s.member_id)::int AS member_count
            ${assignedSelect}
     FROM scheduling_form sf
     JOIN scheduling_signup s ON s.form_id = sf.id AND ${ACTIVE_SIGNUP}
     JOIN member m ON m.id = s.member_id AND m.facility_id = $1 AND m.is_active = TRUE
     ${assignedJoin}
     WHERE sf.deleted_at IS NULL AND sf.is_active = TRUE
     GROUP BY sf.id, sf.title${coachUserId != null ? ', cca.id' : ''}
     HAVING COUNT(DISTINCT s.member_id) > 0
     ${orderBy}`,
    params,
  )
  return r.rows.map(mapClassOption)
}

export async function createClassMessageThread(pool, formId, facilityId, { subject = null, adminUserId = null } = {}) {
  const formRow = await pool.query(
    `SELECT id FROM scheduling_form WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE`,
    [formId],
  )
  if (formRow.rows.length === 0) {
    throw new Error('Class not found.')
  }
  const thread = await provisionSchedulingFormThread(pool, formId, facilityId, {
    subject,
    adminUserId,
  })
  return { thread_id: Number(thread.id) }
}
