/**
 * Coaching message platform — tags, read state, links, pins, search, files, collaboration.
 */

/** @typedef {{ userId?: number, memberId?: number }} MessageViewer */

const DEFAULT_TAG_SEED = [
  ['team-comms', 'Team Comms', 1],
  ['event-info', 'Event Info', 2],
  ['scheduling', 'Scheduling', 3],
  ['billing', 'Billing', 4],
  ['announcements', 'Announcements', 5],
  ['training', 'Training', 6],
]

function viewerKey(viewer) {
  if (viewer?.userId != null) return `u:${viewer.userId}`
  if (viewer?.memberId != null) return `m:${viewer.memberId}`
  return null
}

export async function ensureDefaultTags(pool, facilityId) {
  for (const [slug, label, sortOrder] of DEFAULT_TAG_SEED) {
    await pool.query(
      `INSERT INTO coaching.message_thread_tag (facility_id, slug, label, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (facility_id, slug) DO NOTHING`,
      [facilityId, slug, label, sortOrder],
    )
  }
  const r = await pool.query(
    `SELECT id, slug, label, sort_order FROM coaching.message_thread_tag
     WHERE facility_id = $1 ORDER BY sort_order, label`,
    [facilityId],
  )
  return r.rows
}

export async function loadThreadTags(pool, threadId) {
  const r = await pool.query(
    `SELECT tg.id, tg.slug, tg.label, tg.sort_order
     FROM coaching.message_thread_tag_link l
     JOIN coaching.message_thread_tag tg ON tg.id = l.tag_id
     WHERE l.thread_id = $1
     ORDER BY tg.sort_order, tg.label`,
    [threadId],
  )
  return r.rows
}

export async function enrichThreadsWithTags(pool, threads) {
  if (!threads?.length) return threads || []
  const ids = threads.map((t) => Number(t.id)).filter(Number.isFinite)
  if (ids.length === 0) return threads
  const r = await pool.query(
    `SELECT l.thread_id,
       COALESCE(
         json_agg(json_build_object('id', tg.id, 'slug', tg.slug, 'label', tg.label) ORDER BY tg.sort_order, tg.label),
         '[]'::json
       ) AS tags
     FROM coaching.message_thread_tag_link l
     JOIN coaching.message_thread_tag tg ON tg.id = l.tag_id
     WHERE l.thread_id = ANY($1::bigint[])
     GROUP BY l.thread_id`,
    [ids],
  )
  const map = new Map(r.rows.map((row) => [Number(row.thread_id), row.tags]))
  return threads.map((t) => ({ ...t, tags: map.get(Number(t.id)) || [] }))
}

export async function setThreadTags(pool, threadId, tagSlugs, facilityId) {
  await ensureDefaultTags(pool, facilityId)
  const slugs = [...new Set((tagSlugs || []).map((s) => String(s).trim()).filter(Boolean))]
  const tagRows = slugs.length === 0
    ? { rows: [] }
    : await pool.query(
        `SELECT id, slug FROM coaching.message_thread_tag
         WHERE facility_id = $1 AND slug = ANY($2::text[])`,
        [facilityId, slugs],
      )
  await pool.query(`DELETE FROM coaching.message_thread_tag_link WHERE thread_id = $1`, [threadId])
  for (const row of tagRows.rows) {
    await pool.query(
      `INSERT INTO coaching.message_thread_tag_link (thread_id, tag_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [threadId, row.id],
    )
  }
  return loadThreadTags(pool, threadId)
}

export async function markThreadRead(pool, { threadId, userId, memberId, messageId }) {
  if (userId == null && memberId == null) return null
  let lastMessageId = messageId
  if (lastMessageId == null) {
    const latest = await pool.query(
      `SELECT id FROM coaching.message WHERE thread_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [threadId],
    )
    lastMessageId = latest.rows[0]?.id ?? null
  }
  if (userId != null) {
    const existing = await pool.query(
      `SELECT * FROM coaching.message_thread_read WHERE thread_id = $1 AND user_id = $2`,
      [threadId, userId],
    )
    if (existing.rows.length > 0) {
      const r = await pool.query(
        `UPDATE coaching.message_thread_read
         SET last_read_message_id = GREATEST(
           COALESCE(last_read_message_id, 0), COALESCE($3, 0)
         ), last_read_at = now()
         WHERE thread_id = $1 AND user_id = $2
         RETURNING *`,
        [threadId, userId, lastMessageId],
      )
      return r.rows[0]
    }
    const r = await pool.query(
      `INSERT INTO coaching.message_thread_read (thread_id, user_id, last_read_message_id, last_read_at)
       VALUES ($1, $2, $3, now()) RETURNING *`,
      [threadId, userId, lastMessageId],
    )
    return r.rows[0]
  }
  const existing = await pool.query(
    `SELECT * FROM coaching.message_thread_read WHERE thread_id = $1 AND member_id = $2`,
    [threadId, memberId],
  )
  if (existing.rows.length > 0) {
    const r = await pool.query(
      `UPDATE coaching.message_thread_read
       SET last_read_message_id = GREATEST(
         COALESCE(last_read_message_id, 0), COALESCE($3, 0)
       ), last_read_at = now()
       WHERE thread_id = $1 AND member_id = $2
       RETURNING *`,
      [threadId, memberId, lastMessageId],
    )
    return r.rows[0]
  }
  const r = await pool.query(
    `INSERT INTO coaching.message_thread_read (thread_id, member_id, last_read_message_id, last_read_at)
     VALUES ($1, $2, $3, now()) RETURNING *`,
    [threadId, memberId, lastMessageId],
  )
  return r.rows[0]
}

export async function getThreadUnreadCount(pool, threadId, viewer) {
  const params = [threadId]
  let readJoin = 'LEFT JOIN coaching.message_thread_read r ON FALSE'
  if (viewer?.userId != null) {
    params.push(viewer.userId)
    readJoin = `LEFT JOIN coaching.message_thread_read r
      ON r.thread_id = msg.thread_id AND r.user_id = $${params.length}`
  } else if (viewer?.memberId != null) {
    params.push(viewer.memberId)
    readJoin = `LEFT JOIN coaching.message_thread_read r
      ON r.thread_id = msg.thread_id AND r.member_id = $${params.length}`
  }
  let senderFilter = ''
  if (viewer?.userId != null) {
    params.push(viewer.userId)
    senderFilter = `AND NOT (msg.sender_user_id = $${params.length})`
  } else if (viewer?.memberId != null) {
    params.push(viewer.memberId)
    senderFilter = `AND NOT (msg.sender_member_id = $${params.length})`
  }
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n
     FROM coaching.message msg
     ${readJoin}
     WHERE msg.thread_id = $1
       AND msg.deleted_at IS NULL
       ${senderFilter}
       AND msg.id > COALESCE(r.last_read_message_id, 0)`,
    params,
  )
  return r.rows[0]?.n ?? 0
}

export async function enrichThreadsWithUnread(pool, threads, viewer) {
  if (!threads?.length || !viewerKey(viewer)) {
    return (threads || []).map((t) => ({ ...t, unread_count: 0 }))
  }
  const ids = threads.map((t) => Number(t.id)).filter(Number.isFinite)
  if (ids.length === 0) return threads

  const params = [ids]
  let readJoin = 'LEFT JOIN coaching.message_thread_read r ON FALSE'
  if (viewer.userId != null) {
    params.push(viewer.userId)
    readJoin = `LEFT JOIN coaching.message_thread_read r
      ON r.thread_id = msg.thread_id AND r.user_id = $${params.length}`
  } else if (viewer.memberId != null) {
    params.push(viewer.memberId)
    readJoin = `LEFT JOIN coaching.message_thread_read r
      ON r.thread_id = msg.thread_id AND r.member_id = $${params.length}`
  }
  let senderFilter = ''
  if (viewer.userId != null) {
    params.push(viewer.userId)
    senderFilter = `AND NOT (msg.sender_user_id = $${params.length})`
  } else if (viewer.memberId != null) {
    params.push(viewer.memberId)
    senderFilter = `AND NOT (msg.sender_member_id = $${params.length})`
  }

  const r = await pool.query(
    `SELECT msg.thread_id, COUNT(*)::int AS unread_count
     FROM coaching.message msg
     ${readJoin}
     WHERE msg.thread_id = ANY($1::bigint[])
       AND msg.deleted_at IS NULL
       ${senderFilter}
       AND msg.id > COALESCE(r.last_read_message_id, 0)
     GROUP BY msg.thread_id`,
    params,
  )
  const map = new Map(r.rows.map((row) => [Number(row.thread_id), Number(row.unread_count)]))
  return threads.map((t) => ({ ...t, unread_count: map.get(Number(t.id)) ?? 0 }))
}

export async function enrichThreadsWithMeta(pool, threads) {
  if (!threads?.length) return threads || []
  const ids = threads.map((t) => Number(t.id)).filter(Number.isFinite)
  if (ids.length === 0) return threads

  const [linksRes, filesRes] = await Promise.all([
    pool.query(
      `SELECT l.thread_id,
         COALESCE(
           json_agg(json_build_object(
             'object_type', l.object_type,
             'object_id', l.object_id,
             'link_role', l.link_role
           ) ORDER BY l.created_at),
           '[]'::json
         ) AS links
       FROM coaching.message_thread_link l
       WHERE l.thread_id = ANY($1::bigint[])
       GROUP BY l.thread_id`,
      [ids],
    ),
    pool.query(
      `SELECT thread_id, COUNT(*)::int AS file_count
       FROM coaching.message_file
       WHERE thread_id = ANY($1::bigint[])
       GROUP BY thread_id`,
      [ids],
    ),
  ])

  const linksMap = new Map(linksRes.rows.map((row) => [Number(row.thread_id), row.links]))
  const filesMap = new Map(filesRes.rows.map((row) => [Number(row.thread_id), Number(row.file_count)]))

  return threads.map((t) => {
    const fileCount = filesMap.get(Number(t.id)) ?? 0
    return {
      ...t,
      links: linksMap.get(Number(t.id)) || [],
      file_count: fileCount,
      has_files: fileCount > 0,
    }
  })
}

export async function linkThreadToObject(pool, threadId, objectType, objectId, linkRole = 'related') {
  const r = await pool.query(
    `INSERT INTO coaching.message_thread_link (thread_id, object_type, object_id, link_role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (thread_id, object_type, object_id, link_role) DO UPDATE SET created_at = now()
     RETURNING *`,
    [threadId, objectType, objectId, linkRole],
  )
  return r.rows[0]
}

export async function loadThreadLinks(pool, threadId) {
  const r = await pool.query(
    `SELECT * FROM coaching.message_thread_link WHERE thread_id = $1 ORDER BY created_at`,
    [threadId],
  )
  return r.rows
}

export async function pinMessage(pool, threadId, messageId, viewer) {
  return createMessagePinGroup(pool, threadId, [messageId], viewer)
}

function viewerOwnsPinGroup(group, viewer) {
  if (viewer?.userId != null && group.user_id != null) {
    return Number(group.user_id) === Number(viewer.userId)
  }
  if (viewer?.memberId != null && group.member_id != null) {
    return Number(group.member_id) === Number(viewer.memberId)
  }
  return false
}

function normalizePinGroupRow(row) {
  const rawIds = row.message_ids
  const messageIds = Array.isArray(rawIds)
    ? rawIds.map(Number).filter(Number.isFinite)
    : typeof rawIds === 'string'
      ? JSON.parse(rawIds).map(Number).filter(Number.isFinite)
      : []
  return {
    id: Number(row.id),
    thread_id: Number(row.thread_id),
    user_id: row.user_id != null ? Number(row.user_id) : null,
    member_id: row.member_id != null ? Number(row.member_id) : null,
    created_at: row.created_at,
    message_ids: messageIds,
  }
}

const PIN_GROUP_SELECT = `
  SELECT g.id, g.thread_id, g.user_id, g.member_id, g.created_at,
    COALESCE(
      json_agg(i.message_id ORDER BY msg.created_at, i.message_id)
        FILTER (WHERE i.message_id IS NOT NULL),
      '[]'::json
    ) AS message_ids
  FROM coaching.message_pin_group g
  LEFT JOIN coaching.message_pin_group_item i ON i.group_id = g.id
  LEFT JOIN coaching.message msg ON msg.id = i.message_id
`

export function mergePinGroupsIntoSuper(groups) {
  const components = (groups || []).map((group) => ({
    messageIds: new Set(group.message_ids || []),
    earliestCreated: group.created_at,
    sourceGroupIds: [group.id],
  }))

  let merged = true
  while (merged) {
    merged = false
    for (let i = 0; i < components.length; i += 1) {
      for (let j = i + 1; j < components.length; j += 1) {
        const a = components[i]
        const b = components[j]
        const intersects = [...a.messageIds].some((id) => b.messageIds.has(id))
        if (!intersects) continue
        for (const id of b.messageIds) a.messageIds.add(id)
        if (new Date(b.earliestCreated).getTime() < new Date(a.earliestCreated).getTime()) {
          a.earliestCreated = b.earliestCreated
        }
        a.sourceGroupIds.push(...b.sourceGroupIds)
        components.splice(j, 1)
        merged = true
        break
      }
      if (merged) break
    }
  }

  return components
    .map((component) => ({
      message_ids: [...component.messageIds].sort((a, b) => a - b),
      created_at: component.earliestCreated,
      source_group_ids: [...new Set(component.sourceGroupIds)],
    }))
    .sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
}

async function loadPinGroupsForThread(pool, threadId, { viewer = null } = {}) {
  const params = [threadId]
  let where = 'WHERE g.thread_id = $1'
  if (viewer) {
    if (viewer.userId != null) {
      params.push(viewer.userId)
      where += ` AND g.user_id = $${params.length}`
    } else if (viewer.memberId != null) {
      params.push(viewer.memberId)
      where += ` AND g.member_id = $${params.length}`
    }
  }
  const r = await pool.query(
    `${PIN_GROUP_SELECT}
     ${where}
     GROUP BY g.id
     ORDER BY g.created_at ASC`,
    params,
  )
  return r.rows.map(normalizePinGroupRow)
}

export async function createMessagePinGroup(pool, threadId, messageIds, viewer) {
  const ids = [...new Set((messageIds || []).map(Number).filter(Number.isFinite))]
  if (ids.length === 0) return null
  if (viewer?.userId == null && viewer?.memberId == null) return null

  const msgCheck = await pool.query(
    `SELECT id FROM coaching.message
     WHERE thread_id = $1 AND deleted_at IS NULL AND id = ANY($2::bigint[])`,
    [threadId, ids],
  )
  if (msgCheck.rows.length !== ids.length) return null

  const groupRes = await pool.query(
    `INSERT INTO coaching.message_pin_group (thread_id, user_id, member_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [threadId, viewer?.userId ?? null, viewer?.memberId ?? null],
  )
  const groupId = groupRes.rows[0].id
  for (const messageId of ids) {
    await pool.query(
      `INSERT INTO coaching.message_pin_group_item (group_id, message_id) VALUES ($1, $2)`,
      [groupId, messageId],
    )
  }

  const loaded = await loadPinGroupsForThread(pool, threadId, { viewer })
  return loaded.find((row) => row.id === Number(groupId)) ?? null
}

export async function deleteMessagePinGroup(pool, groupId, viewer) {
  const r = await pool.query(`SELECT * FROM coaching.message_pin_group WHERE id = $1`, [groupId])
  const group = r.rows[0]
  if (!group) return null
  if (!viewerOwnsPinGroup(group, viewer)) return 'forbidden'
  await pool.query(`DELETE FROM coaching.message_pin_group WHERE id = $1`, [groupId])
  return { deleted: true, id: Number(groupId) }
}

export async function loadViewerPinGroups(pool, threadId, viewer) {
  return loadPinGroupsForThread(pool, threadId, { viewer })
}

export async function loadSuperPinGroups(pool, threadId) {
  const all = await loadPinGroupsForThread(pool, threadId)
  return mergePinGroupsIntoSuper(all)
}

export async function loadThreadPinGroupsResponse(pool, threadId, viewer) {
  const [mine, superGroups] = await Promise.all([
    loadViewerPinGroups(pool, threadId, viewer),
    loadSuperPinGroups(pool, threadId),
  ])
  return { mine, super: superGroups }
}

export async function loadPinnedMessages(pool, threadId) {
  const r = await pool.query(
    `SELECT p.*, msg.body, msg.created_at AS message_created_at
     FROM coaching.message_pin p
     JOIN coaching.message msg ON msg.id = p.message_id
     WHERE p.thread_id = $1
     ORDER BY p.pinned_at DESC`,
    [threadId],
  )
  return r.rows
}

export async function canEditCanonicalThread(pool, threadId, viewer) {
  const threadRes = await pool.query(
    `SELECT kind FROM coaching.message_thread WHERE id = $1`,
    [threadId],
  )
  const kind = threadRes.rows[0]?.kind
  if (kind !== 'canonical') return true
  if (viewer?.userId != null) {
    const r = await pool.query(
      `SELECT 1 FROM coaching.message_thread_editor
       WHERE thread_id = $1 AND user_id = $2 AND can_edit_info = TRUE LIMIT 1`,
      [threadId, viewer.userId],
    )
    return r.rows.length > 0
  }
  if (viewer?.memberId != null) {
    const r = await pool.query(
      `SELECT 1 FROM coaching.message_thread_editor
       WHERE thread_id = $1 AND member_id = $2 AND can_edit_info = TRUE LIMIT 1`,
      [threadId, viewer.memberId],
    )
    return r.rows.length > 0
  }
  return false
}

export async function searchMessages(pool, facilityId, { q, tag, objectType, objectId, hasFile, viewer, limit = 50 }) {
  const params = [facilityId]
  const where = ['t.facility_id = $1', 'msg.deleted_at IS NULL']
  const trimmed = q ? String(q).trim() : ''
  if (trimmed) {
    params.push(`%${trimmed}%`)
    const p = `$${params.length}`
    where.push(`(msg.body ILIKE ${p} OR t.subject ILIKE ${p})`)
  }
  if (tag) {
    params.push(String(tag))
    where.push(`EXISTS (
      SELECT 1 FROM coaching.message_thread_tag_link tl
      JOIN coaching.message_thread_tag tg ON tg.id = tl.tag_id
      WHERE tl.thread_id = t.id AND tg.slug = $${params.length}
    )`)
  }
  if (objectType && objectId != null) {
    params.push(String(objectType), Number(objectId))
    where.push(`EXISTS (
      SELECT 1 FROM coaching.message_thread_link l
      WHERE l.thread_id = t.id AND l.object_type = $${params.length - 1} AND l.object_id = $${params.length}
    )`)
  }
  if (hasFile) {
    where.push(`(
      msg.attachment_url IS NOT NULL
      OR EXISTS (SELECT 1 FROM coaching.message_file mf WHERE mf.message_id = msg.id)
    )`)
  }
  params.push(Math.min(Number(limit) || 50, 100))
  const r = await pool.query(
    `SELECT msg.id, msg.thread_id, msg.body, msg.created_at, msg.is_critical,
       t.subject AS thread_subject, t.kind AS thread_kind
     FROM coaching.message msg
     JOIN coaching.message_thread t ON t.id = msg.thread_id
     WHERE ${where.join(' AND ')}
     ORDER BY msg.created_at DESC
     LIMIT $${params.length}`,
    params,
  )
  return r.rows
}

export async function listMessageFiles(pool, facilityId, { tag, threadId, limit = 50, viewer }) {
  const params = [facilityId]
  const where = ['mf.facility_id = $1']
  if (threadId != null) {
    params.push(Number(threadId))
    where.push(`mf.thread_id = $${params.length}`)
  }
  if (tag) {
    params.push(String(tag))
    where.push(`mf.tag_slug = $${params.length}`)
  }
  params.push(Math.min(Number(limit) || 50, 200))
  const r = await pool.query(
    `SELECT mf.*, msg.body AS message_body, t.subject AS thread_subject
     FROM coaching.message_file mf
     JOIN coaching.message msg ON msg.id = mf.message_id
     JOIN coaching.message_thread t ON t.id = mf.thread_id
     WHERE ${where.join(' AND ')}
     ORDER BY mf.created_at DESC
     LIMIT $${params.length}`,
    params,
  )
  return r.rows
}

export async function saveMessageFile(pool, { messageId, threadId, facilityId, url, name, mime, viewer }) {
  const r = await pool.query(
    `INSERT INTO coaching.message_file (
       message_id, thread_id, facility_id, url, name, mime,
       uploaded_by_user_id, uploaded_by_member_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      messageId,
      threadId,
      facilityId,
      url,
      name || 'Attachment',
      mime ?? null,
      viewer?.userId ?? null,
      viewer?.memberId ?? null,
    ],
  )
  return r.rows[0]
}

export async function acknowledgeMessage(pool, messageId, viewer) {
  if (viewer?.userId != null) {
    const existing = await pool.query(
      `SELECT id FROM coaching.message_ack WHERE message_id = $1 AND user_id = $2`,
      [messageId, viewer.userId],
    )
    if (existing.rows.length > 0) {
      const r = await pool.query(
        `UPDATE coaching.message_ack SET acknowledged_at = now()
         WHERE message_id = $1 AND user_id = $2 RETURNING *`,
        [messageId, viewer.userId],
      )
      return r.rows[0]
    }
    const r = await pool.query(
      `INSERT INTO coaching.message_ack (message_id, user_id) VALUES ($1, $2) RETURNING *`,
      [messageId, viewer.userId],
    )
    return r.rows[0]
  }
  if (viewer?.memberId != null) {
    const existing = await pool.query(
      `SELECT id FROM coaching.message_ack WHERE message_id = $1 AND member_id = $2`,
      [messageId, viewer.memberId],
    )
    if (existing.rows.length > 0) {
      const r = await pool.query(
        `UPDATE coaching.message_ack SET acknowledged_at = now()
         WHERE message_id = $1 AND member_id = $2 RETURNING *`,
        [messageId, viewer.memberId],
      )
      return r.rows[0]
    }
    const r = await pool.query(
      `INSERT INTO coaching.message_ack (message_id, member_id) VALUES ($1, $2) RETURNING *`,
      [messageId, viewer.memberId],
    )
    return r.rows[0]
  }
  return null
}

export async function resolveNotificationIdentity(pool, viewer) {
  let userId = viewer?.userId != null ? Number(viewer.userId) : null
  let memberId = viewer?.memberId != null ? Number(viewer.memberId) : null

  if (memberId && !userId) {
    const linked = await pool.query(
      `SELECT app_user_id FROM member WHERE id = $1 AND app_user_id IS NOT NULL`,
      [memberId],
    )
    if (linked.rows[0]?.app_user_id != null) {
      userId = Number(linked.rows[0].app_user_id)
    }
  }

  if (userId && !memberId) {
    const linked = await pool.query(
      `SELECT id FROM member WHERE app_user_id = $1`,
      [userId],
    )
    if (linked.rows[0]?.id != null) {
      memberId = Number(linked.rows[0].id)
    }
  }

  return { userId, memberId }
}

function defaultNotificationPreference(facilityId, { userId, memberId }) {
  return {
    facility_id: facilityId,
    user_id: userId ?? null,
    member_id: memberId ?? null,
    allow_critical_email: false,
    allow_critical_sms: false,
    phone_e164: null,
  }
}

async function upsertNotificationPreferenceRow(pool, facilityId, column, id, prefs) {
  const allowEmail = Boolean(prefs.allow_critical_email)
  const allowSms = Boolean(prefs.allow_critical_sms)
  const phone = prefs.phone_e164 != null ? String(prefs.phone_e164).trim() || null : null
  const existing = await pool.query(
    `SELECT id FROM coaching.notification_preference WHERE facility_id = $1 AND ${column} = $2`,
    [facilityId, id],
  )
  if (existing.rows.length > 0) {
    const r = await pool.query(
      `UPDATE coaching.notification_preference
       SET allow_critical_email = $3, allow_critical_sms = $4, phone_e164 = $5, updated_at = now()
       WHERE facility_id = $1 AND ${column} = $2
       RETURNING *`,
      [facilityId, id, allowEmail, allowSms, phone],
    )
    return r.rows[0]
  }
  const insertCols = column === 'user_id'
    ? '(facility_id, user_id, allow_critical_email, allow_critical_sms, phone_e164, updated_at)'
    : '(facility_id, member_id, allow_critical_email, allow_critical_sms, phone_e164, updated_at)'
  const r = await pool.query(
    `INSERT INTO coaching.notification_preference ${insertCols}
     VALUES ($1, $2, $3, $4, $5, now()) RETURNING *`,
    [facilityId, id, allowEmail, allowSms, phone],
  )
  return r.rows[0]
}

export async function getNotificationPreferences(pool, facilityId, viewer) {
  const identity = await resolveNotificationIdentity(pool, viewer)
  const rows = []

  if (identity.userId != null) {
    const r = await pool.query(
      `SELECT * FROM coaching.notification_preference
       WHERE facility_id = $1 AND user_id = $2`,
      [facilityId, identity.userId],
    )
    if (r.rows[0]) rows.push(r.rows[0])
  }
  if (identity.memberId != null) {
    const r = await pool.query(
      `SELECT * FROM coaching.notification_preference
       WHERE facility_id = $1 AND member_id = $2`,
      [facilityId, identity.memberId],
    )
    if (r.rows[0]) rows.push(r.rows[0])
  }

  if (rows.length === 0) {
    return defaultNotificationPreference(facilityId, identity)
  }

  rows.sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
    return bTime - aTime
  })
  return rows[0]
}

export async function updateNotificationPreferences(pool, facilityId, viewer, prefs) {
  const identity = await resolveNotificationIdentity(pool, viewer)
  const allowEmail = Boolean(prefs?.allow_critical_email)
  const allowSms = Boolean(prefs?.allow_critical_sms)
  const phone = prefs?.phone_e164 != null ? String(prefs.phone_e164).trim() || null : null
  const payload = {
    allow_critical_email: allowEmail,
    allow_critical_sms: allowSms,
    phone_e164: phone,
  }

  let saved = null
  if (identity.userId != null) {
    saved = await upsertNotificationPreferenceRow(pool, facilityId, 'user_id', identity.userId, payload)
  }
  if (identity.memberId != null) {
    saved = await upsertNotificationPreferenceRow(pool, facilityId, 'member_id', identity.memberId, payload)
  }
  return saved ?? defaultNotificationPreference(facilityId, identity)
}

export async function logMessageAudit(pool, { facilityId, threadId, messageId, actor, action, detail }) {
  const r = await pool.query(
    `INSERT INTO coaching.message_audit_log (
       facility_id, thread_id, message_id, actor_user_id, actor_member_id, action, detail_json
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [
      facilityId,
      threadId ?? null,
      messageId ?? null,
      actor?.userId ?? null,
      actor?.memberId ?? null,
      action,
      JSON.stringify(detail ?? {}),
    ],
  )
  return r.rows[0]
}

// --- Reactions ---

export async function addMessageReaction(pool, messageId, emoji, viewer) {
  const r = await pool.query(
    `INSERT INTO coaching.message_reaction (message_id, emoji, user_id, member_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [messageId, emoji, viewer?.userId ?? null, viewer?.memberId ?? null],
  )
  return r.rows[0] ?? null
}

export async function removeMessageReaction(pool, messageId, emoji, viewer) {
  if (viewer?.userId != null) {
    await pool.query(
      `DELETE FROM coaching.message_reaction
       WHERE message_id = $1 AND emoji = $2 AND user_id = $3`,
      [messageId, emoji, viewer.userId],
    )
  } else if (viewer?.memberId != null) {
    await pool.query(
      `DELETE FROM coaching.message_reaction
       WHERE message_id = $1 AND emoji = $2 AND member_id = $3`,
      [messageId, emoji, viewer.memberId],
    )
  }
}

export async function loadMessageReactions(pool, messageId) {
  const r = await pool.query(
    `SELECT emoji, COUNT(*)::int AS count,
       json_agg(json_build_object(
         'user_id', user_id, 'member_id', member_id, 'created_at', created_at
       )) AS reactors
     FROM coaching.message_reaction
     WHERE message_id = $1
     GROUP BY emoji
     ORDER BY emoji`,
    [messageId],
  )
  return r.rows
}

// --- Polls ---

export async function createMessagePoll(pool, messageId, { question, options, closesAt }) {
  const r = await pool.query(
    `INSERT INTO coaching.message_poll (message_id, question, options_json, closes_at)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING *`,
    [messageId, question, JSON.stringify(options || []), closesAt ?? null],
  )
  return r.rows[0]
}

export async function voteMessagePoll(pool, pollId, optionIndex, viewer) {
  if (viewer?.userId != null) {
    await pool.query(
      `DELETE FROM coaching.message_poll_vote WHERE poll_id = $1 AND user_id = $2`,
      [pollId, viewer.userId],
    )
    const r = await pool.query(
      `INSERT INTO coaching.message_poll_vote (poll_id, option_index, user_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [pollId, optionIndex, viewer.userId],
    )
    return r.rows[0]
  }
  if (viewer?.memberId != null) {
    await pool.query(
      `DELETE FROM coaching.message_poll_vote WHERE poll_id = $1 AND member_id = $2`,
      [pollId, viewer.memberId],
    )
    const r = await pool.query(
      `INSERT INTO coaching.message_poll_vote (poll_id, option_index, member_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [pollId, optionIndex, viewer.memberId],
    )
    return r.rows[0]
  }
  return null
}

export async function loadMessagePoll(pool, messageId) {
  const r = await pool.query(
    `SELECT p.*,
       COALESCE(
         (SELECT json_agg(json_build_object(
           'option_index', v.option_index,
           'user_id', v.user_id,
           'member_id', v.member_id,
           'voted_at', v.voted_at
         ) ORDER BY v.voted_at)
         FROM coaching.message_poll_vote v WHERE v.poll_id = p.id),
         '[]'::json
       ) AS votes
     FROM coaching.message_poll p
     WHERE p.message_id = $1`,
    [messageId],
  )
  const row = r.rows[0]
  if (!row) return null
  return {
    ...row,
    options: row.options_json,
    votes: row.votes ?? [],
  }
}

// --- Checklists ---

export async function createMessageChecklist(pool, messageId, items) {
  const r = await pool.query(
    `INSERT INTO coaching.message_checklist (message_id, items_json)
     VALUES ($1, $2::jsonb)
     RETURNING *`,
    [messageId, JSON.stringify(items || [])],
  )
  return r.rows[0]
}

export async function loadMessageChecklist(pool, messageId) {
  const r = await pool.query(
    `SELECT * FROM coaching.message_checklist WHERE message_id = $1`,
    [messageId],
  )
  return r.rows[0] ?? null
}

export async function claimChecklistItem(pool, messageId, itemIndex, viewer) {
  const checklist = await loadMessageChecklist(pool, messageId)
  if (!checklist) throw new Error('Checklist not found.')
  const items = Array.isArray(checklist.items_json) ? [...checklist.items_json] : []
  const idx = Number(itemIndex)
  if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) {
    throw new Error('Invalid checklist item.')
  }
  const current = items[idx] && typeof items[idx] === 'object' ? { ...items[idx] } : { text: String(items[idx] ?? '') }
  items[idx] = {
    ...current,
    assigned_member_id: viewer?.memberId ?? null,
    assigned_user_id: viewer?.userId ?? null,
  }
  await pool.query(
    `UPDATE coaching.message_checklist SET items_json = $2::jsonb WHERE message_id = $1`,
    [messageId, JSON.stringify(items)],
  )
  return loadMessageChecklist(pool, messageId)
}

// --- FAQ ---

async function resolveFaqFacilityId(pool, threadId, facilityId) {
  if (facilityId != null) return facilityId
  if (threadId == null) return null
  const r = await pool.query(
    `SELECT facility_id FROM coaching.message_thread WHERE id = $1`,
    [threadId],
  )
  return r.rows[0]?.facility_id ?? null
}

export async function listThreadFaq(pool, threadId) {
  const r = await pool.query(
    `SELECT * FROM coaching.thread_faq WHERE thread_id = $1 ORDER BY sort_order, id`,
    [threadId],
  )
  return r.rows
}

export async function listFacilityFaqLibrary(pool, facilityId) {
  const r = await pool.query(
    `SELECT tf.*, t.subject AS thread_subject
     FROM coaching.thread_faq tf
     LEFT JOIN coaching.message_thread t ON t.id = tf.thread_id
     WHERE tf.facility_id = $1
        OR (tf.facility_id IS NULL AND t.facility_id = $1)
     ORDER BY tf.in_master_list DESC, COALESCE(tf.master_sort_order, tf.sort_order, 0), tf.created_at DESC`,
    [facilityId],
  )
  return r.rows
}

export async function listMemberMasterFaqs(pool, facilityId) {
  const r = await pool.query(
    `SELECT tf.id, tf.question, tf.answer, tf.master_sort_order, tf.sort_order
     FROM coaching.thread_faq tf
     LEFT JOIN coaching.message_thread t ON t.id = tf.thread_id
     WHERE tf.in_master_list = TRUE
       AND (tf.facility_id = $1 OR t.facility_id = $1)
     ORDER BY COALESCE(tf.master_sort_order, tf.sort_order, 0), tf.id`,
    [facilityId],
  )
  return r.rows
}

export async function createThreadFaq(pool, threadId, { question, answer, sortOrder, createdByUserId, inMasterList = false, masterSortOrder = null, facilityId = null }) {
  const resolvedFacilityId = await resolveFaqFacilityId(pool, threadId, facilityId)
  const r = await pool.query(
    `INSERT INTO coaching.thread_faq (
       thread_id, facility_id, question, answer, sort_order,
       in_master_list, master_sort_order, created_by_user_id, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     RETURNING *`,
    [
      threadId ?? null,
      resolvedFacilityId,
      question,
      answer,
      sortOrder ?? 0,
      Boolean(inMasterList),
      masterSortOrder,
      createdByUserId ?? null,
    ],
  )
  return r.rows[0]
}

export async function createFacilityFaqEntry(pool, facilityId, payload) {
  const threadId = payload.threadId ?? payload.thread_id ?? null
  if (threadId != null) {
    const threadCheck = await pool.query(
      `SELECT id FROM coaching.message_thread WHERE id = $1 AND facility_id = $2`,
      [threadId, facilityId],
    )
    if (threadCheck.rows.length === 0) return null
  }
  return createThreadFaq(pool, threadId, {
    question: payload.question,
    answer: payload.answer,
    sortOrder: payload.sortOrder ?? payload.sort_order,
    createdByUserId: payload.createdByUserId ?? payload.created_by_user_id,
    inMasterList: payload.inMasterList ?? payload.in_master_list,
    masterSortOrder: payload.masterSortOrder ?? payload.master_sort_order,
    facilityId,
  })
}

export async function updateThreadFaq(pool, faqId, { question, answer, sortOrder, inMasterList, masterSortOrder }) {
  const r = await pool.query(
    `UPDATE coaching.thread_faq
     SET question = COALESCE($2, question),
         answer = COALESCE($3, answer),
         sort_order = COALESCE($4, sort_order),
         in_master_list = COALESCE($5, in_master_list),
         master_sort_order = CASE WHEN $6::int IS NOT NULL THEN $6 ELSE master_sort_order END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      faqId,
      question ?? null,
      answer ?? null,
      sortOrder ?? null,
      inMasterList == null ? null : Boolean(inMasterList),
      masterSortOrder ?? null,
    ],
  )
  return r.rows[0] ?? null
}

export async function getThreadFaqById(pool, faqId) {
  const r = await pool.query(`SELECT * FROM coaching.thread_faq WHERE id = $1`, [faqId])
  return r.rows[0] ?? null
}

export async function deleteThreadFaq(pool, faqId) {
  await pool.query(`DELETE FROM coaching.thread_faq WHERE id = $1`, [faqId])
}

export async function deleteFacilityFaqEntry(pool, facilityId, faqId) {
  const row = await getThreadFaqById(pool, faqId)
  if (!row) return null
  if (row.facility_id != null && Number(row.facility_id) !== Number(facilityId)) {
    if (row.thread_id != null) {
      const threadCheck = await pool.query(
        `SELECT 1 FROM coaching.message_thread WHERE id = $1 AND facility_id = $2`,
        [row.thread_id, facilityId],
      )
      if (threadCheck.rows.length === 0) return 'forbidden'
    } else {
      return 'forbidden'
    }
  } else if (row.facility_id == null && row.thread_id != null) {
    const threadCheck = await pool.query(
      `SELECT 1 FROM coaching.message_thread WHERE id = $1 AND facility_id = $2`,
      [row.thread_id, facilityId],
    )
    if (threadCheck.rows.length === 0) return 'forbidden'
  }
  await deleteThreadFaq(pool, faqId)
  return { deleted: true, id: faqId }
}

export async function saveMessageMentions(pool, messageId, mentions) {
  for (const m of mentions || []) {
    if (m.userId != null) {
      await pool.query(
        `INSERT INTO coaching.message_mention (message_id, user_id) VALUES ($1, $2)`,
        [messageId, m.userId],
      )
    } else if (m.memberId != null) {
      await pool.query(
        `INSERT INTO coaching.message_mention (message_id, member_id) VALUES ($1, $2)`,
        [messageId, m.memberId],
      )
    }
  }
}

export function getMessageRetentionPolicy() {
  const days = Number(process.env.MESSAGE_RETENTION_DAYS || 0)
  return {
    retention_days: Number.isFinite(days) && days > 0 ? days : null,
    description:
      days > 0
        ? `Messages older than ${days} days may be purged per facility policy.`
        : 'Messages are retained indefinitely unless a facility retention policy is configured.',
  }
}

export async function exportMessageAudit(pool, facilityId, { since, until, limit = 5000 } = {}) {
  const params = [facilityId]
  let dateFilter = ''
  if (since) {
    params.push(since)
    dateFilter += ` AND a.created_at >= $${params.length}::timestamptz`
  }
  if (until) {
    params.push(until)
    dateFilter += ` AND a.created_at <= $${params.length}::timestamptz`
  }
  params.push(Math.min(Number(limit) || 5000, 10000))
  const r = await pool.query(
    `SELECT a.*, t.subject AS thread_subject
     FROM coaching.message_audit_log a
     LEFT JOIN coaching.message_thread t ON t.id = a.thread_id
     WHERE a.facility_id = $1 ${dateFilter}
     ORDER BY a.created_at DESC
     LIMIT $${params.length}`,
    params,
  )
  return r.rows
}
