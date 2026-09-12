import {createHash} from 'node:crypto'
import {retirementSettlementUnsentProof} from './retirementSettlementUnsentProof.js'
import {resolveRetirementSettlementJournal} from './retirementSettlementJournal.js'
import {quickbooksRequest} from './quickbooks.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function prepareRetirementReplacementSettlementRelease(db,facility,id,{fetcher=fetch}={}){
 if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw fail('Choose a retained settlement authorization.',400)
 const a=(await db.query('SELECT a.* FROM payroll_retirement_replacement_settlement_authorization a WHERE a.id=$1 AND a.facility_id=$2',[id,facility])).rows[0]
 if(!a)throw fail('Retirement settlement authorization was not found.',404)
 if((await db.query('SELECT authorization_id FROM payroll_retirement_replacement_settlement_cancellation WHERE authorization_id=$1',[id])).rowCount)throw fail('This settlement authorization is already cancelled.')
 const jobs=(await db.query('SELECT * FROM payroll_retirement_replacement_settlement_journal WHERE authorization_id=$1 ORDER BY event_key',[id])).rows
 for(const job of jobs)job.observations=(await db.query('SELECT id,source,create_attempted,result FROM payroll_retirement_replacement_settlement_observation WHERE journal_id=$1 ORDER BY id',[job.id])).rows
 const proof=retirementSettlementUnsentProof(a,jobs)
 if(!proof.eligible)throw fail(proof.reason)
 const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])).rows[0]
 if(!qbo||qbo.realm_id!==a.preview.realmId||qbo.environment!==a.preview.environment)throw fail('Reconnect the original accounting company to verify every journal is absent.')
 const journals=[]
 for(const job of jobs){
  const result=await resolveRetirementSettlementJournal(job,(path,options)=>quickbooksRequest(db,qbo,path,{...options,fetcher}))
  if(result.status!=='NOT_FOUND')throw fail('The original company did not confirm every journal is absent. Recover or reconcile its accounting before release.')
  journals.push({journalId:job.id,documentNumber:job.payload.DocNumber,status:'NOT_FOUND'})
 }
 const basis={authorizationId:id,replacementAuthorizationId:a.replacement_id,originalAuthorizationId:a.preview.originalAuthorizationId,realmId:a.preview.realmId,environment:a.preview.environment,authorizationFingerprint:a.fingerprint,proof:proof.evidence,observations:jobs.map(j=>({journalId:j.id,ids:j.observations.map(o=>o.id)})),journals}
 return {...basis,status:'RELEASE_PREVIEW_ONLY',fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex')}
}
export function registerRetirementReplacementSettlementReleasePreview(app,pool,options){
 app.post('/api/admin/payroll/retirement-replacement-settlement-authorizations/:id/release-preview',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const facility=req.canonicalAccess.facilityId
   await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
   const data=await prepareRetirementReplacementSettlementRelease(db,facility,req.params.id,options)
   await db.query('COMMIT');res.json({success:true,data})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to verify settlement non-send and absence.'})}finally{db.release()}
 })
}
