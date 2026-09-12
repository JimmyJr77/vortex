import test from 'node:test'
import assert from 'node:assert/strict'
import nodemailer from 'nodemailer'
import {sendEmail} from '../sendEmail.js'
import {registerEmailPool} from '../emailDeliveryStore.js'
test('SMTP W-2 sends retain provider correlation before transport and stop if logging is unavailable',async()=>{
 const names=['SMTP_HOST','SMTP_USER','SMTP_PASS','SMTP_FROM'],prior=Object.fromEntries(names.map(k=>[k,process.env[k]])),original=nodemailer.createTransport
 let sent=0,claimed=false,mail
 process.env.SMTP_HOST='smtp.sendgrid.net';process.env.SMTP_USER='apikey';process.env.SMTP_PASS='synthetic-key';process.env.SMTP_FROM='payroll@example.test'
 nodemailer.createTransport=()=>({sendMail:async message=>{assert.equal(claimed,true);sent++;mail=message;return {accepted:['employee@example.test'],rejected:[],messageId:'synthetic-message'}}})
 registerEmailPool({query:async(sql,args=[])=>{if(sql.includes('INSERT INTO email_delivery')){assert.equal(args[6],'smtp:sendgrid');claimed=true;return {rows:[{id:31}]}}return {rows:[]}}})
 const input={to:'employee@example.test',subject:'Your W-2 is available',text:'Sign in to the employee portal.',html:'<p>Sign in to the employee portal.</p>',category:'payroll_w2_notice',idempotencyKey:'w2-notice-00000000-0000-4000-8000-000000000001',templateVersion:'w2-notice-2026-v1',facilityId:1,skipPolicy:true}
 try{
  assert.equal((await sendEmail(input)).sent,true);assert.equal(sent,1);assert.deepEqual(JSON.parse(mail.headers['X-SMTPAPI']),{unique_args:{vortex_w2_dispatch:input.idempotencyKey}})
  registerEmailPool(null);await assert.rejects(sendEmail(input),/retain the W-2 provider delivery/);assert.equal(sent,1)
 }finally{registerEmailPool(null);nodemailer.createTransport=original;for(const k of names)if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k]}
})
