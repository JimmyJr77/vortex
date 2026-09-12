const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export function healthReportingInput(body){
 const {year,disposition,priorYearW2Count,expectedRevision,confirmed}=body||{},reference=typeof body?.reference==='string'?body.reference.trim():''
 if(year!==2026||!['REPORT','SMALL_EMPLOYER_RELIEF','UNRESOLVED'].includes(disposition)||confirmed!==true||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||reference.length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference)||priorYearW2Count!==null&&(!Number.isSafeInteger(priorYearW2Count)||priorYearW2Count<0||priorYearW2Count>2147483647)||disposition==='SMALL_EMPLOYER_RELIEF'&&(priorYearW2Count===null||priorYearW2Count>=250))throw fail('Provide a reviewed 2026 reporting determination and reference. Small-employer relief requires the verified number of Forms W-2 required for 2025, fewer than 250.')
 return {year,disposition,priorYearW2Count,expectedRevision,reference}
}
export async function healthReportingHistory(db,facility){
 const rows=(await db.query('SELECT id,payment_year,disposition,prior_year_w2_count,reference,created_by,created_at FROM payroll_health_reporting_determination WHERE facility_id=$1 AND payment_year=2026 ORDER BY id DESC',[facility])).rows
 return {year:2026,revision:Number(rows[0]?.id||0),history:rows.map((row,index)=>({...row,status:index===0?'CURRENT':'SUPERSEDED'}))}
}
export function registerHealthReporting(app,pool){
 app.get('/api/admin/payroll/health-coverage-reporting',async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  if(String(req.query.year)!=='2026')return res.status(400).json({success:false,message:'Choose reporting year 2026.'})
  try{res.json({success:true,data:await healthReportingHistory(pool,req.canonicalAccess.facilityId)})}catch{res.status(500).json({success:false,message:'Unable to read health reporting determinations.'})}
 })
 app.post('/api/admin/payroll/health-coverage-reporting',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const input=healthReportingInput(req.body),facility=req.canonicalAccess.facilityId
   await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`health-reporting:${facility}:2026`])
   const current=await healthReportingHistory(db,facility),prior=current.history[0]
   if(prior&&prior.disposition===input.disposition&&prior.prior_year_w2_count===input.priorYearW2Count&&prior.reference===input.reference){await db.query('COMMIT');return res.json({success:true,data:{revision:Number(prior.id),reused:true}})}
   if(current.revision!==input.expectedRevision)throw fail('Health reporting determination changed. Refresh its history before saving.',409)
   const saved=(await db.query('INSERT INTO payroll_health_reporting_determination(facility_id,payment_year,disposition,prior_year_w2_count,reference,created_by) VALUES($1,2026,$2,$3,$4,$5) RETURNING id',[facility,input.disposition,input.priorYearW2Count,input.reference,req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'HEALTH_REPORTING_DETERMINATION_RECORDED','health_reporting_determination',$3,$4)",[facility,req.adminId,String(saved.id),{year:2026,disposition:input.disposition,previousRevision:current.revision}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{revision:Number(saved.id),reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to save health reporting determination.'})}finally{db.release()}
 })
}
