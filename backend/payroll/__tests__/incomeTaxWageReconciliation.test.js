import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcileIncomeTaxWageRows} from '../incomeTaxWageReconciliation.js'
test('income wage reconciliation requires consistent source, statement, wage and withholding evidence',()=>{
 const basis={version:1,source:'NATIVE_ENGINE',year:2026,workState:'MD',residenceState:'MD',grossWagesCents:100,federalWagesCents:100,marylandWagesCents:100,marylandRegularWagesCents:100,marylandAnnualBonusWagesCents:0,pretaxDeductionCents:0}
 const row={run_id:1,employee_id:1,run_kind:'REGULAR',payment_date:'2026-09-18',regular_pay_cents:100,overtime_pay_cents:0,other_taxable_pay_cents:0,federal_income_tax_cents:0,state_income_tax_cents:0,calculation_snapshot:{employees:[{employeeId:1,grossPayCents:100,federalIncomeTaxCents:0,stateIncomeTaxCents:0,incomeTaxWageBasis:basis}]},statement_snapshot:{incomeTaxWageBasis:basis}}
 const check=rows=>reconcileIncomeTaxWageRows(rows).get('1')
 assert.deepEqual(check([row]),{verified:1,federal:100n,maryland:100n,issues:[]})
 for(const changed of [{...row,statement_snapshot:{}},{...row,federal_income_tax_cents:null},{...row,state_income_tax_cents:1},{...row,payment_date:'2027-09-18'},{...row,calculation_snapshot:{employees:{}}}])assert.equal(check([changed]).verified,0)
 assert.match(check([row,row]).issues[0],/duplicate/)
 const changed=structuredClone(row);changed.calculation_snapshot.employees[0].incomeTaxWageBasis.federalWagesCents=99;changed.statement_snapshot.incomeTaxWageBasis=structuredClone(changed.calculation_snapshot.employees[0].incomeTaxWageBasis)
 assert.match(check([changed]).issues[0],/inputs do not reconcile/)
})

test('annual income wages accept only reconciled standard 401k payroll and employee statement evidence',async()=>{
 const {buildEmployeePreview}=await import('../payrollEngine.js'),{retirementStatementSummary}=await import('../retirementStatement.js')
 const frozen=buildEmployeePreview({employee:{id:1,payType:'HOURLY',hourlyRateCents:2500,w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE',workState:'MD',residenceState:'MD'},entries:[{clockIn:'2026-09-07T09:00:00Z',clockOut:'2026-09-09T01:00:00Z',status:'APPROVED',unpaidBreakMinutes:0}],taxElection:{verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},retirement401k:{planType:'STANDARD_401K',pretaxCents:10000,rothCents:5000,pretaxAnnualBonusCents:0}})
 frozen.retirementPlans=[{planId:'standard',calculation:{requiresPayrollIntegration:false,ordinary:{pretax:10000,roth:5000},catchUp:{pretax:0,roth:0},pretaxCents:10000,rothCents:5000,totalCents:15000}}]
 const row={run_id:1,employee_id:1,run_kind:'REGULAR',payment_date:'2026-09-18',regular_pay_cents:frozen.regularPayCents,overtime_pay_cents:0,other_taxable_pay_cents:0,pretax_deduction_cents:10000,federal_income_tax_cents:frozen.federalIncomeTaxCents,state_income_tax_cents:frozen.stateIncomeTaxCents,calculation_snapshot:{employees:[frozen]},statement_snapshot:{incomeTaxWageBasis:structuredClone(frozen.incomeTaxWageBasis),retirement:retirementStatementSummary(frozen)}}
 const check=r=>reconcileIncomeTaxWageRows([r]).get('1')
 assert.deepEqual(check(row),{verified:1,federal:90000n,maryland:90000n,issues:[]})
 for(const mutate of [r=>{r.pretax_deduction_cents=9999},r=>{delete r.statement_snapshot.retirement},r=>{r.statement_snapshot.retirement.plans[0].ordinaryRothCents++},r=>{r.calculation_snapshot.employees[0].retirementPlans[0].calculation.requiresPayrollIntegration=true},r=>{r.calculation_snapshot.employees[0].retirement401k.federalWagesCents++},r=>{const b=r.calculation_snapshot.employees[0].incomeTaxWageBasis;b.retirement401k.planType='403B';r.statement_snapshot.incomeTaxWageBasis=structuredClone(b)},r=>{const b=r.calculation_snapshot.employees[0].incomeTaxWageBasis;delete b.retirement401k;b.pretaxDeductionCents=0;r.statement_snapshot.incomeTaxWageBasis=structuredClone(b)}]){
  const changed=structuredClone(row);mutate(changed);assert.equal(check(changed).verified,0)
 }
 const second=structuredClone(row);second.run_id=2
 assert.equal(reconcileIncomeTaxWageRows([row,second]).get('1').federal,180000n)
})
