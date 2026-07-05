/**
 * Event-linked message threads — canonical + discussion pair provisioning.
 */

import { insertThreadParticipants } from './messageThreads.js'
import {
  ensureDefaultTags,
  linkThreadToObject,
  setThreadTags,
} from './messagePlatform.js'

const ACTIVE_SIGNUP = `
  s.member_id IS NOT NULL
  AND s.orphaned_at IS NULL
  AND s.status IN ('confirmed', 'waitlisted')
`

export async function resolveEventAudienceMemberIds(pool, eventRow) {
  const ids = new Set()
  const formId = eventRow.scheduling_form_id ?? eventRow.schedulingFormId

  if (formId != null) {
    const signups = await pool.query(
      `SELECT DISTINCT s.member_id
       FROM scheduling_signup s
       JOIN member m ON m.id = s.member_id AND m.is_active = TRUE
       WHERE s.form_id = $1 AND ${ACTIVE_SIGNUP}`,
      [formId],
    )
    for (const row of signups.rows) {
      ids.add(Number(row.member_id))
    }
  }

  const tagType = eventRow.tag_type || eventRow.tagType || 'all_classes_and_parents'

  if (tagType === 'specific_classes') {
    const classIds = eventRow.tag_class_ids || eventRow.tagClassIds || []
    if (classIds.length > 0) {
      const r = await pool.query(
        `SELECT DISTINCT s.member_id
         FROM scheduling_signup s
         JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
         JOIN member m ON m.id = s.member_id AND m.is_active = TRUE
         WHERE sf.program_id = ANY($1::int[]) AND ${ACTIVE_SIGNUP}`,
        [classIds],
      )
      for (const row of r.rows) ids.add(Number(row.member_id))
    }
  }

  if (tagType === 'specific_categories') {
    const categoryIds = eventRow.tag_category_ids || eventRow.tagCategoryIds || []
    if (categoryIds.length > 0) {
      const r = await pool.query(
        `SELECT DISTINCT s.member_id
         FROM scheduling_signup s
         JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
         JOIN program p ON p.id = sf.program_id
         JOIN member m ON m.id = s.member_id AND m.is_active = TRUE
         WHERE p.category_id = ANY($1::int[]) AND ${ACTIVE_SIGNUP}`,
        [categoryIds],
      )
      for (const row of r.rows) ids.add(Number(row.member_id))
    }
  }

  if (tagType === 'all_parents' || eventRow.tag_all_parents || eventRow.tagAllParents) {
    const r = await pool.query(
      `SELECT DISTINCT pga.parent_member_id AS member_id
       FROM parent_guardian_authority pga
       JOIN member m ON m.id = pga.parent_member_id AND m.is_active = TRUE
       WHERE pga.has_legal_authority = TRUE`,
    )
    for (const row of r.rows) {
      if (row.member_id != null) ids.add(Number(row.member_id))
    }
  }

  if (tagType === 'all_classes_and_parents' && ids.size === 0 && formId == null) {
    const r = await pool.query(
      `SELECT id FROM member WHERE is_active = TRUE`,
    )
    for (const row of r.rows) ids.add(Number(row.id))
  }

  return [...ids]
}

export async function provisionEventThreads(pool, eventId, facilityId, {
  subject,
  infoJson,
  participantMemberIds = [],
  participantUserIds = [],
  adminUserId,
}) {
  await ensureDefaultTags(pool, facilityId)

  const canonicalRes = await pool.query(
    `INSERT INTO coaching.message_thread (
       facility_id, subject, kind, visibility, thread_scope, last_message_at
     ) VALUES ($1, $2, 'canonical', 'participants', 'coaching_circle', now())
     RETURNING *`,
    [facilityId, subject || `Event ${eventId}`],
  )
  const canonical = canonicalRes.rows[0]

  const discussionRes = await pool.query(
    `INSERT INTO coaching.message_thread (
       facility_id, subject, kind, linked_thread_id, visibility, thread_scope, last_message_at
     ) VALUES ($1, $2, 'discussion', $3, 'participants', 'coaching_circle', now())
     RETURNING *`,
    [facilityId, `${subject || `Event ${eventId}`} — Discussion`, canonical.id],
  )
  const discussion = discussionRes.rows[0]

  await pool.query(
    `INSERT INTO coaching.message_thread_info (thread_id, info_json, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (thread_id) DO UPDATE SET info_json = EXCLUDED.info_json, updated_at = now()`,
    [canonical.id, JSON.stringify(infoJson ?? {})],
  )

  await linkThreadToObject(pool, canonical.id, 'event', eventId, 'canonical')
  await linkThreadToObject(pool, discussion.id, 'event', eventId, 'discussion')
  await setThreadTags(pool, canonical.id, ['event-info'], facilityId)
  await setThreadTags(pool, discussion.id, ['event-info', 'team-comms'], facilityId)

  const eventRow = await pool.query(`SELECT * FROM events WHERE id = $1`, [eventId])
  const audienceMemberIds = await resolveEventAudienceMemberIds(pool, eventRow.rows[0] || {})
  const allMemberIds = [...new Set([
    ...participantMemberIds.map(Number).filter(Number.isFinite),
    ...audienceMemberIds,
  ])]
  const allUserIds = [...new Set([
    ...(adminUserId != null ? [Number(adminUserId)] : []),
    ...participantUserIds.map(Number).filter(Number.isFinite),
  ])]

  await insertThreadParticipants(pool, canonical.id, { userIds: allUserIds, memberIds: allMemberIds })
  await insertThreadParticipants(pool, discussion.id, { userIds: allUserIds, memberIds: allMemberIds })

  if (adminUserId != null) {
    const editorExists = await pool.query(
      `SELECT 1 FROM coaching.message_thread_editor WHERE thread_id = $1 AND user_id = $2 LIMIT 1`,
      [canonical.id, adminUserId],
    )
    if (editorExists.rows.length === 0) {
      await pool.query(
        `INSERT INTO coaching.message_thread_editor (thread_id, user_id, can_edit_info)
         VALUES ($1, $2, TRUE)`,
        [canonical.id, adminUserId],
      )
    }
  }

  return { canonical, discussion }
}

export async function getEventThreads(pool, eventId, facilityId) {
  const r = await pool.query(
    `SELECT t.*
     FROM coaching.message_thread t
     JOIN coaching.message_thread_link l ON l.thread_id = t.id
     WHERE l.object_type = 'event' AND l.object_id = $1
       AND t.facility_id = $2
     ORDER BY CASE t.kind
       WHEN 'canonical' THEN 0
       WHEN 'discussion' THEN 1
       ELSE 2
     END, t.created_at`,
    [eventId, facilityId],
  )
  return r.rows
}
