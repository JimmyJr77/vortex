import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {retirementSftpSetupFixture} from '../testing/retirementSftpSetupFixture.js'
import {verifyRetirementSftpConnection} from '../retirementSftpTransport.js'
import {readRetirementSftpConfiguration,registerRetirementSftpSetup} from '../retirementSftpSetup.js'
import {allocationFormatFixture} from '../testing/retirementAllocationFixture.js'
test('retained SFTP setup encrypts credentials, checks a real server, retries exactly and suspends without the vault',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),h=await createHarness({retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options)})
 try{
  const {api,path,body}=await retirementSftpSetupFixture(h,server.config)
  await api(path,{...body,noAutomaticDebit:false},400)
  const [a,b]=await Promise.all([api(path,body),api(path,body)]);assert.equal(a.id,b.id)
  await api(path,{...body,configuration:{...body.configuration,username:'changed'}},409)
  const history=await api(path);assert.equal(history.status,'CHECK_REQUIRED');assert.equal(history.history.length,1);assert.ok(!JSON.stringify(history).includes(server.config.privateKey));assert.ok(!JSON.stringify(history).includes('"username"'))
  assert.equal((await readRetirementSftpConfiguration(h.pool,1,a.id)).configuration.privateKey,server.config.privateKey)
  assert.equal((await api(`${path}/${a.id}/check`,{})).status,'VERIFIED');assert.equal((await api(path)).status,'VERIFIED');assert.equal(server.files.size,0)
  await api(path,undefined,404,2);await api(`${path}/${a.id}/check`,{},404,2)
  const anonymous=await fetch(`${h.url}/api/admin/payroll${path}`);assert.equal(anonymous.status,401)
  const audit=(await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action LIKE 'RETIREMENT_SFTP%'")).rows;assert.ok(!JSON.stringify(audit).includes(server.config.privateKey));assert.ok(!JSON.stringify(audit).includes('username'))
  await assert.rejects(h.pool.query('UPDATE payroll_retirement_sftp_configuration SET reference=$1 WHERE id=$2',['changed',a.id]),/immutable|append-only/i)
  const encrypted=(await h.pool.query('SELECT encrypted_configuration FROM payroll_retirement_sftp_configuration WHERE id=$1',[a.id])).rows[0].encrypted_configuration;assert.ok(!encrypted.includes(Buffer.from(server.config.privateKey)))
  delete process.env.PAYROLL_DOCUMENT_KEY
  assert.equal((await api(`${path}/${a.id}/check`,{})).status,'UNAVAILABLE')
  const stop={action:'SUSPEND',expectedRevision:1,requestKey:randomUUID(),reference:'Suspend delivery while independently reviewing changed provider instructions',confirmed:true}
  const [s1,s2]=await Promise.all([api(path,stop),api(path,stop)]);assert.equal(s1.id,s2.id);assert.equal((await api(path)).status,'SUSPENDED');await api(`${path}/${a.id}/check`,{},409);assert.equal(server.state.writes,0)
 }finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
test('configuration changes during a connection check invalidate its result without blocking suspension',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');const server=await createRetirementSftpServer();let release,entered
 const enteredPromise=new Promise(r=>{entered=r}),h=await createHarness({retirementSftpVerifier:async()=>{entered();await new Promise(r=>{release=r});return {status:'VERIFIED'}}})
 try{
  const {api,path,body,formatPath}=await retirementSftpSetupFixture(h,server.config),a=await api(path,body),checking=api(`${path}/${a.id}/check`,{})
  await enteredPromise
  await api(formatPath,{planRevisionId:body.planRevisionId,expectedRevision:1,requestKey:randomUUID(),format:{...allocationFormatFixture(),amountFormat:'CENTS'}})
  release();assert.equal((await checking).status,'CONFIGURATION_CHANGED');assert.equal((await api(path)).status,'CONFIGURATION_CHANGED')
  await api(path,{action:'SUSPEND',expectedRevision:1,requestKey:randomUUID(),reference:'Suspend old setup after current allocation specification changed',confirmed:true});assert.equal((await api(path)).status,'SUSPENDED')
 }finally{release?.();await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})

test('setup and connection-check endpoints return a controlled error when a database connection is unavailable',async()=>{
 const handlers=[];registerRetirementSftpSetup({get:()=>{},post:(_path,handler)=>handlers.push(handler)},{connect:async()=>{throw new Error('Synthetic database unavailable')}})
 for(const handler of handlers){let status,payload;const res={setHeader:()=>{},status(value){status=value;return this},json(value){payload=value}};await handler({},res);assert.equal(status,500);assert.equal(payload.success,false);assert.ok(!payload.message.includes('Synthetic'))}
})
