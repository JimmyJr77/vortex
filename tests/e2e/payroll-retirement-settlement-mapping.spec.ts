import {randomUUID} from 'node:crypto'
import {retirementPlanFixture} from '../../backend/payroll/testing/retirementPlanFixture.js'
import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {encryptDocument} from '../../backend/payroll/onboarding.js'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('admin retains retirement bank mappings with historical funding and changed evidence',async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(15000)
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='39'.repeat(32);let bad=false,creates=0,lost=true
 const accounts=[{Id:'7',Name:'Employer Bank',Active:true,AccountType:'Bank'},{Id:'8',Name:'Retirement Contributions Payable',Active:true,AccountType:'Other Current Liability'},{Id:'9',Name:'Other Expense',Active:true,AccountType:'Expense'}]
 const h=await createHarness({quickbooksFetcher:async(url:string,options:{method?:string})=>{if(options.method!=='GET')creates++;return {ok:true,json:async()=>url.includes('/query?')?{QueryResponse:{Account:accounts}}:url.endsWith('/preferences')?{Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}}}}:{Account:{...accounts.find(a=>url.endsWith(`/${a.Id}`)),Active:!bad}}}}})
 try{
  const plan=await fetch(`${h.url}/api/admin/payroll/retirement-plans`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({plan:retirementPlanFixture(),expectedRevision:0,requestKey:randomUUID()})});expect(plan.ok).toBe(true)

  await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,encrypted_tokens,environment,account_ids) VALUES(1,'123',$1,'sandbox','{}')",[encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic-token',refresh_token:'synthetic-refresh',expiresAt:Date.now()+3600000})),'quickbooks:1')])
  const config={organizationId:id(1),originatingAccountId:id(2),apiKey:'synthetic-funding-key',mode:'TEST',reference:'Reviewed funding bank record',expectedRevision:0,confirmed:true}
  const setup=async(body:object)=>{const r=await fetch(`${h.url}/api/admin/payroll/payment-connection`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});expect(r.status).toBe(201);return (await r.json()).data.revision}
  const first=await setup(config);await setup({...config,expectedRevision:first,originatingAccountId:id(3)})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());const r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname.endsWith('/settlement-mapping')&&route.request().method()==='POST'&&r.ok()&&lost){lost=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost mapping response'}})}else await route.fulfill({response:r})})
  await page.setViewportSize({width:390,height:1100});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const panel=page.getByRole('region',{name:'Retirement settlement accounts standard',exact:true}),load=panel.getByRole('button',{name:'Review retirement settlement accounts',exact:true}),save=panel.getByRole('button',{name:'Verify and retain retirement mapping',exact:true})
  await load.click();await expect(panel).toContainText('No retirement settlement mapping has been retained.')
  await panel.getByLabel('Retirement settlement funding',{exact:true}).selectOption(String(first));await panel.getByLabel('Retirement settlement bank',{exact:true}).selectOption('7');await panel.getByLabel('Retirement settlement liability',{exact:true}).selectOption('8')
  await expect(panel.getByLabel('Retirement settlement bank',{exact:true}).getByRole('option',{name:'Other Expense'})).toHaveCount(0)
  await panel.getByLabel('Retirement settlement review reference',{exact:true}).fill('Reviewed historical bank and retirement liability records');await expect(save).toBeDisabled();await panel.getByRole('checkbox').check()
  bad=true;await save.click();await expect(panel.getByRole('alert')).toContainText('active USD');bad=false;await load.click();await panel.getByRole('checkbox').check();await save.click();await expect(panel.getByRole('alert')).toContainText('Synthetic lost mapping response');await panel.getByRole('button',{name:'Retry original retirement mapping',exact:true}).click();await expect(panel.getByRole('status')).toContainText('mapping verified and retained')
  expect((await h.pool.query('SELECT * FROM payroll_retirement_settlement_mapping')).rowCount).toBe(1)
  await page.reload();await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click();await load.click();await expect(panel).toContainText('Employer Bank → Retirement Contributions Payable');await expect(panel).toContainText(`Funding revision ${first}`)
  await h.pool.query('UPDATE payroll_settings SET quickbooks_connection_generation=quickbooks_connection_generation+1 WHERE facility_id=1');await load.click();await expect(panel).toContainText('Company changed — review again')
  await panel.screenshot({path:'/tmp/payroll-retirement-settlement-mapping-mobile.png'});expect(creates).toBe(0);expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'ignoreErrors'}).catch(()=>{});await page.close().catch(()=>{});await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
