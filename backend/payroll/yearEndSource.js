import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
// Keep raw payment evidence internal; only its digest leaves annual preparation.
export async function annualPaymentSources(db,facility){
 const paid=(await db.query(`SELECT re.employee_id,jsonb_build_object('payment',to_jsonb(re),'runId',r.id,'runKind',r.run_kind,'paymentDate',COALESCE(r.payment_date,p.pay_date),'calculation',r.calculation_snapshot,'incomeTaxReview',(SELECT to_jsonb(v) FROM payroll_income_tax_basis_review v WHERE v.facility_id=r.facility_id AND v.run_employee_id=re.id ORDER BY v.id DESC LIMIT 1)) AS evidence
 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id JOIN payroll_employee e ON e.id=re.employee_id AND e.facility_id=r.facility_id
 WHERE r.facility_id=$1 AND r.status='FINALIZED' AND COALESCE(r.payment_date,p.pay_date)>='2026-01-01' AND COALESCE(r.payment_date,p.pay_date)<'2027-01-01' ORDER BY re.employee_id,r.id,re.id`,[facility])).rows
 const imported=(await db.query("SELECT employee_id,to_jsonb(h) AS evidence FROM payroll_historical_payment h WHERE facility_id=$1 AND payment_date>='2026-01-01' AND payment_date<'2027-01-01' ORDER BY employee_id,id",[facility])).rows
 const sources=new Map()
 for(const [kind,rows] of [['paid',paid],['imported',imported]])for(const row of rows){const key=String(row.employee_id);if(!sources.has(key))sources.set(key,{paid:[],imported:[]});sources.get(key)[kind].push(row.evidence)}
 return sources
}
export function annualSourceFingerprint(facility,employer,employee,payments,overtime,identityReview){
 return createHash('sha256').update(JSON.stringify(compensationEvidence({version:1,year:2026,facility:String(facility),employer,employee,payments,overtime,identityReview}))).digest('hex')
}
