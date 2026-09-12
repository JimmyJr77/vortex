import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('server payroll preview applies a closed verified mixed-rate workweek without client settlement inputs',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,method='POST')=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'WEIGHTED-API',legalFirstName:'Weighted',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2000},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
 // Synthetic established historical rate record, independent of the future-change UI.
 await h.pool.query("INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason,notice_delivered_on,notice_reference) VALUES(1,$1,'2026-09-03',2600,'Synthetic signed rate history','2026-08-01','Synthetic notice record')",[employee.id])
 for(const date of [1,3])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[employee.id,`2026-09-0${date}T04:00:00Z`,`2026-09-0${date+1}T04:00:00Z`])
 const periods=await api('/pay-periods/generate',{year:2026,month:9},201),period=periods.find(p=>String(p.period_start).startsWith('2026-09-01'))
 const preview=(await api('/runs/preview',{payPeriodId:period.id,weightedSettlements:[{premiumDueCents:999999999}]})).preview.employees[0]
 assert.equal(preview.weightedOvertimeApplied,true)
 assert.deepEqual(preview.employmentCompensation.map(s=>[s.start,s.hourlyRateCents]),[['2026-09-01',2000],['2026-09-03',2600]])
 assert.equal(preview.regularPayCents,89600);assert.equal(preview.overtimePayCents,30000);assert.equal(preview.grossPayCents,119600)
 assert.equal(preview.workweekSettlements[0].appliedToPayroll,true)
 assert.equal(preview.workweekPayments[0].weightedPremiumApplied,true)
 assert.equal(preview.warnings.some(w=>w.code==='MIXED_WORKWEEK_RATES'),false)
 const draft=await api('/runs',{payPeriodId:period.id},201)
 const frozen=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[draft.id])).rows[0].calculation_snapshot.employees[0]
 assert.equal(frozen.weightedOvertimeApplied,true);assert.equal(frozen.grossPayCents,119600)
 assert.equal(frozen.workweekPayments[0].premiumCents,9200)
 assert.deepEqual(frozen.employmentCompensation,preview.employmentCompensation)
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-09-14T14:00:00Z','2026-09-14T15:00:00Z','ADMIN','APPROVED')",[employee.id])
 const expanded=(await api('/runs/preview',{payPeriodId:period.id})).preview.employees[0]
 assert.equal(expanded.grossPayCents,122200)
 assert.equal(expanded.workweekPayments.find(w=>w.week==='2026-09-14').weightedPremiumApplied,undefined)
 assert.equal(expanded.workweekSettlements.find(w=>w.week==='2026-09-14').appliedToPayroll,false)
 assert.equal(expanded.warnings.some(w=>w.code==='WEIGHTED_WORKWEEK_REVIEW'),false)
 await api(`/runs/${draft.id}/status`,{status:'VOID'},200,'PATCH')
 await api('/settings',{legalBusinessName:'Synthetic Weighted Payroll',businessAddress:'123 Test Street, Bowie MD',businessPhone:'555-010-0000'},200,'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic verified employer tax notice',confirmed:true},200,'PATCH')
 await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 await h.pool.query("UPDATE payroll_employee SET w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[employee.id])
 await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed W4 and MW507 elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},200,'PATCH')
 const payable=await api('/runs',{payPeriodId:period.id},201)
 await api(`/runs/${payable.id}/status`,{status:'REVIEW'},200,'PATCH')
 await api(`/runs/${payable.id}/status`,{status:'APPROVED'},200,'PATCH')
 const finalized=await api(`/runs/${payable.id}/finalize`,{paymentDate:String(period.pay_date).slice(0,10),paymentConfirmationReference:'SYNTHETIC-WEIGHTED-CHECK'})
 assert.equal(finalized.status,'FINALIZED')
 const statement=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1 AND employee_id=$2',[payable.id,employee.id])).rows[0]
 assert.equal(Number(statement.regular_pay_cents)+Number(statement.overtime_pay_cents),122200)
 assert.equal(statement.statement_snapshot.workweekPayments.find(w=>w.week==='2026-08-31').premiumCents,9200)
 assert.ok(statement.statement_snapshot.rateBreakdown.some(r=>r.overtimeMethod==='WEIGHTED'&&r.overtimePremiumCents===9200))
 await assert.rejects(h.pool.query("UPDATE payroll_time_entry SET unpaid_break_minutes=1 WHERE employee_id=$1 AND clock_in='2026-09-03T04:00:00Z'",[employee.id]),e=>e.constraint==='payroll_time_locked')
 const today=(await h.pool.query("SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=1")).rows[0].today
 const effective=new Date('2050-01-01T00:00:00Z');while(effective.getUTCDay()!==3)effective.setUTCDate(effective.getUTCDate()+1)
 const change=await api(`/employees/${employee.id}/pay-rates`,{effectiveOn:effective.toISOString().slice(0,10),hourlyRateCents:2800,noticeDeliveredOn:today,noticeConfirmed:true,noticeReference:'Synthetic midweek signed notice',reason:'Scheduled midweek compensation change'},201)
 assert.equal(new Date(change.effective_on).getUTCDay(),3)



})

test('two finalized pay periods settle one weighted workweek exactly once and freeze following-period dependencies',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,method='POST')=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'SPLIT-WEEK',legalFirstName:'Split',legalLastName:'Workweek',hireDate:'2026-01-01',hourlyRateCents:2000},201)
 await api('/settings',{legalBusinessName:'Synthetic Split Payroll',businessAddress:'123 Test Street, Bowie MD',businessPhone:'555-010-0000'},200,'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic verified employer tax notice',confirmed:true},200,'PATCH')
 await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[employee.id])
 await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed W4 and MW507 elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},200,'PATCH')
 await h.pool.query("INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason,notice_delivered_on,notice_reference) VALUES(1,$1,'2026-08-16',2600,'Synthetic historical increase','2026-08-01','Synthetic signed notice')",[employee.id])
 for(const day of [10,11])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[employee.id,`2026-08-${day}T04:00:00Z`,`2026-08-${day+1}T04:00:00Z`])
 const following=(await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-08-16T04:00:00Z','2026-08-16T12:00:00Z','ADMIN','APPROVED') RETURNING id",[employee.id])).rows[0]
 const periods=[...await api('/pay-periods/generate',{year:2026,month:8},201),...await api('/pay-periods/generate',{year:2026,month:9},201)]
 const first=periods.find(p=>String(p.period_start).startsWith('2026-08-01')),second=periods.find(p=>String(p.period_start).startsWith('2026-08-16'))
 await api('/runs/preview',{payPeriodId:first.id})
 await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 const draft=await api('/runs',{payPeriodId:first.id},201)
 await api(`/runs/${draft.id}/status`,{status:'REVIEW'},200,'PATCH')
 // A later-period entry changes the first period's full-week rate; approval must revalidate it.
 await h.pool.query("UPDATE payroll_time_entry SET clock_out='2026-08-16T13:00:00Z' WHERE id=$1",[following.id])
 await api(`/runs/${draft.id}/status`,{status:'APPROVED'},409,'PATCH')
 await h.pool.query("UPDATE payroll_time_entry SET clock_out='2026-08-16T12:00:00Z' WHERE id=$1",[following.id])
 await api(`/runs/${draft.id}/status`,{status:'APPROVED'},200,'PATCH')
 await assert.rejects(h.pool.query("UPDATE payroll_time_entry SET clock_out='2026-08-16T13:00:00Z' WHERE id=$1",[following.id]),e=>e.constraint==='payroll_time_locked')
 await api(`/runs/${draft.id}/finalize`,{paymentDate:String(first.pay_date).slice(0,10),paymentConfirmationReference:'SYNTHETIC-SPLIT-FIRST'})
 const preview=(await api('/runs/preview',{payPeriodId:second.id})).preview.employees[0]
 assert.equal(preview.workweekSettlements[0].previouslyPaidPremiumCents,8343)
 assert.equal(preview.workweekSettlements[0].premiumDueCents,8343)
 assert.deepEqual(preview.workweekSettlements[0].priorRunIds,[Number(draft.id)])
 assert.equal(preview.workweekPaidHistory[0].historyVerified,true)
 assert.equal(preview.grossPayCents,29143)
 const next=await api('/runs',{payPeriodId:second.id},201)
 await api(`/runs/${next.id}/status`,{status:'REVIEW'},200,'PATCH')
 await api(`/runs/${next.id}/status`,{status:'APPROVED'},200,'PATCH')
 await api(`/runs/${next.id}/finalize`,{paymentDate:String(second.pay_date).slice(0,10),paymentConfirmationReference:'SYNTHETIC-SPLIT-SECOND'})
 const paid=(await h.pool.query('SELECT statement_snapshot,regular_pay_cents,overtime_pay_cents FROM payroll_run_employee WHERE payroll_run_id=ANY($1::bigint[]) ORDER BY payroll_run_id',[[draft.id,next.id]])).rows
 assert.equal(paid.length,2)
 assert.equal(paid.reduce((n,row)=>n+Number(row.regular_pay_cents)+Number(row.overtime_pay_cents),0),133486)
 assert.equal(paid.reduce((n,row)=>n+row.statement_snapshot.workweekPayments[0].premiumCents,0),16686)
 assert.equal(paid.reduce((n,row)=>n+row.statement_snapshot.workweekPayments[0].workedMinutes,0),56*60)
})
