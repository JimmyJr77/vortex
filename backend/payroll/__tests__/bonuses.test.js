import test from 'node:test'
import assert from 'node:assert/strict'
import {validateBonus} from '../bonuses.js'
import {calculateWithholding2026,federalWithholding2026,marylandWithholding2026} from '../withholding2026.js'
import {createHarness} from '../testing/harness.js'
const review={classification:'DISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',confirmed:true,source:'Synthetic reviewed annual bonus decision',paymentDiscretionVerified:true,amountDiscretionVerified:true,noPriorPromiseVerified:true}
test('annual bonus review and withholding separate discretion, federal aggregation and Maryland lump sum treatment',()=>{
 assert.equal(validateBonus({...review,amountCents:100000}).classification,'DISCRETIONARY')
 assert.throws(()=>validateBonus({...review,amountCents:100000,noPriorPromiseVerified:false}),/prior promise/)
 const election={verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}}
 const args={grossPayCents:200000,election,payFrequency:'WEEKLY',year:2026,workState:'MD',residenceState:'MD',hasBonus:true,annualBonusCents:100000,bonusReviewComplete:true,ytdWagesCents:0}
 const result=calculateWithholding2026(args)
 assert.equal(result.federalIncomeTaxCents,federalWithholding2026(200000,election.federal,52))
 assert.equal(result.stateIncomeTaxCents,marylandWithholding2026(100000,election.maryland,'WEEKLY')+9700)
 assert.throws(()=>calculateWithholding2026({...args,grossPayCents:100000}),/concurrent/)
 assert.throws(()=>calculateWithholding2026({...args,ytdWagesCents:100000000}),/million/)
 assert.throws(()=>calculateWithholding2026({...args,election:{...election,maryland:{...election.maryland,exempt:true}}}),/exemption/)
})
test('reviewed annual bonus is paid once with regular payroll and preserved in the statement',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,method='POST')=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data}
 await api('/settings',{legalBusinessName:'Bonus Fixture',businessAddress:'123 Test Street, Bowie MD',businessPhone:'5550100000'},200,'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic verified employer tax notice',confirmed:true},200,'PATCH')
 const e=await api('/employees',{employeeNumber:'BONUS-FIXTURE',legalFirstName:'Bonus',legalLastName:'Fixture',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed tax elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},200,'PATCH')
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const next=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-10','2026-08-16','2026-08-21','WEEKLY') RETURNING id")).rows[0]
 for(let i=3;i<=8;i++)await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-0${i}T12:00:00Z`,`2026-08-0${i}T20:00:00Z`])
 await api(`/employees/${e.id}/bonuses`,{...review,requestKey:'synthetic-bonus-request-1',amountCents:100000,payPeriodId:period.id},201)
 await api(`/employees/${e.id}/bonuses`,{...review,requestKey:'synthetic-bonus-request-1',amountCents:100000,payPeriodId:period.id})
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_recurring_adjustment WHERE kind='BONUS'")).rows[0].n,1)
 await api('/runs/preview',{payPeriodId:period.id})
 await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 const preview=(await api('/runs/preview',{payPeriodId:period.id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings));assert.equal(preview.employees[0].grossPayCents,230000);assert.equal(preview.employees[0].overtimePayCents,30000)
 assert.equal((await api('/runs/preview',{payPeriodId:next.id})).preview.employees[0].otherTaxablePayCents,0)
 const run=await api('/runs',{payPeriodId:period.id},201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},200,'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},200,'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-08-14',paymentConfirmationReference:'SYNTHETIC-BONUS-CHECK'})
 const saved=(await h.pool.query('SELECT statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0].statement_snapshot
 assert.equal(saved.payItems.find(p=>p.kind==='BONUS').amountCents,100000)
 assert.equal(saved.payItems.find(p=>p.kind==='BONUS').bonusReview.classification,'DISCRETIONARY')
 assert.doesNotMatch(JSON.stringify(saved),/Synthetic reviewed annual bonus decision/)
 await api(`/employees/${e.id}/bonuses`,{...review,amountCents:100000,payPeriodId:period.id},409)
})
