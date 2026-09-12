import test from 'node:test'
import assert from 'node:assert/strict'
import { federalWithholding2026, marylandWithholding2026, calculateWithholding2026 } from '../withholding2026.js'

const federal={filingStatus:'SINGLE'}
const maryland={filingStatus:'SINGLE',localRate:3.2,exemptions:1}
test('a newly signed Maryland certificate blocks use of previously verified elections',()=>{
 for(const payFrequency of ['WEEKLY','BIWEEKLY','SEMIMONTHLY','MONTHLY'])assert.throws(()=>calculateWithholding2026({grossPayCents:200000,election:{verified:true,federal,maryland,mw507ReviewRequired:'123'},payFrequency,year:2026,workState:'MD',residenceState:'MD'}),/latest employee-signed MW507/)
})
test('native exempt W-4 preserves blank filing status and is limited to supported payment dates',()=>{
 const exempt={filingStatus:null,exempt:true,multipleJobs:false,nonresidentAlien:false,lockInLetter:false}
 for(const periods of [12,24,26,52])assert.equal(federalWithholding2026(200000,exempt,periods),0)
 for(const override of [{exempt:false},{filingStatus:'INVALID'},{filingStatus:'__proto__'},{nonresidentAlien:true},{lockInLetter:true},{creditsCents:-1}])assert.throws(()=>federalWithholding2026(200000,{...exempt,...override}))
 const input={grossPayCents:200000,election:{verified:true,federal:exempt,maryland,w4Source:{effectiveOn:'2026-09-12'}},payFrequency:'SEMIMONTHLY',year:2026,workState:'MD',residenceState:'MD'}
 assert.equal(calculateWithholding2026({...input,paymentDate:'2026-09-12'}).federalIncomeTaxCents,0)
 assert.equal(calculateWithholding2026({...input,paymentDate:'2026-12-31'}).stateIncomeTaxCents,13714)
 for(const paymentDate of [undefined,'2026-09-11','2027-01-01','2026-02-30'])assert.throws(()=>calculateWithholding2026({...input,paymentDate}),/received date/)
})
test('Maryland snapshots separate base, bonus and additional withholding without changing total tax',()=>{
 const input={grossPayCents:200000,election:{verified:true,federal,maryland:{...maryland,extraWithholdingCents:250}},payFrequency:'SEMIMONTHLY',year:2026,workState:'MD',residenceState:'MD'}
 const regular=calculateWithholding2026(input),parts=regular.incomeTaxWageBasis.stateTaxComponents
 assert.equal(regular.stateIncomeTaxCents,13964)
 assert.equal(parts.regularBaseCents,13714);assert.equal(parts.annualBonusTaxCents,0)
 assert.equal(parts.requestedAdditionalCents,250);assert.equal(parts.appliedAdditionalCents,250);assert.equal(parts.totalCents,13964)
 assert.match(parts.electionFingerprint,/^[a-f0-9]{64}$/)
 const bonus=calculateWithholding2026({...input,hasBonus:true,annualBonusCents:50000,bonusReviewComplete:true})
 assert.equal(bonus.stateIncomeTaxCents,14839)
 assert.equal(bonus.incomeTaxWageBasis.stateTaxComponents.regularBaseCents,9739)
 assert.equal(bonus.incomeTaxWageBasis.stateTaxComponents.annualBonusTaxCents,4850)
 assert.equal(bonus.incomeTaxWageBasis.stateTaxComponents.appliedAdditionalCents,250)
 const exempt=calculateWithholding2026({...input,election:{...input.election,maryland:{...input.election.maryland,exempt:true}}})
 assert.equal(exempt.stateIncomeTaxCents,0);assert.equal(exempt.incomeTaxWageBasis.stateTaxComponents.requestedAdditionalCents,250);assert.equal(exempt.incomeTaxWageBasis.stateTaxComponents.appliedAdditionalCents,0)
 assert.notEqual(exempt.incomeTaxWageBasis.stateTaxComponents.electionFingerprint,parts.electionFingerprint)
 for(const payFrequency of ['WEEKLY','BIWEEKLY','SEMIMONTHLY','MONTHLY']){
  const small=calculateWithholding2026({...input,grossPayCents:100,payFrequency}),evidence=small.incomeTaxWageBasis.stateTaxComponents
  assert.equal(evidence.payFrequency,payFrequency);assert.equal(evidence.regularBaseCents,0);assert.equal(evidence.totalCents,250);assert.equal(small.stateIncomeTaxCents,250)
 }
})
test('2026 official worksheet examples calculated independently for $2,000 semimonthly wages',()=>{
 assert.equal(federalWithholding2026(200000,federal),14917)
 assert.equal(marylandWithholding2026(200000,maryland),13714)
 assert.equal(federalWithholding2026(200000,{...federal,multipleJobs:true}),25604)
 assert.equal(federalWithholding2026(200000,{...federal,creditsCents:240000,extraWithholdingCents:2500}),7417)
 assert.equal(federalWithholding2026(200000,{...federal,creditsCents:9999999}),0)
 assert.equal(federalWithholding2026(200000,{...federal,exempt:true}),0)
 assert.equal(marylandWithholding2026(20799,maryland),0)
 assert.equal(marylandWithholding2026(20799,{...maryland,extraWithholdingCents:500}),500)
})
test('unsupported or malformed elections fail closed, including exempt elections',()=>{
 assert.throws(()=>federalWithholding2026(200000,{...federal,nonresidentAlien:true}))
 assert.throws(()=>federalWithholding2026(200000,{...federal,exempt:true,creditsCents:-1}))
 assert.throws(()=>marylandWithholding2026(200000,{...maryland,exempt:true,extraWithholdingCents:-1}))
 assert.throws(()=>marylandWithholding2026(200000,{...maryland,localRate:3}))
 const args={grossPayCents:200000,election:{verified:true,federal,maryland},payFrequency:'SEMIMONTHLY',year:2026,workState:'MD',residenceState:'MD'}
 assert.equal(calculateWithholding2026(args).federalIncomeTaxCents,14917)
 for(const override of [{year:2027},{residenceState:'VA'},{payFrequency:'DAILY'},{pretaxDeductionCents:1},{hasBonus:true},{election:null}])assert.throws(()=>calculateWithholding2026({...args,...override}))
})

test('weekly, biweekly and monthly withholding use the published frequency deductions and brackets',()=>{
 const examples=[['WEEKLY',100000,6941,7808],['BIWEEKLY',200000,13882,15615],['MONTHLY',400000,27428,29833]]
 for(const [payFrequency,grossPayCents,expected,federalExpected] of examples){
  assert.equal(marylandWithholding2026(grossPayCents,maryland,payFrequency),expected)
  const result=calculateWithholding2026({grossPayCents,election:{verified:true,federal,maryland},payFrequency,year:2026,workState:'MD',residenceState:'MD'})
  assert.equal(result.stateIncomeTaxCents,expected)
  assert.equal(result.federalIncomeTaxCents,federalExpected)
  assert.match(result.method,new RegExp(payFrequency.toLowerCase()))
 }
 // Taxable income $2,000: weekly single uses the second bracket's printed base.
 assert.equal(marylandWithholding2026(212692,maryland,'WEEKLY'),15919)
 // Taxable income $6,000: biweekly joint uses the second bracket's printed base.
 assert.equal(marylandWithholding2026(625384,{...maryland,filingStatus:'JOINT'},'BIWEEKLY'),47759)
 for(const [frequency,threshold] of [['WEEKLY',9600],['BIWEEKLY',19200],['MONTHLY',41700]])assert.equal(marylandWithholding2026(threshold-1,{...maryland,extraWithholdingCents:500},frequency),500)
 assert.throws(()=>marylandWithholding2026(100000,maryland,'DAILY'))
})

test('native withholding retains wage inputs before credits, allowances and bonus rate calculations',()=>{
 const args={grossPayCents:200000,election:{verified:true,federal:{...federal,creditsCents:9999999},maryland},payFrequency:'SEMIMONTHLY',year:2026,workState:'MD',residenceState:'MD'}
 const ordinary=calculateWithholding2026(args)
 assert.equal(ordinary.federalIncomeTaxCents,0)
 assert.equal(ordinary.incomeTaxWageBasis.federalWagesCents,200000)
 assert.equal(ordinary.incomeTaxWageBasis.marylandWagesCents,200000)
 const bonus=calculateWithholding2026({...args,hasBonus:true,annualBonusCents:50000,bonusReviewComplete:true})
 assert.equal(bonus.incomeTaxWageBasis.marylandRegularWagesCents,150000)
 assert.equal(bonus.incomeTaxWageBasis.marylandAnnualBonusWagesCents,50000)
 assert.equal(bonus.incomeTaxWageBasis.federalWagesCents,200000)
 assert.throws(()=>calculateWithholding2026({...args,pretaxDeductionCents:1}),/Pretax/)
})


test('signed Maryland certificate dates and exempt blank fields are preserved across frequencies',()=>{
 for(const payFrequency of ['WEEKLY','BIWEEKLY','SEMIMONTHLY','MONTHLY']){
  const input={grossPayCents:200000,payFrequency,year:2026,workState:'MD',residenceState:'MD',election:{verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:null,exemptions:null,localRate:3.2,exempt:true},mw507Source:{receivedOn:'2026-09-12',claimKind:'NO_LIABILITY'}}}
  for(const paymentDate of [undefined,'2026-09-11','2026-02-30','2027-01-01'])assert.throws(()=>calculateWithholding2026({...input,paymentDate}),/MW507 requires/)
  for(const paymentDate of ['2026-09-12','2026-12-31'])assert.equal(calculateWithholding2026({...input,paymentDate}).stateIncomeTaxCents,0)
  assert.throws(()=>calculateWithholding2026({...input,paymentDate:'2026-09-12',election:{...input.election,maryland:{...input.election.maryland,exempt:false}}}),/Automatic Maryland/)
 }
})
