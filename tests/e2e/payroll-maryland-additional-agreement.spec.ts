import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
test('admin retains, retries, revises and suspends Maryland additional-withholding agreements',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {api,employee}=await monthlyBenefitsFixture(h)
  await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed Maryland employee election',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1,extraWithholdingCents:500}},'PATCH')
  let loseResponse=true
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(loseResponse&&route.request().method()==='POST'&&u.pathname.endsWith('/maryland-additional-agreements')){loseResponse=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost agreement response. Retry the unchanged request.'})});return}await route.fulfill({response})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  const panel=page.getByRole('region',{name:'Maryland additional withholding agreement',exact:true})
  await expect(panel).toContainText('Saved MW507 additional amount: $5.00')
  await panel.getByLabel('Agreement effective date',{exact:true}).fill('2026-09-16')
  await panel.getByRole('textbox',{name:'Signed agreement reference',exact:true}).fill('Synthetic signed employee and employer payment-date agreement')
  const confirm=panel.getByRole('checkbox',{name:/I verified the signed employee and employer instructions/}),save=panel.getByRole('button',{name:'Retain agreement revision',exact:true})
  await confirm.check();await save.click();await expect(panel.getByRole('alert')).toContainText('Synthetic lost agreement response')
  await save.click();await expect(panel.getByRole('status')).toHaveText('Agreement revision 1 retained.')
  expect((await h.pool.query('SELECT count(*)::int n FROM payroll_maryland_additional_agreement')).rows[0].n).toBe(1)
  await page.getByLabel('MW507 additional per pay period ($)',{exact:true}).fill('6')
  await page.getByRole('checkbox',{name:/I verified these values against signed forms/}).check()
  await page.getByRole('button',{name:'Save verified tax elections',exact:true}).click()
  await expect(panel).toContainText('Saved MW507 additional amount: $6.00')
  await expect(panel).toContainText('The saved tax election has changed; review a new agreement.')
  await confirm.check();await save.click();await expect(panel.getByRole('status')).toHaveText('Agreement revision 2 retained.')
  await panel.getByRole('combobox',{name:'Agreement action',exact:true}).selectOption('SUSPENDED')
  await panel.getByRole('textbox',{name:'Signed agreement reference',exact:true}).fill('Synthetic agreed suspension of additional-withholding instructions')
  await confirm.check();await save.click();await expect(panel.getByRole('status')).toHaveText('Agreement revision 3 retained.')
  await panel.getByText('Agreement history',{exact:true}).click();await expect(panel.locator('article')).toHaveCount(3)
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:'/tmp/payroll-maryland-additional-agreement-mobile.png'})
  expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await page.reload();await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click();await expect(panel).toContainText('Revision 3: Suspended')
  expect(errors).toEqual([])
 }catch(error){console.error('Agreement browser errors:',errors);console.error('Agreement browser page:',await page.locator('body').innerText().catch(()=>''));throw error}finally{try{await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}finally{await h.close()}}
})
