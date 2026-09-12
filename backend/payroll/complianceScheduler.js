import {recordPayrollAutomation} from './automationHistory.js'
import { runWorkforceAutomation } from './workforceAutomation.js'
import { reviewPayrollComplianceSources } from './registerRoutes.js'

const DAY_MS = 24 * 60 * 60 * 1000

export async function runPayrollComplianceSweep(pool,{workforceRunner=runWorkforceAutomation,sourceReviewer=reviewPayrollComplianceSources}={}) {
  const { rows: facilities } = await pool.query('SELECT facility_id FROM payroll_settings')
  const failures=[]
  for (const { facility_id: facilityId } of facilities) {
   try{await recordPayrollAutomation(pool,facilityId,'SCHEDULED',async()=>{
    const result=await workforceRunner(pool, facilityId)
    await pool.query(`INSERT INTO payroll_alert (facility_id,dedupe_key,severity,title,message)
      SELECT $1,'due-task-'||id||'-'||COALESCE(due_date::text,'none'),severity,
        'Payroll task needs attention: '||title,
        CASE WHEN due_date IS NULL THEN description ELSE description||' Due: '||due_date::text END
      FROM payroll_compliance_task
      WHERE facility_id=$1 AND status NOT IN ('COMPLETE','NOT_APPLICABLE')
        AND (due_date IS NULL OR due_date <= CURRENT_DATE + 14)
      ON CONFLICT (facility_id,dedupe_key) DO UPDATE SET status='OPEN',message=EXCLUDED.message`, [facilityId])
    await pool.query(`INSERT INTO payroll_alert (facility_id,dedupe_key,severity,title,message)
      SELECT $1,'payday-'||id,'WARNING','Payroll timeline: '||pay_date::text,
        'Pay period '||period_start::text||' through '||period_end::text||' is still '||status||'. Payday is '||pay_date::text||'.'
      FROM payroll_pay_period WHERE facility_id=$1 AND status <> 'PAID' AND pay_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
      ON CONFLICT (facility_id,dedupe_key) DO UPDATE SET status='OPEN',message=EXCLUDED.message`, [facilityId])
    await sourceReviewer(pool, facilityId, { limit: 5 })
    return result
   })}catch(error){failures.push(error)}
  }
  if(failures.length)throw new AggregateError(failures,'Payroll checks failed for one or more facilities.')
}

export function startPayrollComplianceScheduler(pool) {
  if (process.env.NODE_ENV === 'test' || process.env.PAYROLL_COMPLIANCE_SCHEDULER_ENABLED === 'false') return null
  const execute = () => runPayrollComplianceSweep(pool).catch((error) => console.error('[payroll] compliance sweep failed:', error))
  const first = setTimeout(execute, 60_000)
  first.unref?.()
  const timer = setInterval(execute, DAY_MS)
  timer.unref?.()
  return timer
}
