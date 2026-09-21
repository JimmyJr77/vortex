import {test,expect,createHarness} from '../support/historicalPayrollTest'
import {regularEmployerRetirementFixture} from '../../backend/payroll/testing/regularEmployerRetirementFixture.js'
test.use({historicalPayrollReferenceTime:'2026-09-16T16:00:00.000Z'})
test('admin reviews employer funding and approves and finalizes combined retirement payroll',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const h=await createHarness({databaseNow:'2026-09-16T16:00:00.000Z',retirementNow:()=>new Date('2026-09-16T16:00:00Z')}),errors:string[]=[]
 page.on('pageerror',error=>errors.push(error.message))
 try{
  const {employee,periods}=await regularEmployerRetirementFixture(h)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
  await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(periods[0].id))
  await page.getByRole('button',{name:'Preview payroll',exact:true}).click();await expect(page.getByText('0 approval blockers',{exact:true})).toBeVisible()
  const employer=page.getByRole('region',{name:/^Employer retirement funding for/}).first()
  await expect(employer).toContainText('Employer matching$6.00');await expect(employer).toContainText('Employer nonelective$4.00');await expect(employer).toContainText('Total employer funding$10.00')
  await expect(employer).toContainText('Approval will reserve')
  await page.setViewportSize({width:390,height:1200});await employer.screenshot({path:'/tmp/payroll-employer-funding-preview-mobile.png'})
  const deductions=page.getByRole('region',{name:'Retirement payroll deductions',exact:true});await expect(deductions).toContainText('Pretax 401(k)$10.00');await expect(deductions).toContainText('Roth 401(k)$4.00');await expect(deductions).toContainText('Total contribution$14.00')
  await page.getByRole('button',{name:'Save draft snapshot'}).click();await page.getByRole('button',{name:'Open review'}).click();await page.getByRole('button',{name:'Send to review'}).click();await page.getByRole('button',{name:'Approve run',exact:true}).click()
  await expect(page.getByText('Employer contributions reserved at approval. Provider delivery remains a separate step.',{exact:true})).toBeVisible()
  await page.getByLabel('External payment confirmation').fill('SYNTHETIC-BROWSER-RETIREMENT');await page.getByRole('button',{name:'Confirm paid & finalize'}).click()
  await expect(page.getByText('Payroll finalized and employee statements saved.',{exact:true})).toBeVisible()
  const row=(await h.pool.query("SELECT re.*,r.status FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id WHERE re.employee_id=$1",[employee.id])).rows[0]
  expect(row.status).toBe('FINALIZED');expect(Number(row.pretax_deduction_cents)).toBe(1000);expect(Number(row.posttax_deduction_cents)).toBe(12900)
  expect(row.statement_snapshot.retirement.employerPlans[0]).toMatchObject({matchingCents:600,nonelectiveCents:400,totalCents:1000})
  expect((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_employer_run_ledger')).rows[0].n).toBe(1)
  expect(row.statement_snapshot.retirement.plans[0]).toMatchObject({ordinaryPretaxCents:1000,ordinaryRothCents:400})
  expect((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_run_ledger')).rows[0].n).toBe(1)
  await page.setViewportSize({width:390,height:1200});await deductions.last().screenshot({path:'/tmp/payroll-employer-approval-mobile.png'});expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close()}}
})
