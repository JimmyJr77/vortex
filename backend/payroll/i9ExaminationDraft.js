import {createHash} from 'node:crypto'
import {currentI9EmployerReview} from './i9EmployerReview.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const object=(value,keys)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw fail('Use only supported examination draft fields; signatures and attestations cannot be saved in a draft.',400);return value}
const text=(value,max=2000)=>{if(value==null)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value))throw fail('Review examination draft text.',400);return value.normalize('NFC')}
export function i9ExaminationDraftInput(value){
 const b=object(value,['examinedOn','initials','identity','days','closures','short','late','qualification','video','decisions'])
 if(b.days!=null&&(!Array.isArray(b.days)||b.days.some(n=>!Number.isInteger(n)||n<0||n>6)||new Set(b.days).size!==b.days.length))throw fail('Review the draft business days.',400)
 if(b.short!=null&&!['','yes','no'].includes(b.short))throw fail('Review the draft employment duration.',400)
 const decisions={}
 for(const [key,value] of Object.entries(object(b.decisions||{},['A1','A2','A3','B','C']))){
  const d=object(value,['copyIds','acceptance','ruleSource','ruleEvidence','validUntil','formNotation','followUpKind','followUpOn'])
  if(d.copyIds!=null&&(!Array.isArray(d.copyIds)||d.copyIds.length>50||d.copyIds.some(id=>!/^\d{1,19}$/.test(String(id))||BigInt(id)<1n||BigInt(id)>9223372036854775807n)))throw fail('Review the draft copy selections.',400)
  if(d.acceptance!=null&&!['','STANDARD','RECEIPT','EXTENSION','OTHER_ACCEPTABLE'].includes(d.acceptance))throw fail('Review the draft acceptance choice.',400)
  if(d.followUpKind!=null&&!['','NONE','RECEIPT_REPLACEMENT','REVERIFICATION','OTHER'].includes(d.followUpKind))throw fail('Review the draft follow-up choice.',400)
  decisions[key]={copyIds:[...new Set((d.copyIds||[]).map(id=>String(BigInt(id))))].sort(),acceptance:d.acceptance||'',ruleSource:text(d.ruleSource),ruleEvidence:text(d.ruleEvidence),validUntil:text(d.validUntil,10),formNotation:text(d.formNotation,1000),followUpKind:d.followUpKind||'',followUpOn:text(d.followUpOn,10)}
 }
 return {examinedOn:text(b.examinedOn,10),initials:text(b.initials,20),identity:text(b.identity),days:[...(b.days||[])].sort(),closures:text(b.closures,5000),short:b.short||'',late:text(b.late),qualification:text(b.qualification),video:text(b.video),decisions}
}
const aad=(ctx,row)=>`i9-examination-draft:${ctx.facility}:${ctx.employee}:${row.task_id}:${row.onboarding_cycle}:${ctx.admin}`
async function state(db,ctx,taskId,body){
 const {row}=await currentI9EmployerReview(db,ctx,taskId,body)
 const fingerprint=hash({basisHash:row.basis_hash,draftRevision:row.draft_revision,submissionId:row.submission_id,preparerFingerprint:row.preparer_fingerprint})
 const saved=(await db.query('SELECT * FROM payroll_i9_examination_draft WHERE task_id=$1 AND onboarding_cycle=$2 AND actor_user_id=$3',[row.task_id,row.onboarding_cycle,ctx.admin])).rows[0]
 const current=saved?.basis_hash===fingerprint
 return {row,saved,fingerprint,result:{revision:saved?.revision||0,draft:current?JSON.parse(decryptDocument(saved.encrypted_draft,aad(ctx,row)).toString()):null,savedAt:current?saved.updated_at:null,invalidated:!!saved&&!current}}
}
export async function readI9ExaminationDraft(db,ctx,taskId,body){return (await state(db,ctx,taskId,body)).result}
export async function saveI9ExaminationDraft(db,ctx,taskId,body){
 const {row,saved,fingerprint,result}=await state(db,ctx,taskId,body)
 if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Reload the examination draft and use a unique save key.',400)
 const draft=i9ExaminationDraftInput(body.draft),requestHash=hash({draft,fingerprint,expectedRevision:body.expectedRevision})
 if(saved?.request_key===body.requestKey.toLowerCase()){
  if(saved.request_hash!==requestHash)throw fail('This examination save key was used for different details.')
  return {...result,draft}
 }
 if(result.revision!==body.expectedRevision)throw fail('Another tab saved your examination findings. Reload before saving.')
 const next=(await db.query(`INSERT INTO payroll_i9_examination_draft(facility_id,employee_id,task_id,onboarding_cycle,actor_user_id,review_id,basis_hash,revision,encrypted_draft,request_key,request_hash)
 VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10) ON CONFLICT(task_id,onboarding_cycle,actor_user_id) DO UPDATE SET review_id=EXCLUDED.review_id,basis_hash=EXCLUDED.basis_hash,revision=payroll_i9_examination_draft.revision+1,encrypted_draft=EXCLUDED.encrypted_draft,request_key=EXCLUDED.request_key,request_hash=EXCLUDED.request_hash,updated_at=clock_timestamp() RETURNING revision,updated_at`,[ctx.facility,ctx.employee,row.task_id,row.onboarding_cycle,ctx.admin,row.id,fingerprint,encryptDocument(Buffer.from(JSON.stringify(draft)),aad(ctx,row)),body.requestKey,requestHash])).rows[0]
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_EXAMINATION_DRAFT_SAVED','payroll_onboarding_task',$3,$4)",[ctx.facility,ctx.admin,String(row.task_id),{employeeId:ctx.employee,onboardingCycle:row.onboarding_cycle,revision:next.revision,reviewId:row.id}])
 return {revision:next.revision,draft,savedAt:next.updated_at,invalidated:false}
}
