import {retirementStatementSummary} from './retirementStatement.js'
import {retirement401kTaxWages} from './retirement401kTaxWages.js'
import {incomeTaxReviewSource} from './incomeTaxBasisReview.js'
import {compensationEvidence} from './employmentCompensation.js'
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
const cents=value=>value!==null&&value!==undefined&&/^\d+$/.test(String(value))&&Number.isSafeInteger(Number(value))
export function reconcileIncomeTaxWageRows(rows){
 const results=new Map(),seen=new Set()
 for(const row of rows){
  const id=String(row.employee_id),key=`${row.run_id}:${id}`
  if(!results.has(id))results.set(id,{verified:0,federal:0n,maryland:0n,issues:[]})
  const result=results.get(id),fail=message=>result.issues.push(`Payroll ${row.run_id}: ${message}`)
  if(seen.has(key)){fail('duplicate income-tax wage evidence');continue}seen.add(key)
  if(row.reviewed_income_basis){
   const review=row.reviewed_income_basis
   try{
    const current=incomeTaxReviewSource(row)
    if(Number(review.facility_id)!==Number(row.facility_id)||Number(review.run_employee_id)!==Number(row.id)||review.source_fingerprint!==current.fingerprint||!same(review.source_snapshot,current.source)||typeof review.evidence_reference!=='string'||review.evidence_reference.trim().length<12||[review.federal_wages_cents,review.maryland_wages_cents].some(value=>!cents(value)||Number(value)>current.source.grossWagesCents))throw new Error('saved income-tax wage review is stale or inconsistent')
    result.verified++;result.reviewed=(result.reviewed||0)+1;result.federal+=BigInt(review.federal_wages_cents);result.maryland+=BigInt(review.maryland_wages_cents)
   }catch{fail('saved income-tax wage review is stale or inconsistent')}
   continue
  }
  const matches=(Array.isArray(row.calculation_snapshot?.employees)?row.calculation_snapshot.employees:[]).filter(e=>String(e?.employeeId)===id),frozen=matches[0]
  if(matches.length!==1){fail('missing or duplicate employee calculation');continue}
  const fields=['regular_pay_cents','overtime_pay_cents','other_taxable_pay_cents','federal_income_tax_cents','state_income_tax_cents']
  if(fields.some(k=>!cents(row[k]))){fail('invalid posted wages or withholding');continue}
  const gross=Number(row.regular_pay_cents)+Number(row.overtime_pay_cents)+Number(row.other_taxable_pay_cents)
  if(!Number.isSafeInteger(gross)||gross!==frozen.grossPayCents){fail('gross wages do not reconcile');continue}
  if(row.run_kind==='OFF_CYCLE_REIMBURSEMENT'){
   const basis=frozen.ficaWageBasis
   if(gross!==0||Number(row.federal_income_tax_cents)!==0||Number(row.state_income_tax_cents)!==0||basis?.calculationReference!=='verified-accountable-reimbursement-no-wages'||basis.grossWagesCents!==0||!same(basis,row.statement_snapshot?.ficaWageBasis)){fail('non-wage reimbursement evidence does not reconcile');continue}
   result.verified++;continue
  }
  const basis=frozen.incomeTaxWageBasis
  if(!basis||!row.statement_snapshot?.incomeTaxWageBasis){fail('income-tax wage basis missing or manually changed');continue}
  if(!same(basis,row.statement_snapshot.incomeTaxWageBasis)||basis.version!==1||basis.source!=='NATIVE_ENGINE'||basis.year!==2026||new Date(row.payment_date).getUTCFullYear()!==2026||basis.workState!=='MD'||basis.residenceState!=='MD'){fail('unsupported or inconsistent income-tax wage basis');continue}
  let incomeGross=gross
  if(basis.retirement401k){
   try{
    const summary=retirementStatementSummary(frozen)
    const annualBonusCents=(frozen.payItems||[]).filter(i=>i.kind==='BONUS'&&i.bonusReview?.paymentType==='ANNUAL_LUMP_SUM').reduce((sum,i)=>sum+i.amountCents,0)
    const expected=retirement401kTaxWages({...basis.retirement401k,grossCents:gross,annualBonusCents,year:basis.year,workState:basis.workState,residenceState:basis.residenceState})
    if(!summary||!same(summary,row.statement_snapshot.retirement)||!same(expected,basis.retirement401k)||!same(expected,frozen.retirement401k)||!cents(row.pretax_deduction_cents)||Number(row.pretax_deduction_cents)!==expected.pretaxCents||frozen.pretaxDeductionCents!==expected.pretaxCents||basis.pretaxDeductionCents!==expected.pretaxCents||basis.marylandRegularWagesCents!==expected.marylandRegularWagesCents||basis.marylandAnnualBonusWagesCents!==expected.marylandAnnualBonusWagesCents)throw new Error('mismatch')
    incomeGross=expected.federalWagesCents
   }catch{fail('retirement income-tax wage evidence does not reconcile');continue}
  }else if(basis.pretaxDeductionCents!==0||Number(row.pretax_deduction_cents||0)!==0||frozen.retirement401k||frozen.retirementPlans?.length||frozen.payItems?.some(i=>i.kind?.startsWith('RETIREMENT_'))){fail('unsupported pretax or missing retirement wage evidence');continue}
  if(['grossWagesCents','federalWagesCents','marylandWagesCents','marylandRegularWagesCents','marylandAnnualBonusWagesCents'].some(k=>!Number.isSafeInteger(basis[k])||basis[k]<0)||basis.grossWagesCents!==gross||basis.federalWagesCents!==incomeGross||basis.marylandWagesCents!==incomeGross||basis.marylandRegularWagesCents+basis.marylandAnnualBonusWagesCents!==incomeGross){fail('income-tax wage inputs do not reconcile');continue}
  if(frozen.federalIncomeTaxCents!==Number(row.federal_income_tax_cents)||frozen.stateIncomeTaxCents!==Number(row.state_income_tax_cents)){fail('posted withholding differs from retained calculation');continue}
  result.verified++;result.federal+=BigInt(basis.federalWagesCents);result.maryland+=BigInt(basis.marylandWagesCents)
 }
 return results
}
