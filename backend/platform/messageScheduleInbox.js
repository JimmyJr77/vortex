/**
 * Unified Event Schedules inbox rows — events, classes, and calendar items.
 */

import { findEventThreadPair } from './messageEventThreads.js'

const ACTIVE_SIGNUP = `
  s.member_id IS NOT NULL
  AND s.orphaned_at IS NULL
  AND s.status IN ('confirmed', 'waitlisted')
`

function mapScheduleRow(partial) {
  return {
    row_key: partial.row_key,
    source: partial.source,
    title: partial.title,
    who_text: partial.who_text ?? null,
    what_text: partial.what_text ?? null,
    why_text: partial.why_text ?? null,
    when_start: partial.when_start ?? null,
    when_end: partial.when_end ?? null,
    where_text: partial.where_text ?? null,
    notes: partial.notes ?? null,
    linked_event_id: partial.linked_event_id ?? null,
    linked_form_id: partial.linked_form_id ?? null,
    calendar_item_id: partial.calendar_item_id ?? null,
    discussion_thread_id: partial.discussion_thread_id ?? null,
    class_ids: partial.class_ids ?? [],
    event_name: partial.event_name ?? null,
  }
}

async function discussionThreadForEvent(pool, eventId) {
  const pair = await findEventThreadPair(pool, eventId, null)
  return pair.discussion?.id ?? pair.canonical?.id ?? null
}

async function memberEnrolledFormIds(pool, memberId) {
  const r = await pool.query(
    `SELECT DISTINCT s.form_id
     FROM scheduling_signup s
     JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
     WHERE s.member_id = $1 AND ${ACTIVE_SIGNUP}`,
    [memberId],
  )
  return new Set(r.rows.map((row) => Number(row.form_id)))
}

async function memberVisibleEventIds(pool, memberId, facilityId) {
  const enrolledForms = await memberEnrolledFormIds(pool, memberId)
  const formList = [...enrolledForms]

  const r = await pool.query(
    `SELECT e.id, e.scheduling_form_id, e.tag_class_ids
     FROM events e
     WHERE (e.archived = FALSE OR e.archived IS NULL)
       AND (
         e.tag_type = 'all_classes_and_parents'
         OR e.tag_all_parents = TRUE
         OR (e.scheduling_form_id IS NOT NULL AND e.scheduling_form_id = ANY($2::int[]))
         OR (e.tag_class_ids IS NOT NULL AND e.tag_class_ids && $2::int[])
       )`,
    [facilityId, formList.length > 0 ? formList : [0]],
  )
  return new Set(r.rows.map((row) => Number(row.id)))
}

export async function listScheduleInboxRows(pool, facilityId, { memberId = null, limit = 150 } = {}) {
  const rows = []
  const isMember = memberId != null
  let enrolledForms = new Set()
  let visibleEvents = new Set()

  if (isMember) {
    enrolledForms = await memberEnrolledFormIds(pool, memberId)
    visibleEvents = await memberVisibleEventIds(pool, memberId, facilityId)
  }

  const eventsRes = await pool.query(
    `SELECT e.id, e.event_name, e.short_description, e.long_description,
            e.start_date, e.end_date, e.address, e.key_details, e.dates_and_times,
            e.scheduling_form_id, e.tag_class_ids
     FROM events e
     WHERE (e.archived = FALSE OR e.archived IS NULL)
     ORDER BY e.start_date ASC NULLS LAST, e.event_name ASC
     LIMIT $1`,
    [limit],
  )

  for (const event of eventsRes.rows) {
    const eventId = Number(event.id)
    if (isMember && !visibleEvents.has(eventId)) continue

    const classIds = []
    if (event.scheduling_form_id != null) classIds.push(Number(event.scheduling_form_id))
    if (Array.isArray(event.tag_class_ids)) {
      for (const id of event.tag_class_ids) classIds.push(Number(id))
    }

    const whenStart = event.start_date ? new Date(event.start_date).toISOString() : null
    const pair = await findEventThreadPair(pool, eventId, facilityId)
    const discussionId = pair.discussion?.id ?? null

    rows.push(mapScheduleRow({
      row_key: `event:${eventId}`,
      source: 'event',
      title: event.event_name || `Event ${eventId}`,
      what_text: event.short_description || event.long_description || null,
      when_start: whenStart,
      where_text: event.address || null,
      notes: event.key_details ? JSON.stringify(event.key_details) : null,
      linked_event_id: eventId,
      discussion_thread_id: discussionId,
      class_ids: [...new Set(classIds)],
      event_name: event.event_name,
    }))
  }

  const classesRes = await pool.query(
    `SELECT sf.id, sf.title, sf.description
     FROM scheduling_form sf
     WHERE sf.deleted_at IS NULL AND sf.is_active = TRUE
       AND EXISTS (
         SELECT 1 FROM scheduling_signup s
         WHERE s.form_id = sf.id AND ${ACTIVE_SIGNUP}
       )
     ORDER BY sf.title
     LIMIT $1`,
    [limit],
  )

  for (const form of classesRes.rows) {
    const formId = Number(form.id)
    if (isMember && !enrolledForms.has(formId)) continue

    const threadRes = await pool.query(
      `SELECT t.id FROM coaching.message_thread t
       JOIN coaching.message_thread_link l ON l.thread_id = t.id
       WHERE l.object_type = 'scheduling_form' AND l.object_id = $1 AND t.facility_id = $2
       LIMIT 1`,
      [formId, facilityId],
    )

    rows.push(mapScheduleRow({
      row_key: `class:${formId}`,
      source: 'class',
      title: form.title || `Class ${formId}`,
      what_text: form.description || null,
      linked_form_id: formId,
      discussion_thread_id: threadRes.rows[0]?.id != null ? Number(threadRes.rows[0].id) : null,
      class_ids: [formId],
    }))
  }

  let calendarSql = `
    SELECT c.*, e.event_name,
           COALESCE(
             (SELECT array_agg(ecic.scheduling_form_id ORDER BY ecic.scheduling_form_id)
              FROM coaching.event_calendar_item_class ecic
              WHERE ecic.calendar_item_id = c.id),
             ARRAY[]::bigint[]
           ) AS class_ids,
           (${`
             SELECT d.id
             FROM coaching.message_thread_link cl
             JOIN coaching.message_thread can ON can.id = cl.thread_id
             JOIN coaching.message_thread d ON d.linked_thread_id = can.id AND d.kind = 'discussion'
             WHERE cl.object_type = 'event' AND cl.object_id = c.event_id AND cl.link_role = 'canonical'
             ORDER BY can.created_at ASC, d.created_at ASC
             LIMIT 1
           `}) AS discussion_thread_id
    FROM coaching.event_calendar_item c
    JOIN events e ON e.id = c.event_id AND (e.archived = FALSE OR e.archived IS NULL)
    WHERE c.facility_id = $1
  `
  const calendarParams = [facilityId]

  if (isMember) {
    calendarSql += `
      AND (
        c.event_id = ANY($2::int[])
        OR EXISTS (
          SELECT 1 FROM coaching.event_calendar_item_class ecic
          WHERE ecic.calendar_item_id = c.id AND ecic.scheduling_form_id = ANY($3::int[])
        )
      )`
    calendarParams.push(
      visibleEvents.size > 0 ? [...visibleEvents] : [0],
      enrolledForms.size > 0 ? [...enrolledForms] : [0],
    )
  }

  calendarSql += ` ORDER BY c.when_start ASC NULLS LAST, c.sort_order ASC, c.id ASC LIMIT $${calendarParams.length + 1}`
  calendarParams.push(limit)

  const calendarRes = await pool.query(calendarSql, calendarParams)

  for (const item of calendarRes.rows) {
    rows.push(mapScheduleRow({
      row_key: `calendar_item:${item.id}`,
      source: 'calendar_item',
      title: item.title,
      who_text: item.who_text,
      what_text: item.what_text,
      why_text: item.why_text,
      when_start: item.when_start,
      when_end: item.when_end,
      where_text: item.where_text,
      linked_event_id: Number(item.event_id),
      calendar_item_id: Number(item.id),
      discussion_thread_id: item.discussion_thread_id != null ? Number(item.discussion_thread_id) : null,
      class_ids: (item.class_ids || []).map(Number),
      event_name: item.event_name,
    }))
  }

  rows.sort((a, b) => {
    const aTime = a.when_start ? new Date(a.when_start).getTime() : Number.MAX_SAFE_INTEGER
    const bTime = b.when_start ? new Date(b.when_start).getTime() : Number.MAX_SAFE_INTEGER
    if (aTime !== bTime) return aTime - bTime
    return a.title.localeCompare(b.title)
  })

  return rows.slice(0, limit)
}

export async function listHighlightEvents(pool, facilityId, { limit = 200 } = {}) {
  const r = await pool.query(
    `SELECT id, event_name
     FROM events
     WHERE (archived = FALSE OR archived IS NULL)
     ORDER BY start_date ASC NULLS LAST, event_name ASC
     LIMIT $1`,
    [limit],
  )
  return r.rows.map((row) => ({
    id: Number(row.id),
    event_name: row.event_name,
  }))
}
