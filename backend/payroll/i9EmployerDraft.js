import {createHash} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const aad=(ctx,task)=>`i9-employer-draft:${ctx.facility}:${ctx.employee}:${task.id}:${task.onboarding_cycle}`
const object=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw fail('Use only supported employer draft fields.',400);return v}
const text=(v,max=200)=>{if(v==null)return '';if(typeof v!=='string'||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw fail('Review the employer draft text.',400);return v.normalize('NFC')}
const row=v=>{object(v,['title','issuingAuthority','number','expiresOn']);return {title:text(v.title),issuingAuthority:text(v.issuingAuthority),number:text(v.number),expiresOn:text(v.expiresOn,10)}}
export function i9EmployerDraftInput(value){
 const b=object(value,['documentChoice','listA','listB','listC','additionalInformation','examinationMethod','firstDayEmployed','representativeNameAndTitle','businessName','businessAddress'])
 if(b.documentChoice!=null&&!['LIST_A','LIST_B_C'].includes(b.documentChoice))throw fail('Choose List A or List B and C, or leave the choice unanswered.',400)
 if(b.examinationMethod!=null&&!['PHYSICAL','ALTERNATIVE'].includes(b.examinationMethod))throw fail('Choose an examination method, or leave it unanswered.',400)
 if(b.listA!=null&&(!Array.isArray(b.listA)||b.listA.length>3))throw fail('Use at most three List A rows.',400)
 // Preserve partially entered branches when the admin switches alternatives.
 // Final preparation must use only the selected document branch.
 return {documentChoice:b.documentChoice??null,listA:(b.listA||[]).map(row),listB:b.listB==null?null:row(b.listB),listC:b.listC==null?null:row(b.listC),additionalInformation:text(b.additionalInformation,1000),examinationMethod:b.examinationMethod??null,firstDayEmployed:text(b.firstDayEmployed,10),representativeNameAndTitle:text(b.representativeNameAndTitle),businessName:text(b.businessName),businessAddress:text(b.businessAddress)}
}
export async function i9EmployerBasis(db,ctx,taskId,cycle){
 await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility])
 if(!(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[ctx.facility,ctx.employee])).rowCount)throw fail('Employee not found.',404)
 const employeeTask=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='I9' AND owner='EMPLOYEE' FOR UPDATE",[ctx.facility,ctx.employee])).rows[0]
 const task=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND id=$3 AND task_key='I9_REVIEW' AND owner='ADMIN' FOR UPDATE",[ctx.facility,ctx.employee,taskId])).rows[0]
 if(!task||!employeeTask)throw fail('Employer I-9 step not found.',404)
 if(Number(cycle)!==task.onboarding_cycle||employeeTask.onboarding_cycle!==task.onboarding_cycle)throw fail('The onboarding cycle changed. Reload the employer step.')
 const submission=(await db.query('SELECT s.id FROM payroll_i9_submission s WHERE s.task_id=$1 AND s.onboarding_cycle=$2 AND s.id::text=$3',[employeeTask.id,employeeTask.onboarding_cycle,employeeTask.response?.i9SubmissionId||null])).rows[0]
 const hiring=(await db.query('SELECT revision FROM payroll_i9_hiring_context WHERE task_id=$1 AND onboarding_cycle=$2 ORDER BY revision DESC LIMIT 1',[employeeTask.id,employeeTask.onboarding_cycle])).rows[0]
 const basisHash=hash({taskId:String(task.id),cycle:task.onboarding_cycle,employerStatus:task.status,employerResponse:task.response,employeeStatus:employeeTask.status,employeeResponse:employeeTask.response,submissionId:submission?.id||null,hiringRevision:hiring?.revision||0})
 return {task,employeeTask,submissionId:submission?.id||null,basisHash}
}
export async function readI9EmployerDraft(db,ctx,taskId,cycle){
 const basis=await i9EmployerBasis(db,ctx,taskId,cycle)
 const row=(await db.query('SELECT * FROM payroll_i9_employer_draft WHERE task_id=$1 AND onboarding_cycle=$2',[basis.task.id,basis.task.onboarding_cycle])).rows[0]
 const current=!!row&&row.basis_hash===basis.basisHash
 return {revision:row?.revision||0,basisHash:basis.basisHash,submissionId:basis.submissionId,draft:current?JSON.parse(decryptDocument(row.encrypted_draft,aad(ctx,basis.task)).toString('utf8')):null,savedAt:current?row.updated_at:null,invalidated:!!row&&!current}
}
export async function saveI9EmployerDraft(db,ctx,taskId,body){
 const basis=await i9EmployerBasis(db,ctx,taskId,body.onboardingCycle)
 if(!basis.submissionId)throw fail('The employee must sign Section 1 before saving employer document entries.')
 if(!['OPEN','SUBMITTED','CHANGES_REQUESTED'].includes(basis.task.status))throw fail('Reopen the employer I-9 step before editing its draft.')
 if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Reload the employer draft and use a unique save key.',400)
 const draft=i9EmployerDraftInput(body.draft),current=await readI9EmployerDraft(db,ctx,taskId,body.onboardingCycle)
 if(body.basisHash!==current.basisHash)throw fail('The employee signature, review or hiring context changed. Reload the employer draft.')
 const prior=(await db.query('SELECT request_key,request_revision,actor_user_id FROM payroll_i9_employer_draft WHERE task_id=$1 AND onboarding_cycle=$2',[basis.task.id,basis.task.onboarding_cycle])).rows[0]
 if(prior?.request_key===body.requestKey.toLowerCase()){
  if(prior.request_revision!==body.expectedRevision||String(prior.actor_user_id)!==String(ctx.admin)||JSON.stringify(current.draft)!==JSON.stringify(draft))throw fail('This employer draft save key was used for different details.')
  return {revision:current.revision,basisHash:current.basisHash,savedAt:current.savedAt}
 }
 if(current.revision!==body.expectedRevision)throw fail('Another admin or tab saved this draft. Reload before saving.')
 const saved=(await db.query(`INSERT INTO payroll_i9_employer_draft(facility_id,employee_id,task_id,onboarding_cycle,submission_id,revision,basis_hash,encrypted_draft,actor_user_id,request_key,request_revision)
 VALUES($1,$2,$3,$4,$5,1,$6,$7,$8,$9,$10) ON CONFLICT(task_id,onboarding_cycle) DO UPDATE SET submission_id=EXCLUDED.submission_id,revision=payroll_i9_employer_draft.revision+1,basis_hash=EXCLUDED.basis_hash,encrypted_draft=EXCLUDED.encrypted_draft,actor_user_id=EXCLUDED.actor_user_id,request_key=EXCLUDED.request_key,request_revision=EXCLUDED.request_revision,updated_at=clock_timestamp() RETURNING revision,updated_at`,[ctx.facility,ctx.employee,basis.task.id,basis.task.onboarding_cycle,basis.submissionId,current.basisHash,encryptDocument(Buffer.from(JSON.stringify(draft)),aad(ctx,basis.task)),ctx.admin,body.requestKey,body.expectedRevision])).rows[0]
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_EMPLOYER_DRAFT_SAVED','payroll_onboarding_task',$3,$4)",[ctx.facility,ctx.admin,String(basis.task.id),{employeeId:ctx.employee,onboardingCycle:basis.task.onboarding_cycle,submissionId:basis.submissionId,revision:saved.revision}])
 return {revision:saved.revision,basisHash:current.basisHash,savedAt:saved.updated_at}
}
