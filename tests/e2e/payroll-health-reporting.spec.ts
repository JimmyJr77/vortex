import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin records health reporting relief, corrects it and refreshes after a competing update',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000);page.setDefaultTimeout(15000)
 const h=await createHarness()
 try{
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'));await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click()
 const view=page.getByRole('region',{name:'Annual health-coverage reporting',exact:true});await view.getByRole('button',{name:'Open reporting determination',exact:true}).click();await expect(view).toContainText('No determination recorded.')
 const choice=view.getByRole('combobox',{name:'Reporting determination',exact:true}),count=view.getByLabel('Forms W-2 required for 2025',{exact:true}),reference=view.getByLabel('Reporting evidence reference',{exact:true}),save=view.getByRole('button',{name:'Save reporting determination',exact:true})
 await choice.selectOption('SMALL_EMPLOYER_RELIEF');await count.fill('250');await reference.fill('Synthetic reviewed prior-year filing evidence');await view.getByRole('checkbox').check();await expect(save).toBeDisabled();await count.fill('249');await expect(save).toBeDisabled();await view.getByRole('checkbox').check();await save.click();await expect(view.getByRole('status')).toHaveText('Health-reporting determination saved.');await expect(view).toContainText('CURRENT · Revision');await expect(view).toContainText('2025 W-2 filing count: 249');await expect(count).toHaveValue('')
 await choice.selectOption('REPORT');await reference.fill('Synthetic revised reporting evidence');await view.getByRole('checkbox').check()
 const current=await fetch(`${h.url}/api/admin/payroll/health-coverage-reporting?year=2026`,{headers:{Authorization:'Bearer payroll-test-admin'}});const revision=(await current.json()).data.revision
 const competing=await fetch(`${h.url}/api/admin/payroll/health-coverage-reporting`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({year:2026,disposition:'UNRESOLVED',priorYearW2Count:null,reference:'Synthetic competing determination evidence',confirmed:true,expectedRevision:revision})});expect(competing.status).toBe(201)
 await save.click();await expect(view.getByRole('alert')).toContainText('determination changed');await expect(save).toHaveCount(0);await view.getByRole('button',{name:'Open reporting determination',exact:true}).click();await expect(view).toContainText('Determination unresolved');await expect(view).toContainText('SUPERSEDED')
 await choice.selectOption('REPORT');await reference.fill('Synthetic final reviewed reporting evidence');await view.getByRole('checkbox').check();await save.click();await expect(view.getByRole('status')).toHaveText('Health-reporting determination saved.');await expect(view).toContainText('Report applicable coverage costs');await page.setViewportSize({width:390,height:1800});await view.screenshot({path:'/tmp/payroll-health-reporting-mobile.png'})
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
