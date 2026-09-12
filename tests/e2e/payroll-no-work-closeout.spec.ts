import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin records a no-work closeout and reopens onboarding without a payroll payment',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 test.setTimeout(60000)
 const h=await createHarness()
 try{
  const r=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'NO-WORK-BROWSER',legalFirstName:'Never',legalLastName:'Started',hireDate:'2026-08-03',hourlyRateCents:2500})})
  expect(r.status).toBe(201);const e=(await r.json()).data
  await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-03' WHERE id=$1",[e.id])
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:390,height:1400})
  await page.goto('/tests/support/payroll.html')
  await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  await page.getByText('Hire never started work',{exact:true}).click()
  const close=page.getByRole('button',{name:'Record no-work closeout',exact:true})
  await expect(close).toBeDisabled()
  await page.getByRole('textbox',{name:'No-work closeout reason',exact:true}).fill('The hire was cancelled before starting')
  await page.getByRole('textbox',{name:'No-work review evidence',exact:true}).fill('Synthetic employee and supervisor confirmation of no work or payment obligation')
  await page.getByRole('checkbox',{name:'I verified that no work, orientation or paid training was performed.',exact:true}).check()
  await expect(close).toBeDisabled()
  await page.getByRole('checkbox',{name:'I verified that no wages, expenses, leave payout or other payment obligation remains.',exact:true}).check()
  await close.locator('..').screenshot({path:'/tmp/payroll-no-work-closeout-mobile.png'})
  await close.click()
  await expect(page.getByText('No-work hiring closeout recorded',{exact:true})).toBeVisible()
  const rehire=page.getByRole('region',{name:'Rehire preparation',exact:true})
  await rehire.getByLabel('Proposed rehire date',{exact:true}).fill('2099-09-07')
  await rehire.getByRole('button',{name:'Review rehire records',exact:true}).click()
  await rehire.getByRole('textbox',{name:'Rehire reason',exact:true}).fill('Hire is now ready to start work')
  await rehire.getByRole('textbox',{name:'Prior obligations and leave policy review reference',exact:true}).fill('Synthetic review of closeout and renewed hiring terms')
  await rehire.getByRole('checkbox',{name:'I confirm the displayed start date, role and compensation terms.',exact:true}).check()
  await rehire.getByRole('checkbox',{name:'I reviewed prior wages, corrections, expenses and leave policy, including retaining the displayed balances.',exact:true}).check()
  await rehire.getByRole('button',{name:'Reopen onboarding',exact:true}).click()
  await expect(rehire).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'Hiring checklist & review',exact:true})).toBeVisible()
  expect((await h.pool.query('SELECT employment_status FROM payroll_employee WHERE id=$1',[e.id])).rows[0].employment_status).toBe('ONBOARDING')
  expect((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_run_employee WHERE employee_id=$1',[e.id])).rows[0].n).toBe(0)
  expect(errors).toEqual([])
 }finally{
  try{
   if(!page.isClosed()){
    await page.unrouteAll({behavior:'ignoreErrors'})
    await page.close()
   }
  }finally{await h.close()}
 }
})
