import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHarness} from '../testing/harness.js'
import {retainPayrollPaymentInstruction} from '../paymentInstructions.js'

test('retained payment instructions serialize retries, reject changed instructions and preserve approved evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const employee=(await h.pool.query(`INSERT INTO payroll_employee(facility_id,employee_number,legal_first_name,legal_last_name,job_title,hire_date,work_state,residence_state) VALUES(1,'PAYMENT_TEST','Synthetic','Employee','Test','2026-01-01','MD','MD') RETURNING id`)).rows[0]
 const run=(await h.pool.query(`INSERT INTO payroll_run(facility_id,status,payment_date,calculation_snapshot) VALUES(1,'APPROVED','2026-09-18','{"synthetic":true}') RETURNING id`)).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,net_pay_cents) VALUES($1,$2,12345)',[run.id,employee.id])
 const input={facilityId:1,runId:Number(run.id),employeeId:Number(employee.id),mode:'TEST',originatingAccountId:'00000000-0000-4000-8000-000000000002',receivingAccountId:'00000000-0000-4000-8000-000000000003',amountCents:12345,paymentDate:'2026-09-18'}
 const retain=async(value=input)=>{const client=await h.pool.connect();try{await client.query('BEGIN');const result=await retainPayrollPaymentInstruction(client,value,{actorId:99});await client.query('COMMIT');return result}catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}}
 await assert.rejects(retain({...input,facilityId:2}),/approved payroll run/)
 await assert.rejects(retain({...input,amountCents:12344}),/match an approved/)
 await assert.rejects(retain({...input,paymentDate:'2026-09-19'}),/match an approved/)
 const concurrent=await Promise.all([retain(),retain()]);assert.deepEqual(concurrent.map(r=>r.reused).sort(),[false,true]);assert.equal(concurrent[0].intent.id,concurrent[1].intent.id)
 await assert.rejects(retain({...input,receivingAccountId:input.originatingAccountId}),/different payment instruction/)
 const retained=(await h.pool.query('SELECT * FROM payroll_payment_instruction')).rows
 assert.equal(retained.length,1);assert.deepEqual(retained[0].calculation_snapshot,{synthetic:true});assert.equal(retained[0].created_by,'99')
 await assert.rejects(h.pool.query('UPDATE payroll_payment_instruction SET amount_cents=1'),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_payment_instruction'),/append-only/)
 // Migration reruns must preserve payment evidence and its protections.
 await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'))
 assert.equal((await retain()).intent.id,concurrent[0].intent.id)
 await assert.rejects(h.pool.query('DELETE FROM payroll_payment_instruction'),/append-only/)
})
