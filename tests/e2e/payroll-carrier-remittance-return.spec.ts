import {test,expect} from '@playwright/test'
import {generateKeyPairSync,sign} from 'node:crypto'
import {carrierRemittanceFixture} from '../../backend/payroll/testing/carrierRemittanceFixture.js'
import {runCarrierRemittanceSweep} from '../../backend/payroll/carrierRemittanceAutomation.js'
import {hashEmail} from '../../backend/email/emailDeliveryStore.js'

test('signed HTTP carrier return automatically appears and prevents another delivery',async({page})=>{
 test.setTimeout(90000);test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const prior=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='31'.repeat(32)
 const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=keys.publicKey.export({type:'spki',format:'pem'})
 let now=new Date('2026-09-17T12:00:02Z'),sends=0,mail:{to:string;idempotencyKey:string}|null=null
 const sender=async(input:{to:string;idempotencyKey:string})=>{sends++;mail=input;return {sent:true,messageId:'synthetic-accepted'}}
 const f=await carrierRemittanceFixture({sender,providerIntake:{publicKey:()=>publicKey,now:()=>now}}),{h}=f
 try{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await runCarrierRemittanceSweep(h.pool,{facility:1,now:f.now(),sender})
  const attempt=(await h.pool.query('SELECT * FROM payroll_carrier_remittance_attempt')).rows[0];now=new Date(+new Date(attempt.created_at)+2000)
  await h.pool.query('CREATE TABLE email_delivery(id BIGINT PRIMARY KEY,facility_id BIGINT,recipient_hash TEXT,category TEXT,stream TEXT,template_version TEXT,status TEXT,idempotency_key TEXT,provider TEXT,created_at TIMESTAMPTZ,accepted_at TIMESTAMPTZ,bounced_at TIMESTAMPTZ,complained_at TIMESTAMPTZ,updated_at TIMESTAMPTZ)')
  await h.pool.query("INSERT INTO email_delivery VALUES(1,1,$1,'payroll_carrier_remittance','transactional','carrier-remittance-v1','accepted',$2,'smtp:sendgrid',$3,$3,NULL,NULL,$3)",[hashEmail(mail!.to),mail!.idempotencyKey,attempt.created_at])
  await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click()
  const invoices=page.getByRole('region',{name:'Carrier invoice reconciliation',exact:true});await invoices.getByLabel('Carrier coverage month',{exact:true}).fill('2026-09');await invoices.getByRole('button',{name:'Load carrier invoices',exact:true}).click();await invoices.getByText('Prepare carrier payment',{exact:true}).click();await invoices.getByText('Remittance delivery authorization',{exact:true}).click()
  const panel=invoices.getByRole('region',{name:'Carrier remittance delivery review',exact:true});await panel.getByRole('button',{name:'Load remittance delivery history',exact:true}).click();await expect(panel).toContainText('Notice accepted by email provider')
  const timestamp=String(Math.floor(+now/1000)),raw=JSON.stringify([{event:'bounce',email:mail!.to,sg_event_id:'synthetic-browser-bounce',timestamp:Number(timestamp),vortex_carrier_dispatch:mail!.idempotencyKey}])
  const signature=sign('sha256',Buffer.concat([Buffer.from(timestamp),Buffer.from(raw)]),keys.privateKey).toString('base64'),headers={'Content-Type':'application/json','X-Twilio-Email-Event-Webhook-Timestamp':timestamp,'X-Twilio-Email-Event-Webhook-Signature':signature}
  expect((await fetch(`${h.url}/api/payroll/providers/sendgrid/events`,{method:'POST',headers,body:raw+' '})).status).toBe(401)
  const response=await fetch(`${h.url}/api/payroll/providers/sendgrid/events`,{method:'POST',headers,body:raw});expect(response.status).toBe(202);expect((await response.json()).data).toEqual({accepted:1,ignored:0})
  await page.clock.fastForward(30001);await expect(panel).toContainText('Notice delivery needs review — provider return');await expect(panel).toContainText('Delivery bounce');await expect(panel).toContainText('synthetic-browser-bounce')
  await panel.getByRole('button',{name:'Process or recover remittance',exact:true}).click();await expect(panel.getByRole('status')).toContainText('RETURNED');expect(sends).toBe(1)
  expect((await runCarrierRemittanceSweep(h.pool,{facility:1,now,sender})).checked).toBe(1)
  expect((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-remittance-${f.notice.id}`])).rows[0].status).toBe('OPEN')
  await panel.locator('article').first().screenshot({path:'/tmp/payroll-carrier-remittance-return-mobile.png'});expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'wait'}).catch(()=>{});await page.close().catch(()=>{});await h.close();if(prior===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=prior}
})
