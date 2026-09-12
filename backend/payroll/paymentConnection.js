import {isDeepStrictEqual} from 'node:util'
import {verifyModernTreasuryFundingAccount} from './modernTreasuryPayments.js'
import {encryptDocument,decryptDocument,vaultReady} from './onboarding.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const context=facility=>`payroll-payment-connection:${facility}`
function input(body){
 if(!uuid(body.organizationId)||!uuid(body.originatingAccountId)||!['TEST','LIVE'].includes(body.mode)||typeof body.apiKey!=='string'||!body.apiKey.trim()||body.apiKey.length>4096||/[\u0000-\u0020\u007f]/.test(body.apiKey)||typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.length>2000||/[\u0000-\u001f\u007f]/.test(body.reference)||body.confirmed!==true||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)throw fail('Provide the organization, funding account, API key, mode, configuration reference and current revision; confirm the connection details.')
 return {version:1,provider:'MODERN_TREASURY',organizationId:body.organizationId.toLowerCase(),originatingAccountId:body.originatingAccountId.toLowerCase(),apiKey:body.apiKey,mode:body.mode,reference:body.reference.trim()}
}
// Only internal consumers may decrypt a specifically retained revision. The
// existence of configuration never authorizes money movement.
export async function readPayrollPaymentConnection(db,facility,revision){
 const row=(await db.query('SELECT encrypted_configuration FROM payroll_payment_connection WHERE facility_id=$1 AND id=$2',[facility,revision])).rows[0]
 if(!row)throw fail('Payroll payment connection not found.',404)
 return JSON.parse(decryptDocument(row.encrypted_configuration,context(facility)).toString())
}
export function registerPaymentConnectionRoutes(app,pool,{fetcher=fetch}={}){
 const route='/api/admin/payroll/payment-connection'
 app.get(route,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const rows=(await pool.query('SELECT id,mode,created_by,created_at FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC',[req.canonicalAccess.facilityId])).rows
  const checks=rows.length?(await pool.query('SELECT id,status,reason,created_at,created_by FROM payroll_payment_connection_check WHERE connection_id=$1 ORDER BY id DESC',[rows[0].id])).rows:[]
  res.json({success:true,data:{revision:Number(rows[0]?.id||0),status:rows.length?'CONFIGURED_UNVERIFIED':'NOT_CONFIGURED',verification:checks[0]||null,verificationHistory:checks,vaultReady:vaultReady(),executionAvailable:false,history:rows.map((row,index)=>({...row,status:index?'SUPERSEDED':'CURRENT'}))}})
 }catch{res.status(500).json({success:false,message:'Unable to read payroll payment configuration.'})}})
 app.post(route,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const configuration=input(req.body||{}),facility=req.canonicalAccess.facilityId
   await db.query('BEGIN')
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[context(facility)])
   const current=(await db.query('SELECT id FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[facility])).rows[0]
   if(current&&isDeepStrictEqual(await readPayrollPaymentConnection(db,facility,current.id),configuration)){
    await db.query('COMMIT');return res.json({success:true,data:{revision:Number(current.id),reused:true,status:'CONFIGURED_UNVERIFIED'}})
   }
   if(Number(current?.id||0)!==req.body.expectedRevision)throw fail('Payment configuration changed. Refresh before saving.',409)
   const encrypted=encryptDocument(Buffer.from(JSON.stringify(configuration)),context(facility))
   const saved=(await db.query('INSERT INTO payroll_payment_connection(facility_id,encrypted_configuration,mode,created_by) VALUES($1,$2,$3,$4) RETURNING id',[facility,encrypted,configuration.mode,req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'PAYMENT_CONNECTION_RECORDED','payment_connection',$3,$4)",[facility,req.adminId,String(saved.id),{previousRevision:Number(current?.id||0),mode:configuration.mode}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{revision:Number(saved.id),reused:false,status:'CONFIGURED_UNVERIFIED'}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to save payroll payment configuration.'})}finally{db.release()}
 })
 app.post(`${route}/verify`,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   if(!Number.isSafeInteger(req.body?.expectedRevision)||req.body.expectedRevision<=0)throw fail('Choose the current payment connection revision.')
   const facility=req.canonicalAccess.facilityId
   await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[context(facility)])
   const current=(await db.query('SELECT id FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[facility])).rows[0]
   if(Number(current?.id)!==req.body.expectedRevision)throw fail('Payment configuration changed. Refresh before verifying.',409)
   const configuration=await readPayrollPaymentConnection(db,facility,current.id)
   const result=await verifyModernTreasuryFundingAccount({...configuration,fetcher})
   const check=(await db.query('INSERT INTO payroll_payment_connection_check(connection_id,status,reason,created_by) VALUES($1,$2,$3,$4) RETURNING id,status,reason,created_at',[current.id,result.status,result.reason,req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'PAYMENT_CONNECTION_CHECKED','payment_connection',$3,$4)",[facility,req.adminId,String(current.id),{checkId:Number(check.id),...result}])
   await db.query('COMMIT');res.json({success:true,data:check})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to verify payroll payment configuration.'})}finally{db.release()}
 })
}
