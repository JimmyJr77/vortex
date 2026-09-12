import {carrierRemittanceUnsentEvidence} from './carrierRemittanceUnsentEvidence.js'
export async function readCarrierUnsentProof(db,notice,recipientHash){
 if(!(await db.query("SELECT to_regclass('email_delivery') AS relation")).rows[0].relation)throw Object.assign(new Error('Delivery logging must be available before verifying a non-send release.'),{status:503})
 const attempts=(await db.query('SELECT a.*,r.outcome,r.created_at AS recorded_at,x.created_at AS acceptance_reconciled_at FROM payroll_carrier_remittance_attempt a LEFT JOIN payroll_carrier_remittance_result r ON r.attempt_id=a.id LEFT JOIN payroll_carrier_remittance_acceptance x ON x.attempt_id=a.id WHERE a.notice_id=$1 ORDER BY a.id',[notice.id])).rows
 // Inspect every matching dispatch key, including foreign/mismatched rows: an
 // identity conflict must not masquerade as an absent delivery record.
 const deliveries=(await db.query('SELECT id,facility_id,recipient_hash,category,stream,template_version,status,idempotency_key,created_at,accepted_at,bounced_at,complained_at FROM email_delivery WHERE idempotency_key=ANY($1::text[]) ORDER BY id FOR SHARE',[attempts.map(row=>`carrier-remittance-${row.dispatch_key}`)])).rows
 const [claim,returned,review,cancel]=await Promise.all([
  db.query('SELECT notice_id FROM payroll_carrier_remittance_claim WHERE notice_id=$1',[notice.id]),
  db.query('SELECT event_id FROM payroll_carrier_remittance_provider_event WHERE notice_id=$1',[notice.id]),
  db.query('SELECT id FROM payroll_carrier_remittance_return_review WHERE notice_id=$1 LIMIT 1',[notice.id]),
  db.query('SELECT notice_id FROM payroll_carrier_remittance_cancellation WHERE notice_id=$1',[notice.id]),
 ])
 return carrierRemittanceUnsentEvidence({facilityId:notice.facility_id,noticeId:notice.id,recipientHash,attempts,deliveries,claimed:claim.rowCount>0,returns:returned.rows,reviewed:review.rowCount>0,cancelled:cancel.rowCount>0})
}
export async function carrierPriorUnsentReleasesReady(db,paymentId){
 const released=(await db.query('SELECT n.id,n.facility_id,r.evidence FROM payroll_carrier_remittance_unsent_release r JOIN payroll_carrier_remittance_notice n ON n.id=r.notice_id WHERE n.payment_id=$1 ORDER BY n.id',[paymentId])).rows
 for(const row of released){const proof=await readCarrierUnsentProof(db,row,row.evidence.recipientHash);if(!proof.eligible)return {ready:false,reason:'An earlier non-send release now has conflicting delivery evidence. Review the original notice before authorizing or sending another.'}}
 return {ready:true,reason:null}
}
