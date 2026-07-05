/**
 * Event calendar items (5 Ws) and RSVP helpers.
 */

function mapCalendarRow(row) {
  if (!row) return null
  let whatToBring = []
  if (row.what_to_bring != null) {
    whatToBring = typeof row.what_to_bring === 'string'
      ? JSON.parse(row.what_to_bring)
      : row.what_to_bring
    if (!Array.isArray(whatToBring)) whatToBring = []
  }
  return {
    id: Number(row.id),
    facility_id: Number(row.facility_id),
    event_id: Number(row.event_id),
    title: row.title,
    who_text: row.who_text,
    what_text: row.what_text,
    why_text: row.why_text,
    when_start: row.when_start,
    when_end: row.when_end,
    where_text: row.where_text,
    what_to_bring: whatToBring.filter((item) => String(item || '').trim()),
    ics_uid: row.ics_uid,
    sort_order: Number(row.sort_order ?? 0),
    event_name: row.event_name ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function normalizeBringList(payload) {
  const raw = payload.what_to_bring ?? payload.whatToBring ?? payload.bring_items ?? payload.bringItems
  if (!Array.isArray(raw)) return []
  return raw.map((item) => String(item || '').trim()).filter(Boolean)
}

export async function listEventCalendarItems(pool, eventId, facilityId) {
  const r = await pool.query(
    `SELECT c.*, e.event_name
     FROM coaching.event_calendar_item c
     JOIN public.events e ON e.id = c.event_id
     WHERE c.event_id = $1 AND c.facility_id = $2
     ORDER BY c.sort_order ASC, c.when_start ASC NULLS LAST, c.id ASC`,
    [eventId, facilityId],
  )
  return r.rows.map(mapCalendarRow)
}

export async function createEventCalendarItem(pool, eventId, facilityId, payload) {
  const r = await pool.query(
    `INSERT INTO coaching.event_calendar_item (
       facility_id, event_id, title, who_text, what_text, why_text,
       when_start, when_end, where_text, what_to_bring, ics_uid, sort_order
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
     RETURNING *`,
    [
      facilityId,
      eventId,
      String(payload.title || '').trim() || 'Calendar item',
      payload.who_text ?? payload.whoText ?? null,
      payload.what_text ?? payload.whatText ?? null,
      payload.why_text ?? payload.whyText ?? null,
      payload.when_start ?? payload.whenStart ?? null,
      payload.when_end ?? payload.whenEnd ?? null,
      payload.where_text ?? payload.whereText ?? null,
      JSON.stringify(normalizeBringList(payload)),
      payload.ics_uid ?? payload.icsUid ?? null,
      Number(payload.sort_order ?? payload.sortOrder ?? 0),
    ],
  )
  const item = mapCalendarRow(r.rows[0])
  const classIds = payload.class_ids ?? payload.classIds ?? []
  if (Array.isArray(classIds) && classIds.length > 0) {
    for (const formId of classIds) {
      const fid = Number(formId)
      if (!Number.isFinite(fid)) continue
      await pool.query(
        `INSERT INTO coaching.event_calendar_item_class (calendar_item_id, scheduling_form_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [item.id, fid],
      )
    }
    item.class_ids = classIds.map(Number).filter(Number.isFinite)
  }
  return item
}

export async function updateEventCalendarItem(pool, itemId, facilityId, payload) {
  const r = await pool.query(
    `UPDATE coaching.event_calendar_item
     SET title = COALESCE($3, title),
         who_text = COALESCE($4, who_text),
         what_text = COALESCE($5, what_text),
         why_text = COALESCE($6, why_text),
         when_start = COALESCE($7, when_start),
         when_end = COALESCE($8, when_end),
         where_text = COALESCE($9, where_text),
         what_to_bring = COALESCE($10::jsonb, what_to_bring),
         ics_uid = COALESCE($11, ics_uid),
         sort_order = COALESCE($12, sort_order),
         updated_at = now()
     WHERE id = $1 AND facility_id = $2
     RETURNING *`,
    [
      itemId,
      facilityId,
      payload.title != null ? String(payload.title).trim() : null,
      payload.who_text ?? payload.whoText ?? null,
      payload.what_text ?? payload.whatText ?? null,
      payload.why_text ?? payload.whyText ?? null,
      payload.when_start ?? payload.whenStart ?? null,
      payload.when_end ?? payload.whenEnd ?? null,
      payload.where_text ?? payload.whereText ?? null,
      payload.what_to_bring != null || payload.whatToBring != null
        ? JSON.stringify(normalizeBringList(payload))
        : null,
      payload.ics_uid ?? payload.icsUid ?? null,
      payload.sort_order ?? payload.sortOrder ?? null,
    ],
  )
  return mapCalendarRow(r.rows[0])
}

export async function deleteEventCalendarItem(pool, itemId, facilityId) {
  await pool.query(
    `DELETE FROM coaching.event_calendar_item WHERE id = $1 AND facility_id = $2`,
    [itemId, facilityId],
  )
}

export async function listUpcomingCalendarItemsForMember(pool, memberId, facilityId, { limit = 50 } = {}) {
  const r = await pool.query(
    `SELECT c.*, e.event_name,
       d.id AS discussion_thread_id
     FROM coaching.event_calendar_item c
     JOIN public.events e ON e.id = c.event_id AND COALESCE(e.archived, FALSE) IS NOT TRUE
     JOIN coaching.message_thread_link cl ON cl.object_type = 'event'
       AND cl.object_id = c.event_id AND cl.link_role = 'canonical'
     JOIN coaching.message_thread can ON can.id = cl.thread_id
     JOIN coaching.message_thread d ON d.linked_thread_id = can.id AND d.kind = 'discussion'
     JOIN coaching.message_thread_participant p ON p.thread_id = d.id AND p.member_id = $1
     WHERE c.facility_id = $2
       AND (c.when_start IS NULL OR c.when_start >= now() - interval '1 day')
     ORDER BY c.when_start ASC NULLS LAST, c.sort_order ASC, c.id ASC
     LIMIT $3`,
    [memberId, facilityId, limit],
  )
  return r.rows.map((row) => ({
    ...mapCalendarRow(row),
    discussion_thread_id: row.discussion_thread_id != null ? Number(row.discussion_thread_id) : null,
  }))
}

export async function listCalendarInboxRows(pool, facilityId, { memberId = null, limit = 100 } = {}) {
  const params = [facilityId, limit]
  let participantSql = ''
  if (memberId != null) {
    params.unshift(memberId)
    participantSql = `
      AND EXISTS (
        SELECT 1
        FROM coaching.message_thread_link cl
        JOIN coaching.message_thread can ON can.id = cl.thread_id
        JOIN coaching.message_thread d ON d.linked_thread_id = can.id AND d.kind = 'discussion'
        JOIN coaching.message_thread_participant p ON p.thread_id = d.id AND p.member_id = $1
        WHERE cl.object_type = 'event' AND cl.object_id = c.event_id AND cl.link_role = 'canonical'
      )`
  }

  const discussionSubquery = `
    SELECT d.id
    FROM coaching.message_thread_link cl
    JOIN coaching.message_thread can ON can.id = cl.thread_id
    JOIN coaching.message_thread d ON d.linked_thread_id = can.id AND d.kind = 'discussion'
    WHERE cl.object_type = 'event' AND cl.object_id = c.event_id AND cl.link_role = 'canonical'
    ORDER BY can.created_at ASC, d.created_at ASC
    LIMIT 1
  `

  const r = await pool.query(
    `SELECT c.*, e.event_name,
       (${discussionSubquery}) AS discussion_thread_id
     FROM coaching.event_calendar_item c
     JOIN public.events e ON e.id = c.event_id AND COALESCE(e.archived, FALSE) IS NOT TRUE
     WHERE c.facility_id = $${memberId != null ? 2 : 1}
       ${participantSql}
     ORDER BY c.when_start ASC NULLS LAST, c.sort_order ASC, c.id ASC
     LIMIT $${memberId != null ? 3 : 2}`,
    params,
  )

  return r.rows.map((row) => ({
    calendar_item: mapCalendarRow(row),
    discussion_thread_id: row.discussion_thread_id != null ? Number(row.discussion_thread_id) : null,
  }))
}

/** @deprecated use listCalendarInboxRows */
export async function listCalendarItemsAsThreadRows(pool, facilityId, options = {}) {
  return listCalendarInboxRows(pool, facilityId, options)
}

export async function upsertEventRsvp(pool, eventId, memberId, status) {
  const normalized = ['going', 'maybe', 'declined'].includes(status) ? status : 'going'
  const r = await pool.query(
    `INSERT INTO coaching.event_rsvp (event_id, member_id, status, responded_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (event_id, member_id)
     DO UPDATE SET status = EXCLUDED.status, responded_at = now()
     RETURNING *`,
    [eventId, memberId, normalized],
  )
  return r.rows[0]
}

export async function getEventRsvp(pool, eventId, memberId) {
  const r = await pool.query(
    `SELECT * FROM coaching.event_rsvp WHERE event_id = $1 AND member_id = $2`,
    [eventId, memberId],
  )
  return r.rows[0] ?? null
}

export async function listEventRsvps(pool, eventId) {
  const r = await pool.query(
    `SELECT r.*,
       TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name
     FROM coaching.event_rsvp r
     JOIN public.member m ON m.id = r.member_id
     WHERE r.event_id = $1
     ORDER BY r.responded_at DESC`,
    [eventId],
  )
  return r.rows
}
