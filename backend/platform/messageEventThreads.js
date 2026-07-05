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

export async function findEventThreadPair(pool, eventId, facilityId) {
  const canonicalRes = await pool.query(
    `SELECT t.*
     FROM coaching.message_thread t
     JOIN coaching.message_thread_link l ON l.thread_id = t.id
     WHERE l.object_type = 'event'
       AND l.object_id = $1
       AND l.link_role = 'canonical'
       AND t.facility_id = $2
     ORDER BY t.created_at ASC
     LIMIT 1`,
    [eventId, facilityId],
  )
  const canonical = canonicalRes.rows[0] ?? null
  if (!canonical) return { canonical: null, discussion: null }

  const discussionRes = await pool.query(
    `SELECT t.*
     FROM coaching.message_thread t
     WHERE t.linked_thread_id = $1
       AND t.kind = 'discussion'
       AND t.facility_id = $2
     ORDER BY t.created_at ASC
     LIMIT 1`,
    [canonical.id, facilityId],
  )

  return { canonical, discussion: discussionRes.rows[0] ?? null }
}

async function syncEventThreadParticipants(pool, {
  canonical,
  discussion,
  eventId,
  participantMemberIds = [],
  participantUserIds = [],
  adminUserId,
}) {
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
  if (discussion) {
    await insertThreadParticipants(pool, discussion.id, { userIds: allUserIds, memberIds: allMemberIds })
  }

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
}

async function createDiscussionThread(pool, facilityId, eventId, canonical, subject) {
  const discussionRes = await pool.query(
    `INSERT INTO coaching.message_thread (
       facility_id, subject, kind, linked_thread_id, visibility, thread_scope, last_message_at
     ) VALUES ($1, $2, 'discussion', $3, 'participants', 'coaching_circle', now())
     RETURNING *`,
    [facilityId, `${subject || `Event ${eventId}`} — Discussion`, canonical.id],
  )
  const discussion = discussionRes.rows[0]
  await linkThreadToObject(pool, discussion.id, 'event', eventId, 'discussion')
  await setThreadTags(pool, discussion.id, ['event-info', 'team-comms'], facilityId)
  return discussion
}

export async function provisionEventThreads(pool, eventId, facilityId, {
  subject,
  infoJson,
  participantMemberIds = [],
  participantUserIds = [],
  adminUserId,
}) {
  const existing = await findEventThreadPair(pool, eventId, facilityId)

  if (existing.canonical) {
    let { canonical, discussion } = existing
    const title = subject || canonical.subject || `Event ${eventId}`

    await pool.query(
      `UPDATE coaching.message_thread SET subject = $1 WHERE id = $2`,
      [title, canonical.id],
    )
    canonical = { ...canonical, subject: title }

    if (!discussion) {
      discussion = await createDiscussionThread(pool, facilityId, eventId, canonical, title)
    } else {
      await pool.query(
        `UPDATE coaching.message_thread SET subject = $1 WHERE id = $2`,
        [`${title} — Discussion`, discussion.id],
      )
      discussion = { ...discussion, subject: `${title} — Discussion` }
    }

    await pool.query(
      `INSERT INTO coaching.message_thread_info (thread_id, info_json, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (thread_id) DO UPDATE SET info_json = EXCLUDED.info_json, updated_at = now()`,
      [canonical.id, JSON.stringify(infoJson ?? {})],
    )

    await syncEventThreadParticipants(pool, {
      canonical,
      discussion,
      eventId,
      participantMemberIds,
      participantUserIds,
      adminUserId,
    })

    return { canonical, discussion, created: false }
  }

  await ensureDefaultTags(pool, facilityId)
  const title = subject || `Event ${eventId}`

  const canonicalRes = await pool.query(
    `INSERT INTO coaching.message_thread (
       facility_id, subject, kind, visibility, thread_scope, last_message_at
     ) VALUES ($1, $2, 'canonical', 'participants', 'coaching_circle', now())
     RETURNING *`,
    [facilityId, title],
  )
  const canonical = canonicalRes.rows[0]
  const discussion = await createDiscussionThread(pool, facilityId, eventId, canonical, title)

  await pool.query(
    `INSERT INTO coaching.message_thread_info (thread_id, info_json, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (thread_id) DO UPDATE SET info_json = EXCLUDED.info_json, updated_at = now()`,
    [canonical.id, JSON.stringify(infoJson ?? {})],
  )

  await linkThreadToObject(pool, canonical.id, 'event', eventId, 'canonical')
  await setThreadTags(pool, canonical.id, ['event-info'], facilityId)

  await syncEventThreadParticipants(pool, {
    canonical,
    discussion,
    eventId,
    participantMemberIds,
    participantUserIds,
    adminUserId,
  })

  return { canonical, discussion, created: true }
}

/** Create an additional discussion board linked to an existing event (multi-board). */
export async function provisionAdditionalEventBoard(pool, eventId, facilityId, {
  subject,
  adminUserId,
}) {
  const { canonical } = await findEventThreadPair(pool, eventId, facilityId)
  if (!canonical) {
    throw new Error('Create the primary event chat first.')
  }

  await ensureDefaultTags(pool, facilityId)
  const title = subject?.trim() || `${canonical.subject || `Event ${eventId}`} — Board`
  const discussion = await createDiscussionThread(pool, facilityId, eventId, canonical, title.replace(/ — Discussion$/, ''))

  await pool.query(
    `UPDATE coaching.message_thread SET subject = $1 WHERE id = $2`,
    [title.endsWith(' — Discussion') ? title : `${title} — Discussion`, discussion.id],
  )

  const eventRow = await pool.query(`SELECT * FROM events WHERE id = $1`, [eventId])
  const audienceMemberIds = await resolveEventAudienceMemberIds(pool, eventRow.rows[0] || {})
  await insertThreadParticipants(pool, discussion.id, {
    memberIds: audienceMemberIds,
    userIds: adminUserId != null ? [Number(adminUserId)] : [],
  })

  return { discussion, created: true }
}

/** Link an existing thread to an event as a discussion board. */
export async function linkThreadToEvent(pool, threadId, eventId, facilityId, { linkRole = 'discussion' } = {}) {
  const threadRes = await pool.query(
    `SELECT * FROM coaching.message_thread WHERE id = $1 AND facility_id = $2`,
    [threadId, facilityId],
  )
  if (threadRes.rows.length === 0) throw new Error('Thread not found.')
  await linkThreadToObject(pool, threadId, 'event', eventId, linkRole)
  await setThreadTags(pool, threadId, ['event-info', 'team-comms'], facilityId)
  return threadRes.rows[0]
}

export async function getEventThreads(pool, eventId, facilityId) {
  const r = await pool.query(
    `SELECT DISTINCT t.*
     FROM coaching.message_thread t
     JOIN coaching.message_thread_link l ON l.thread_id = t.id
     WHERE l.object_type = 'event' AND l.object_id = $1
       AND t.facility_id = $2
     ORDER BY CASE t.kind
       WHEN 'canonical' THEN 0
       WHEN 'discussion' THEN 1
       ELSE 2
     END, t.created_at ASC`,
    [eventId, facilityId],
  )
  return r.rows
}

export async function memberIsEventChatParticipant(pool, eventId, facilityId, memberId) {
  const { canonical, discussion } = await findEventThreadPair(pool, eventId, facilityId)
  const threadIds = [discussion?.id, canonical?.id].filter(Boolean)
  if (threadIds.length === 0) return false

  const r = await pool.query(
    `SELECT 1
     FROM coaching.message_thread_participant p
     WHERE p.thread_id = ANY($1::bigint[])
       AND p.member_id = $2
     LIMIT 1`,
    [threadIds, memberId],
  )
  return r.rows.length > 0
}

export async function subscribeMemberToEventThreads(pool, eventId, facilityId, memberId) {
  const { canonical, discussion } = await findEventThreadPair(pool, eventId, facilityId)
  if (!canonical) {
    throw new Error('Event chat has not been created yet.')
  }

  let activeDiscussion = discussion
  if (!activeDiscussion) {
    activeDiscussion = await createDiscussionThread(
      pool,
      facilityId,
      eventId,
      canonical,
      canonical.subject,
    )
    await syncEventThreadParticipants(pool, {
      canonical,
      discussion: activeDiscussion,
      eventId,
      participantMemberIds: [],
      participantUserIds: [],
      adminUserId: null,
    })
  }

  await insertThreadParticipants(pool, canonical.id, { memberIds: [memberId] })
  await insertThreadParticipants(pool, activeDiscussion.id, { memberIds: [memberId] })

  return { canonical, discussion: activeDiscussion }
}

export async function getEventChatStatus(pool, eventId, facilityId, memberId = null) {
  const threads = await getEventThreads(pool, eventId, facilityId)
  const canonical = threads.find((t) => t.kind === 'canonical') ?? null
  const discussions = threads.filter((t) => t.kind === 'discussion')
  const discussion = discussions[0] ?? null
  const hasChat = Boolean(canonical)
  let subscribed = false
  if (memberId != null && hasChat) {
    subscribed = await memberIsEventChatParticipant(pool, eventId, facilityId, memberId)
  }
  return {
    hasChat,
    subscribed,
    discussionThreadId: discussion?.id != null ? Number(discussion.id) : null,
    discussionThreadIds: discussions.map((t) => Number(t.id)),
    canonicalThreadId: canonical?.id != null ? Number(canonical.id) : null,
    boards: threads.map((t) => ({
      id: Number(t.id),
      subject: t.subject,
      kind: t.kind,
    })),
  }
}
