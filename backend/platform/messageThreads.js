/**
 * Shared helpers for coaching.message_thread + message_thread_participant.
 */

import { queryAssignmentTargetMemberIds } from './assignmentTargets.js'
import { resolveProgramsSchema } from '../programs/schema.js'

function uniqNums(values) {
  return [...new Set(values.map(Number).filter(Number.isFinite))]
}

export async function insertThreadParticipants(pool, threadId, { userIds = [], memberIds = [] }) {
  const uids = uniqNums(userIds)
  const mids = uniqNums(memberIds)
  for (const userId of uids) {
    await pool.query(
      `INSERT INTO coaching.message_thread_participant (thread_id, user_id)
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM coaching.message_thread_participant
         WHERE thread_id = $1 AND user_id = $2
       )`,
      [threadId, userId],
    )
  }
  for (const memberId of mids) {
    await pool.query(
      `INSERT INTO coaching.message_thread_participant (thread_id, member_id)
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM coaching.message_thread_participant
         WHERE thread_id = $1 AND member_id = $2
       )`,
      [threadId, memberId],
    )
  }
}

export async function loadThreadParticipantUserIds(pool, threadId) {
  const r = await pool.query(
    `SELECT user_id FROM coaching.message_thread_participant WHERE thread_id = $1 AND user_id IS NOT NULL`,
    [threadId],
  )
  return r.rows.map((row) => Number(row.user_id))
}

export async function loadThreadParticipantMemberIds(pool, threadId) {
  const r = await pool.query(
    `SELECT member_id FROM coaching.message_thread_participant WHERE thread_id = $1 AND member_id IS NOT NULL`,
    [threadId],
  )
  return r.rows.map((row) => Number(row.member_id))
}

export async function memberIsThreadParticipant(pool, threadId, memberId) {
  const r = await pool.query(
    `SELECT 1 FROM coaching.message_thread_participant
     WHERE thread_id = $1 AND member_id = $2 LIMIT 1`,
    [threadId, memberId],
  )
  return r.rows.length > 0
}

export async function userIsThreadParticipant(pool, threadId, userId) {
  const r = await pool.query(
    `SELECT 1 FROM coaching.message_thread_participant
     WHERE thread_id = $1 AND user_id = $2 LIMIT 1`,
    [threadId, userId],
  )
  return r.rows.length > 0
}

export function coachCanAccessThread(thread, coachUserId) {
  if (thread.thread_scope === 'coaching_circle') return true
  if (thread.coach_user_id == null) return true
  return Number(thread.coach_user_id) === coachUserId
}

export async function coachCanAccessThreadWithParticipants(pool, thread, coachUserId) {
  if (coachCanAccessThread(thread, coachUserId)) return true
  return userIsThreadParticipant(pool, thread.id, coachUserId)
}

export async function queryStaffRecipientOptions(pool, facilityId, excludeUserId = null) {
  const params = [facilityId]
  let excludeSql = ''
  if (excludeUserId != null) {
    params.push(Number(excludeUserId))
    excludeSql = `AND au.id <> $${params.length}`
  }
  const r = await pool.query(
    `
      SELECT DISTINCT au.id, au.full_name AS name,
        CASE
          WHEN COALESCE(au.role::text, '') IN ('MASTER_ADMIN', 'ADMIN')
            OR EXISTS (
              SELECT 1 FROM app_user_role aur
              WHERE aur.user_id = au.id AND aur.role::text IN ('MASTER_ADMIN', 'ADMIN')
            )
          THEN 'admin'
          ELSE 'coach'
        END AS kind
      FROM app_user au
      WHERE au.facility_id = $1
        AND au.is_active = TRUE
        ${excludeSql}
        AND (
          COALESCE(au.role::text, '') IN ('MASTER_ADMIN', 'ADMIN', 'COACH')
          OR EXISTS (
            SELECT 1 FROM app_user_role aur
            WHERE aur.user_id = au.id AND aur.role::text IN ('MASTER_ADMIN', 'ADMIN', 'COACH')
          )
        )
      ORDER BY au.full_name
    `,
    params,
  )
  return r.rows.map((row) => ({
    key: `user:${row.id}`,
    id: Number(row.id),
    kind: row.kind === 'admin' ? 'admin' : 'coach',
    name: row.name || `User ${row.id}`,
  }))
}

export async function queryMemberRecipientOptions(pool, facilityId, memberId) {
  const [staff, members] = await Promise.all([
    queryStaffRecipientOptions(pool, facilityId),
    pool.query(
      `
        SELECT id, first_name, last_name
        FROM member
        WHERE facility_id = $1 AND is_active = TRUE AND id <> $2
        ORDER BY last_name, first_name
      `,
      [facilityId, memberId],
    ),
  ])
  const memberOptions = members.rows.map((m) => ({
    key: `member:${m.id}`,
    id: Number(m.id),
    kind: 'member',
    name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || `Member ${m.id}`,
  }))
  return [...staff, ...memberOptions]
}

export async function queryCoachRecipientOptions(pool, { facilityId, coachUserId, memberOptions }) {
  const staff = await queryStaffRecipientOptions(pool, facilityId, coachUserId)
  const memberRecipients = (memberOptions || []).map((m) => ({
    key: `member:${m.id}`,
    id: Number(m.id),
    kind: 'member',
    name: m.name,
  }))
  return [...memberRecipients, ...staff]
}

export function parseRecipientPayload(body) {
  const userIds = uniqNums(Array.isArray(body?.recipient_user_ids) ? body.recipient_user_ids : [])
  const memberIds = uniqNums(Array.isArray(body?.recipient_member_ids) ? body.recipient_member_ids : [])
  // Legacy single-recipient fields
  const legacyMember = Number(body?.member_id)
  if (Number.isFinite(legacyMember) && !memberIds.includes(legacyMember)) {
    memberIds.push(legacyMember)
  }
  const legacyCoach = Number(body?.coach_user_id)
  if (Number.isFinite(legacyCoach) && !userIds.includes(legacyCoach)) {
    userIds.push(legacyCoach)
  }
  return { userIds, memberIds }
}

export async function validateMemberRecipients(pool, facilityId, memberIds, excludeMemberId = null) {
  if (memberIds.length === 0) return []
  const ids = excludeMemberId != null
    ? memberIds.filter((id) => id !== Number(excludeMemberId))
    : memberIds
  if (ids.length === 0) return []
  const r = await pool.query(
    `SELECT id FROM member WHERE facility_id = $1 AND is_active = TRUE AND id = ANY($2::bigint[])`,
    [facilityId, ids],
  )
  const valid = new Set(r.rows.map((row) => Number(row.id)))
  return ids.filter((id) => valid.has(id))
}

export async function validateStaffRecipients(pool, facilityId, userIds) {
  if (userIds.length === 0) return []
  const r = await pool.query(
    `
      SELECT au.id
      FROM app_user au
      WHERE au.facility_id = $1 AND au.is_active = TRUE AND au.id = ANY($2::bigint[])
        AND (
          COALESCE(au.role::text, '') IN ('MASTER_ADMIN', 'ADMIN', 'COACH')
          OR EXISTS (
            SELECT 1 FROM app_user_role aur
            WHERE aur.user_id = au.id AND aur.role::text IN ('MASTER_ADMIN', 'ADMIN', 'COACH')
          )
        )
    `,
    [facilityId, userIds],
  )
  const valid = new Set(r.rows.map((row) => Number(row.id)))
  return userIds.filter((id) => valid.has(id))
}

export async function queryAdminRecipientOptions(pool, facilityId) {
  const [staff, members] = await Promise.all([
    queryStaffRecipientOptions(pool, facilityId),
    pool.query(
      `
        SELECT id, first_name, last_name
        FROM member
        WHERE facility_id = $1 AND is_active = TRUE
        ORDER BY last_name, first_name
      `,
      [facilityId],
    ),
  ])
  const memberOptions = members.rows.map((m) => ({
    key: `member:${m.id}`,
    id: Number(m.id),
    kind: 'member',
    name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || `Member ${m.id}`,
  }))
  return [...memberOptions, ...staff]
}

export async function notifyThreadParticipants(pool, createInAppNotification, thread, message, { senderUserId, senderMemberId }) {
  const preview = String(message.body || '').slice(0, 160)
  const title = thread.subject || 'New message'
  const participantUserIds = await loadThreadParticipantUserIds(pool, thread.id)
  const participantMemberIds = await loadThreadParticipantMemberIds(pool, thread.id)

  const notifyUserIds = participantUserIds.filter((id) => id !== Number(senderUserId))
  const notifyMemberIds = participantMemberIds.filter((id) => id !== Number(senderMemberId))

  await Promise.all([
    ...notifyUserIds.map((recipientUserId) =>
      createInAppNotification({
        facilityId: thread.facility_id,
        recipientUserId,
        kind: 'message',
        title,
        body: preview,
        payload: { thread_id: thread.id, message_id: message.id },
      }).catch(() => {}),
    ),
    ...notifyMemberIds.map((recipientMemberId) =>
      createInAppNotification({
        facilityId: thread.facility_id,
        recipientMemberId,
        kind: 'message',
        title,
        body: preview,
        payload: { thread_id: thread.id, message_id: message.id },
      }).catch(() => {}),
    ),
  ])
}

export async function addRecipientsToThread(pool, threadId, facilityId, body) {
  const { userIds, memberIds } = parseRecipientPayload(body)
  const validMembers = await validateMemberRecipients(pool, facilityId, memberIds)
  const validStaff = await validateStaffRecipients(pool, facilityId, userIds)
  const existingUserIds = new Set(await loadThreadParticipantUserIds(pool, threadId))
  const existingMemberIds = new Set(await loadThreadParticipantMemberIds(pool, threadId))
  const newUserIds = validStaff.filter((id) => !existingUserIds.has(id))
  const newMemberIds = validMembers.filter((id) => !existingMemberIds.has(id))
  if (newUserIds.length === 0 && newMemberIds.length === 0) {
    const thread = await loadThreadWithParticipants(pool, threadId, facilityId)
    return { thread, addedCount: 0 }
  }
  await insertThreadParticipants(pool, threadId, { userIds: newUserIds, memberIds: newMemberIds })
  const thread = await loadThreadWithParticipants(pool, threadId, facilityId)
  return { thread, addedCount: newUserIds.length + newMemberIds.length }
}

export async function loadThreadWithParticipants(pool, threadId, facilityId) {
  const data = await pool.query(
    `
      SELECT t.*, m.first_name, m.last_name,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'user_id', p.user_id,
              'member_id', p.member_id,
              'name', COALESCE(
                (SELECT full_name FROM app_user WHERE id = p.user_id),
                (SELECT TRIM(CONCAT(first_name, ' ', last_name)) FROM member WHERE id = p.member_id)
              )
            ) ORDER BY p.id)
            FROM coaching.message_thread_participant p
            WHERE p.thread_id = t.id
          ),
          '[]'::json
        ) AS participants
      FROM coaching.message_thread t
      LEFT JOIN public.member m ON m.id = t.member_id
      WHERE t.id = $1 AND t.facility_id = $2
    `,
    [threadId, facilityId],
  )
  return data.rows[0] ?? null
}

/**
 * Admin thread list with optional search (subject, participants, message bodies) and sort.
 * sort: title | created | updated (default: updated = last_message_at)
 * scope: all | mine — when mine, only threads the admin user participates in
 */
export async function queryAdminMessageThreads(pool, facilityId, { status = 'open', sort = 'updated', q = null, limit = 300, scope = 'all', adminUserId = null, favoriteUserId = null, inboxHideUserId = null }) {
  const params = [facilityId, status]
  const pattern = q && String(q).trim() ? `%${String(q).trim()}%` : null
  let searchSql = ''
  if (pattern) {
    params.push(pattern)
    const p = `$${params.length}`
    searchSql = `
      AND (
        t.subject ILIKE ${p}
        OR COALESCE(m.first_name, '') ILIKE ${p}
        OR COALESCE(m.last_name, '') ILIKE ${p}
        OR EXISTS (
          SELECT 1 FROM coaching.message msg
          WHERE msg.thread_id = t.id AND msg.body ILIKE ${p}
        )
        OR EXISTS (
          SELECT 1 FROM coaching.message_thread_participant p
          LEFT JOIN public.app_user au ON au.id = p.user_id
          LEFT JOIN public.member mem ON mem.id = p.member_id
          WHERE p.thread_id = t.id AND (
            COALESCE(au.full_name, '') ILIKE ${p}
            OR COALESCE(mem.first_name, '') ILIKE ${p}
            OR COALESCE(mem.last_name, '') ILIKE ${p}
          )
        )
      )
    `
  }

  let participantSql = ''
  if (scope === 'mine' && adminUserId != null && Number.isFinite(Number(adminUserId))) {
    params.push(Number(adminUserId))
    const uid = `$${params.length}`
    participantSql = `
      AND (
        EXISTS (
          SELECT 1 FROM coaching.message_thread_participant p
          WHERE p.thread_id = t.id AND p.user_id = ${uid}
        )
        OR EXISTS (
          SELECT 1 FROM coaching.message msg
          WHERE msg.thread_id = t.id AND msg.sender_user_id = ${uid}
        )
      )
    `
  }

  let orderSql = MESSAGE_THREAD_FAVORITE_ORDER
  if (sort === 'title') {
    orderSql = `CASE WHEN fav.favorited_at IS NOT NULL THEN 0 ELSE 1 END, fav.favorited_at ASC NULLS LAST, LOWER(COALESCE(NULLIF(TRIM(t.subject), ''), 'conversation')) ASC, t.created_at DESC`
  } else if (sort === 'created') {
    orderSql = `CASE WHEN fav.favorited_at IS NOT NULL THEN 0 ELSE 1 END, fav.favorited_at ASC NULLS LAST, t.created_at DESC`
  } else if (sort === 'updated') {
    orderSql = MESSAGE_THREAD_FAVORITE_ORDER
  }

  const favUserId = favoriteUserId ?? adminUserId
  const hideUserId = inboxHideUserId ?? (status === 'open' ? favUserId : null)
  const favJoin = favUserId != null
    ? messageThreadFavoriteJoinSql({ userId: Number(favUserId), threadAlias: 't', favAlias: 'fav' })
    : ''
  const favSelect = favUserId != null ? `, ${messageThreadFavoriteSelectSql('fav')}` : ''
  const inboxHideSql = hideUserId != null
    ? messageThreadInboxHideFilterSql({ userId: Number(hideUserId), threadAlias: 't' })
    : ''

  params.push(Number(limit) || 300)
  const limitParam = `$${params.length}`

  const result = await pool.query(
    `
      SELECT t.*, m.first_name, m.last_name,
        lm.body AS last_message_body,
        lm.created_at AS last_message_created_at${favSelect},
        (
          SELECT string_agg(names.n, ', ')
          FROM (
            SELECT DISTINCT COALESCE(
              (SELECT full_name FROM public.app_user WHERE id = p.user_id),
              TRIM(CONCAT(mem.first_name, ' ', mem.last_name))
            ) AS n
            FROM coaching.message_thread_participant p
            LEFT JOIN public.member mem ON mem.id = p.member_id
            WHERE p.thread_id = t.id
          ) names
          WHERE names.n IS NOT NULL AND names.n <> ''
        ) AS participant_names
      FROM coaching.message_thread t
      LEFT JOIN public.member m ON m.id = t.member_id
      ${favJoin}
      LEFT JOIN LATERAL (
        SELECT body, created_at FROM coaching.message
        WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1
      ) lm ON TRUE
      WHERE t.facility_id = $1 AND t.status = $2
      ${participantSql}
      ${inboxHideSql}
      ${searchSql}
      ORDER BY ${orderSql}
      LIMIT ${limitParam}
    `,
    params,
  )
  return result.rows
}

export async function setMessageThreadStatus(pool, threadId, facilityId, status) {
  const next = status === 'archived' ? 'archived' : 'open'
  const updated = await pool.query(
    `UPDATE coaching.message_thread SET status = $1, updated_at = now()
     WHERE id = $2 AND facility_id = $3 RETURNING *`,
    [next, threadId, facilityId],
  )
  return updated.rows[0] ?? null
}

const ACTIVE_SIGNUP = `
  s.member_id IS NOT NULL
  AND s.orphaned_at IS NULL
  AND s.status IN ('confirmed', 'waitlisted')
`

function mapEnrollmentGroup(row, groupType) {
  return {
    key: `group:${groupType}:${row.id}`,
    groupType,
    id: Number(row.id),
    name: row.name || `${groupType} ${row.id}`,
    memberCount: row.member_count != null ? Number(row.member_count) : undefined,
  }
}

/** Enrollment groups for bulk recipient add (member portal: own classes only). */
export async function queryMemberMessageEnrollmentGroups(pool, facilityId, memberId) {
  const r = await pool.query(
    `
      SELECT sf.id, sf.title AS name, COUNT(DISTINCT s2.member_id)::int AS member_count
      FROM scheduling_signup s
      JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
      JOIN scheduling_signup s2 ON s2.form_id = sf.id
        AND s2.member_id IS NOT NULL AND s2.orphaned_at IS NULL
        AND s2.status IN ('confirmed', 'waitlisted')
      JOIN member m ON m.id = s2.member_id AND m.facility_id = $1 AND m.is_active = TRUE
      WHERE s.member_id = $2 AND ${ACTIVE_SIGNUP}
      GROUP BY sf.id, sf.title
      ORDER BY sf.title
    `,
    [facilityId, memberId],
  )
  return r.rows.map((row) => mapEnrollmentGroup(row, 'scheduling_class'))
}

/** Enrollment groups for coach/admin bulk recipient add (sport, program, class). */
export async function queryStaffMessageEnrollmentGroups(pool, facilityId) {
  const schema = await resolveProgramsSchema(pool)
  const [sports, programs, classes] = await Promise.all([
    pool.query(
      `
        SELECT dt.id, dt.name,
          (
            SELECT COUNT(DISTINCT s.member_id)::int
            FROM scheduling_signup s
            JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
            JOIN ${schema.programsTable} top ON top.id = sf.programs_id
            JOIN member m ON m.id = s.member_id AND m.facility_id = $1 AND m.is_active = TRUE
            WHERE top.primary_discipline_tag_id = dt.id AND ${ACTIVE_SIGNUP}
          ) AS member_count
        FROM discipline_tag dt
        WHERE dt.facility_id = $1
          AND EXISTS (
            SELECT 1 FROM ${schema.programsTable} top
            WHERE top.primary_discipline_tag_id = dt.id
              AND (top.facility_id = $1 OR top.facility_id IS NULL)
          )
        ORDER BY dt.name
      `,
      [facilityId],
    ),
    pool.query(
      `
        SELECT p.id, p.display_name AS name,
          (
            SELECT COUNT(DISTINCT m.id)::int
            FROM member m
            WHERE m.facility_id = $1 AND m.is_active = TRUE
              AND (
                EXISTS (
                  SELECT 1 FROM scheduling_signup s
                  JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
                  WHERE s.member_id = m.id AND sf.program_id = p.id AND ${ACTIVE_SIGNUP}
                )
                OR EXISTS (
                  SELECT 1 FROM member_program mp WHERE mp.member_id = m.id AND mp.program_id = p.id
                )
              )
          ) AS member_count
        FROM program p
        WHERE p.facility_id = $1 AND p.is_active = TRUE
        ORDER BY p.display_name
      `,
      [facilityId],
    ),
    pool.query(
      `
        SELECT sf.id, sf.title AS name, COUNT(DISTINCT s.member_id)::int AS member_count
        FROM scheduling_form sf
        JOIN scheduling_signup s ON s.form_id = sf.id AND ${ACTIVE_SIGNUP}
        JOIN member m ON m.id = s.member_id AND m.facility_id = $1 AND m.is_active = TRUE
        WHERE sf.deleted_at IS NULL AND sf.is_active = TRUE
        GROUP BY sf.id, sf.title
        HAVING COUNT(DISTINCT s.member_id) > 0
        ORDER BY sf.title
      `,
      [facilityId],
    ),
  ])
  return [
    ...sports.rows.filter((row) => Number(row.member_count) > 0).map((row) => mapEnrollmentGroup(row, 'primary_sport')),
    ...programs.rows.filter((row) => Number(row.member_count) > 0).map((row) => mapEnrollmentGroup(row, 'program')),
    ...classes.rows.map((row) => mapEnrollmentGroup(row, 'scheduling_class')),
  ]
}

export async function resolveMessageEnrollmentGroupMembers(pool, { facilityId, groupType, groupId, excludeMemberId = null }) {
  const allowed = ['primary_sport', 'program', 'scheduling_class']
  if (!allowed.includes(groupType)) return []
  const ids = await queryAssignmentTargetMemberIds(pool, {
    targetType: groupType,
    targetId: groupId,
    facilityId,
  })
  const filtered = excludeMemberId != null
    ? ids.filter((id) => id !== Number(excludeMemberId))
    : ids
  if (filtered.length === 0) return []
  const r = await pool.query(
    `SELECT id, first_name, last_name FROM member
     WHERE facility_id = $1 AND is_active = TRUE AND id = ANY($2::bigint[])
     ORDER BY last_name, first_name`,
    [facilityId, filtered],
  )
  return r.rows.map((m) => ({
    key: `member:${m.id}`,
    id: Number(m.id),
    kind: 'member',
    name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || `Member ${m.id}`,
  }))
}

export async function setMessageThreadFavorite(pool, { threadId, facilityId, userId = null, memberId = null, favorite }) {
  const thread = await pool.query(
    `SELECT id FROM coaching.message_thread WHERE id = $1 AND facility_id = $2`,
    [threadId, facilityId],
  )
  if (thread.rows.length === 0) return null
  if (favorite) {
    if (userId != null) {
      await pool.query(
        `DELETE FROM coaching.message_thread_favorite WHERE thread_id = $1 AND user_id = $2`,
        [threadId, userId],
      )
      await pool.query(
        `INSERT INTO coaching.message_thread_favorite (thread_id, user_id, favorited_at) VALUES ($1, $2, now())`,
        [threadId, userId],
      )
    } else if (memberId != null) {
      await pool.query(
        `DELETE FROM coaching.message_thread_favorite WHERE thread_id = $1 AND member_id = $2`,
        [threadId, memberId],
      )
      await pool.query(
        `INSERT INTO coaching.message_thread_favorite (thread_id, member_id, favorited_at) VALUES ($1, $2, now())`,
        [threadId, memberId],
      )
    }
    return { is_favorite: true }
  }
  if (userId != null) {
    await pool.query(
      `DELETE FROM coaching.message_thread_favorite WHERE thread_id = $1 AND user_id = $2`,
      [threadId, userId],
    )
  } else if (memberId != null) {
    await pool.query(
      `DELETE FROM coaching.message_thread_favorite WHERE thread_id = $1 AND member_id = $2`,
      [threadId, memberId],
    )
  }
  return { is_favorite: false }
}

/** Sort: favorites first (oldest favorite at top), then by last activity. */
export const MESSAGE_THREAD_FAVORITE_ORDER = `
  CASE WHEN fav.favorited_at IS NOT NULL THEN 0 ELSE 1 END,
  fav.favorited_at ASC NULLS LAST,
  t.last_message_at DESC NULLS LAST,
  t.created_at DESC
`

export function messageThreadFavoriteJoinSql({ userId = null, memberId = null, threadAlias = 't', favAlias = 'fav' }) {
  if (userId != null) {
    return `LEFT JOIN coaching.message_thread_favorite ${favAlias} ON ${favAlias}.thread_id = ${threadAlias}.id AND ${favAlias}.user_id = ${userId}`
  }
  if (memberId != null) {
    return `LEFT JOIN coaching.message_thread_favorite ${favAlias} ON ${favAlias}.thread_id = ${threadAlias}.id AND ${favAlias}.member_id = ${memberId}`
  }
  return ''
}

export function messageThreadFavoriteSelectSql(favAlias = 'fav') {
  return `(fav.favorited_at IS NOT NULL) AS is_favorite, fav.favorited_at`
}

export function messageThreadInboxHideFilterSql({ userId = null, memberId = null, threadAlias = 't' }) {
  if (userId != null) {
    return `
      AND NOT EXISTS (
        SELECT 1 FROM coaching.message_thread_inbox_hide ih
        WHERE ih.thread_id = ${threadAlias}.id AND ih.user_id = ${Number(userId)}
      )
    `
  }
  if (memberId != null) {
    return `
      AND NOT EXISTS (
        SELECT 1 FROM coaching.message_thread_inbox_hide ih
        WHERE ih.thread_id = ${threadAlias}.id AND ih.member_id = ${Number(memberId)}
      )
    `
  }
  return ''
}

export async function setMessageThreadInboxHidden(pool, { threadId, facilityId, userId = null, memberId = null, hidden }) {
  const thread = await pool.query(
    `SELECT id FROM coaching.message_thread WHERE id = $1 AND facility_id = $2`,
    [threadId, facilityId],
  )
  if (thread.rows.length === 0) return null
  if (hidden) {
    if (userId != null) {
      await pool.query(
        `DELETE FROM coaching.message_thread_inbox_hide WHERE thread_id = $1 AND user_id = $2`,
        [threadId, userId],
      )
      await pool.query(
        `INSERT INTO coaching.message_thread_inbox_hide (thread_id, user_id, hidden_at) VALUES ($1, $2, now())`,
        [threadId, userId],
      )
    } else if (memberId != null) {
      await pool.query(
        `DELETE FROM coaching.message_thread_inbox_hide WHERE thread_id = $1 AND member_id = $2`,
        [threadId, memberId],
      )
      await pool.query(
        `INSERT INTO coaching.message_thread_inbox_hide (thread_id, member_id, hidden_at) VALUES ($1, $2, now())`,
        [threadId, memberId],
      )
    }
    return { hidden: true }
  }
  if (userId != null) {
    await pool.query(
      `DELETE FROM coaching.message_thread_inbox_hide WHERE thread_id = $1 AND user_id = $2`,
      [threadId, userId],
    )
  } else if (memberId != null) {
    await pool.query(
      `DELETE FROM coaching.message_thread_inbox_hide WHERE thread_id = $1 AND member_id = $2`,
      [threadId, memberId],
    )
  }
  return { hidden: false }
}

/** New activity restores the thread to every participant's inbox. */
export async function clearInboxHideForThread(pool, threadId) {
  await pool.query(`DELETE FROM coaching.message_thread_inbox_hide WHERE thread_id = $1`, [threadId])
}

export {
  cloudinaryMessageAttachmentSignature,
  isCloudinaryConfigured,
  parseMessageAttachmentPayload,
  messageHasContent,
  normalizeMessageBodyForInsert,
  uploadMessageAttachmentFromBase64,
} from './messageMedia.js'

const MESSAGE_ENRICH_SELECT = `
  SELECT msg.*,
    CASE WHEN msg.sender_member_id IS NOT NULL THEN (SELECT first_name FROM public.member WHERE id = msg.sender_member_id)
         ELSE (SELECT full_name FROM public.app_user WHERE id = msg.sender_user_id) END AS sender_name,
    CASE
      WHEN msg.sender_member_id IS NOT NULL THEN 'member'
      WHEN EXISTS (
        SELECT 1 FROM public.app_user au
        WHERE au.id = msg.sender_user_id
          AND (
            COALESCE(au.role::text, '') IN ('MASTER_ADMIN', 'ADMIN')
            OR EXISTS (
              SELECT 1 FROM public.app_user_role aur
              WHERE aur.user_id = au.id AND aur.role::text IN ('MASTER_ADMIN', 'ADMIN')
            )
          )
      ) THEN 'admin'
      ELSE 'coach'
    END AS sender_kind,
    COALESCE(
      NULLIF(msg.sender_portal, ''),
      CASE
        WHEN msg.sender_member_id IS NOT NULL THEN 'member'
        WHEN EXISTS (
          SELECT 1 FROM public.app_user au
          WHERE au.id = msg.sender_user_id
            AND (
              COALESCE(au.role::text, '') IN ('MASTER_ADMIN', 'ADMIN')
              OR EXISTS (
                SELECT 1 FROM public.app_user_role aur
                WHERE aur.user_id = au.id AND aur.role::text IN ('MASTER_ADMIN', 'ADMIN')
              )
            )
        ) THEN 'admin'
        ELSE 'coach'
      END
    ) AS sender_portal
  FROM coaching.message msg
`

export async function loadEnrichedMessagesForThread(pool, threadId) {
  const r = await pool.query(
    `${MESSAGE_ENRICH_SELECT} WHERE msg.thread_id = $1 ORDER BY msg.created_at ASC`,
    [threadId],
  )
  return r.rows
}

export async function loadEnrichedMessageById(pool, messageId) {
  const r = await pool.query(`${MESSAGE_ENRICH_SELECT} WHERE msg.id = $1`, [messageId])
  return r.rows[0] ?? null
}
