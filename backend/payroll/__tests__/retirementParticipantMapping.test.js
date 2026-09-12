import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {regularRetirementFixture} from '../testing/regularRetirementFixture.js'
import {readRetirementParticipantMapping} from '../retirementParticipantMapping.js'
test('participant mappings protect identifiers, concurrent reuse, duplicates and changed employee sources',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const previousKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const h=await createHarness({retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(async()=>{await h.close();if(previousKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previousKey})
 const {api,employee,periods}=await regularRetirementFixture(h),path=`/employees/${employee.id}/retirement-participant/standard`
 const source=await api(path);assert.equal(source.status,'REVIEW_REQUIRED')
 const body={sourceFingerprint:source.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),disposition:'VERIFIED',providerPlanId:'RECORDKEEPER-PLAN-10001',participantId:'PRIVATE-PARTICIPANT-54321',reference:'Recordkeeper roster and employee identity independently reviewed',confirmed:true}
 for(const patch of [{confirmed:false},{participantId:''},{providerPlanId:'bad\nidentifier'},{reference:'short'}])await api(path,{...body,...patch},'POST',400)
 await api(path,{...body,sourceFingerprint:'wrong'},'POST',409)
 const [a,b]=await Promise.all([api(path,body),api(path,body)]);assert.equal(a.id,b.id)
 const current=await api(path);assert.equal(current.status,'VERIFIED');assert.equal(current.history.length,1);assert.equal(current.history[0].masked_identifiers.participantId,'••••4321');assert.ok(!JSON.stringify(current).includes(body.participantId));assert.ok(!JSON.stringify(current).includes(body.providerPlanId))
 const row=(await h.pool.query('SELECT * FROM payroll_retirement_participant_mapping')).rows[0];assert.ok(!row.encrypted_identifiers.includes(Buffer.from(body.participantId)));assert.equal((await readRetirementParticipantMapping(h.pool,1,employee.id,'standard')).identifiers.participantId,body.participantId)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-PARTICIPANT-MAPPING'})
 const remittance=await api('/retirement-remittance-sources');assert.equal(remittance.items[0].allocations[0].participantMapping.status,'VERIFIED');assert.ok(!JSON.stringify(remittance).includes(body.participantId))
 await api(path,{...body,participantId:'DIFFERENT-ID'},'POST',409)
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404);assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`)).status,401)
 const other=await api('/employees',{employeeNumber:'OTHER-MAPPED',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201),otherPath=`/employees/${other.id}/retirement-participant/standard`,otherSource=await api(otherPath)
 const otherBody={...body,sourceFingerprint:otherSource.source.fingerprint,requestKey:randomUUID()}
 await api(otherPath,otherBody,'POST',409)
 await h.pool.query("UPDATE payroll_employee SET legal_last_name='Changed' WHERE id=$1",[employee.id])
 assert.equal((await api('/retirement-remittance-sources')).items[0].allocations[0].participantMapping.status,'REVIEW_REQUIRED');
 assert.equal((await api(path)).status,'REVIEW_REQUIRED');await assert.rejects(readRetirementParticipantMapping(h.pool,1,employee.id,'standard'),{status:409})
 assert.equal((await api(path,body)).id,a.id)
 const changed=await api(path);await api(path,{...body,requestKey:randomUUID(),sourceFingerprint:changed.source.fingerprint,expectedRevision:1,disposition:'SUSPENDED'})
 assert.equal((await api(path)).status,'SUSPENDED');await assert.rejects(readRetirementParticipantMapping(h.pool,1,employee.id,'standard'),{status:409})
 await api(otherPath,otherBody);assert.equal((await api(otherPath)).status,'VERIFIED')
 await api(path,{...body,requestKey:randomUUID(),sourceFingerprint:changed.source.fingerprint,expectedRevision:2},'POST',409)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_participant_mapping'),/append-only/)
 await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_participant_mapping SELECT $1,2,employee_id,plan_id,plan_revision_id,revision,source_fingerprint,source,disposition,encrypted_identifiers,masked_identifiers,identity_fingerprint,reference,$2,request_fingerprint,created_by,created_at FROM payroll_retirement_participant_mapping LIMIT 1',[randomUUID(),randomUUID()]),/current scoped employee/)
})
