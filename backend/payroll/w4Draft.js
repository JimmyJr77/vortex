import {encryptDocument,decryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const identity=['firstNameMiddleInitial','lastName','address','cityStateZip','ssn']
const amounts=['qualifyingChildrenCents','otherDependentsCents','creditsCents','otherIncomeCents','deductionsCents','extraWithholdingCents']
export function w4DraftInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw fail('Use valid W-4 draft entries.',400)
 const keys=[...identity,...amounts,'filingStatus','nonresidentAlien','twoJobs','exempt']
 if(Object.keys(input).some(k=>!keys.includes(k)))throw fail('A W-4 draft cannot contain a signature or unrecognized fields.',400)
 const result={}
 for(const k of [...identity,...amounts,'filingStatus','nonresidentAlien']){
  const value=input[k]??''
  if(typeof value!=='string'||value.length>200||/[\u0000-\u001f\u007f]/.test(value))throw fail('Use valid text in the W-4 draft.',400)
  result[k]=value.normalize('NFC')
 }
 if(!/^[\d-]{0,11}$/.test(result.ssn)||amounts.some(k=>result[k].length>32||!/^\d*(\.\d{0,2})?$/.test(result[k])))throw fail('Use digits for Social Security and dollar entries.',400)
 if(!['','SINGLE','MARRIED','HEAD_OF_HOUSEHOLD'].includes(result.filingStatus)||!['','YES','NO'].includes(result.nonresidentAlien))throw fail('Use valid W-4 draft choices.',400)
 for(const k of ['twoJobs','exempt']){if(typeof input[k]!=='boolean')throw fail('Select the W-4 draft options.',400);result[k]=input[k]}
 return result
}
const context=(session,task)=>`w4-draft:${session.facility_id}:${session.employee_id}:${task.id}:${task.onboarding_cycle}`
async function scopedTask(db,session,taskId,cycle){
 const task=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND id=$3 AND task_key='W4' AND owner='EMPLOYEE' FOR UPDATE",[session.facility_id,session.employee_id,taskId])).rows[0]
 if(!task)throw fail('W-4 task not found.',404)
 if(Number(cycle)!==task.onboarding_cycle)throw fail('The onboarding cycle changed. Reload this W-4 step.')
 return task
}
export async function readW4Draft(db,session,taskId,cycle){
 const task=await scopedTask(db,session,taskId,cycle)
 const row=(await db.query('SELECT * FROM payroll_w4_draft WHERE task_id=$1 AND onboarding_cycle=$2',[task.id,task.onboarding_cycle])).rows[0]
 const baseSubmissionId=task.response?.w4SubmissionId||null
 const draft=row?.encrypted_draft&&String(row.base_submission_id)===String(baseSubmissionId)?JSON.parse(decryptDocument(row.encrypted_draft,context(session,task)).toString('utf8')):null
 return {revision:row?.revision||0,baseSubmissionId,draft,savedAt:draft?row.updated_at:null}
}
export async function saveW4Draft(db,session,taskId,body){
 const task=await scopedTask(db,session,taskId,body.onboardingCycle)
 if(!['OPEN','SUBMITTED','CHANGES_REQUESTED'].includes(task.status))throw fail('Ask your hiring admin to reopen this completed W-4 step.')
 if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Reload the W-4 draft before saving.',400)
 const draft=w4DraftInput(body.draft),current=await readW4Draft(db,session,taskId,body.onboardingCycle)
 if(String(body.baseSubmissionId??null)!==String(current.baseSubmissionId))throw fail('A W-4 was signed since this draft was opened. Reload before saving.')
 const row=(await db.query('SELECT request_key,request_revision FROM payroll_w4_draft WHERE task_id=$1 AND onboarding_cycle=$2',[task.id,task.onboarding_cycle])).rows[0]
 if(row?.request_key===body.requestKey.toLowerCase()){if(row.request_revision!==body.expectedRevision||JSON.stringify(current.draft)!==JSON.stringify(draft))throw fail('This draft save key was used for different entries.');return {revision:current.revision,baseSubmissionId:current.baseSubmissionId,savedAt:current.savedAt}}
 if(current.revision!==body.expectedRevision)throw fail('This draft changed in another tab. Reload it before saving.')
 const encrypted=encryptDocument(Buffer.from(JSON.stringify(draft)),context(session,task))
 const saved=(await db.query(`INSERT INTO payroll_w4_draft(facility_id,employee_id,task_id,onboarding_cycle,revision,base_submission_id,encrypted_draft,employee_session_id,request_key,request_revision)
 VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9) ON CONFLICT(task_id,onboarding_cycle) DO UPDATE SET revision=payroll_w4_draft.revision+1,base_submission_id=EXCLUDED.base_submission_id,encrypted_draft=EXCLUDED.encrypted_draft,employee_session_id=EXCLUDED.employee_session_id,request_key=EXCLUDED.request_key,request_revision=EXCLUDED.request_revision,updated_at=clock_timestamp() RETURNING revision,updated_at`,[session.facility_id,session.employee_id,task.id,task.onboarding_cycle,current.baseSubmissionId,encrypted,session.session_id,body.requestKey,body.expectedRevision])).rows[0]
 await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'W4_DRAFT_SAVED','onboarding_task',$2,$3)",[session.facility_id,String(task.id),{employeeId:session.employee_id,onboardingCycle:task.onboarding_cycle,revision:saved.revision}])
 return {revision:saved.revision,baseSubmissionId:current.baseSubmissionId,savedAt:saved.updated_at}
}
