import {retirementW2Codes} from './retirementW2Codes.js'
export const compensationCategories={retirement:'Retirement contributions or participation',dependentCare:'Dependent-care benefits',fringeBenefits:'Taxable fringe benefits',thirdPartySickPay:'Third-party sick pay',tips:'Tips and tipped occupations',equityDeferred:'Equity or deferred compensation',statutoryEmployee:'Statutory employee treatment',other:'Other reportable compensation or exclusions'}
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export function compensationApplicabilityInput(body){
 const b=body||{},reference=typeof b.reference==='string'?b.reference.trim():''
 if(b.year!==2026||b.confirmed!==true||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||typeof b.sourceFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.sourceFingerprint)||reference.length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference)||!b.categories||Array.isArray(b.categories)||typeof b.categories!=='object'||Object.keys(b.categories).length!==Object.keys(compensationCategories).length||Object.keys(compensationCategories).some(key=>!['NOT_APPLICABLE','APPLICABLE','UNRESOLVED',...(key==='retirement'?['EMPLOYER_ONLY_PARTICIPATION','STANDARD_401K_DEFERRALS']:[])].includes(b.categories[key])))throw fail('Review every compensation category with an explicit applicability decision, current annual source and supporting evidence.')
 if(b.categories.retirement==='EMPLOYER_ONLY_PARTICIPATION'&&b.retirementEmployerOnlyConfirmed!==true)throw fail('Confirm active retirement participation with employer funding only and no employee contributions or other retirement amounts requiring W-2 reporting.')
 if(b.categories.retirement==='STANDARD_401K_DEFERRALS'&&b.retirementStandard401kConfirmed!==true)throw fail('Confirm only reconciled internal standard 401(k) employee deferrals require retirement W-2 reporting, with no other retirement reporting adjustments.')
 return {...b,categories:Object.fromEntries(Object.keys(compensationCategories).map(key=>[key,b.categories[key]])),reference}
}
export async function compensationApplicabilityHistory(db,facility,employee,source){
 const rows=(await db.query('SELECT id,source_fingerprint,categories,reference,created_by,created_at FROM payroll_compensation_applicability WHERE facility_id=$1 AND employee_id=$2 AND payment_year=2026 ORDER BY id DESC',[facility,employee])).rows
 return rows.map((r,index)=>({...r,status:r.source_fingerprint!==source?'STALE':index===0?'CURRENT':'SUPERSEDED'}))
}
export function registerCompensationApplicability(app,pool,prepare){
 app.post('/api/admin/payroll/employees/:employeeId/compensation-applicability',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const input=compensationApplicabilityInput(req.body),employee=Number(req.params.employeeId),facility=req.canonicalAccess.facilityId
   if(!/^[1-9]\d*$/.test(req.params.employeeId)||!Number.isSafeInteger(employee))throw fail('Choose a valid employee.')
   await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`compensation-applicability:${facility}:${employee}:2026`])
   const data=await prepare(db,facility),record=data.employees.find(e=>e.employeeId===employee)
   if(!record)throw fail('Employee annual payment inputs not found.',404)
   if(record.retirementContributions?.hasEmployeeDeferrals&&['NOT_APPLICABLE','EMPLOYER_ONLY_PARTICIPATION'].includes(input.categories.retirement))throw fail('Retained employee deferrals require applicable retirement contribution reporting.',409)
   if(record.sourceFingerprint!==input.sourceFingerprint||record.sourceStatus!=='READY_FOR_REVIEW')throw fail('Annual inputs changed or require reconciliation. Refresh annual preparation.',409)
   if(input.categories.retirement==='STANDARD_401K_DEFERRALS')try{retirementW2Codes(record.retirementContributions)}catch{throw fail('Reconcile standard 401(k) annual employee contributions before selecting this reporting treatment.',409)}
   const prior=record.compensationApplicabilityHistory[0]
   if(prior?.status==='CURRENT'&&prior.reference===input.reference&&Object.keys(compensationCategories).every(key=>prior.categories[key]===input.categories[key])){await db.query('COMMIT');return res.json({success:true,data:{revision:Number(prior.id),reused:true}})}
   if(Number(prior?.id||0)!==input.expectedRevision)throw fail('Compensation review changed. Refresh annual preparation.',409)
   const saved=(await db.query('INSERT INTO payroll_compensation_applicability(facility_id,employee_id,payment_year,source_fingerprint,categories,reference,created_by) VALUES($1,$2,2026,$3,$4,$5,$6) RETURNING id',[facility,employee,input.sourceFingerprint,input.categories,input.reference,req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'COMPENSATION_APPLICABILITY_RECORDED','compensation_applicability',$3,$4)",[facility,req.adminId,String(saved.id),{employeeId:employee,year:2026,sourceFingerprint:input.sourceFingerprint}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{revision:Number(saved.id),reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.code==='40001'?409:e.status||500).json({success:false,message:e.code==='40001'?'Annual sources changed concurrently. Refresh annual preparation.':e.status?e.message:'Unable to save compensation applicability.'})}finally{db.release()}
 })
}
