import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {hashPayrollToken} from '../employeeAuth.js'
test('electronic consent consumes PDF proof, retains signed terms and allows immediate withdrawal',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');const h=await createHarness();t.after(async()=>{await h.close();if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey})
 const {employee}=await monthlyBenefitsFixture(h);for(const token of ['consent-session','second-session'])await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[employee.id,hashPayrollToken(token)])
 const path=`${h.url}/api/payroll/employee/w2-electronic`,headers={Authorization:'Bearer consent-session','Content-Type':'application/json'}
 const get=async()=>{const r=await fetch(`${path}/consent`,{headers});assert.equal(r.status,200);return (await r.json()).data}
 const save=async(body,status=201)=>{const r=await fetch(`${path}/consent`,{method:'POST',headers,body:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const proof=async(token='consent-session')=>{const terms=(await get()).disclosure;const r=await fetch(`${path}/proof`,{method:'POST',headers:{...headers,Authorization:`Bearer ${token}`},body:JSON.stringify({termsFingerprint:terms.fingerprint})});assert.equal(r.status,200);const pdf=await PDFDocument.load(await r.arrayBuffer());return {proofId:r.headers.get('x-payroll-proof-id'),code:pdf.getForm().getTextField('access-code').getText(),termsFingerprint:terms.fingerprint}}
 assert.equal((await get()).status,'PAPER')
 const first=await proof(),base={decision:'CONSENT',confirmed:true,expectedRevision:0,signature:'Synthetic Employee'}
 await save({...base,...first,confirmed:false},400);await save({...base,...first,proofId:'------------------------------------'},400)
 for(let i=0;i<5;i++)await save({...base,...first,code:first.code==='AAAAAAAAAA'?'BBBBBBBBBB':'AAAAAAAAAA'},400)
 await save({...base,...first},409);assert.equal((await h.pool.query('SELECT count(*) FROM payroll_w2_proof_attempt WHERE proof_id=$1',[first.proofId])).rows[0].count,'5')
 const foreignSessionProof=await proof('second-session');await save({...base,...foreignSessionProof},409)
 const validProof=await proof(),consent=await save({...base,...validProof});assert.equal((await save({...base,...validProof},200)).reused,true)
 const data=await get();assert.equal(data.status,'CONSENTED');assert.equal(data.history[0].receipt.signature,'Synthetic Employee');assert.equal(data.history[0].receipt.terms.scope.includes('2026'),true)
 const stored=(await h.pool.query('SELECT encrypted_receipt FROM payroll_w2_consent WHERE id=$1',[consent.id])).rows[0];assert.equal(stored.encrypted_receipt.includes(Buffer.from('Synthetic Employee')),false)
 await assert.rejects(h.pool.query("UPDATE payroll_w2_consent SET decision='WITHDRAW' WHERE id=$1",[consent.id]),/append-only/);await assert.rejects(h.pool.query('DELETE FROM payroll_w2_consent WHERE id=$1',[consent.id]),/append-only/)
 await h.pool.query("UPDATE payroll_settings SET business_address='Synthetic revised employer contact' WHERE facility_id=1");assert.equal((await get()).status,'RENEWAL_REQUIRED')
 await save({decision:'WITHDRAW',confirmed:true,expectedRevision:0},409)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED' WHERE id=$1",[employee.id]);delete process.env.PAYROLL_DOCUMENT_KEY;assert.match((await get()).history[0].receiptIssue,/unavailable/)
 const withdrawn=await save({decision:'WITHDRAW',confirmed:true,expectedRevision:consent.id});assert.ok(withdrawn.effectiveAt);assert.equal((await get()).status,'PAPER');assert.equal((await save({decision:'WITHDRAW',confirmed:true,expectedRevision:consent.id},200)).reused,true)
 process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');await save({...base,...validProof,expectedRevision:withdrawn.id},409)
 const nextProof=await proof(),attempts=await Promise.all([1,2].map(()=>fetch(`${path}/consent`,{method:'POST',headers,body:JSON.stringify({...base,...nextProof,expectedRevision:withdrawn.id})})));assert.deepEqual(attempts.map(r=>r.status).sort(),[200,201])
 const renewed=(await attempts[0].json()).data;await attempts[1].json();const secondWithdrawal=await save({decision:'WITHDRAW',confirmed:true,expectedRevision:renewed.id});await save({...base,...nextProof,expectedRevision:secondWithdrawal.id},409)
 await h.pool.query('UPDATE payroll_employee_session SET revoked_at=now() WHERE employee_id=$1',[employee.id]);await save({decision:'WITHDRAW',confirmed:true,expectedRevision:withdrawn.id},401)
})
