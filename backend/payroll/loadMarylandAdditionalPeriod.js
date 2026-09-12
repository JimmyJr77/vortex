import {createHash} from 'node:crypto'
import {loadMarylandAdditionalAgreement} from './marylandAdditionalAgreement.js'
import {marylandAdditionalPeriod} from './marylandAdditionalPeriod.js'
import {marylandAdditionalWithholdingEvidence} from './marylandAdditionalWithholdingEvidence.js'
import {reconcileIncomeTaxWageRows,reconcileApprovedIncomeTaxWageRows} from './incomeTaxWageReconciliation.js'
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10)
const fail=message=>Object.assign(new Error(message),{status:409})
export async function loadOptionalMarylandAdditionalPeriod(db,input,required=false){
 const present=(await db.query('SELECT 1 FROM payroll_maryland_additional_agreement WHERE facility_id=$1 AND employee_id=$2 AND effective_on<=$3::date LIMIT 1',[input.facility,input.employeeId,input.paymentDate])).rows.length>0
 return present||required?loadMarylandAdditionalPeriod(db,input):null
}

// Read-only; callers that reserve or spend the result must hold the employer
// payroll lock and repeat this load at approval and finalization.
export async function loadMarylandAdditionalPeriod(db,{facility,employeeId,paymentDate,excludeRunId=null}){
 const agreement=await loadMarylandAdditionalAgreement(db,{facility,employeeId,paymentDate})
 if(excludeRunId!==null){
  const current=(await db.query("SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee e ON e.payroll_run_id=r.id WHERE r.facility_id=$1 AND r.id=$2 AND e.employee_id=$3 AND r.status IN ('DRAFT','REVIEW','APPROVED') AND COALESCE(r.payment_date,p.pay_date)=$4::date",[facility,excludeRunId,employeeId,paymentDate])).rows
  if(current.length!==1)throw fail('Only the current scoped, unfinalized payment may be excluded from additional-withholding history.')
 }
 const periods=(await db.query("SELECT * FROM payroll_pay_period WHERE facility_id=$1 AND status<>'VOID' AND $2::date BETWEEN period_start AND period_end",[facility,paymentDate])).rows
 if(periods.length!==1)throw fail('Generate one unambiguous agreed payroll period containing this payment date.')
 const period=periods[0]
 const rows=(await db.query(`SELECT r.id AS run_id,r.status,r.run_kind,COALESCE(r.payment_date,p.pay_date) AS payment_date,r.calculation_snapshot,re.*
 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
 WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.status IN ('APPROVED','FINALIZED') AND r.run_kind<>'OFF_CYCLE_REIMBURSEMENT'
 AND COALESCE(r.payment_date,p.pay_date) BETWEEN $3::date AND $4::date AND r.id IS DISTINCT FROM $5::bigint ORDER BY r.id`,[facility,employeeId,period.period_start,period.period_end,excludeRunId])).rows
 const evidence=[]
 for(const row of rows){
  const result=(row.status==='APPROVED'?reconcileApprovedIncomeTaxWageRows([row]):reconcileIncomeTaxWageRows([row])).get(String(employeeId))
  const reconciled=result?.verified===1&&result.issues.length===0
  const additionalWithholding=marylandAdditionalWithholdingEvidence(row,reconciled,row.status)
  evidence.push({runId:String(row.run_id),employeeId:String(employeeId),status:row.status,paymentDate:day(row.payment_date),reconciled,additionalWithholding,sourceFingerprint:createHash('sha256').update(JSON.stringify(row)).digest('hex')})
 }
 return marylandAdditionalPeriod({employeeId:String(employeeId),agreement,period:{id:String(period.id),start:day(period.period_start),end:day(period.period_end),payFrequency:period.frequency},paymentDate,history:{reconciled:evidence.every(row=>row.reconciled),evidence}})
}
