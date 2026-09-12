import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHash} from 'node:crypto'
import {retirementPlanInput} from '../retirementPlanInput.js'
import {retirementElectionProposal,retirementElectionInput} from '../retirementElectionInput.js'
const plan=retirementPlanInput({taxYear:2026,planType:'STANDARD_401K',planId:'plan',effectiveOn:'2026-01-01',confirmed:true,name:'Synthetic Plan',providerName:'Synthetic Provider',planReference:'Private administrator plan document reference',eligibilityTerms:'Published eligibility and entry-date terms.',compensationTerms:'Published compensation definition for employee elections.',employeeTerms:'Published employee election and withdrawal terms.',allowsPretax:true,allowsRoth:true,allowsCatchUp:false,allowsHigherCatchUp:false,automaticEnrollment:'NOT_APPLICABLE',employerContributions:'NONE',compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},planOrdinaryDeferralLimitCents:null,planCatchUpLimitCents:0,reviewReference:'Private administrator review reference'})
const context={eligibilityRevisionId:randomUUID(),employeeExplanation:"Reviewed eligibility and plan entry requirements.",facilityId:1,employeeId:7,onboardingCycle:1,planRevision:1,earliestEffectiveOn:'2026-09-01',methods:['PERCENTAGE','FIXED_PER_REGULAR_PAY']}
const proposal=retirementElectionProposal(plan,context)
const body={action:'ELECT',method:'PERCENTAGE',pretax:500,roth:200,effectiveOn:'2026-09-01',signature:'Synthetic Employee',confirmed:true,requestKey:randomUUID(),proposalFingerprint:proposal.fingerprint}
test('persisted retirement terms retain original signatures regardless of JSON object key order',()=>{
 const {fingerprint,...terms}=proposal
 assert.equal(fingerprint,createHash('sha256').update(JSON.stringify(terms)).digest('hex'))
 const reordered=Object.fromEntries(Object.entries(proposal).reverse())
 assert.equal(retirementElectionInput(body,reordered).proposalFingerprint,fingerprint)
 assert.throws(()=>retirementElectionInput(body,{...reordered,extraTerms:'Unsigned change'}),/terms changed/)
})
test('retirement election retains exact public terms and separate pretax/Roth units',()=>{
 assert.equal(JSON.stringify(proposal).includes('Private administrator'),false)
 const elected=retirementElectionInput({...body,employeeId:999,facilityId:999},proposal);assert.equal(elected.pretax,500);assert.equal(elected.roth,200);assert.equal(elected.proposal.employeeId,7);assert.equal(elected.proposal.facilityId,1)
 const fixed=retirementElectionInput({...body,method:'FIXED_PER_REGULAR_PAY',pretax:10000,roth:5000},proposal);assert.equal(fixed.method,'FIXED_PER_REGULAR_PAY')
 const declined=retirementElectionInput({...body,action:'DECLINE',pretax:0,roth:0},proposal);assert.equal(declined.method,null);assert.equal(declined.signature,body.signature)
})
test('new plan revisions, eligibility, methods and employment cycles invalidate old signatures',()=>{
 for(const patch of [{eligibilityRevisionId:randomUUID()},{employeeExplanation:"New reviewed eligibility explanation for the employee."},{planRevision:2},{onboardingCycle:2},{employeeId:8},{facilityId:2},{earliestEffectiveOn:'2026-10-01'},{methods:['PERCENTAGE']}]){
  const current=retirementElectionProposal(plan,{...context,...patch});assert.notEqual(current.fingerprint,proposal.fingerprint);assert.throws(()=>retirementElectionInput(body,current),/terms changed/)
 }
 assert.throws(()=>retirementElectionInput(body,{...proposal,employeeTerms:'Forged terms'}),/terms changed/)
 assert.throws(()=>retirementElectionProposal({...plan,name:'Changed without retained review'},context),/current scoped/)
})
test('employee elections reject ambiguous amounts, unsupported treatment and invalid effective dates',()=>{
 for(const patch of [{pretax:10000,roth:1},{pretax:0,roth:0},{pretax:'500'},{pretax:0.5},{roth:-1},{method:'UNKNOWN'},{effectiveOn:'2026-02-30'},{effectiveOn:'2026-08-31'},{effectiveOn:'2027-01-01'},{signature:''},{confirmed:false},{requestKey:'invalid'},{action:'DECLINE'}])assert.throws(()=>retirementElectionInput({...body,...patch},proposal),{status:400})
 const restricted=retirementPlanInput({...plan,allowsRoth:false,confirmed:true}),current=retirementElectionProposal(restricted,context)
 assert.throws(()=>retirementElectionInput({...body,proposalFingerprint:current.fingerprint},current),/does not permit/)
 assert.throws(()=>retirementElectionInput({...body,method:'FIXED_PER_REGULAR_PAY',pretax:Number.MAX_SAFE_INTEGER,roth:1},proposal),/positive contribution/)
})
