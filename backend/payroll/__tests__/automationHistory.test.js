import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {recordPayrollAutomation} from '../automationHistory.js'
import {runPayrollComplianceSweep} from '../complianceScheduler.js'
import {ensureEmployerSetup} from '../employerSetup.js'
test('payroll check history records outcomes without secret errors and a facility failure does not stop the sweep',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());await ensureEmployerSetup(h.pool,1);await ensureEmployerSetup(h.pool,2)
 const visits=[]
 await assert.rejects(runPayrollComplianceSweep(h.pool,{workforceRunner:async(db,id)=>{visits.push(Number(id));if(Number(id)===1)throw new Error('sensitive synthetic failure detail');return {employees:0,periods:0,syncs:0}},sourceReviewer:async()=>{}}),AggregateError)
 assert.deepEqual(visits.sort(),[1,2])
 const rows=(await h.pool.query('SELECT * FROM payroll_automation_run ORDER BY facility_id')).rows
 assert.equal(rows[0].status,'FAILED');assert.ok(rows[0].finished_at);assert.ok(!rows[0].error_message.includes('sensitive'))
 assert.equal(rows[1].status,'SUCCEEDED');assert.ok(rows[1].finished_at)
 assert.deepEqual(await recordPayrollAutomation(h.pool,1,'MANUAL',async()=>({syncs:0})),{syncs:0})
 const get=facility=>fetch(`${h.url}/api/admin/payroll/service-readiness`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':String(facility)}})
 const one=(await (await get(1)).json()).data.runs,two=(await (await get(2)).json()).data.runs
 assert.equal(one.length,2);assert.equal(one[0].source,'MANUAL');assert.equal(two.length,1);assert.equal(two[0].status,'SUCCEEDED');assert.ok(!one.some(run=>run.id===two[0].id))
 assert.ok(!JSON.stringify(one).includes('sensitive'))
})

test('check alerts follow the newest completed run of each source despite overlapping completions',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const failure=()=>{throw new Error('Synthetic failure')}
 const alert=async source=>(await h.pool.query('SELECT * FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`payroll-check-${source}`])).rows[0]
 await assert.rejects(recordPayrollAutomation(h.pool,1,'SCHEDULED',failure))
 const initial=await alert('SCHEDULED');assert.equal(initial.status,'OPEN')
 await assert.rejects(recordPayrollAutomation(h.pool,1,'SCHEDULED',failure));assert.equal((await alert('SCHEDULED')).id,initial.id)
 await recordPayrollAutomation(h.pool,1,'MANUAL',async()=>({}));assert.equal((await alert('SCHEDULED')).status,'OPEN')
 let releaseOld,started
 const entered=new Promise(resolve=>{started=resolve})
 const old=recordPayrollAutomation(h.pool,1,'SCHEDULED',async()=>{started();await new Promise(resolve=>{releaseOld=resolve});return {}})
 await entered
 await assert.rejects(recordPayrollAutomation(h.pool,1,'SCHEDULED',failure))
 const newerMessage=(await alert('SCHEDULED')).message
 releaseOld();await old
 assert.equal((await alert('SCHEDULED')).status,'OPEN');assert.equal((await alert('SCHEDULED')).message,newerMessage)
 await recordPayrollAutomation(h.pool,1,'SCHEDULED',async()=>({}));assert.equal((await alert('SCHEDULED')).status,'DISMISSED')
 const enteredFailure=new Promise(resolve=>{started=resolve})
 const lateFailure=recordPayrollAutomation(h.pool,1,'SCHEDULED',async()=>{started();await new Promise(resolve=>{releaseOld=resolve});throw new Error('Old failure')})
 await enteredFailure;await recordPayrollAutomation(h.pool,1,'SCHEDULED',async()=>({}));releaseOld();await assert.rejects(lateFailure)
 assert.equal((await alert('SCHEDULED')).status,'DISMISSED')
 await assert.rejects(recordPayrollAutomation(h.pool,2,'SCHEDULED',failure));assert.equal((await alert('SCHEDULED')).status,'DISMISSED')
})
