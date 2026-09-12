import {dispatchCarrierPayment} from './carrierPaymentDispatch.js'
export async function recoverCarrierPayments(pool,facility=null,{fetcher=fetch,now=new Date()}={}){
 const timestamp=new Date(now).toISOString()
 const candidates=(await pool.query(`SELECT a.id,i.facility_id FROM payroll_carrier_payment_authorization a JOIN payroll_carrier_payment_claim c ON c.authorization_id=a.id JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id LEFT JOIN LATERAL(SELECT result,created_at FROM payroll_carrier_payment_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1)o ON true WHERE ($1::bigint IS NULL OR i.facility_id=$1) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation x WHERE x.authorization_id=a.id) AND COALESCE(o.created_at,c.created_at)<=$2::timestamptz-CASE WHEN o.result->>'settlementStatus'='BANK_POSTED' THEN interval '24 hours' ELSE interval '5 minutes' END ORDER BY COALESCE(o.created_at,c.created_at),a.id LIMIT 10`,[facility,timestamp])).rows
 let checked=0,settled=0,needsReview=0
 for(const candidate of candidates){
  const outcome=await dispatchCarrierPayment(pool,Number(candidate.facility_id),candidate.id,{fetcher,recoveryOnly:true,recoveryDueAt:timestamp,now:()=>new Date(timestamp)})
  if(outcome.skipped)continue
  checked++;if(outcome.result.settlementStatus==='BANK_POSTED')settled++;if(outcome.needsReview)needsReview++
 }
 return {checked,settled,needsReview}
}
export function startCarrierPaymentRecoveryScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_CARRIER_PAYMENT_RECOVERY_ENABLED==='false')return null
 let running=false
 const sweep=async()=>{if(running)return;running=true;try{await recoverCarrierPayments(pool)}catch{console.error('[payroll] Carrier payment recovery requires review.')}finally{running=false}}
 const timer=setInterval(()=>void sweep(),5*60*1000);timer.unref?.();return timer
}
