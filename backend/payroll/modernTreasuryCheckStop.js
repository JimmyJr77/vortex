import {modernTreasuryTransport} from './modernTreasuryPayments.js'
import {digitalCheckInstruction,readPayrollDigitalCheck} from './modernTreasuryChecks.js'
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
// A committed unique stop claim is required before allowCreate=true. All
// recovery is read-only, even when the provider cannot find a prior action.
export async function resolvePayrollCheckStop(intent,claim,config,{allowCreate=false,priorActions=[]}={}){
 digitalCheckInstruction(intent)
 if(!uuid(claim?.id)||!uuid(claim.providerId))throw new Error('Retain the original check and stop identities.')
 if(!Array.isArray(priorActions)||priorActions.some(id=>!uuid(id))||new Set(priorActions).size!==priorActions.length)throw new Error('Retain the prior stop action identities.')
 const request=modernTreasuryTransport(config),matches=action=>uuid(action?.id)&&action.type==='stop'&&action.actionable_id===claim.providerId&&action.actionable_type==='payment_order'&&action.live_mode===(intent.mode==='LIVE')&&action.internal_account_id===intent.originatingAccountId
 let requestSent=false,checkEvidence={}
 const observe=payment=>{checkEvidence={checkPaidObserved:checkEvidence.checkPaidObserved===true||payment.status==='COMPLETED'||payment.reconciliationStatus==='reconciled',checkConflictObserved:checkEvidence.checkConflictObserved===true||(!!payment.providerId&&payment.providerId!==claim.providerId)||(!!payment.finalProviderId&&payment.finalProviderId!==claim.providerId)||['CANCELLED','STOPPED','RETURNED','REVERSED','HELD'].includes(payment.status)||['CANCELLED','STOPPED','RETURNED','REVERSED','HELD'].includes(payment.finalCheckStatus),providerId:payment.providerId||null,checkStatus:payment.status,checkDateMatches:payment.dateMatches,checkExpiryMatches:payment.expiryMatches,checkExpiresAt:payment.expiresAt,checkLiveMode:payment.liveMode,checkReconciliationStatus:payment.reconciliationStatus}}
 try{
  const payment=await readPayrollDigitalCheck(intent,config);observe(payment)
  if(payment.providerId!==claim.providerId||payment.dateMatches!==true||payment.expiryMatches!==true)return {requestSent,...checkEvidence,status:'CHECK_NEEDS_REVIEW'}
  const found=[],cursors=new Set();let cursor=null
  do{
   const query=new URLSearchParams({actionable_id:claim.providerId,actionable_type:'payment_order',type:'stop',per_page:'100'});if(cursor)query.set('after_cursor',cursor)
   const response=await request(`/payment_actions?${query}`);if(!response.ok)return {requestSent,...checkEvidence,status:'UNCERTAIN'}
   const page=await response.json();if(!Array.isArray(page)||page.some(action=>!matches(action)))return {requestSent,...checkEvidence,status:'NEEDS_REVIEW'}
   found.push(...page);cursor=response.headers?.get?.('X-After-Cursor')||null
   if(cursor&&(cursors.has(cursor)||cursors.size>=100))return {requestSent,...checkEvidence,status:'NEEDS_REVIEW'};if(cursor)cursors.add(cursor)
  }while(cursor)
  if(new Set(found.map(action=>action.id)).size!==found.length)return {requestSent,...checkEvidence,status:'NEEDS_REVIEW'}
  if(priorActions.some(id=>!found.some(action=>action.id===id&&['failed','cancelled'].includes(action.status))))return {requestSent,...checkEvidence,status:'NEEDS_REVIEW'}
  const candidates=found.filter(action=>!priorActions.includes(action.id));if(candidates.length>1)return {requestSent,...checkEvidence,status:'NEEDS_REVIEW'}
  let action=candidates[0]
  if(!action){
   if(allowCreate!==true)return {requestSent,...checkEvidence,status:'NOT_FOUND',providerId:claim.providerId,checkStatus:payment.status,checkDateMatches:payment.dateMatches,checkExpiryMatches:payment.expiryMatches,checkExpiresAt:payment.expiresAt,checkLiveMode:payment.liveMode,checkReconciliationStatus:payment.reconciliationStatus}
   if(payment.status!=='SENT'||payment.reconciliationStatus!=='unreconciled'||config.stopPaymentsEnabled!==true)return {requestSent,...checkEvidence,status:'BLOCKED_STOP'}
   requestSent=true
   const created=await request('/payment_actions',{method:'POST',headers:{'Idempotency-Key':`payroll_check_stop_${claim.id}`},body:JSON.stringify({type:'stop',actionable_id:claim.providerId,actionable_type:'payment_order'})})
   if(!created.ok)return {requestSent,...checkEvidence,status:'UNCERTAIN'}
   action=await created.json()
  }
  if(!matches(action)||priorActions.includes(action.id))return {requestSent,...checkEvidence,status:'NEEDS_REVIEW'}
  const statuses={pending:'PENDING',processable:'PROCESSABLE',processing:'PROCESSING',sent:'SENT',acknowledged:'ACKNOWLEDGED',failed:'FAILED',cancelled:'CANCELLED'}
  const status=statuses[action.status]||'NEEDS_REVIEW'
  const fresh=await readPayrollDigitalCheck(intent,config);observe(fresh)
  if(fresh.providerId!==claim.providerId||fresh.dateMatches!==true||fresh.expiryMatches!==true)return {requestSent,...checkEvidence,status:'CHECK_NEEDS_REVIEW',actionId:action.id}
  return {requestSent,...checkEvidence,status:status==='ACKNOWLEDGED'?(fresh.status==='STOPPED'?'STOP_CONFIRMED':'NEEDS_REVIEW'):status,actionId:action.id,providerId:claim.providerId,checkStatus:fresh.status}
 }catch{return {requestSent,...checkEvidence,status:'UNCERTAIN'}}
}
