import {createPublicKey,verify} from 'node:crypto'
const dispatchKey=/^w2-notice-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
// SendGrid echoes SMTP unique_args in its signed event payload. Only an opaque
// dispatch key belongs there; never employee identity, tax or payment details.
export function w2NoticeSmtpTracking({category,idempotencyKey,host=process.env.SMTP_HOST}={}){
 if(category!=='payroll_w2_notice'||String(host||'smtp.gmail.com').trim().toLowerCase()!=='smtp.sendgrid.net')return null
 if(typeof idempotencyKey!=='string'||!dispatchKey.test(idempotencyKey))throw fail('A retained W-2 notice dispatch key is required.',409)
 return {provider:'smtp:sendgrid',headers:{'X-SMTPAPI':JSON.stringify({unique_args:{vortex_w2_dispatch:idempotencyKey}})}}
}
// Verify exact request bytes before parsing. Event-ID deduplication belongs in
// durable intake: a legitimate provider retry may carry an older signed timestamp.
export function verifyW2NoticeProviderEvents(raw,{signature,timestamp,publicKey,now=new Date()}={}){
 if(!Buffer.isBuffer(raw)||!raw.length||raw.length>1024*1024)throw fail('Invalid provider event body.')
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw fail('Invalid verification time.')
 if(typeof timestamp!=='string'||!/^\d{1,12}$/.test(timestamp)||!Number.isSafeInteger(Number(timestamp))||Number(timestamp)*1000>now.getTime()+300000)throw fail('Invalid provider signature timestamp.',401)
 if(typeof signature!=='string'||signature.length>256||!signature.length||Buffer.from(signature,'base64').toString('base64')!==signature)throw fail('Invalid provider signature.',401)
 const key=w2NoticeProviderPublicKey(publicKey)
 let valid=false
 try{valid=verify('sha256',Buffer.concat([Buffer.from(timestamp,'utf8'),raw]),key,Buffer.from(signature,'base64'))}catch{/* Malformed DER signatures are untrusted input. */}
 if(!valid)throw fail('Invalid provider signature.',401)
 let events
 try{events=JSON.parse(raw.toString('utf8'))}catch{throw fail('Invalid provider event JSON.')}
 if(!Array.isArray(events)||!events.length||events.length>1000||events.some(e=>!e||typeof e!=='object'||Array.isArray(e)))throw fail('Invalid provider event batch.')
 return {events,signedAt:new Date(Number(timestamp)*1000).toISOString()}
}

export function w2NoticeProviderPublicKey(publicKey){
 let key
 try{
  if(typeof publicKey!=='string'||!publicKey.trim())throw new Error()
  key=publicKey.includes('BEGIN PUBLIC KEY')?createPublicKey(publicKey):createPublicKey({key:Buffer.from(publicKey.trim(),'base64'),format:'der',type:'spki'})
  if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw new Error()
 }catch{throw fail('Provider signature verification is not configured.',503)}
 return key
}
