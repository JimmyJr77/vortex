import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('regular bonuses and PTO use recorded employment periods during rehire onboarding',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'REHIRE-ITEMS',legalFirstName:'Returning',legalLastName:'Payroll',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[employee.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2099-09-07',termination_date=NULL,hourly_rate_cents=3000 WHERE id=$1",[employee.id])
 await h.pool.query("INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason) VALUES(1,$1,'2099-09-07',3000,'Synthetic rehire rate')",[employee.id])
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-08-01',180,'Synthetic retained PTO')",[employee.id])
 const periods=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-07-27','2026-08-02','2026-08-07','WEEKLY'),(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY'),(1,'2026-08-10','2026-08-16','2026-08-21','WEEKLY'),(1,'2099-09-07','2099-09-13','2099-09-18','WEEKLY') RETURNING id")).rows
 const bonus={amountCents:10000,classification:'DISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',confirmed:true,source:'Synthetic discretionary bonus decision without a prior promise',amountDiscretionVerified:true,paymentDiscretionVerified:true,noPriorPromiseVerified:true}
 const policy={leaveType:'PTO',minutes:60,hourlyRateCents:2500,policyVerified:true,unusedVacationVerified:true,policyReference:'Synthetic communicated unused vacation policy'}
 const preview=await api(`/employees/${employee.id}/leave-payout/preview`,policy)
 for(const index of [0,2,3]){
  await api(`/employees/${employee.id}/bonuses`,{...bonus,payPeriodId:periods[index].id},409)
  await api(`/employees/${employee.id}/leave-payouts`,{...policy,payPeriodId:periods[index].id,fingerprint:preview.fingerprint,requestKey:`ineligible-payout-${index}`},409)
 }
 await api(`/employees/${employee.id}/bonuses`,{...bonus,payPeriodId:periods[1].id},404,2)
 await api(`/employees/${employee.id}/leave-payouts`,{...policy,paymentMode:'STANDALONE',payPeriodId:periods[1].id,fingerprint:preview.fingerprint,requestKey:'standalone-before-reactivation'},409)
 await api(`/employees/${employee.id}/bonuses`,{...bonus,payPeriodId:periods[1].id},201)
 const payout=await api(`/employees/${employee.id}/leave-payouts`,{...policy,payPeriodId:periods[1].id,fingerprint:preview.fingerprint,requestKey:'earlier-employment-payout'},201)
 assert.equal(payout.status,'RESERVED')
 const old=(await api('/runs/preview',{payPeriodId:periods[1].id,paymentDate:preview.asOfDate})).preview
 assert.equal(old.employees[0].grossPayCents,12500)
 assert.ok(old.employees[0].payItems.some(item=>item.kind==='LEAVE_PAYOUT'&&item.amountCents===2500))
 const dashboard=await api('/dashboard')
 const shown=dashboard.employees.find(e=>e.id===employee.id)
 assert.equal(shown.hasPriorEmployment,true);assert.equal(shown.hourlyRateCents,3000)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
 await api(`/employees/${employee.id}/bonuses`,{...bonus,payPeriodId:periods[3].id},201)
})
