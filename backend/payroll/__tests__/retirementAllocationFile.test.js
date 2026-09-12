import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementDestinationProvider} from '../testing/retirementDestinationProvider.js'
import {retirementAllocationFixture,allocationFormatFixture} from '../testing/retirementAllocationFixture.js'
import {retirementAllocationFormatInput} from '../retirementAllocationFormat.js'
import {retirementAllocationCsv} from '../retirementAllocationFile.js'
test('allocation CSV preserves exact cents, identifiers, selected order and CRLF quoting',()=>{
 const input=allocationFormatFixture(),row={providerPlanId:'001234',participantId:'P,"123"',withheldDate:'2026-09-18',ordinaryPretaxCents:1001,ordinaryRothCents:400,catchUpPretaxCents:2,catchUpRothCents:0,totalCents:1403}
 const csv=retirementAllocationCsv(retirementAllocationFormatInput(input),[row]);assert.equal(csv.split('\r\n')[1],'"001234","P,""123""","2026-09-18","10.01","4.00","0.02","0.00","14.03"')
 const cents=retirementAllocationCsv(retirementAllocationFormatInput({...input,amountFormat:'CENTS',dateFormat:'US',includeHeader:false,columns:[...input.columns].reverse()}),[row]);assert.equal(cents,'"1403","0","2","400","1001","09/18/2026","P,""123""","001234"\r\n')
 assert.throws(()=>retirementAllocationCsv(retirementAllocationFormatInput(input),[{...row,totalCents:1404}]),/reconcile/)
 for(const id of ['=1+1','+123','@SUM(A1)','-1','P\n123'])assert.throws(()=>retirementAllocationCsv(retirementAllocationFormatInput(input),[{...row,participantId:id}]),/identifier/)
})
test('allocation format requires the complete independently reviewed structure',()=>{
 const b=allocationFormatFixture()
 for(const change of [{confirmed:false},{amountFormat:'FLOAT'},{includeHeader:null},{columns:b.columns.slice(1)},{columns:b.columns.map(c=>({...c,header:'duplicate'}))},{columns:b.columns.map(c=>({...c,header:'=formula'}))}])assert.throws(()=>retirementAllocationFormatInput({...b,...change}))
 assert.deepEqual(retirementAllocationFormatInput({...b,disposition:'SUSPENDED'}),{disposition:'SUSPENDED',reference:b.reference})
})
test('reviewed allocations download exact reconciled amounts, hide identifiers in previews and reject stale evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api,run,formatPath,planRevisionId}=await retirementAllocationFixture(h),path=`/runs/${run.id}/retirement-allocation-file`,source=async()=>(await api('/retirement-remittance-sources')).items[0]
 await api(path,{planId:'standard',sourceFingerprint:(await source()).sourceFingerprint},'POST',409)
 const b={format:allocationFormatFixture(),planRevisionId,expectedRevision:0,requestKey:randomUUID()},[a,c]=await Promise.all([api(formatPath,b),api(formatPath,b)])
 assert.equal(a.id,c.id);assert.equal((await api(formatPath)).history.length,1)
 await api(formatPath,{...b,format:{...b.format,dateFormat:'US'}},'POST',409)
 const sourceFingerprint=(await source()).sourceFingerprint,body={planId:'standard',sourceFingerprint},preview=await api(path,body)
 assert.equal(preview.rowCount,1);assert.equal(preview.amountCents,1400);assert.equal(preview.status,'PREPARED_NOT_SENT')
 assert.ok(!JSON.stringify(preview).includes('PRIVATE-PARTICIPANT-54321'));assert.ok(!JSON.stringify(preview).includes('PRIVATE-PLAN-10001'))
 const download=async(payload,facility=1)=>fetch(`${h.url}/api/admin/payroll${path}/download`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:JSON.stringify(payload)})
 const r=await download({...body,fingerprint:preview.fingerprint});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const csv=await r.text();assert.match(csv,/"PRIVATE-PLAN-10001","PRIVATE-PARTICIPANT-54321","2026-09-18","10.00","4.00","0.00","0.00","14.00"/)
 assert.equal((await download({...body,fingerprint:preview.fingerprint},2)).status,404)
 const anonymous=await fetch(`${h.url}/api/admin/payroll${path}/download`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,fingerprint:preview.fingerprint})});assert.equal(anonymous.status,401)
 const audit=(await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='RETIREMENT_ALLOCATION_DOWNLOADED'")).rows;assert.equal(audit.length,1);assert.ok(!JSON.stringify(audit).includes('PRIVATE-PARTICIPANT'))
 provider.change(true);assert.equal((await download({...body,fingerprint:preview.fingerprint})).status,409);provider.change(false)
 await api(formatPath,{...b,format:{...b.format,amountFormat:'CENTS'},expectedRevision:1,requestKey:randomUUID()})
 assert.notEqual((await source()).sourceFingerprint,sourceFingerprint);assert.equal((await download({...body,sourceFingerprint:(await source()).sourceFingerprint,fingerprint:preview.fingerprint})).status,409)
 await api(formatPath,b);assert.equal((await api(formatPath)).history.length,2)
 const timing=await api('/retirement-plans/standard/timing');await api('/retirement-plans/standard/timing',{planRevisionId,expectedRevision:timing.history[0].revision,requestKey:randomUUID(),policy:{effectiveOn:'2026-01-01',disposition:'SUSPENDED',reference:'Suspend timing while provider receipt agreement is investigated',confirmed:true}})
 await api(path,{planId:'standard',sourceFingerprint:(await source()).sourceFingerprint},'POST',409)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_allocation_format WHERE id=$1',[a.id]),/immutable|append|cannot|not allowed/i)
 await api(formatPath,{...b,format:{...b.format,disposition:'SUSPENDED'},expectedRevision:2,requestKey:randomUUID()})
 await api(path,{planId:'standard',sourceFingerprint:(await source()).sourceFingerprint},'POST',409)
 assert.equal(provider.posts(),0)
})
