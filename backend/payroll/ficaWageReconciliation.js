import {PAYROLL_TAX_REFERENCE} from './payrollEngine.js'
import {compensationEvidence} from './employmentCompensation.js'
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
const amount=value=>value!==null&&value!==undefined&&/^[0-9]+$/.test(String(value))&&Number.isSafeInteger(Number(value))
export function reconcileFicaWageRows(rows){
 const employees=new Map(),seen=new Set()
 for(const row of rows){
  const id=String(row.employee_id),key=`${row.run_id}:${id}`
  if(!employees.has(id))employees.set(id,{verified:0,issues:[],socialSecurity:0n,medicare:0n,additionalMedicare:0n})
  const result=employees.get(id),fail=message=>{result.issues.push(`Payroll ${row.run_id}: ${message}`)}
  if(seen.has(key)){fail('duplicate payroll evidence');continue}seen.add(key)
  const matches=(Array.isArray(row.calculation_snapshot?.employees)?row.calculation_snapshot.employees:[]).filter(e=>String(e.employeeId)===id),frozen=matches[0],basis=frozen?.ficaWageBasis
  if(!basis){fail('retained wage basis missing');continue}
  if(matches.length!==1||basis.version!==1||!same(basis,row.statement_snapshot?.ficaWageBasis)){fail('payroll and statement wage bases differ');continue}
  const keys=['grossWagesCents','socialSecurityTaxableCents','medicareTaxableCents','additionalMedicareTaxableCents']
  const physical=['regular_pay_cents','overtime_pay_cents','other_taxable_pay_cents','social_security_tax_cents','medicare_tax_cents','additional_medicare_tax_cents']
  if(keys.some(k=>!amount(basis[k]))||physical.some(k=>!amount(row[k]))){fail('invalid wage or tax amounts');continue}
  const gross=Number(row.regular_pay_cents)+Number(row.overtime_pay_cents)+Number(row.other_taxable_pay_cents)
  if(!Number.isSafeInteger(gross)||basis.grossWagesCents!==gross||frozen.grossPayCents!==gross){fail('gross wages do not reconcile');continue}
  if(row.run_kind==='OFF_CYCLE_REIMBURSEMENT'){
   if(basis.calculationReference!=='verified-accountable-reimbursement-no-wages'||keys.some(k=>basis[k]!==0)){fail('reimbursement contains taxable wages');continue}
  }else{
   const ref=PAYROLL_TAX_REFERENCE,ytd=basis.ytdWagesBeforeCents
   if(basis.calculationReference!==ref.version||new Date(row.payment_date).getUTCFullYear()!==ref.effectiveYear||!amount(ytd)||!Number.isSafeInteger(Number(ytd)+gross)||basis.socialSecurityWageBaseCents!==ref.socialSecurityWageBaseCents||basis.additionalMedicareThresholdCents!==ref.additionalMedicareWithholdingThresholdCents){fail('unsupported retained calculation basis');continue}
   if(basis.socialSecurityTaxableCents!==Math.min(gross,Math.max(0,ref.socialSecurityWageBaseCents-ytd))||basis.medicareTaxableCents!==gross||basis.additionalMedicareTaxableCents!==Math.max(0,Number(ytd)+gross-ref.additionalMedicareWithholdingThresholdCents)-Math.max(0,ytd-ref.additionalMedicareWithholdingThresholdCents)){fail('retained wage bases do not reconcile');continue}
  }
  if(Math.round(basis.socialSecurityTaxableCents*PAYROLL_TAX_REFERENCE.socialSecurityEmployeeRate)!==Number(row.social_security_tax_cents)||Math.round(basis.medicareTaxableCents*PAYROLL_TAX_REFERENCE.medicareEmployeeRate)!==Number(row.medicare_tax_cents)||Math.round(basis.additionalMedicareTaxableCents*PAYROLL_TAX_REFERENCE.additionalMedicareEmployeeRate)!==Number(row.additional_medicare_tax_cents)){fail('posted taxes do not reconcile to retained wages');continue}
  result.verified++;result.socialSecurity+=BigInt(basis.socialSecurityTaxableCents);result.medicare+=BigInt(basis.medicareTaxableCents);result.additionalMedicare+=BigInt(basis.additionalMedicareTaxableCents)
 }
 return employees
}
