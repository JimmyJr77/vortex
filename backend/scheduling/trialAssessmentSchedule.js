import jwt from 'jsonwebtoken'
import { resolveJwtSecret } from '../auth/jwtSecret.js'
import { loadCanonicalAccessContext, resolveCanonicalTokenUserId } from '../platform/accessContext.js'
import { formatDateOnly } from './slotActiveDates.js'

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })
const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null
const time = value => String(value ?? '').slice(0, 5)
function date(value) {
  if (value == null || value === '') return null
  const key = String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || Number.isNaN(Date.parse(`${key}T12:00:00Z`))
      || new Date(`${key}T12:00:00Z`).toISOString().slice(0, 10) !== key) throw fail('Enter a valid schedule date.')
  return key
}

export function validateAssessmentTime(body = {}) {
  const scheduleMode = body.scheduleMode
  if (!['day', 'date'].includes(scheduleMode)) throw fail('Choose a weekly day or a specific date.')
  const startTime = String(body.startTime ?? '')
  const endTime = String(body.endTime ?? '')
  if (![startTime, endTime].every(value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) || endTime <= startTime) {
    throw fail('Enter an end time after the start time.')
  }
  const maxParticipants = Number(body.maxParticipants)
  if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 1000) throw fail('Capacity must be a whole number from 1 to 1000.')
  const dayOfWeek = scheduleMode === 'day' ? Number(body.dayOfWeek) : null
  if (scheduleMode === 'day' && (body.dayOfWeek == null || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) throw fail('Choose a day of the week.')
  const specificDate = scheduleMode === 'date' ? date(body.specificDate) : null
  if (scheduleMode === 'date' && !specificDate) throw fail('Choose an assessment date.')
  const activeStart = date(body.activeStart)
  const activeEnd = date(body.activeEnd)
  if (activeStart && activeEnd && activeEnd < activeStart) throw fail('The schedule end date must follow its start date.')
  if (specificDate && ((activeStart && specificDate < activeStart) || (activeEnd && specificDate > activeEnd))) throw fail('The assessment date must fall within its available date range.')
  return { scheduleMode, dayOfWeek, specificDate, startTime, endTime, maxParticipants, activeStart, activeEnd }
}

/** Use canonical current access, never role or facility claims from a token. */
export function createAssessmentStaffAuth(pool, { jwtSecret } = {}) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
    if (!token) return res.status(401).json({ success: false, message: 'Sign in to the Coach Portal.' })
    try {
      const decoded = jwt.verify(token, jwtSecret || resolveJwtSecret())
      const userId = await resolveCanonicalTokenUserId(pool, decoded)
      const access = await loadCanonicalAccessContext(pool, userId)
      if (!access?.isActive || !access.staffAccessActive || !access.facilityId || !(access.portalAccess.coach || access.portalAccess.admin)) {
        return res.status(403).json({ success: false, message: 'Active coach or administrator access is required.' })
      }
      req.assessmentStaff = access
      return next()
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
        return res.status(401).json({ success: false, message: 'Please sign in again.' })
      }
      console.error('[trial-assessment] authentication:', error)
      return res.status(500).json({ success: false, message: 'Unable to verify staff access.' })
    }
  }
}

async function loadAssessmentForm(db, formId, facilityId, required = true) {
  const row = (await db.query(
    `SELECT sf.id, sf.title, sf.start_date, sf.end_date, p.is_trial_assessment,
       COALESCE(NULLIF(f.timezone, ''), 'America/New_York') AS timezone,
       (clock_timestamp() AT TIME ZONE COALESCE(NULLIF(f.timezone, ''), 'America/New_York'))::date::text AS today
     FROM scheduling_form sf JOIN program p ON p.id = sf.program_id
     JOIN facility f ON f.id = p.facility_id
     WHERE sf.id = $1 AND p.facility_id = $2 AND sf.deleted_at IS NULL
       AND p.is_active = TRUE AND p.archived = FALSE`, [formId, facilityId],
  )).rows[0]
  if (required && !row?.is_trial_assessment) throw fail('Trial Assessment class not found in your facility.', 404)
  return row
}

async function loadAssessmentGroup(db, slotGroupId, facilityId, lock = false) {
  return (await db.query(
    `SELECT sg.*, CASE WHEN sg.inherits_offering_dates THEN offering.start_date ELSE COALESCE(sg.active_start, sf.start_date) END AS effective_start,
       CASE WHEN sg.inherits_offering_dates THEN offering.end_date ELSE COALESCE(sg.active_end, sf.end_date) END AS effective_end
     FROM scheduling_slot_group sg JOIN scheduling_form sf ON sf.id = sg.form_id
     JOIN program p ON p.id = sf.program_id
     LEFT JOIN scheduling_offering offering ON offering.id = sg.offering_id
     WHERE sg.id = $1 AND p.facility_id = $2 AND p.is_trial_assessment = TRUE
       AND p.is_active = TRUE AND p.archived = FALSE AND sf.deleted_at IS NULL AND sg.is_active = TRUE
     ${lock ? 'FOR UPDATE OF sg' : ''}`, [slotGroupId, facilityId],
  )).rows[0]
}

async function upcomingBookings(db, groupId, today) {
  return (await db.query(
    `SELECT class_date::text AS date, COUNT(*)::int AS count FROM drop_in_registration
     WHERE slot_group_id = $1 AND class_date >= $2::date
       AND status IN ('account_required', 'payment_pending', 'confirmed', 'attended')
       AND (status <> 'account_required' OR expires_at IS NULL OR expires_at > clock_timestamp())
     GROUP BY class_date`, [groupId, today],
  )).rows
}

/** Caller owns the transaction. Every assessment time gets its own slot group. */
export async function saveAssessmentTime(db, { facilityId, formId, slotGroupId = null, body }) {
  const form = await loadAssessmentForm(db, formId, facilityId)
  const value = validateAssessmentTime(body)
  if (value.specificDate && value.specificDate < form.today) throw fail('Choose a current or future assessment date.')
  if (value.specificDate === form.today) {
    const upcoming = (await db.query(`SELECT ($2::date + $3::time) > (clock_timestamp() AT TIME ZONE $1) AS upcoming`, [form.timezone, value.specificDate, value.startTime])).rows[0]
    if (!upcoming?.upcoming) throw fail('Choose an assessment time that has not started.')
  }
  if (value.activeEnd && value.activeEnd < form.today) throw fail('The assessment schedule has already ended.')
  let group = null
  let slot = null
  if (slotGroupId != null) {
    group = await loadAssessmentGroup(db, slotGroupId, facilityId, true)
    if (!group || Number(group.form_id) !== Number(formId)) throw fail('Assessment time not found.', 404)
    const slots = (await db.query('SELECT * FROM scheduling_time_slot WHERE slot_group_id = $1 AND is_active = TRUE ORDER BY id', [slotGroupId])).rows
    if (slots.length !== 1) throw fail('Each assessment schedule must contain one time. Ask an administrator to separate this schedule before editing.', 409)
    slot = slots[0]
    const bookings = await upcomingBookings(db, slotGroupId, form.today)
    const datesChanged = formatDateOnly(group.effective_start) !== (value.activeStart || form.today)
      || formatDateOnly(group.effective_end) !== value.activeEnd
    const moved = String(slot.schedule_mode) !== value.scheduleMode || Number(slot.day_of_week) !== Number(value.dayOfWeek)
      || formatDateOnly(slot.specific_date) !== value.specificDate || time(slot.start_time) !== value.startTime || time(slot.end_time) !== value.endTime
    const reserved = (await db.query('SELECT pending_registration_holds($1) AS count', [slotGroupId])).rows[0]
    if ((bookings.length || Number(reserved?.count || 0)) && (moved || datesChanged)) throw fail('Families are already booked for this assessment. Keep its current time and dates, or add a separate time and contact those families before moving it.', 409)
    const occupied = Math.max(0, ...bookings.map(booking => Number(booking.count))) + Number(reserved?.count || 0)
    if (value.maxParticipants < occupied) throw fail(`Capacity cannot be lower than ${occupied} booked or reserved places.`, 409)
  }
  const activeStart = value.activeStart || form.today
  const offering = group?.offering_id ?? (await db.query('SELECT id FROM scheduling_offering WHERE form_id = $1 ORDER BY is_selected DESC, id LIMIT 1', [formId])).rows[0]?.id ?? null
  if (group) {
    await db.query(`UPDATE scheduling_slot_group SET schedule_mode=$2,max_participants=$3,active_start=$4,active_end=$5,
      inherits_offering_dates=FALSE,dates_tbd=FALSE,updated_at=now() WHERE id=$1`, [slotGroupId, value.scheduleMode, value.maxParticipants, activeStart, value.activeEnd])
    await db.query(`UPDATE scheduling_time_slot SET schedule_mode=$2,day_of_week=$3,specific_date=$4,start_time=$5,end_time=$6,
      max_participants=$7,active_start=$8,active_end=$9,week_letter=CASE WHEN $2::varchar='day' THEN 'A' ELSE NULL END,dates_tbd=FALSE,updated_at=now() WHERE id=$1`,
    [slot.id, value.scheduleMode, value.dayOfWeek, value.specificDate, value.startTime, value.endTime, value.maxParticipants, activeStart, value.activeEnd])
  } else {
    group = (await db.query(`INSERT INTO scheduling_slot_group (form_id,offering_id,schedule_mode,max_participants,active_start,active_end,inherits_offering_dates,dates_tbd,is_active)
      VALUES ($1,$2,$3,$4,$5,$6,FALSE,FALSE,TRUE) RETURNING id`, [formId, offering, value.scheduleMode, value.maxParticipants, activeStart, value.activeEnd])).rows[0]
    slotGroupId = Number(group.id)
    await db.query(`INSERT INTO scheduling_time_slot (form_id,slot_group_id,schedule_mode,week_letter,day_of_week,specific_date,start_time,end_time,max_participants,active_start,active_end,dates_tbd,is_active)
      VALUES ($1,$2,$3,CASE WHEN $3::varchar='day' THEN 'A' ELSE NULL END,$4,$5,$6,$7,$8,$9,$10,FALSE,TRUE)`,
    [formId, slotGroupId, value.scheduleMode, value.dayOfWeek, value.specificDate, value.startTime, value.endTime, value.maxParticipants, activeStart, value.activeEnd])
  }
  await db.query(`UPDATE scheduling_form SET start_date=dates.start_date,end_date=dates.end_date,updated_at=now()
    FROM (SELECT MIN(active_start) AS start_date,
      CASE WHEN COUNT(*) FILTER (WHERE active_end IS NULL)>0 THEN NULL ELSE MAX(active_end) END AS end_date
      FROM scheduling_slot_group WHERE form_id=$1 AND is_active=TRUE AND dates_tbd=FALSE) dates
    WHERE scheduling_form.id=$1`, [formId])
  return { slotGroupId: Number(slotGroupId), formId: Number(formId), ...value, activeStart }
}

export async function listAssessmentSchedules(db, facilityId) {
  const forms = (await db.query(`SELECT sf.id, sf.title, p.display_name AS class_name, COALESCE(NULLIF(f.timezone,''),'America/New_York') AS timezone,
      (clock_timestamp() AT TIME ZONE COALESCE(NULLIF(f.timezone,''),'America/New_York'))::date::text AS today
    FROM scheduling_form sf JOIN program p ON p.id=sf.program_id JOIN facility f ON f.id=p.facility_id
    WHERE p.facility_id=$1 AND p.is_trial_assessment=TRUE AND p.is_active=TRUE AND p.archived=FALSE AND sf.deleted_at IS NULL ORDER BY p.id,sf.id`, [facilityId])).rows
  const schedules = (await db.query(`SELECT sg.id,sg.form_id,sg.max_participants,sg.dates_tbd,ts.id AS time_slot_id,ts.schedule_mode,
      ts.day_of_week,ts.specific_date,ts.start_time,ts.end_time,
      CASE WHEN sg.inherits_offering_dates THEN o.start_date ELSE COALESCE(sg.active_start,sf.start_date) END AS active_start,
      CASE WHEN sg.inherits_offering_dates THEN o.end_date ELSE COALESCE(sg.active_end,sf.end_date) END AS active_end
    FROM scheduling_slot_group sg JOIN scheduling_form sf ON sf.id=sg.form_id JOIN program p ON p.id=sf.program_id
    JOIN scheduling_time_slot ts ON ts.slot_group_id=sg.id AND ts.is_active=TRUE
    LEFT JOIN scheduling_offering o ON o.id=sg.offering_id
    WHERE p.facility_id=$1 AND p.is_trial_assessment=TRUE AND p.is_active=TRUE AND p.archived=FALSE
      AND sf.deleted_at IS NULL AND sg.is_active=TRUE ORDER BY sg.id,ts.id`, [facilityId])).rows
  return forms.map(form => ({ id: Number(form.id), name: form.class_name, timeZone: form.timezone, today: form.today,
    schedules: schedules.filter(row => Number(row.form_id) === Number(form.id)).map(row => ({
      slotGroupId: Number(row.id), timeSlotId: Number(row.time_slot_id), scheduleMode: row.schedule_mode,
      dayOfWeek: row.day_of_week, specificDate: formatDateOnly(row.specific_date), startTime: time(row.start_time), endTime: time(row.end_time),
      maxParticipants: Number(row.max_participants), activeStart: formatDateOnly(row.active_start), activeEnd: formatDateOnly(row.active_end),
      datesTbd: Boolean(row.dates_tbd),
    })),
  }))
}

function sendError(res, error) {
  if (!error.statusCode) console.error('[trial-assessment] schedule:', error)
  return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Unable to save the assessment schedule. Please try again.' })
}

export function registerTrialAssessmentScheduleRoutes(app, pool, options = {}) {
  const auth = createAssessmentStaffAuth(pool, options)
  app.get('/api/coach/trial-assessments', auth, async (req, res) => {
    try { res.set('Cache-Control', 'no-store'); return res.json({ success: true, data: await listAssessmentSchedules(pool, req.assessmentStaff.facilityId) }) }
    catch (error) { return sendError(res, error) }
  })
  const save = async (req, res) => {
    const formId = positiveId(req.params.formId)
    const slotGroupId = req.params.slotGroupId == null ? null : positiveId(req.params.slotGroupId)
    if (!formId || (req.params.slotGroupId != null && !slotGroupId)) return sendError(res, fail('Invalid assessment schedule.'))
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await saveAssessmentTime(client, { facilityId: req.assessmentStaff.facilityId, formId, slotGroupId, body: req.body })
      await client.query('COMMIT')
      return res.json({ success: true, data: result })
    } catch (error) { await client.query('ROLLBACK'); return sendError(res, error) }
    finally { client.release() }
  }
  app.post('/api/coach/trial-assessments/:formId/times', auth, save)
  app.patch('/api/coach/trial-assessments/:formId/times/:slotGroupId', auth, save)
}

/** Convert the existing admin builder into one assessment time, without expanding arbitrary ranges. */
export function assessmentTimeFromAdminBatch(body, defaults = {}) {
  let row
  if (body.scheduleMode === 'day') {
    const weeks = body.daySchedule?.weeks
    if (weeks?.length === 1 && weeks[0].days?.length === 1 && weeks[0].days[0].times?.length === 1) {
      const day = weeks[0].days[0]
      row = { ...day.times[0], dayOfWeek: day.dayOfWeek }
    }
  } else if (body.scheduleMode === 'date') {
    const entries = body.dateSchedule?.entries
    if (entries?.length === 1 && entries[0].type === 'single' && entries[0].times?.length === 1) row = { ...entries[0].times[0], specificDate: entries[0].date }
  }
  if (!row || body.activeDatesMode === 'tbd') throw fail('Create each Trial Assessment day and time as a separate schedule. Choose one day or one date and one start/end time.')
  return { ...defaults, ...row, scheduleMode: body.scheduleMode, maxParticipants: body.maxParticipants ?? row.maxParticipants,
    activeStart: body.activeDatesMode === 'custom' ? body.activeStart : defaults.activeStart,
    activeEnd: body.activeDatesMode === 'custom' ? body.activeEnd : defaults.activeEnd }
}

/** Register after admin authentication and before general scheduling routes. Other classes pass through. */
export function registerAssessmentAdminScheduleGuards(app, pool) {
  const intercept = kind => async (req, res, next) => {
    const facilityId = req.canonicalAccess?.facilityId
    if (!facilityId) return next()
    let client
    try {
      let formId = kind === 'form' ? positiveId(req.params.formId) : null
      let groupId = kind === 'group' ? positiveId(req.params.id) : null
      if (kind === 'time') groupId = Number((await pool.query('SELECT slot_group_id FROM scheduling_time_slot WHERE id=$1', [req.params.id])).rows[0]?.slot_group_id) || null
      if (groupId) formId = Number((await pool.query('SELECT form_id FROM scheduling_slot_group WHERE id=$1', [groupId])).rows[0]?.form_id) || null
      if (!formId) return next()
      const target = (await pool.query(`SELECT p.is_trial_assessment,p.facility_id FROM scheduling_form sf
        JOIN program p ON p.id=sf.program_id WHERE sf.id=$1`, [formId])).rows[0]
      if (!target?.is_trial_assessment) return next()
      if (Number(target.facility_id) !== Number(facilityId)) throw fail('Assessment schedule belongs to another facility.', 403)
      const form = await loadAssessmentForm(pool, formId, facilityId)
      client = await pool.connect()
      await client.query('BEGIN')
      const group = groupId ? await loadAssessmentGroup(client, groupId, facilityId, true) : null
      if (groupId && !group) throw fail('Assessment time not found.', 404)
      if (req.method === 'DELETE') {
        if ((await upcomingBookings(client, groupId, form.today)).length) throw fail('Families are already booked for this assessment. Contact them and resolve their reservations before removing the time.', 409)
        await client.query('UPDATE scheduling_time_slot SET is_active=FALSE,updated_at=now() WHERE slot_group_id=$1', [groupId])
        await client.query('UPDATE scheduling_slot_group SET is_active=FALSE,updated_at=now() WHERE id=$1', [groupId])
        await client.query('COMMIT')
        return res.json({ success: true, data: { id: Number(groupId) } })
      }
      const current = groupId ? (await client.query('SELECT * FROM scheduling_time_slot WHERE slot_group_id=$1 AND is_active=TRUE ORDER BY id', [groupId])).rows[0] : null
      const defaults = { scheduleMode: current?.schedule_mode, dayOfWeek: current?.day_of_week, specificDate: formatDateOnly(current?.specific_date),
        startTime: time(current?.start_time), endTime: time(current?.end_time), maxParticipants: Number(group?.max_participants),
        activeStart: formatDateOnly(group?.effective_start) || form.today, activeEnd: formatDateOnly(group?.effective_end) }
      const body = req.body.scheduleMode ? assessmentTimeFromAdminBatch(req.body, defaults) : { ...defaults, maxParticipants: req.body.maxParticipants }
      const result = await saveAssessmentTime(client, { facilityId, formId, slotGroupId: groupId, body })
      await client.query('COMMIT')
      return res.json({ success: true, data: result, count: 1 })
    } catch (error) { if (client) await client.query('ROLLBACK'); return sendError(res, error) }
    finally { client?.release() }
  }
  app.post('/api/admin/scheduling/forms/:formId/slot-batches', intercept('form'))
  app.patch('/api/admin/scheduling/slot-groups/:id', intercept('group'))
  app.patch('/api/admin/scheduling/time-slots/:id', intercept('time'))
  app.delete('/api/admin/scheduling/slot-groups/:id', intercept('group'))
  app.delete('/api/admin/scheduling/time-slots/:id', intercept('time'))
  app.patch('/api/admin/programs/:classId/time-slots/:slotId/archive', async (req, res, next) => {
    let client
    try {
      const target = (await pool.query(`SELECT p.is_trial_assessment,p.facility_id,sg.id AS group_id,
          (clock_timestamp() AT TIME ZONE COALESCE(NULLIF(f.timezone,''),'America/New_York'))::date::text AS today
        FROM scheduling_time_slot ts JOIN scheduling_slot_group sg ON sg.id=ts.slot_group_id
        JOIN scheduling_form sf ON sf.id=sg.form_id JOIN program p ON p.id=sf.program_id
        JOIN facility f ON f.id=p.facility_id
        WHERE ts.id=$1 AND p.id=$2 AND sf.deleted_at IS NULL`, [req.params.slotId, req.params.classId])).rows[0]
      if (!target?.is_trial_assessment) return next()
      if (Number(target.facility_id) !== Number(req.canonicalAccess?.facilityId)) throw fail('Assessment schedule belongs to another facility.', 403)
      if (typeof req.body?.archived !== 'boolean') throw fail('Choose whether to archive or restore this assessment time.')
      client = await pool.connect()
      await client.query('BEGIN')
      await client.query('SELECT id FROM scheduling_slot_group WHERE id=$1 FOR UPDATE', [target.group_id])
      if (req.body.archived && (await upcomingBookings(client, target.group_id, target.today)).length) {
        throw fail('Families are already booked for this assessment. Contact them and resolve their reservations before archiving the time.', 409)
      }
      if (!req.body.archived) {
        const siblings = (await client.query('SELECT COUNT(*)::int AS count FROM scheduling_time_slot WHERE slot_group_id=$1 AND id<>$2 AND is_active=TRUE', [target.group_id, req.params.slotId])).rows[0]
        if (Number(siblings?.count || 0) > 0) throw fail('Restore each Trial Assessment time as a separate schedule so families can select the correct session.', 409)
      }
      await client.query('UPDATE scheduling_time_slot SET is_active=$2,updated_at=now() WHERE id=$1', [req.params.slotId, !req.body.archived])
      await client.query(`UPDATE scheduling_slot_group SET is_active=EXISTS (
        SELECT 1 FROM scheduling_time_slot WHERE slot_group_id=$1 AND is_active=TRUE),updated_at=now() WHERE id=$1`, [target.group_id])
      await client.query('COMMIT')
      return res.json({ success: true, data: { id: Number(req.params.slotId), is_active: !req.body.archived } })
    } catch (error) { if (client) await client.query('ROLLBACK'); return sendError(res, error) }
    finally { client?.release() }
  })

  // Broad form/offering mutations can move many inherited times at once and bypass
  // reservation checks. Assessment dates and capacity are edited per time instead.
  const protectClass = kind => async (req, res, next) => {
    try {
      const target = (await pool.query(kind === 'offering'
        ? `SELECT sf.id,p.is_trial_assessment,o.start_date,o.end_date FROM scheduling_offering o JOIN scheduling_form sf ON sf.id=o.form_id JOIN program p ON p.id=sf.program_id WHERE o.id=$1`
        : `SELECT sf.id,p.is_trial_assessment,sf.start_date,sf.end_date FROM scheduling_form sf JOIN program p ON p.id=sf.program_id WHERE sf.id=$1`, [req.params.id])).rows[0]
      if (!target?.is_trial_assessment) return next()
      const changesSchedule = req.method === 'DELETE' || req.body?.isActive === false
        || (Object.hasOwn(req.body ?? {}, 'startDate') && formatDateOnly(req.body.startDate) !== formatDateOnly(target.start_date))
        || (Object.hasOwn(req.body ?? {}, 'endDate') && formatDateOnly(req.body.endDate) !== formatDateOnly(target.end_date))
        || (req.body?.evergreen === true && target.end_date != null)
      if (!changesSchedule) return next()
      return sendError(res, fail('Manage Trial Assessment availability on each individual time in the class schedule. This keeps existing family reservations protected.', 409))
    } catch (error) { return sendError(res, error) }
  }
  app.put('/api/admin/scheduling/forms/:id', protectClass('form'))
  app.put('/api/admin/scheduling/forms/:id/active-dates', protectClass('form'))
  app.patch('/api/admin/scheduling/forms/:id/active', protectClass('form'))
  app.delete('/api/admin/scheduling/forms/:id', protectClass('form'))
  app.put('/api/admin/scheduling/offerings/:id', protectClass('offering'))
  app.delete('/api/admin/scheduling/offerings/:id', protectClass('offering'))
}
