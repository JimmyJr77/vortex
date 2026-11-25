import { formatDateOnly } from './slotActiveDates.js'
import { resolveEffectiveFormPricing } from '../programs/pricingDefaults.js'
import { hydrateProgramPricingRow } from '../programs/programPricingOptions.js'
import { calculateDropInPrice } from '../shared/dropInPricing.js'
import { assertCurrentMemberWaivers } from '../platform/waiverCompletion.js'
import { DROP_IN_CALENDAR_COLUMNS, DROP_IN_POLICY_COLUMNS, dropInOccurrences } from './dropInOccurrences.js'
import { lockSchedulingDay } from './dayCancellation.js'
import { isPrivateAssessmentTime } from './trialAssessmentPolicy.js'

const DEFAULT_TIME_ZONE = 'America/New_York'
const TRIAL_PROGRAMS = new Set(['gymnastics', 'fit-flip'])
const GYMNASTICS_TRACKS = new Set(['mommy-me', 'preschool', 'beginner', 'experienced'])

function trialError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode })
}

export function validateTrialSelection(value, { requireMemberIndex = false } = {}) {
  if (!value || typeof value !== 'object' || !TRIAL_PROGRAMS.has(value.program)) {
    throw trialError('Choose Gymnastics or Fit & Flip for your trial.')
  }
  const slotGroupId = Number(value.slotGroupId)
  const classDate = String(value.classDate ?? '')
  if (!Number.isSafeInteger(slotGroupId) || slotGroupId <= 0) throw trialError('Choose an available class time.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(classDate) || Number.isNaN(Date.parse(`${classDate}T12:00:00Z`))
      || new Date(`${classDate}T12:00:00Z`).toISOString().slice(0, 10) !== classDate) {
    throw trialError('Choose a valid trial date.')
  }
  const memberIndex = Number(value.memberIndex)
  if (requireMemberIndex && (!Number.isSafeInteger(memberIndex) || memberIndex < 1)) {
    throw trialError('Choose a child in the family for this free trial.')
  }
  const qualification = {}
  if (value.program === 'gymnastics') {
    if (!GYMNASTICS_TRACKS.has(value.gymnasticsTrack)) throw trialError('Choose the appropriate gymnastics trial pathway.')
    if (value.experience === 'experienced' && value.gymnasticsTrack !== 'experienced') {
      throw trialError('Athletes with gymnastics experience must choose a private evaluation.')
    }
    qualification.gymnasticsTrack = value.gymnasticsTrack
    if (value.gymnasticsTrack === 'mommy-me') {
      if (value.pottyTrained !== true) throw trialError('Mommy & Me trial participants must be potty trained.')
      qualification.pottyTrained = true
    }
    if (['beginner', 'experienced'].includes(value.gymnasticsTrack)) {
      const required = value.gymnasticsTrack === 'beginner' ? 'none' : 'experienced'
      if (value.experience !== required) throw trialError('Tell us about your child’s gymnastics experience before choosing a trial.')
      qualification.experience = required
    }
  }
  return { program: value.program, slotGroupId, classDate, ...qualification, ...(requireMemberIndex ? { memberIndex } : {}) }
}

export function trialAgeOnDate(dateOfBirth, classDate) {
  const birth = formatDateOnly(dateOfBirth)
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth) || birth > classDate) return null
  const [year, month, day] = birth.split('-').map(Number)
  const [atYear, atMonth, atDay] = classDate.split('-').map(Number)
  return atYear - year - (atMonth < month || (atMonth === month && atDay < day) ? 1 : 0)
}

export function fitFlipAgeBand(age) {
  if (age >= 8 && age <= 11) return { min: 8, max: 11 }
  if (age >= 12 && age <= 15) return { min: 12, max: 15 }
  return null
}

export function gymnasticsRouting(age) {
  if (age >= 2 && age <= 3) return { track: 'mommy-me' }
  if (age >= 4 && age <= 5) return { track: 'preschool' }
  if (age >= 6 && age < 18) return { track: 'school-age' }
  return { track: 'contact', reason: 'Please contact the team for the right class placement for this age.' }
}

export function matchesFreeTrialClass(row, program, age, qualification = {}) {
  if (!TRIAL_PROGRAMS.has(program) || !Number.isInteger(age) || age < 0 || age >= 18) return false
  const names = `${row.programName ?? ''} ${row.className ?? ''}`
  const fitFlip = /\bfit\s*(?:&|and|n)?\s*flip\b|\bf\s*&\s*f\b/i.test(names)
  const min = row.ageMin == null ? null : Number(row.ageMin)
  const max = row.ageMax == null ? null : Number(row.ageMax)
  if ((min != null && age < min) || (max != null && age > max)) return false
  if (row.isTrialAssessment === true && (program !== 'gymnastics' || qualification.gymnasticsTrack !== 'experienced')) return false
  if (program === 'fit-flip') {
    const band = fitFlipAgeBand(age)
    // Both introductory cohort names are used in the staff-managed catalog.
    if (!band || !fitFlip || !/\b(?:cyclones?|tornado(?:e)?s?)\b/i.test(row.className ?? '')) return false
    // Prefer canonical age metadata; names support older configured classes without both bounds.
    if (min != null && max != null) return min === band.min && max === band.max
    return new RegExp(`\\b${band.min}\\s*[-–—]\\s*${band.max}\\b`).test(row.className ?? '')
  }
  if (fitFlip || !/gymnastics/i.test(`${row.programName ?? ''} ${row.sportName ?? ''}`)) return false
  const track = qualification.gymnasticsTrack
  if (qualification.experience === 'experienced' && track !== 'experienced') return false
  if (track === 'mommy-me') return age >= 2 && age <= 3 && qualification.pottyTrained === true && /mommy\s*(?:&|and)\s*me/i.test(row.className ?? '')
  if (track === 'preschool') return age >= 4 && age <= 5 && /pre[ -]?school/i.test(row.className ?? '')
  if (track === 'beginner') return age >= 6 && qualification.experience === 'none' && /\btornado(?:e)?s?\b/i.test(row.className ?? '')
  if (track === 'experienced') {
    // Assessment times come from the scheduler so staff changes are reflected immediately.
    return qualification.experience === 'experienced' && row.isTrialAssessment === true
  }
  return false
}

function localDateAndTime(now, timeZone = DEFAULT_TIME_ZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

export function filterFreeTrialCatalog(catalog, { program, age, now = new Date(), ...qualification }) {
  const occurrences = new Map()
  for (const row of catalog.sessions) {
    const key = `${row.slotGroupId}:${row.date}`
    if (!occurrences.has(key)) occurrences.set(key, new Map())
    occurrences.get(key).set(`${row.startTime}:${row.endTime}`, row)
  }
  // A registration identifies a group/date, so multiple times on that occurrence are not individually bookable.
  const uniqueOccurrences = [...occurrences.values()].flatMap(times => times.size === 1 ? [...times.values()] : [])
  const sessions = uniqueOccurrences.filter(row => {
    if (!matchesFreeTrialClass(row, program, age, qualification)) return false
    if (row.isTrialAssessment && !isPrivateAssessmentTime(row)) return false
    const current = localDateAndTime(now, row.timeZone || DEFAULT_TIME_ZONE)
    return row.date > current.date || (row.date === current.date && row.startTime > current.time)
  }).map(row => ({ ...row, benefitType: 'free_trial', totalCents: 0 }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.slotGroupId - b.slotGroupId)
  const classIds = new Set(sessions.map(row => row.classId))
  return {
    program,
    age,
    ageBand: program === 'fit-flip' ? fitFlipAgeBand(age) : null,
    ...(program === 'gymnastics' ? { gymnasticsRouting: gymnasticsRouting(age) } : {}),
    classes: catalog.classes.filter(row => classIds.has(row.classId)).map(row => ({ ...row, benefitType: 'free_trial', totalCents: 0 })),
    sessions,
  }
}

export function registerFreeTrialCatalogRoutes(app, pool, loadCatalog) {
  app.get('/api/public/free-trials', async (req, res) => {
    const program = String(req.query.program ?? '')
    const age = Number(req.query.age)
    if (!TRIAL_PROGRAMS.has(program) || !/^\d{1,2}$/.test(String(req.query.age ?? '')) || age < 0 || age >= 18) {
      return res.status(400).json({ success: false, message: 'Choose a program and enter the child’s age (under 18).' })
    }
    try {
      const catalog = await loadCatalog(pool, null)
      res.set('Cache-Control', 'no-store')
      return res.json({ success: true, data: filterFreeTrialCatalog(catalog, {
        program, age, gymnasticsTrack: req.query.gymnasticsTrack,
        pottyTrained: req.query.pottyTrained === 'true', experience: req.query.experience,
      }) })
    } catch (error) {
      console.error('[free-trials] catalog:', error)
      return res.status(500).json({ success: false, message: 'We could not load trial classes. Please try again.' })
    }
  })
}

export async function assertCurrentTrialWaivers(client, memberId, facilityId) {
  return assertCurrentMemberWaivers(client, memberId, facilityId, 'free trial')
}

/** Caller owns the transaction, guardian authorization, and waiver acceptance. Never creates billing or monthly enrollments. */
export async function bookMemberFreeTrial(client, value, { memberId, facilityId, contactEmail, contactPhone = null }) {
  const selection = validateTrialSelection(value)
  const member = (await client.query(
    `SELECT id, facility_id, first_name, last_name, date_of_birth
       FROM member WHERE id = $1 AND facility_id = $2 AND is_active = TRUE FOR UPDATE`,
    [memberId, facilityId],
  )).rows[0]
  if (!member) throw trialError('The selected athlete is not available in this family.', 403)
  const age = trialAgeOnDate(member.date_of_birth, selection.classDate)
  if (age == null || age < 0 || age >= 18) throw trialError('A child’s valid date of birth is required for this trial.')

  // Match the existing drop-in lock order (entitlement, then slot) and serialize the child's credit.
  await client.query('INSERT INTO member_drop_in_entitlement (member_id) VALUES ($1) ON CONFLICT (member_id) DO NOTHING', [memberId])
  const entitlement = (await client.query('SELECT lifetime_trial_granted FROM member_drop_in_entitlement WHERE member_id = $1 FOR UPDATE', [memberId])).rows[0]
  await client.query(`UPDATE drop_in_registration SET status = 'cancelled', updated_at = now()
    WHERE member_id = $1 AND benefit_type = 'free_trial' AND status = 'account_required' AND expires_at <= now()`, [memberId])

  // Use a fresh snapshot after any concurrent cancellation or eligibility edit.
  await lockSchedulingDay(client, facilityId, selection.classDate, { shared: true })
  if (selection.program === 'gymnastics' && selection.gymnasticsTrack === 'experienced') {
    // Separate/duplicate schedule groups must not reserve the same private
    // evaluation time concurrently. Take this before any group lock.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [
      `private-trial-assessment:${facilityId}:${selection.classDate}`,
    ])
  }
  await client.query(`SELECT sg.id FROM scheduling_slot_group sg
    JOIN scheduling_form sf ON sf.id=sg.form_id
    JOIN program p ON p.id=sf.program_id
    WHERE sg.id=$1 AND p.facility_id=$2 FOR UPDATE OF sg`, [selection.slotGroupId, facilityId])
  const rows = (await client.query(
    `SELECT ${DROP_IN_CALENDAR_COLUMNS}, sg.id AS slot_group_id, sg.form_id, sg.max_participants, sg.dates_tbd,
            ${DROP_IN_POLICY_COLUMNS},
            ts.day_of_week, ts.specific_date, ts.start_time, ts.end_time,
            p.display_name AS class_name, p.age_min, p.age_max, p.is_trial_assessment,
            top.display_name AS program_name, primary_dt.name AS sport_name,
            to_jsonb(sf) AS pricing_form, to_jsonb(top) AS pricing_program,
            CASE WHEN offering.id IS NOT NULL AND (sg.inherits_offering_dates OR (sg.active_start IS NULL AND sg.active_end IS NULL))
              THEN offering.start_date ELSE COALESCE(sg.active_start, sf.start_date) END AS active_start,
            CASE WHEN offering.id IS NOT NULL AND (sg.inherits_offering_dates OR (sg.active_start IS NULL AND sg.active_end IS NULL))
              THEN offering.end_date ELSE COALESCE(sg.active_end, sf.end_date) END AS active_end,
            ((now() AT TIME ZONE COALESCE(NULLIF(facility.timezone, ''), 'America/New_York'))::date)::text AS facility_date,
            (((now() AT TIME ZONE COALESCE(NULLIF(facility.timezone, ''), 'America/New_York'))::date + INTERVAL '2 months')::date)::text AS booking_end_date,
            ($2::date = (now() AT TIME ZONE COALESCE(NULLIF(facility.timezone, ''), 'America/New_York'))::date
              AND ts.start_time <= (now() AT TIME ZONE COALESCE(NULLIF(facility.timezone, ''), 'America/New_York'))::time) AS has_started
       FROM scheduling_slot_group sg
       JOIN scheduling_form sf ON sf.id = sg.form_id AND sf.deleted_at IS NULL
       JOIN scheduling_time_slot ts ON ts.slot_group_id = sg.id
       JOIN program p ON p.id = sf.program_id
       JOIN programs top ON top.id = COALESCE(sf.programs_id, p.programs_id)
       JOIN facility ON facility.id = top.facility_id
       LEFT JOIN discipline_tag primary_dt ON primary_dt.id = top.primary_discipline_tag_id
       LEFT JOIN scheduling_offering offering ON offering.id = sg.offering_id
      WHERE sg.id = $1 AND top.facility_id = $3 AND p.facility_id = $3 AND sg.is_active = TRUE
        AND COALESCE(p.is_active, TRUE) = TRUE AND COALESCE(p.archived, FALSE) = FALSE
        AND COALESCE(top.is_active, TRUE) = TRUE AND COALESCE(top.archived, FALSE) = FALSE
      FOR UPDATE OF sg`,
    [selection.slotGroupId, selection.classDate, facilityId],
  )).rows
  const occurrences = dropInOccurrences(rows, selection.classDate)
    .filter(({ row, cancelled, allowsFreeTrial }) => !cancelled && allowsFreeTrial && !row.has_started
      && selection.classDate >= row.facility_date && selection.classDate <= row.booking_end_date)
    .map(occurrence => occurrence.row)
  if (new Set(occurrences.map(row => `${row.start_time}:${row.end_time}`)).size > 1) {
    throw trialError('This class has multiple times attached to the same reservation. Please contact the team to choose the correct time.', 409)
  }
  const slot = occurrences[0]
  if (!slot) throw trialError('That class time is no longer available. Please choose another date.', 409)
  if (slot.is_trial_assessment && !isPrivateAssessmentTime({ startTime: slot.start_time, endTime: slot.end_time, maxParticipants: slot.max_participants })) {
    throw trialError('That private evaluation time is no longer available. Please choose a 30-minute evaluation for one athlete.', 409)
  }
  if (!matchesFreeTrialClass({ programName: slot.program_name, className: slot.class_name, sportName: slot.sport_name, ageMin: slot.age_min, ageMax: slot.age_max, isTrialAssessment: slot.is_trial_assessment }, selection.program, age, selection)) {
    throw trialError('The athlete’s age on the trial date does not match this program and class. Please choose an appropriate class.')
  }
  await assertCurrentTrialWaivers(client, memberId, facilityId)

  const previous = (await client.query(
    `SELECT id, slot_group_id, class_date, status, amount_cents FROM drop_in_registration
      WHERE member_id = $1 AND benefit_type = 'free_trial' AND status <> 'cancelled' ORDER BY id`, [memberId],
  )).rows
  const same = previous.find(row => Number(row.slot_group_id) === selection.slotGroupId && formatDateOnly(row.class_date) === selection.classDate && ['confirmed', 'attended'].includes(row.status))
  if (same && Number(same.amount_cents) === 0) return { id: Number(same.id), memberId: Number(memberId), status: 'confirmed', benefitType: 'free_trial', totalCents: 0, ...selection, ...(slot.is_trial_assessment ? { isTrialAssessment: true } : {}), reused: true }
  if (previous.length || Number(entitlement?.lifetime_trial_granted ?? 0) < 1) throw trialError('This athlete has already used their one-time free trial.', 409)

  if (slot.is_trial_assessment) {
    const overlap = await client.query(`SELECT booking.id AS overlapping_assessment_id
      FROM drop_in_registration booking
      JOIN scheduling_form form ON form.id=booking.form_id
      JOIN program assessment ON assessment.id=form.program_id
      JOIN scheduling_time_slot time ON time.slot_group_id=booking.slot_group_id
      WHERE assessment.facility_id=$1 AND assessment.is_trial_assessment=TRUE
        AND booking.class_date=$2::date AND booking.slot_group_id<>$3
        AND booking.status IN ('account_required','payment_pending','confirmed','attended')
        AND (booking.status<>'account_required' OR booking.expires_at IS NULL OR booking.expires_at>clock_timestamp())
        AND time.start_time<$5::time AND time.end_time>$4::time LIMIT 1`,
    [facilityId, selection.classDate, selection.slotGroupId, slot.start_time, slot.end_time])
    if (overlap.rows.length) throw trialError('That private evaluation time has already been booked. Please choose another time.', 409)
  }

  const alreadyEnrolled = await client.query(
    `SELECT id FROM scheduling_signup WHERE member_id = $1 AND slot_group_id = $2 AND status = 'confirmed'
       AND orphaned_at IS NULL AND archived_at IS NULL AND enrollment_start_date <= $3::date
       AND (cancel_effective_date IS NULL OR cancel_effective_date > $3::date) LIMIT 1`,
    [memberId, selection.slotGroupId, selection.classDate],
  )
  if (alreadyEnrolled.rows.length) throw trialError('This athlete is already enrolled in that class. Please choose a different trial.', 409)
  const existingOccurrence = await client.query(
    'SELECT id, status FROM drop_in_registration WHERE member_id = $1 AND slot_group_id = $2 AND class_date = $3::date LIMIT 1',
    [memberId, selection.slotGroupId, selection.classDate],
  )
  if (existingOccurrence.rows.length) {
    throw trialError(existingOccurrence.rows[0].status === 'cancelled'
      ? 'This athlete has a cancelled reservation for that date. Please contact the team to restore it, or choose a different date.'
      : 'This athlete already has a reservation for that class date.', 409)
  }

  const counts = (await client.query(
    `SELECT
       (SELECT COUNT(*) FROM scheduling_signup signup WHERE signup.slot_group_id = $1 AND signup.status = 'confirmed'
          AND signup.orphaned_at IS NULL AND signup.archived_at IS NULL
          AND signup.enrollment_start_date <= $2::date
          AND (signup.cancel_effective_date IS NULL OR signup.cancel_effective_date > $2::date))::int AS monthly,
       pending_registration_holds($1) AS registration_holds,
       (SELECT COUNT(*) FROM drop_in_registration booking WHERE booking.slot_group_id = $1 AND booking.class_date = $2::date
          AND booking.status IN ('account_required','payment_pending','confirmed','attended')
          AND (booking.status <> 'account_required' OR booking.expires_at IS NULL OR booking.expires_at > now()))::int AS drop_ins`,
    [selection.slotGroupId, selection.classDate],
  )).rows[0]
  if (Number(counts.monthly) + Number(counts.drop_ins) + Number(counts.registration_holds || 0) >= Number(slot.max_participants)) throw trialError('That class has filled up. Please choose another date.', 409)
  // Recheck wall-clock time after locks/waivers; transaction-start now() could precede a long lock wait.
  const timing = (await client.query(
    `SELECT ($2::date + $3::time) > (clock_timestamp() AT TIME ZONE COALESCE(NULLIF(timezone, ''), 'America/New_York')) AS is_upcoming
       FROM facility WHERE id = $1`, [facilityId, selection.classDate, slot.start_time],
  )).rows[0]
  if (!timing?.is_upcoming) throw trialError('That class has already started. Please choose another date.', 409)
  const effectivePricing = resolveEffectiveFormPricing(hydrateProgramPricingRow(slot.pricing_program), slot.pricing_form)
  const price = calculateDropInPrice({ monthlyCents: effectivePricing.costUnit === 'per_month' ? effectivePricing.costAmountCents : 0, isFree: true })
  const booking = (await client.query(
    `INSERT INTO drop_in_registration (member_id, form_id, slot_group_id, class_date,
       first_name, last_name, email, phone, benefit_type, base_price_cents, discount_percent, amount_cents, status)
     VALUES ($1,$2,$3,$4,$5,$6,lower($7),$8,'free_trial',$9,$10,0,'confirmed') RETURNING id`,
    [memberId, slot.form_id, selection.slotGroupId, selection.classDate, member.first_name, member.last_name,
      contactEmail, contactPhone, price.baseCents, price.discountPercent],
  )).rows[0]
  return { id: Number(booking.id), memberId: Number(memberId), status: 'confirmed', benefitType: 'free_trial', totalCents: 0, ...selection, ...(slot.is_trial_assessment ? { isTrialAssessment: true } : {}) }
}
