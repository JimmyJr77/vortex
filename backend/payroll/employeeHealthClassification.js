const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export function employeeHealthInput(body){
 const b=body||{},reference=typeof b.reference==='string'?b.reference.trim():''
 if(b.year!==2026||b.confirmed!==true||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!Number.isSafeInteger(b.determinationId)||b.determinationId<=0||typeof b.sourceFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.sourceFingerprint)||!['REPORT','RELIEF_USED','NO_APPLICABLE_COVERAGE','UNRESOLVED'].includes(b.disposition)||reference.length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference)||(b.disposition==='REPORT'?(!Number.isSafeInteger(b.reportableCostCents)||b.reportableCostCents<=0):b.reportableCostCents!==null))throw fail('Provide the reviewed 2026 coverage classification, current sources and evidence. Reporting requires a positive verified cost in whole cents; other dispositions require no amount.')
 return {...b,reference}
}
export async function employeeHealthHistory(db,facility,employee,sourceFingerprint,determinationId){
 const rows=(await db.query('SELECT id,determination_id,source_fingerprint,disposition,reportable_cost_cents,reference,created_by,created_at FROM payroll_employee_health_classification WHERE facility_id=$1 AND employee_id=$2 AND payment_year=2026 ORDER BY id DESC',[facility,employee])).rows
 return rows.map((r,index)=>({...r,status:r.source_fingerprint!==sourceFingerprint||Number(r.determination_id)!==determinationId?'STALE':index===0?'CURRENT':'SUPERSEDED'}))
}
export function registerEmployeeHealthClassification(app,pool,prepare){
 app.post('/api/admin/payroll/employees/:employeeId/health-coverage-classification',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const input=employeeHealthInput(req.body),employeeId=Number(req.params.employeeId),facility=req.canonicalAccess.facilityId
   if(!/^[1-9]\d*$/.test(req.params.employeeId)||!Number.isSafeInteger(employeeId))throw fail('Choose a valid employee.')
   await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`employee-health-classification:${facility}:${employeeId}:2026`])
   const data=await prepare(db,facility),employee=data.employees.find(e=>e.employeeId===employeeId),determination=data.healthCoverageReporting.history[0]
   if(!employee)throw fail('Employee annual payment inputs not found.',404)
   if(!determination||Number(determination.id)!==input.determinationId||employee.sourceFingerprint!==input.sourceFingerprint||employee.sourceStatus!=='READY_FOR_REVIEW')throw fail('Coverage classification sources changed or require reconciliation. Refresh annual preparation.',409)
   if(input.disposition!=='UNRESOLVED'&&determination.disposition==='UNRESOLVED'||input.disposition==='RELIEF_USED'&&determination.disposition!=='SMALL_EMPLOYER_RELIEF')throw fail('Resolve the employer reporting determination and verify relief eligibility before classifying coverage.')
   const prior=employee.healthClassificationHistory[0]
   if(prior?.status==='CURRENT'&&prior.disposition===input.disposition&&(prior.reportable_cost_cents===null?null:Number(prior.reportable_cost_cents))===input.reportableCostCents&&prior.reference===input.reference){await db.query('COMMIT');return res.json({success:true,data:{revision:Number(prior.id),reused:true}})}
   if(Number(prior?.id||0)!==input.expectedRevision)throw fail('Employee coverage classification changed. Refresh annual preparation.',409)
   const saved=(await db.query('INSERT INTO payroll_employee_health_classification(facility_id,employee_id,payment_year,determination_id,source_fingerprint,disposition,reportable_cost_cents,reference,created_by) VALUES($1,$2,2026,$3,$4,$5,$6,$7,$8) RETURNING id',[facility,employeeId,input.determinationId,input.sourceFingerprint,input.disposition,input.reportableCostCents,input.reference,req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'EMPLOYEE_HEALTH_CLASSIFICATION_RECORDED','employee_health_classification',$3,$4)",[facility,req.adminId,String(saved.id),{employeeId,year:2026,determinationId:input.determinationId,sourceFingerprint:input.sourceFingerprint}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{revision:Number(saved.id),reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.code==='40001'?409:e.status||500).json({success:false,message:e.code==='40001'?'Coverage sources changed concurrently. Refresh annual preparation.':e.status?e.message:'Unable to save employee coverage classification.'})}finally{db.release()}
 })
}
