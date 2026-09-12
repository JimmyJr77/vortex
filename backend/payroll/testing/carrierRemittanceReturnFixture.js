import {generateKeyPairSync,sign,randomUUID} from 'node:crypto'
import {carrierRemittanceFixture} from './carrierRemittanceFixture.js'
import {hashEmail} from '../../email/emailDeliveryStore.js'
import {retainW2ProviderEvents} from '../w2NoticeProviderIntake.js'
import {runCarrierRemittanceSweep} from '../carrierRemittanceAutomation.js'
export async function carrierRemittanceReturnFixture(){
 const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),sent=[]
 const sender=async mail=>{
  const attempt=(await f.h.pool.query("SELECT created_at FROM payroll_carrier_remittance_attempt WHERE 'carrier-remittance-'||dispatch_key::text=$1",[mail.idempotencyKey])).rows[0]
  await f.h.pool.query("INSERT INTO email_delivery(facility_id,recipient_hash,category,stream,template_version,status,idempotency_key,provider,created_at,accepted_at) VALUES(1,$1,'payroll_carrier_remittance','transactional','carrier-remittance-v1','accepted',$2,'smtp:sendgrid',$3,$3)",[hashEmail(mail.to),mail.idempotencyKey,attempt.created_at]);sent.push(mail)
  return {sent:true,messageId:`synthetic-${sent.length}`}
 }
 const f=await carrierRemittanceFixture({sender})
 try{
  await f.h.pool.query('CREATE TABLE email_delivery(id BIGSERIAL PRIMARY KEY,facility_id BIGINT,recipient_hash TEXT,category TEXT,stream TEXT,template_version TEXT,status TEXT,idempotency_key TEXT,provider TEXT,created_at TIMESTAMPTZ,accepted_at TIMESTAMPTZ,bounced_at TIMESTAMPTZ,complained_at TIMESTAMPTZ,updated_at TIMESTAMPTZ)')
  const sweep=()=>runCarrierRemittanceSweep(f.h.pool,{facility:1,now:f.now(),sender})
  const returnNotice=async(noticeId=f.notice.id,kind='bounce')=>{
   const source=(await f.h.pool.query("SELECT d.idempotency_key,a.created_at FROM payroll_carrier_remittance_attempt a JOIN email_delivery d ON d.idempotency_key='carrier-remittance-'||a.dispatch_key::text WHERE a.notice_id=$1 ORDER BY a.id DESC LIMIT 1",[noticeId])).rows[0]
   const mail=sent.find(row=>row.idempotencyKey===source.idempotency_key),now=new Date(Math.max(+f.now(),+new Date(source.created_at))+2000);f.setNow(now)
   const timestamp=String(Math.floor(+now/1000)),eventId=randomUUID(),raw=Buffer.from(JSON.stringify([{event:kind,email:mail.to,vortex_carrier_dispatch:source.idempotency_key,sg_event_id:eventId,timestamp:Number(timestamp)}]))
   await retainW2ProviderEvents(f.h.pool,raw,{now,timestamp,publicKey:keys.publicKey.export({type:'spki',format:'pem'}),signature:sign('sha256',Buffer.concat([Buffer.from(timestamp),raw]),keys.privateKey).toString('base64')})
   return eventId
  }
  await sweep();await returnNotice()
  return {...f,sender,sent,sweep,returnNotice}
 }catch(e){await f.h.close();throw e}
}
