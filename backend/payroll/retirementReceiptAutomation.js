import {randomUUID} from 'node:crypto'
import {checkRetirementReceipt} from './retirementReceiptIntake.js'
export async function checkRetirementReceipts(pool,facility=null,{reader,now=new Date(),receiptNow=()=>new Date()}={}){
 const timestamp=new Date(now).toISOString()
 const candidates=(await pool.query(`SELECT b.id,b.facility_id,b.allocation_id,a.remittance_id FROM payroll_retirement_receipt_binding b
 JOIN payroll_retirement_allocation_authorization a ON a.id=b.allocation_id
 JOIN payroll_retirement_remittance_authorization parent ON parent.id=a.remittance_id
 LEFT JOIN LATERAL(SELECT summary,created_at FROM payroll_retirement_receipt_observation WHERE allocation_id=a.id ORDER BY sequence DESC LIMIT 1)o ON true
 WHERE ($1::bigint IS NULL OR b.facility_id=$1) AND b.disposition='REVIEWED'
 AND (SELECT disposition FROM payroll_retirement_receipt_contract WHERE facility_id=b.facility_id AND plan_id=parent.plan_id ORDER BY revision DESC LIMIT 1)='REVIEWED'
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_receipt_binding newer WHERE newer.allocation_id=b.allocation_id AND newer.revision>b.revision)
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation x WHERE x.authorization_id=a.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation x WHERE x.authorization_id=a.remittance_id)
 AND (o.created_at IS NULL OR o.created_at<=$2::timestamptz-CASE WHEN o.summary->>'status'='POSTED' THEN interval '24 hours' ELSE interval '5 minutes' END)
 ORDER BY COALESCE(o.created_at,b.created_at),b.id LIMIT 10`,[facility,timestamp])).rows
 let checked=0,posted=0,failed=0
 for(const c of candidates)try{
  const result=await checkRetirementReceipt(pool,Number(c.facility_id),c.remittance_id,c.allocation_id,{bindingId:c.id,requestKey:randomUUID(),reader,now:receiptNow,automaticDueAt:timestamp})
  if(result.skipped)continue;checked++;if(result.summary.status==='POSTED')posted++
 }catch{failed++}
 return {checked,posted,failed}
}
export function startRetirementReceiptScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_RETIREMENT_RECEIPT_CHECKS_ENABLED==='false')return null
 let running=false
 const timer=setInterval(async()=>{if(running)return;running=true;try{const r=await checkRetirementReceipts(pool);if(r.failed)console.error('[payroll] Receipt checks require review.')}catch{console.error('[payroll] Receipt checks could not complete.')}finally{running=false}},300000)
 timer.unref?.();return timer
}
