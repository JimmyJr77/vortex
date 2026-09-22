import {health125EmploymentTaxes} from '../health125EmploymentTaxes.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {loadEmploymentTaxWageHistory} from '../employmentTaxWageHistory.js'
test('database taxable history scopes native evidence and feeds later payroll approval and statements',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHistoricalHarness(t);t.after(()=>h.close())
 const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const first=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 const finish=async(run,period)=>{await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:new Date(period.pay_date).toISOString().slice(0,10),paymentConfirmationReference:'SYNTHETIC-TAXABLE-HISTORY'})}
 await finish(first,periods[0])
 const load=(facility=1,required=[employee.id],exclude=null)=>loadEmploymentTaxWageHistory(h.pool,facility,[employee.id],'2026-09-30',exclude,required)
 const initial=await load();assert.deepEqual(initial.warnings,[])
 assert.deepEqual(Object.values(initial.ytdTaxWagesByEmployee[employee.id]),[20000,20000,20000,20000])
 const foreign=await load(2);assert.equal(foreign.evidenceByEmployee[employee.id],undefined);assert.equal(foreign.ytdTaxWagesByEmployee[employee.id],null);assert.equal(foreign.warnings[0].blocking,true);assert.match(foreign.warnings[0].message,/Employee not found/)
 assert.deepEqual((await load(1,[])).ytdTaxWagesByEmployee,{})
 assert.equal((await load(1,[employee.id],first.id)).ytdTaxWagesByEmployee[employee.id].medicareWagesCents,0)
 // Mark the verified zero-opening run as using separate native bases. This
 // synthetic setup exercises automatic detection without collecting a premium.
 const run=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[first.id])).rows[0]
 const frozen=run.calculation_snapshot.employees[0]
 frozen.ficaWageBasis.employmentWageMode='SEPARATE_YTD'
 frozen.ficaWageBasis.ytdTaxWages=Object.fromEntries(Object.keys(initial.ytdTaxWagesByEmployee[employee.id]).map(key=>[key,0]))
 frozen.health125EmploymentTaxes=health125EmploymentTaxes({grossCents:frozen.grossPayCents,year:2026,workState:'MD',residenceState:'MD',ytd:frozen.ficaWageBasis.ytdTaxWages,employerTaxConfig:{year:2026,verified:true,futaRatePercent:.6,mdUiRatePercent:2.6}})
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[run.calculation_snapshot,first.id])
 await h.pool.query("UPDATE payroll_run_employee SET statement_snapshot=jsonb_set(statement_snapshot,'{ficaWageBasis}',$1::jsonb) WHERE payroll_run_id=$2",[JSON.stringify(frozen.ficaWageBasis),first.id])
 await h.pool.query("UPDATE payroll_run_employee SET statement_snapshot=jsonb_set(statement_snapshot,'{health125EmploymentTaxes}',$1::jsonb) WHERE payroll_run_id=$2",[JSON.stringify(frozen.health125EmploymentTaxes),first.id])
 const next=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview
 assert.equal(next.canApprove,true,JSON.stringify(next.warnings))
 assert.equal(next.employees[0].ficaWageBasis.ytdTaxWages.medicareWagesCents,20000)
 assert.equal(next.employees[0].employmentTaxWageHistory[0].runId,String(first.id))
 assert.ok(!next.employees[0].payItems.some(item=>item.kind==='HEALTH_SECTION125_PRETAX'))
 const second=await api('/runs',{payPeriodId:periods[1].id},'POST',201);await finish(second,periods[1])
 const statement=(await h.pool.query('SELECT statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[second.id])).rows[0].statement_snapshot
 assert.equal(statement.employmentTaxWageHistory[0].runId,String(first.id));assert.equal(statement.health125EmploymentTaxes.ytd.medicareWagesCents,20000)
 assert.equal((await load(1,[])).ytdTaxWagesByEmployee[employee.id].medicareWagesCents,40000)
 await h.pool.query('UPDATE payroll_run_employee SET md_ui_tax_cents=md_ui_tax_cents+1 WHERE payroll_run_id=$1',[first.id])
 assert.match((await load()).warnings[0].message,/employment tax/)
 await h.pool.query('UPDATE payroll_run_employee SET md_ui_tax_cents=md_ui_tax_cents-1 WHERE payroll_run_id=$1',[first.id])
 await h.pool.query('UPDATE payroll_run_employee SET medicare_tax_cents=0 WHERE payroll_run_id=$1',[first.id])
 const broken=await load(1,[]);assert.equal(broken.ytdTaxWagesByEmployee[employee.id],null);assert.equal(broken.warnings[0].blocking,true)
 const blocked=(await api('/runs/preview',{payPeriodId:periods[2].id})).preview
 assert.equal(blocked.canApprove,false);assert.ok(blocked.warnings.some(w=>w.code==='EMPLOYMENT_TAX_WAGE_HISTORY_REVIEW'))
 await h.pool.query(`INSERT INTO payroll_historical_payment(facility_id,employee_id,period_start,period_end,payment_date,method,gross_amount_cents,employee_tax_withheld_cents,net_amount_cents) VALUES(1,$1,'2026-08-01','2026-08-15','2026-08-18','CHECK',10000,1000,9000)`,[employee.id])
 assert.match((await load()).warnings[0].message,/opening balances/)

})
