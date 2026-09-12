import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
test('carrier invoices retain scoped, immutable, idempotent revisions and detect changed payroll evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const priorKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='17'.repeat(32);t.after(()=>{if(priorKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=priorKey})
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const path='/benefit-carrier-invoices',read=`${path}?month=2026-09`,initial=await api(read)
 const body={month:'2026-09',carrier:'Synthetic Health',invoiceNumber:'INV-SEP-26',invoiceDate:'2026-09-01',dueDate:'2026-09-30',amountCents:57500,reference:'Synthetic carrier invoice September 2026',reconciliation:'Matched medical enrollment, coverage dates and carrier total with no credits.',confirmed:true,fingerprint:initial.source.fingerprint}
 await api(path,{...body,confirmed:false},'POST',400);await api(path,{...body,amountCents:0},'POST',400);await api(path,{...body,dueDate:'2026-08-31'},'POST',400);await api(path,{...body,fingerprint:'outdated'},'POST',409)
 const one=await api(path,body),retry=await api(path,body);assert.equal(retry.id,one.id);assert.equal(retry.reused,true)
 await api(path,{...body,amountCents:60000},'POST',409)
 const second=await api(path,{...body,amountCents:60000,previousId:one.id}),history=(await api(read)).history
 assert.equal(history.length,2);assert.equal(history[0].id,second.id);assert.equal(history[0].current,true);assert.equal(history[1].superseded,true);assert.equal(history[0].paymentStatus,'NOT_SUBMITTED')
 const url=`${h.url}/api/admin/payroll${read}`
 assert.equal((await fetch(url)).status,401)
 const scoped=await fetch(url,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(scoped.status,200);assert.deepEqual((await scoped.json()).data.history,[])
 await assert.rejects(h.pool.query('UPDATE payroll_benefit_carrier_invoice SET revision=99 WHERE id=$1',[one.id]),/append-only/i)
 await assert.rejects(h.pool.query('DELETE FROM payroll_benefit_carrier_invoice WHERE id=$1',[one.id]),/append-only/i)
 const packet=await api('/onboarding',undefined,'GET',200,true),task=packet.tasks.find(t=>t.task_key==='PAY_REVIEW')
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Reviewed employer funding for continued medical coverage',paySetupFingerprint:packet.paySetup.fingerprint,benefitsReview:{disposition:'ENROLLED_EMPLOYER_FUNDED',effectiveOn:'2026-09-01',summary:'Employer assumes full group medical premium.',evidenceReference:'Synthetic excluded group health funding review',confirmed:true,employerFundingConfirmed:true,fundingTreatment:'EXCLUDED_GROUP_HEALTH_PREMIUM'}})
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-CARRIER-INVOICE-WAGES'})
 const changed=await api(read);assert.equal(changed.history[0].current,false);assert.equal(changed.source.funding.length,1)
 await api(path,{...body,previousId:second.id},'POST',409)
 const allocation={employerExpenseCents:57500,employeeContributionCents:0,reference:'Matched employer expense with no employee collections',confirmed:true}
 await api(path,{...body,previousId:second.id,fingerprint:changed.source.fingerprint,allocation:{...allocation,employeeContributionCents:1}},'POST',400)
 const revised={...body,previousId:second.id,fingerprint:changed.source.fingerprint,allocation}
 const replies=await Promise.all([api(path,revised),api(path,revised)]);assert.equal(replies[0].id,replies[1].id)
 assert.equal((await api(read)).history.length,3);assert.equal((await api(read)).history[0].invoice.allocation.employerExpenseCents,57500);assert.equal((await api(read)).history[0].accountingStatus,'NOT_POSTED')

 const documentPath=`${path}/${one.id}/documents`,file={filename:'carrier-invoice.png',contentBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/ZkAAAAASUVORK5CYII='}
 await api(documentPath,{filename:'bad.html',contentBase64:Buffer.from('<script>alert(1)</script>').toString('base64')},'POST',400)
 const attachment=await api(documentPath,file),again=await api(documentPath,file);assert.equal(again.id,attachment.id);assert.equal(again.reused,true)
 const bytes=Buffer.from(file.contentBase64,'base64'),downloadUrl=`${h.url}/api/admin/payroll${documentPath}/${attachment.id}`
 const downloaded=await fetch(downloadUrl,{headers:{Authorization:'Bearer payroll-test-admin'}});assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('cache-control'),'no-store');assert.match(downloaded.headers.get('content-disposition'),/attachment/);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),bytes)
 assert.equal((await fetch(downloadUrl,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}})).status,404)
 assert.equal((await fetch(downloadUrl.replace(one.id,second.id),{headers:{Authorization:'Bearer payroll-test-admin'}})).status,404)
 assert.equal((await fetch(downloadUrl)).status,401)
 const retained=(await h.pool.query('SELECT encrypted_content FROM payroll_benefit_carrier_document WHERE id=$1',[attachment.id])).rows[0];assert.equal(retained.encrypted_content.includes(bytes),false)
 await assert.rejects(h.pool.query('DELETE FROM payroll_benefit_carrier_document WHERE id=$1',[attachment.id]),/append-only/)
 assert.equal((await api(read)).history.find(r=>r.id===one.id).documents[0].filename,file.filename)
 delete process.env.PAYROLL_DOCUMENT_KEY
 await api(documentPath,{filename:'second.pdf',contentBase64:Buffer.from('%PDF-1.4 synthetic invoice fixture').toString('base64')},'POST',503)
 assert.equal((await api(read)).documentStorageReady,false);process.env.PAYROLL_DOCUMENT_KEY='17'.repeat(32)
 for(let n=1;n<20;n++)await api(documentPath,{filename:`fixture-${n}.pdf`,contentBase64:Buffer.from(`%PDF-1.4 synthetic carrier fixture ${n}`).toString('base64')})
 await api(documentPath,{filename:'overflow.pdf',contentBase64:Buffer.from('%PDF-1.4 synthetic overflow').toString('base64')},'POST',409)
 assert.equal((await api(documentPath,file)).id,attachment.id)
 assert.equal((await api(read)).history.find(r=>r.id===one.id).documents.length,20)

 const saved=(await h.pool.query('SELECT source_snapshot FROM payroll_benefit_carrier_invoice WHERE id=$1',[one.id])).rows[0];assert.equal(saved.source_snapshot.funding.length,0)
 await h.pool.query(await fs.readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await api(read)).history.length,3)
 const snapshot=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[run.id])).rows[0].calculation_snapshot;snapshot.employees[0].benefitCollection.fundingItems[0].employerMonthlyCents++
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[snapshot,run.id]);const invalid=await api(read);assert.equal(invalid.source,null);assert.match(invalid.sourceIssue,/reconciliation/);assert.equal(invalid.history.length,3);assert.equal(invalid.history.some(r=>r.current),false)
})
