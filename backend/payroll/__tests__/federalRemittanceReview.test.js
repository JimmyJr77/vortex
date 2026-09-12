import {federalRemittanceBankSample} from '../testing/federalRemittanceBankSample.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomBytes} from 'node:crypto'
import {federalRemittanceInstruction} from '../federalRemittanceInstruction.js'
import {decryptDocument} from '../onboarding.js'
const base={agency:'IRS_941',year:2026,quarter:3,ein:'123456789',amountCents:123456,settlementDate:'2026-10-15'}
test('federal deposit instructions use tax-period codes rather than settlement dates',()=>{
 const i=federalRemittanceInstruction(base);assert.equal(i.addenda,'TXP*123456789*94105*260901*94105*123456\\');assert.equal(i.periodEnd,'2026-09-30');assert.equal(i.entryIdentification,base.ein);assert.equal(i.receivingRoutingNumber,'061036000');assert.equal(i.receivingAccountNumber,'23401009');assert.equal(i.statementDescriptor.length,10)
 const futa=federalRemittanceInstruction({...base,agency:'IRS_FUTA',quarter:1,settlementDate:'2026-04-30'});assert.equal(futa.taxCode,'09405');assert.equal(futa.taxPeriod,'261201');assert.equal(futa.periodEnd,'2026-12-31');assert.equal(futa.addenda,'TXP*123456789*09405*261201*09405*123456\\')
 assert.ok(federalRemittanceInstruction({...base,amountCents:9999999999}).addenda.length<=80)
 for(const change of [{year:2027},{agency:'MD_UI'},{quarter:0},{quarter:1.2},{ein:'000000000'},{ein:'12345678*'},{amountCents:0},{amountCents:1.1},{amountCents:10000000000},{settlementDate:'2026-02-31'}])assert.throws(()=>federalRemittanceInstruction({...base,...change}))
})
test('federal remittance review retains encrypted instructions and invalidates changed liability',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');t.after(()=>{if(old)process.env.PAYROLL_DOCUMENT_KEY=old;else delete process.env.PAYROLL_DOCUMENT_KEY})
 const {createHarness}=await import('../testing/harness.js'),{monthlyBenefitsFixture}=await import('../testing/monthlyBenefitsFixture.js');const h=await createHarness();t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-TAX-REMITTANCE'})
 await api('/federal-deposit-schedule',{year:2026,schedule:'MONTHLY',priorYearNextDay:false,source:'Synthetic complete federal schedule source',confirmed:true})
 const model=await api('/federal-remittance-review?year=2026');const obligation=model.obligations.find(o=>o.agency==='IRS_941');assert.ok(obligation);const input={year:2026,agency:'IRS_941',obligationKey:obligation.key,settlementDate:'2026-10-15'},path=`/federal-remittance-preview?${new URLSearchParams(input)}`
 assert.equal((await api(path)).status,'BLOCKED')
 const identity={identifier:'123456789',legalName:'Synthetic Payroll Employer',address:{line1:'1 Test Way',line2:'',city:'Baltimore',state:'MD',postalCode:'21201',country:'US'},confirmed:true,expectedRevision:0,reference:'Synthetic verified employer tax identity'}
 await api('/filing-identity',identity,'POST',201);let preview=await api(path);assert.equal(preview.status,'READY_FOR_REVIEW');assert.equal(preview.executionStatus,'NOT_CONNECTED');assert.equal(preview.identifierLast4,'6789');assert.equal(preview.taxPeriodEnd,'2026-09-30');assert.equal(JSON.stringify(preview).includes(identity.identifier),false)
 const body={...input,fingerprint:preview.fingerprint,reference:'Synthetic retained remittance review',confirmed:true}
 for(const [headers,status] of [[{'Content-Type':'application/json'},401],[{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},409]])assert.equal((await fetch(`${h.url}/api/admin/payroll/federal-remittance-reviews`,{method:'POST',headers,body:JSON.stringify(body)})).status,status)
 await api('/federal-remittance-reviews',{...body,confirmed:false},'POST',400);await api('/federal-remittance-reviews',{...body,fingerprint:'a'.repeat(64)},'POST',409)
 const responses=await Promise.all([0,1].map(()=>fetch(`${h.url}/api/admin/payroll/federal-remittance-reviews`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)})));assert.deepEqual(responses.map(r=>r.status).sort(),[200,201])
 const saved=(await h.pool.query('SELECT * FROM payroll_federal_remittance_review')).rows[0],instruction=JSON.parse(decryptDocument(saved.encrypted_instruction,`payroll-federal-remittance-review:1:${saved.id}`).toString());assert.equal(instruction.ein,identity.identifier);assert.equal(instruction.amountCents,preview.amountCents);assert.equal(JSON.stringify(saved.source_snapshot).includes(identity.identifier),false)
 const bankPath=`/federal-remittance-reviews/${saved.id}/bank-fields`,sample=federalRemittanceBankSample(instruction)
 assert.equal((await api(bankPath,{file:sample})).status,'TAX_FIELDS_MATCH');await api(bankPath,{file:'bad'},'POST',400)
 for(const [headers,status] of [[{'Content-Type':'application/json'},401],[{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},404]])assert.equal((await fetch(`${h.url}/api/admin/payroll${bankPath}`,{method:'POST',headers,body:JSON.stringify({file:sample})})).status,status)
 assert.equal((await h.pool.query('SELECT * FROM payroll_tax_deposit')).rowCount,0);assert.equal((await h.pool.query('SELECT * FROM payroll_payment_batch')).rowCount,0)
 assert.equal((await api('/federal-remittance-review?year=2026')).history[0].current,true);await assert.rejects(h.pool.query('DELETE FROM payroll_federal_remittance_review'),/append-only/)
 await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await api('/federal-remittance-review?year=2026')).history[0].id,saved.id)
 await api('/tax-deposits',{agency:'IRS_941',year:2026,quarter:3,paidOn:'2026-09-10',amountCents:1,reference:'SYNTHETIC-PRIOR-TAX-DEPOSIT',confirmed:true},'POST',201)
 assert.equal((await api('/federal-remittance-review?year=2026')).history[0].current,false);await api(bankPath,{file:sample},'POST',409);await api('/federal-remittance-reviews',body,'POST',409);preview=await api(path);assert.equal(preview.amountCents,instruction.amountCents-1)
 const changed=await api('/filing-identity',{...identity,expectedRevision:Number(saved.identity_id),identifier:'987654321'},'POST',201);assert.ok(changed.revision);assert.notEqual((await api(path)).fingerprint,preview.fingerprint)
 await api('/federal-remittance-review?year=2027',undefined,'GET',400);assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='FEDERAL_REMITTANCE_REVIEWED'")).rowCount,1)
})
