import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementDestinationProvider,id} from '../testing/retirementDestinationProvider.js'
import {retirementRemittanceFixture} from '../testing/retirementRemittanceFixture.js'
import {readRetirementDestination} from '../retirementDestination.js'
test('destination suspension works offline, invalidates remittance and stale replacement previews, and retains history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY,fixtureKey=randomBytes(32).toString('hex');process.env.PAYROLL_DOCUMENT_KEY=fixtureKey
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api,run}=await retirementRemittanceFixture(h),base='/retirement-plans/standard/destination',d=await api(base),destination=d.history[0],input={planRevisionId:d.planRevisionId,connectionRevision:d.connectionRevision,accountId:id(3)},replacement=await api(base+'/preview',input)
 const source=(await api('/retirement-remittance-sources')).items[0],previewPath=`/runs/${run.id}/retirement-remittance/preview`,previewBody={planId:'standard',sourceFingerprint:source.sourceFingerprint}
 await api(previewPath,previewBody)
 const path=`${base}/${destination.id}/suspend`,body={confirmed:true,reference:'Trustee instructions require investigation before further remittance',requestKey:randomUUID()}
 const reads=provider.reads()
 provider.unavailable(true);delete process.env.PAYROLL_DOCUMENT_KEY
 const [a,b]=await Promise.all([api(path,body),api(path,body)]);assert.equal(a.id,b.id);assert.equal(provider.reads(),reads)
 assert.equal((await api(base)).history[0].suspension.id,a.id)
 await api(path,{...body,requestKey:randomUUID()},'POST',409)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).status,401)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(body)})).status,404)
 await assert.rejects(readRetirementDestination(h.pool,1,destination.id),{status:409})
 process.env.PAYROLL_DOCUMENT_KEY=fixtureKey
 provider.unavailable(false)
 const suspendedSource=(await api('/retirement-remittance-sources')).items[0]
 assert.equal(suspendedSource.allocations[0].destinationReview.status,'SUSPENDED');assert.notEqual(suspendedSource.sourceFingerprint,source.sourceFingerprint)
 await api(previewPath,previewBody,'POST',409)
 await api(previewPath,{...previewBody,sourceFingerprint:suspendedSource.sourceFingerprint},'POST',409)
 const save={...input,...replacement,requestKey:randomUUID(),confirmed:true,reference:'New independently reviewed trustee instructions after investigation'}
 await api(base,save,'POST',409)
 const fresh=await api(base+'/preview',input),next=await api(base,{...save,...fresh,requestKey:randomUUID()})
 assert.equal(next.revision,2);assert.equal((await api(base)).history[1].suspension.id,a.id)
 const restored=(await api('/retirement-remittance-sources')).items[0];assert.equal(restored.allocations[0].destinationReview.status,'REVIEWED');await api(previewPath,{...previewBody,sourceFingerprint:restored.sourceFingerprint})
 assert.equal((await api(path,body)).id,a.id);await assert.rejects(readRetirementDestination(h.pool,1,destination.id),{status:409})
 await api(path,{...body,reference:'A different suspension reference for the same request'},'POST',409)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_destination_suspension'),/append-only/)
 await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_destination_suspension(id,facility_id,destination_id,reference,request_key,request_fingerprint,created_by) VALUES($1,2,$2,$3,$4,$5,99)',[randomUUID(),next.id,body.reference,randomUUID(),'synthetic']),/current scoped retirement destination/)
 assert.equal(provider.posts(),0)
})
