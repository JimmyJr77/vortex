import {dispatchRetirementAllocation} from './retirementAllocationDelivery.js'
export async function recoverRetirementAllocations(pool,facility=null,{transfer,now=new Date()}={}){
 const timestamp=new Date(now).toISOString()
 const candidates=(await pool.query(`SELECT a.id,a.facility_id,a.remittance_id FROM payroll_retirement_allocation_authorization a JOIN payroll_retirement_allocation_claim c ON c.authorization_id=a.id
 LEFT JOIN LATERAL(SELECT result,created_at FROM payroll_retirement_allocation_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1)o ON true
 WHERE ($1::bigint IS NULL OR a.facility_id=$1)
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation x WHERE x.authorization_id=a.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation x WHERE x.authorization_id=a.remittance_id)
 AND COALESCE(o.created_at,c.created_at)<=$2::timestamptz-CASE WHEN o.result->>'status'='REMOTE_FILE_VERIFIED' THEN interval '24 hours' ELSE interval '5 minutes' END
 ORDER BY COALESCE(o.created_at,c.created_at),a.id LIMIT 10`,[facility,timestamp])).rows
 let checked=0,remoteVerified=0,failed=0
 for(const c of candidates)try{
  const result=await dispatchRetirementAllocation(pool,Number(c.facility_id),c.remittance_id,c.id,{transfer,recoveryOnly:true,recoveryDueAt:timestamp,now:()=>new Date(timestamp)})
  if(result.skipped)continue;checked++;if(result.result.status==='REMOTE_FILE_VERIFIED')remoteVerified++
 }catch{failed++}
 return {checked,remoteVerified,failed}
}
export function startRetirementAllocationRecoveryScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_RETIREMENT_ALLOCATION_RECOVERY_ENABLED==='false')return null
 let running=false
 const timer=setInterval(async()=>{if(running)return;running=true;try{const result=await recoverRetirementAllocations(pool);if(result.failed)console.error('[payroll] Allocation recovery requires review.')}catch{console.error('[payroll] Allocation recovery could not complete.')}finally{running=false}},300000)
 timer.unref?.();return timer
}
