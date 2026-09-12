import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementReceiptContractFixture} from '../../backend/payroll/testing/retirementReceiptContractFixture.js'
import {allocationFormatFixture} from '../../backend/payroll/testing/retirementAllocationFixture.js'
test('admin retains receipt definitions after a lost save, preserves drafts on source change and suspends interpretation',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let lost=true
 try{
  const f=await retirementReceiptContractFixture(h)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname.endsWith('/receipt-contract')&&route.request().method()==='POST'&&r.ok()&&lost){lost=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost receipt contract response'}})}else await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const panel=page.getByRole('region',{name:'Retirement receipt contract standard',exact:true});await panel.getByRole('button',{name:'Load receipt contract history',exact:true}).click();await expect(panel).toContainText('Receipt contract: REVIEW REQUIRED')
  const headers=panel.getByRole('textbox',{name:/^Receipt header:/});await expect(headers).toHaveCount(13)
  for(let i=0;i<f.body.contract.columns.length;i++)await headers.nth(i).fill(f.body.contract.columns[i].header)
  await panel.getByRole('button',{name:'Move receipt sourceSha256 earlier',exact:true}).click()
  await panel.getByRole('combobox',{name:'Receipt amount representation',exact:true}).selectOption('CENTS');await panel.getByRole('combobox',{name:'Receipt withholding date representation',exact:true}).selectOption('ISO')
  for(const [status,value] of Object.entries(f.body.contract.statusValues))await panel.getByRole('textbox',{name:`Provider value for ${status}`,exact:true}).fill(value)
  await panel.getByRole('textbox',{name:'Receipt specification review reference',exact:true}).fill(f.body.contract.reference)
  await panel.getByRole('checkbox',{name:'I verified that the receipt filename and SHA-256 identify the exact original allocation bytes.',exact:true}).check();await panel.getByRole('checkbox',{name:'I verified these amounts are cumulative participant contributions, with separate ordinary and catch-up categories.',exact:true}).check();await panel.getByRole('checkbox',{name:'I verified POSTED means actual participant credit and ACCEPTED means file acceptance only.',exact:true}).check();await panel.getByRole('checkbox',{name:'I confirm this receipt contract action and reviewed specification.',exact:true}).check()
  await panel.getByRole('button',{name:'Save reviewed receipt contract',exact:true}).click();await expect(panel).toContainText('Synthetic lost receipt contract response');await panel.getByRole('button',{name:'Retry original receipt contract action',exact:true}).click();await expect(panel).toContainText('Receipt contract: CURRENT · revision 1')
  const saved=await f.api(f.path);expect(saved.history).toHaveLength(1);expect(saved.history[0].contract.columns[0].field).toBe('sourceSha256')
  await panel.getByText(/Receipt revision 1 · REVIEWED/).click();await panel.getByRole('button',{name:'Edit from receipt revision 1',exact:true}).click()
  const reference=panel.getByRole('textbox',{name:'Receipt specification review reference',exact:true});await reference.fill('Retained draft review after a provider allocation format change')
  await f.api(f.formatPath,{planRevisionId:f.body.planRevisionId,expectedRevision:1,requestKey:randomUUID(),format:{...allocationFormatFixture(),dateFormat:'US'}})
  await panel.getByRole('button',{name:'Load receipt contract history',exact:true}).click();await expect(panel).toContainText('Receipt contract: SOURCE CHANGED');await expect(reference).toHaveValue('Retained draft review after a provider allocation format change');await expect(panel.getByRole('checkbox',{name:'I confirm this receipt contract action and reviewed specification.',exact:true})).not.toBeChecked()
  await panel.getByRole('combobox',{name:'Receipt contract action',exact:true}).selectOption('SUSPEND');await reference.fill('Suspend interpretation while the current provider receipt specification is reviewed')
  await panel.getByRole('checkbox',{name:'I confirm this receipt contract action and reviewed specification.',exact:true}).check();await panel.getByRole('button',{name:'Suspend receipt contract',exact:true}).click();await expect(panel).toContainText('Receipt contract: SUSPENDED · revision 2')
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:'/tmp/payroll-retirement-receipt-contract-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close()}}
})
