import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {writeFile} from 'node:fs/promises'
import {PDFDocument} from 'pdf-lib'
import {w2ElectronicTerms} from '../w2ElectronicTerms.js'
import {hashPayrollToken} from '../employeeAuth.js'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
test('electronic W-2 disclosures bind employer contacts and format to a tax year',()=>{
 const settings={legal_business_name:'Synthetic employer',business_address:'123 Example Street',onboarding_policy:{businessPhone:'555-0100'}},terms=w2ElectronicTerms(1,settings)
 assert.equal(terms.available,true);assert.equal(terms.terms.year,2026);assert.match(terms.terms.paperDefault,/paper/);assert.match(terms.terms.withdrawal,/immediately/)
 assert.equal(w2ElectronicTerms(1,{...settings,onboarding_policy:{}}).available,false)
 assert.notEqual(w2ElectronicTerms(2,settings).fingerprint,terms.fingerprint)
 assert.notEqual(w2ElectronicTerms(1,{...settings,business_address:'456 Example Street'}).fingerprint,terms.fingerprint)
})
test('employee PDF access proof is private, session-bound and does not grant consent',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {employee}=await monthlyBenefitsFixture(h)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[employee.id,hashPayrollToken('w2-access-session')])
 const path=`${h.url}/api/payroll/employee/w2-electronic`,headers={Authorization:'Bearer w2-access-session','Content-Type':'application/json'}
 const termsResponse=await fetch(`${path}/terms`,{headers}),terms=(await termsResponse.json()).data;assert.equal(termsResponse.status,200);assert.equal(terms.available,true)
 assert.equal((await fetch(`${path}/proof`,{method:'POST',headers,body:JSON.stringify({termsFingerprint:'a'.repeat(64)})})).status,409)
 const response=await fetch(`${path}/proof`,{method:'POST',headers,body:JSON.stringify({termsFingerprint:terms.fingerprint})});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('content-type'),'application/pdf')
 const id=response.headers.get('x-payroll-proof-id'),bytes=Buffer.from(await response.arrayBuffer()),pdf=await PDFDocument.load(bytes),field=pdf.getForm().getTextField('access-code'),code=field.getText();assert.equal(pdf.getPageCount(),1);assert.equal(field.isReadOnly(),true);assert.match(code,/^[A-F0-9]{10}$/)
 const row=(await h.pool.query('SELECT * FROM payroll_w2_access_proof WHERE id=$1',[id])).rows[0];assert.equal(row.code_hash,createHash('sha256').update(`${id}:${code}`).digest('hex'));assert.equal(Number(row.employee_id),employee.id);assert.equal(row.terms_fingerprint,terms.fingerprint);assert.equal(new Date(row.expires_at)>new Date(row.created_at),true)
 await assert.rejects(h.pool.query('UPDATE payroll_w2_access_proof SET code_hash=$1 WHERE id=$2',['a'.repeat(64),id]),/append-only/)
 assert.equal((await fetch(`${path}/proof`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({termsFingerprint:terms.fingerprint})})).status,401)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED' WHERE id=$1",[employee.id]);const former=await fetch(`${path}/proof`,{method:'POST',headers,body:JSON.stringify({termsFingerprint:terms.fingerprint})});assert.equal(former.status,200);await former.arrayBuffer()
 await h.pool.query('UPDATE payroll_employee_session SET revoked_at=now() WHERE employee_id=$1',[employee.id]);assert.equal((await fetch(`${path}/proof`,{method:'POST',headers,body:JSON.stringify({termsFingerprint:terms.fingerprint})})).status,401)
 await writeFile('/tmp/payroll-w2-access-proof.pdf',bytes)
})
