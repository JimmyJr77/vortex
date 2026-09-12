import {prepareRetirementSettlementRelease} from './retirementSettlementReleasePreview.js'
import {reconcileRetirementObservation} from './retirementContributionReconciliation.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export function registerRetirementSettlementRelease(app,pool,options){
 app.post('/api/admin/payroll/retirement-settlement-authorizations/:id/release-unsent',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},id=req.params.id,facility=req.canonicalAccess.facilityId
   if(b.confirmed!==true||b.outsideActivityReviewed!==true||typeof b.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.fingerprint)||typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm the exact unsent release review and absence of outside accounting activity, and retain its reason.',400)
   await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
   const a=(await db.query('SELECT a.payment_authorization_id FROM payroll_retirement_settlement_authorization a JOIN payroll_retirement_remittance_authorization p ON p.id=a.payment_authorization_id WHERE a.id=$1 AND p.facility_id=$2',[id,facility])).rows[0]
   if(!a)throw fail('Retirement settlement authorization was not found.',404)
   const old=(await db.query('SELECT fingerprint,reference FROM payroll_retirement_settlement_release WHERE authorization_id=$1',[id])).rows[0]
   if(old){if(old.fingerprint!==b.fingerprint||old.reference!==b.reference.trim())throw fail('A different release review is already retained.');await db.query('COMMIT');return res.json({success:true,data:{id,reused:true}})}
   const preview=await prepareRetirementSettlementRelease(db,facility,id,options)
   if(preview.fingerprint!==b.fingerprint)throw fail('Settlement evidence changed. Refresh the release review.')
   const evidence=[]
   for(const j of preview.journals){
    const o=(await db.query("INSERT INTO payroll_retirement_settlement_observation(journal_id,result,source,create_attempted) VALUES($1,$2,'RECOVERY',false) RETURNING id",[j.journalId,{status:'NOT_FOUND'}])).rows[0]
    evidence.push({journalId:j.journalId,observationId:String(o.id)})
   }
   await db.query('INSERT INTO payroll_retirement_settlement_release(authorization_id,fingerprint,evidence,reference,created_by) VALUES($1,$2,$3,$4,$5)',[id,b.fingerprint,JSON.stringify(evidence),b.reference.trim(),req.adminId])
   await db.query('INSERT INTO payroll_retirement_settlement_cancellation(authorization_id,reference,created_by) VALUES($1,$2,$3)',[id,b.reference.trim(),req.adminId])
   await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`retirement-settlement-${id}`])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_SETTLEMENT_UNSENT_RELEASED','retirement_settlement_authorization',$3,$4)",[facility,req.adminId,id,{fingerprint:b.fingerprint,evidence,reference:b.reference.trim(),outsideActivityReviewed:true}])
   await reconcileRetirementObservation(db,facility,a.payment_authorization_id,{actorId:req.adminId})
   await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to release the retirement settlement. Review its retained evidence.'})}finally{db.release()}
 })
}
