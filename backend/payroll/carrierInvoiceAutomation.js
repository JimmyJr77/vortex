import {createHash} from 'node:crypto'
import {carrierInvoicePaymentState} from './carrierInvoiceReconciliation.js'

export async function runCarrierInvoiceSweep(pool,{facility=null,now=new Date()}={}){
 const lock=await pool.connect();let locked=false
 try{
  locked=(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('carrier-invoice-assessment-sweep:'||current_schema(),0)) AS locked")).rows[0].locked
  if(!locked)return {attempted:0,changed:0,failed:0,skipped:true}
  const candidates=(await pool.query(`SELECT i.id,i.facility_id FROM payroll_benefit_carrier_invoice i
   LEFT JOIN LATERAL(SELECT checked_at FROM payroll_carrier_invoice_check WHERE invoice_id=i.id ORDER BY id DESC LIMIT 1)c ON true
   WHERE ($1::bigint IS NULL OR i.facility_id=$1) AND NOT EXISTS(SELECT 1 FROM payroll_benefit_carrier_invoice n WHERE n.facility_id=i.facility_id AND n.carrier_key=i.carrier_key AND n.invoice_key=i.invoice_key AND n.revision>i.revision)
   AND (c.checked_at IS NULL OR c.checked_at<=$2::timestamptz-interval '5 minutes') ORDER BY COALESCE(c.checked_at,i.created_at),i.id LIMIT 10`,[facility,new Date(now).toISOString()])).rows
  let attempted=0,changed=0,failed=0
  for(const item of candidates){
   const db=await pool.connect()
   try{
    await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[item.facility_id]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${item.facility_id}`])
    const priorCheck=(await db.query('SELECT checked_at FROM payroll_carrier_invoice_check WHERE invoice_id=$1 ORDER BY id DESC LIMIT 1',[item.id])).rows[0]
    if(priorCheck&&new Date(priorCheck.checked_at)>new Date(+new Date(now)-300000)){await db.query('COMMIT');continue}
    const row=(await db.query('SELECT * FROM payroll_benefit_carrier_invoice WHERE id=$1 AND facility_id=$2',[item.id,item.facility_id])).rows[0]
    const state=await carrierInvoicePaymentState(db,Number(item.facility_id),row)
    if(state.current.id!==row.id){await db.query('COMMIT');continue}
    const {assessmentHistory,latestCheck,failedChecks,...assessment}=state.balance
    const fingerprint=createHash('sha256').update(JSON.stringify(assessment)).digest('hex')
    const previous=(await db.query('SELECT id,fingerprint FROM payroll_carrier_invoice_assessment WHERE invoice_id=$1 ORDER BY id DESC LIMIT 1',[row.id])).rows[0]
    let assessmentId=previous?.id,didChange=false
    if(previous?.fingerprint!==fingerprint){
     assessmentId=(await db.query('INSERT INTO payroll_carrier_invoice_assessment(invoice_id,facility_id,previous_id,fingerprint,assessment) VALUES($1,$2,$3,$4,$5) RETURNING id',[row.id,item.facility_id,previous?.id||null,fingerprint,assessment])).rows[0].id;didChange=true
     await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'CARRIER_INVOICE_ASSESSED','carrier_invoice',$2,$3)",[item.facility_id,row.id,{assessmentId:Number(assessmentId),status:assessment.status}])
    }
    await db.query("INSERT INTO payroll_carrier_invoice_check(invoice_id,facility_id,assessment_id,status,checked_at) VALUES($1,$2,$3,'CHECKED',$4)",[row.id,item.facility_id,assessmentId,new Date(now).toISOString()])
    const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[item.facility_id])).rows[0].timezone
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
    const wasReconciled=(await db.query("SELECT id FROM payroll_carrier_invoice_assessment WHERE invoice_id=$1 AND assessment->>'status'='RECONCILED' LIMIT 1",[row.id])).rows.length>0
    const alertKey=`carrier-invoice-${row.id}`
    if(assessment.status==='OPEN'&&(wasReconciled||row.invoice.dueDate<=today))await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Carrier invoice payment evidence needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[item.facility_id,alertKey,`${row.invoice.carrier} · Invoice ${row.invoice.invoiceNumber}: ${wasReconciled?'Previously reconciled payment evidence changed.':'The invoice due date has arrived with payment evidence unresolved.'} Review the current invoice payment balance and outstanding steps in Reports & QuickBooks.`])
    else await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[item.facility_id,alertKey])
    await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[item.facility_id,`carrier-invoice-check-${row.id}`])
    await db.query("UPDATE payroll_alert a SET status='DISMISSED',dismissed_at=now() FROM payroll_benefit_carrier_invoice old WHERE a.facility_id=$1 AND old.facility_id=a.facility_id AND old.carrier_key=$2 AND old.invoice_key=$3 AND old.id<>$4 AND a.dedupe_key IN ('carrier-invoice-'||old.id::text,'carrier-invoice-check-'||old.id::text) AND a.status='OPEN' AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_authorization p WHERE p.invoice_id=old.id AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation c WHERE c.authorization_id=p.id))",[item.facility_id,row.carrier_key,row.invoice_key,row.id])
    await db.query('COMMIT');attempted++;if(didChange)changed++
   }catch{
    await db.query('ROLLBACK').catch(()=>{})
    try{
     await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[item.facility_id])
     const source=(await db.query('SELECT invoice FROM payroll_benefit_carrier_invoice WHERE id=$1 AND facility_id=$2',[item.id,item.facility_id])).rows[0]
     if(!source)throw new Error('Invoice failure cannot be scoped.')
     const message=`${source.invoice.carrier} · Invoice ${source.invoice.invoiceNumber}: Automatic invoice reconciliation could not read or retain its evidence. A scheduled check will retry; review the invoice history if this persists.`
     await db.query("INSERT INTO payroll_carrier_invoice_check(invoice_id,facility_id,status,message,checked_at) VALUES($1,$2,'FAILED',$3,$4)",[item.id,item.facility_id,message,new Date(now).toISOString()])
     await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Automatic carrier invoice check needs recovery',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[item.facility_id,`carrier-invoice-check-${item.id}`,message])
     await db.query('COMMIT');attempted++;failed++
    }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}
   }finally{db.release()}
  }
  return {attempted,changed,failed}
 }finally{let destroy=false;if(locked)try{await lock.query("SELECT pg_advisory_unlock(hashtextextended('carrier-invoice-assessment-sweep:'||current_schema(),0))")}catch{destroy=true}lock.release(destroy)}
}
export function startCarrierInvoiceScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_CARRIER_INVOICE_RECONCILIATION_ENABLED==='false')return null
 let running=false;const timer=setInterval(()=>{if(running)return;running=true;void runCarrierInvoiceSweep(pool).catch(()=>console.error('[payroll] Carrier invoice assessment requires recovery.')).finally(()=>{running=false})},60000);timer.unref?.();return timer
}
