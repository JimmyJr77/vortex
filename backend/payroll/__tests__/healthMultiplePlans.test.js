import test from 'node:test'
import {monthlyMultiPlanFixture} from '../testing/monthlyMultiPlanFixture.js'
const options={skip:!process.env.PAYROLL_TEST_DATABASE_URL}
import assert from 'node:assert/strict'
import {healthElectionFixture} from '../testing/healthElectionFixture.js'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {benefitContributionReport} from '../benefitContributionReport.js'
import {statementLines} from '../payStatement.js'
for(const dentalTreatment of ['POSTTAX','PRETAX'])test(`medical and ${dentalTreatment} dental collect once monthly with separate proof`,options,async t=>{
 const previous=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32);t.after(()=>{if(previous===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previous})
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const fixture=await healthElectionFixture(h,{existingFixture:await monthlyMultiPlanFixture(h,{taxTreatment:'PRETAX',dentalTreatment})}),{api,employee,periods,path,electionBody}=fixture
 await api(path,electionBody,'POST',200,true)
 if(dentalTreatment==='PRETAX'){
  const unsigned=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview;assert.equal(unsigned.canApprove,false)
  const dental=await healthElectionFixture(h,{existingFixture:fixture,planId:'dental'});await api(dental.path,dental.electionBody,'POST',200,true)
 }
 const pretax=dentalTreatment==='PRETAX'?13500:12500,posttax=dentalTreatment==='PRETAX'?0:1000
 for(const [index,period] of periods.entries()){
  const preview=(await api('/runs/preview',{payPeriodId:period.id})).preview
  assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
  const person=preview.employees[0],collected=index!==1
  assert.equal(person.pretaxDeductionCents,collected?pretax:0)
  assert.equal(person.posttaxDeductionCents,collected?posttax:0)
  assert.equal(person.incomeTaxWageBasis.federalWagesCents,collected?20000-pretax:20000)
  assert.equal(person.benefitCollection.status,collected?'COLLECT_THIS_RUN':'ALREADY_COLLECTED')
  const run=await api('/runs',{payPeriodId:period.id},'POST',201)
  await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
  await api(`/runs/${run.id}/finalize`,{paymentDate:new Date(period.pay_date).toISOString().slice(0,10),paymentConfirmationReference:'SYNTHETIC-MIXED-HEALTH-DENTAL'})
 }
 const report=await benefitContributionReport(h.pool,1,'2026-09-01','2026-10-31')
 assert.deepEqual(report.slice(1).map(r=>[r[1],r[4],r[8],r[9]]),[['2026-09','medical','125.00','PRETAX'],['2026-09','dental','10.00',dentalTreatment],['2026-10','medical','125.00','PRETAX'],['2026-10','dental','10.00',dentalTreatment]])
 const rows=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE employee_id=$1 ORDER BY payroll_run_id',[employee.id])).rows
 for(const row of rows)assert.equal(statementLines(row).lines.reduce((n,line)=>n+line[2],0),Number(row.net_pay_cents))
})

test('suspending dental invalidates a reviewed two-plan payroll and preserves medical consent',options,async t=>{
 const previous=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32);t.after(()=>{if(previous===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previous})
 const {randomUUID}=await import('node:crypto')
 const {requireHealthElection}=await import('../healthElection.js')
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const medical=await healthElectionFixture(h,{existingFixture:await monthlyMultiPlanFixture(h,{taxTreatment:'PRETAX',dentalTreatment:'PRETAX'})}),{api,employee,periods}=medical
 const signedMedical=await api(medical.path,medical.electionBody,'POST',200,true)
 const dental=await healthElectionFixture(h,{existingFixture:medical,planId:'dental'})
 await api(dental.path,dental.electionBody,'POST',200,true)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 await api(dental.participantPath,{...dental.participantBody,requestKey:randomUUID(),expectedRevision:1,disposition:'SUSPENDED',reference:'Synthetic dental eligibility suspended pending a new participant review'})
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH',409)
 const preview=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 assert.equal(preview.canApprove,false)
 assert.equal((await requireHealthElection(h.pool,1,employee.id,'medical','2026-09-18')).id,signedMedical.id)
 await assert.rejects(()=>requireHealthElection(h.pool,1,employee.id,'dental','2026-09-18'))
 assert.equal((await dental.state()).history.length,1)
})

test('carrier invoice matches both pretax plans and rejects changed retained wage evidence',options,async t=>{
 const previous=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32);t.after(()=>{if(previous===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previous})
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const medical=await healthElectionFixture(h,{existingFixture:await monthlyMultiPlanFixture(h,{taxTreatment:'PRETAX',dentalTreatment:'PRETAX'})}),{api,periods}=medical
 await api(medical.path,medical.electionBody,'POST',200,true)
 const dental=await healthElectionFixture(h,{existingFixture:medical,planId:'dental'});await api(dental.path,dental.electionBody,'POST',200,true)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-MULTIPLAN-CARRIER'})
 const path='/benefit-carrier-invoices',source=(await api(`${path}?month=2026-09`)).source
 assert.deepEqual(source.contributions.map(c=>[c.planId,c.amountCents]).sort(),[['dental',1000],['medical',12500]])
 const body={month:'2026-09',carrier:'Synthetic Medical and Dental Carrier',invoiceNumber:'MULTIPLAN',invoiceDate:'2026-09-01',dueDate:'2026-09-30',amountCents:61500,reference:'Synthetic carrier invoice for both plans',reconciliation:'Reviewed retained medical and dental coverage and employee funding.',confirmed:true,fingerprint:source.fingerprint,previousId:null,allocation:{employerExpenseCents:48000,employeeContributionCents:13500,reference:'Matched two retained pretax payroll deductions',confirmed:true,contributions:source.contributions.map(c=>({key:c.key,amountCents:c.amountCents}))}}
 const saved=await api(path,body);assert.equal((await api(path,body)).id,saved.id)
 await api(path,{...body,invoiceNumber:'DUPLICATE'},'POST',409)
 await h.pool.query('UPDATE payroll_run_employee SET pretax_deduction_cents=pretax_deduction_cents+1 WHERE payroll_run_id=$1',[run.id])
 assert.equal((await api(`${path}?month=2026-09`)).source,null)
 await api(path,{...body,invoiceNumber:'ALTERED'},'POST',409)
})

test('voiding an approved two-plan run releases premiums and separate taxable-wage reservations',options,async t=>{
 const previous=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32);t.after(()=>{if(previous===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previous})
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const medical=await healthElectionFixture(h,{existingFixture:await monthlyMultiPlanFixture(h,{taxTreatment:'PRETAX',dentalTreatment:'PRETAX'})}),{api,periods}=medical
 await api(medical.path,medical.electionBody,'POST',200,true)
 const dental=await healthElectionFixture(h,{existingFixture:medical,planId:'dental'});await api(dental.path,dental.electionBody,'POST',200,true)
 const runs=[]
 for(const period of periods.slice(0,2)){const run=await api('/runs',{payPeriodId:period.id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');runs.push(run)}
 const outcomes=await Promise.all(runs.map(run=>fetch(`${h.url}/api/admin/payroll/runs/${run.id}/status`,{method:'PATCH',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({status:'APPROVED'})})))
 assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409])
 const winner=outcomes.findIndex(r=>r.status===200),other=1-winner
 await api(`/runs/${runs[winner].id}/status`,{status:'VOID'},'PATCH')
 await api(`/runs/${runs[other].id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${runs[other].id}/finalize`,{paymentDate:new Date(periods[other].pay_date).toISOString().slice(0,10),paymentConfirmationReference:'SYNTHETIC-MULTIPLAN-REPLACEMENT'})
 const paid=(await h.pool.query("SELECT re.* FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id WHERE r.status='FINALIZED'")).rows
 assert.equal(paid.length,1);assert.equal(Number(paid[0].pretax_deduction_cents),13500)
 const preview=(await api('/runs/preview',{payPeriodId:periods[2].id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
 assert.equal(preview.employees[0].pretaxDeductionCents,13500)
 const history=preview.employees[0].ficaWageBasis.ytdTaxWages
 assert.equal(history.socialSecurityWagesCents,6500)
})
