// Call with the filing-identity subject advisory lock held for this transaction.
export async function syncFilingIdentityAlert(db,facility,employee){
 const row=(await db.query(`SELECT i.id,e.employee_number,(SELECT r.decision FROM payroll_filing_identity_employee_review r WHERE r.facility_id=i.facility_id AND r.employee_id=i.employee_id AND r.identity_id=i.id ORDER BY r.id DESC LIMIT 1) AS decision
  FROM payroll_filing_identity i JOIN payroll_employee e ON e.id=i.employee_id AND e.facility_id=i.facility_id
  WHERE i.facility_id=$1 AND i.employee_id=$2 ORDER BY i.id DESC LIMIT 1`,[facility,employee])).rows[0]
 const key=`filing-identity-correction-${employee}`
 if(row?.decision==='CORRECTION_REQUESTED')await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Employee filing identity needs correction',$3)
 ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,dismissed_by=NULL,message=EXCLUDED.message`,[facility,key,`Employee ${row.employee_number} requested a correction to filing identity revision ${row.id}. Open People & onboarding, contact the employee securely, and record the corrected identity.`])
 else await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now(),dismissed_by=NULL WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key])
}
export async function refreshFilingIdentityAlerts(pool,facility){
 const employees=(await pool.query('SELECT DISTINCT employee_id FROM payroll_filing_identity WHERE facility_id=$1 AND employee_id IS NOT NULL',[facility])).rows
 for(const row of employees){const db=await pool.connect();try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-filing-identity:${facility}:EMPLOYEE:${row.employee_id}`]);await syncFilingIdentityAlert(db,facility,row.employee_id);await db.query('COMMIT')
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}}
}
