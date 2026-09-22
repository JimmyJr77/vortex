import {healthPremiumWageEvidence} from './healthPremiumWageEvidence.js'
import {PAYROLL_TAX_REFERENCE} from './payrollEngine.js'
import {compensationEvidence} from './employmentCompensation.js'
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
const amount=value=>value!==null&&value!==undefined&&/^[0-9]+$/.test(String(value))&&Number.isSafeInteger(Number(value))
export function reconcileFicaWageRows(rows){return reconcileFicaWageEvidence(rows,false)}
export function reconcileApprovedFicaWageRows(rows){return reconcileFicaWageEvidence(rows,true)}
function reconcileFicaWageEvidence(rows,approved){
 const employees=new Map(),seen=new Set()
 for(const row of rows){
  const id=String(row.employee_id),key=`${row.run_id}:${id}`
  if(!employees.has(id))employees.set(id,{verified:0,issues:[],socialSecurity:0n,medicare:0n,additionalMedicare:0n})
  const result=employees.get(id),fail=message=>{result.issues.push(`Payroll ${row.run_id}: ${message}`)}
  if(approved&&row.status!=='APPROVED'){fail('payroll is not an approved reservation');continue}
  if(seen.has(key)){fail('duplicate payroll evidence');continue}seen.add(key)
  const matches=(Array.isArray(row.calculation_snapshot?.employees)?row.calculation_snapshot.employees:[]).filter(e=>String(e.employeeId)===id),frozen=matches[0],basis=frozen?.ficaWageBasis
  if(!basis){fail('retained wage basis missing');continue}
  if(matches.length!==1||basis.version!==1||(!approved&&!same(basis,row.statement_snapshot?.ficaWageBasis))){fail('payroll and statement wage bases differ');continue}
  const keys=['grossWagesCents','socialSecurityTaxableCents','medicareTaxableCents','additionalMedicareTaxableCents']
  const physical=['regular_pay_cents','overtime_pay_cents','other_taxable_pay_cents','social_security_tax_cents','medicare_tax_cents','additional_medicare_tax_cents']
  if(keys.some(k=>!amount(basis[k]))||physical.some(k=>!amount(row[k]))){fail('invalid wage or tax amounts');continue}
  const gross=Number(row.regular_pay_cents)+Number(row.overtime_pay_cents)+Number(row.other_taxable_pay_cents)
  if(!Number.isSafeInteger(gross)||basis.grossWagesCents!==gross||frozen.grossPayCents!==gross){fail('gross wages do not reconcile');continue}
  let health
  try{health=healthPremiumWageEvidence(frozen)}catch{fail('health wage evidence does not reconcile');continue}
  if(!!health!==!!basis.health125){fail('health FICA wage basis is missing or inconsistent');continue}
  if(row.run_kind==='OFF_CYCLE_REIMBURSEMENT'){
   if(basis.calculationReference!=='verified-accountable-reimbursement-no-wages'||keys.some(k=>basis[k]!==0)){fail('reimbursement contains taxable wages');continue}
  }else{
   const ref=PAYROLL_TAX_REFERENCE,ytd=basis.ytdWagesBeforeCents
   if(basis.calculationReference!==ref.version||new Date(row.payment_date).getUTCFullYear()!==ref.effectiveYear||!amount(ytd)||!Number.isSafeInteger(Number(ytd)+gross)||basis.socialSecurityWageBaseCents!==ref.socialSecurityWageBaseCents||basis.additionalMedicareThresholdCents!==ref.additionalMedicareWithholdingThresholdCents){fail('unsupported retained calculation basis');continue}
   if(health||basis.employmentWageMode==='SEPARATE_YTD'){
    const wages=health||{socialSecurityWagesCents:gross,medicareWagesCents:gross,futaWagesCents:gross,marylandUnemploymentWagesCents:gross}
    const history=basis.ytdTaxWages,keys=['socialSecurityWagesCents','medicareWagesCents','futaWagesCents','marylandUnemploymentWagesCents']
    if(health&&!same(health,basis.health125)||keys.some(k=>!amount(history?.[k])||!Number.isSafeInteger(Number(history[k])+wages[k]))){fail('separate health taxable wage history is missing');continue}
    const ss=Math.min(wages.socialSecurityWagesCents,Math.max(0,ref.socialSecurityWageBaseCents-history.socialSecurityWagesCents)),medicare=wages.medicareWagesCents,additional=Math.max(0,Number(history.medicareWagesCents)+medicare-ref.additionalMedicareWithholdingThresholdCents)-Math.max(0,history.medicareWagesCents-ref.additionalMedicareWithholdingThresholdCents)
    if(basis.socialSecurityTaxableCents!==ss||basis.medicareTaxableCents!==medicare||basis.additionalMedicareTaxableCents!==additional){fail('health FICA taxable wages do not reconcile');continue}
   }else if(basis.socialSecurityTaxableCents!==Math.min(gross,Math.max(0,ref.socialSecurityWageBaseCents-ytd))||basis.medicareTaxableCents!==gross||basis.additionalMedicareTaxableCents!==Math.max(0,Number(ytd)+gross-ref.additionalMedicareWithholdingThresholdCents)-Math.max(0,ytd-ref.additionalMedicareWithholdingThresholdCents)){fail('retained wage bases do not reconcile');continue}
  }
  const round=(value,rate,integerRate)=>(health||basis.employmentWageMode==='SEPARATE_YTD')?Number((BigInt(value)*integerRate+5000n)/10000n):Math.round(value*rate)
  if(round(basis.socialSecurityTaxableCents,PAYROLL_TAX_REFERENCE.socialSecurityEmployeeRate,620n)!==Number(row.social_security_tax_cents)||round(basis.medicareTaxableCents,PAYROLL_TAX_REFERENCE.medicareEmployeeRate,145n)!==Number(row.medicare_tax_cents)||round(basis.additionalMedicareTaxableCents,PAYROLL_TAX_REFERENCE.additionalMedicareEmployeeRate,90n)!==Number(row.additional_medicare_tax_cents)){fail('posted taxes do not reconcile to retained wages');continue}
  result.verified++;result.socialSecurity+=BigInt(basis.socialSecurityTaxableCents);result.medicare+=BigInt(basis.medicareTaxableCents);result.additionalMedicare+=BigInt(basis.additionalMedicareTaxableCents)
 }
 return employees
}
