async function finish(pool,facility,source,id,status,result=null){
 const db=await pool.connect()
 try{
  await db.query('BEGIN')
  await db.query("SELECT pg_advisory_xact_lock(hashtext('payroll-check-outcome'),hashtext($1))",[String(facility)])
  await db.query("UPDATE payroll_automation_run SET status=$2,finished_at=now(),result=$3,error_message=CASE WHEN $2='FAILED' THEN 'Payroll checks did not complete. Review the server logs and retry.' ELSE NULL END WHERE id=$1",[id,status,result])
  const latest=(await db.query("SELECT id FROM payroll_automation_run WHERE facility_id=$1 AND source=$2 AND status<>'RUNNING' ORDER BY id DESC LIMIT 1",[facility,source])).rows[0]
  if(String(latest?.id)===String(id)){
   const key=`payroll-check-${source}`
   if(status==='FAILED')await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message)
    VALUES($1,$2,'WARNING',$3,$4) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,title=EXCLUDED.title,message=EXCLUDED.message`,[facility,key,`${source==='SCHEDULED'?'Scheduled payroll':'Manual workforce'} checks failed`,`Run ${id} did not complete. Open Employer setup to review the check history and resolve the failure.`])
   else await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key])
  }
  await db.query('COMMIT')
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error}finally{db.release()}
}
export async function recordPayrollAutomation(db,facility,source,work){
 const row=(await db.query('INSERT INTO payroll_automation_run(facility_id,source) VALUES($1,$2) RETURNING id',[facility,source])).rows[0]
 let result
 try{result=await work()}catch(error){await finish(db,facility,source,row.id,'FAILED');throw error}
 await finish(db,facility,source,row.id,'SUCCEEDED',result||{})
 return result
}
