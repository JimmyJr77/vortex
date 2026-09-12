import {quickbooksRequest} from './quickbooks.js'
import {carrierPremiumReversalPreview} from './carrierPremiumReversal.js'
import {resolveCarrierReversalJournal} from './carrierReversalDispatch.js'
import {updateCarrierReversalAlert} from './carrierReversalRecovery.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export function registerCarrierReversalPosting(app,pool,{fetcher=fetch}={}){
 app.post('/api/admin/payroll/carrier-reversal-authorizations/:id/post',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   if(req.body?.confirmed!==true||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.id))throw fail('Confirm the retained reversal posting or recovery action.',400)
   const facility=req.canonicalAccess.facilityId
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const a=(await db.query('SELECT r.* FROM payroll_carrier_reversal_authorization r JOIN payroll_carrier_premium_authorization p ON p.id=r.premium_authorization_id JOIN payroll_benefit_carrier_invoice i ON i.id=p.invoice_id WHERE r.id=$1 AND i.facility_id=$2',[req.params.id,facility])).rows[0]
   if(!a)throw fail('Reversal authorization was not found.',404)
   const checkCancellation=async()=>{if((await db.query('SELECT authorization_id FROM payroll_carrier_reversal_cancellation WHERE authorization_id=$1',[a.id])).rows.length)throw fail('This reversal authorization was cancelled.')}
   await checkCancellation()
   const existing=(await db.query('SELECT authorization_id FROM payroll_carrier_reversal_claim WHERE authorization_id=$1',[a.id])).rows.length>0
   const verify=async()=>{const preview=await carrierPremiumReversalPreview(db,facility,a.premium_authorization_id,a.preview.payload.TxnDate,{fetcher});if(preview.fingerprint!==a.fingerprint)throw fail('Reversal source, account or period facts changed. Review the authorization before posting.')}
   if(!existing){await verify();await db.query('INSERT INTO payroll_carrier_reversal_claim(authorization_id,created_by) VALUES($1,$2)',[a.id,req.adminId])}
   await db.query('COMMIT')
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await checkCancellation()
   const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   if(!qbo||qbo.realm_id!==a.preview.realmId||qbo.environment!==a.preview.environment)throw fail('Reconnect the authorized QuickBooks company and environment to recover this reversal.')
   if(!existing)await verify()
   const result=await resolveCarrierReversalJournal({id:a.id,payload:a.preview.payload},(path,options)=>quickbooksRequest(db,qbo,path,{...options,fetcher}),{allowCreate:!existing})
   await db.query('INSERT INTO payroll_carrier_reversal_observation(authorization_id,result) VALUES($1,$2)',[a.id,result])
   await updateCarrierReversalAlert(db,facility,a.id,result)
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_REVERSAL_POSTING_OBSERVED','carrier_reversal_authorization',$3,$4)",[facility,req.adminId,a.id,result])
   await db.query('COMMIT');res.json({success:true,data:result})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Reversal outcome needs recovery. Use the retained authorization.'})}finally{db.release()}
 })
}
