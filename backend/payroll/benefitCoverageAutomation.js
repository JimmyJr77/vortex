import {benefitCoverageLedger} from './benefitCoverageLedger.js'
export async function refreshBenefitCoverageAlerts(pool,facility,today){
 const current=today.slice(0,7),previous=new Date(Date.UTC(Number(current.slice(0,4)),Number(current.slice(5))-2,1)).toISOString().slice(0,7)
 const enrolled=(await pool.query("SELECT DISTINCT snapshot->'response'->'benefitsReview'->>'effectiveOn' AS effective FROM payroll_onboarding_revision WHERE facility_id=$1 AND snapshot->>'task_key'='PAY_REVIEW' AND snapshot->>'status'='COMPLETE' AND snapshot->'response'->'benefitsReview'->>'disposition' IN ('ENROLLED','ENROLLED_EMPLOYER_FUNDED')",[facility])).rows
 const first=enrolled.map(row=>row.effective).filter(value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value&&value.slice(0,7)<=current).sort()[0]
 const candidates=new Set((await pool.query('SELECT DISTINCT coverage_month FROM payroll_benefit_coverage_review WHERE facility_id=$1 AND coverage_month<=$2',[facility,current])).rows.map(row=>row.coverage_month))
 if(first)for(let month=first.slice(0,7);month<=current;month=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),1)).toISOString().slice(0,7))candidates.add(month)
 const checks=new Map((await pool.query('SELECT coverage_month,checked_at FROM payroll_benefit_coverage_check WHERE facility_id=$1',[facility])).rows.map(row=>[row.coverage_month,+new Date(row.checked_at)]))
 const history=[...candidates].filter(month=>month!==current&&month!==previous).sort((a,b)=>(checks.get(a)||0)-(checks.get(b)||0)||a.localeCompare(b)).slice(0,4)
 const months=[current,previous,...history];let checked=0,failed=0
 for(const month of months){const db=await pool.connect()
  try{
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const ledger=await benefitCoverageLedger(db,facility,month),active=[],prefix=`benefit-coverage:${month}:`
   for(const row of ledger.rows){if(['REVIEWED','RETRACTED'].includes(row.status))continue
    const key=`${prefix}${row.employeeId}:${row.onboardingCycle}:${row.planId}`;active.push(key)
    await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Monthly benefit coverage review required',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,dismissed_by=NULL,message=EXCLUDED.message",[facility,key,`${row.employeeName} · ${row.planName} · ${month}: ${row.status}. Review actual carrier coverage in Reports & QuickBooks, including months without finalized wages.`])
   }
   await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=clock_timestamp(),dismissed_by=NULL WHERE facility_id=$1 AND dedupe_key LIKE $2 AND NOT(dedupe_key=ANY($3::text[])) AND status='OPEN'",[facility,`${prefix}%`,active])
   await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=clock_timestamp(),dismissed_by=NULL WHERE facility_id=$1 AND dedupe_key=$2",[facility,`benefit-coverage-check:${month}`])
   await db.query("INSERT INTO payroll_benefit_coverage_check(facility_id,coverage_month,checked_at,last_status) VALUES($1,$2,clock_timestamp(),'COMPLETE') ON CONFLICT(facility_id,coverage_month) DO UPDATE SET checked_at=EXCLUDED.checked_at,last_status=EXCLUDED.last_status",[facility,month]);await db.query('COMMIT');checked++
  }catch{
   await db.query('ROLLBACK').catch(()=>{});failed++
   await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Monthly coverage check needs recovery',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,dismissed_by=NULL,message=EXCLUDED.message",[facility,`benefit-coverage-check:${month}`,`Coverage checks for ${month} could not complete. Review retained evidence; workforce automation will retry.`])
   await db.query("INSERT INTO payroll_benefit_coverage_check(facility_id,coverage_month,checked_at,last_status) VALUES($1,$2,clock_timestamp(),'FAILED') ON CONFLICT(facility_id,coverage_month) DO UPDATE SET checked_at=EXCLUDED.checked_at,last_status=EXCLUDED.last_status",[facility,month])
  }finally{db.release()}
 }
 return {checked,failed}
}
