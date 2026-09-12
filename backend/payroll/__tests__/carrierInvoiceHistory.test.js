import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {carrierInvoiceHistoryFixture} from '../testing/carrierInvoiceHistoryFixture.js'
test('invoice evidence pagination preserves microsecond ties, snapshot bounds and employer scope',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,invoice,append}=await carrierInvoiceHistoryFixture(h)
 const path=`/benefit-carrier-invoices/${invoice.id}/reconciliation-history`,first=await api(path)
 assert.equal(first.events.length,20);assert.ok(first.nextCursor);assert.equal(first.events[0].assessment.issues[0],'Synthetic historical review 25');assert.equal(first.events[5].kind,2)
 const added=await append(26,'2020-01-01T00:00:00.000001Z')
 const next=await api(`${path}?cursor=${encodeURIComponent(first.nextCursor)}`)
 assert.equal(next.events.length,6);assert.equal(next.nextCursor,null)
 const keys=[...first.events,...next.events].map(e=>`${e.kind}:${e.id}`);assert.equal(new Set(keys).size,26);assert.equal(keys.includes(`1:${added}`),false)
 const refreshed=await api(path),older=await api(`${path}?cursor=${encodeURIComponent(refreshed.nextCursor)}`);assert.equal(older.events.length,7);assert.equal(older.events.at(-1).id,added)
 await api(`${path}?cursor=broken`,undefined,'GET',400)
 const wrong=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(first.nextCursor,'base64url').toString()),invoiceId:'00000000-0000-4000-8000-000000000001'})).toString('base64url')
 await api(`${path}?cursor=${wrong}`,undefined,'GET',400)
 const badDate=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(first.nextCursor,'base64url').toString()),at:'2026-02-31T12:00:00.000001Z'})).toString('base64url');await api(`${path}?cursor=${badDate}`,undefined,'GET',400)
 const response=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(response.status,404)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`)).status,401)
 const good=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin'}});assert.equal(good.headers.get('cache-control'),'no-store')
 const original=(await h.pool.query('SELECT invoice,source_fingerprint FROM payroll_benefit_carrier_invoice WHERE id=$1',[invoice.id])).rows[0]
 const revised=await api('/benefit-carrier-invoices',{...original.invoice,previousId:invoice.id,fingerprint:original.source_fingerprint,confirmed:true,amountCents:60000})
 const secondPath=`/benefit-carrier-invoices/${revised.id}/reconciliation-history`;assert.deepEqual((await api(secondPath)).events,[]);await api(`${secondPath}?cursor=${first.nextCursor}`,undefined,'GET',400)
 const overflow=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(first.nextCursor,'base64url').toString()),maxAssessmentId:'9223372036854775808'})).toString('base64url');await api(`${path}?cursor=${overflow}`,undefined,'GET',400)

})
