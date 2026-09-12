import {createHash} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {i9DraftInput} from './i9DraftInput.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const context=(session,task)=>`i9-draft:${session.facility_id}:${session.employee_id}:${task.id}:${task.onboarding_cycle}`
async function scopedTask(db,session,taskId,cycle){
 const task=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND id=$3 AND task_key='I9' AND owner='EMPLOYEE' FOR UPDATE",[session.facility_id,session.employee_id,taskId])).rows[0]
 if(!task)throw fail('I9 task not found.',404)
 if(Number(cycle)!==task.onboarding_cycle)throw fail('The onboarding cycle changed. Reload this I9 step.')
 return task
}
export async function readI9Draft(db,session,taskId,cycle){
 const task=await scopedTask(db,session,taskId,cycle)
 const row=(await db.query('SELECT * FROM payroll_i9_draft WHERE task_id=$1 AND onboarding_cycle=$2',[task.id,task.onboarding_cycle])).rows[0]
 const baseResponseHash=createHash('sha256').update(JSON.stringify({status:task.status,response:task.response||{}})).digest('hex')
 const draft=row?.encrypted_draft&&String(row.base_response_hash)===String(baseResponseHash)?JSON.parse(decryptDocument(row.encrypted_draft,context(session,task)).toString('utf8')):null
 return {revision:row?.revision||0,baseResponseHash,draft,savedAt:draft?row.updated_at:null}
}
export async function saveI9Draft(db,session,taskId,body){
 const task=await scopedTask(db,session,taskId,body.onboardingCycle)
 if(!['OPEN','SUBMITTED','CHANGES_REQUESTED'].includes(task.status))throw fail('Ask your hiring admin to reopen this completed I9 step.')
 if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Reload the I9 draft before saving.',400)
 const draft=i9DraftInput(body.draft),current=await readI9Draft(db,session,taskId,body.onboardingCycle)
 if(String(body.baseResponseHash??null)!==String(current.baseResponseHash))throw fail('The I-9 checklist response changed since this draft was opened. Reload before saving.')
 const row=(await db.query('SELECT request_key,request_revision FROM payroll_i9_draft WHERE task_id=$1 AND onboarding_cycle=$2',[task.id,task.onboarding_cycle])).rows[0]
 if(row?.request_key===body.requestKey.toLowerCase()){if(row.request_revision!==body.expectedRevision||JSON.stringify(current.draft)!==JSON.stringify(draft))throw fail('This draft save key was used for different entries.');return {revision:current.revision,baseResponseHash:current.baseResponseHash,savedAt:current.savedAt}}
 if(current.revision!==body.expectedRevision)throw fail('This draft changed in another tab. Reload it before saving.')
 const encrypted=encryptDocument(Buffer.from(JSON.stringify(draft)),context(session,task))
 const saved=(await db.query(`INSERT INTO payroll_i9_draft(facility_id,employee_id,task_id,onboarding_cycle,revision,base_response_hash,encrypted_draft,employee_session_id,request_key,request_revision)
 VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9) ON CONFLICT(task_id,onboarding_cycle) DO UPDATE SET revision=payroll_i9_draft.revision+1,base_response_hash=EXCLUDED.base_response_hash,encrypted_draft=EXCLUDED.encrypted_draft,employee_session_id=EXCLUDED.employee_session_id,request_key=EXCLUDED.request_key,request_revision=EXCLUDED.request_revision,updated_at=clock_timestamp() RETURNING revision,updated_at`,[session.facility_id,session.employee_id,task.id,task.onboarding_cycle,current.baseResponseHash,encrypted,session.session_id,body.requestKey,body.expectedRevision])).rows[0]
 await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'I9_DRAFT_SAVED','onboarding_task',$2,$3)",[session.facility_id,String(task.id),{employeeId:session.employee_id,onboardingCycle:task.onboarding_cycle,revision:saved.revision}])
 return {revision:saved.revision,baseResponseHash:current.baseResponseHash,savedAt:saved.updated_at}
}
