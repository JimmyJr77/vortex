const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export const retirementScheduleUuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x)
export async function retirementScheduleTarget(db,facility,kind,id){
 if(!['BANK','FILE'].includes(kind)||!retirementScheduleUuid(id))throw fail('Select a retirement bank or file authorization.',400)
 const sql=kind==='BANK'?`SELECT a.id,a.id AS remittance_id,a.basis->'timing'->>'submissionAt' AS cutoff,a.basis->'timing'->>'depositDate' AS payment_date,EXISTS(SELECT 1 FROM payroll_retirement_remittance_claim c WHERE c.authorization_id=a.id) AS claimed,EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation c WHERE c.authorization_id=a.id) AS cancelled FROM payroll_retirement_remittance_authorization a WHERE a.facility_id=$1 AND a.id=$2`:`SELECT d.id,a.id AS remittance_id,a.basis->'timing'->>'submissionAt' AS cutoff,a.basis->'timing'->>'depositDate' AS payment_date,EXISTS(SELECT 1 FROM payroll_retirement_allocation_claim c WHERE c.authorization_id=d.id) AS claimed,(EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation c WHERE c.authorization_id=d.id) OR EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation c WHERE c.authorization_id=a.id)) AS cancelled FROM payroll_retirement_allocation_authorization d JOIN payroll_retirement_remittance_authorization a ON a.id=d.remittance_id WHERE d.facility_id=$1 AND d.id=$2`
 const row=(await db.query(sql,[facility,id])).rows[0];if(!row)throw fail('Retirement authorization not found.',404);return row
}
// Caller holds the employer dispatch lock and settings row through claim creation.
export async function checkRetirementDispatchSchedule(db,facility,kind,targetId,scheduledId,now){
 const row=(await db.query('SELECT s.* FROM payroll_retirement_dispatch_schedule s WHERE facility_id=$1 AND kind=$2 AND target_id=$3 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_dispatch_schedule_cancellation c WHERE c.schedule_id=s.id) ORDER BY created_at DESC,id DESC LIMIT 1',[facility,kind,targetId])).rows[0]
 if(!scheduledId){if(row)throw fail('This dispatch is scheduled. Cancel its schedule before submitting manually.');return null}
 if(!retirementScheduleUuid(scheduledId)||row?.id!==scheduledId||new Date(row.submit_at)>now())return {skipped:true}
 if(now()>=new Date(row.cutoff))throw fail('The scheduled submission window expired.')
 return row
}
