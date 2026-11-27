import { expandCalendarRange } from './calendarExpansion.js'
import { listSchedulingDayCancellations, lockSchedulingDay } from './dayCancellation.js'
import { scheduleCountsSql } from './scheduleCapacity.js'

function formatDateOnly(value) {
  if (value == null || value === '') return null
  const s = String(value).trim()
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  const date = d.toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000-')) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && s !== date ? null : date
}

export function parseCalendarDateRange(query) {
  const startDateParam = formatDateOnly(query.startDate)
  const endDateParam = formatDateOnly(query.endDate)
  let startDate = startDateParam
  let endDate = endDateParam

  if (!startDate || !endDate) {
    const year = Number(query.year)
    const month = Number(query.month)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { error: 'Invalid year' }
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return { error: 'Invalid month' }
    }
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    startDate = monthStart
    endDate = monthEnd
  }

  if (startDate > endDate) {
    return { error: 'startDate must be on or before endDate' }
  }

  return { startDate, endDate }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{
 *   startDate: string,
 *   endDate: string,
 *   facilityId?: number | null,
 *   programsId?: number | null,
 *   programId?: number | null,
 *   slotGroupId?: number | string | null,
 *   slotGroupIds?: number[] | null,
 *   formActive?: 'all' | 'active' | 'inactive', // admin: filters program.is_active (class status)
 *   publicOnly?: boolean,
 *   includeCancelled?: boolean,
 * }} options
 */
export async function loadSchedulingCalendar(pool, options) {
  // Use the same recorded dates for the date headers and their sessions.
  // The date header must still be present when event filters hide every slot.
  const cancelledDates = options.includeCancelled && options.facilityId != null
    ? await listSchedulingDayCancellations(pool, options.facilityId, options.startDate, options.endDate)
    : null
  const rows = await loadSchedulingCalendarRows(pool, options)
  const calendar = expandCalendarRange({ startDate: options.startDate, endDate: options.endDate, rows, dayCancelledDates: cancelledDates })
  if (!options.includeCancelled) calendar.events = calendar.events.filter(event => !event.isCancelled)
  if (cancelledDates) calendar.cancelledDates = cancelledDates
  return calendar
}

// Share the exact calendar context with reports that need the first occurrence
// of an enrollment, including offering inheritance and alternating weeks.
export async function loadSchedulingCalendarRows(pool, options = {}) {
  const {
    facilityId = null,
    programsId = null,
    programId = null,
    slotGroupId = null,
    slotGroupIds = null,
    formActive = 'all',
    publicOnly = false,
  } = options

  const { resolveProgramsSchema, hasProgramSchedulingColumns } = await import('../programs/schema.js')
  const schema = await resolveProgramsSchema(pool)
  const hasSchedCols = await hasProgramSchedulingColumns(pool, schema.programsTable)

  const params = []
  const filters = [
    'sf.deleted_at IS NULL',
    'sf.program_id IS NOT NULL',
    'p.archived = FALSE',
    '(pr.id IS NULL OR pr.archived = FALSE)',
  ]

  if (publicOnly) {
    filters.push('sf.is_active = TRUE')
    filters.push('p.is_active = TRUE')
    filters.push('COALESCE(p.is_trial_assessment, FALSE) = FALSE')
  } else if (formActive === 'active') {
    filters.push('p.is_active = TRUE')
  } else if (formActive === 'inactive') {
    filters.push('p.is_active = FALSE')
  }

  if (facilityId != null) {
    params.push(facilityId)
    filters.push(`p.facility_id = $${params.length}`)
  }
  if (programsId != null) {
    params.push(programsId)
    filters.push(`sf.programs_id = $${params.length}`)
  }
  if (programId != null) {
    params.push(programId)
    filters.push(`sf.program_id = $${params.length}`)
  }
  if (slotGroupId != null) {
    params.push(slotGroupId)
    filters.push(`sg.id = $${params.length}`)
  }
  if (slotGroupIds != null) {
    params.push(slotGroupIds)
    filters.push(`sg.id = ANY($${params.length}::bigint[])`)
  }

  const programEnrollSelect = hasSchedCols
    ? 'pr.scheduling_enroll_sites, pr.scheduling_active,'
    : 'NULL AS scheduling_enroll_sites, NULL AS scheduling_active,'

  const result = await pool.query(
    `
    SELECT
      ts.*,
      sg.is_active AS sg_is_active,
      sg.max_participants AS sg_max_participants,
      sg.active_start AS sg_active_start,
      sg.active_end AS sg_active_end,
      sg.dates_tbd AS sg_dates_tbd,
      sg.offering_id AS sg_offering_id,
      sg.inherits_offering_dates AS sg_inherits_offering_dates,
      sf.title AS form_title,
      sf.is_active AS form_is_active,
      sf.enroll_sites,
      sf.start_date AS form_start_date,
      sf.end_date AS form_end_date,
      sf.program_id,
      sf.programs_id,
      ${programEnrollSelect}
      o.start_date AS offering_start_date,
      o.end_date AS offering_end_date,
      o.label AS offering_label,
      COALESCE(p.abridged_name, p.display_name) AS class_name,
      p.description AS class_description,
      p.is_active AS class_is_active,
      p.is_trial_assessment,
      p.skill_level,
      p.age_min,
      p.age_max,
      p.skill_requirements,
      COALESCE(pr.abridged_name, pr.display_name) AS program_name,
      sg.offering_id,
      ARRAY(SELECT cancellation.occurrence_date::text
              FROM scheduling_occurrence_cancellation cancellation
             WHERE cancellation.time_slot_id = ts.id) AS cancelled_dates,
      ARRAY(SELECT cancellation.occurrence_date::text
              FROM scheduling_day_cancellation cancellation
             WHERE cancellation.facility_id = p.facility_id) AS day_cancelled_dates,
      ${scheduleCountsSql('sg.id')}
    FROM scheduling_time_slot ts
    JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
    JOIN scheduling_form sf ON sf.id = ts.form_id
    JOIN program p ON p.id = sf.program_id
    LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
    LEFT JOIN ${schema.programsTable} pr ON pr.id = sf.programs_id
    WHERE ${filters.join(' AND ')}
    ORDER BY ts.start_time, p.display_name, ts.id
    `,
    params,
  )

  return result.rows
}

export async function setSchedulingOccurrenceCancellation(pool, { facilityId, slotId, date, cancelled }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await lockSchedulingDay(client, facilityId, date, { shared: true })
    // Booking and recurring schedule edits take the same group lock before
    // reading dated availability or editing its slots.
    const { rows: [group] } = await client.query(`
      SELECT sg.id
      FROM scheduling_time_slot ts
      JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
      JOIN scheduling_form sf ON sf.id = ts.form_id
      JOIN program p ON p.id = sf.program_id
      WHERE ts.id = $1 AND p.facility_id = $2
      FOR UPDATE OF sg
    `, [slotId, facilityId])

    // The legacy single-slot editor can update or remove a slot directly.
    const slot = group && (await client.query(`
      SELECT id FROM scheduling_time_slot
      WHERE id = $1 AND slot_group_id = $2
      FOR SHARE
    `, [slotId, group.id])).rows[0]
    const calendar = slot && await loadSchedulingCalendar(client, {
      facilityId,
      slotGroupId: group.id,
      startDate: date,
      endDate: date,
      includeCancelled: true,
    })
    const occurrence = calendar?.events.find(event => event.timeSlotId === slotId)
    if (!occurrence) {
      await client.query('ROLLBACK')
      return null
    }
    if (occurrence.isCancelledByDay) {
      throw Object.assign(new Error('Restore classes for this day before changing an individual session.'), { statusCode: 409 })
    }

    if (cancelled) {
      await client.query(`
        INSERT INTO scheduling_occurrence_cancellation (time_slot_id, occurrence_date)
        VALUES ($1, $2::date)
        ON CONFLICT (time_slot_id, occurrence_date) DO NOTHING
      `, [slotId, date])
    } else {
      await client.query(`
        DELETE FROM scheduling_occurrence_cancellation
        WHERE time_slot_id = $1 AND occurrence_date = $2::date
      `, [slotId, date])
    }
    await client.query('COMMIT')
    return { date, slotId, cancelled }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Classes with scheduling forms for the public or facility admin calendar picker.
 */
export async function loadSchedulingClasses(pool, { facilityId = null } = {}) {
  const { resolveProgramsSchema } = await import('../programs/schema.js')
  const schema = await resolveProgramsSchema(pool)
  const scope = facilityId != null
    ? 'AND p.facility_id = $1'
    : `AND sf.is_active = TRUE
       AND p.is_active = TRUE
       AND COALESCE(p.is_trial_assessment, FALSE) = FALSE`

  const result = await pool.query(
    `
    SELECT DISTINCT
      p.id,
      p.display_name AS "displayName",
      pr.display_name AS "programName",
      sf.id AS "formId"
    FROM scheduling_form sf
    JOIN program p ON p.id = sf.program_id
    LEFT JOIN ${schema.programsTable} pr ON pr.id = sf.programs_id
    WHERE sf.deleted_at IS NULL
      AND sf.program_id IS NOT NULL
      AND p.archived = FALSE
      AND (pr.id IS NULL OR pr.archived = FALSE)
      ${scope}
    ORDER BY pr.display_name NULLS LAST, p.display_name
    `,
    facilityId != null ? [facilityId] : [],
  )

  return result.rows.map((row) => ({
    id: Number(row.id),
    displayName: row.displayName,
    programName: row.programName ?? null,
    formId: Number(row.formId),
  }))
}
