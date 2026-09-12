import {retainCarrierRemittanceProviderEvent} from './carrierRemittanceProviderIntake.js'
import express from 'express'
import {createHash} from 'node:crypto'
import {hashEmail} from '../email/emailDeliveryStore.js'
import {readW2Notice} from './w2NoticeQueue.js'
import {verifyW2NoticeProviderEvents} from './w2NoticeProvider.js'
export const w2ProviderPath='/api/payroll/providers/sendgrid/events'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export async function retainW2ProviderEvents(pool,raw,verification={}){
 verification={...verification,now:verification.now||new Date()}
 const {events,signedAt}=verifyW2NoticeProviderEvents(raw,verification),db=await pool.connect();let accepted=0,ignored=0
 try{
  await db.query('BEGIN')
  // Lock all affected employers in a stable order before any delivery-row lock.
  // This keeps mixed W-2/carrier batches compatible with dispatch recovery.
  if(events.some(e=>typeof e.vortex_carrier_dispatch==='string')){
   const keys=events.flatMap(e=>[e.vortex_carrier_dispatch,e.vortex_w2_dispatch].filter(k=>typeof k==='string'))
   await db.query("SELECT facility_id FROM payroll_settings WHERE facility_id IN (SELECT facility_id FROM email_delivery WHERE idempotency_key=ANY($1::text[]) AND category IN ('payroll_w2_notice','payroll_carrier_remittance')) ORDER BY facility_id FOR UPDATE",[keys])
  }
  for(const event of events){
   if(typeof event.vortex_carrier_dispatch==='string'){if(await retainCarrierRemittanceProviderEvent(db,event,{signedAt,now:verification.now}))accepted++;else ignored++;continue}
   if(event.event!=='bounce'||typeof event.vortex_w2_dispatch!=='string'){ignored++;continue}
   const eventTimestamp=typeof event.timestamp==='string'&&/^\d{1,12}$/.test(event.timestamp)?Number(event.timestamp):event.timestamp
   if(typeof event.sg_event_id!=='string'||!/^[A-Za-z0-9_+\/=-]{1,100}$/.test(event.sg_event_id)||typeof event.sg_message_id!=='string'||!event.sg_message_id.length||event.sg_message_id.length>500||typeof event.email!=='string'||event.email.length>320||!Number.isSafeInteger(eventTimestamp)||eventTimestamp<=0||eventTimestamp*1000>Date.parse(signedAt)+300000||eventTimestamp*1000>verification.now.getTime())throw fail('Invalid W-2 bounce event.')
   const recipientHash=hashEmail(event.email),source=(await db.query(`SELECT j.*,a.id AS attempt_id,a.created_at AS attempted_at,d.id AS delivery_id,d.created_at AS delivery_created_at,d.status AS delivery_status FROM email_delivery d JOIN payroll_w2_notice_attempt a ON d.idempotency_key='w2-notice-'||a.dispatch_key::text JOIN payroll_w2_notice_job j ON j.id=a.job_id AND j.facility_id=d.facility_id WHERE d.idempotency_key=$1 AND d.recipient_hash=$2 AND d.provider='smtp:sendgrid' AND d.category='payroll_w2_notice' AND d.stream='transactional' AND d.template_version='w2-notice-2026-v1' FOR UPDATE OF d`,[event.vortex_w2_dispatch,recipientHash])).rows[0]
   if(!source||hashEmail(readW2Notice(source).recipient)!==recipientHash){ignored++;continue}
   if(eventTimestamp<Math.floor(new Date(source.attempted_at).getTime()/1000)||eventTimestamp<Math.floor(new Date(source.delivery_created_at).getTime()/1000))throw fail('Bounce predates its retained notice.')
   const priorMessage=(await db.query("SELECT evidence->>'messageId' AS id FROM payroll_w2_provider_event WHERE attempt_id=$1 ORDER BY created_at,event_id LIMIT 1",[source.attempt_id])).rows[0]
   if(priorMessage&&priorMessage.id!==event.sg_message_id)throw fail('Provider message conflicts with the retained notice.',409)
   const returnedAt=new Date(Math.max(eventTimestamp*1000,new Date(source.attempted_at).getTime(),new Date(source.delivery_created_at).getTime())).toISOString()
   const evidence={eventId:event.sg_event_id,messageId:event.sg_message_id,dispatchKey:event.vortex_w2_dispatch,recipientHash,providerTimestamp:eventTimestamp},fingerprint=createHash('sha256').update(JSON.stringify(evidence)).digest('hex')
   // Provider events have second precision; keep PostgreSQL microseconds when
   // bounding the effective return to its retained source creation timestamps.
   const saved=(await db.query('INSERT INTO payroll_w2_provider_event(event_id,facility_id,publication_id,attempt_id,delivery_id,returned_at,evidence,fingerprint,signed_at) VALUES($1,$2,$3,$4,$5,GREATEST($6::timestamptz,(SELECT created_at FROM payroll_w2_notice_attempt WHERE id=$4),(SELECT created_at FROM email_delivery WHERE id=$5)),$7,$8,$9) ON CONFLICT(event_id) DO NOTHING RETURNING event_id',[event.sg_event_id,source.facility_id,source.publication_id,source.attempt_id,source.delivery_id,returnedAt,evidence,fingerprint,signedAt])).rows[0]
   if(!saved){const prior=(await db.query('SELECT fingerprint FROM payroll_w2_provider_event WHERE event_id=$1',[event.sg_event_id])).rows[0];if(prior.fingerprint!==fingerprint)throw fail('Provider event conflicts with retained evidence.',409)}
   await db.query("UPDATE email_delivery SET status='bounced',bounced_at=CASE WHEN bounced_at IS NULL THEN $2::timestamptz ELSE LEAST(bounced_at,$2::timestamptz) END,updated_at=clock_timestamp() WHERE id=$1",[source.delivery_id,(await db.query('SELECT returned_at::text FROM payroll_w2_provider_event WHERE event_id=$1',[event.sg_event_id])).rows[0].returned_at])
   if(saved)await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'W2_PROVIDER_BOUNCE_RETAINED','w2_notice_attempt',$2,$3)",[source.facility_id,String(source.attempt_id),{eventId:event.sg_event_id,publicationId:Number(source.publication_id)}])
   accepted++
  }
  await db.query('COMMIT');return {accepted,ignored}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
export function registerW2ProviderIntake(app,pool,{publicKey=()=>process.env.PAYROLL_SENDGRID_WEBHOOK_PUBLIC_KEY,now=()=>new Date()}={}){
 app.post(w2ProviderPath,express.raw({type:'application/json',limit:'1mb'}),async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{const raw=Buffer.isBuffer(req.body)?req.body:req.rawBody,result=await retainW2ProviderEvents(pool,raw,{publicKey:publicKey(),signature:req.get('X-Twilio-Email-Event-Webhook-Signature'),timestamp:req.get('X-Twilio-Email-Event-Webhook-Timestamp'),now:now()});res.status(202).json({success:true,data:result})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain provider events.'})}
 })
}
