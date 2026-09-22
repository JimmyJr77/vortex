import {createHash,randomUUID} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {benefitPlans} from './benefitCatalog.js'
import {compensationEvidence} from './employmentCompensation.js'
import {documentInput,encryptDocument,decryptDocument,vaultReady} from './onboarding.js'
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const validDay=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const context=(facility,id)=>`health-plan-qualification:${facility}:${id}`
export async function healthPlanQualificationSource(db,facility,planId){
 if(typeof planId!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(planId))throw fail('Choose a published health benefit plan.')
 const settings=(await db.query('SELECT legal_business_name,onboarding_policy FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]
 if(!settings)throw fail('Employer not found.',404)
 const plan=benefitPlans(settings.onboarding_policy).find(p=>p.id===planId)||null
 const issues=[]
 if(!plan)issues.push('Publish this benefit plan before reviewing its tax qualification.')
 if(!plan?.options.some(o=>o.taxTreatment==='PRETAX'&&o.employeeCostCents>0))issues.push('This plan has no employee-funded pretax coverage option.')
 if(!settings.legal_business_name?.trim())issues.push('Retain the legal employer name before reviewing the written plan.')
 const basis={version:1,facilityId:String(facility),planId,employerName:settings.legal_business_name||'',plan,issues}
 return {...basis,fingerprint:hash(basis)}
}
export async function healthPlanQualificationState(db,facility,planId,paymentDate){
 if(paymentDate!==undefined&&!validDay(paymentDate))throw fail('Choose a valid payment date for the qualification review.')
 const source=await healthPlanQualificationSource(db,facility,planId)
 const history=(await db.query('SELECT id,revision,effective_on::text,effective_through::text,source_fingerprint,review,document_sha256,document_pages,created_at FROM payroll_health_plan_qualification WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC',[facility,planId])).rows
 const current=paymentDate===undefined?history[0]:history.find(row=>row.effective_on<=paymentDate&&row.effective_through>=paymentDate)
 return {source,history,current:current||null,documentStorageReady:vaultReady(),status:!current?'NEEDS_REVIEW':current.review.disposition==='SUSPENDED'?'SUSPENDED':current.source_fingerprint!==source.fingerprint?'STALE':source.issues.length?'REVIEW_REQUIRED':'QUALIFIED'}
}
export async function requireHealthPlanQualification(db,facility,planId,paymentDate){
 const state=await healthPlanQualificationState(db,facility,planId,paymentDate)
 if(state.status!=='QUALIFIED')throw fail('Retain current dated Section 125 written-plan qualification for this health benefit before payroll.',409)
 return {reviewId:state.current.id,sourceFingerprint:state.source.fingerprint,review:state.current.review,documentSha256:state.current.document_sha256,fingerprint:hash({reviewId:state.current.id,sourceFingerprint:state.source.fingerprint,review:state.current.review,documentSha256:state.current.document_sha256})}
}
async function reviewInput(body){
 const {disposition,effectiveOn,effectiveThrough}=body
 if(!['QUALIFIED','SUSPENDED'].includes(disposition)||!validDay(effectiveOn)||!validDay(effectiveThrough)||effectiveThrough<effectiveOn||body.confirmed!==true||typeof body.reference!=='string'||body.reference.trim().length<20||body.reference.length>2000||/[\u0000-\u001f\u007f]/.test(body.reference))throw fail('Confirm the qualification decision, effective dates and supporting review reference.')
 const review={disposition,effectiveOn,effectiveThrough,reference:body.reference.trim()}
 if(disposition==='SUSPENDED'){
  if(body.document)throw fail('A suspension does not accept a replacement qualified-plan document.')
  return {review,file:null,pages:null}
 }
 for(const key of ['writtenPlanConfirmed','eligibleBenefitsConfirmed','nondiscriminationConfirmed'])if(body[key]!==true)throw fail('Confirm the written cafeteria plan, eligible accident/health insurance benefits and applicable nondiscrimination findings.')
 if(body.classification!=='SECTION125_ACCIDENT_HEALTH_PREMIUM')throw fail('Choose the reviewed accident/health insurance premium classification.')
 const file=documentInput(body.document||{})
 if(file.mime!=='application/pdf')throw fail('Retain the written cafeteria plan and supporting qualification evidence as a PDF.')
 let pages
 try{const pdf=await PDFDocument.load(file.bytes);pages=pdf.getPageCount();if(pages<1||pages>500)throw new Error('pages')}catch{throw fail('Upload a readable, unencrypted written-plan PDF with 1–500 pages.')}
 return {review:{...review,classification:body.classification,writtenPlanConfirmed:true,eligibleBenefitsConfirmed:true,nondiscriminationConfirmed:true},file,pages}
}
export function registerHealthPlanQualification(app,pool){
 const base='/api/admin/payroll/health-plan-qualification/:planId'
 const endpoint=(write,work)=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');if(write)await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId]);const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain health plan qualification.'})}finally{db.release()}}
 app.get(base,endpoint(false,(db,req)=>healthPlanQualificationState(db,req.canonicalAccess.facilityId,req.params.planId,req.query.paymentDate)))
 app.post(base,endpoint(true,async(db,req)=>{
  const b=req.body||{},facility=req.canonicalAccess.facilityId,planId=req.params.planId
  if(!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!/^[-a-zA-Z0-9]{1,80}$/.test(planId)||typeof b.sourceFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.sourceFingerprint))throw fail('Use the current health plan source, revision and review request key.')
  const {review,file,pages}=await reviewInput(b),digest=hash({planId,sourceFingerprint:b.sourceFingerprint,expectedRevision:b.expectedRevision,review,documentSha256:file?.hash||null})
  const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_health_plan_qualification WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==digest)throw fail('This request key belongs to a different health plan review.',409);return {id:prior.id,reused:true}}
  const state=await healthPlanQualificationState(db,facility,planId)
  if(state.source.fingerprint!==b.sourceFingerprint||(state.history[0]?.revision||0)!==b.expectedRevision)throw fail('The health benefit plan or qualification review changed. Reload before saving.',409)
  if(review.disposition==='QUALIFIED'&&state.source.issues.length)throw fail(state.source.issues.join(' '),409)
  const id=randomUUID(),encrypted=file?encryptDocument(file.bytes,context(facility,id)):null
  await db.query('INSERT INTO payroll_health_plan_qualification(id,facility_id,plan_id,revision,effective_on,effective_through,source_fingerprint,source,review,document_sha256,document_pages,encrypted_document,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[id,facility,planId,b.expectedRevision+1,review.effectiveOn,review.effectiveThrough,state.source.fingerprint,state.source,review,file?.hash||null,pages,encrypted,b.requestKey,digest,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'HEALTH_PLAN_QUALIFICATION_REVIEWED','health_plan_qualification',$3,$4)",[facility,req.adminId,id,{planId,revision:b.expectedRevision+1,review,sourceFingerprint:state.source.fingerprint,documentSha256:file?.hash||null}])
  return {id,reused:false}
 }))
 app.get(`${base}/:reviewId/document`,async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{
   if(!uuid(req.params.reviewId))throw fail('Choose a retained health plan review.')
   const facility=req.canonicalAccess.facilityId,row=(await pool.query('SELECT id,document_sha256,encrypted_document FROM payroll_health_plan_qualification WHERE facility_id=$1 AND plan_id=$2 AND id=$3',[facility,req.params.planId,req.params.reviewId])).rows[0]
   if(!row?.encrypted_document)throw fail('Written plan document not found.',404)
   const bytes=decryptDocument(row.encrypted_document,context(facility,row.id))
   if(createHash('sha256').update(bytes).digest('hex')!==row.document_sha256)throw fail('Retained health plan document needs integrity review.',409)
   res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="Section-125-written-plan.pdf"');res.setHeader('X-Content-Type-Options','nosniff');res.send(bytes)
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retrieve the retained written plan.'})}
 })
}
