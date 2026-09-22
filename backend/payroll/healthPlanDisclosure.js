import {createHash,randomUUID} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {compensationEvidence} from './employmentCompensation.js'
import {healthPlanQualificationState} from './healthPlanQualification.js'
import {documentInput,encryptDocument,decryptDocument,vaultReady} from './onboarding.js'
import {payrollEmployeeAuth} from './employeeAuth.js'
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const day=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const context=(facility,id)=>`health-plan-disclosure:${facility}:${id}`
export async function healthDisclosureState(db,facility,planId,paymentDate){
 if(!day(paymentDate))throw fail('Choose the intended health election effective date.')
 const qualified=await healthPlanQualificationState(db,facility,planId,paymentDate)
 const basis={version:1,facilityId:String(facility),planId,planName:qualified.source.plan?.name||planId,employerName:qualified.source.employerName,qualificationId:qualified.current?.id||null,qualificationFingerprint:qualified.current?.source_fingerprint||null,qualificationStatus:qualified.status,issues:qualified.status==='QUALIFIED'?[]:['Retain current written-plan qualification for the selected effective date.']}
 const source={...basis,fingerprint:hash(basis)}
 const history=(await db.query('SELECT id,qualification_id,revision,source_fingerprint,disclosure,document_sha256,document_pages,created_at FROM payroll_health_plan_disclosure WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC',[facility,planId])).rows
 const current=history.find(row=>row.qualification_id===source.qualificationId&&row.disclosure.planYearStartsOn<=paymentDate&&row.disclosure.planYearEndsOn>=paymentDate)
 return {source,history,current:current||null,documentStorageReady:vaultReady(),status:!current?'NEEDS_DISCLOSURE':current.source_fingerprint!==source.fingerprint||source.issues.length?'STALE':'PUBLISHED'}
}
export async function employeeHealthDisclosure(db,facility,employeeId,planId,paymentDate){
 // Only selected current-cycle coverage is exposed. Internal qualification
 // PDFs, findings, source snapshots and administrator references stay private.
 const task=(await db.query("SELECT onboarding_cycle,response FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='PAY_REVIEW'",[facility,employeeId])).rows[0]
 const selection=task?.response?.benefitsElection?.selections?.find(item=>item.planId===planId&&item.optionId!=='WAIVE'&&item.taxTreatment==='PRETAX')
 if(!selection)throw fail('Select this pretax health coverage before opening its plan disclosure.',404)
 const state=await healthDisclosureState(db,facility,planId,paymentDate)
 if(state.status!=='PUBLISHED')throw fail('Your hiring administrator must publish the current employee plan disclosure.',409)
 const row=state.current
 return {id:row.id,planId,planName:state.source.planName,employerName:state.source.employerName,onboardingCycle:task.onboarding_cycle,qualificationId:state.source.qualificationId,sourceFingerprint:state.source.fingerprint,revision:row.revision,disclosure:row.disclosure,documentSha256:row.document_sha256,documentPages:row.document_pages}
}
export async function healthDisclosureBytes(db,facility,id){
 const row=(await db.query('SELECT encrypted_document,document_sha256 FROM payroll_health_plan_disclosure WHERE facility_id=$1 AND id=$2',[facility,id])).rows[0]
 if(!row)throw fail('Employee disclosure document not found.',404)
 const bytes=decryptDocument(row.encrypted_document,context(facility,id))
 if(createHash('sha256').update(bytes).digest('hex')!==row.document_sha256)throw fail('Employee plan disclosure needs integrity review.',409)
 return bytes
}
async function disclosureInput(b){
 if(!day(b.planYearStartsOn)||!day(b.planYearEndsOn)||b.planYearEndsOn<b.planYearStartsOn||Date.parse(b.planYearEndsOn)-Date.parse(b.planYearStartsOn)>366*86400000||b.employeeDisclosureConfirmed!==true)throw fail('Confirm the employee-safe disclosure and its plan-year dates.')
 for(const key of ['employeeTerms','electionChangesTerms'])if(typeof b[key]!=='string'||b[key].trim().length<20||b[key].length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(b[key]))throw fail('Retain employee-facing eligibility, salary-reduction and election/change terms.')
 const file=documentInput(b.document||{});if(file.mime!=='application/pdf')throw fail('Upload the employee-facing plan disclosure as a PDF.')
 let pages;try{pages=(await PDFDocument.load(file.bytes)).getPageCount();if(pages<1||pages>500)throw new Error('pages')}catch{throw fail('Upload a readable unencrypted employee disclosure PDF with 1–500 pages.')}
 return {disclosure:{version:1,planYearStartsOn:b.planYearStartsOn,planYearEndsOn:b.planYearEndsOn,employeeTerms:b.employeeTerms.trim(),electionChangesTerms:b.electionChangesTerms.trim(),employeeDisclosureConfirmed:true},file,pages}
}
export function registerHealthPlanDisclosure(app,pool){
 const base='/api/admin/payroll/health-plan-qualification/:planId/disclosures'
 const endpoint=(write,work)=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');if(write)await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId]);const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain the employee health plan disclosure.'})}finally{db.release()}}
 app.get(base,endpoint(false,(db,req)=>healthDisclosureState(db,req.canonicalAccess.facilityId,req.params.planId,req.query.paymentDate)))
 app.post(base,endpoint(true,async(db,req)=>{
  const b=req.body||{},facility=req.canonicalAccess.facilityId,planId=req.params.planId
  if(!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!day(b.paymentDate))throw fail('Use the current disclosure source, effective date and review request key.')
  const {disclosure,file,pages}=await disclosureInput(b)
  if(b.paymentDate<disclosure.planYearStartsOn||b.paymentDate>disclosure.planYearEndsOn)throw fail('The election effective date must fall within the disclosed plan year.')
  const digest=hash({planId,paymentDate:b.paymentDate,sourceFingerprint:b.sourceFingerprint,expectedRevision:b.expectedRevision,disclosure,documentSha256:file.hash})
  const old=(await db.query('SELECT id,request_fingerprint FROM payroll_health_plan_disclosure WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(old){if(old.request_fingerprint!==digest)throw fail('This request key belongs to another plan disclosure.',409);return {id:old.id,reused:true}}
  const state=await healthDisclosureState(db,facility,planId,b.paymentDate)
  if(state.source.fingerprint!==b.sourceFingerprint||(state.history[0]?.revision||0)!==b.expectedRevision)throw fail('The qualification or plan disclosure changed. Reload before publishing.',409)
  if(state.source.issues.length)throw fail(state.source.issues.join(' '),409)
  const id=randomUUID()
  await db.query('INSERT INTO payroll_health_plan_disclosure(id,facility_id,plan_id,qualification_id,revision,source_fingerprint,source,disclosure,document_sha256,document_pages,encrypted_document,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[id,facility,planId,state.source.qualificationId,b.expectedRevision+1,state.source.fingerprint,state.source,disclosure,file.hash,pages,encryptDocument(file.bytes,context(facility,id)),b.requestKey,digest,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'HEALTH_PLAN_DISCLOSURE_PUBLISHED','health_plan_disclosure',$3,$4)",[facility,req.adminId,id,{planId,qualificationId:state.source.qualificationId,revision:b.expectedRevision+1,documentSha256:file.hash}])
  return {id,reused:false}
 }))
}
export function registerEmployeeHealthPlanDisclosure(app,pool){
 const auth=payrollEmployeeAuth(pool),employeeBase='/api/payroll/employee/health-plans/:planId/disclosure'
 app.get(employeeBase,auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const s=req.payrollEmployee,data=await employeeHealthDisclosure(db,s.facility_id,s.employee_id,req.params.planId,req.query.effectiveOn);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load your health plan disclosure.'})}finally{db.release()}
 })
 app.get(`${employeeBase}/document`,auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const s=req.payrollEmployee,disclosure=await employeeHealthDisclosure(db,s.facility_id,s.employee_id,req.params.planId,req.query.effectiveOn)
   if(req.query.disclosureId!==disclosure.id)throw fail('The employee plan disclosure changed. Reload before opening the PDF.',409)
   const bytes=await healthDisclosureBytes(db,s.facility_id,disclosure.id);await db.query('COMMIT');res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="Employee-health-plan-disclosure.pdf"');res.setHeader('X-Content-Type-Options','nosniff');res.send(bytes)
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retrieve your health plan disclosure.'})}finally{db.release()}
 })
}
