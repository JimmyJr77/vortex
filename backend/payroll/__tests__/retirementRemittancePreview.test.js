import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementDestinationProvider} from '../testing/retirementDestinationProvider.js'
import {retirementRemittanceFixture} from '../testing/retirementRemittanceFixture.js'
test('retirement remittance preview binds exact deductions, current participant mapping and fresh destination',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api,run,mappingPath}=await retirementRemittanceFixture(h),source=(await api('/retirement-remittance-sources')).items[0],path=`/runs/${run.id}/retirement-remittance/preview`,body={planId:'standard',sourceFingerprint:source.sourceFingerprint}
 const p=await api(path,body);assert.equal(p.status,'PREVIEW_ONLY');assert.equal(p.amountCents,1400);assert.equal(p.allocations[0].ordinaryPretaxCents,1000);assert.equal(p.allocations[0].ordinaryRothCents,400);assert.equal(p.destination.accountLast4,'1234');assert.equal((await api(path,body)).fingerprint,p.fingerprint)
 assert.ok(!JSON.stringify(p).includes('PRIVATE-PLAN'));assert.ok(!JSON.stringify(p).includes('PRIVATE-PARTICIPANT'));assert.ok(p.remainingRequirements.length>0)
 await api(path,{...body,sourceFingerprint:'0'.repeat(64)},'POST',409);await api(path,{...body,planId:'missing'},'POST',409)
 provider.change(true);await api(path,body,'POST',409);provider.change(false);provider.unavailable(true);await api(path,body,'POST',409);provider.unavailable(false)
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(foreign.status,404)
 const mapping=await api(mappingPath);await api(mappingPath,{sourceFingerprint:mapping.source.fingerprint,expectedRevision:1,requestKey:randomUUID(),disposition:'SUSPENDED',reference:'Suspended pending recordkeeper identity reconciliation',confirmed:true})
 await api(path,body,'POST',409);const fresh=(await api('/retirement-remittance-sources')).items[0];await api(path,{...body,sourceFingerprint:fresh.sourceFingerprint},'POST',409)
 assert.equal(provider.posts(),0)
})
