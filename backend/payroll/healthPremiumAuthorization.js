import {requireHealthParticipantQualification} from './healthParticipantQualification.js'
import {requireHealthElection} from './healthElection.js'
// Caller must reserve the monthly collection under the payroll settings lock.
// This resolves tax classification and consent; it does not claim collection.
export async function resolveHealthPremiumAuthorization(db,facility,employeeId,paymentDate,authorization,annualBonusAllocations={}){
 const fail=message=>{throw new Error(message)}
 const basis=authorization?.proposal
 if(!basis||String(basis.employeeId)!==String(employeeId)||!Array.isArray(basis.items)||authorization.proposalFingerprint!==basis.fingerprint)fail('Retain the scoped signed benefit authorization before resolving health premiums.')
 const premiums=basis.items.filter(item=>item.taxTreatment==='PRETAX'),seen=new Set(),items=[],evidence=[]
 if(Object.keys(annualBonusAllocations).some(planId=>!premiums.some(item=>item.planId===planId)))fail('Bonus premium allocation refers to coverage outside this authorization.')
 for(const item of premiums){
  if(seen.has(item.planId)||!Number.isSafeInteger(item.monthlyCents)||item.monthlyCents<=0)fail('Reconcile duplicate or invalid monthly health premium amounts.')
  seen.add(item.planId)
  const participant=await requireHealthParticipantQualification(db,facility,employeeId,item.planId,paymentDate)
  const signed=await requireHealthElection(db,facility,employeeId,item.planId,paymentDate),proposal=signed.election.proposal
  if(participant.authorizationFingerprint!==authorization.proposalFingerprint||proposal.authorizationFingerprint!==authorization.proposalFingerprint||proposal.optionId!==item.optionId||proposal.monthlyCents!==item.monthlyCents||participant.selection.optionId!==item.optionId||participant.selection.monthlyCents!==item.monthlyCents)fail('The signed health election differs from the authorized coverage or monthly premium.')
  const bonus=annualBonusAllocations[item.planId]??0
  if(!Number.isSafeInteger(bonus)||bonus<0||bonus>item.monthlyCents)fail('Retain a valid annual-bonus allocation for the authorized health premium.')
  items.push({planId:item.planId,optionId:item.optionId,deductionCents:item.monthlyCents,annualBonusDeductionCents:bonus,qualificationFingerprint:participant.fingerprint,authorizationFingerprint:authorization.proposalFingerprint})
  evidence.push({planId:item.planId,participantReviewId:participant.reviewId,participantSourceFingerprint:participant.sourceFingerprint,electionId:signed.id,electionFingerprint:signed.proposalFingerprint,election:signed.election,electionCreatedAt:signed.createdAt,timeZone:signed.timeZone})
 }
 return {health125:items.length?{version:1,classification:'SECTION125_ACCIDENT_HEALTH_PREMIUM',items:items.sort((a,b)=>a.planId.localeCompare(b.planId))}:null,evidence}
}
