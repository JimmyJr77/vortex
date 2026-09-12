import {createHash} from 'node:crypto'
import {carrierApplicationState} from './carrierApplication.js'

export async function runCarrierReconciliationSweep(pool,{facility=null,now=new Date()}={}){
 const lock=await pool.connect();let locked=false
 try{
  locked=(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('carrier-reconciliation-sweep',0)) AS locked")).rows[0].locked
  if(!locked)return {attempted:0,changed:0,failed:0,skipped:true}
  const candidates=(await pool.query(`SELECT r.authorization_id AS id,r.facility_id FROM payroll_carrier_payment_receipt r
   LEFT JOIN LATERAL(SELECT max(attempted_at) AS checked_at FROM payroll_carrier_reconciliation_attempt WHERE payment_authorization_id=r.authorization_id)x ON true
   WHERE ($1::bigint IS NULL OR r.facility_id=$1) AND (x.checked_at IS NULL OR x.checked_at<=$2::timestamptz-interval '5 minutes')
   ORDER BY COALESCE(x.checked_at,r.created_at),r.authorization_id LIMIT 10`,[facility,new Date(now).toISOString()])).rows
  let attempted=0,changed=0,failed=0
  for(const row of candidates){
   const db=await pool.connect()
   try{
    await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[row.facility_id])
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${row.facility_id}`])
    const latestCheck=(await db.query('SELECT max(attempted_at) AS checked_at FROM payroll_carrier_reconciliation_attempt WHERE payment_authorization_id=$1',[row.id])).rows[0]
    if(latestCheck?.checked_at&&new Date(latestCheck.checked_at).getTime()>new Date(now).getTime()-300000){await db.query('COMMIT');continue}
    const state=await carrierApplicationState(db,Number(row.facility_id),row.id)
    const {bankObservedAt,...basis}=state.reconciliation
    const assessment={...basis,applicationRevision:state.revision,receiptFingerprint:state.receiptFingerprint}
    const fingerprint=createHash('sha256').update(JSON.stringify(assessment)).digest('hex')
    const previous=(await db.query('SELECT id,fingerprint FROM payroll_carrier_reconciliation_assessment WHERE payment_authorization_id=$1 ORDER BY id DESC LIMIT 1',[row.id])).rows[0]
    let assessmentId=previous?.id,assessmentChanged=false
    if(previous?.fingerprint!==fingerprint){
     assessmentId=(await db.query('INSERT INTO payroll_carrier_reconciliation_assessment(payment_authorization_id,facility_id,previous_id,fingerprint,assessment) VALUES($1,$2,$3,$4,$5) RETURNING id',[row.id,row.facility_id,previous?.id||null,fingerprint,{...assessment,bankObservedAt}])).rows[0].id;assessmentChanged=true
     await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'CARRIER_RECONCILIATION_ASSESSED','carrier_payment',$2,$3)",[row.facility_id,row.id,{assessmentId:Number(assessmentId),status:assessment.status}])
    }
    await db.query('INSERT INTO payroll_carrier_reconciliation_check(assessment_id,checked_at) VALUES($1,$2)',[assessmentId,new Date(now).toISOString()])
    const key=`carrier-reconciliation-${row.id}`
    if(assessment.status==='OPEN')await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Carrier payment reconciliation needs attention',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[row.facility_id,key,`${state.carrier} · Invoice ${state.invoiceNumber}: `+assessment.checks.filter(c=>!c.complete).map(c=>c.message).join(' ')+' Open the carrier invoice payment history in Reports & QuickBooks.'])
    else await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[row.facility_id,key])
    await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[row.facility_id,`carrier-reconciliation-check-${row.id}`])
    await db.query('COMMIT');attempted++;if(assessmentChanged)changed++
   }catch{
    await db.query('ROLLBACK').catch(()=>{})
    // Failure is separate from business evidence: never overwrite a prior
    // assessment or expose raw database/provider errors in an admin alert.
    const message='Automatic reconciliation could not read or retain the required evidence. The next scheduled check will retry; review carrier payment history if this persists.'
    try{
     await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[row.facility_id])
     const payment=(await db.query('SELECT a.preview FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE a.id=$1 AND i.facility_id=$2',[row.id,row.facility_id])).rows[0]
     if(!payment)throw new Error('Carrier reconciliation failure cannot be scoped.')
     await db.query('INSERT INTO payroll_carrier_reconciliation_failure(payment_authorization_id,facility_id,message,attempted_at) VALUES($1,$2,$3,$4)',[row.id,row.facility_id,message,new Date(now).toISOString()])
     await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Automatic carrier reconciliation needs recovery',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[row.facility_id,`carrier-reconciliation-check-${row.id}`,`${payment.preview.carrier} · Invoice ${payment.preview.invoiceNumber}: ${message}`])
     await db.query('COMMIT');failed++;attempted++
    }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}
   }finally{db.release()}
  }
  return {attempted,changed,failed}
 }finally{let destroy=false;if(locked)try{await lock.query("SELECT pg_advisory_unlock(hashtextextended('carrier-reconciliation-sweep',0))")}catch{destroy=true}lock.release(destroy)}
}
export function startCarrierReconciliationScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_CARRIER_RECONCILIATION_ENABLED==='false')return null
 let running=false;const timer=setInterval(()=>{if(running)return;running=true;void runCarrierReconciliationSweep(pool).catch(()=>console.error('[payroll] Carrier reconciliation assessment requires review.')).finally(()=>{running=false})},60000);timer.unref?.();return timer
}
