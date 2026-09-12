import test from 'node:test'
import assert from 'node:assert/strict'
import nodemailer from 'nodemailer'
import {registerEmailPool} from '../emailDeliveryStore.js'
for(const host of ['smtp.example.test','smtp.sendgrid.net'])test(`carrier SMTP sender requires a retained delivery row before transport: ${host}`,async()=>{
 const {sendEmail}=await import(`../sendEmail.js?carrier-test=${host}`)
 const names=['SMTP_HOST','SMTP_USER','SMTP_PASS','SMTP_FROM'],prior=Object.fromEntries(names.map(k=>[k,process.env[k]])),original=nodemailer.createTransport;let sent=0,logged=false
 process.env.SMTP_HOST=host;process.env.SMTP_USER='synthetic';process.env.SMTP_PASS='synthetic-key';process.env.SMTP_FROM='payroll@example.test'
 nodemailer.createTransport=()=>({sendMail:async mail=>{assert.equal(logged,true);assert.equal(mail.to,'carrier@example.test');if(host==='smtp.sendgrid.net')assert.deepEqual(JSON.parse(mail.headers['X-SMTPAPI']),{unique_args:{vortex_carrier_dispatch:input.idempotencyKey}});sent++;return {accepted:['carrier@example.test'],rejected:[],messageId:'synthetic'}}})
 const input={to:'carrier@example.test',subject:'Carrier remittance advice',text:'Reviewed payment details.',html:'<p>Reviewed payment details.</p>',category:'payroll_carrier_remittance',templateVersion:'carrier-remittance-v1',idempotencyKey:'carrier-remittance-00000000-0000-4000-8000-000000000001',facilityId:1,skipPolicy:true}
 try{registerEmailPool(null);assert.deepEqual(await sendEmail(input),{sent:false,skipped:true,reason:'delivery_log_unavailable'});assert.equal(sent,0);registerEmailPool({query:async (sql,values)=>{if(sql.includes('INSERT INTO email_delivery')){if(host==='smtp.sendgrid.net')assert.equal(values[6],'smtp:sendgrid');logged=true;return {rows:[{id:31}]}}return {rows:[]}}});assert.equal((await sendEmail(input)).sent,true);assert.equal(sent,1)}finally{registerEmailPool(null);nodemailer.createTransport=original;for(const k of names)if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k]}
})
