import { expandCalendarRange } from './calendarExpansion.js'

function formatDateOnly(value) {
  if (value == null || value === '') return null
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
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
 *   programsId?: number | null,
 *   programId?: number | null,
 *   formActive?: 'all' | 'active' | 'inactive', // admin: filters program.is_active (class status)
 *   publicOnly?: boolean,
 * }} options
 */
export async function loadSchedulingCalendar(pool, options) {
  const { startDate, endDate, programsId = null, programId = null, formActive = 'all', publicOnly = false } = options

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
    if (hasSchedCols) {
      filters.push('(pr.id IS NULL OR COALESCE(pr.scheduling_active, TRUE) = TRUE)')
    }
  } else if (formActive === 'active') {
    filters.push('p.is_active = TRUE')
  } else if (formActive === 'inactive') {
    filters.push('p.is_active = FALSE')
  }

  if (programsId != null) {
    params.push(programsId)
    filters.push(`sf.programs_id = $${params.length}`)
  }
  if (programId != null) {
    params.push(programId)
    filters.push(`sf.program_id = $${params.length}`)
  }

  const result = await pool.query(
    `
    SELECT
      ts.*,
      sg.is_active AS sg_is_active,
      sg.active_start AS sg_active_start,
      sg.active_end AS sg_active_end,
      sg.dates_tbd AS sg_dates_tbd,
      sf.title AS form_title,
      sf.is_active AS form_is_active,
      sf.start_date AS form_start_date,
      sf.end_date AS form_end_date,
      sf.program_id,
      sf.programs_id,
      o.start_date AS offering_start_date,
      o.end_date AS offering_end_date,
      o.label AS offering_label,
      p.display_name AS class_name,
      p.description AS class_description,
      p.is_active AS class_is_active,
      p.skill_level,
      p.age_min,
      p.age_max,
      pr.display_name AS program_name,
      COALESCE(sc.name, 'No Category') AS category_name
    FROM scheduling_time_slot ts
    JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
    JOIN scheduling_form sf ON sf.id = ts.form_id
    JOIN program p ON p.id = sf.program_id
    LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
    LEFT JOIN ${schema.programsTable} pr ON pr.id = sf.programs_id
    LEFT JOIN scheduling_category sc ON sc.id = COALESCE(ts.category_id, sg.category_id)
    WHERE ${filters.join(' AND ')}
    ORDER BY ts.start_time, p.display_name, ts.id
    `,
    params,
  )

  return expandCalendarRange({ startDate, endDate, rows: result.rows })
}

/**
 * Distinct active classes with scheduling forms for calendar class picker.
 */
export async function loadPublicSchedulingClasses(pool) {
  const { resolveProgramsSchema, hasProgramSchedulingColumns } = await import('../programs/schema.js')
  const schema = await resolveProgramsSchema(pool)
  const hasSchedCols = await hasProgramSchedulingColumns(pool, schema.programsTable)

  const schedClause = hasSchedCols
    ? 'AND (pr.id IS NULL OR COALESCE(pr.scheduling_active, TRUE) = TRUE)'
    : ''

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
      AND sf.is_active = TRUE
      AND sf.program_id IS NOT NULL
      AND p.archived = FALSE
      AND p.is_active = TRUE
      AND (pr.id IS NULL OR pr.archived = FALSE)
      ${schedClause}
    ORDER BY pr.display_name NULLS LAST, p.display_name
    `,
  )

  return result.rows.map((row) => ({
    id: Number(row.id),
    displayName: row.displayName,
    programName: row.programName ?? null,
    formId: Number(row.formId),
  }))
}
