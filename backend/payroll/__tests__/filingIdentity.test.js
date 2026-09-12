import {refreshFilingIdentityAlerts} from '../filingIdentityAlerts.js'
import {hashPayrollToken} from '../employeeAuth.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {filingIdentityInput,readFilingIdentity} from '../filingIdentity.js'
const body={identifier:'123-45-6789',firstName:'Synthetic',middleName:'',lastName:'Employee',legalName:'Synthetic Employer LLC',address:{line1:'123 Test Street',city:'Bowie',state:'MD',postalCode:'20715',country:'US'},reference:'Synthetic signed identity source reviewed',confirmed:true,expectedRevision:0}
test('filing identity input requires complete identifiers and explicit reviewed source',()=>{
 assert.equal(filingIdentityInput(body,1).identifier,'123456789')
 assert.equal(filingIdentityInput({...body,marylandRegistrationNumber:'01234567'},null).marylandRegistrationNumber,'01234567')
 assert.equal(filingIdentityInput({...body,marylandRegistrationNumber:'01234567'},1).marylandRegistrationNumber,undefined)
 for(const value of ['1234567','123456789','00000000','12-34567',12345678])assert.throws(()=>filingIdentityInput({...body,marylandRegistrationNumber:value},null))
 for(const change of [{identifier:'6789'},{middleName:'x'.repeat(121)},{address:{...body.address,line2:'bad\nline'}},{confirmed:false},{expectedRevision:-1},{reference:'short'},{lastName:''},{address:{...body.address,country:'CA'}},{address:{...body.address,line1:''}}])assert.throws(()=>filingIdentityInput({...body,...change},1))
})
test('encrypted filing identity revisions preserve privacy, ownership and concurrent corrections',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const original=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const h=await createHarness();t.after(async()=>{await h.close();if(original===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=original})
 const call=async(path,body,facility=1,authenticated=true)=>{
  const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{...(authenticated?{Authorization:'Bearer payroll-test-admin'}:{}),'Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});return {status:response.status,json:await response.json(),cache:response.headers.get('cache-control')}
 }
 const employee=(await call('/employees',{employeeNumber:'IDENTITY',legalFirstName:'Synthetic',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500})).json.data
 const path=`/employees/${employee.id}/filing-identity`
 assert.equal((await call(path)).json.data.revision,0)
 assert.equal((await call(path,undefined,1,false)).status,401)
 assert.equal((await call(path,undefined,2)).status,404)
 assert.equal((await call(path,body,2)).status,404)
 const saved=await call(path,body);assert.equal(saved.status,201);assert.equal(saved.cache,'no-store')
 assert.equal(saved.json.data.identifierLast4,'6789')
 const revision=saved.json.data.revision
 const row=(await h.pool.query('SELECT * FROM payroll_filing_identity WHERE id=$1',[revision])).rows[0]
 assert.equal(row.encrypted_identity.includes(Buffer.from('123456789')),false)
 assert.equal(row.encrypted_identity.includes(Buffer.from('Synthetic')),false)
 assert.equal((await readFilingIdentity(h.pool,1,revision)).identifier,'123456789')
 await assert.rejects(readFilingIdentity(h.pool,2,revision),/not found/)
 const history=await call(path);assert.equal(history.cache,'no-store');assert.equal(JSON.stringify(history.json).includes('123456789'),false);assert.equal(JSON.stringify(history.json).includes('Test Street'),false)
 await assert.rejects(h.pool.query('UPDATE payroll_filing_identity SET identifier_last4=$2 WHERE id=$1',[revision,'0000']),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_filing_identity WHERE id=$1',[revision]),/append-only/)
 await assert.rejects(h.pool.query('INSERT INTO payroll_filing_identity(facility_id,employee_id,subject_key,encrypted_identity,identifier_last4,created_by) VALUES(2,$1,$2,$3,$4,99)',[employee.id,`EMPLOYEE:${employee.id}`,row.encrypted_identity,'6789']),/employee facility/)
 const results=await Promise.all([call(path,{...body,expectedRevision:revision,identifier:'123456788'}),call(path,{...body,expectedRevision:revision,identifier:'123456787'})])
 assert.deepEqual(results.map(r=>r.status).sort(),[201,409])
 assert.deepEqual((await call(path)).json.data.history.map(r=>r.status),['CURRENT','SUPERSEDED'])
 const employerSaved=await call('/filing-identity',{...body,marylandRegistrationNumber:'01234567'});assert.equal(employerSaved.status,201)
 assert.equal((await readFilingIdentity(h.pool,1,employerSaved.json.data.revision)).marylandRegistrationNumber,'01234567')
 assert.equal(JSON.stringify((await call('/filing-identity')).json).includes('01234567'),false)
 assert.equal(JSON.stringify(employerSaved.json).includes('01234567'),false)
 assert.equal((await call('/filing-identity',undefined,2)).json.data.revision,0)
 const audit=JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='FILING_IDENTITY_RECORDED'")).rows)
 assert.equal(audit.includes('01234567'),false);assert.equal(audit.includes('12345678'),false);assert.equal(audit.includes('Synthetic'),false)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[employee.id,hashPayrollToken('identity-review-session')])
 const self=async(body)=>{const response=await fetch(`${h.url}/api/payroll/employee/filing-identity${body?'/review':''}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer identity-review-session','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,json:await response.json()}}
 const shown=await self();assert.equal(shown.status,200);assert.equal(shown.json.data.firstName,'Synthetic');assert.equal(shown.json.data.address.line1,'123 Test Street');assert.equal(shown.json.data.identifier,undefined);assert.equal(shown.json.data.reference,undefined)
 const review={revision:shown.json.data.revision,decision:'CONFIRMED',confirmed:true}
 assert.equal((await self({...review,confirmed:false})).status,400)
 assert.equal((await self({...review,revision})).status,409)
 assert.equal((await self(review)).status,201);assert.equal((await self(review)).json.data.reused,true)
 assert.equal((await self()).json.data.review.decision,'CONFIRMED')
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED' WHERE id=$1",[employee.id])
 const correction=await self({...review,decision:'CORRECTION_REQUESTED'});assert.equal(correction.status,201)
 assert.equal((await call(path)).json.data.history[0].employee_review,'CORRECTION_REQUESTED')
 const alert=async()=> (await h.pool.query('SELECT status,message FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`filing-identity-correction-${employee.id}`])).rows[0]
 assert.equal((await alert()).status,'OPEN');assert.equal((await alert()).message.includes('12345678'),false)
 await h.pool.query("UPDATE payroll_alert SET status='DISMISSED' WHERE dedupe_key=$1",[`filing-identity-correction-${employee.id}`])
 await refreshFilingIdentityAlerts(h.pool,2);assert.equal((await alert()).status,'DISMISSED')
 await refreshFilingIdentityAlerts(h.pool,1);assert.equal((await alert()).status,'OPEN')
 assert.equal((await self(review)).status,201);assert.equal((await alert()).status,'DISMISSED')
 assert.equal((await self({...review,decision:'CORRECTION_REQUESTED'})).status,201);assert.equal((await alert()).status,'OPEN')

 await assert.rejects(h.pool.query('DELETE FROM payroll_filing_identity_employee_review WHERE id=$1',[correction.json.data.id]),/append-only/)
 await assert.rejects(h.pool.query("INSERT INTO payroll_filing_identity_employee_review(facility_id,employee_id,identity_id,decision) VALUES(2,$1,$2,'CONFIRMED')",[employee.id,review.revision]),/identity ownership/)
 assert.equal((await call(path,{...body,expectedRevision:review.revision})).status,201)
 assert.equal((await self()).json.data.review,null)
 assert.equal((await alert()).status,'DISMISSED');await refreshFilingIdentityAlerts(h.pool,1);assert.equal((await alert()).status,'DISMISSED')
 assert.equal((await self(review)).status,409)
 await h.pool.query('UPDATE payroll_employee_session SET revoked_at=now() WHERE employee_id=$1',[employee.id])
 assert.equal((await self()).status,401)
 delete process.env.PAYROLL_DOCUMENT_KEY
 const current=(await call(path)).json.data.revision
 assert.equal((await call(path,{...body,expectedRevision:current})).status,503)
 assert.equal((await call(path)).json.data.revision,current)
})
