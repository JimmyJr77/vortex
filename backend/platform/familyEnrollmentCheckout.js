import { requireEnrollmentStartDate } from '../scheduling/enrollmentStartDate.js'

// Account creation is not enrollment fulfillment. Public signup only prepares
// selections; the authenticated enrollment checkout owns pricing and admission.
export async function prepareFamilyEnrollmentCheckout(db, { memberId, enrollment }) {
  const ids = [memberId, enrollment.classEventId ?? enrollment.programId,
    enrollment.schedulingFormId, enrollment.slotGroupId, enrollment.timeSlotId].map(Number)
  if (!ids.every((id) => Number.isSafeInteger(id) && id > 0)) {
    throw new Error('Select a valid athlete, class, and class time before continuing to payment.')
  }
  const [athleteId, classEventId, formId, slotGroupId, timeSlotId] = ids
  const enrollmentStartDate = requireEnrollmentStartDate(enrollment.enrollmentStartDate)
  const result = await db.query(`
    SELECT sf.title AS class_label, sf.programs_id
      FROM scheduling_form sf
      JOIN scheduling_slot_group sg ON sg.form_id = sf.id
      JOIN scheduling_time_slot ts ON ts.form_id = sf.id AND ts.slot_group_id = sg.id
     WHERE sf.id = $1 AND sf.program_id = $2 AND sg.id = $3 AND ts.id = $4
       AND sf.is_active = TRUE AND sf.deleted_at IS NULL
       AND sg.is_active = TRUE AND ts.is_active = TRUE
  `, [formId, classEventId, slotGroupId, timeSlotId])
  const row = result.rows[0]
  if (!row) throw new Error('This class time is no longer available. Please select another class time.')
  return {
    memberId: athleteId, classEventId, formId, slotGroupId, timeSlotId,
    enrollmentStartDate, classLabel: row.class_label,
    programsId: row.programs_id != null ? Number(row.programs_id) : undefined,
    scheduleLabel: String(enrollment.scheduleLabel || ''),
    selectedPricingOptionKey: enrollment.selectedPricingOptionKey,
  }
}
