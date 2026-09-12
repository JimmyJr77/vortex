import test from 'node:test'
import assert from 'node:assert/strict'
import {buildEmployeePreview,buildPayrollPreview} from '../payrollEngine.js'
const input={
 employee:{id:1,payType:'HOURLY',hourlyRateCents:5000,w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE',workState:'MD',residenceState:'MD'},
 entries:[{clockIn:'2026-09-07T09:00:00Z',clockOut:'2026-09-09T01:00:00Z',unpaidBreakMinutes:0,status:'APPROVED'}],
 taxElection:{verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},
}
const treatment={planType:'STANDARD_401K',pretaxCents:10000,rothCents:5000,pretaxAnnualBonusCents:0}
test('payroll applies distinct retirement deductions once and retains gross FICA with reduced income tax wages',()=>{
 const base=buildEmployeePreview(input),pay=buildEmployeePreview({...input,retirement401k:treatment})
 assert.equal(base.grossPayCents,200000)
 assert.equal(pay.pretaxDeductionCents,10000);assert.equal(pay.posttaxDeductionCents,5000);assert.equal(pay.totalDeductionCents,15000)
 assert.equal(pay.federalIncomeTaxCents,13717);assert.equal(pay.stateIncomeTaxCents,12919)
 assert.equal(pay.incomeTaxWageBasis.federalWagesCents,190000)
 for(const key of ['socialSecurityTaxCents','medicareTaxCents','additionalMedicareTaxCents','employerSocialSecurityTaxCents','employerMedicareTaxCents'])assert.equal(pay[key],base[key])
 assert.deepEqual(pay.ficaWageBasis,base.ficaWageBasis)
 assert.equal(pay.netPayCents,200000-15000-13717-12919-pay.socialSecurityTaxCents-pay.medicareTaxCents-pay.additionalMedicareTaxCents)
 assert.equal(pay.payItems.filter(i=>i.kind.startsWith('RETIREMENT_')).reduce((sum,i)=>sum+i.amountCents,0),15000)
 assert.equal(pay.retirement401k.futaWagesCents,200000);assert.equal(pay.retirement401k.marylandUnemploymentWagesCents,200000)
 assert.equal(base.retirement401k,undefined)
 const roth=buildEmployeePreview({...input,retirement401k:{...treatment,pretaxCents:0,rothCents:15000}})
 assert.equal(roth.federalIncomeTaxCents,base.federalIncomeTaxCents);assert.equal(roth.stateIncomeTaxCents,base.stateIncomeTaxCents);assert.equal(roth.netPayCents,base.netPayCents-15000)
})
test('retirement respects other deductions and cannot silently absorb malformed or unaffordable inputs',()=>{
 const adjustments=[{kind:'POSTTAX_DEDUCTION',name:'Authorized benefit',amountCents:2000,taxTreatmentVerified:true},{kind:'GARNISHMENT',name:'Reviewed order',amountCents:1000,taxTreatmentVerified:true}]
 const pay=buildEmployeePreview({...input,adjustments,retirement401k:treatment})
 assert.equal(pay.totalDeductionCents,18000);assert.equal(pay.posttaxDeductionCents,7000);assert.equal(pay.garnishmentCents,1000)
 const plain=buildEmployeePreview({...input,retirement401k:treatment});assert.equal(pay.netPayCents,plain.netPayCents-3000)
 for(const retirement401k of [null,{...treatment,pretaxCents:-1},{...treatment,rothCents:'5000'},{...treatment,planType:'403B'},{...treatment,pretaxAnnualBonusCents:1}]){
  const invalid=buildEmployeePreview({...input,retirement401k});assert.equal(invalid.netPayCents,null);assert.ok(invalid.warnings.some(w=>w.blocking&&w.code==='WITHHOLDING_ENGINE_NOT_CONFIGURED'))
 }
 const excessive=buildEmployeePreview({...input,retirement401k:{...treatment,pretaxCents:0,rothCents:200000}})
 assert.ok(excessive.warnings.some(w=>w.blocking&&w.code==='NEGATIVE_NET_PAY'))
 const generic=buildEmployeePreview({...input,retirement401k:treatment,adjustments:[{kind:'PRETAX_DEDUCTION',amountCents:1000,taxTreatmentVerified:true}]})
 assert.equal(generic.netPayCents,null)
})

test('payroll summary isolates participant deductions and reconciles totals across employees',()=>{
 const employees=[{...input.employee,taxElection:input.taxElection},{...input.employee,id:2,taxElection:input.taxElection}]
 const preview=buildPayrollPreview({settings:{payFrequency:'SEMIMONTHLY'},employees,entries:employees.flatMap(e=>input.entries.map(row=>({...row,employeeId:e.id}))),retirement401kByEmployee:{1:treatment}})
 assert.equal(preview.deductionCents,15000)
 assert.equal(preview.employees[1].retirement401k,undefined)
 assert.equal(preview.netPayCents,preview.grossPayCents-preview.employeeTaxCents-preview.deductionCents)
 assert.equal(preview.employees[0].netPayCents,buildEmployeePreview({...input,retirement401k:treatment}).netPayCents)
})
test('payroll retains the reviewed pretax allocation between regular wages and annual bonus',()=>{
 const pay=buildEmployeePreview({...input,adjustments:[{kind:'BONUS',name:'Annual bonus',amountCents:50000,taxTreatmentVerified:true,bonusReview:{paymentType:'ANNUAL_LUMP_SUM',verifiedAt:'2026-09-11T12:00:00Z'}}],retirement401k:{...treatment,pretaxAnnualBonusCents:4000}})
 assert.equal(pay.grossPayCents,250000)
 assert.equal(pay.incomeTaxWageBasis.marylandAnnualBonusWagesCents,46000)
 assert.equal(pay.incomeTaxWageBasis.marylandRegularWagesCents,194000)
 assert.equal(pay.retirement401k.pretaxAnnualBonusCents,4000)
 assert.equal(pay.totalDeductionCents,15000)
 assert.equal(pay.netPayCents,pay.grossPayCents-pay.totalDeductionCents-pay.federalIncomeTaxCents-pay.stateIncomeTaxCents-pay.socialSecurityTaxCents-pay.medicareTaxCents-pay.additionalMedicareTaxCents)
})

test('retirement compensation is derived from engine earnings and excludes reimbursements and deductions',async()=>{
 const {retirementPayrollWages}=await import('../retirementPayrollWages.js')
 const plan={compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true}}
 const pay=buildEmployeePreview({...input,adjustments:[
  {kind:'BONUS',name:'Annual award',amountCents:50000,taxTreatmentVerified:true,bonusReview:{classification:'DISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',verifiedAt:'2026-09-11T12:00:00Z'}},
  {kind:'BONUS_OVERTIME',amountCents:500,taxTreatmentVerified:true},
  {kind:'PAID_LEAVE',amountCents:5000,minutes:60,taxTreatmentVerified:true},
  {kind:'REIMBURSEMENT',amountCents:10000,taxTreatmentVerified:true},
  {kind:'POSTTAX_DEDUCTION',amountCents:2000,taxTreatmentVerified:true},
 ]})
 const wages=retirementPayrollWages(pay,plan)
 assert.deepEqual(wages,{compensation:{REGULAR:200000,OVERTIME:500,BONUS:50000,PAID_LEAVE:5000},compensation415Cents:255500,annualBonusCents:50000})
 assert.throws(()=>retirementPayrollWages({...pay,grossPayCents:255501},plan),/do not reconcile/)
 assert.throws(()=>retirementPayrollWages(buildEmployeePreview({...input,retirement401k:treatment}),plan),/before applying/)
 for(const kind of ['LEAVE_PAYOUT','WAGE_CORRECTION','UNKNOWN_EARNING'])assert.throws(()=>retirementPayrollWages({...pay,payItems:[...pay.payItems,{kind,amountCents:1}]},plan),/wage allocation/)
 assert.throws(()=>retirementPayrollWages({...pay,warnings:[{blocking:true}]},plan),/blockers/)
})
test('salary-covered leave cannot silently inherit different plan inclusion rules',async()=>{
 const {retirementPayrollWages}=await import('../retirementPayrollWages.js')
 const salary={...buildEmployeePreview(input),payItems:[{kind:'PAID_LEAVE',includedInSalary:true,amountCents:0,minutes:60}]}
 const plan={compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true}}
 assert.equal(retirementPayrollWages(salary,plan).compensation.REGULAR,200000)
 assert.throws(()=>retirementPayrollWages(salary,{compensation:{...plan.compensation,PAID_LEAVE:false}}),/salary-covered leave/)
})
