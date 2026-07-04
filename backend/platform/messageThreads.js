/**
 * Shared helpers for coaching.message_thread + message_thread_participant.
 */

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
