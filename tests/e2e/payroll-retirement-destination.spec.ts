import {test,expect} from '@playwright/test'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementPlanFixture} from '../../backend/payroll/testing/retirementPlanFixture.js'
import {id,retirementDestinationProvider} from '../../backend/payroll/testing/retirementDestinationProvider.js'
test('admin previews and saves retirement destination, retries lost response and rechecks changes',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const previousKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const api=async(path:string,body:unknown,expected=200)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});expect(r.status).toBe(expected);return (await r.json()).data}
  await api('/retirement-plans',{plan:retirementPlanFixture(),expectedRevision:0,requestKey:randomUUID()})
  await api('/payment-connection',{organizationId:id(1),originatingAccountId:id(2),apiKey:'synthetic-browser-retirement-key',mode:'TEST',reference:'Reviewed synthetic funding account',expectedRevision:0,confirmed:true},201)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let loseSave=true
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(loseSave&&route.request().method()==='POST'&&u.pathname.endsWith('/standard/destination')&&r.ok()){loseSave=false;provider.unavailable(true);await route.fulfill({status:503,json:{success:false,message:'Synthetic lost save response'}});return}await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const panel=page.getByRole('region',{name:'Retirement remittance destination standard',exact:true})
  await panel.getByLabel('Provider business account identifier',{exact:true}).fill(id(3));await panel.getByRole('button',{name:'Preview retirement destination',exact:true}).click();await expect(panel).toContainText('Synthetic Retirement Trustee · checking ending 1234 · TEST')
  await panel.getByLabel('Trustee payment-instruction reference',{exact:true}).fill('Reviewed trustee-issued payment instructions for this exact retirement plan');await panel.getByRole('checkbox',{name:/I independently verified/}).check();await panel.getByRole('button',{name:'Save retirement destination review',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('Synthetic lost save response')
  await panel.getByRole('button',{name:'Retry original destination review',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Retirement destination review saved')
  expect((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_destination')).rows[0].n).toBe(1)
  provider.unavailable(false);provider.change(true);await panel.getByRole('button',{name:'Recheck retirement destination',exact:true}).click();await expect(panel).toContainText('Last account check: CHANGED')
  provider.change(false);await panel.getByRole('button',{name:'Recheck retirement destination',exact:true}).click();await expect(panel).toContainText('Last account check: VERIFIED')
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:'/tmp/payroll-retirement-destination-mobile.png'})
  await api('/retirement-plans',{plan:{...retirementPlanFixture(),name:'Changed synthetic retirement plan'},expectedRevision:1,requestKey:randomUUID()})
  await panel.getByRole('button',{name:'Recheck retirement destination',exact:true}).click();await expect(panel).toContainText('Plan changed — review destination again')
  expect(provider.posts()).toBe(0);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();if(previousKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previousKey}}
})
