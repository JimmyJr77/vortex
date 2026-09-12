import {runCheckPayeeRecoverySweep} from '../../backend/payroll/checkPayeeRecoveryScheduler.js'
import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin prepares a check recipient and recovers interrupted provider setup on mobile',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(60000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,records:Record<string,Record<string,unknown>>={};let posts=0
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 let providerFetcher
 const h=await createHarness({paymentFetcher:providerFetcher=async(url:string,options:{method?:string;body?:string}={})=>{
  const collection=new URL(url).pathname.split('/').pop()!
  if(collection===uuid(2))return {ok:true,status:200,json:async()=>({id:uuid(2),currency:'USD',live_mode:false})}
  if(options.method==='POST'){posts++;records[collection]={...JSON.parse(options.body!),id:uuid(collection==='counterparties'?3:4),live_mode:false,...(collection==='external_accounts'?{account_details:[],routing_details:[]}: {})};throw new Error('Synthetic lost response')}
  return {ok:true,status:200,json:async()=>records[collection]?[records[collection]]:[]}
 }})
 try{
  await h.pool.query("INSERT INTO payroll_employee(facility_id,employee_number,legal_first_name,legal_last_name,job_title,hire_date,work_state,residence_state) VALUES(1,'CHECK-1','Check','Person','Coach','2026-01-01','MD','MD')")
  const headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'}
  const post=async(path:string,body:Record<string,unknown>)=>{const response=await fetch(`${h.url}/api/admin/payroll/${path}`,{method:'POST',headers,body:JSON.stringify(body)});expect(response.ok).toBeTruthy();return (await response.json()).data}
  const connection=await post('payment-connection',{organizationId:uuid(1),originatingAccountId:uuid(2),apiKey:'synthetic-check-key',mode:'TEST',reference:'Synthetic browser check connection',expectedRevision:0,confirmed:true})
  await post('payment-connection/verify',{expectedRevision:connection.revision})
  await post('check-configuration',{connectionId:connection.revision,expectedRevision:0,enabled:true,expiryDays:90,activationReference:'Synthetic browser check activation',confirmed:true})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.clock.install();await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  await page.getByRole('button',{name:/CHECK-1/}).click()
  const view=page.getByRole('region',{name:'Employee check recipient',exact:true}),confirm=view.getByLabel('I reviewed this employee’s legal check name and authorize recipient setup.',{exact:true})
  await expect(view.getByLabel('Legal name on check',{exact:true})).toHaveValue('Check Person')
  await view.getByLabel('Check recipient review reference',{exact:true}).fill('Synthetic browser recipient review');await confirm.check()
  await view.getByRole('button',{name:'Save check recipient',exact:true}).click();await expect(view.getByRole('status')).toContainText('Check recipient saved')
  const create=view.getByRole('button',{name:'Create recipient identity',exact:true});await expect(create).toBeDisabled()
  await view.getByLabel('Legal name on check',{exact:true}).fill('Unsaved name');await confirm.check();await expect(create).toBeDisabled()
  await view.getByLabel('Legal name on check',{exact:true}).fill('Check Person');await confirm.check();await create.click()
  await expect(view).toContainText('recipient identity: UNCERTAIN');expect((await runCheckPayeeRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+11*60000)})).checked).toBe(1);await page.clock.fastForward(31000);await expect(view).toContainText('recipient identity: RECORDED')
  await confirm.check();await view.getByRole('button',{name:'Create check payment account',exact:true}).click();await expect(view).toContainText('check payment account: UNCERTAIN')
  expect((await runCheckPayeeRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+12*60000)})).checked).toBe(1);await page.clock.fastForward(31000);await expect(view).toContainText('check payment account: RECORDED')
  await expect(view.getByRole('status')).toContainText('Recipient status updated automatically');await view.screenshot({path:'/tmp/payroll-check-payee-recovery-mobile.png'});expect(await view.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
  expect(posts).toBe(2);expect(errors).toEqual([])
 }finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
