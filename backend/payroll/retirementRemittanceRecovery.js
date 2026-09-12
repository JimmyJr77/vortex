import {dispatchRetirementRemittance} from './retirementRemittanceDispatch.js'
export async function recoverRetirementRemittances(pool,facility=null,{fetcher=fetch,now=new Date()}={}){
 const timestamp=new Date(now).toISOString()
 const candidates=(await pool.query(`SELECT a.id,a.facility_id FROM payroll_retirement_remittance_authorization a JOIN payroll_retirement_remittance_claim c ON c.authorization_id=a.id LEFT JOIN LATERAL(SELECT result,created_at FROM payroll_retirement_remittance_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1)o ON true
 WHERE ($1::bigint IS NULL OR a.facility_id=$1) AND NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation x WHERE x.authorization_id=a.id)
 AND COALESCE(o.created_at,c.created_at)<=$2::timestamptz-CASE WHEN o.result->>'settlementStatus'='BANK_POSTED' THEN interval '24 hours' ELSE interval '5 minutes' END ORDER BY COALESCE(o.created_at,c.created_at),a.id LIMIT 10`,[facility,timestamp])).rows
 let checked=0,bankPosted=0,failed=0
 for(const c of candidates)try{const r=await dispatchRetirementRemittance(pool,Number(c.facility_id),c.id,{fetcher,recoveryOnly:true,recoveryDueAt:timestamp,now:()=>new Date(timestamp)});if(r.skipped)continue;checked++;if(r.result.settlementStatus==='BANK_POSTED')bankPosted++}catch{failed++}
 return {checked,bankPosted,failed}
}
export function startRetirementRemittanceRecoveryScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_RETIREMENT_REMITTANCE_RECOVERY_ENABLED==='false')return null
 let running=false
 const timer=setInterval(async()=>{if(running)return;running=true;try{const r=await recoverRetirementRemittances(pool);if(r.failed)console.error('[payroll] Retirement bank recovery requires review.')}catch{console.error('[payroll] Retirement bank recovery could not complete.')}finally{running=false}},300000);timer.unref?.();return timer
}
