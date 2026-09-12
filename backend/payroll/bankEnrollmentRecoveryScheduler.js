import {recoverBankEnrollment} from './bankEnrollmentHistory.js'
export async function runBankEnrollmentRecoverySweep(pool,{fetcher=fetch,limit=25,now=()=>new Date()}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Choose an enrollment recovery limit from 1 to 100.')
 const checkedAt=now();if(!(checkedAt instanceof Date)||!Number.isFinite(checkedAt.getTime()))throw new Error('Invalid enrollment recovery time.')
 const db=await pool.connect();let locked=false
 try{
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended('payroll-bank-enrollment-recovery-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {skipped:true,checked:0,failed:0}
  const due=(await db.query(`SELECT e.id,e.facility_id,e.employee_id,o.id AS operation_id FROM payroll_bank_enrollment e
   JOIN LATERAL(
    SELECT p.id,p.created_at,v.created_at AS observed_at,v.result FROM payroll_bank_enrollment_operation p
    LEFT JOIN LATERAL(SELECT result,created_at FROM payroll_bank_enrollment_observation WHERE operation_id=p.id ORDER BY id DESC LIMIT 1)v ON true
    WHERE p.enrollment_id=e.id
    ORDER BY CASE WHEN p.stage='COUNTERPARTY' AND (v.result IS NULL OR v.result->>'status'<>'RECORDED') THEN 0 WHEN p.stage='ACCOUNT' AND (v.result IS NULL OR v.result->>'status'<>'RECORDED') THEN 1 WHEN v.result IS NULL THEN 2 ELSE 3 END,p.created_at DESC,p.id DESC LIMIT 1
   )o ON true
   LEFT JOIN LATERAL(SELECT created_at FROM payroll_bank_enrollment_recovery_check WHERE enrollment_id=e.id ORDER BY id DESC LIMIT 1)c ON true
   WHERE NOT EXISTS(SELECT 1 FROM payroll_bank_enrollment_restart restart WHERE restart.parent_id=e.id)
   AND (o.result IS NULL OR o.result->>'status' IN ('UNCERTAIN','NOT_FOUND','NEEDS_REVIEW','VERIFICATION_REJECTED') OR o.result->>'verificationStatus'='pending_verification'
    OR (o.result->>'verificationStatus'='verified' AND NOT EXISTS(SELECT 1 FROM payroll_bank_enrollment newer WHERE newer.facility_id=e.facility_id AND newer.employee_id=e.employee_id AND newer.revision>e.revision)))
   AND GREATEST(o.created_at,o.observed_at,c.created_at)<$2::timestamptz-CASE WHEN o.result->>'verificationStatus'='verified' THEN interval '1 day' ELSE interval '10 minutes' END
   ORDER BY GREATEST(o.created_at,o.observed_at,c.created_at),e.revision LIMIT $1`,[limit,checkedAt])).rows
  let checked=0,failed=0
  for(const row of due){
   await db.query('INSERT INTO payroll_bank_enrollment_recovery_check(enrollment_id,operation_id,created_at) VALUES($1,$2,$3)',[row.id,row.operation_id,checkedAt])
   try{
    await recoverBankEnrollment(pool,{facility:Number(row.facility_id),employee:Number(row.employee_id),enrollmentId:row.id,operationId:row.operation_id},{fetcher,automatic:true});checked++
   }catch{
    failed++
    await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Bank enrollment needs review',$3)
     ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[row.facility_id,`bank-enrollment-${row.id}`,`Employee ${row.employee_id}: automatic bank enrollment recovery could not complete. Review the retained employer connection and account history in People & onboarding.`])
   }
  }
  return {skipped:false,checked,failed}
 }finally{
  let destroy=false
  if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtextextended('payroll-bank-enrollment-recovery-sweep',0))")}catch{destroy=true}
  db.release(destroy)
 }
}
export function startBankEnrollmentRecoveryScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_BANK_ENROLLMENT_RECOVERY_ENABLED==='false')return null
 const execute=()=>runBankEnrollmentRecoverySweep(pool).catch(error=>console.error('[payroll] bank enrollment recovery sweep failed:',error))
 const first=setTimeout(execute,60000);first.unref?.()
 const timer=setInterval(execute,5*60000);timer.unref?.()
 return timer
}
