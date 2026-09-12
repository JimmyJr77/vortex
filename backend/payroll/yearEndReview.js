import {encryptDocument,decryptDocument} from './onboarding.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export function registerAnnualInputReview(app,pool,prepare){
 app.get('/api/admin/payroll/employees/:employeeId/annual-input-review/:reviewId',async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  if([req.params.employeeId,req.params.reviewId].some(id=>! /^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id))))return res.status(400).json({success:false,message:'Choose a valid employee and annual review.'})
  try{
   const facility=req.canonicalAccess.facilityId,employeeId=Number(req.params.employeeId)
   const row=(await pool.query('SELECT r.* FROM payroll_annual_input_review r JOIN payroll_employee e ON e.id=r.employee_id AND e.facility_id=r.facility_id WHERE r.facility_id=$1 AND r.employee_id=$2 AND r.id=$3',[facility,employeeId,req.params.reviewId])).rows[0]
   if(!row)throw fail('Annual input review not found.',404)
   const snapshot=JSON.parse(decryptDocument(row.encrypted_snapshot,`payroll-annual-input-review:${facility}:${employeeId}:${row.payment_year}`).toString())
   if(snapshot.version!==1||snapshot.year!==row.payment_year||snapshot.employee?.employeeId!==employeeId||snapshot.employee.sourceFingerprint!==row.source_fingerprint)throw new Error('Snapshot identity mismatch')
   res.json({success:true,data:{id:Number(row.id),reference:row.reference,createdBy:row.created_by,createdAt:row.created_at,snapshot}})
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read the retained annual review snapshot.'})}
 })
 app.post('/api/admin/payroll/employees/:employeeId/annual-input-review',async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  const employeeId=Number(req.params.employeeId),body=req.body||{},facility=req.canonicalAccess.facilityId
  if(!/^[1-9]\d*$/.test(req.params.employeeId)||!Number.isSafeInteger(employeeId)||body.year!==2026||body.confirmed!==true||!Number.isSafeInteger(body.expectedReviewId)||body.expectedReviewId<0||typeof body.sourceFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(body.sourceFingerprint)||typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.trim().length>2000||/[\u0000-\u001f\u007f]/.test(body.reference))return res.status(400).json({success:false,message:'Review the 2026 annual inputs, provide a verification reference and confirm the current source and review revision.'})
  const db=await pool.connect()
  try{
   await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`annual-input-review:${facility}:${employeeId}:2026`])
   const preparation=await prepare(db,facility),employee=preparation.employees.find(e=>e.employeeId===employeeId)
   if(!employee)throw fail('Employee annual payment inputs not found.',404)
   if(employee.sourceFingerprint!==body.sourceFingerprint||employee.sourceStatus!=='READY_FOR_REVIEW')throw fail('Annual inputs changed or need reconciliation. Refresh preparation before recording a review.',409)
   const prior=employee.inputReviewHistory[0],reference=body.reference.trim()
   if(prior?.source_fingerprint===body.sourceFingerprint&&prior.reference===reference){await db.query('COMMIT');return res.json({success:true,data:{id:Number(prior.id),reused:true}})}
   if(Number(prior?.id||0)!==body.expectedReviewId)throw fail('Annual input review changed. Refresh preparation before recording another review.',409)
   const {inputReviewHistory,...snapshot}=employee
   const encrypted=encryptDocument(Buffer.from(JSON.stringify({version:1,year:2026,employer:preparation.employer,employee:snapshot})),`payroll-annual-input-review:${facility}:${employeeId}:2026`)
   const saved=(await db.query('INSERT INTO payroll_annual_input_review(facility_id,employee_id,payment_year,source_fingerprint,encrypted_snapshot,reference,created_by) VALUES($1,$2,2026,$3,$4,$5,$6) RETURNING id',[facility,employeeId,body.sourceFingerprint,encrypted,reference,req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'ANNUAL_INPUT_REVIEW_RECORDED','annual_input_review',$3,$4)",[facility,req.adminId,String(saved.id),{employeeId,year:2026,sourceFingerprint:body.sourceFingerprint}])
   await db.query('COMMIT');res.setHeader('Cache-Control','no-store');res.status(201).json({success:true,data:{id:Number(saved.id),reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.code==='40001'?409:e.status||500).json({success:false,message:e.code==='40001'?'Annual inputs changed concurrently. Refresh preparation and retry.':e.status?e.message:'Unable to record annual input review.'})}finally{db.release()}
 })
}
