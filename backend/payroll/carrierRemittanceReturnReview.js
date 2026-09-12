import {createHash} from 'node:crypto'
import {hashEmail} from '../email/emailDeliveryStore.js'
import {readCurrentCarrierRecipient} from './carrierRemittanceRecipient.js'
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const fail=message=>Object.assign(new Error(message),{status:409})
export async function carrierAddressReturns(db,facility,email){
 return (await db.query("SELECT event_id FROM payroll_carrier_remittance_provider_event WHERE facility_id=$1 AND evidence->>'recipientHash'=$2 ORDER BY event_id",[facility,hashEmail(email)])).rows.map(row=>row.event_id)
}
export async function carrierAddressClearance(db,facility,recipient){
 const events=await carrierAddressReturns(db,facility,recipient.contact.email)
 const review=(await db.query('SELECT * FROM payroll_carrier_remittance_return_review WHERE facility_id=$1 AND recipient_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1',[facility,recipient.id])).rows[0]
 return {ready:!events.length||!!review&&JSON.stringify(review.target_event_ids)===JSON.stringify(events),reviewId:review?.id||null}
}
export async function carrierReturnReviewPreview(db,facility,noticeId){
 const source=(await db.query('SELECT n.*,i.carrier_key FROM payroll_carrier_remittance_notice n JOIN payroll_carrier_payment_authorization a ON a.id=n.payment_id JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE n.id=$1 AND n.facility_id=$2',[noticeId,facility])).rows[0]
 if(!source)throw Object.assign(new Error('Carrier notice was not found.'),{status:404})
 if((await db.query('SELECT notice_id FROM payroll_carrier_remittance_unsent_release WHERE notice_id=$1',[noticeId])).rowCount)throw fail('This notice has a retained non-send release. Conflicting later delivery evidence requires release reconciliation before another disposition.')
 const events=(await db.query('SELECT event_id FROM payroll_carrier_remittance_provider_event WHERE notice_id=$1 ORDER BY event_id',[noticeId])).rows.map(row=>row.event_id)
 if(!events.length)throw fail('Retained provider returns are required before reviewing a returned notice.')
 const recipient=await readCurrentCarrierRecipient(db,facility,source.carrier_key)
 if(recipient?.action!=='REVIEW'||String(recipient.id)===String(source.recipient_id))throw fail('Retain a fresh carrier contact review after investigating the return, including any request to resume delivery.')
 const targetEvents=await carrierAddressReturns(db,facility,recipient.contact.email)
 const latest=(await db.query('SELECT id FROM payroll_carrier_remittance_return_review WHERE notice_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[noticeId])).rows[0]
 const preview={noticeId,facilityId:Number(facility),recipient:{id:String(recipient.id),revision:recipient.revision,name:recipient.contact.name,email:recipient.contact.email},sourceEventIds:events,targetEventIds:targetEvents,previousReviewId:latest?.id||null}
 return {...preview,fingerprint:hash(preview)}
}
