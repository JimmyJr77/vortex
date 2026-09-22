import {yearEndPreparation} from '../yearEndPreparation.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {healthElectionFixture} from '../testing/healthElectionFixture.js'
import {loadEmploymentTaxWageHistory} from '../employmentTaxWageHistory.js'
test('reviewed imported wages feed health payroll, stale approval and later native tax history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const previous=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32);t.after(()=>{if(previous===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previous})
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,periods,path,electionBody}=await healthElectionFixture(h)
 await api(path,electionBody,'POST',200,true)
 await api(`/employees/${employee.id}/historical-payments`,{requestId:randomUUID(),periodStart:'2026-08-01',periodEnd:'2026-08-15',paymentDate:'2026-08-18',method:'ACH',reference:'SYNTHETIC-IMPORT-HEALTH',grossCents:100000,taxCents:20000,netCents:80000,evidence:'Synthetic original payroll register and payment confirmation',wageOnlyConfirmed:true,confirmed:true},'POST',201)
 const preview=async index=>(await api('/runs/preview',{payPeriodId:periods[index].id})).preview
 const blocked=await preview(0);assert.equal(blocked.canApprove,false);assert.ok(blocked.warnings.some(w=>w.code==='EMPLOYMENT_TAX_WAGE_HISTORY_REVIEW'))
 const reviewPath=`/employees/${employee.id}/historical-employment-wages`,state=await api(`${reviewPath}?paymentDate=2026-09-18`)
 const body={requestKey:randomUUID(),expectedRevision:0,paymentDate:'2026-09-18',sourceFingerprint:state.source.fingerprint,disposition:'REVIEWED',reference:'Reviewed original same-employer payroll register and uncapped taxable wages',confirmed:true,sameEmployerConfirmed:true,uncappedWagesConfirmed:true,completeHistoryConfirmed:true,payments:state.source.payments.map(p=>({paymentId:p.paymentId,wages:{socialSecurityWagesCents:100000,medicareWagesCents:100000,futaWagesCents:100000,marylandUnemploymentWagesCents:100000}}))}
 body.payments[0].annualDetail={federalWagesCents:100000,marylandWagesCents:100000,socialSecurityReportedWagesCents:100000,additionalMedicareWagesCents:0,federalWithheldCents:10000,marylandWithheldCents:2350,socialSecurityWithheldCents:6200,medicareWithheldCents:1450,additionalMedicareWithheldCents:0,qualifiedOvertimePremiumCents:2500,reference:'Original synthetic employer register and FLSA review evidence',registerReconciledConfirmed:true,reportingWagesConfirmed:true,qualifiedOvertimeReviewed:true}
 await api(reviewPath,body)
 const ready=await preview(0);assert.equal(ready.canApprove,true,JSON.stringify(ready.warnings))
 assert.equal(ready.employees[0].ficaWageBasis.ytdTaxWages.socialSecurityWagesCents,100000)
 const draft=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${draft.id}/status`,{status:'REVIEW'},'PATCH')
 await api(reviewPath,{...body,requestKey:randomUUID(),expectedRevision:1,disposition:'UNRESOLVED'})
 await api(`/runs/${draft.id}/status`,{status:'APPROVED'},'PATCH',409)
 await api(reviewPath,{...body,requestKey:randomUUID(),expectedRevision:2})
 await api(`/runs/${draft.id}/status`,{status:'APPROVED'},'PATCH',409)
 await api(`/runs/${draft.id}/status`,{status:'VOID'},'PATCH')
 for(const period of periods.slice(0,2)){
  const run=await api('/runs',{payPeriodId:period.id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
  await api(`/runs/${run.id}/finalize`,{paymentDate:new Date(period.pay_date).toISOString().slice(0,10),paymentConfirmationReference:'SYNTHETIC-IMPORTED-WAGE-PAYROLL'})
 }
 const later=await preview(2);assert.equal(later.canApprove,true,JSON.stringify(later.warnings))
 assert.equal(later.employees[0].ficaWageBasis.ytdTaxWages.medicareWagesCents,127500)
 const statements=(await h.pool.query("SELECT statement_snapshot FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id WHERE r.status='FINALIZED' ORDER BY r.id")).rows
 assert.equal(statements.length,2)
 for(const row of statements){const retained=row.statement_snapshot.employmentTaxWageHistory[0];assert.equal(retained.kind,'IMPORTED');assert.equal(retained.wages.medicareWagesCents,100000);assert.ok(retained.reviewId)}
 const annual=(await yearEndPreparation(h.pool,1)).employees.find(e=>e.employeeId===employee.id)
 assert.deepEqual(annual.wageInputs,{federal:'1275.00',maryland:'1275.00',socialSecurity:'1275.00',medicare:'1275.00'})
 const nativeTaxes=(await h.pool.query("SELECT SUM(re.medicare_tax_cents)::int n FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id WHERE r.status='FINALIZED'")).rows[0].n
 assert.equal(annual.withholding.combinedMedicare,((nativeTaxes+1450)/100).toFixed(2))
 assert.equal(annual.reviewedQualifiedOvertime,null) // Native overtime findings remain mandatory.
 const changed=structuredClone(body);changed.payments[0].wages.medicareWagesCents=99999
 await api(reviewPath,{...changed,requestKey:randomUUID(),expectedRevision:3})
 const conflictedAnnual=(await yearEndPreparation(h.pool,1)).employees.find(e=>e.employeeId===employee.id);assert.equal(conflictedAnnual.importedAnnual.status,'NATIVE_HISTORY_CONFLICT');assert.equal(conflictedAnnual.wageInputs.federal,null)
 const inconsistent=await preview(2);assert.equal(inconsistent.canApprove,false);assert.ok(inconsistent.warnings.some(w=>w.code==='EMPLOYMENT_TAX_WAGE_HISTORY_REVIEW'))
})

test('interleaved imported payments and voided reservations retain only applicable chronological wages',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const previous=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32);t.after(()=>{if(previous===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previous})
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,periods,path,electionBody}=await healthElectionFixture(h);await api(path,electionBody,'POST',200,true)
 const addPayment=(start,end,paid,reference,gross)=>api(`/employees/${employee.id}/historical-payments`,{requestId:randomUUID(),periodStart:start,periodEnd:end,paymentDate:paid,method:'ACH',reference,grossCents:gross,taxCents:gross/5,netCents:gross*4/5,evidence:'Synthetic original payroll register with actual prior wage payment evidence',wageOnlyConfirmed:true,confirmed:true},'POST',201)
 const reviewPath=`/employees/${employee.id}/historical-employment-wages`
 const review=async paymentDate=>{
  const state=await api(`${reviewPath}?paymentDate=${paymentDate}`)
  return api(reviewPath,{requestKey:randomUUID(),expectedRevision:state.current?.revision||0,paymentDate,sourceFingerprint:state.source.fingerprint,disposition:'REVIEWED',reference:'Reviewed chronological original same-employer wage registers and uncapped bases',confirmed:true,sameEmployerConfirmed:true,uncappedWagesConfirmed:true,completeHistoryConfirmed:true,payments:state.source.payments.map(p=>({paymentId:p.paymentId,wages:{socialSecurityWagesCents:p.grossCents,medicareWagesCents:p.grossCents,futaWagesCents:p.grossCents,marylandUnemploymentWagesCents:p.grossCents}}))})
 }
 const approve=async period=>{const run=await api('/runs',{payPeriodId:period.id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');return run}
 const finish=(run,date)=>api(`/runs/${run.id}/finalize`,{paymentDate:date,paymentConfirmationReference:'SYNTHETIC-INTERLEAVED-PAYROLL'})
 await addPayment('2026-08-01','2026-08-15','2026-08-18','SYNTHETIC-EARLY-IMPORTED',100000);await review('2026-09-18')
 const first=await approve(periods[0]);await finish(first,'2026-09-18')
 t.mock.timers.setTime(Date.parse('2026-10-21T16:00:00.000Z'))
 await h.pool.query("CREATE OR REPLACE FUNCTION now() RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT '2026-10-21T16:00:00Z'::timestamptz $$; CREATE OR REPLACE FUNCTION clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT '2026-10-21T16:00:00Z'::timestamptz $$")
 await addPayment('2026-08-16','2026-08-31','2026-09-20','SYNTHETIC-LATER-IMPORTED',50000)
 const blocked=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview;assert.equal(blocked.canApprove,false)
 await review('2026-09-30')
 const ready=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview
 assert.equal(ready.canApprove,true,JSON.stringify(ready.warnings));assert.equal(ready.employees[0].ficaWageBasis.ytdTaxWages.medicareWagesCents,157500)
 assert.deepEqual(ready.employees[0].employmentTaxWageHistory.map(row=>row.paymentDate),['2026-08-18','2026-09-18','2026-09-20'])
 const reserved=await approve(periods[1])
 const history=()=>loadEmploymentTaxWageHistory(h.pool,1,[employee.id],'2026-10-20',null,[employee.id])
 assert.equal((await history()).ytdTaxWagesByEmployee[employee.id].medicareWagesCents,177500)
 await api(`/runs/${reserved.id}/status`,{status:'VOID'},'PATCH')
 assert.equal((await history()).ytdTaxWagesByEmployee[employee.id].medicareWagesCents,157500)
 const replacement=await approve(periods[1]);await finish(replacement,'2026-09-30')
 const finalHistory=await history();assert.equal(finalHistory.ytdTaxWagesByEmployee[employee.id].medicareWagesCents,177500)
 assert.ok(!finalHistory.evidenceByEmployee[employee.id].some(row=>row.runId===String(reserved.id)))
})

test('imported uncapped bases independently govern Social Security, Medicare and unemployment limits',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const previous=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32);t.after(()=>{if(previous===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previous})
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,periods,path,electionBody}=await healthElectionFixture(h);await api(path,electionBody,'POST',200,true)
 await api(`/employees/${employee.id}/historical-payments`,{requestId:randomUUID(),periodStart:'2026-01-01',periodEnd:'2026-08-15',paymentDate:'2026-08-18',method:'ACH',reference:'SYNTHETIC-IMPORT-LIMITS',grossCents:20001000,taxCents:4000000,netCents:16001000,evidence:'Synthetic original payroll register showing separate uncapped employment tax wage bases',wageOnlyConfirmed:true,confirmed:true},'POST',201)
 const reviewPath=`/employees/${employee.id}/historical-employment-wages`,state=await api(`${reviewPath}?paymentDate=2026-09-18`)
 await api(reviewPath,{requestKey:randomUUID(),expectedRevision:0,paymentDate:'2026-09-18',sourceFingerprint:state.source.fingerprint,disposition:'REVIEWED',reference:'Reviewed synthetic uncapped bases with separate exclusion and wage-cap evidence',confirmed:true,sameEmployerConfirmed:true,uncappedWagesConfirmed:true,completeHistoryConfirmed:true,payments:[{paymentId:state.source.payments[0].paymentId,wages:{socialSecurityWagesCents:18449000,medicareWagesCents:20001000,futaWagesCents:700000,marylandUnemploymentWagesCents:850000}}]})
 const preview=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings));const person=preview.employees[0]
 assert.equal(person.health125EmploymentTaxes.socialSecurityTaxableCents,1000)
 assert.equal(person.socialSecurityTaxCents,62)
 assert.equal(person.medicareTaxCents,109)
 assert.equal(person.additionalMedicareTaxCents,68)
 assert.equal(person.futaTaxCents,0);assert.equal(person.mdUiTaxCents,0)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-IMPORTED-INDEPENDENT-CAPS'})
 const next=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview
 assert.equal(next.canApprove,true,JSON.stringify(next.warnings));assert.equal(next.employees[0].socialSecurityTaxCents,0)
 assert.equal(next.employees[0].additionalMedicareTaxCents,180)
})
