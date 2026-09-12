import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHarness} from '../testing/harness.js'
for(const initial of ['HOURLY','SALARY'])test(`employment periods retain ${initial} basis across a new hiring offer and migration replay`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const response=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:`BASIS-${initial}`,legalFirstName:'Basis',legalLastName:'History',hireDate:'2026-08-03',hourlyRateCents:2500,...(initial==='SALARY'?{payType:'SALARY',annualSalaryCents:5200000}:{})})})
 assert.equal(response.status,201);const e=(await response.json()).data
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[e.id])
 const next=initial==='HOURLY'?'SALARY':'HOURLY'
 await assert.rejects(()=>h.pool.query('UPDATE payroll_employee SET pay_type=$1 WHERE id=$2',[next,e.id]),/Historical employment pay basis/)
 // Exercise the storage foundation; offer-changing API and calculation routing
 // still require integration before administrators can change pay basis.
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2099-09-07',termination_date=NULL,pay_type=$1 WHERE id=$2",[next,e.id])
 const rows=async()=>(await h.pool.query('SELECT started_on::text,pay_type FROM payroll_employment_period WHERE employee_id=$1 ORDER BY started_on',[e.id])).rows
 assert.deepEqual(await rows(),[{started_on:'2026-08-03',pay_type:initial},{started_on:'2099-09-07',pay_type:next}])
 await assert.rejects(()=>h.pool.query("UPDATE payroll_employment_period SET pay_type=$1 WHERE employee_id=$2 AND started_on='2026-08-03'",[next,e.id]),/Historical employment pay basis/)
 await h.pool.query(await fs.readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'))
 assert.deepEqual(await rows(),[{started_on:'2026-08-03',pay_type:initial},{started_on:'2099-09-07',pay_type:next}])
 const history=await fetch(`${h.url}/api/admin/payroll/employees/${e.id}/employment-periods`,{headers:{Authorization:'Bearer payroll-test-admin'}})
 assert.equal(history.status,200);assert.deepEqual((await history.json()).data.map(p=>p.pay_type),[initial,next])
})
