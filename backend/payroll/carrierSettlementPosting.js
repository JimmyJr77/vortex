import {randomUUID} from 'node:crypto'
import {prepareCarrierSettlement} from './carrierSettlementPreview.js'
import {resolveCarrierSettlementJournal} from './carrierSettlementJournal.js'
import {quickbooksRequest} from './quickbooks.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function postCarrierSettlement(pool,facility,id,{fetcher=fetch,paymentFetcher=fetch,actorId=null,recoveryOnly=false}={}){
 const db=await pool.connect()
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const a=(await db.query('SELECT a.* FROM payroll_carrier_settlement_authorization a JOIN payroll_carrier_payment_authorization p ON p.id=a.payment_authorization_id JOIN payroll_benefit_carrier_invoice i ON i.id=p.invoice_id WHERE a.id=$1 AND i.facility_id=$2',[id,facility])).rows[0]
  if(!a)throw fail('Carrier settlement authorization was not found.',404)
  if((await db.query('SELECT authorization_id FROM payroll_carrier_settlement_cancellation WHERE authorization_id=$1',[id])).rows.length)throw fail('This carrier settlement authorization was cancelled.')
  const existing=(await db.query('SELECT authorization_id FROM payroll_carrier_settlement_claim WHERE authorization_id=$1',[id])).rows.length>0
  const verify=async()=>{const current=await prepareCarrierSettlement(db,facility,a.payment_authorization_id,{fetcher,paymentFetcher});if(current.fingerprint!==a.fingerprint)throw fail('Authorized bank, premium, mapping or period evidence changed. Review the settlement authorization.')}
  if(!existing){
   if(recoveryOnly)throw fail('No settlement posting has started. Recovery cannot create journals.')
   await verify();await db.query('INSERT INTO payroll_carrier_settlement_claim(authorization_id,created_by) VALUES($1,$2)',[id,actorId])
   for(const item of a.preview.journals)await db.query('INSERT INTO payroll_carrier_settlement_journal(id,authorization_id,facility_id,realm_id,environment,event_key,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,facility,a.preview.realmId,a.preview.environment,item.event.key,item.payload])
  }
  await db.query('COMMIT')
  // The first caller alone holds create capability. Claims and all event jobs
  // are already committed; any concurrent request or restart is lookup-only.
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const jobs=(await db.query('SELECT * FROM payroll_carrier_settlement_journal WHERE authorization_id=$1 ORDER BY event_key',[id])).rows
  if(jobs.length!==a.preview.journals.length)throw fail('Settlement claims need reconciliation before posting or recovery.')
  let preflightFailure=null
  if(!existing)try{await verify()}catch{preflightFailure={status:'NOT_SENT',reason:'Settlement facts changed before any journal create request.'}}
  const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0],connectionMatches=qbo&&qbo.realm_id===a.preview.realmId&&qbo.environment===a.preview.environment
  const results=[]
  for(const job of jobs){
   let createAttempted=false
   const result=preflightFailure||(!connectionMatches?{status:'CONNECTION_CHANGED'}:await resolveCarrierSettlementJournal(job,(path,options)=>{if(options?.body)createAttempted=true;return quickbooksRequest(db,qbo,path,{...options,fetcher})},{allowCreate:!existing}))
   await db.query('INSERT INTO payroll_carrier_settlement_observation(journal_id,result,source,create_attempted) VALUES($1,$2,$3,$4)',[job.id,result,existing?'RECOVERY':'SUBMISSION',createAttempted])
   results.push({jobId:job.id,eventKey:job.event_key,...result})
  }
  const status=results.every(r=>r.status==='SYNCED')?'SYNCED':'NEEDS_REVIEW',key=`carrier-settlement-${id}`
  if(status==='SYNCED')await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key])
  else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Carrier settlement accounting needs attention','Open the carrier payment bank accounting review to recover its retained journals. Recovery never sends another journal.') ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,key])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_SETTLEMENT_POSTING_OBSERVED','carrier_settlement_authorization',$3,$4)",[facility,actorId,id,{status,recovery:existing,results}])
  await db.query('COMMIT');return {status,recovery:existing,results}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
export function registerCarrierSettlementPostingRoutes(app,pool,options){
 app.post('/api/admin/payroll/carrier-settlement-authorizations/:id/post',async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{if(req.body?.confirmed!==true||!['POST','RECOVER'].includes(req.body.action)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.id))throw fail('Confirm posting or recovery of the retained settlement.',400)
   res.json({success:true,data:await postCarrierSettlement(pool,req.canonicalAccess.facilityId,req.params.id,{...options,actorId:req.adminId,recoveryOnly:req.body.action==='RECOVER'})})
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Settlement outcome needs recovery. Review the retained authorization.'})}
 })
}
