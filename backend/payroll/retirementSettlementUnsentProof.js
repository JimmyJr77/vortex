import {isDeepStrictEqual} from 'node:util'
// The caller must load scoped immutable jobs/observations under the employer
// lock. This proves only original non-send; fresh provider absence is separate.
export function retirementSettlementUnsentProof(authorization,jobs){
 const expected=authorization?.preview?.journals
 const reject=()=>({eligible:false,reason:'Every authorized journal requires exact retained proof that its first submission ended before any create attempt.'})
 if(!Array.isArray(expected)||!expected.length||expected.length>10||!Array.isArray(jobs)||jobs.length!==expected.length||new Set(jobs.map(j=>j?.id)).size!==jobs.length||new Set(expected.map(j=>j?.event?.key)).size!==expected.length)return reject()
 const evidence=[]
 for(const item of expected){
  const matches=jobs.filter(j=>j?.event_key===item?.event?.key)
  if(matches.length!==1)return reject()
  const job=matches[0]
  if(typeof job.id!=='string'||job.authorization_id!==authorization.id||job.realm_id!==authorization.preview.realmId||job.environment!==authorization.preview.environment||!isDeepStrictEqual(job.payload,item.payload)||!Array.isArray(job.observations)||!job.observations.length)return reject()
  const submissions=job.observations.filter(o=>o?.source==='SUBMISSION')
  if(submissions.length!==1||submissions[0].create_attempted!==false||submissions[0].result?.status!=='NOT_SENT')return reject()
  // Missing flags and unknown/reconciled provider outcomes cannot be treated as
  // proof. A later uncertain lookup must be resolved before another review.
  if(job.observations.some(o=>!['SUBMISSION','RECOVERY'].includes(o?.source)||o.create_attempted!==false||!['NOT_SENT','NOT_FOUND'].includes(o.result?.status)||o.source==='RECOVERY'&&o.result.status!=='NOT_FOUND'))return reject()
  if(job.observations.some(o=>typeof o.id!=='string'||!/^[1-9][0-9]*$/.test(o.id))||new Set(job.observations.map(o=>o.id)).size!==job.observations.length)return reject()
  const first=job.observations.reduce((a,b)=>BigInt(a.id)<BigInt(b.id)?a:b)
  if(first!==submissions[0])return reject()
  evidence.push({journalId:job.id,submissionObservationId:submissions[0].id})
 }
 return {eligible:true,evidence}
}
