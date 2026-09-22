import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {taxLiabilityReport} from '../taxLiabilityReport.js'
import {employeeSummaryCsv} from '../employeeSummary.js'
test('reviewed imported exports select actual payment dates, retain component totals and hide stale bases',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee}=await monthlyBenefitsFixture(h)
 for(const [month,gross] of [['06',100000],['08',50000]])await api(`/employees/${employee.id}/historical-payments`,{requestId:randomUUID(),periodStart:`2026-${month}-01`,periodEnd:`2026-${month}-15`,paymentDate:`2026-${month}-18`,method:'ACH',reference:`SYNTHETIC-IMPORT-${month}`,grossCents:gross,taxCents:gross/5,netCents:gross*4/5,evidence:'Original synthetic employer register and payment evidence',wageOnlyConfirmed:true,confirmed:true},'POST',201)
 const path=`/employees/${employee.id}/historical-employment-wages`,state=await api(`${path}?paymentDate=2026-12-31`)
 const report=async(start,end)=>{const [headers,...rows]=await employeeSummaryCsv(h.pool,1,start,end);return rows.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]])))}
 assert.equal((await report('2026-01-01','2026-12-31'))[0]['Retained federal income-tax wages'],'')
 const body={requestKey:randomUUID(),expectedRevision:0,paymentDate:'2026-12-31',sourceFingerprint:state.source.fingerprint,disposition:'REVIEWED',reference:'Original same-employer imported tax register and reviewed annual reporting detail',confirmed:true,sameEmployerConfirmed:true,uncappedWagesConfirmed:true,completeHistoryConfirmed:true,payments:state.source.payments.map(p=>({paymentId:p.paymentId,wages:{socialSecurityWagesCents:p.grossCents,medicareWagesCents:p.grossCents,futaWagesCents:p.grossCents,marylandUnemploymentWagesCents:p.grossCents},annualDetail:{federalWagesCents:p.grossCents,marylandWagesCents:p.grossCents,socialSecurityReportedWagesCents:p.grossCents,additionalMedicareWagesCents:0,federalWithheldCents:p.grossCents/10,marylandWithheldCents:p.grossCents*235/10000,socialSecurityWithheldCents:p.grossCents*62/1000,medicareWithheldCents:p.grossCents*145/10000,additionalMedicareWithheldCents:0,qualifiedOvertimePremiumCents:0,reference:'Original annual component register and FLSA premium review',registerReconciledConfirmed:true,reportingWagesConfirmed:true,qualifiedOvertimeReviewed:true}}))}
 const saved=await api(path,body)
 const annual=(await report('2026-01-01','2026-12-31'))[0]
 assert.equal(annual['Retained Social Security taxable wages'],'1500.00');assert.equal(annual['Retained Medicare taxable wages'],'1500.00');assert.equal(annual['Retained federal income-tax wages'],'1500.00')
 assert.equal(annual['Federal withholding'],'0.00');assert.equal(annual['Imported federal withholding'],'150.00');assert.equal(annual['Imported regular Medicare withholding'],'21.75')
 assert.equal(annual['Verified imported payments'],2);assert.equal(annual['Imported detail review ID'],saved.id);assert.match(annual['Review status'],/NATIVE AND IMPORTED TAX COLUMNS ARE SEPARATE/)
 await api('/tax-reconciliation?year=2026',undefined,'GET',409)
 await assert.rejects(taxLiabilityReport(h.pool,1),error=>error.status===409)
 const taxBody={...body,requestKey:randomUUID(),expectedRevision:1,payments:body.payments.map(p=>({...p,annualDetail:{...p.annualDetail,employerTaxes:{socialSecurityCents:p.wages.socialSecurityWagesCents*62/1000+1,medicareCents:p.wages.medicareWagesCents*145/10000,futaCents:p.wages.futaWagesCents*6/1000,marylandUnemploymentCents:p.wages.marylandUnemploymentWagesCents*26/1000,reference:'Original employer quarterly tax liability register review',confirmed:true}}}))}
 await api(path,taxBody)
 const liabilityRows=await taxLiabilityReport(h.pool,1,{start:'2026-07-01',end:'2026-09-30'})
 assert.equal(liabilityRows.length,2)
 const liability=Object.fromEntries(liabilityRows[0].map((key,i)=>[key,liabilityRows[1][i]]))
 assert.equal(liability.Source,'IMPORTED');assert.equal(liability.Status,'IMPORTED_PAID');assert.equal(liability['Pay date'],'2026-08-18')
 assert.equal(liability['Employee taxes'],'100.00');assert.equal(liability['Employer taxes'],'54.26');assert.equal(liability['Total calculated tax liability'],'154.26')
 assert.equal(liability['Social Security employee and employer'],'62.01');assert.ok(liability['Imported review ID']);assert.equal(liability['Imported source fingerprint'],state.source.fingerprint)
 assert.equal((await taxLiabilityReport(h.pool,2)).length,1)
 const exportUrl=`${h.url}/api/admin/payroll/reports/tax-liabilities.csv`
 for(const query of ['?start=2026-07-01','?start=2026-09-30&end=2026-07-01','?start=2026-02-30&end=2026-09-30'])assert.equal((await fetch(exportUrl+query,{headers:{Authorization:'Bearer payroll-test-admin'}})).status,400)
 assert.equal((await fetch(exportUrl)).status,401)
 const download=await fetch(exportUrl+'?start=2026-07-01&end=2026-09-30',{headers:{Authorization:'Bearer payroll-test-admin'}})
 assert.equal(download.status,200);assert.equal(download.headers.get('cache-control'),'no-store');assert.match(await download.text(),/154.26/)
 const audit=(await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE entity_type='tax_liabilities' AND action='EXPORT' ORDER BY id DESC LIMIT 1")).rows[0]
 assert.deepEqual(audit.after_data,{start:'2026-07-01',end:'2026-09-30',recordCount:1})
 const taxes=await api('/tax-reconciliation?year=2026');assert.equal(taxes.reviewedImportedPayments,2);assert.equal(taxes.annual.IRS_941,37952);assert.equal(taxes.annual.IRS_FUTA,900);assert.equal(taxes.annual.MD_UI,3900)
 assert.equal(taxes.quarters[2].agencies.find(a=>a.agency==='IRS_941').liabilityCents,12651)
 await api('/federal-deposit-schedule',{year:2026,schedule:'MONTHLY',priorYearNextDay:false,source:'Original employer deposit schedule and complete history reviewed',confirmed:true},'POST',200)
 const calendar=await api('/federal-deposit-calendar?year=2026');assert.equal(calendar.reliable,true,JSON.stringify(calendar.issues));assert.equal(calendar.obligations.reduce((sum,o)=>sum+o.liabilityCents,0),37952)
 const receipt={formType:'MD_MW506',periodStart:'2026-08-01',periodEnd:'2026-08-31',filedOn:'2026-09-10',reportedWagesCents:50000,reportedTaxCents:1175,reference:'SYNTHETIC-IMPORTED-RETURN-RECEIPT',confirmed:true}
 await api('/tax-filings',receipt,'POST',201);assert.equal((await api('/tax-reconciliation?year=2026')).filings[0].status,'MATCHED')
 await api(path,{...taxBody,requestKey:randomUUID(),expectedRevision:2,reference:'Renewed original employer register review with the same amounts'})
 assert.equal((await api('/tax-reconciliation?year=2026')).filings[0].status,'PAYROLL_CHANGED')
 const quarter=(await report('2026-07-01','2026-09-30'))[0]
 assert.equal(quarter['Retained Social Security taxable wages'],'500.00');assert.equal(quarter['Imported federal withholding'],'50.00');assert.equal(quarter['Verified imported payments'],1)
 const view=(await api('/reports/wage-bases?start=2026-07-01&end=2026-09-30')).employees[0]
 assert.equal(view.federalWages,'500.00');assert.equal(view.verifiedImportedPaymentCount,1);assert.equal(view.importedPaymentCount,1);assert.equal(view.importedDetailStatus,'REVIEWED')
 const csv=await fetch(`${h.url}/api/admin/payroll/reports/employee-summary.csv?start=2026-07-01&end=2026-09-30`,{headers:{Authorization:'Bearer payroll-test-admin'}});assert.equal(csv.status,200);assert.equal(csv.headers.get('cache-control'),'no-store');assert.match(await csv.text(),/Imported federal withholding/)
 assert.equal((await employeeSummaryCsv(h.pool,2,'2026-01-01','2026-12-31')).length,1)
 let changed=false
 const concurrentPool={connect:async()=>{
  const client=await h.pool.connect()
  return {release:()=>client.release(),query:async(...args)=>{
   const result=await client.query(...args)
   if(!changed&&String(args[0]).startsWith('WITH paid AS')){changed=true;await h.pool.query("UPDATE payroll_historical_payment SET evidence_note='Changed source outside selected reporting quarter' WHERE payment_date='2026-06-18'")}
   return result
  }}
 }}
 const concurrent=await employeeSummaryCsv(concurrentPool,1,'2026-07-01','2026-09-30')
 assert.equal(changed,true);assert.equal(concurrent[1][34],'500.00');assert.equal(concurrent[1][38],'REVIEWED')

 const stale=(await report('2026-07-01','2026-09-30'))[0];assert.equal(stale['Retained federal income-tax wages'],'');assert.equal(stale['Imported federal withholding'],'');assert.equal(stale['Imported detail status'],'STALE')
 await api('/tax-reconciliation?year=2026',undefined,'GET',409)
 await assert.rejects(taxLiabilityReport(h.pool,1),error=>error.status===409)
})
