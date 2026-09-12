import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('time export includes overnight overlap using employer local dates and labels whole-entry minutes',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'}
 const response=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers,body:JSON.stringify({employeeNumber:'TIME-EXPORT',legalFirstName:'Time',legalLastName:'Export',hireDate:'2026-01-01',hourlyRateCents:2500})})
 assert.equal(response.status,201);const employee=(await response.json()).data
 for(const [start,end,note] of [['2026-09-09T01:00:00Z','2026-09-09T02:00:00Z','BEFORE-LOCAL-DAY'],['2026-09-09T03:00:00Z','2026-09-09T05:00:00Z','OVERNIGHT-INCLUDED'],['2026-09-10T04:00:00Z','2026-09-10T05:00:00Z','NEXT-DAY-EXCLUDED']])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,unpaid_break_minutes,source,status,evidence_note) VALUES(1,$1,$2,$3,0,'ADMIN','APPROVED',$4)",[employee.id,start,end,note])
 const report=await fetch(`${h.url}/api/admin/payroll/reports/time-log.csv?start=2026-09-09&end=2026-09-09`,{headers});assert.equal(report.status,200)
 const csv=await report.text();assert.match(csv,/Whole entry worked minutes/);assert.match(csv,/OVERNIGHT-INCLUDED/);assert.match(csv,/120/);assert.match(csv,/YES/);assert.doesNotMatch(csv,/BEFORE-LOCAL-DAY|NEXT-DAY-EXCLUDED/)
 const other=await fetch(`${h.url}/api/admin/payroll/reports/time-log.csv?start=2026-09-09&end=2026-09-09`,{headers:{...headers,'x-test-facility':'2'}});assert.doesNotMatch(await other.text(),/OVERNIGHT-INCLUDED/)
})
