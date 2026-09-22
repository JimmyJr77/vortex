import {verifyEmploymentTaxEvidence} from '../employmentTaxEvidence.js'
import {employmentTaxWageHistory} from '../employmentTaxWageHistory.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {buildEmployeePreview} from '../payrollEngine.js'
import {retirementStatementSummary} from '../retirementStatement.js'
import {reconcileIncomeTaxWageRows,reconcileApprovedIncomeTaxWageRows} from '../incomeTaxWageReconciliation.js'
import {reconcileFicaWageRows,reconcileApprovedFicaWageRows} from '../ficaWageReconciliation.js'
function fixture(retirement=false,history=null,withHealth=true){
 const frozen=buildEmployeePreview({employee:{id:1,payType:'HOURLY',hourlyRateCents:25000,workState:'MD',residenceState:'MD',w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE'},entries:[{clockIn:'2026-09-09T12:00:00Z',clockOut:'2026-09-09T20:00:00Z',unpaidBreakMinutes:0,status:'APPROVED'}],taxElection:{verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},employerTaxConfig:{year:2026,verified:true,futaRatePercent:.6,mdUiRatePercent:2.6},health125:withHealth?{version:1,classification:'SECTION125_ACCIDENT_HEALTH_PREMIUM',items:[{planId:'medical',optionId:'family',deductionCents:12500,annualBonusDeductionCents:0,qualificationFingerprint:'a'.repeat(64),authorizationFingerprint:'b'.repeat(64)}]}:undefined,ytdTaxWages:history||{socialSecurityWagesCents:18400000,medicareWagesCents:19900000,futaWagesCents:690000,marylandUnemploymentWagesCents:825000},...(retirement?{retirement401k:{planType:'STANDARD_401K',pretaxCents:10000,rothCents:5000,pretaxAnnualBonusCents:0}}:{})})
 if(retirement)frozen.retirementPlans=[{planId:'standard',calculation:{requiresPayrollIntegration:false,ordinary:{pretax:10000,roth:5000},catchUp:{pretax:0,roth:0},pretaxCents:10000,rothCents:5000,totalCents:15000}}]
 return {run_id:1,employee_id:1,status:'FINALIZED',run_kind:'REGULAR',payment_date:'2026-09-18',futa_tax_cents:frozen.futaTaxCents,md_ui_tax_cents:frozen.mdUiTaxCents,regular_pay_cents:frozen.regularPayCents,overtime_pay_cents:0,other_taxable_pay_cents:0,pretax_deduction_cents:frozen.pretaxDeductionCents,federal_income_tax_cents:frozen.federalIncomeTaxCents,state_income_tax_cents:frozen.stateIncomeTaxCents,social_security_tax_cents:frozen.socialSecurityTaxCents,medicare_tax_cents:frozen.medicareTaxCents,additional_medicare_tax_cents:frozen.additionalMedicareTaxCents,calculation_snapshot:{employees:[frozen]},statement_snapshot:{health125EmploymentTaxes:structuredClone(frozen.health125EmploymentTaxes),incomeTaxWageBasis:structuredClone(frozen.incomeTaxWageBasis),ficaWageBasis:structuredClone(frozen.ficaWageBasis),...(retirement?{retirement:retirementStatementSummary(frozen)}:{})}}
}
for(const retirement of [false,true])test(`health wage reconciliation retains correct distinct income and FICA bases; retirement=${retirement}`,()=>{
 const row=fixture(retirement)
 assert.deepEqual(reconcileIncomeTaxWageRows([row]).get('1'),{verified:1,federal:retirement?177500n:187500n,maryland:retirement?177500n:187500n,issues:[]})
 assert.deepEqual(reconcileFicaWageRows([row]).get('1'),{verified:1,socialSecurity:50000n,medicare:187500n,additionalMedicare:87500n,issues:[]})
 assert.equal(row.additional_medicare_tax_cents,788)
 assert.equal(verifyEmploymentTaxEvidence(row).additionalMedicareTaxCents,788)
 assert.equal(verifyEmploymentTaxEvidence({...row,status:'APPROVED',statement_snapshot:null}).additionalMedicareTaxCents,788)
 for(const mutate of [r=>r.futa_tax_cents++,r=>r.md_ui_tax_cents++,r=>{delete r.calculation_snapshot.employees[0].health125EmploymentTaxes.employerTaxConfig},r=>r.calculation_snapshot.employees[0].health125EmploymentTaxes.employerTaxConfig.futaRatePercent++,r=>r.statement_snapshot.health125EmploymentTaxes.ytd.futaWagesCents++]){const invalid=structuredClone(row);mutate(invalid);assert.throws(()=>verifyEmploymentTaxEvidence(invalid),/employment tax/)}

 assert.equal(reconcileApprovedFicaWageRows([{...row,status:'APPROVED',statement_snapshot:null}]).get('1').verified,1)
 for(const status of ['DRAFT','FINALIZED'])assert.equal(reconcileApprovedFicaWageRows([{...row,status,statement_snapshot:null}]).get('1').verified,0)
 assert.equal(reconcileApprovedIncomeTaxWageRows([{...row,status:'APPROVED',statement_snapshot:null}]).get('1').verified,1)
 for(const mutate of [r=>r.pretax_deduction_cents++,r=>r.calculation_snapshot.employees[0].payItems.push(structuredClone(r.calculation_snapshot.employees[0].payItems.find(i=>i.kind==='HEALTH_SECTION125_PRETAX'))),r=>{delete r.calculation_snapshot.employees[0].health125},r=>r.calculation_snapshot.employees[0].health125.items[0].deductionCents++]){
  const changed=structuredClone(row);mutate(changed);assert.equal(reconcileIncomeTaxWageRows([changed]).get('1').verified,0)
 }
 for(const mutate of [r=>r.additional_medicare_tax_cents--,r=>{delete r.calculation_snapshot.employees[0].ficaWageBasis.ytdTaxWages},r=>{const b=r.calculation_snapshot.employees[0].ficaWageBasis;b.medicareTaxableCents=200000;r.statement_snapshot.ficaWageBasis=structuredClone(b)},r=>r.calculation_snapshot.employees[0].payItems.pop()]){
  const changed=structuredClone(row);mutate(changed);assert.equal(reconcileFicaWageRows([changed]).get('1').verified,0)
 }
})

test('taxable history preserves uncapped health wages, approved reservations and employee scope',()=>{
 const zero={socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0,marylandUnemploymentWagesCents:0}
 const row=fixture(true,zero),next=fixture(true,Object.fromEntries(Object.keys(zero).map(key=>[key,187500])),false);next.run_id=2;next.status='APPROVED';next.statement_snapshot=null;next.payment_date='2026-09-25'
 const options={employeeId:1,year:2026,paymentDate:'2026-09-30'}
 const result=employmentTaxWageHistory([next,row],options)
 assert.deepEqual(result.ytd,{socialSecurityWagesCents:387500,medicareWagesCents:387500,futaWagesCents:387500,marylandUnemploymentWagesCents:387500})
 assert.equal(result.evidence[0].runId,'1');assert.equal(result.evidence[1].status,'APPROVED')
 assert.equal(employmentTaxWageHistory([row,next],{...options,excludedRunId:2}).ytd.socialSecurityWagesCents,187500)
 assert.equal(employmentTaxWageHistory([],options).ytd.medicareWagesCents,0)
 for(const patch of [{status:'VOID'},{employee_id:2},{payment_date:'2027-01-01'},{payment_date:'2026-10-01'},{statement_snapshot:null},{medicare_tax_cents:0}])assert.throws(()=>employmentTaxWageHistory([{...row,...patch}],options),/Reconcile/)
 assert.throws(()=>employmentTaxWageHistory([row,row],options),/duplicate/)
 assert.throws(()=>employmentTaxWageHistory([fixture()],options),/complete committed history/)
})
