import test from 'node:test'
import assert from 'node:assert/strict'
import {generatePayPeriods} from '../payCalendar.js'
const settings={pay_frequency:'WEEKLY',pay_period_anchor_start:'2026-01-05',pay_period_payment_lag_days:5}
test('weekly periods retain their anchored workweeks and pay dates move before bank holidays',()=>{
 const periods=generatePayPeriods(2026,7,settings)
 assert.equal(periods.length,5)
 assert.deepEqual(periods[0],{periodStart:'2026-06-22',periodEnd:'2026-06-28',nominalPayDate:'2026-07-03',payDate:'2026-07-03',frequency:'WEEKLY'})
 assert.equal(generatePayPeriods(2026,12,settings).find(p=>p.nominalPayDate==='2026-12-25').payDate,'2026-12-24')
 for(let i=1;i<periods.length;i++)assert.equal(Date.parse(periods[i].periodStart)-Date.parse(periods[i-1].periodEnd),86400000)
})
test('biweekly anchors continue across months and years without overlapping periods',()=>{
 const config={...settings,pay_frequency:'BIWEEKLY'}
 const periods=[...generatePayPeriods(2025,12,config),...generatePayPeriods(2026,1,config),...generatePayPeriods(2026,2,config)]
 assert.ok(periods.length>=6)
 for(let i=1;i<periods.length;i++)assert.equal(Date.parse(periods[i].periodStart)-Date.parse(periods[i-1].periodEnd),86400000)
 assert.ok(periods.every(p=>Date.parse(p.periodEnd)-Date.parse(p.periodStart)===13*86400000))
})
test('monthly periods cover complete calendar months and preserve nominal payment-month selection',()=>{
 const result=generatePayPeriods(2026,3,{pay_frequency:'MONTHLY',pay_period_payment_lag_days:5})
 assert.deepEqual(result,[{periodStart:'2026-02-01',periodEnd:'2026-02-28',nominalPayDate:'2026-03-05',payDate:'2026-03-05',frequency:'MONTHLY'}])
 const leap=generatePayPeriods(2024,3,{pay_frequency:'MONTHLY',pay_period_payment_lag_days:5})
 assert.equal(leap[0].periodEnd,'2024-02-29')
})
test('non-semimonthly schedules require explicit valid anchor and lag configuration',()=>{
 for(const config of [{...settings,pay_period_anchor_start:null},{...settings,pay_period_anchor_start:'2026-02-30'},{...settings,pay_period_payment_lag_days:0},{...settings,pay_period_payment_lag_days:32}])assert.throws(()=>generatePayPeriods(2026,1,config),e=>e.status===409)
 assert.throws(()=>generatePayPeriods(2026,1,{pay_frequency:'MONTHLY',pay_period_payment_lag_days:1}),e=>e.status===409)
 assert.throws(()=>generatePayPeriods(2026,13,settings),e=>e.status===400)
 assert.equal(generatePayPeriods(2026,1,{pay_frequency:'SEMIMONTHLY',semimonthly_first_day:5,semimonthly_second_day:20}).length,2)
})
test('admin period generation follows configured frequency and requires its schedule details',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const {createHarness}=await import('../testing/harness.js'),h=await createHarness();t.after(()=>h.close())
 const generate=async()=>{const response=await fetch(`${h.url}/api/admin/payroll/pay-periods/generate`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({year:2026,month:7})});return {status:response.status,data:(await response.json()).data}}
 await h.pool.query("UPDATE payroll_settings SET pay_frequency='BIWEEKLY' WHERE facility_id=1")
 assert.equal((await generate()).status,409)
 await h.pool.query("UPDATE payroll_settings SET pay_period_anchor_start='2026-01-05',pay_period_payment_lag_days=5 WHERE facility_id=1")
 const first=await generate(),again=await generate()
 assert.equal(first.status,201);assert.equal(first.data.length,2)
 assert.ok(first.data.every(p=>p.frequency==='BIWEEKLY'))
 assert.deepEqual(first.data.map(p=>p.id),again.data.map(p=>p.id))
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_pay_period WHERE facility_id=2')).rows[0].n,0)
 await h.pool.query("UPDATE payroll_settings SET pay_frequency='WEEKLY' WHERE facility_id=1")
 assert.equal((await generate()).status,409)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_pay_period WHERE facility_id=1')).rows[0].n,2)
 assert.ok((await h.pool.query('SELECT frequency FROM payroll_pay_period WHERE facility_id=1')).rows.every(p=>p.frequency==='BIWEEKLY'))
 await h.pool.query("UPDATE payroll_pay_period SET status='VOID' WHERE facility_id=1")
 assert.equal((await generate()).status,409)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_pay_period WHERE facility_id=1')).rows[0].n,2)
})
test('automation generates anchored periods atomically, preserves payment overrides and recovers configuration alerts',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const {createHarness}=await import('../testing/harness.js'),{runWorkforceAutomation}=await import('../workforceAutomation.js')
 const h=await createHarness();t.after(()=>h.close())
 const options={now:new Date('2026-07-01T12:00:00Z'),sync:false}
 await h.pool.query("UPDATE payroll_settings SET pay_frequency='BIWEEKLY' WHERE facility_id=1")
 let result=await runWorkforceAutomation(h.pool,1,options)
 assert.equal(result.periods,0)
 const alert=async()=>(await h.pool.query("SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key='pay-calendar-configuration'")).rows[0]?.status
 assert.equal(await alert(),'OPEN')
 await h.pool.query("UPDATE payroll_settings SET pay_period_anchor_start='2026-01-05',pay_period_payment_lag_days=5 WHERE facility_id=1")
 result=await runWorkforceAutomation(h.pool,1,options)
 assert.ok(result.periods>=6);assert.equal(await alert(),'DISMISSED')
 const periods=(await h.pool.query('SELECT * FROM payroll_pay_period WHERE facility_id=1 ORDER BY period_start')).rows
 assert.ok(periods.every(p=>p.frequency==='BIWEEKLY'))
 await h.pool.query("UPDATE payroll_pay_period SET pay_date=pay_date+1 WHERE id=$1",[periods[0].id])
 const repeated=await runWorkforceAutomation(h.pool,1,options)
 assert.equal(repeated.periods,0)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='PAY_CALENDAR_GENERATED' AND facility_id=1")).rows[0].n,1)
 assert.equal((await h.pool.query('SELECT pay_date::text AS date FROM payroll_pay_period WHERE id=$1',[periods[0].id])).rows[0].date,new Date(new Date(periods[0].pay_date).getTime()+86400000).toISOString().slice(0,10))
 await h.pool.query("UPDATE payroll_settings SET pay_frequency='WEEKLY' WHERE facility_id=1")
 result=await runWorkforceAutomation(h.pool,1,options)
 assert.equal(result.periods,0);assert.equal(await alert(),'OPEN')
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_pay_period WHERE facility_id=1')).rows[0].n,periods.length)
})
test('initial schedule setup previews without changes, replaces unused periods and preserves used payroll',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const {createHarness}=await import('../testing/harness.js'),h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const response=await fetch(`${h.url}/api/admin/payroll/pay-schedule/${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const body={frequency:'BIWEEKLY',anchorStart:'2026-01-05',paymentLagDays:5,source:'Synthetic published employee schedule',confirmed:true}
 const preview=await api('preview',body);assert.ok(preview.periods.length>=6)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_pay_period')).rows[0].n,0)
 await api('configure',{...body,confirmed:false},400)
 await api('configure',body)
 assert.equal((await h.pool.query('SELECT pay_frequency FROM payroll_settings WHERE facility_id=1')).rows[0].pay_frequency,'BIWEEKLY')
 await api('configure',{...body,frequency:'WEEKLY'})
 const periods=(await h.pool.query('SELECT * FROM payroll_pay_period WHERE facility_id=1')).rows
 assert.ok(periods.every(p=>p.frequency==='WEEKLY'))
 await h.pool.query('INSERT INTO payroll_run(facility_id,pay_period_id) VALUES(1,$1)',[periods[0].id])
 await api('configure',body,409)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_pay_period WHERE facility_id=1')).rows[0].n,periods.length)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='PAY_SCHEDULE_CONFIGURED'")).rows[0].n,2)
})
test('dated schedule history retains prior frequency and rejects a mid-period cutover',async()=>{
 const {generateVersionedPayPeriods}=await import('../payCalendar.js')
 const old={pay_frequency:'SEMIMONTHLY',semimonthly_first_day:5,semimonthly_second_day:20}
 const next={pay_frequency:'WEEKLY',pay_period_anchor_start:'2026-09-16',pay_period_payment_lag_days:5}
 const versions=[{effective_on:'2000-01-01',schedule_settings:old},{effective_on:'2026-09-16',schedule_settings:next}]
 const september=generateVersionedPayPeriods(2026,9,next,versions)
 assert.deepEqual(september.map(p=>[p.periodStart,p.frequency]),[['2026-08-16','SEMIMONTHLY'],['2026-09-01','SEMIMONTHLY'],['2026-09-16','WEEKLY']])
 const october=generateVersionedPayPeriods(2026,10,next,versions)
 assert.ok(october.every(p=>p.frequency==='WEEKLY'))
 assert.equal(october[0].periodStart,'2026-09-23')
 assert.throws(()=>generateVersionedPayPeriods(2026,9,next,[versions[0],{...versions[1],effective_on:'2026-09-10',schedule_settings:{...next,pay_period_anchor_start:'2026-09-10'}}]),/splits an existing period/)
 assert.throws(()=>generateVersionedPayPeriods(2026,9,next,[versions[0],versions[0]]),/duplicate/)
 assert.throws(()=>generateVersionedPayPeriods(2026,9,next,[versions[0],{...versions[1],schedule_settings:{...next,pay_period_anchor_start:'2026-09-17'}}]),/without a gap/)
})
