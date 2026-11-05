import { requireEnrollmentStartDate } from '../scheduling/enrollmentStartDate.js'

// Account creation is not enrollment fulfillment. Public signup only prepares
// selections; the authenticated enrollment checkout owns pricing and admission.
export async function prepareFamilyEnrollmentCheckout(db, { memberId, enrollment, facilityId = null }) {
  const ids = [memberId, enrollment.classEventId ?? enrollment.programId,
    enrollment.schedulingFormId, enrollment.slotGroupId, enrollment.timeSlotId].map(Number)
  if (!ids.every((id) => Number.isSafeInteger(id) && id > 0)) {
    throw new Error('Select a valid athlete, class, and class time before continuing to payment.')
  }
  const [athleteId, classEventId, formId, slotGroupId, timeSlotId] = ids
  const programsId = enrollment.programsId == null ? null : Number(enrollment.programsId)
  const offeringId = enrollment.offeringId == null ? null : Number(enrollment.offeringId)
  if (enrollment.offeringIds != null && !Array.isArray(enrollment.offeringIds)) {
    throw new Error('Select valid class offerings before continuing.')
  }
  const offeringIds = [...new Set((enrollment.offeringIds ?? []).map(Number))]
  if ([programsId, offeringId, facilityId].some(id => id != null && (!Number.isSafeInteger(Number(id)) || Number(id) <= 0))
    || offeringIds.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error('Select valid program and class offerings before continuing.')
  }
  const enrollmentStartDate = requireEnrollmentStartDate(enrollment.enrollmentStartDate)
  const result = await db.query(`
    SELECT sf.title AS class_label, class_scope.programs_id
      FROM scheduling_form sf
      JOIN program class_scope ON class_scope.id=sf.program_id
      JOIN programs parent_scope ON parent_scope.id=class_scope.programs_id
        AND parent_scope.facility_id=class_scope.facility_id
      JOIN member participant ON participant.id=$5 AND participant.facility_id=class_scope.facility_id AND participant.is_active=TRUE
      JOIN scheduling_slot_group sg ON sg.form_id = sf.id
      JOIN scheduling_time_slot ts ON ts.form_id = sf.id AND ts.slot_group_id = sg.id
     WHERE sf.id = $1 AND sf.program_id = $2 AND sg.id = $3 AND ts.id = $4
       AND ($6::bigint IS NULL OR participant.facility_id=$6)
       AND ($7::bigint IS NULL OR parent_scope.id=$7)
       AND (sf.programs_id IS NULL OR sf.programs_id=parent_scope.id)
       AND ($8::bigint IS NULL OR sg.offering_id=$8)
       AND NOT EXISTS (
         SELECT 1 FROM unnest($9::bigint[]) requested(id)
         WHERE NOT EXISTS (SELECT 1 FROM scheduling_offering offering WHERE offering.id=requested.id AND offering.form_id=sf.id)
       )
       AND sf.is_active = TRUE AND sf.deleted_at IS NULL
       AND sg.is_active = TRUE AND ts.is_active = TRUE
       AND COALESCE(class_scope.is_active,TRUE)=TRUE AND COALESCE(class_scope.archived,FALSE)=FALSE
       AND COALESCE(parent_scope.is_active,TRUE)=TRUE AND COALESCE(parent_scope.archived,FALSE)=FALSE
     FOR SHARE OF sf, class_scope, parent_scope, participant, sg, ts
  `, [formId, classEventId, slotGroupId, timeSlotId, athleteId, facilityId, programsId, offeringId,
    offeringId == null ? offeringIds : [...new Set([...offeringIds, offeringId])]])
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
