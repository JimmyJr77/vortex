import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {decryptDocument} from '../onboarding.js'
test('FUTA review uses annual period for retained accrued year-end liability and excludes invalid bank dates',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');t.after(()=>{if(old)process.env.PAYROLL_DOCUMENT_KEY=old;else delete process.env.PAYROLL_DOCUMENT_KEY})
 const h=await createHarness();t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-FUTA-REMITTANCE'})
 await api('/federal-deposit-schedule',{year:2026,schedule:'MONTHLY',priorYearNextDay:false,source:'Synthetic verified federal schedule',confirmed:true})
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic verified FUTA credit and state rate',confirmed:true},'PATCH')
 await api('/filing-identity',{identifier:'123456789',legalName:'Synthetic Employer',address:{line1:'1 Test Way',line2:'',city:'Baltimore',state:'MD',postalCode:'21201',country:'US'},confirmed:true,expectedRevision:0,reference:'Synthetic employer identity review'},'POST',201)
 const model=await api('/federal-remittance-review?year=2026'),obligation=model.obligations.find(o=>o.agency==='IRS_FUTA');assert.ok(obligation)
 const body={year:2026,agency:'IRS_FUTA',obligationKey:obligation.key,settlementDate:'2027-02-01'}
 const preview=async input=>api(`/federal-remittance-preview?${new URLSearchParams(input)}`)
 const p=await preview(body);assert.equal(p.status,'READY_FOR_REVIEW');assert.equal(p.taxCode,'09405');assert.equal(p.taxPeriodEnd,'2026-12-31');assert.equal(p.late,false)
 for(const settlementDate of ['2026-02-31','2026-09-10','2026-10-17','2027-01-01'])assert.equal((await preview({...body,settlementDate})).status,'BLOCKED')
 assert.equal((await preview({...body,settlementDate:'2027-02-02'})).late,true)
 const saved=await api('/federal-remittance-reviews',{...body,fingerprint:p.fingerprint,reference:'Synthetic FUTA annual-period review',confirmed:true},'POST',201)
 const row=(await h.pool.query('SELECT encrypted_instruction FROM payroll_federal_remittance_review WHERE id=$1',[saved.id])).rows[0]
 const instruction=JSON.parse(decryptDocument(row.encrypted_instruction,`payroll-federal-remittance-review:1:${saved.id}`).toString());assert.equal(instruction.taxPeriod,'261201');assert.equal(instruction.amountCents,p.amountCents)
 assert.equal((await h.pool.query('SELECT * FROM payroll_tax_deposit')).rowCount,0)
})
