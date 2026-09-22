import {taxRows} from './taxReconciliation.js'
import {readPayrollSnapshot} from './readPayrollSnapshot.js'
const money=value=>{const n=BigInt(value);return `${n/100n}.${String(n%100n).padStart(2,'0')}`}
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10)
export async function taxLiabilityReport(db,facility,{start='2000-01-01',end='2200-12-31'}={}){
 return readPayrollSnapshot(db,async client=>{
  const years=(await client.query(`SELECT DISTINCT EXTRACT(YEAR FROM payment_date)::int AS year FROM (
   SELECT COALESCE(r.payment_date,p.pay_date) AS payment_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id AND p.facility_id=r.facility_id WHERE r.facility_id=$1 AND r.status IN ('APPROVED','FINALIZED')
   UNION ALL SELECT payment_date FROM payroll_historical_payment WHERE facility_id=$1
  ) payments WHERE payment_date BETWEEN $2::date AND $3::date ORDER BY year`,[facility,start,end])).rows
  const rows=[]
  for(const {year} of years)for(const row of await taxRows(client,facility,year,{includeApproved:true}))if(day(row.payment_date)>=start&&day(row.payment_date)<=end)rows.push(row)
  rows.sort((a,b)=>day(a.payment_date).localeCompare(day(b.payment_date))||String(a.employee_id).localeCompare(String(b.employee_id))||String(a.imported_evidence?.paymentId||a.run_id).localeCompare(String(b.imported_evidence?.paymentId||b.run_id)))
  return [
   ['Source','Run or imported payment','Employee ID','Pay date','Status','Federal income withholding','Maryland income withholding','Social Security employee and employer','Medicare employee and employer','Employer FUTA','Employer Maryland UI','Employee taxes','Employer taxes','Total calculated tax liability','Imported review ID','Imported source fingerprint','Payment and filing status'],
   ...rows.map(row=>{
    const federal=BigInt(row.federal_income),maryland=BigInt(row.maryland),ss=BigInt(row.social_security),medicare=BigInt(row.medicare),additional=BigInt(row.additional_medicare),employerSs=BigInt(row.employer_social_security??row.social_security),employerMedicare=BigInt(row.employer_medicare??row.medicare),futa=BigInt(row.futa),ui=BigInt(row.md_ui)
    const employeeTax=federal+maryland+ss+medicare+additional,employerTax=employerSs+employerMedicare+futa+ui
    return [row.imported_evidence?'IMPORTED':'NATIVE',row.imported_evidence?.paymentId||row.run_id,row.employee_id,day(row.payment_date),row.imported_evidence?'IMPORTED_PAID':row.status,...[federal,maryland,ss+employerSs,medicare+employerMedicare+additional,futa,ui,employeeTax,employerTax,employeeTax+employerTax].map(money),row.imported_evidence?.reviewId||'',row.imported_evidence?.sourceFingerprint||'',row.status==='APPROVED'?'Approved unpaid reservation; not a paid tax liability':'Reconcile separately with agency deposits and accepted returns']
   }),
  ]
 })
}
