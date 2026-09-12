// A later ordinary observation does not resolve an earlier return/reversal.
// Resolution must retain separate participant and replacement evidence.
export async function retirementRecordedReturn(db,facility,paymentId){
 return (await db.query("SELECT EXISTS(SELECT 1 FROM payroll_retirement_remittance_authorization a JOIN payroll_retirement_remittance_observation o ON o.authorization_id=a.id WHERE a.id=$1 AND a.facility_id=$2 AND o.result->>'status' IN ('RETURNED','REVERSED')) AS recorded",[paymentId,facility])).rows[0].recorded
}
