import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createHarness} from '../testing/harness.js'

for(const scenario of ['TIED','CLOCK_REGRESSED','MONTH_CHANGED'])test(`carrier invoice current revision is independent of timestamp order (${scenario})`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const get=async(month,facility=1)=>{
  const response=await fetch(`${h.url}/api/admin/payroll/benefit-carrier-invoices?month=${month}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':String(facility)}})
  assert.equal(response.status,200);return (await response.json()).data
 }
 const firstId='ffffffff-0000-4000-8000-000000000001',latestId='aaaaaaaa-0000-4000-8000-000000000002'
 for(const [id,revision,month,createdAt] of [[firstId,1,'2026-09','2026-09-13T16:00:00Z'],[latestId,2,scenario==='MONTH_CHANGED'?'2026-10':'2026-09',scenario==='CLOCK_REGRESSED'?'2026-09-13T15:00:00Z':'2026-09-13T16:00:00Z']]){
  const source=(await get(month)).source
  const invoice={month,carrier:'Synthetic Carrier',invoiceNumber:'SAME-INVOICE',invoiceDate:`${month}-01`,dueDate:`${month}-28`,amountCents:10000*revision,reference:'Synthetic revision ordering fixture',reconciliation:'Retained synthetic invoice with complete current source evidence.',confirmed:true}
  await h.pool.query(`INSERT INTO payroll_benefit_carrier_invoice(id,facility_id,coverage_month,carrier_key,invoice_key,revision,invoice,source_snapshot,source_fingerprint,payload_fingerprint,created_by,created_at) VALUES($1,1,$2,'synthetic carrier','same-invoice',$3,$4,$5,$6,$7,99,$8)`,[id,month,revision,invoice,source,source.fingerprint,createHash('sha256').update(JSON.stringify(invoice)).digest('hex'),createdAt])
 }
 const september=(await get('2026-09')).history,old=september.find(row=>row.id===firstId)
 assert.equal(old.superseded,true,'An older revision must never become current because of its timestamp, UUID, or month')
 assert.equal(old.current,false)
 const current=(await get(scenario==='MONTH_CHANGED'?'2026-10':'2026-09')).history.find(row=>row.id===latestId)
 assert.equal(current.superseded,false);assert.equal(current.current,true)
 assert.equal(current.invoice.amountCents,20000)
 assert.equal(september.filter(row=>!row.superseded).length,scenario==='MONTH_CHANGED'?0:1)
 if(scenario==='TIED')assert.equal(september[0].id,latestId)
 assert.deepEqual((await get('2026-09',2)).history,[])
 await assert.rejects(h.pool.query('UPDATE payroll_benefit_carrier_invoice SET revision=99 WHERE id=$1',[firstId]),/append-only/)
})
