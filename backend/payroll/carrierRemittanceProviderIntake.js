import {createHash} from 'node:crypto'
import {hashEmail} from '../email/emailDeliveryStore.js'
import {readCarrierRemittanceNotice} from './carrierRemittanceNotice.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const identifier=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value)
// Called only inside the shared raw-byte, signed-event intake transaction.
export async function retainCarrierRemittanceProviderEvent(db,event,{signedAt,now}){
 if(!['bounce','spamreport','dropped'].includes(event.event)||typeof event.vortex_carrier_dispatch!=='string')return false
 if(!/^carrier-remittance-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(event.vortex_carrier_dispatch))throw fail('Invalid carrier remittance event correlation.')
 const timestamp=typeof event.timestamp==='string'&&/^\d{1,12}$/.test(event.timestamp)?Number(event.timestamp):event.timestamp
 // Delayed bounces can omit sg_message_id; signed dispatch + recipient matching
 // still identifies the exact retained attempt without inventing a message ID.
 const messageId=event.sg_message_id==null?null:event.sg_message_id
 if(!identifier(event.sg_event_id,200)||messageId!==null&&!identifier(messageId,500)||!identifier(event.email,320)||!Number.isSafeInteger(timestamp)||timestamp<=0||timestamp*1000>Date.parse(signedAt)+300000||timestamp*1000>now.getTime())throw fail('Invalid carrier remittance return event.')
 const recipientHash=hashEmail(event.email),source=(await db.query(`SELECT n.*,a.id AS attempt_id,a.created_at AS attempted_at,d.id AS delivery_id,d.created_at AS delivery_created_at,i.invoice->>'carrier' AS carrier,i.invoice->>'invoiceNumber' AS invoice_number FROM email_delivery d JOIN payroll_carrier_remittance_attempt a ON d.idempotency_key='carrier-remittance-'||a.dispatch_key::text JOIN payroll_carrier_remittance_notice n ON n.id=a.notice_id AND n.facility_id=d.facility_id JOIN payroll_carrier_payment_authorization p ON p.id=n.payment_id JOIN payroll_benefit_carrier_invoice i ON i.id=p.invoice_id WHERE d.idempotency_key=$1 AND d.recipient_hash=$2 AND d.provider='smtp:sendgrid' AND d.category='payroll_carrier_remittance' AND d.stream='transactional' AND d.template_version='carrier-remittance-v1' FOR UPDATE OF d`,[event.vortex_carrier_dispatch,recipientHash])).rows[0]
 if(!source||hashEmail(readCarrierRemittanceNotice(source).recipient.email)!==recipientHash)return false
 if(timestamp<Math.floor(+new Date(source.attempted_at)/1000)||timestamp<Math.floor(+new Date(source.delivery_created_at)/1000))throw fail('Carrier return predates the retained attempt.')
 const priorMessage=(await db.query("SELECT evidence->>'messageId' AS id FROM payroll_carrier_remittance_provider_event WHERE attempt_id=$1 AND evidence->>'messageId' IS NOT NULL ORDER BY created_at,event_id LIMIT 1",[source.attempt_id])).rows[0]
 if(messageId!==null&&priorMessage&&priorMessage.id!==messageId)throw fail('Carrier return message conflicts with retained evidence.',409)
 const evidence={eventId:event.sg_event_id,kind:event.event,messageId,dispatchKey:event.vortex_carrier_dispatch,recipientHash,providerTimestamp:timestamp},fingerprint=createHash('sha256').update(JSON.stringify(evidence)).digest('hex')
 const saved=(await db.query('INSERT INTO payroll_carrier_remittance_provider_event(event_id,facility_id,notice_id,attempt_id,delivery_id,kind,returned_at,evidence,fingerprint,signed_at) VALUES($1,$2,$3,$4,$5,$6,GREATEST($7::timestamptz,(SELECT created_at FROM payroll_carrier_remittance_attempt WHERE id=$4),(SELECT created_at FROM email_delivery WHERE id=$5)),$8,$9,$10) ON CONFLICT(event_id) DO NOTHING RETURNING event_id',[event.sg_event_id,source.facility_id,source.id,source.attempt_id,source.delivery_id,event.event,new Date(timestamp*1000).toISOString(),evidence,fingerprint,signedAt])).rows[0]
 if(!saved){const prior=(await db.query('SELECT fingerprint FROM payroll_carrier_remittance_provider_event WHERE event_id=$1',[event.sg_event_id])).rows[0];if(prior.fingerprint!==fingerprint)throw fail('Carrier provider event conflicts with retained evidence.',409)}
 const returnedAt=(await db.query('SELECT returned_at::text FROM payroll_carrier_remittance_provider_event WHERE event_id=$1',[event.sg_event_id])).rows[0].returned_at
 await db.query("UPDATE email_delivery SET status=CASE WHEN $3='spamreport' OR complained_at IS NOT NULL THEN 'complaint' WHEN $3='bounce' OR bounced_at IS NOT NULL THEN 'bounced' ELSE 'failed' END,bounced_at=CASE WHEN $3='bounce' THEN LEAST(COALESCE(bounced_at,$2::timestamptz),$2::timestamptz) ELSE bounced_at END,complained_at=CASE WHEN $3='spamreport' THEN LEAST(COALESCE(complained_at,$2::timestamptz),$2::timestamptz) ELSE complained_at END,updated_at=clock_timestamp() WHERE id=$1",[source.delivery_id,returnedAt,event.event])
 if(saved){
  await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'CARRIER_REMITTANCE_RETURN_RETAINED','carrier_remittance_attempt',$2,$3)",[source.facility_id,String(source.attempt_id),{noticeId:source.id,eventId:event.sg_event_id,kind:event.event}])
  if(!(await db.query('SELECT id FROM payroll_carrier_remittance_return_review WHERE notice_id=$1 LIMIT 1',[source.id])).rowCount)await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Carrier remittance notice returned',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,dismissed_by=NULL,title=EXCLUDED.title,message=EXCLUDED.message",[source.facility_id,`carrier-remittance-${source.id}`,`Carrier ${source.carrier} · Invoice ${source.invoice_number}: a signed ${event.event} event was retained. Review delivery history and the carrier contact. No automatic re-send is authorized.`])
 }
 return true
}
