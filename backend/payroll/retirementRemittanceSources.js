import {retirementAllocationFormatHistory} from './retirementAllocationFormat.js'
import {retirementTimingAssessment} from './retirementTiming.js'
import {retirementDestinationStatus} from './retirementDestination.js'
import {readRetirementParticipantMapping} from './retirementParticipantMapping.js'
import {createHash} from 'node:crypto'
import {verifyRetirementPosting} from './retirementJournal.js'
import {retirementStatementSummary,retirementStatementLines} from './retirementStatement.js'
import {compensationEvidence} from './employmentCompensation.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')
const add=(a,b)=>{if(!Number.isSafeInteger(b)||b<0||!Number.isSafeInteger(a+b))throw fail('Contribution amounts require exact nonnegative cents.');return a+b}
// Reconcile finalized withholding, not provider delivery. The source fingerprint
// is suitable for binding a later remittance review, never proof of remittance.
export async function retirementRemittanceSources(db,facility,{beforeRunId=null,limit=20,runId=null,now=new Date()}={}){
 if(runId!==null&&(!/^[1-9]\d*$/.test(String(runId))||BigInt(runId)>9223372036854775807n))throw Object.assign(new Error('Choose a valid retirement payroll.'),{status:400})
 if(!Number.isSafeInteger(limit)||limit<1||limit>50||beforeRunId!==null&&(!/^[1-9]\d*$/.test(String(beforeRunId))||BigInt(beforeRunId)>9223372036854775807n))throw Object.assign(new Error('Use a valid retirement payroll cursor and page size from 1 to 50.'),{status:400})
 const runs=(await db.query(`SELECT r.*,COALESCE(r.payment_date,p.pay_date)::text AS pay_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
 WHERE r.facility_id=$1 AND r.status='FINALIZED' AND COALESCE(r.payment_date,p.pay_date)>='2026-01-01' AND COALESCE(r.payment_date,p.pay_date)<'2027-01-01' AND ($2::bigint IS NULL OR r.id<$2) AND ($4::bigint IS NULL OR r.id=$4)
 AND (EXISTS(SELECT 1 FROM payroll_retirement_run_ledger l WHERE l.facility_id=r.facility_id AND l.run_id=r.id)
 OR EXISTS(SELECT 1 FROM payroll_run_employee re WHERE re.payroll_run_id=r.id AND re.statement_snapshot ? 'retirement')
 OR jsonb_path_exists(r.calculation_snapshot,'$.employees[*].retirementPlans') OR jsonb_path_exists(r.calculation_snapshot,'$.employees[*].retirement401k')
 OR jsonb_path_exists(r.calculation_snapshot,'$.employees[*].payItems[*] ? (@.kind like_regex "^RETIREMENT_")'))
 ORDER BY r.id DESC LIMIT $3`,[facility,beforeRunId,limit+1,runId])).rows
 const items=[],destinationStates=new Map(),formatStates=new Map()
 for(const run of runs.slice(0,limit)){
  const base={runId:String(run.id),paymentDate:run.pay_date,runKind:run.run_kind}
  try{
   await verifyRetirementPosting(db,run)
   const posted=(await db.query(`SELECT re.*,e.legal_first_name,e.legal_last_name FROM payroll_run_employee re JOIN payroll_employee e ON e.id=re.employee_id AND e.facility_id=$2 WHERE re.payroll_run_id=$1 ORDER BY re.employee_id`,[run.id,facility])).rows
   const ledger=(await db.query('SELECT id,employee_id,plan_id,calculation FROM payroll_retirement_run_ledger WHERE facility_id=$1 AND run_id=$2 ORDER BY employee_id,plan_id',[facility,run.id])).rows
   const employees=run.calculation_snapshot?.employees
   if(!Array.isArray(employees)||!employees.length||!ledger.length)throw fail('Reconcile missing finalized retirement calculations or ledger records.')
   const allocations=[];let totalCents=0
   for(const row of posted){
    const matches=employees.filter(e=>String(e.employeeId)===String(row.employee_id))
    if(matches.length!==1)throw fail('Reconcile the employee and finalized payroll calculation.')
    const employee=matches[0],entries=employee.retirementPlans||[]
    const retained=ledger.filter(l=>String(l.employee_id)===String(row.employee_id))
    if(retained.length!==entries.length)throw fail('Reconcile retained retirement plan counts.')
    if(!entries.length){if(row.statement_snapshot?.retirement)throw fail('Reconcile retirement statement evidence without a retained plan.');continue}
    if(!same(retirementStatementSummary(employee),row.statement_snapshot?.retirement))throw fail('Retirement deductions differ from the finalized employee statement.')
    retirementStatementLines(row)
    for(const entry of entries){
     const c=entry.calculation,record=retained.find(l=>l.plan_id===entry.planId)
     if(!record||c.payDate!==run.pay_date||c.retirement401k?.planType!=='STANDARD_401K')throw fail('Reconcile contribution payment date and plan treatment.')
     totalCents=add(totalCents,c.totalCents)
     let participantMapping={status:'NOT_REQUIRED'}
     if(c.totalCents){
      try{const mapping=await readRetirementParticipantMapping(db,facility,row.employee_id,entry.planId);participantMapping={status:'VERIFIED',mappingId:mapping.id,sourceFingerprint:mapping.source.fingerprint,maskedIdentifiers:mapping.masked_identifiers}}
      catch(e){if(![409,503].includes(e.status))throw e;participantMapping={status:'REVIEW_REQUIRED'}}
     }
     if(c.totalCents&&!destinationStates.has(entry.planId))destinationStates.set(entry.planId,await retirementDestinationStatus(db,facility,entry.planId))
     const destinationReview=c.totalCents?destinationStates.get(entry.planId):{status:'NOT_REQUIRED'}
     const timing=c.totalCents?await retirementTimingAssessment(db,facility,entry.planId,run.pay_date,{now}):{status:'NOT_REQUIRED'}
     if(c.totalCents&&!formatStates.has(entry.planId)){const row=(await retirementAllocationFormatHistory(db,facility,entry.planId)).history[0];formatStates.set(entry.planId,row?{formatId:row.id,status:!row.currentPlan?'PLAN_CHANGED':row.format.disposition}:{status:'REVIEW_REQUIRED'})}
     const allocationFormat=c.totalCents?formatStates.get(entry.planId):{status:'NOT_REQUIRED'}
     allocations.push({allocationFormat,timing,destinationReview,participantMapping,ledgerId:String(record.id),employeeId:String(row.employee_id),employeeName:`${row.legal_first_name} ${row.legal_last_name}`,planId:entry.planId,planName:c.planName||entry.planId,ordinaryPretaxCents:c.ordinary.pretax,ordinaryRothCents:c.ordinary.roth,catchUpPretaxCents:c.catchUp.pretax,catchUpRothCents:c.catchUp.roth,totalCents:c.totalCents})
    }
   }
   if(allocations.length!==ledger.length)throw fail('Reconcile retirement ledger records missing from employee payroll.')
   items.push({...base,status:totalCents?'DELIVERY_UNVERIFIED':'NO_EMPLOYEE_CONTRIBUTION',totalCents,allocations,sourceFingerprint:hash({facility:String(facility),runId:base.runId,paymentDate:run.pay_date,ledger,statements:posted.map(r=>({employeeId:String(r.employee_id),retirement:r.statement_snapshot?.retirement})),allocations}),issue:null})
  }catch(e){if(e.status!==409)throw e;items.push({...base,status:'RECONCILIATION_REQUIRED',totalCents:null,allocations:[],sourceFingerprint:null,issue:e.message})}
 }
 return {year:2026,items,nextCursor:runs.length>limit?String(runs[limit-1].id):null}
}
