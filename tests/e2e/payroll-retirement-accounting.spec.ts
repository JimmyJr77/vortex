import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {encryptDocument} from '../../backend/payroll/onboarding.js'
test('admin maps separate retirement accounts for direct sync and CSV export',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='b'.repeat(64)
 const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'},errors:string[]=[]
 const account={Id:'7',FullyQualifiedName:'Retirement contributions payable',Active:true,AccountType:'Other Current Liability',CurrencyRef:{value:'USD'}}
 const h=await createHarness({quickbooksFetcher:async(url,options)=>{expect(options.method).toBe('GET');return new Response(JSON.stringify(String(url).includes('/account/7')?{Account:account}:{QueryResponse:{Account:[account]}}),{status:200})}})
 page.on('pageerror',e=>errors.push(e.message))
 try{
  await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[accounts,encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic',expiresAt:Date.now()+3600000})),'quickbooks:1')])
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});await route.fulfill({response})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click()
  await page.getByRole('button',{name:'Load chart of accounts',exact:true}).click()
  await expect(page.getByText('Chart of accounts loaded.',{exact:true})).toBeVisible()
  await page.getByRole('combobox',{name:'Retirement contributions payable (required for retirement payroll)',exact:true}).selectOption('7')
  await page.getByRole('checkbox',{name:'The bookkeeper verified these account mappings.',exact:true}).check()
  await page.getByRole('button',{name:'Save sync settings',exact:true}).click()
  await expect(page.getByText('QuickBooks mapping saved.',{exact:true})).toBeVisible()
  expect((await h.pool.query('SELECT account_ids FROM payroll_quickbooks_connection')).rows[0].account_ids.retirement).toBe('7')
  await page.getByLabel('Retirement Liability Account',{exact:true}).fill('Retirement contributions payable')
  await page.getByRole('button',{name:'Confirm bookkeeper verification',exact:true}).click()
  await expect.poll(async()=>(await h.pool.query('SELECT retirement_liability_account FROM payroll_accounting_mapping WHERE facility_id=1')).rows[0].retirement_liability_account).toBe('Retirement contributions payable')
  await page.setViewportSize({width:390,height:1000})
  const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'QuickBooks Online connection',exact:true})})
  await panel.screenshot({path:'/tmp/payroll-retirement-accounting-mobile.png'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
