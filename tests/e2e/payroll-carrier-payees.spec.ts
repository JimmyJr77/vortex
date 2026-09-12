import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('admin reviews, retains and rechecks a carrier payment destination internally',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='19'.repeat(32)
 let changed=false,creates=0
 const h=await createHarness({paymentFetcher:async(url:string,options:{method?:string})=>{if(options.method==='POST')creates++;return {ok:true,status:200,json:async()=>url.includes('/internal_accounts/')?{id:id(2),currency:'USD',live_mode:false}:{id:id(3),counterparty_id:id(4),party_type:'business',party_name:'Synthetic Benefits LLC',account_type:'checking',live_mode:false,verification_status:'verified',updated_at:changed?'2026-09-11T12:01:00Z':'2026-09-11T12:00:00Z',account_details:[{id:id(5),account_number_safe:'1234'}],routing_details:[{id:id(6),payment_type:'ach',routing_number_type:'aba',routing_number:'021000021'}]}}}})
 try{
  const setup=await fetch(`${h.url}/api/admin/payroll/payment-connection`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({organizationId:id(1),originatingAccountId:id(2),apiKey:'synthetic-private-key',mode:'TEST',reference:'Reviewed employer funding account',expectedRevision:0,confirmed:true})});expect(setup.status).toBe(201)
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.setViewportSize({width:390,height:1000});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click()
  const panel=page.getByRole('region',{name:'Carrier payment destinations',exact:true})
  await panel.getByLabel('Payee carrier name',{exact:true}).fill('Synthetic Health');await panel.getByRole('button',{name:'Load carrier destinations',exact:true}).click();await expect(panel).toContainText('No carrier destination has been retained.')
  await panel.getByLabel('Carrier business account ID',{exact:true}).fill(id(3));await panel.getByRole('button',{name:'Review carrier destination',exact:true}).click();await expect(panel).toContainText('Synthetic Benefits LLC · checking ending 1234 · Test')
  await panel.getByLabel('Carrier payment instruction reference',{exact:true}).fill('Independently verified carrier payment instruction document')
  const save=panel.getByRole('button',{name:'Save carrier destination',exact:true});await expect(save).toBeDisabled();await panel.getByRole('checkbox',{name:/I independently verified/}).check();await save.click();await expect(panel.getByRole('status')).toContainText('Carrier destination review retained. No payment was sent.')
  await expect(panel).toContainText('Revision 1 · Current');expect((await h.pool.query('SELECT * FROM payroll_carrier_payee')).rowCount).toBe(1)
  changed=true;await panel.getByRole('button',{name:'Recheck carrier destination',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Account or funding details changed')
  await panel.getByLabel('Carrier business account ID',{exact:true}).fill(id(3));await panel.getByRole('button',{name:'Review carrier destination',exact:true}).click();await panel.getByLabel('Carrier payment instruction reference',{exact:true}).fill('Independently reviewed updated carrier account record');await panel.getByRole('checkbox',{name:/I independently verified/}).check();await save.click();await expect(panel).toContainText('Revision 2 · Current');await expect(panel).toContainText('Revision 1 · Superseded')
  await page.reload();await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click();await panel.getByLabel('Payee carrier name',{exact:true}).fill('Synthetic Health');await panel.getByRole('button',{name:'Load carrier destinations',exact:true}).click();await expect(panel).toContainText('Revision 2 · Current');await panel.screenshot({path:'/tmp/payroll-carrier-payee-mobile.png'})
  expect((await h.pool.query('SELECT * FROM payroll_carrier_payee')).rowCount).toBe(2);expect(creates).toBe(0);expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'wait'}).catch(()=>{});await page.close().catch(()=>{});await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
