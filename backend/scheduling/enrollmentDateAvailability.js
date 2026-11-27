import { lockSchedulingDay } from './dayCancellation.js'
import { loadDropInDateOccurrences } from './dropInOccurrences.js'
import { normalizeEnrollmentStartDate } from './enrollmentStartDate.js'

/** Check only the enrollment's selected date/time, not every future session. */
export async function assertEnrollmentDateAvailable(db, {
  formId, slotGroupId, timeSlotId = null, enrollmentStartDate = null,
  facilityId = null, lock = false, lockGroup = true,
}) {
  const scope = (await db.query(`SELECT p.facility_id,
      (clock_timestamp() AT TIME ZONE COALESCE(NULLIF(f.timezone,''),'America/New_York'))::date::text AS today
    FROM scheduling_slot_group sg JOIN scheduling_form sf ON sf.id=sg.form_id
    JOIN program p ON p.id=sf.program_id JOIN facility f ON f.id=p.facility_id
    WHERE sg.id=$1 AND sf.id=$2 AND ($3::bigint IS NULL OR p.facility_id=$3)`,
  [slotGroupId, formId, facilityId])).rows[0]
  if (!scope) throw Object.assign(new Error('This class time is no longer available. Please choose another class time.'), { statusCode: 409 })
  const date = enrollmentStartDate == null ? scope.today : normalizeEnrollmentStartDate(enrollmentStartDate)
  if (!date) throw Object.assign(new Error('Choose a valid enrollment start date.'), { statusCode: 400 })
  if (lock) {
    await lockSchedulingDay(db, scope.facility_id, date, { shared: true })
    if (lockGroup) await db.query('SELECT id FROM scheduling_slot_group WHERE id=$1 FOR UPDATE', [slotGroupId])
  }
  const occurrences = await loadDropInDateOccurrences(db, slotGroupId, date)
  if (occurrences.some(({ row, cancelled }) => cancelled
    && (timeSlotId == null || Number(row.calendar_slot_id) === Number(timeSlotId)))) {
    throw Object.assign(new Error('This class has been canceled for the selected date and time. Please choose another enrollment start date.'), {
      code: 'CLASS_OCCURRENCE_CANCELLED', statusCode: 409,
    })
  }
}
