import {createHash} from 'node:crypto'
import {reconcileIncomeTaxWageRows} from './incomeTaxWageReconciliation.js'
import {marylandAdditionalWithholdingEvidence} from './marylandAdditionalWithholdingEvidence.js'

// Retain state-specific source evidence independently of federal supplemental
// classifications. This does not select a withholding method for PTO.
export function reconcileMarylandPaymentHistory(rows){
 const evidence=[],issues=[],seen=new Set()
 for(const row of rows){
  const runId=String(row.run_id),employeeId=String(row.employee_id),key=`${runId}:${employeeId}`
  if(seen.has(key))issues.push({runId,employeeId,message:'Duplicate Maryland payment evidence.'})
  seen.add(key)
  const source={runId,employeeId,runKind:row.run_kind,postedWages:{regular:row.regular_pay_cents,overtime:row.overtime_pay_cents,other:row.other_taxable_pay_cents,federalWithholding:row.federal_income_tax_cents},paymentDate:row.payment_date instanceof Date?row.payment_date.toISOString().slice(0,10):String(row.payment_date).slice(0,10),stateIncomeTaxCents:row.state_income_tax_cents,pretaxDeductionCents:row.pretax_deduction_cents??null,calculation:Array.isArray(row.calculation_snapshot?.employees)?row.calculation_snapshot.employees.filter(e=>String(e?.employeeId)===employeeId):null,statement:row.statement_snapshot??null}
  const result=reconcileIncomeTaxWageRows([row]).get(employeeId)
  const reconciled=result?.verified===1&&!result.issues.length&&result.maryland<=BigInt(Number.MAX_SAFE_INTEGER)
  const sourceFingerprint=createHash('sha256').update(JSON.stringify(source)).digest('hex')
  if(!reconciled)issues.push({runId,employeeId,message:'Reconcile Maryland wages and withholding with the retained calculation and employee statement.'})
  evidence.push({runId,employeeId,paymentDate:source.paymentDate,reconciled,marylandWagesCents:reconciled?Number(result.maryland):null,stateIncomeTaxCents:reconciled?Number(row.state_income_tax_cents):null,additionalWithholding:marylandAdditionalWithholdingEvidence(row,reconciled),sourceFingerprint})
 }
 evidence.sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate)||a.runId.localeCompare(b.runId)||a.employeeId.localeCompare(b.employeeId)||a.sourceFingerprint.localeCompare(b.sourceFingerprint))
 issues.sort((a,b)=>a.runId.localeCompare(b.runId)||a.employeeId.localeCompare(b.employeeId))
 const basis={version:1,reconciled:issues.length===0,evidence,issues}
 return {...basis,fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex')}
}
