import {createHash} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {documentInput,encryptDocument,decryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
export function eVerifyResultInput(body){
 const value=body.result
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['outcome','caseReference','observedOn','caseClosed','nextActionOn','nextAction','evidenceNote','verifiedAgainstOfficialCase','employeeAndEmployerMatched','evidenceReviewed'].includes(k)))throw fail('Use the supported E-Verify result fields.',400)
 if(!['PENDING_SSN','NEEDS_MORE_TIME','MISMATCH','CASE_IN_CONTINUANCE','REVIEW_UPDATE','CLOSE_AND_RESUBMIT','FINAL_NONCONFIRMATION','EMPLOYMENT_AUTHORIZED','OTHER_PENDING'].includes(value.outcome))throw fail('Choose the result shown by the official case.',400)
 const text=(v,max=2000)=>{if(v==null)return '';if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(v))throw fail('Review the E-Verify evidence text.',400);return v.trim().normalize('NFC')}
 const normalized={outcome:value.outcome,caseReference:text(value.caseReference,100),observedOn:value.observedOn,caseClosed:value.caseClosed,nextActionOn:value.nextActionOn||'',nextAction:text(value.nextAction),evidenceNote:text(value.evidenceNote),verifiedAgainstOfficialCase:value.verifiedAgainstOfficialCase,employeeAndEmployerMatched:value.employeeAndEmployerMatched,evidenceReviewed:value.evidenceReviewed}
 if(!date(normalized.observedOn)||typeof normalized.caseClosed!=='boolean'||normalized.evidenceNote.length<12||normalized.verifiedAgainstOfficialCase!==true||normalized.employeeAndEmployerMatched!==true||normalized.evidenceReviewed!==true)throw fail('Confirm the official result, matching employee/employer, evidence review and observation date.',400)
 if(normalized.outcome!=='PENDING_SSN'&&!normalized.caseReference)throw fail('Record the official case reference.',400)
 if(normalized.outcome==='PENDING_SSN'&&(normalized.caseReference||normalized.caseClosed))throw fail('A pending-SSN case-not-created record cannot include a case reference or closed case.',400)
 if(normalized.outcome==='EMPLOYMENT_AUTHORIZED'){
  if(!normalized.caseClosed||normalized.nextActionOn||normalized.nextAction)throw fail('Verify the authorized case is closed; do not combine closure with an unresolved next action.',400)
 }else if(!date(normalized.nextActionOn)||normalized.nextAction.length<12)throw fail('Record the next action and review date for this unresolved follow-up.',400)
 return normalized
}
async function scope(db,ctx,taskId){
 await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility])
 const row=(await db.query("SELECT t.*,s.id AS signature_id,s.task_id AS employer_task_id,s.onboarding_cycle FROM payroll_compliance_task t JOIN payroll_i9_employer_signature s ON t.task_key='I9_EVERIFY_CASE:'||s.id::text AND t.employee_id=s.employee_id AND t.facility_id=s.facility_id WHERE t.id=$1 AND t.facility_id=$2 AND t.employee_id=$3 FOR UPDATE OF t",[taskId,ctx.facility,ctx.employee])).rows[0]
 if(!row)throw fail('E-Verify follow-up not found.',404)
 return row
}
const aad=(ctx,row)=>`i9-everify:${ctx.facility}:${ctx.employee}:${row.compliance_task_id}:${row.revision}:${row.actor_user_id}`
export async function readEVerifyResults(db,ctx,taskId){
 await scope(db,ctx,taskId)
 const events=(await db.query('SELECT e.*,d.filename FROM payroll_i9_everify_event e JOIN payroll_private_document d ON d.id=e.document_id WHERE e.compliance_task_id=$1 ORDER BY e.revision DESC',[taskId])).rows
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_EVERIFY_RESULTS_VIEWED','compliance_task',$3,$4)",[ctx.facility,ctx.admin,String(taskId),{employeeId:ctx.employee,eventIds:events.map(e=>e.id)}])
 return {revision:events[0]?.revision||0,events:events.map(row=>({id:row.id,revision:row.revision,recordedAt:row.recorded_at,result:JSON.parse(decryptDocument(row.encrypted_evidence,aad(ctx,row)).toString()),documentId:row.document_id,filename:row.filename}))}
}
export async function recordEVerifyResult(db,ctx,taskId,body){
 const task=await scope(db,ctx,taskId),result=eVerifyResultInput(body),file=documentInput(body)
 if(file.mime!=='application/pdf')throw fail('Retain a readable PDF of the case or pending-case evidence.',400)
 if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Reload the result history and use a unique recording key.',400)
 const requestHash=hash({taskId:String(task.id),expectedRevision:body.expectedRevision,result,fileHash:file.hash})
 const prior=(await db.query('SELECT * FROM payroll_i9_everify_event WHERE compliance_task_id=$1 AND request_key=$2',[task.id,body.requestKey])).rows[0]
 const receipt=row=>({eventId:row.id,revision:row.revision,documentId:row.document_id,status:row.outcome==='EMPLOYMENT_AUTHORIZED'?'COMPLETE':'IN_PROGRESS'})
 if(prior){if(prior.request_hash!==requestHash||String(prior.actor_user_id)!==String(ctx.admin))throw fail('This recording key was used for different case evidence.');return receipt(prior)}
 const latest=(await db.query('SELECT * FROM payroll_i9_everify_event WHERE compliance_task_id=$1 ORDER BY revision DESC LIMIT 1',[task.id])).rows[0]
 if((latest?.revision||0)!==body.expectedRevision)throw fail('Another admin recorded a newer result. Reload before recording.')
 const today=(await db.query('SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0].today
 if(result.observedOn>today||(result.nextActionOn&&result.nextActionOn<today))throw fail('Use an actual observation date and a current or future next-action date.',400)
 try{const pdf=await PDFDocument.load(file.bytes);if(!pdf.getPageCount())throw new Error('Empty')}catch{throw fail('Upload readable PDF evidence without password protection.',400)}
 const document=(await db.query("INSERT INTO payroll_private_document(facility_id,employee_id,task_id,onboarding_cycle,filename,mime_type,encrypted_content,content_sha256) VALUES($1,$2,$3,$4,$5,'application/pdf',$6,$7) RETURNING id",[ctx.facility,ctx.employee,task.employer_task_id,task.onboarding_cycle,`EVerify-evidence-${body.requestKey.toLowerCase().slice(0,8)}.pdf`,encryptDocument(file.bytes,`${ctx.facility}:${ctx.employee}:${task.employer_task_id}`),file.hash])).rows[0]
 const revision=body.expectedRevision+1
 const event=(await db.query(`INSERT INTO payroll_i9_everify_event(facility_id,employee_id,compliance_task_id,signature_id,revision,actor_user_id,outcome,document_id,encrypted_evidence,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[ctx.facility,ctx.employee,task.id,task.signature_id,revision,ctx.admin,result.outcome,document.id,encryptDocument(Buffer.from(JSON.stringify(result)),aad(ctx,{compliance_task_id:task.id,revision,actor_user_id:ctx.admin})),body.requestKey,requestHash])).rows[0]
 const status=receipt(event).status
 await db.query("UPDATE payroll_compliance_task SET status=$1,completion_note=$2,completed_at=CASE WHEN $1='COMPLETE' THEN clock_timestamp() ELSE NULL END,completed_by=CASE WHEN $1='COMPLETE' THEN $3::bigint ELSE NULL END,next_review_on=$4,last_verified_on=$5,updated_at=clock_timestamp() WHERE id=$6",[status,`Retained E-Verify result event ${event.id}; review private evidence for case details.`,ctx.admin,result.nextActionOn||null,today,task.id])
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_EVERIFY_RESULT_RECORDED','compliance_task',$3,$4)",[ctx.facility,ctx.admin,String(task.id),{employeeId:ctx.employee,eventId:event.id,revision,documentId:document.id,status}])
 return receipt(event)
}
