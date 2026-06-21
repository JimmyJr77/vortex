const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime(t) {
  if (!t) return null
  const s = String(t)
  return s.length >= 5 ? s.slice(0, 5) : s
}

function formatDateOnly(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

function buildSlotDisplayLabel(row) {
  const parts = []
  if (row.week_letter) parts.push(`${row.week_letter}-Week`)
  if (row.schedule_mode === 'date' && row.specific_date) {
    parts.push(formatDateOnly(row.specific_date))
  } else if (row.day_of_week != null) {
    parts.push(DAY_NAMES[row.day_of_week])
  }
  const st = formatTime(row.start_time)
  const et = formatTime(row.end_time)
  if (st && et) parts.push(`${st}–${et}`)
  return parts.join(' · ')
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} slotGroupId
 * @param {number} signupId
 */
export async function computeSignupPositions(client, slotGroupId, signupId) {
  const maxRes = await client.query(
    'SELECT max_participants FROM scheduling_slot_group WHERE id = $1',
    [slotGroupId],
  )
  const maxParticipants = Number(maxRes.rows[0]?.max_participants ?? 0)

  const signupRes = await client.query('SELECT status FROM scheduling_signup WHERE id = $1', [signupId])
  const status = signupRes.rows[0]?.status ?? 'confirmed'

  let signupNumber = null
  let waitlistPosition = null

  if (status === 'confirmed') {
    const posRes = await client.query(
      `
      SELECT rn FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
        FROM scheduling_signup
        WHERE slot_group_id = $1 AND status = 'confirmed'
      ) ranked
      WHERE id = $2
      `,
      [slotGroupId, signupId],
    )
    signupNumber = posRes.rows[0] ? Number(posRes.rows[0].rn) : null
  } else if (status === 'waitlisted') {
    const posRes = await client.query(
      `
      SELECT rn FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
        FROM scheduling_signup
        WHERE slot_group_id = $1 AND status = 'waitlisted'
      ) ranked
      WHERE id = $2
      `,
      [slotGroupId, signupId],
    )
    waitlistPosition = posRes.rows[0] ? Number(posRes.rows[0].rn) : null
  }

  return { signupNumber, maxParticipants, waitlistPosition, status }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} slotGroupId
 * @param {number} slotsToFill
 */
export async function promoteFromWaitlist(client, slotGroupId, slotsToFill) {
  if (slotsToFill <= 0) return []

  const waitlisted = await client.query(
    `
    SELECT id FROM scheduling_signup
    WHERE slot_group_id = $1 AND status = 'waitlisted'
    ORDER BY created_at, id
    LIMIT $2
    FOR UPDATE
    `,
    [slotGroupId, slotsToFill],
  )

  const promoted = []
  for (const row of waitlisted.rows) {
    const updated = await client.query(
      `UPDATE scheduling_signup SET status = 'confirmed' WHERE id = $1 RETURNING *`,
      [row.id],
    )
    promoted.push(updated.rows[0])
  }
  return promoted
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} slotGroupId
 * @param {number} slotsToRemove
 */
export async function demoteToWaitlist(client, slotGroupId, slotsToRemove) {
  if (slotsToRemove <= 0) return []

  const confirmed = await client.query(
    `
    SELECT id FROM scheduling_signup
    WHERE slot_group_id = $1 AND status = 'confirmed'
    ORDER BY created_at DESC, id DESC
    LIMIT $2
    FOR UPDATE
    `,
    [slotGroupId, slotsToRemove],
  )

  const demoted = []
  for (const row of confirmed.rows) {
    const updated = await client.query(
      `UPDATE scheduling_signup SET status = 'waitlisted' WHERE id = $1 RETURNING *`,
      [row.id],
    )
    demoted.push(updated.rows[0])
  }
  return demoted
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} slotGroupId
 * @param {number} oldMax
 * @param {number} newMax
 */
export async function rebalanceCapacity(client, slotGroupId, oldMax, newMax) {
  const countRes = await client.query(
    `SELECT COUNT(*)::int AS c FROM scheduling_signup WHERE slot_group_id = $1 AND status = 'confirmed'`,
    [slotGroupId],
  )
  const confirmedCount = Number(countRes.rows[0].c)

  if (newMax > confirmedCount) {
    const slotsToFill = newMax - confirmedCount
    const promoted = await promoteFromWaitlist(client, slotGroupId, slotsToFill)
    return { promoted, demoted: [] }
  }

  if (newMax < confirmedCount) {
    const slotsToRemove = confirmedCount - newMax
    const demoted = await demoteToWaitlist(client, slotGroupId, slotsToRemove)
    return { promoted: [], demoted }
  }

  return { promoted: [], demoted: [] }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} signupId
 */
export async function loadSignupContext(db, signupId) {
  const result = await db.query(
    `
    SELECT s.*, f.title AS form_title, f.mandate_waiver,
      (
        SELECT COALESCE(json_agg(
          json_build_object(
            'week_letter', o.week_letter,
            'day_of_week', o.day_of_week,
            'specific_date', o.specific_date,
            'start_time', o.start_time,
            'end_time', o.end_time,
            'schedule_mode', o.schedule_mode
          )
          ORDER BY o.week_letter NULLS LAST, o.day_of_week NULLS LAST, o.specific_date NULLS LAST, o.start_time
        ), '[]'::json)
        FROM scheduling_time_slot o
        WHERE o.slot_group_id = s.slot_group_id
      ) AS group_occurrences
    FROM scheduling_signup s
    JOIN scheduling_form f ON f.id = s.form_id
    WHERE s.id = $1
    `,
    [signupId],
  )
  if (result.rows.length === 0) return null

  const row = result.rows[0]
  const responses = row.responses && Object.keys(row.responses).length > 0
    ? row.responses
    : row.field_responses || {}
  const occurrences = Array.isArray(row.group_occurrences) ? row.group_occurrences : []
  const slotLabel = occurrences.map((o) => buildSlotDisplayLabel(o)).join('; ')

  return {
    signup: row,
    registrantFirstName: String(responses.first_name || row.first_name || ''),
    registrantEmail: String(responses.email || row.email || ''),
    parentFirstName: String(responses.parent_first_name || ''),
    parentEmail: String(responses.parent_email || ''),
    formTitle: row.form_title || '',
    slotLabel,
    mandateWaiver: Boolean(row.mandate_waiver ?? false),
  }
}

export function buildSignupPositionMessage({ status, signupNumber, maxParticipants, waitlistPosition }) {
  if (status === 'waitlisted' && waitlistPosition != null) {
    return `You are #${waitlistPosition} on the waitlist`
  }
  if (status === 'confirmed' && signupNumber != null && maxParticipants != null) {
    return `You are number ${signupNumber} of ${maxParticipants}`
  }
  return status === 'waitlisted' ? 'You have been added to the waitlist' : 'Signup confirmed'
}
