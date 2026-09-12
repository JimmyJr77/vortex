import {isDeepStrictEqual} from 'node:util'
const categories=['ordinaryPretaxCents','ordinaryRothCents','catchUpPretaxCents','catchUpRothCents']
// The caller verifies the current receipt binding, freshness and reviewed
// reversal contract before comparing its encrypted result with current banking.
export function retirementParticipantReversalEvidence(result,allocations,bank){
 const fail=()=>{throw new Error('Reconcile participant reversal allocations and current bank-return evidence.')}
 if(result?.version!==2||!/^[1-9][0-9]*$/.test(String(result.returnBankEvidence?.observationId))||!['REVERSED','PARTIALLY_REVERSED'].includes(result?.status)||!Array.isArray(allocations)||!allocations.length||!Array.isArray(result.participants)||result.participants.length!==allocations.length||!isDeepStrictEqual(result.returnBankEvidence?.event,bank?.event))fail()
 let authorized=0,reversed=0,reported=0,posted=0
 const seen=new Set()
 for(const source of allocations){
  const id=String(source.employeeId),matches=result.participants.filter(p=>String(p.employeeId)===id)
  if(seen.has(id)||matches.length!==1||!Number.isSafeInteger(source.totalCents)||source.totalCents<=0||categories.some(k=>!Number.isSafeInteger(source[k])||source[k]<0)||categories.reduce((n,k)=>n+source[k],0)!==source.totalCents)fail()
  seen.add(id);const p=matches[0]
  if(p.authorizedCents!==source.totalCents||!p.reported||categories.some(k=>!Number.isSafeInteger(p.reported[k])||p.reported[k]<0||p.reported[k]>source[k])||categories.reduce((n,k)=>n+p.reported[k],0)!==p.reported.totalCents)fail()
  if(p.fullyAccounted!==(p.reported.totalCents===source.totalCents)||['PENDING','REJECTED'].includes(p.status)&&p.reported.totalCents!==0||['POSTED','ACCEPTED'].includes(p.status)&&p.reported.totalCents===0)fail()
  authorized+=source.totalCents;reported+=p.reported.totalCents
  if(p.status==='REVERSED'){if(p.reported.totalCents!==0||p.reversedAllocationCents!==source.totalCents)fail();reversed+=source.totalCents}
  else if(p.status==='POSTED'){posted+=p.reported.totalCents}
  else if(!['ACCEPTED','PENDING','REJECTED'].includes(p.status))fail()
 }
 if(![authorized,reversed,reported,posted].every(Number.isSafeInteger)||authorized!==bank.event.amountCents||authorized!==result.authorizedCents||reversed<=0||reversed!==result.reversedAllocationCents||reported!==result.reportedCents||posted!==result.postedCents||result.status!==(reversed===authorized?'REVERSED':'PARTIALLY_REVERSED'))fail()
 return {status:result.status,reversedAllocationCents:reversed,postedCents:posted}
}
