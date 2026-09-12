import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
test('carrier invoices reserve exact employee deductions across partial allocations and concurrent revisions',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-CARRIER-MATCHING'})
 const path='/benefit-carrier-invoices',source=(await api(`${path}?month=2026-09`)).source;assert.equal(source.contributions.length,1);assert.equal(source.contributions[0].amountCents,12500)
 const body=(invoiceNumber,amount,previousId=null)=>({month:'2026-09',carrier:'Synthetic Carrier',invoiceNumber,invoiceDate:'2026-09-01',dueDate:'2026-09-30',amountCents:57500,reference:'Synthetic matched carrier invoice',reconciliation:'Reviewed coverage and employee funding against carrier records.',confirmed:true,fingerprint:source.fingerprint,previousId,allocation:{employerExpenseCents:57500-amount,employeeContributionCents:amount,reference:'Matched retained September payroll deduction',confirmed:true,contributions:amount?[{key:source.contributions[0].key,amountCents:amount}]:[]}})
 const invalid=body('BAD',100);invalid.allocation.contributions[0].key='missing';await api(path,invalid,'POST',409)
 const malformed=body('BAD',100);malformed.allocation.contributions=[null];await api(path,malformed,'POST',409)
 const absent=body('BAD',100);delete absent.allocation.contributions;await api(path,absent,'POST',409)
 const first=await api(path,body('ONE',7500));assert.equal((await api(path,body('ONE',7500))).id,first.id)
 await api(path,body('TWO',5001),'POST',409);const second=await api(path,body('TWO',5000))
 await api(path,body('ONE',7501,first.id),'POST',409)
 const zero=await api(path,body('ONE',0,first.id));await api(path,body('TWO',0,second.id))
 const responses=await Promise.all(['THREE','FOUR'].map(n=>fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body(n,10000))})))
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409])
 const history=(await api(`${path}?month=2026-09`)).history;assert.equal(history.find(r=>r.id===first.id).invoice.allocation.contributions[0].amountCents,7500);assert.equal(history.find(r=>r.id===zero.id).invoice.allocation.version,2)
 assert.equal(history.filter(r=>!r.superseded).reduce((n,r)=>n+r.invoice.allocation.employeeContributionCents,0),10000)
 await h.pool.query('UPDATE payroll_run_employee SET posttax_deduction_cents=posttax_deduction_cents+1 WHERE payroll_run_id=$1',[run.id]);assert.equal((await api(`${path}?month=2026-09`)).source,null);await api(path,body('FIVE',1),'POST',409)
})
test('legacy unlinked allocations block new assignments until reconciled',async()=>{
 const {matchCarrierContributions}=await import('../carrierContributionMatching.js')
 const invoice={month:'2026-09',carrier:'Current Carrier',invoiceNumber:'NEW',allocation:{employeeContributionCents:100,contributions:[{key:'retained',amountCents:100}]}},source={contributions:[{key:'retained',amountCents:12500}]}
 const db={query:async()=>({rows:[{invoice:{allocation:{employeeContributionCents:12500}}}]})}
 await assert.rejects(matchCarrierContributions(db,1,invoice,source),/older invoice allocations/)
})
