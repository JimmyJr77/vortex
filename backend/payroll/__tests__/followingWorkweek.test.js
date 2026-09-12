import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('payroll collects following workweek context without paying future-period or unrelated-week hours',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'FOLLOWING-WEEK',legalFirstName:'Following',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
 for(const [date,status] of [['2026-09-15','APPROVED'],['2026-09-16','UNVERIFIED'],['2026-09-21','APPROVED']])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN',$4)",[employee.id,`${date}T14:00:00Z`,`${date}T15:00:00Z`,status])
 const periods=await api('/pay-periods/generate',{year:2026,month:9},201),period=periods.find(p=>String(p.period_start).startsWith('2026-09-01'))
 const preview=(await api('/runs/preview',{payPeriodId:period.id})).preview.employees[0]
 assert.equal(preview.regularMinutes,60);assert.equal(preview.regularPayCents,2500)
 assert.equal(preview.entries.length,1)
 assert.equal(preview.followingWorkweekEntries.length,1)
 assert.equal(preview.followingWorkweekEntries[0].minutes,60)
 assert.equal(preview.followingWorkweekEntries[0].status,'UNVERIFIED')
 assert.equal(preview.followingWorkweekEntries[0].week,'2026-09-14')
 assert.equal(preview.warnings.some(w=>w.code==='UNAPPROVED_TIME'),false)
 assert.equal(preview.workweekSettlements[0].status,'CONTEXT_REVIEW_REQUIRED')
 assert.match(preview.workweekSettlements[0].issues[0],/approve all workweek time/)
})
