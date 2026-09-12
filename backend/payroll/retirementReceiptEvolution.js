const fields=['ordinaryPretaxCents','ordinaryRothCents','catchUpPretaxCents','catchUpRothCents','totalCents']
export function retirementReceiptEvolution(previous,next,{allowReversals=false}={}){
 if(!previous)return next.participants.some(p=>p.status==='REVERSED')?'REGRESSION':'CURRENT'
 if(previous.sourceSha256!==next.sourceSha256||previous.batchId!==next.batchId||previous.authorizedCents!==next.authorizedCents||previous.participants.length!==next.participants.length)return 'CONFLICT'
 const prior=new Map(previous.participants.map(p=>[p.employeeId,p]));let changed=false,stale=false,regression=false,conflict=false
 for(const p of next.participants){const old=prior.get(p.employeeId);if(!old||old.authorizedCents!==p.authorizedCents)return 'CONFLICT'
  const before=Date.parse(old.recordedAt),after=Date.parse(p.recordedAt),same=old.status===p.status&&fields.every(k=>old.reported[k]===p.reported[k])
  if(!Number.isFinite(before)||!Number.isFinite(after))return 'CONFLICT'
  if(after<before)stale=true
  if(after===before&&!same)conflict=true
  const reversal=allowReversals&&old.status==='POSTED'&&old.fullyAccounted===true&&old.reported.totalCents===p.authorizedCents&&p.status==='REVERSED'&&p.reversedAllocationCents===p.authorizedCents&&fields.every(k=>p.reported[k]===0)&&after>before
  if(!reversal&&(fields.some(k=>p.reported[k]<old.reported[k])||old.status==='POSTED'&&p.status!=='POSTED'||p.status==='REVERSED'&&old.status!=='REVERSED'||old.status==='REVERSED'&&p.status!=='REVERSED'))regression=true
  if(!same||after!==before)changed=true
 }
 return conflict?'CONFLICT':stale?'STALE':regression?'REGRESSION':changed?'CURRENT':'UNCHANGED'
}
