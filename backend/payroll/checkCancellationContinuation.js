const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function continuePayrollCancelledCheck(pool,facility,runId,batchId,employeeId,body,{actorId}={}){
 if(body?.confirmed!==true||body.originalCheckAvailable!==true||!Number.isSafeInteger(actorId)||typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.length>2000||/[\u0000-\u001f\u007f]/.test(body.reference))throw fail('Confirm the original check is available, no replacement was issued, and retain the review reference.',400)
 const db=await pool.connect()
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const row=(await db.query("SELECT c.id,c.issue_id,payroll_check_cancel_continuable(c.id) AS ready,(SELECT max(id) FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id) AS cancellation_observation_id,(SELECT max(id) FROM payroll_check_issue_observation WHERE issue_id=i.id) AS check_observation_id FROM payroll_check_issue i JOIN payroll_check_cancellation c ON c.issue_id=i.id WHERE i.facility_id=$1 AND i.payroll_run_id=$2 AND i.batch_id=$3 AND i.employee_id=$4",[facility,runId,batchId,employeeId])).rows[0]
  if(!row)throw fail('Check cancellation not found.',404)
  if(!row.ready||String(body.expectedCancellationObservationId)!==String(row.cancellation_observation_id)||String(body.expectedCheckObservationId)!==String(row.check_observation_id))throw fail('Refresh and review the current sent original check before continuing it.')
  const saved=(await db.query('INSERT INTO payroll_check_cancellation_continuation(cancellation_id,cancellation_observation_id,check_observation_id,reference,created_by) VALUES($1,$2,$3,$4,$5) RETURNING created_at',[row.id,row.cancellation_observation_id,row.check_observation_id,body.reference.trim(),actorId])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_CANCELLATION_ORIGINAL_CONTINUED','check_cancellation',$3,$4)",[facility,actorId,row.id,{employeeId,originalCheckAvailable:true,noReplacementIssued:true,cancellationObservationId:row.cancellation_observation_id,checkObservationId:row.check_observation_id}])
  await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2",[facility,`check-cancel-${row.issue_id}`])
  await db.query('COMMIT');return {createdAt:saved.created_at}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
