import {refreshRetirementTimingAlerts} from './retirementTimingAlerts.js'
import {verifyRetirementDestination,retirementDestinationStatus} from './retirementDestination.js'
// Bounded read-only provider checks. Each destination is rechecked under the
// same employer locks as configuration and suspension, including a fresh due test.
export async function checkRetirementDestinations(pool,facility=null,{fetcher=fetch,now=new Date()}={}){
 const timestamp=new Date(now).toISOString()
 const due=`NOT EXISTS(SELECT 1 FROM payroll_retirement_destination_suspension s WHERE s.destination_id=d.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_destination n WHERE n.facility_id=d.facility_id AND n.plan_id=d.plan_id AND n.revision>d.revision)
 AND COALESCE(c.created_at,d.created_at)<=$2::timestamptz-CASE WHEN c.status='VERIFIED' AND d.plan_revision_id=(SELECT p.id FROM payroll_retirement_plan_revision p WHERE p.facility_id=d.facility_id AND p.plan_id=d.plan_id AND p.tax_year=2026 ORDER BY p.revision DESC LIMIT 1) AND d.connection_id=(SELECT f.id FROM payroll_payment_connection f WHERE f.facility_id=d.facility_id ORDER BY f.id DESC LIMIT 1) THEN interval '24 hours' ELSE interval '5 minutes' END`
 const query=`SELECT d.id,d.facility_id,d.plan_id FROM payroll_retirement_destination d LEFT JOIN LATERAL(SELECT status,created_at FROM payroll_retirement_destination_check WHERE destination_id=d.id ORDER BY id DESC LIMIT 1)c ON true WHERE ($1::bigint IS NULL OR d.facility_id=$1) AND ${due}`
 const candidates=(await pool.query(`${query} ORDER BY COALESCE(c.created_at,d.created_at),d.id LIMIT 10`,[facility,timestamp])).rows
 let checked=0,verified=0,needsReview=0,failed=0
 for(const candidate of candidates){const db=await pool.connect();try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${candidate.facility_id}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[candidate.facility_id])
  if(!(await db.query(`${query} AND d.id=$3`,[candidate.facility_id,timestamp,candidate.id])).rows.length){await db.query('COMMIT');continue}
  const state=await retirementDestinationStatus(db,candidate.facility_id,candidate.plan_id)
  if(state.destinationId!==candidate.id||state.status==='SUSPENDED'){await db.query('COMMIT');continue}
  const check=await verifyRetirementDestination(db,candidate.facility_id,candidate.plan_id,candidate.id,{fetcher,automatic:true,now:timestamp})
  await db.query('COMMIT');checked++;if(check.status==='VERIFIED')verified++;else needsReview++
 }catch{await db.query('ROLLBACK').catch(()=>{});failed++}finally{db.release()}}
 return {checked,verified,needsReview,failed}
}
export function startRetirementDestinationScheduler(pool){
 if(process.env.NODE_ENV==='test'||process.env.PAYROLL_RETIREMENT_DESTINATION_CHECKS_ENABLED==='false')return null
 let running=false
 const sweep=async()=>{if(running)return;running=true;try{await checkRetirementDestinations(pool);await refreshRetirementTimingAlerts(pool)}catch{console.error('[payroll] Retirement destination checks could not complete.')}finally{running=false}}
 const initial=setTimeout(()=>void sweep(),60000);initial.unref?.();const timer=setInterval(()=>void sweep(),5*60000);timer.unref?.();return timer
}
