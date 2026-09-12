import {generateKeyPairSync} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {payrollServiceReadiness} from '../serviceReadiness.js'
test('service readiness reports configuration without credentials or external checks',()=>{
 const keys=['PAYROLL_SENDGRID_WEBHOOK_PUBLIC_KEY','PAYROLL_W2_PROVIDER_INTAKE_ENABLED','EMAIL_KILL_SWITCH_PAYROLL_W2_NOTICE','PAYROLL_DOCUMENT_KEY','SMTP_USER','SMTP_PASS','SMTP_FROM','SMTP_HOST','SMTP_PORT','PUBLIC_APP_URL','NODE_ENV','PAYROLL_COMPLIANCE_SCHEDULER_ENABLED','PAYROLL_PAYMENT_RECOVERY_ENABLED','PAYROLL_SETTLEMENT_RECOVERY_ENABLED','PAYROLL_BANK_ENROLLMENT_RECOVERY_ENABLED','PAYROLL_PAYMENT_SUBMISSION_ENABLED','EMAIL_KILL_SWITCH_PAYROLL_EMPLOYEE_INVITATION']
 const original=Object.fromEntries(keys.map(key=>[key,process.env[key]]))
 try{
  for(const key of keys)delete process.env[key]
  const state=()=>Object.fromEntries(payrollServiceReadiness().checks.map(check=>[check.key,check.configured]))
  assert.deepEqual(state(),{'w2-email':false,'w2-signed-returns':false,'w2-return-worker':true,uploads:false,email:false,portal:true,scheduler:true,'payment-recovery':true,'payment-submission':true,'settlement-recovery':true,'bank-enrollment-recovery':true})
  Object.assign(process.env,{PAYROLL_DOCUMENT_KEY:'a'.repeat(64),SMTP_USER:'synthetic-user',SMTP_PASS:'synthetic-secret',SMTP_FROM:'sender@example.test',SMTP_HOST:'smtp.example.test',SMTP_PORT:'587'})
  assert.deepEqual(state(),{'w2-email':true,'w2-signed-returns':false,'w2-return-worker':true,uploads:true,email:true,portal:true,scheduler:true,'payment-recovery':true,'payment-submission':true,'settlement-recovery':true,'bank-enrollment-recovery':true})
  const serialized=JSON.stringify(payrollServiceReadiness());for(const secret of ['a'.repeat(64),'synthetic-secret','synthetic-user','sender@example.test','smtp.example.test'])assert.ok(!serialized.includes(secret))
  const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'});process.env.PAYROLL_SENDGRID_WEBHOOK_PUBLIC_KEY=pair.publicKey.export({type:'spki',format:'der'}).toString('base64')
  assert.equal(state()['w2-signed-returns'],false);process.env.SMTP_HOST='smtp.sendgrid.net';assert.equal(state()['w2-signed-returns'],true)
  assert.ok(!JSON.stringify(payrollServiceReadiness()).includes(process.env.PAYROLL_SENDGRID_WEBHOOK_PUBLIC_KEY))
  process.env.PAYROLL_SENDGRID_WEBHOOK_PUBLIC_KEY='invalid';assert.equal(state()['w2-signed-returns'],false)
  process.env.EMAIL_KILL_SWITCH_PAYROLL_W2_NOTICE='true';assert.equal(state()['w2-email'],false);assert.equal(state().email,true)
  process.env.PAYROLL_W2_PROVIDER_INTAKE_ENABLED='false';assert.equal(state()['w2-return-worker'],false)
  process.env.EMAIL_KILL_SWITCH_PAYROLL_EMPLOYEE_INVITATION='true';assert.equal(state().email,false)
  delete process.env.EMAIL_KILL_SWITCH_PAYROLL_EMPLOYEE_INVITATION;process.env.SMTP_PORT='0';assert.equal(state().email,false)
  process.env.PUBLIC_APP_URL='http://insecure.example.test';assert.equal(state().portal,false)
  process.env.PUBLIC_APP_URL='https://user:secret@example.test';assert.equal(state().portal,false)
  process.env.PAYROLL_DOCUMENT_KEY='invalid';assert.equal(state().uploads,false)
  process.env.PAYROLL_PAYMENT_SUBMISSION_ENABLED='false';assert.equal(state()['payment-submission'],false)
  process.env.PAYROLL_BANK_ENROLLMENT_RECOVERY_ENABLED='false';assert.equal(state()['bank-enrollment-recovery'],false)
  process.env.PAYROLL_SETTLEMENT_RECOVERY_ENABLED='false';assert.equal(state()['settlement-recovery'],false)
  process.env.PAYROLL_PAYMENT_RECOVERY_ENABLED='false';assert.equal(state()['payment-recovery'],false)
  process.env.PAYROLL_COMPLIANCE_SCHEDULER_ENABLED='false';assert.equal(state().scheduler,false)
  delete process.env.PAYROLL_COMPLIANCE_SCHEDULER_ENABLED;process.env.NODE_ENV='test';assert.equal(state().scheduler,false)
 }finally{for(const key of keys)if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key]}
})
