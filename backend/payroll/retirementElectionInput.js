import {createHash} from 'node:crypto'
import {retirementPlanInput} from './retirementPlanInput.js'
// Preserve the original version-1 signature byte order across JSONB round trips.
// Include unexpected keys too, so adding unsigned terms still invalidates it.
const termKeys=['version','eligibilityRevisionId','employeeExplanation','facilityId','employeeId','onboardingCycle','planRevision','planId','planFingerprint','taxYear','planName','providerName','employeeTerms','eligibilityTerms','compensationTerms','allowsPretax','allowsRoth','earliestEffectiveOn','methods']
const hash=value=>createHash('sha256').update(JSON.stringify(Object.fromEntries([...termKeys.filter(key=>Object.hasOwn(value,key)),...Object.keys(value).filter(key=>!termKeys.includes(key)).sort()].map(key=>[key,value[key]])))).digest('hex')
const fail=message=>Object.assign(new Error(message),{status:400})
const day=value=>typeof value==='string'&&/^2026-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const positive=value=>Number.isSafeInteger(value)&&value>0
// The calling service must obtain these identifiers, reviewed eligibility and
// available methods from scoped retained records, never from employee input.
export function retirementElectionProposal(plan,context){
 const reviewed=retirementPlanInput({...plan,confirmed:true}),c=context||{}
 if(plan.fingerprint!==reviewed.fingerprint||!positive(c.facilityId)||!positive(c.employeeId)||!positive(c.onboardingCycle)||!positive(c.planRevision)||!day(c.earliestEffectiveOn)||c.earliestEffectiveOn<plan.effectiveOn)throw fail('Use current scoped plan and employee eligibility evidence.')
 if(typeof c.eligibilityRevisionId!=='string'||!/^[a-f0-9-]{36}$/i.test(c.eligibilityRevisionId)||typeof c.employeeExplanation!=='string'||c.employeeExplanation.length<12)throw fail('Use the retained participant eligibility review and explanation.')
 if(!Array.isArray(c.methods)||!c.methods.length||new Set(c.methods).size!==c.methods.length||c.methods.some(method=>!['PERCENTAGE','FIXED_PER_REGULAR_PAY'].includes(method)))throw fail('Review the election methods permitted by this plan.')
 const terms={version:1,eligibilityRevisionId:c.eligibilityRevisionId,employeeExplanation:c.employeeExplanation,facilityId:c.facilityId,employeeId:c.employeeId,onboardingCycle:c.onboardingCycle,planRevision:c.planRevision,planId:plan.planId,planFingerprint:plan.fingerprint,taxYear:2026,planName:plan.name,providerName:plan.providerName,employeeTerms:plan.employeeTerms,eligibilityTerms:plan.eligibilityTerms,compensationTerms:plan.compensationTerms,allowsPretax:plan.allowsPretax,allowsRoth:plan.allowsRoth,earliestEffectiveOn:c.earliestEffectiveOn,methods:[...c.methods].sort()}
 return {...terms,fingerprint:hash(terms)}
}
export function retirementElectionInput(body,proposal){
 const b=body||{}, {fingerprint,...terms}=proposal||{}
 if(!fingerprint||hash(terms)!==fingerprint||b.proposalFingerprint!==fingerprint)throw fail('The displayed retirement terms changed. Review the current proposal before signing.')
 if(!['ELECT','DECLINE'].includes(b.action)||b.confirmed!==true||typeof b.signature!=='string'||b.signature.trim().length<2||b.signature.length>200||/[\u0000-\u001f\u007f]/.test(b.signature))throw fail('Choose an election and confirm it with your full name.')
 if(!day(b.effectiveOn)||b.effectiveOn<proposal.earliestEffectiveOn)throw fail('Choose an effective date on or after the reviewed eligibility date.')
 if(typeof b.requestKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(b.requestKey))throw fail('Use a valid retirement election request key.')
 for(const field of ['pretax','roth'])if(!Number.isSafeInteger(b[field])||b[field]<0)throw fail('Use explicit nonnegative contribution amounts.')
 if(b.action==='DECLINE'&&(b.pretax!==0||b.roth!==0))throw fail('A decline cannot include contribution amounts.')
 if(b.action==='ELECT'){
  if(!proposal.methods.includes(b.method)||!Number.isSafeInteger(b.pretax+b.roth)||b.pretax+b.roth<=0)throw fail('Choose a permitted election method and positive contribution.')
  if(b.method==='PERCENTAGE'&&b.pretax+b.roth>10000)throw fail('Combined contribution percentages cannot exceed 100 percent.')
  if(b.pretax>0&&!proposal.allowsPretax||b.roth>0&&!proposal.allowsRoth)throw fail('The current plan does not permit the selected contribution treatment.')
 }
 return {version:1,action:b.action,method:b.action==='DECLINE'?null:b.method,pretax:b.pretax,roth:b.roth,effectiveOn:b.effectiveOn,signature:b.signature.trim(),proposalFingerprint:fingerprint,proposal,requestKey:b.requestKey.toLowerCase()}
}
