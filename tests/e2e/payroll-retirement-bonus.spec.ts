import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {regularRetirementFixture} from '../../backend/payroll/testing/regularRetirementFixture.js'
for(const method of ['FLAT_22','AGGREGATE'])test(`admin reviews retirement deductions and finalizes a ${method} standalone bonus`,async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const h=await createHarness({retirementNow:()=>new Date('2026-09-11T12:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {api,employee,periods}=await regularRetirementFixture(h,{includeBonus:true,hourlyRateCents:10000})
  const regular=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${regular.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${regular.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${regular.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-PRIOR-RETIREMENT'})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
  const form=page.getByRole('region',{name:'Standalone annual bonus',exact:true})
  await form.getByRole('combobox',{name:'Bonus employee',exact:true}).selectOption(String(employee.id));await form.getByRole('combobox',{name:'Bonus processing period',exact:true}).selectOption(String(periods[1].id));await form.getByRole('combobox',{name:'Bonus federal withholding method',exact:true}).selectOption(method)
  await form.getByLabel('Bonus payment date',{exact:true}).fill('2026-09-22');await form.getByLabel('Standalone bonus amount ($)',{exact:true}).fill('1000');await form.getByLabel('Bonus decision evidence',{exact:true}).fill('Synthetic discretionary bonus without a prior promise');await form.getByLabel('Complete payment-history evidence',{exact:true}).fill('Synthetic complete employer payment history reconciliation')
  for(const checkbox of await form.getByRole('checkbox').all())await checkbox.check()
  await form.getByRole('button',{name:'Calculate standalone bonus',exact:true}).click()
  const deductions=form.getByRole('region',{name:'Retirement payroll deductions',exact:true});await expect(deductions).toContainText('Pretax 401(k)$50.00');await expect(deductions).toContainText('Roth 401(k)$20.00');await expect(form).toContainText('Maryland withholding: $92.15')
  if(method==='FLAT_22')await expect(form).toContainText('Bonus net: $552.35')
  await page.setViewportSize({width:390,height:1200});await deductions.screenshot({path:`/tmp/payroll-retirement-bonus-${method}.png`})
  await form.getByRole('button',{name:'Save standalone bonus draft',exact:true}).click();await expect(form.getByRole('status')).toContainText('saved')
  await page.getByRole('row').filter({hasText:'Standalone annual bonus'}).getByRole('button',{name:'Open review',exact:true}).click();await page.getByRole('button',{name:'Send to review',exact:true}).click();await page.getByRole('button',{name:'Approve run',exact:true}).click()
  await page.getByLabel('External payment confirmation',{exact:true}).fill('SYNTHETIC-RETIREMENT-BONUS-BROWSER');await page.getByRole('button',{name:'Confirm paid & finalize',exact:true}).click();await expect(page.getByText('Payroll finalized and employee statements saved.',{exact:true})).toBeVisible()
  const row=(await h.pool.query("SELECT r.status,re.pretax_deduction_cents,re.posttax_deduction_cents,re.statement_snapshot FROM payroll_run r JOIN payroll_run_employee re ON r.id=re.payroll_run_id WHERE r.run_kind='OFF_CYCLE_BONUS'")).rows[0]
  expect(row.status).toBe('FINALIZED');expect(Number(row.pretax_deduction_cents)).toBe(5000);expect(Number(row.posttax_deduction_cents)).toBe(2000);expect(row.statement_snapshot.retirement.plans[0].ordinaryRothCents).toBe(2000);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close()}}
})
