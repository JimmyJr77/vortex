// Called inside payroll finalization, after fresh approval validation and while
// holding the employer/run locks. Deferred database checks enforce completion.
export async function settlePayrollCorrections(db,facility,run,employees,actor){
 const result=new Map()
 for(const row of employees){
  const calculated=run.calculation_snapshot.employees.find(e=>Number(e.employeeId)===Number(row.employee_id))
  const settlements=[]
  for(const plan of calculated.correctionSettlements||[]){
   const saved=(await db.query(`INSERT INTO payroll_correction_settlement(facility_id,employee_id,request_id,authorization_id,run_employee_id,effective_entry_id,plan,created_by)
    VALUES($1,$2,$3,$4,$5,COALESCE($6::bigint,nextval('payroll_time_entry_id_seq')),$7,$8) RETURNING id,effective_entry_id`,[facility,row.employee_id,plan.requestId,plan.authorizationId,row.id,plan.proposedTime.entryId??null,plan,actor])).rows[0]
   const minutes=plan.correctionLeave.creditDifferenceMinutes
   if(minutes!==0)await db.query(`INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason,transaction_kind,source_request_id,created_by)
    VALUES($1,$2,'MD_SICK_SAFE',$3,$4,$5,'CORRECTION_ACCRUAL',$6,$7)`,[facility,row.employee_id,plan.paymentDate,minutes,`Historical earned leave correction from settlement #${saved.id}`,plan.requestId,actor])
   const resolved=await db.query(`UPDATE payroll_employee_request SET status='APPROVED',reviewed_by=$1,reviewed_at=now(),review_note=$2 WHERE id=$3 AND facility_id=$4 AND employee_id=$5 AND status='PENDING' RETURNING id`,[actor,`Settled with payroll run #${run.id}; correction settlement #${saved.id}`,plan.requestId,facility,row.employee_id])
   if(resolved.rowCount!==1)throw Object.assign(new Error('Correction request changed during payment settlement.'),{status:409})
   const evidence={...plan,status:'SETTLED',paymentApplied:true,settlementId:Number(saved.id),effectiveEntryId:Number(saved.effective_entry_id),runId:Number(run.id),runEmployeeId:Number(row.id)}
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CORRECTION_SETTLED','employee_request',$3,$4)",[facility,actor,String(plan.requestId),evidence])
   settlements.push(evidence)
  }
  result.set(Number(row.employee_id),settlements)
 }
 return result
}
