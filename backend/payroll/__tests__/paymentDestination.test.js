import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {readPayrollPaymentDestination} from '../paymentDestination.js'
import {hashPayrollToken} from '../employeeAuth.js'
import {employeePaymentReadiness} from '../paymentReadiness.js'
import {employeePaySetup} from '../employeePaySetup.js'
test('employee destinations require verified provider details and stay scoped, encrypted and awaiting authorization',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
 let provider={id:id(3),counterparty_id:id(4),account_type:'checking',party_type:'individual',party_name:'Synthetic Employee',live_mode:false,verification_status:'verified',account_details:[{account_number_safe:'1234',account_number:'synthetic-private-account'}]},calls=0
 const h=await createHarness({paymentFetcher:async(url,options)=>{calls++;assert.equal(options.method,undefined);assert.equal(url,`https://app.moderntreasury.com/api/external_accounts/${id(3)}`);return {ok:true,json:async()=>provider}}});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const employee=(await h.pool.query(`INSERT INTO payroll_employee(facility_id,employee_number,legal_first_name,legal_last_name,job_title,hire_date,work_state,residence_state) VALUES(1,'DESTINATION_TEST','Synthetic','Employee','Test','2026-01-01','MD','MD') RETURNING id`)).rows[0]
 const headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},base=`${h.url}/api/admin/payroll`,configuration={organizationId:id(1),originatingAccountId:id(2),apiKey:'synthetic-destination-secret',mode:'TEST',reference:'Synthetic employer payment configuration',expectedRevision:0,confirmed:true}
 const connect=async body=>{const r=await fetch(`${base}/payment-connection`,{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,201);return (await r.json()).data.revision}
 const connectionId=await connect(configuration),path=`${base}/employees/${employee.id}/payment-destination`,body={connectionId,accountId:id(3),expectedRevision:0,reference:'Synthetic account ownership review evidence',confirmed:true}
 const save=(value=body,extraHeaders={})=>fetch(path,{method:'POST',headers:{...headers,...extraHeaders},body:JSON.stringify(value)})
 assert.equal((await fetch(path)).status,401);assert.equal((await save(body,{'x-test-facility':'2'})).status,404);assert.equal(calls,0)
 assert.equal((await save({...body,confirmed:false})).status,400)
 provider.verification_status='unverified';assert.equal((await save()).status,409);provider.verification_status='verified'
 provider.live_mode=true;assert.equal((await save()).status,409);provider.live_mode=false
 const first=await save();assert.equal(first.status,201);const revision=(await first.json()).data.revision
 assert.equal((await save()).status,409)
 const same=await save({...body,expectedRevision:revision});assert.equal(same.status,200);assert.equal((await same.json()).data.reused,true)
 const publicData=await (await fetch(path,{headers})).json();assert.equal(publicData.data.status,'EMPLOYEE_AUTHORIZATION_REQUIRED');assert.equal(publicData.data.account.accountLast4,'1234');assert.equal(JSON.stringify(publicData).includes(id(3)),false);assert.equal(JSON.stringify(publicData).includes('synthetic-private-account'),false)
 assert.equal((await readPayrollPaymentDestination(h.pool,1,Number(employee.id),revision)).accountId,id(3))
 await assert.rejects(readPayrollPaymentDestination(h.pool,2,Number(employee.id),revision),/not found/)
 const stored=(await h.pool.query('SELECT encrypted_destination FROM payroll_payment_destination')).rows[0];assert.equal(stored.encrypted_destination.includes(Buffer.from(id(3))),false)
 await assert.rejects(h.pool.query('DELETE FROM payroll_payment_destination'),/append-only/)
 await assert.rejects(h.pool.query('UPDATE payroll_payment_destination SET employee_id=employee_id'),/append-only/)
 await h.pool.query("UPDATE payroll_settings SET legal_business_name='Synthetic Employer' WHERE facility_id=1")
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[employee.id,hashPayrollToken('synthetic-authorization-session')])
 const selfPath=`${h.url}/api/payroll/employee/payment-authorization`,selfHeaders={Authorization:'Bearer synthetic-authorization-session','Content-Type':'application/json'}
 assert.equal((await fetch(selfPath)).status,401)
 const authorization=(await (await fetch(selfPath,{headers:selfHeaders})).json()).data
 assert.equal(authorization.status,'AUTHORIZATION_REQUIRED');assert.equal(authorization.terms.account.accountLast4,'1234');assert.equal(JSON.stringify(authorization).includes(id(3)),false)
 const authorizeBody={destinationId:revision,expectedRevision:0,decision:'AUTHORIZE',signature:'Synthetic Employee',fingerprint:authorization.fingerprint,confirmed:true}
 const decision=value=>fetch(selfPath,{method:'POST',headers:selfHeaders,body:JSON.stringify(value)})
 assert.equal((await decision({...authorizeBody,fingerprint:'stale'})).status,409)
 assert.equal((await decision({...authorizeBody,confirmed:false})).status,400)
 const authorized=await decision(authorizeBody);assert.equal(authorized.status,201);const authorizationId=Number((await authorized.json()).data.id)
 assert.equal((await decision(authorizeBody)).status,409)
 assert.equal((await (await fetch(selfPath,{headers:selfHeaders})).json()).data.status,'AUTHORIZED')
 assert.equal((await employeePaymentReadiness(h.pool,1,Number(employee.id))).status,'TEST_ONLY')
 await h.pool.query("UPDATE payroll_settings SET legal_business_name='Changed Employer' WHERE facility_id=1")
 assert.equal((await (await fetch(selfPath,{headers:selfHeaders})).json()).data.status,'AUTHORIZATION_REQUIRED')
 assert.equal((await employeePaymentReadiness(h.pool,1,Number(employee.id))).status,'TERMS_CHANGED')
 await h.pool.query("UPDATE payroll_settings SET legal_business_name='Synthetic Employer' WHERE facility_id=1")
 await assert.rejects(h.pool.query('DELETE FROM payroll_payment_authorization'),/append-only/)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-09-10' WHERE id=$1",[employee.id])
 assert.equal((await decision({...authorizeBody,expectedRevision:authorizationId})).status,403)
 const key=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY
 const withdrawn=await decision({destinationId:revision,expectedRevision:authorizationId,decision:'WITHDRAW',confirmed:true});assert.equal(withdrawn.status,201)
 process.env.PAYROLL_DOCUMENT_KEY=key
 assert.equal((await (await fetch(selfPath,{headers:selfHeaders})).json()).data.status,'AUTHORIZATION_REQUIRED')
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',termination_date=NULL WHERE id=$1",[employee.id])
 const nextConnection=await connect({...configuration,expectedRevision:connectionId,apiKey:'synthetic-rotated-key'})
 assert.equal((await (await fetch(path,{headers})).json()).data.status,'CONNECTION_CHANGED')
 assert.equal((await save({...body,expectedRevision:revision})).status,409)
 const rebound=await save({...body,connectionId:nextConnection,expectedRevision:revision});assert.equal(rebound.status,201);assert.notEqual((await rebound.json()).data.revision,revision)
 assert.equal((await h.pool.query('SELECT * FROM payroll_payment_destination')).rowCount,2)
 assert.equal((await h.pool.query('SELECT direct_deposit_status FROM payroll_employee WHERE id=$1',[employee.id])).rows[0].direct_deposit_status,'NOT_CONFIGURED')
 const liveConnection=await connect({...configuration,mode:'LIVE',expectedRevision:nextConnection,apiKey:'synthetic-live-mode-key'})
 assert.equal((await employeePaymentReadiness(h.pool,1,Number(employee.id))).status,'CONNECTION_CHANGED')
 provider.live_mode=true
 const latestDestination=Number((await h.pool.query('SELECT id FROM payroll_payment_destination ORDER BY id DESC LIMIT 1')).rows[0].id)
 const liveSaved=await save({...body,connectionId:liveConnection,expectedRevision:latestDestination});assert.equal(liveSaved.status,201)
 const liveDisclosure=(await (await fetch(selfPath,{headers:selfHeaders})).json()).data
 assert.equal((await employeePaymentReadiness(h.pool,1,Number(employee.id))).status,'AUTHORIZATION_REQUIRED')
 const liveAuthorization=await decision({...authorizeBody,destinationId:liveDisclosure.destinationId,expectedRevision:Number(liveDisclosure.history[0].id),fingerprint:liveDisclosure.fingerprint});assert.equal(liveAuthorization.status,201)
 const liveAuthorizationId=Number((await liveAuthorization.json()).data.id)
 assert.equal((await employeePaymentReadiness(h.pool,1,Number(employee.id))).status,'FUNDING_CHECK_REQUIRED')
 await h.pool.query("INSERT INTO payroll_payment_connection_check(connection_id,status,reason,created_by) VALUES($1,'VERIFIED','FUNDING_ACCOUNT_MATCHED',99)",[liveConnection])
 assert.equal((await employeePaymentReadiness(h.pool,1,Number(employee.id))).status,'READY')
 const currentEmployee=(await h.pool.query('SELECT * FROM payroll_employee WHERE id=$1',[employee.id])).rows[0]
 const tasks=[{task_key:'PAYMENT',status:'COMPLETE',response:{method:'DIRECT_DEPOSIT'}}]
 const readySetup=await employeePaySetup(h.pool,1,currentEmployee,tasks);assert.equal(readySetup.paymentReadiness.status,'READY')
 assert.equal((await decision({destinationId:liveDisclosure.destinationId,expectedRevision:liveAuthorizationId,decision:'WITHDRAW',confirmed:true})).status,201)
 const withdrawnSetup=await employeePaySetup(h.pool,1,currentEmployee,tasks);assert.equal(withdrawnSetup.paymentReadiness.status,'AUTHORIZATION_REQUIRED');assert.notEqual(withdrawnSetup.fingerprint,readySetup.fingerprint);assert.ok(withdrawnSetup.issues.includes('The employee must authorize the current direct-deposit account.'))
})
