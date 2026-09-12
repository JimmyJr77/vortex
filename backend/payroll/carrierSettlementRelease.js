import {quickbooksRequest} from './quickbooks.js'
import {resolveCarrierSettlementJournal} from './carrierSettlementJournal.js'
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})}
export async function carrierSettlementCanRelease(db,id){
 const rows=(await db.query(`SELECT j.id,EXISTS(SELECT 1 FROM payroll_carrier_settlement_observation o WHERE o.journal_id=j.id AND o.source='SUBMISSION' AND NOT o.create_attempted) AS completed_without_send,EXISTS(SELECT 1 FROM payroll_carrier_settlement_observation o WHERE o.journal_id=j.id AND (o.create_attempted OR o.result->>'status' IN ('SYNCED','NEEDS_REVIEW'))) AS unsafe FROM payroll_carrier_settlement_journal j WHERE authorization_id=$1`,[id])).rows
 const expected=(await db.query("SELECT jsonb_array_length(preview->'journals') AS count FROM payroll_carrier_settlement_authorization WHERE id=$1",[id])).rows[0]?.count
 return rows.length>0&&rows.length===expected&&rows.every(r=>r.completed_without_send&&!r.unsafe)
}
export function registerCarrierSettlementReleaseRoutes(app,pool,{fetcher=fetch}={}){
 app.post('/api/admin/payroll/carrier-settlement-authorizations/:id/release-unsent',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},id=req.params.id,facility=req.canonicalAccess.facilityId
   if(b.confirmed!==true||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))fail('Confirm cancellation of the proven-unsent settlement and retain its reason.',400)
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const a=(await db.query('SELECT a.* FROM payroll_carrier_settlement_authorization a JOIN payroll_carrier_payment_authorization p ON p.id=a.payment_authorization_id JOIN payroll_benefit_carrier_invoice i ON i.id=p.invoice_id WHERE a.id=$1 AND i.facility_id=$2',[id,facility])).rows[0]
   if(!a)fail('Carrier settlement authorization was not found.',404)
   const old=(await db.query('SELECT reference FROM payroll_carrier_settlement_release WHERE authorization_id=$1',[id])).rows[0]
   if(old){if(old.reference!==b.reference.trim())fail('A different unsent release is already retained.');await db.query('COMMIT');return res.json({success:true,data:{id,reused:true}})}
   if(!await carrierSettlementCanRelease(db,id))fail('Every journal needs retained proof that its submission ended without a create attempt. Uncertain or partially posted settlements cannot be released.')
   const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   if(!qbo||qbo.realm_id!==a.preview.realmId||qbo.environment!==a.preview.environment)fail('Reconnect the original accounting company to verify journal absence.')
   const jobs=(await db.query('SELECT * FROM payroll_carrier_settlement_journal WHERE authorization_id=$1 ORDER BY event_key',[id])).rows,evidence=[]
   for(const job of jobs){
    const result=await resolveCarrierSettlementJournal(job,(path,options)=>quickbooksRequest(db,qbo,path,{...options,fetcher}))
    if(result.status!=='NOT_FOUND')fail('QuickBooks did not confirm every settlement journal is absent. Recover or reconcile the existing accounting evidence.')
    const o=(await db.query("INSERT INTO payroll_carrier_settlement_observation(journal_id,result,source,create_attempted) VALUES($1,$2,'RECOVERY',false) RETURNING id",[job.id,result])).rows[0]
    evidence.push({journalId:job.id,observationId:Number(o.id)})
   }
   await db.query('INSERT INTO payroll_carrier_settlement_release(authorization_id,evidence,reference,created_by) VALUES($1,$2,$3,$4)',[id,JSON.stringify(evidence),b.reference.trim(),req.adminId])
   await db.query('INSERT INTO payroll_carrier_settlement_cancellation(authorization_id,reference,created_by) VALUES($1,$2,$3)',[id,b.reference.trim(),req.adminId])
   await db.query('DELETE FROM payroll_carrier_settlement_event_reservation s USING payroll_carrier_settlement_journal j WHERE s.journal_id=j.id AND j.authorization_id=$1',[id])
   await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`carrier-settlement-${id}`])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_SETTLEMENT_UNSENT_RELEASED','carrier_settlement_authorization',$3,$4)",[facility,req.adminId,id,{evidence,reference:b.reference.trim()}])
   await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to prove the settlement was unsent and absent.'})}finally{db.release()}
 })
}
