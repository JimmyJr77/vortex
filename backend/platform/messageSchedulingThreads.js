/**
 * Scheduling-linked message threads and system announcements.
 */

import { insertThreadParticipants } from './messageThreads.js'
import {
  ensureDefaultTags,
  linkThreadToObject,
  setThreadTags,
} from './messagePlatform.js'
import { queryAssignmentTargetMemberIds } from './assignmentTargets.js'

export async function provisionSchedulingFormThread(pool, formId, facilityId, { subject, adminUserId }) {
  const existing = await pool.query(
    `SELECT t.id FROM coaching.message_thread t
     JOIN coaching.message_thread_link l ON l.thread_id = t.id
     WHERE l.object_type = 'scheduling_form' AND l.object_id = $1 AND t.facility_id = $2
     LIMIT 1`,
    [formId, facilityId],
  )
  if (existing.rows.length > 0) return existing.rows[0]

  await ensureDefaultTags(pool, facilityId)
  const formRow = await pool.query(
    `SELECT id, title FROM scheduling_form WHERE id = $1 AND deleted_at IS NULL`,
    [formId],
  )
  const title = subject || formRow.rows[0]?.title || `Class ${formId}`

  const inserted = await pool.query(
    `INSERT INTO coaching.message_thread (
       facility_id, subject, kind, visibility, thread_scope, last_message_at
     ) VALUES ($1, $2, 'general', 'participants', 'coaching_circle', now())
     RETURNING id`,
    [facilityId, title],
  )
  const threadId = inserted.rows[0].id
  await linkThreadToObject(pool, threadId, 'scheduling_form', formId, 'related')
  await setThreadTags(pool, threadId, ['scheduling'], facilityId)

  const memberIds = await queryAssignmentTargetMemberIds(pool, {
    targetType: 'scheduling_class',
    targetId: formId,
    facilityId,
  })
  const userIds = adminUserId != null ? [Number(adminUserId)] : []
  await insertThreadParticipants(pool, threadId, { memberIds, userIds })
  return { id: threadId }
}

export async function postSchedulingSystemMessage(pool, {
  formId,
  facilityId,
  body,
  isCritical = false,
  senderUserId = null,
}) {
  const thread = await provisionSchedulingFormThread(pool, formId, facilityId, {
    subject: null,
    adminUserId: senderUserId,
  })
  const inserted = await pool.query(
    `INSERT INTO coaching.message (
       thread_id, sender_user_id, body, sender_portal, is_critical
     ) VALUES ($1, $2, $3, 'admin', $4) RETURNING id`,
    [thread.id, senderUserId, String(body || '').trim(), isCritical],
  )
  await pool.query(
    `UPDATE coaching.message_thread SET last_message_at = now(), updated_at = now() WHERE id = $1`,
    [thread.id],
  )
  return { threadId: thread.id, messageId: inserted.rows[0].id }
}

export async function notifySignupStatusChange(pool, signup, { previousStatus, targetStatus, adminUserId = null }) {
  if (!signup?.form_id) return null
  let body = null
  if (targetStatus === 'cancelled' && previousStatus !== 'cancelled') {
    body = 'An enrollment for this class was cancelled.'
  } else if (targetStatus === 'paused' && previousStatus !== 'paused') {
    body = 'An enrollment for this class was paused.'
  } else if (
    (targetStatus === 'confirmed' || targetStatus === 'waitlisted')
    && (previousStatus === 'cancelled' || previousStatus === 'completed')
  ) {
    body = `An enrollment was reactivated (${targetStatus}).`
  }
  if (!body) return null

  const formRes = await pool.query(
    `SELECT facility_id FROM scheduling_form WHERE id = $1 AND deleted_at IS NULL`,
    [signup.form_id],
  )
  const facilityId = formRes.rows[0]?.facility_id
  if (!facilityId) return null

  return postSchedulingSystemMessage(pool, {
    formId: Number(signup.form_id),
    facilityId: Number(facilityId),
    body,
    senderUserId: adminUserId,
  })
}

export async function notifyTimeSlotScheduleChange(pool, { timeSlotId, changeType, detail = null }) {
  const slotRes = await pool.query(
    `SELECT ts.id, sg.form_id, sf.facility_id, sf.title
     FROM scheduling_time_slot ts
     JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
     JOIN scheduling_form sf ON sf.id = sg.form_id AND sf.deleted_at IS NULL
     WHERE ts.id = $1`,
    [timeSlotId],
  )
  const row = slotRes.rows[0]
  if (!row) return null

  const body =
    changeType === 'reschedule'
      ? detail || 'A class time slot was rescheduled. Check your schedule for updates.'
      : detail || 'A class time slot was cancelled. Check your schedule for updates.'

  const result = await postSchedulingSystemMessage(pool, {
    formId: Number(row.form_id),
    facilityId: Number(row.facility_id),
    body,
    senderUserId: null,
  })
  await linkThreadToObject(pool, result.threadId, 'scheduling_time_slot', Number(timeSlotId), 'related')
  return result
}

export async function getSchedulingFormThread(pool, formId, facilityId) {
  const r = await pool.query(
    `SELECT t.*
     FROM coaching.message_thread t
     JOIN coaching.message_thread_link l ON l.thread_id = t.id
     WHERE l.object_type = 'scheduling_form' AND l.object_id = $1 AND t.facility_id = $2
     LIMIT 1`,
    [formId, facilityId],
  )
  return r.rows[0] ?? null
}
