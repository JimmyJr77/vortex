import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementDestinationProvider} from '../testing/retirementDestinationProvider.js'
import {retirementRemittanceFixture} from '../testing/retirementRemittanceFixture.js'
import {checkRetirementDestinations} from '../retirementDestinationAutomation.js'
test('automatic destination checks are scoped, due-bound, once-only, alerting and suspension-aware',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api,run}=await retirementRemittanceFixture(h),initial=(await api('/retirement-remittance-sources')).items[0],now=new Date(Date.now()+25*3600000),options={fetcher:provider.fetcher,now}
 assert.equal((await checkRetirementDestinations(h.pool,2,options)).checked,0)
 provider.change(true)
 const [a,b]=await Promise.all([checkRetirementDestinations(h.pool,1,options),checkRetirementDestinations(h.pool,1,options)]);assert.equal(a.checked+b.checked,1);assert.equal(a.needsReview+b.needsReview,1)
 const records=(await h.pool.query('SELECT status,automatic,created_by FROM payroll_retirement_destination_check ORDER BY id')).rows;assert.equal(records.at(-1).status,'CHANGED');assert.equal(records.at(-1).automatic,true);assert.equal(records.at(-1).created_by,null)
 const alerts=await h.pool.query("SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key='retirement-destination-standard'");assert.equal(alerts.rows[0].status,'OPEN')
 const changed=(await api('/retirement-remittance-sources')).items[0];assert.equal(changed.allocations[0].destinationReview.status,'ACCOUNT_REVIEW_REQUIRED');assert.notEqual(changed.sourceFingerprint,initial.sourceFingerprint)
 provider.change(false)
 await api(`/runs/${run.id}/retirement-remittance/preview`,{planId:'standard',sourceFingerprint:changed.sourceFingerprint},'POST',409)
 assert.equal((await checkRetirementDestinations(h.pool,1,{...options,now:new Date(+now+299000)})).checked,0)
 const recovered=await checkRetirementDestinations(h.pool,1,{...options,now:new Date(+now+300000)});assert.equal(recovered.verified,1)
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key='retirement-destination-standard'")).rows[0].status,'DISMISSED')
 const fresh=(await api('/retirement-remittance-sources')).items[0];await api(`/runs/${run.id}/retirement-remittance/preview`,{planId:'standard',sourceFingerprint:fresh.sourceFingerprint})
 assert.equal((await checkRetirementDestinations(h.pool,1,{...options,now:new Date(+now+600000)})).checked,0)
 const base='/retirement-plans/standard/destination',d=await api(base),id=d.history[0].id
 await api(`${base}/${id}/suspend`,{requestKey:randomUUID(),confirmed:true,reference:'Suspend destination pending independent trustee investigation'})
 const reads=provider.reads();assert.equal((await checkRetirementDestinations(h.pool,1,{...options,now:new Date(+now+48*3600000)})).checked,0);assert.equal(provider.reads(),reads)
 await assert.rejects(h.pool.query("INSERT INTO payroll_retirement_destination_check(destination_id,status,automatic,created_by) VALUES($1,'VERIFIED',true,99)",[id]),/check constraint/)
 assert.equal(provider.posts(),0)
})

test('automatic checks retain unavailable vault evidence and promptly flag changed plan configuration',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY,key=randomBytes(32).toString('hex');process.env.PAYROLL_DOCUMENT_KEY=key
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api}=await retirementRemittanceFixture(h),now=new Date(Date.now()+25*3600000),options={fetcher:provider.fetcher,now},reads=provider.reads()
 delete process.env.PAYROLL_DOCUMENT_KEY
 assert.equal((await checkRetirementDestinations(h.pool,1,options)).needsReview,1);assert.equal(provider.reads(),reads)
 assert.equal((await api('/retirement-plans/standard/destination')).history[0].verification.status,'UNAVAILABLE')
 process.env.PAYROLL_DOCUMENT_KEY=key
 assert.equal((await checkRetirementDestinations(h.pool,1,{...options,now:new Date(+now+300000)})).verified,1)
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),name:'Changed reviewed retirement plan'},expectedRevision:1,requestKey:randomUUID()})
 const before=provider.reads()
 assert.equal((await checkRetirementDestinations(h.pool,1,{...options,now:new Date(+now+600000)})).needsReview,1)
 assert.equal(provider.reads(),before);assert.equal((await api('/retirement-plans/standard/destination')).history[0].verification.status,'PLAN_CHANGED')
})
