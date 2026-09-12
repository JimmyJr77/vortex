const wageFields=['jobTitle','hourlyRateCents','annualSalaryCents','payType','overtimeClassification','hireDate','location','paySchedule','salaryWeeklyHours','normalWorkweekMinutes']
export async function employeeAcknowledgments(db,facility,employeeId,taskId,beforeId){
 const fail=(message,status)=>{throw Object.assign(new Error(message),{status})}
 if(!/^\d+$/.test(String(taskId))||!Number.isSafeInteger(Number(taskId))||Number(taskId)<=0)fail('Acknowledgment step not found.',404)
 if(beforeId!==undefined&&(typeof beforeId!=='string'||!/^\d+$/.test(beforeId)||!Number.isSafeInteger(Number(beforeId))||Number(beforeId)<=0))fail('Use a valid acknowledgment page reference.',400)
 const task=(await db.query("SELECT task_key,title FROM payroll_onboarding_task WHERE id=$1 AND employee_id=$2 AND facility_id=$3 AND owner='EMPLOYEE' AND task_key IN ('WAGE_NOTICE','HANDBOOK')",[taskId,employeeId,facility])).rows[0]
 if(!task)fail('Acknowledgment step not found.',404)
 const rows=(await db.query(`SELECT id,onboarding_cycle,event,recorded_at,snapshot FROM payroll_onboarding_revision
  WHERE task_id=$1 AND employee_id=$2 AND facility_id=$3 AND ($4::bigint IS NULL OR id<$4::bigint)
   AND snapshot->'response'->'acknowledged'='true'::jsonb
   AND jsonb_typeof(snapshot->'response'->'signature')='string' AND length(btrim(snapshot->'response'->>'signature'))>0
   AND (snapshot->>'status'='SUBMITTED' OR (event='INITIAL_CAPTURE' AND snapshot->>'status'='COMPLETE'))
  ORDER BY id DESC LIMIT 26`,[taskId,employeeId,facility,beforeId??null])).rows
 return {items:rows.slice(0,25).map(row=>{
  const response=row.snapshot.response
  return {id:Number(row.id),cycle:row.onboarding_cycle,kind:task.task_key,title:typeof row.snapshot.title==='string'?row.snapshot.title:task.title,recordedAt:row.recorded_at,submittedAt:row.snapshot.submitted_at||null,signature:response.signature,
   terms:task.task_key==='HANDBOOK'?(typeof response.terms==='string'?response.terms:null):Object.fromEntries(wageFields.filter(k=>response.terms?.[k]!==undefined).map(k=>[k,response.terms[k]])),
   benefitsTerms:typeof response.benefitsTerms==='string'?response.benefitsTerms:null,source:row.event==='INITIAL_CAPTURE'?'RETAINED_RECORD':'SUBMISSION'}
 }),nextBeforeId:rows.length>25?Number(rows[24].id):null}
}
