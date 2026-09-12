import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateLeavePayout} from '../leavePayout.js'
import {createHarness} from '../testing/harness.js'
const body={leaveType:'PTO',minutes:450,hourlyRateCents:2555,policyReference:'Synthetic communicated vacation payout policy',policyVerified:true,unusedVacationVerified:true}
test('unused vacation payout preserves cent precision and requires balance and policy evidence',()=>{
 const result=calculateLeavePayout(body,480);assert.equal(result.amountCents,19163);assert.equal(result.remainingMinutes,30)
 for(const invalid of [{minutes:481},{minutes:0},{minutes:0.5},{hourlyRateCents:0},{leaveType:'MD_SICK_SAFE'},{policyVerified:false},{unusedVacationVerified:false},{policyReference:'short'}])assert.throws(()=>calculateLeavePayout({...body,...invalid},480),e=>e.status===400)
})
test('leave payout preview scopes ledger evidence, preserves dated future commitments without advancing future grants',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'PTO-PAYOUT',legalFirstName:'Payout',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2555},201)
 const path=`/employees/${e.id}/leave-payout/preview`
 await api(path,body,409)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-01' WHERE id=$1",[e.id])
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-01-01',600,'Synthetic earned vacation'),(1,$1,'PTO','2099-01-01',600,'Synthetic future vacation grant'),(1,$1,'PTO','2099-01-01',-120,'Synthetic approved leave reservation'),(1,$1,'MD_SICK_SAFE','2026-01-01',100,'Separate statutory leave')",[e.id])
 const preview=await api(path,body);assert.equal(preview.availableMinutes,600);assert.equal(preview.evidence.length,3);assert.equal(preview.amountCents,19163)
 await api(path,body,404,2)
 // Move the grant after the debit: the earlier debit must now be funded today.
 await h.pool.query("UPDATE payroll_leave_transaction SET transaction_date='2099-01-02' WHERE employee_id=$1 AND minutes=600 AND transaction_date='2099-01-01'",[e.id])
 const laterGrant=await api(path,body);assert.equal(laterGrant.availableMinutes,480)
 assert.notEqual(laterGrant.fingerprint,preview.fingerprint)
 await api(path,{...body,minutes:481},400)

 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-02-01',60,'Synthetic additional earned leave')",[e.id])
 assert.notEqual((await api(path,body)).fingerprint,preview.fingerprint)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_recurring_adjustment')).rows[0].n,0)
})
