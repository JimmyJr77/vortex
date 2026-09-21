import {createHistoricalHarness} from '../testing/historicalHarness.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {initPayrollTables} from '../initTables.js'
import {carrierRemittanceReturnFixture} from '../testing/carrierRemittanceReturnFixture.js'
import {processCarrierRemittance} from '../carrierRemittanceDispatch.js'
for(const [sameAddress,regressed] of [[false,false],[true,false],[true,true]])test(`carrier returned notice resolution and replacement: ${sameAddress?'restored address':'corrected address'}${regressed?' with backwards review clock':''}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const prior=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='31'.repeat(32);t.after(()=>{if(prior===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=prior})
 const f=await carrierRemittanceReturnFixture({harness:options=>createHistoricalHarness(t,options)});t.after(()=>f.h.close());const {api,h,noticePath}=f,reviewPath=`${noticePath}/${f.notice.id}/return-review`
 if(regressed)await h.pool.query("CREATE FUNCTION carrier_review_test_clock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.previous_review_id IS NOT NULL THEN NEW.created_at=clock_timestamp()-interval '1 hour'; END IF; RETURN NEW; END $$; CREATE TRIGGER carrier_review_test_clock BEFORE INSERT ON payroll_carrier_remittance_return_review FOR EACH ROW EXECUTE FUNCTION carrier_review_test_clock();")
 await api(`${reviewPath}/preview`,{},'POST',409)
 const contact=await api(f.recipientPath,{...f.recipientBody,email:sameAddress?'carrier@example.test':'corrected@example.test',expectedRevision:1,requestKey:randomUUID(),reference:'Carrier contacted after return and requested remittance delivery'})
 assert.equal(contact.revision,2)
 let preview=await api(`${reviewPath}/preview`,{})
 if(sameAddress){await f.returnNotice(f.notice.id,'spamreport');await api(reviewPath,{fingerprint:preview.fingerprint,reference:'Investigated and documented the carrier request',confirmed:true,recipientRequestedDelivery:true,requestKey:randomUUID()},'POST',409);preview=await api(`${reviewPath}/preview`,{})}
 const body={fingerprint:preview.fingerprint,reference:'Investigated provider return and independently confirmed carrier delivery request',confirmed:true,recipientRequestedDelivery:true,requestKey:randomUUID()}
 await api(reviewPath,{...body,recipientRequestedDelivery:false},'POST',400)
 const results=await Promise.all([api(reviewPath,body),api(reviewPath,body)]);assert.equal(results[0].id,results[1].id)
 await api(reviewPath,{...body,reference:'Changed reference with same idempotency request'},'POST',409)
 assert.equal((await api(noticePath)).history[0].status,'REPLACEMENT_REVIEWED');assert.equal((await api(noticePath)).history[0].returnReviews.length,1)
 assert.equal((await processCarrierRemittance(h.pool,1,f.notice.id,{sender:f.sender,now:f.now()})).status,'REPLACEMENT_REVIEWED');assert.equal(f.sent.length,1)
 assert.equal((await f.sweep()).checked,0)
 const nextPreview=await api(`${noticePath}/preview`,{}),nextBody={fingerprint:nextPreview.fingerprint,confirmed:true,reference:'Separate exact replacement notice authorization',requestKey:randomUUID()}
 const next=await api(noticePath,nextBody)
 if(sameAddress){
  await f.returnNotice(f.notice.id,'dropped');await f.sweep();assert.equal(f.sent.length,1);assert.equal((await api(noticePath)).history.find(row=>row.id===next.id).status,'BLOCKED')
  await api(`${noticePath}/${next.id}/cancel`,{confirmed:true,reference:'Cancel stale replacement before any new delivery'})
  const refreshed=await api(`${reviewPath}/preview`,{}),renewedReview=await api(reviewPath,{...body,fingerprint:refreshed.fingerprint,requestKey:randomUUID()})
  assert.equal((await api(`${reviewPath}/preview`,{})).previousReviewId,renewedReview.id)
  const rejectStale=()=>assert.rejects(h.pool.query('INSERT INTO payroll_carrier_remittance_return_review(id,facility_id,notice_id,recipient_id,target_recipient_hash,source_event_ids,target_event_ids,recipient_requested_delivery,previous_review_id,reference,request_key,request_fingerprint,created_by) SELECT $1,facility_id,notice_id,recipient_id,target_recipient_hash,source_event_ids,target_event_ids,recipient_requested_delivery,previous_review_id,reference,$2,request_fingerprint,created_by FROM payroll_carrier_remittance_return_review WHERE id=$3',[randomUUID(),randomUUID(),renewedReview.id]),/Carrier return review changed/)
  await rejectStale();await initPayrollTables(h.pool);await rejectStale()
  assert.equal((await api(`${reviewPath}/preview`,{})).previousReviewId,renewedReview.id)
  const renewed=await api(`${noticePath}/preview`,{});const replacement=await api(noticePath,{...nextBody,fingerprint:renewed.fingerprint,requestKey:randomUUID()});next.id=replacement.id
 }
 await f.sweep();assert.equal(f.sent.length,2);assert.equal(f.sent[1].to,sameAddress?'carrier@example.test':'corrected@example.test');assert.equal((await api(noticePath)).history.find(row=>row.id===next.id).status,'SMTP_ACCEPTED')
 await f.returnNotice(next.id,'bounce');assert.equal((await api(noticePath)).history.find(row=>row.id===next.id).status,'RETURNED')
 await api(`${noticePath}/${next.id}/return-review/preview`,{},'POST',409)
 const foreign=await fetch(`${h.url}/api/admin/payroll${reviewPath}/preview`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:'{}'});assert.equal(foreign.status,404)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_remittance_return_review'),/append-only/)
 await initPayrollTables(h.pool)
 assert.equal((await api(noticePath)).history.find(row=>row.id===f.notice.id).status,'REPLACEMENT_REVIEWED')
})
