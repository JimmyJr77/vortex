import {checkRetirementReplacementReceipts} from './retirementReplacementReceiptAutomation.js'
import {runRetirementReplacementBankSweep} from './retirementReplacementBankAutomation.js'
import {runRetirementReplacementAllocationSweep} from './retirementReplacementAutomation.js'
import {runRetirementReturnSweep} from './retirementReturnAutomation.js'
import {runRetirementSettlementSweep} from './retirementSettlementAutomation.js'
import {runRetirementContributionSweep} from './retirementContributionAutomation.js'
import {checkRetirementReceipts} from './retirementReceiptAutomation.js'
import {runRetirementScheduledDispatches} from './retirementDispatchSchedule.js'
import {recoverRetirementAllocations} from './retirementAllocationRecovery.js'
import {recoverRetirementRemittances} from './retirementRemittanceRecovery.js'
import {refreshRetirementTimingAlerts} from './retirementTimingAlerts.js'
import {checkRetirementDestinations} from './retirementDestinationAutomation.js'
import {checkCarrierAlternateDeliveries} from './carrierAlternateDelivery.js'
import {refreshBenefitCoverageAlerts} from './benefitCoverageAutomation.js'
import {runCarrierRemittanceSweep} from './carrierRemittanceAutomation.js'
import {runCarrierInvoiceSweep} from './carrierInvoiceAutomation.js'
import {runCarrierReconciliationSweep} from './carrierReconciliationAutomation.js'
import {recoverCarrierPayments} from './carrierPaymentRecovery.js'
import {recoverCarrierReversals} from './carrierReversalRecovery.js'
import {recoverCarrierPremiums} from './carrierPremiumRecovery.js'
import {sendEmail,isEmailConfigured} from '../email/sendEmail.js'
import {refreshW2NoticeDispatch} from './w2NoticeDispatch.js'
import {refreshW2NoticeQueue} from './w2NoticeQueue.js'
import {refreshW2FurnishingAlerts} from './w2FurnishingAlerts.js'
import {refreshFilingIdentityAlerts} from './filingIdentityAlerts.js'
import {automateBenefitsDeductionAuthorization} from './benefitsDeductionAuthorization.js'
import {automateBenefitsReviews} from './benefitsReview.js'
import {employeePaySetup} from './employeePaySetup.js'
import {onboardingReviewIssues} from './onboarding.js'
import {hiringPolicy} from './hiringPaySchedule.js'
import {salaryRowsAt} from './salaryChanges.js'
import {firstShiftReadiness} from './firstShiftReadiness.js'
import {refreshFinalPayAlerts} from './finalPay.js'
import {automateLeaveYearOpening} from './leaveYearAutomation.js'
import { marylandWithholdingCalendar } from './marylandWithholdingCalendar.js'
import { marylandUiCalendar } from './marylandUiCalendar.js'
import { federalTaxCalendar } from './federalTaxCalendar.js'
import { ensureEmployerSetup } from './employerSetup.js'
import { taxReconciliation } from './taxReconciliation.js'
import { ensureOnboarding } from './onboarding.js'
import { generateVersionedPayPeriods,loadScheduleVersions,persistPayPeriods } from './payCalendar.js'
import { syncQuickbooksRun } from './quickbooks.js'

export async function runWorkforceAutomation(pool, facilityId, {retirementReceiptReader,retirementDispatchNow=()=>new Date(),retirementAllocationTransfer,now=new Date(), sync=true,quickbooksFetcher,paymentFetcher,w2NoticeSender,carrierNoticeSender}={}) {
 await ensureEmployerSetup(pool,facilityId)
 await runRetirementSettlementSweep(pool,{facility:facilityId,fetcher:quickbooksFetcher,paymentFetcher,now})
 await runRetirementReturnSweep(pool,{facility:facilityId,fetcher:quickbooksFetcher,paymentFetcher,now})
 await runRetirementReplacementAllocationSweep(pool,{facility:facilityId,fetcher:quickbooksFetcher,paymentFetcher,reader:retirementReceiptReader,transfer:retirementAllocationTransfer,now,dispatchNow:retirementDispatchNow})
 await runRetirementReplacementBankSweep(pool,{facility:facilityId,fetcher:quickbooksFetcher,paymentFetcher,reader:retirementReceiptReader,transfer:retirementAllocationTransfer,now,dispatchNow:retirementDispatchNow})
 await runRetirementContributionSweep(pool,{facility:facilityId,now})
 await recoverRetirementRemittances(pool,facilityId,{fetcher:paymentFetcher,now})
 await checkRetirementReceipts(pool,facilityId,{reader:retirementReceiptReader,now})
 await checkRetirementReplacementReceipts(pool,facilityId,{reader:retirementReceiptReader,now})
 await recoverRetirementAllocations(pool,facilityId,{transfer:retirementAllocationTransfer,now})
 await runRetirementScheduledDispatches(pool,{facility:facilityId,bankFetcher:paymentFetcher,allocationTransfer:retirementAllocationTransfer,now:retirementDispatchNow})
 await checkRetirementDestinations(pool,facilityId,{fetcher:paymentFetcher,now})
 await refreshRetirementTimingAlerts(pool,facilityId,{now})
 await refreshFilingIdentityAlerts(pool,facilityId)
 await refreshW2FurnishingAlerts(pool,facilityId)
 await refreshW2NoticeQueue(pool,facilityId,{now})
 await refreshW2NoticeDispatch(pool,facilityId,{now,sender:w2NoticeSender??(isEmailConfigured()?sendEmail:undefined)})
 const settings=(await pool.query('SELECT * FROM payroll_settings WHERE facility_id=$1',[facilityId])).rows[0]
 if(!settings)return {employees:0,periods:0,syncs:0}
 const employees=(await pool.query("SELECT * FROM payroll_employee WHERE facility_id=$1 AND employment_status IN ('ONBOARDING','ACTIVE','LEAVE')",[facilityId])).rows
 for(const employee of employees)await ensureOnboarding(pool,employee)
 for(const employee of employees.filter(e=>e.employment_status==='ONBOARDING')){
  const tasks=(await pool.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2",[facilityId,employee.id])).rows
  const currentEmployee=(await salaryRowsAt(pool,facilityId,[employee]))[0]
  const issues=onboardingReviewIssues(currentEmployee,tasks,await hiringPolicy(pool,facilityId,currentEmployee))
  const acknowledgmentKey=`acknowledgment-review-${employee.id}`
  if(issues.length)await pool.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Hiring acknowledgments need renewal',$3)
   ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facilityId,acknowledgmentKey,`${employee.legal_first_name} ${employee.legal_last_name}: ${issues.map(i=>i.message).join('; ')}. Open People & onboarding to request a new acknowledgment.`])
  else await pool.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facilityId,acknowledgmentKey])
  const paySetup=await employeePaySetup(pool,facilityId,currentEmployee,tasks)
  const payKey=`pay-setup-review-${employee.id}`
  if(paySetup.status==='NEEDS_REVIEW')await pool.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Employee pay setup needs a new review',$3)
   ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facilityId,payKey,`${employee.legal_first_name} ${employee.legal_last_name}: tax, payment or employee pay settings changed. Review the current setup in People & onboarding.`])
  else await pool.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facilityId,payKey])
  const review=await firstShiftReadiness(pool,facilityId,employee,tasks)
  const key=`first-shift-review-${employee.id}`
  if(review.status==='NEEDS_REVIEW')await pool.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','First shift needs a new hiring review',$3)
   ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facilityId,key,`${employee.legal_first_name} ${employee.legal_last_name}: the reviewed first shift changed or is no longer scheduled. Review the current shift and arrival details in People & onboarding.`])
  else await pool.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facilityId,key])
 }
 await pool.query("UPDATE payroll_alert a SET status='DISMISSED',dismissed_at=now() FROM payroll_employee e WHERE a.facility_id=$1 AND e.facility_id=a.facility_id AND (a.dedupe_key='first-shift-review-'||e.id OR a.dedupe_key='acknowledgment-review-'||e.id OR a.dedupe_key='pay-setup-review-'||e.id) AND e.employment_status<>'ONBOARDING' AND a.status='OPEN'",[facilityId])
 const benefitsToday=(await pool.query('SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[facilityId])).rows[0].today
 await automateBenefitsReviews(pool,facilityId,benefitsToday)
 await refreshBenefitCoverageAlerts(pool,facilityId,benefitsToday)
 await automateBenefitsDeductionAuthorization(pool,facilityId,benefitsToday)
 await automateLeaveYearOpening(pool,facilityId,now)
 let periods=0
 const calendarDb=await pool.connect()
 try {
  await calendarDb.query('BEGIN')
  const current=(await calendarDb.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facilityId])).rows[0]
  const localDate=new Intl.DateTimeFormat('en-CA',{timeZone:current.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
  const generated=[],versions=await loadScheduleVersions(calendarDb,facilityId)
  for(let offset=0;offset<3;offset++){
   const month=new Date(Date.UTC(Number(localDate.slice(0,4)),Number(localDate.slice(5,7))-1+offset,1))
   generated.push(...generateVersionedPayPeriods(month.getUTCFullYear(),month.getUTCMonth()+1,current,versions))
  }
  const persisted=await persistPayPeriods(calendarDb,facilityId,generated)
  periods=persisted.insertedCount
  if(periods)await calendarDb.query(`INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'PAY_CALENDAR_GENERATED','pay_calendar',$2,$3)`,[facilityId,localDate.slice(0,7),{frequency:current.pay_frequency,insertedCount:periods,periodIds:persisted.rows.map(p=>p.id)}])
  await calendarDb.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key='pay-calendar-configuration' AND status='OPEN'",[facilityId])
  await calendarDb.query('COMMIT')
 }catch(error){
  await calendarDb.query('ROLLBACK');periods=0
  if(error.status!==409)throw error
  await calendarDb.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,'pay-calendar-configuration','WARNING','Pay calendar needs configuration',$2)
   ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facilityId,error.message])
 }finally{calendarDb.release()}
 await pool.query(`INSERT INTO payroll_alert (facility_id,dedupe_key,severity,title,message)
 SELECT $1,'onboarding-'||t.id,'WARNING',e.legal_first_name||' '||e.legal_last_name||': '||t.title,
 'Assigned to '||t.owner||'. Due '||t.due_date::text||'. Open People & onboarding to complete the step.'
 FROM payroll_onboarding_task t JOIN payroll_employee e ON e.id=t.employee_id
 WHERE t.facility_id=$1 AND e.employment_status<>'TERMINATED' AND t.status NOT IN ('COMPLETE','NOT_APPLICABLE') AND t.due_date<=CURRENT_DATE+7
 ON CONFLICT (facility_id,dedupe_key) DO UPDATE SET status='OPEN',message=EXCLUDED.message`,[facilityId])
 await pool.query(`UPDATE payroll_alert a SET status='DISMISSED',dismissed_at=now()
 FROM payroll_onboarding_task t WHERE a.facility_id=$1 AND t.facility_id=a.facility_id AND a.dedupe_key='onboarding-'||t.id AND (t.status IN ('COMPLETE','NOT_APPLICABLE') OR EXISTS (SELECT 1 FROM payroll_employee e WHERE e.id=t.employee_id AND e.facility_id=t.facility_id AND e.employment_status='TERMINATED')) AND a.status='OPEN'`,[facilityId])
 await pool.query(`INSERT INTO payroll_alert (facility_id,dedupe_key,severity,title,message)
 SELECT $1,'request-'||r.id,'INFO','Employee request awaiting review',e.legal_first_name||' '||e.legal_last_name||' submitted '||r.kind||'. Open Requests & approvals.'
 FROM payroll_employee_request r JOIN payroll_employee e ON e.id=r.employee_id WHERE r.facility_id=$1 AND r.status='PENDING'
 ON CONFLICT (facility_id,dedupe_key) DO NOTHING`,[facilityId])
 await pool.query(`UPDATE payroll_alert a SET status='DISMISSED',dismissed_at=now() FROM payroll_employee_request r
 WHERE a.facility_id=$1 AND r.facility_id=a.facility_id AND a.dedupe_key='request-'||r.id AND r.status<>'PENDING' AND a.status='OPEN'`,[facilityId])
 await pool.query(`INSERT INTO payroll_alert (facility_id,dedupe_key,severity,title,message)
 SELECT $1,'open-clock-'||t.id,'WARNING','Long-running employee clock',e.legal_first_name||' '||e.legal_last_name||' has an open clock older than 16 hours. Confirm actual hours before payroll.'
 FROM payroll_effective_time_entry t JOIN payroll_employee e ON e.id=t.employee_id WHERE t.facility_id=$1 AND t.clock_out IS NULL AND t.status<>'REJECTED' AND t.clock_in<now()-interval '16 hours'
 ON CONFLICT (facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facilityId])
 await pool.query(`UPDATE payroll_alert a SET status='DISMISSED',dismissed_at=now()
 FROM payroll_effective_time_entry t WHERE a.facility_id=$1 AND t.facility_id=a.facility_id
 AND a.dedupe_key='open-clock-'||t.id AND a.status='OPEN' AND (t.clock_out IS NOT NULL OR t.status='REJECTED')`,[facilityId])
 for(const year of [now.getUTCFullYear()-1,now.getUTCFullYear()]) {
  const taxes=await taxReconciliation(pool,facilityId,year)
  const calendar=taxes.annual.IRS_941>0||taxes.annual.IRS_FUTA>0?await federalTaxCalendar(pool,facilityId,year):null
  if(calendar&&taxes.annual.IRS_941>0) {
   const urgent=calendar.obligations.filter(o=>o.balanceCents>0&&o.dueOn<=new Date(Date.parse(calendar.today+'T00:00:00Z')+7*86400000).toISOString().slice(0,10))
   const key=`federal-deposit-deadlines-${year}`
   if(!calendar.reliable||urgent.length)await pool.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Federal deposit calendar needs attention',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facilityId,key,calendar.reliable?`${urgent.length} federal deposits are due within seven days or overdue with unmatched amounts. Open Compliance to review the deposit calendar and receipts.`:calendar.issues.join(' ')])
   else await pool.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facilityId,key])
  }
  if(calendar&&taxes.annual.IRS_FUTA>0) {
   const urgent=calendar.futa.obligations.filter(o=>o.balanceCents>0&&o.dueOn<=new Date(Date.parse(calendar.today+'T00:00:00Z')+7*86400000).toISOString().slice(0,10))
   const key=`futa-deposit-deadlines-${year}`
   if(!calendar.futa.reliable||urgent.length)await pool.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','FUTA deposit calendar needs attention',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facilityId,key,calendar.futa.reliable?`${urgent.length} FUTA deposits are due within seven days or overdue with unmatched amounts. Open Compliance to review carryforward and receipts.`:calendar.futa.issues.join(' ')])
   else await pool.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facilityId,key])
  }
  if(taxes.annual.MD_UI>0||(year===now.getUTCFullYear()&&settings.md_ui_status==='ACTIVE')) {
   const state=await marylandUiCalendar(pool,facilityId,year),key=`md-ui-deadlines-${year}`
   const soon=new Date(Date.parse(state.today+'T00:00:00Z')+7*86400000).toISOString().slice(0,10)
   const urgent=state.quarters.filter(q=>q.filingStatus==='REVIEW_REQUIRED'||q.dueOn<=soon&&(q.balanceCents>0||!['RECORDED','RECORDED_LATE'].includes(q.filingStatus)))
   if(!state.reliable||urgent.length)await pool.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Maryland unemployment reporting needs attention',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facilityId,key,state.reliable?`${urgent.length} quarterly reports or payments need attention. A payment receipt does not replace the wage report. Open Compliance.`:state.issues.join(' ')])
   else await pool.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facilityId,key])
  }
  const withholding=await marylandWithholdingCalendar(pool,facilityId,year)
  if(taxes.annual.MD_WITHHOLDING>0||withholding.config) {
   const key=`md-withholding-deadlines-${year}`,soon=new Date(Date.parse(withholding.today+'T00:00:00Z')+7*86400000).toISOString().slice(0,10)
   const urgent=[...withholding.periods,...(withholding.annual?[withholding.annual]:[])].filter(p=>p.filingStatus==='REVIEW_REQUIRED'||p.dueOn<=soon&&((p.balanceCents||0)>0||!['RECORDED','RECORDED_LATE'].includes(p.filingStatus)))
   if(!withholding.reliable||urgent.length)await pool.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Maryland withholding reporting needs attention',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facilityId,key,withholding.reliable?`${urgent.length} withholding returns or payments need attention. Open Compliance to review deadlines and receipts.`:withholding.issues.join(' ')])
   else await pool.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facilityId,key])
  }
  const openCents=taxes.quarters.reduce((sum,q)=>sum+q.agencies.reduce((n,a)=>n+Math.max(0,a.balanceCents),0),0)
  const changed=taxes.filings.filter(f=>['PAYROLL_CHANGED','TOTALS_DIFFER','LEGACY_REVIEW_REQUIRED'].includes(f.status)).length
  const key=`tax-reconciliation-${year}`
  if(openCents>0||changed>0)await pool.query(`INSERT INTO payroll_alert (facility_id,dedupe_key,severity,title,message) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (facility_id,dedupe_key) DO UPDATE SET status='OPEN',severity=EXCLUDED.severity,message=EXCLUDED.message`,[facilityId,key,changed?'WARNING':'INFO',`${year} payroll tax reconciliation`,`${(openCents/100).toFixed(2)} in calculated taxes have no matching deposit receipts; ${changed} filing comparisons need review. Open Compliance. This balance does not determine deposit due dates.`])
  else await pool.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facilityId,key])
 }
 await refreshFinalPayAlerts(pool,facilityId,now)
 let syncs=0,premiumRecovery={checked:0,synced:0},reversalRecovery={checked:0,synced:0},carrierPaymentRecovery={checked:0,settled:0,needsReview:0}
 if(sync) {
  await pool.query(`INSERT INTO payroll_alert (facility_id,dedupe_key,severity,title,message)
   SELECT r.facility_id,'quickbooks-'||r.id::text,'WARNING','QuickBooks destination needs review','This payroll has a saved journal for another company. Review its destination in Reports & QuickBooks before starting an explicit sync.'
   FROM payroll_run r JOIN payroll_quickbooks_connection c ON c.facility_id=r.facility_id
   WHERE r.facility_id=$1 AND r.status='FINALIZED' AND c.auto_sync=true
   AND EXISTS (SELECT 1 FROM payroll_quickbooks_sync s WHERE s.facility_id=r.facility_id AND s.payroll_run_id=r.id)
   AND NOT EXISTS (SELECT 1 FROM payroll_quickbooks_sync s WHERE s.facility_id=r.facility_id AND s.payroll_run_id=r.id AND s.realm_id=c.realm_id AND s.environment=c.environment)
   ON CONFLICT (facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,title=EXCLUDED.title,message=EXCLUDED.message`,[facilityId])
  const runs=(await pool.query(`SELECT r.id,c.realm_id,c.environment FROM payroll_run r JOIN payroll_quickbooks_connection c ON c.facility_id=r.facility_id
    WHERE r.facility_id=$1 AND r.status='FINALIZED' AND c.auto_sync=true AND (NOT EXISTS (SELECT 1 FROM payroll_quickbooks_sync s WHERE s.facility_id=r.facility_id AND s.payroll_run_id=r.id) OR EXISTS (SELECT 1 FROM payroll_quickbooks_sync s WHERE s.facility_id=r.facility_id AND s.payroll_run_id=r.id AND s.realm_id=c.realm_id AND s.environment=c.environment)) AND NOT EXISTS (SELECT 1 FROM payroll_quickbooks_sync s WHERE s.payroll_run_id=r.id AND s.facility_id=r.facility_id AND s.realm_id=c.realm_id AND s.environment=c.environment AND s.status='SYNCED') ORDER BY r.id LIMIT 10`,[facilityId])).rows
  for(const run of runs)try{await syncQuickbooksRun(pool,facilityId,run.id,{automatic:true,expectedDestination:run,fetcher:quickbooksFetcher});syncs++}catch{await pool.query(`INSERT INTO payroll_alert (facility_id,dedupe_key,severity,title,message) VALUES ($1,$2,'WARNING','QuickBooks sync needs attention','Open Reports & QuickBooks to inspect and retry the saved payroll journal.') ON CONFLICT (facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL`,[facilityId,`quickbooks-${run.id}`])}
 }
 if(sync)carrierPaymentRecovery=await recoverCarrierPayments(pool,facilityId,{fetcher:paymentFetcher})
 if(sync)reversalRecovery=await recoverCarrierReversals(pool,facilityId,{fetcher:quickbooksFetcher})
 if(sync)premiumRecovery=await recoverCarrierPremiums(pool,facilityId,{fetcher:quickbooksFetcher})
 await runCarrierReconciliationSweep(pool,{facility:facilityId,now})
 await runCarrierInvoiceSweep(pool,{facility:facilityId,now})
 await checkCarrierAlternateDeliveries(pool,facilityId,{now})
 await runCarrierRemittanceSweep(pool,{facility:facilityId,now,...(carrierNoticeSender!==undefined?{sender:carrierNoticeSender}:{})})
 // Repair stale warnings too, including a retry that succeeded concurrently with a failed worker.
 await pool.query(`UPDATE payroll_alert a SET status='DISMISSED',dismissed_at=now()
  WHERE a.facility_id=$1 AND a.status='OPEN' AND EXISTS (
   SELECT 1 FROM payroll_quickbooks_sync s JOIN payroll_quickbooks_connection c
    ON c.facility_id=s.facility_id AND c.realm_id=s.realm_id AND c.environment=s.environment
   WHERE s.facility_id=a.facility_id AND s.status='SYNCED' AND a.dedupe_key='quickbooks-'||s.payroll_run_id::text
  )`,[facilityId])
 return {employees:employees.length,periods,syncs,premiumRecovery,reversalRecovery,carrierPaymentRecovery}
}
