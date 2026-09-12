import {readCarrierUnsentProof} from './carrierRemittanceUnsentProof.js'
export const carrierNoticeCategory='payroll_carrier_remittance'
export const carrierNoticeTemplate='carrier-remittance-v1'
export async function carrierDeliveryState(db,noticeId,{now=new Date()}={}){
 const history=(await db.query(`SELECT a.id,a.dispatch_key,a.created_at,r.outcome,r.provider_message_id,r.created_at AS recorded_at,x.created_at AS acceptance_reconciled_at FROM payroll_carrier_remittance_attempt a LEFT JOIN payroll_carrier_remittance_result r ON r.attempt_id=a.id LEFT JOIN payroll_carrier_remittance_acceptance x ON x.attempt_id=a.id WHERE a.notice_id=$1 ORDER BY a.id DESC`,[noticeId])).rows
 const returns=(await db.query('SELECT event_id AS "eventId",attempt_id AS "attemptId",kind,returned_at AS "returnedAt" FROM payroll_carrier_remittance_provider_event WHERE notice_id=$1 ORDER BY returned_at DESC,event_id',[noticeId])).rows
 const latest=history[0],claimed=(await db.query('SELECT notice_id FROM payroll_carrier_remittance_claim WHERE notice_id=$1',[noticeId])).rowCount>0
 const reviewed=(await db.query('SELECT id FROM payroll_carrier_remittance_return_review WHERE notice_id=$1 LIMIT 1',[noticeId])).rowCount>0
 const release=(await db.query('SELECT * FROM payroll_carrier_remittance_unsent_release WHERE notice_id=$1',[noticeId])).rows[0]
 let releaseProof=null
 if(release)try{releaseProof=await readCarrierUnsentProof(db,{id:noticeId,facility_id:release.facility_id},release.evidence.recipientHash)}catch(e){if(e.status!==503)throw e;releaseProof={eligible:false,reasons:[e.message]}}
 const outcome=release?(releaseProof.eligible?'UNSENT_RELEASED':'RELEASE_NEEDS_REVIEW'):reviewed?'REPLACEMENT_REVIEWED':returns.length?'RETURNED':latest?.acceptance_reconciled_at?'SMTP_ACCEPTED':latest?.outcome||(claimed?'UNCERTAIN':null)
 const retryAt=outcome==='NOT_SENT'&&history.length<3?new Date(+new Date(latest.created_at)+300000).toISOString():null
 return {status:outcome==='NOT_SENT'&&history.length>=3?'EXHAUSTED':outcome||'AUTHORIZED',claimed,history,returns,unsentRelease:release?{reference:release.reference,createdAt:release.created_at,attemptCount:release.evidence.attempts.length}:null,releaseIssue:releaseProof&&!releaseProof.eligible?releaseProof.reasons.join(' '):null,canAttempt:!release&&!reviewed&&!returns.length&&(!claimed||outcome==='NOT_SENT'&&history.length<3&&+now>=+new Date(retryAt)),retryAt}
}
