import {quickbooksRequest} from './quickbooks.js'
import {resolveCarrierReversalJournal} from './carrierReversalDispatch.js'
const due=`COALESCE(o.created_at,c.created_at)<= $2::timestamptz-CASE WHEN o.result->>'status'='SYNCED' THEN interval '24 hours' ELSE interval '5 minutes' END`
export async function updateCarrierReversalAlert(db,facility,id,result){
 const key=`carrier-reversal-${id}`
 if(result.status==='SYNCED')await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key])
 else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Carrier reversal journal needs attention','Open Carrier invoices in Reports & QuickBooks to recover the retained journal or review its company connection. No new journal is sent by recovery.') ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,key])
}
export async function recoverCarrierReversals(pool,facility=null,{fetcher=fetch,now=new Date()}={}){
 const timestamp=new Date(now).toISOString()
 const candidates=(await pool.query(`SELECT a.id,i.facility_id FROM payroll_carrier_reversal_authorization a JOIN payroll_carrier_reversal_claim c ON c.authorization_id=a.id JOIN payroll_carrier_premium_authorization p ON p.id=a.premium_authorization_id JOIN payroll_benefit_carrier_invoice i ON i.id=p.invoice_id LEFT JOIN LATERAL(SELECT result,created_at FROM payroll_carrier_reversal_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1)o ON true WHERE ($1::bigint IS NULL OR i.facility_id=$1) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_reversal_cancellation x WHERE x.authorization_id=a.id) AND ${due} ORDER BY COALESCE(o.created_at,c.created_at),a.id LIMIT 10`,[facility,timestamp])).rows
 let checked=0,synced=0
 for(const candidate of candidates){
  const db=await pool.connect()
  try{
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[candidate.facility_id])
   const a=(await db.query(`SELECT a.* FROM payroll_carrier_reversal_authorization a JOIN payroll_carrier_reversal_claim c ON c.authorization_id=a.id LEFT JOIN LATERAL(SELECT result,created_at FROM payroll_carrier_reversal_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1)o ON true WHERE a.id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_reversal_cancellation x WHERE x.authorization_id=a.id) AND ${due}`,[candidate.id,timestamp])).rows[0]
   if(!a){await db.query('COMMIT');continue}
   const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[candidate.facility_id])).rows[0]
   const result=!qbo||qbo.realm_id!==a.preview.realmId||qbo.environment!==a.preview.environment?{status:'CONNECTION_CHANGED'}:await resolveCarrierReversalJournal({id:a.id,payload:a.preview.payload},(path,options)=>quickbooksRequest(db,qbo,path,{...options,fetcher}))
   await db.query('INSERT INTO payroll_carrier_reversal_observation(authorization_id,result,created_at) VALUES($1,$2,$3)',[a.id,result,timestamp])
   await updateCarrierReversalAlert(db,candidate.facility_id,a.id,result)
   if(result.status==='SYNCED')synced++
   await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'CARRIER_REVERSAL_AUTOMATIC_RECOVERY','carrier_reversal_authorization',$2,$3)",[candidate.facility_id,a.id,result]);await db.query('COMMIT');checked++
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
 }
 return {checked,synced}
}
export function startCarrierReversalRecoveryScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_CARRIER_REVERSAL_RECOVERY_ENABLED==='false')return null
 let running=false
 const sweep=async()=>{if(running)return;running=true;try{await recoverCarrierReversals(pool)}catch{console.error('[payroll] Carrier reversal recovery requires review.')}finally{running=false}}
 const timer=setInterval(()=>void sweep(),5*60*1000);timer.unref?.();return timer
}
