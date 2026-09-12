import test from 'node:test'
import assert from 'node:assert/strict'
import {carrierRemittanceUnsentEvidence} from '../carrierRemittanceUnsentEvidence.js'
const attempt={id:'1',dispatch_key:'00000000-0000-4000-8000-000000000001',outcome:'NOT_SENT',created_at:'2026-09-17T12:00:00Z',recorded_at:'2026-09-17T12:00:01Z'}
const delivery={id:'1',facility_id:1,recipient_hash:'synthetic-hash',category:'payroll_carrier_remittance',stream:'transactional',template_version:'carrier-remittance-v1',idempotency_key:`carrier-remittance-${attempt.dispatch_key}`,status:'queued',created_at:'2026-09-17T12:00:00Z'}
const evidence=()=>({facilityId:1,noticeId:'synthetic-notice',recipientHash:'synthetic-hash',claimed:true,attempts:[{...attempt}],deliveries:[],returns:[]})
test('non-send proof requires every result and rejects contradictory delivery evidence',()=>{
 assert.equal(carrierRemittanceUnsentEvidence(evidence()).eligible,true)
 for(const status of ['queued','suppressed'])assert.equal(carrierRemittanceUnsentEvidence({...evidence(),deliveries:[{...delivery,status}]}).eligible,true)
 for(const outcome of [null,'UNCERTAIN','SMTP_ACCEPTED'])assert.equal(carrierRemittanceUnsentEvidence({...evidence(),attempts:[{...attempt,outcome}]}).eligible,false)
 for(const status of ['accepted','bounced','complaint','failed','unknown'])assert.equal(carrierRemittanceUnsentEvidence({...evidence(),deliveries:[{...delivery,status}]}).eligible,false)
 for(const patch of [{facility_id:2},{recipient_hash:'foreign'},{category:'other'},{stream:'marketing'},{template_version:'other'},{created_at:'2026-09-17T11:59:59Z'},{accepted_at:'2026-09-17T12:00:02Z'},{bounced_at:'2026-09-17T12:00:02Z'},{complained_at:'2026-09-17T12:00:02Z'}])assert.equal(carrierRemittanceUnsentEvidence({...evidence(),deliveries:[{...delivery,...patch}]}).eligible,false)
 for(const patch of [{claimed:false},{attempts:[]},{reviewed:true},{cancelled:true},{returns:[{eventId:'return'}]},{attempts:[{...attempt,acceptance_reconciled_at:'2026-09-17T12:00:02Z'}]},{deliveries:[delivery,delivery]}])assert.equal(carrierRemittanceUnsentEvidence({...evidence(),...patch}).eligible,false)
})
test('non-send review fingerprint binds all attempts and delivery changes',()=>{
 const source=evidence(),baseline=carrierRemittanceUnsentEvidence(source)
 assert.notEqual(carrierRemittanceUnsentEvidence({...source,deliveries:[delivery]}).fingerprint,baseline.fingerprint)
 assert.notEqual(carrierRemittanceUnsentEvidence({...source,attempts:[...source.attempts,{...attempt,id:'2',dispatch_key:'another-attempt'}]}).fingerprint,baseline.fingerprint)
 assert.equal(carrierRemittanceUnsentEvidence({...source,deliveries:[{...delivery}]}).fingerprint,carrierRemittanceUnsentEvidence({...source,deliveries:[{...delivery}]}).fingerprint)
})
