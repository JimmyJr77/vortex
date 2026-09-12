import {test,expect} from '@playwright/test'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {encryptDocument} from '../../backend/payroll/onboarding.js'
test('admin verifies named settlement accounts and sees stale mappings on mobile',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(60000);page.setDefaultTimeout(10000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const bank={Id:'7',Name:'Payroll Bank',FullyQualifiedName:'Payroll Bank',Active:true,AccountType:'Bank',CurrencyRef:{value:'USD'}},clearing={Id:'6',Name:'Payroll Clearing',FullyQualifiedName:'Payroll Clearing',Active:true,AccountType:'Other Current Liability'},expense={Id:'8',Name:'Supplies',FullyQualifiedName:'Supplies',Active:true,AccountType:'Expense'}
 let posts=0
 const h=await createHarness({quickbooksFetcher:async(url:string,options:{method:string})=>{if(options.method==='POST')posts++;expect(options.method).toBe('GET');return {ok:true,json:async()=>url.includes('/query?')?{QueryResponse:{Account:[bank,clearing,expense]}}:url.endsWith('/preferences')?{Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}}}}:{Account:url.endsWith('/7')?bank:url.endsWith('/6')?clearing:expense}}}})
 try{
  await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,encrypted_tokens,environment,account_ids) VALUES(1,'123',$1,'sandbox',$2)",[encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic-browser-mapping',refresh_token:'synthetic-refresh',expiresAt:Date.now()+3600000})),'quickbooks:1'),{clearing:'6'}])
  const payment=await fetch(`${h.url}/api/admin/payroll/payment-connection`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({organizationId:randomUUID(),originatingAccountId:randomUUID(),apiKey:'synthetic-browser-funding',mode:'LIVE',reference:'Synthetic verified funding account',confirmed:true,expectedRevision:0})});expect(payment.status).toBe(201)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'));await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:390,height:1100});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click()
  await page.getByRole('button',{name:'Load chart of accounts',exact:true}).click();await expect(page.getByText('Chart of accounts loaded.',{exact:true})).toBeVisible()
  const view=page.getByRole('region',{name:'Bank settlement mapping',exact:true});await view.getByRole('button',{name:'Review settlement mapping',exact:true}).click()
  await view.getByRole('combobox',{name:'Settlement bank account',exact:true}).selectOption('8');await view.getByLabel('Settlement mapping review reference',{exact:true}).fill('Synthetic bookkeeper bank reconciliation review');await view.getByLabel(/I verified that this bank account represents/).check();await view.getByRole('button',{name:'Verify and save settlement mapping',exact:true}).click();await expect(view.getByRole('alert')).toContainText('active USD bank')
  expect((await h.pool.query('SELECT * FROM payroll_payment_accounting_mapping')).rowCount).toBe(0)
  await view.getByRole('button',{name:'Review settlement mapping',exact:true}).click();await view.getByRole('combobox',{name:'Settlement bank account',exact:true}).selectOption('7');await view.getByLabel(/I verified that this bank account represents/).check();await view.getByRole('button',{name:'Verify and save settlement mapping',exact:true}).click();await expect(view.getByRole('status')).toContainText('verified and retained');await expect(view).toContainText('CURRENT');await expect(view).toContainText('Payroll Bank → Payroll Clearing')
  await view.screenshot({path:'/tmp/payroll-settlement-mapping-mobile.png'})
  await page.reload();await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click();await view.getByRole('button',{name:'Review settlement mapping',exact:true}).click();await expect(view).toContainText('CURRENT')
  await h.pool.query("UPDATE payroll_quickbooks_connection SET account_ids='{\"clearing\":\"9\"}' WHERE facility_id=1");await view.getByRole('button',{name:'Review settlement mapping',exact:true}).click();await expect(view).toContainText('CHANGED')
  expect(posts).toBe(0);expect(errors).toEqual([]);expect((await h.pool.query('SELECT * FROM payroll_payment_accounting_mapping')).rowCount).toBe(1);expect((await h.pool.query('SELECT * FROM payroll_quickbooks_sync')).rowCount).toBe(0)
 }finally{await page.unrouteAll({behavior:'wait'}).catch(()=>{});await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
