import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {carrierRecipientInput,decryptCarrierRecipient,readCurrentCarrierRecipient} from '../carrierRemittanceRecipient.js'
import {createHarness} from '../testing/harness.js'
import {carrierInvoiceHistoryFixture} from '../testing/carrierInvoiceHistoryFixture.js'
const body=()=>({action:'REVIEW',expectedRevision:0,requestKey:randomUUID(),confirmed:true,name:'Benefits remittance team',email:'Advice@EXAMPLE.COM',reference:'Independent carrier phone confirmation on retained invoice'})
test('recipient input requires one confirmed bare address and normalizes only its domain',()=>{
 assert.equal(carrierRecipientInput(body()).email,'Advice@example.com')
 for(const patch of [{email:'Name <a@example.com>'},{email:'a@example.com,b@example.com'},{email:'a@example.com; b@example.com'},{email:'a\r\nb@example.com'},{email:'a@b'},{confirmed:false},{name:'x'},{reference:'short'},{expectedRevision:-1},{requestKey:'bad'}])assert.throws(()=>carrierRecipientInput({...body(),...patch}),{status:400})
 assert.equal(carrierRecipientInput({...body(),action:'REVOKE',email:'ignored'}).email,null)
})
test('carrier recipient reviews encrypt contacts, reject stale edits and retain scoped immutable revocations',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const key=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='29'.repeat(32);t.after(()=>{if(key===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=key})
 const h=await createHarness();t.after(()=>h.close());const {api,invoice}=await carrierInvoiceHistoryFixture(h),path=`/benefit-carrier-invoices/${invoice.id}/remittance-recipient`
 assert.equal((await api(path)).status,'NOT_REVIEWED');await api(path,{...body(),action:'REVOKE'},'POST',409)
 const firstBody=body(),first=await api(path,firstBody);assert.equal(first.revision,1);assert.equal(first.status,'REVIEWED');assert.equal(first.current.email,'Advice@example.com');assert.equal(first.history[0].email,'A***@example.com')
 const repeated=await api(path,firstBody);assert.equal(repeated.reused,true);assert.equal(repeated.history.length,1)
 await api(path,{...firstBody,email:'changed@example.com'},'POST',409)
 const rows=(await h.pool.query('SELECT * FROM payroll_carrier_remittance_recipient')).rows;assert.equal(rows.length,1);assert.equal(rows[0].encrypted_contact.toString().includes('Advice@'),false);assert.equal(decryptCarrierRecipient(rows[0]).reference,firstBody.reference)
 assert.throws(()=>decryptCarrierRecipient({...rows[0],facility_id:2}));assert.throws(()=>decryptCarrierRecipient({...rows[0],content_sha256:'0'.repeat(64)}))
 const concurrent=await Promise.all([api(path,{...body(),expectedRevision:1,email:'one@example.com'},'POST',undefined),api(path,{...body(),expectedRevision:1,email:'two@example.com'},'POST',undefined)].map(p=>p.then(v=>({ok:true,v}),e=>({ok:false,e}))))
 assert.equal(concurrent.filter(v=>v.ok).length,1);assert.equal((await api(path)).revision,2)
 const revoke={...body(),action:'REVOKE',expectedRevision:2,reference:'Carrier advised previous contact is no longer authorized'},revoked=await api(path,revoke)
 assert.equal(revoked.status,'REVOKED');assert.equal(revoked.current,null);assert.equal(revoked.history.length,3)
 assert.equal((await readCurrentCarrierRecipient(h.pool,1,'synthetic history carrier')).action,'REVOKE');assert.equal(await readCurrentCarrierRecipient(h.pool,2,'synthetic history carrier'),null)
 const original=(await h.pool.query('SELECT invoice,source_fingerprint FROM payroll_benefit_carrier_invoice WHERE id=$1',[invoice.id])).rows[0],revised=await api('/benefit-carrier-invoices',{...original.invoice,previousId:invoice.id,fingerprint:original.source_fingerprint,confirmed:true,amountCents:60000})
 const revisedPath=`/benefit-carrier-invoices/${revised.id}/remittance-recipient`;assert.equal((await api(revisedPath)).revision,3)
 const restored=await api(revisedPath,{...body(),expectedRevision:3,email:'new@example.com'});assert.equal(restored.revision,4);assert.equal((await api(path)).current.email,'new@example.com')
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_remittance_recipient'),/append-only/)
 await assert.rejects(h.pool.query("UPDATE payroll_carrier_remittance_recipient SET action='REVOKE'"),/append-only/)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_remittance_recipient(facility_id,invoice_id,carrier_key,revision,previous_id,action,encrypted_contact,content_sha256,request_key,request_fingerprint,created_by) SELECT 2,invoice_id,carrier_key,1,NULL,action,encrypted_contact,content_sha256,$1,request_fingerprint,created_by FROM payroll_carrier_remittance_recipient LIMIT 1',[randomUUID()]),/scoped carrier invoice/)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_remittance_recipient(facility_id,invoice_id,carrier_key,revision,previous_id,action,encrypted_contact,content_sha256,request_key,request_fingerprint,created_by) SELECT facility_id,invoice_id,carrier_key,5,NULL,action,encrypted_contact,content_sha256,$1,request_fingerprint,created_by FROM payroll_carrier_remittance_recipient LIMIT 1',[randomUUID()]),/current history/)
 const foreignHeaders={Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'}
 assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`,{headers:foreignHeaders})).status,404);assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:foreignHeaders,body:JSON.stringify(body())})).status,404)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`)).status,401)
 const response=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin'}});assert.equal(response.headers.get('cache-control'),'no-store')
 await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await api(path)).history.length,4)
 const audit=(await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='CARRIER_REMITTANCE_RECIPIENT_REVIEWED'")).rows;assert.equal(audit.length,4);assert.equal(JSON.stringify(audit).includes('@'),false)
})
