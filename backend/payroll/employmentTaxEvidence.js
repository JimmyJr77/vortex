import {health125EmploymentTaxes} from './health125EmploymentTaxes.js'
import {healthPremiumWageEvidence} from './healthPremiumWageEvidence.js'
import {compensationEvidence} from './employmentCompensation.js'
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
export function verifyEmploymentTaxEvidence(row){
 const matches=(row.calculation_snapshot?.employees||[]).filter(e=>String(e.employeeId)===String(row.employee_id)),frozen=matches[0]
 const explicit=matches.some(e=>e.health125||e.health125EmploymentTaxes||e.ficaWageBasis?.employmentWageMode==='SEPARATE_YTD')||row.statement_snapshot?.health125EmploymentTaxes||row.statement_snapshot?.ficaWageBasis?.employmentWageMode==='SEPARATE_YTD'
 if(!explicit)return null
 const fail=()=>{throw Object.assign(new Error('Reconcile retained employment tax rates, taxable wages and posted amounts before continuing payroll or tax reporting.'),{status:409})}
 try{
  if(matches.length!==1||!['APPROVED','FINALIZED'].includes(row.status))fail()
  const retained=frozen.health125EmploymentTaxes,basis=frozen.incomeTaxWageBasis
  if(!retained||row.status==='FINALIZED'&&!same(retained,row.statement_snapshot?.health125EmploymentTaxes))fail()
  const health=healthPremiumWageEvidence(frozen)
  const expected=health125EmploymentTaxes({grossCents:frozen.grossPayCents,annualBonusCents:(frozen.payItems||[]).filter(i=>i.kind==='BONUS'&&i.bonusReview?.paymentType==='ANNUAL_LUMP_SUM').reduce((n,i)=>n+i.amountCents,0),health125:health||undefined,retirement:frozen.retirement401k,year:basis?.year,workState:basis?.workState,residenceState:basis?.residenceState,ytd:frozen.ficaWageBasis?.ytdTaxWages,employerTaxConfig:retained.employerTaxConfig})
  if(!same(expected,retained))fail()
  for(const key of ['futaWagesCents','mdUiWagesCents','futaTaxCents','mdUiTaxCents','employerSocialSecurityTaxCents','employerMedicareTaxCents'])if(frozen[key]!==expected[key])fail()
  for(const [column,key] of [['futa_tax_cents','futaTaxCents'],['md_ui_tax_cents','mdUiTaxCents'],['social_security_tax_cents','socialSecurityTaxCents'],['medicare_tax_cents','medicareTaxCents'],['additional_medicare_tax_cents','additionalMedicareTaxCents']])if(row[column]===null||row[column]===undefined||!/^\d+$/.test(String(row[column]))||Number(row[column])!==expected[key])fail()
  return expected
 }catch{fail()}
}
