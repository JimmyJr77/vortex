import {createHash} from 'node:crypto'
const validDate=value=>value!=null&&Number.isFinite(+new Date(value))
const iso=value=>validDate(value)?new Date(value).toISOString():null
// A sender's affirmative NOT_SENT result is required for every attempt. Empty
// or queued logs alone never establish non-send; they can only corroborate it.
export function carrierRemittanceUnsentEvidence({facilityId,noticeId,recipientHash,claimed,attempts=[],deliveries=[],returns=[],reviewed=false,cancelled=false}){
 const reasons=[]
 if(!claimed||!attempts.length)reasons.push('A retained claim and completed send attempt are required. Unclaimed notices use cancellation.')
 if(reviewed||cancelled)reasons.push('This notice already has another retained disposition.')
 if(returns.length)reasons.push('Provider return evidence requires return review, not a non-send release.')
 for(const attempt of attempts){
  if(!validDate(attempt.created_at)||!validDate(attempt.recorded_at))reasons.push('Attempt timing or result retention is incomplete.')
  if(attempt.outcome!=='NOT_SENT'||attempt.acceptance_reconciled_at)reasons.push('Every attempt must have affirmative non-send evidence without acceptance recovery.')
  const matches=deliveries.filter(row=>row.idempotency_key===`carrier-remittance-${attempt.dispatch_key}`)
  if(matches.length>1)reasons.push('Multiple delivery records conflict with the retained attempt.')
  for(const row of matches){
   if(String(row.facility_id)!==String(facilityId)||row.recipient_hash!==recipientHash||row.category!=='payroll_carrier_remittance'||row.stream!=='transactional'||row.template_version!=='carrier-remittance-v1'||!validDate(row.created_at)||+new Date(row.created_at)<+new Date(attempt.created_at))reasons.push('Delivery identity or timing does not match the retained notice.')
   if(row.accepted_at||row.bounced_at||row.complained_at||!['queued','suppressed'].includes(row.status))reasons.push('Delivery evidence indicates acceptance, a return or an unresolved transport outcome.')
  }
 }
 const attemptKeys=new Set(attempts.map(row=>`carrier-remittance-${row.dispatch_key}`))
 if(deliveries.some(row=>!attemptKeys.has(row.idempotency_key)))reasons.push('Unexpected delivery evidence requires recovery.')
 const snapshot={version:1,facilityId:String(facilityId),noticeId,recipientHash,attempts:attempts.map(row=>({id:String(row.id),dispatchKey:row.dispatch_key,outcome:row.outcome,createdAt:iso(row.created_at),recordedAt:row.recorded_at?iso(row.recorded_at):null,acceptanceReconciledAt:row.acceptance_reconciled_at?iso(row.acceptance_reconciled_at):null})).sort((a,b)=>a.id.localeCompare(b.id)),deliveries:deliveries.map(row=>({id:String(row.id),facilityId:String(row.facility_id),recipientHash:row.recipient_hash,idempotencyKey:row.idempotency_key,category:row.category,stream:row.stream,templateVersion:row.template_version,status:row.status,createdAt:iso(row.created_at),acceptedAt:row.accepted_at?iso(row.accepted_at):null,bouncedAt:row.bounced_at?iso(row.bounced_at):null,complainedAt:row.complained_at?iso(row.complained_at):null})).sort((a,b)=>a.id.localeCompare(b.id))}
 return {eligible:reasons.length===0,reasons:[...new Set(reasons)],snapshot,fingerprint:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')}
}
