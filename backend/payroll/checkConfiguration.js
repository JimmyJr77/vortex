const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export async function payrollCheckConfiguration(db,facility){
 const connection=(await db.query('SELECT id,mode FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[facility])).rows[0]
 const history=(await db.query('SELECT id,connection_id,enabled,expiry_days,activation_reference,created_at,created_by FROM payroll_check_configuration WHERE facility_id=$1 ORDER BY id DESC',[facility])).rows
 const current=history[0]
 return {revision:Number(current?.id||0),connectionId:Number(connection?.id||0),mode:connection?.mode||null,status:!current?'NOT_CONFIGURED':!current.enabled?'DISABLED':Number(current.connection_id)!==Number(connection?.id)?'CONNECTION_CHANGED':'ACTIVATION_RECORDED',current:current||null,history}
}
export function registerCheckConfigurationRoutes(app,pool){
 const path='/api/admin/payroll/check-configuration'
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await payrollCheckConfiguration(pool,req.canonicalAccess.facilityId)})}catch{res.status(500).json({success:false,message:'Unable to read check configuration.'})}})
 app.post(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId
   if(b.confirmed!==true||typeof b.enabled!=='boolean'||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!Number.isSafeInteger(b.connectionId)||b.connectionId<=0||!Number.isInteger(b.expiryDays)||b.expiryDays<1||b.expiryDays>180||typeof b.activationReference!=='string'||b.activationReference.trim().length<12||b.activationReference.length>2000||/[\u0000-\u001f\u007f]/.test(b.activationReference))throw fail('Confirm the current funding connection, check activation reference and expiration of 1–180 days.')
   await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
   const state=await payrollCheckConfiguration(db,facility),reference=b.activationReference.trim()
   if(state.connectionId!==b.connectionId)throw fail('Funding connection changed. Refresh and confirm check activation for the current account.',409)
   const c=state.current
   if(c&&Number(c.connection_id)===b.connectionId&&c.enabled===b.enabled&&c.expiry_days===b.expiryDays&&c.activation_reference===reference){await db.query('COMMIT');return res.json({success:true,data:{revision:Number(c.id),reused:true}})}
   if(state.revision!==b.expectedRevision)throw fail('Check configuration changed. Refresh before saving.',409)
   if(b.enabled){
    const verified=(await db.query("SELECT status,created_at>=now()-interval '15 minutes' AS fresh FROM payroll_payment_connection_check WHERE connection_id=$1 ORDER BY id DESC LIMIT 1",[b.connectionId])).rows[0]
    if(verified?.status!=='VERIFIED'||!verified.fresh)throw fail('Verify the current funding account before recording check activation.',409)
   }
   const saved=(await db.query('INSERT INTO payroll_check_configuration(facility_id,connection_id,enabled,expiry_days,activation_reference,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[facility,b.connectionId,b.enabled,b.expiryDays,reference,req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_CONFIGURATION_RECORDED','check_configuration',$3,$4)",[facility,req.adminId,String(saved.id),{connectionId:b.connectionId,enabled:b.enabled,expiryDays:b.expiryDays,previousRevision:state.revision}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{revision:Number(saved.id),reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain check configuration.'})}finally{db.release()}
 })
}
