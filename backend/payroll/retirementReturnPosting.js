import {retirementReturnAccountingDependency} from './retirementReturnAccountingEvidence.js'
import {randomUUID} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {prepareRetirementReturn} from './retirementReturnPreview.js'
import {resolveRetirementSettlementJournal} from './retirementSettlementJournal.js'
import {quickbooksRequest} from './quickbooks.js'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
import {reconcileRetirementObservation} from './retirementContributionReconciliation.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const comparable=p=>{const {fingerprint,status,period,...basis}=p;return basis}
export async function postRetirementReturn(pool,facility,id,{fetcher=fetch,paymentFetcher=fetch,actorId=null,recoveryOnly=false}={}){
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
  const a=(await db.query('SELECT * FROM payroll_retirement_return_authorization WHERE id=$1 AND facility_id=$2',[id,facility])).rows[0]
  if(!a)throw fail('Return approval not found.',404)
  if((await db.query('SELECT authorization_id FROM payroll_retirement_return_cancellation WHERE authorization_id=$1',[id])).rowCount)throw fail('Return approval is cancelled.')
  const existing=(await db.query('SELECT authorization_id FROM payroll_retirement_return_claim WHERE authorization_id=$1',[id])).rowCount>0
  const verify=async(postedReview=false)=>{const current=await prepareRetirementReturn(db,facility,a.payment_authorization_id,{fetcher,paymentFetcher,postedReview});if(postedReview?!isDeepStrictEqual(comparable(current),comparable(a.preview)):current.fingerprint!==a.fingerprint)throw fail('Return, bank or accounting evidence changed. Review the retained approval.');return current}
  if(!existing){
   if(recoveryOnly)throw fail('Return recovery cannot create an unclaimed journal.')
   await verify();await db.query('INSERT INTO payroll_retirement_return_claim(authorization_id,created_by) VALUES($1,$2)',[id,actorId])
   await db.query('INSERT INTO payroll_retirement_return_journal(id,authorization_id,facility_id,realm_id,environment,event_key,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,facility,a.preview.realmId,a.preview.environment,a.preview.event.key,a.preview.payload])
  }
  await db.query('COMMIT')
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
  const job=(await db.query('SELECT * FROM payroll_retirement_return_journal WHERE authorization_id=$1 AND facility_id=$2',[id,facility])).rows[0]
  if(!job)throw fail('Return journal claim requires reconciliation.')
  let accountingVerified=false
  try{await verify(existing);accountingVerified=true}catch{}
  const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])).rows[0]
  let createAttempted=false
  const result=!existing&&!accountingVerified?{status:'NOT_SENT'}:!qbo||qbo.realm_id!==job.realm_id||qbo.environment!==job.environment?{status:'CONNECTION_CHANGED'}:await resolveRetirementSettlementJournal(job,(path,options)=>{if(options?.body)createAttempted=true;return quickbooksRequest(db,qbo,path,{...options,fetcher})},{allowCreate:!existing})
  result.accountingVerified=accountingVerified
  result.accountingEvidence=accountingVerified?await retirementReturnAccountingDependency(db,facility,a):null
  await db.query('INSERT INTO payroll_retirement_return_observation(journal_id,source,result,create_attempted) VALUES($1,$2,$3,$4)',[job.id,existing?'RECOVERY':'SUBMISSION',result,createAttempted])
  const status=result.status==='SYNCED'&&accountingVerified?'SYNCED':'NEEDS_REVIEW',key=`retirement-return-${id}`
  if(status==='SYNCED')await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key])
  else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Retirement return accounting needs review','Recover the authorized return journal and review current bank and original accounting evidence.') ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,key])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_RETURN_POSTING_OBSERVED','retirement_return_authorization',$3,$4)",[facility,actorId,id,{status,result,recovery:existing}])
  await reconcileRetirementObservation(db,facility,a.payment_authorization_id,{actorId})
  await db.query('COMMIT');return {status,result,recovery:existing}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerRetirementReturnPosting(app,pool,options){
 app.post('/api/admin/payroll/retirement-return-authorizations/:id/post',async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{if(!uuid(req.params.id)||req.body?.confirmed!==true||!['POST','RECOVER'].includes(req.body.action))throw fail('Confirm posting or recovery of the retained return journal.',400);res.json({success:true,data:await postRetirementReturn(pool,req.canonicalAccess.facilityId,req.params.id,{...options,actorId:req.adminId,recoveryOnly:req.body.action==='RECOVER'})})}
  catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Return accounting outcome needs recovery.'})}
 })
}
