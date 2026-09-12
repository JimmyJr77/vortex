import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {regularRetirementFixture} from '../../backend/payroll/testing/regularRetirementFixture.js'
test('admin reconciles finalized retirement deductions and sees changed evidence automatically',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const h=await createHarness({databaseNow:'2026-09-11T12:00:00.000Z',retirementNow:()=>new Date('2026-09-11T12:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {api,periods}=await regularRetirementFixture(h)
  const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-RETIREMENT-REMITTANCE-SOURCE'})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let unavailable=false
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());if(unavailable&&u.pathname.endsWith('/retirement-remittance-sources')){await route.fulfill({status:503,json:{success:false,message:'Synthetic source temporarily unavailable'}});return}await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const panel=page.getByRole('region',{name:'Retirement contribution reconciliation',exact:true}),source=panel.getByRole('article',{name:`Retirement contributions for payroll ${run.id}`,exact:true})
  await expect(source).toContainText('Withheld: $14.00 · Delivery unverified');await expect(source).toContainText('Synthetic Retirement Plan');await expect(source).toContainText('$10.00');await expect(source).toContainText('$4.00')
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:'/tmp/payroll-retirement-remittance-sources-mobile.png'})
  await h.pool.query('UPDATE payroll_run_employee SET pretax_deduction_cents=pretax_deduction_cents+1 WHERE payroll_run_id=$1',[run.id])
  await expect(source).toContainText('Reconciliation required:',{timeout:40000});await expect(source).not.toContainText('Withheld: $14.00')
  await h.pool.query('UPDATE payroll_run_employee SET pretax_deduction_cents=pretax_deduction_cents-1 WHERE payroll_run_id=$1',[run.id])
  await panel.getByRole('button',{name:'Refresh contributions',exact:true}).click();await expect(source).toContainText('Withheld: $14.00 · Delivery unverified')
  unavailable=true;await panel.getByRole('button',{name:'Refresh contributions',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('Synthetic source temporarily unavailable');await expect(source).toHaveCount(0)
  unavailable=false;await expect(source).toContainText('Withheld: $14.00 · Delivery unverified',{timeout:40000});expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close()}}
})
