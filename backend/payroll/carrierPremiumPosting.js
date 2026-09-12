import {updateCarrierPremiumAlert} from './carrierPremiumRecovery.js'
import {quickbooksRequest} from './quickbooks.js'
import {resolveCarrierPremiumJournal} from './carrierPremiumDispatch.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export function registerCarrierPremiumPosting(app,pool,prepare,{fetcher=fetch}={}){
 app.post('/api/admin/payroll/carrier-premium-authorizations/:id/post',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   if(req.body?.confirmed!==true||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.id))throw fail('Confirm the retained premium posting or recovery action.',400)
   const facility=req.canonicalAccess.facilityId
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const a=(await db.query('SELECT a.* FROM payroll_carrier_premium_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE i.facility_id=$1 AND a.id=$2',[facility,req.params.id])).rows[0]
   if(!a)throw fail('Premium authorization was not found.',404)
   if((await db.query('SELECT authorization_id FROM payroll_carrier_premium_cancellation WHERE authorization_id=$1',[a.id])).rows.length)throw fail('This premium authorization was cancelled.')
   const existing=(await db.query('SELECT authorization_id FROM payroll_carrier_premium_claim WHERE authorization_id=$1',[a.id])).rows.length>0
   const verify=async()=>{const {check}=await prepare(db,{...req,params:{id:a.invoice_id},body:{expenseAccountId:a.preview.accounts[0].id,carrierAccountId:a.preview.accounts[1].id}},true);if(check.premiumPreview.fingerprint!==a.fingerprint)throw fail('Premium source, account or period facts changed. Review the authorization before posting.')}
   if(!existing){await verify();await db.query('INSERT INTO payroll_carrier_premium_claim(authorization_id,created_by) VALUES($1,$2)',[a.id,req.adminId])}
   await db.query('COMMIT')
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   if((await db.query('SELECT authorization_id FROM payroll_carrier_premium_cancellation WHERE authorization_id=$1',[a.id])).rows.length)throw fail('This premium authorization was cancelled.')
   let createAttempted=false,result
   try{
   const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   if(!qbo||qbo.realm_id!==a.preview.realmId||qbo.environment!==a.preview.environment)throw fail('Reconnect the authorized QuickBooks company and environment to recover this premium journal.')
   if(!existing)await verify()
   result=await resolveCarrierPremiumJournal({id:a.id,payload:a.preview.payload},(path,options)=>{if(options?.body)createAttempted=true;return quickbooksRequest(db,qbo,path,{...options,fetcher})},{allowCreate:!existing})
   }catch(e){if(existing||createAttempted||!e.status)throw e;result={status:'NOT_SENT',reason:'Posting preflight changed before any create request.'}}
   if(!existing&&!createAttempted&&!['SYNCED','NEEDS_REVIEW'].includes(result.status))await db.query('INSERT INTO payroll_carrier_premium_no_send(authorization_id) VALUES($1)',[a.id])
   await updateCarrierPremiumAlert(db,facility,a.id,result)
   await db.query('INSERT INTO payroll_carrier_premium_observation(authorization_id,result) VALUES($1,$2)',[a.id,result])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_PREMIUM_POSTING_OBSERVED','carrier_premium_authorization',$3,$4)",[facility,req.adminId,a.id,result]);await db.query('COMMIT');res.json({success:true,data:result})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Premium journal outcome needs recovery. Use the retained authorization.'})}finally{db.release()}
 })
}
