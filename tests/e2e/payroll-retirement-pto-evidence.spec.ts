import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {regularRetirementFixture} from '../../backend/payroll/testing/regularRetirementFixture.js'
test('admin retains payout-specific retirement evidence through the PTO form and payroll draft',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const h=await createHarness({databaseNow:'2026-09-11T12:00:00.000Z',retirementNow:()=>new Date('2026-09-11T12:00:00Z')})
 try{
  const {api,employee,periods}=await regularRetirementFixture(h,{unusedPto:{inServiceDeferrals:'INCLUDED',postSeveranceDeferrals:'INCLUDED',postSeverance415:'INCLUDED',limitationYear:'CALENDAR_YEAR',terms:'Actual reviewed cashout plan terms and limitation year reference.'}})
  await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-09-01',480,'Synthetic earned vacation')",[employee.id])
  const policy={leaveType:'PTO',minutes:240,hourlyRateCents:2500,policyVerified:true,unusedVacationVerified:true,policyReference:'Reviewed actual unused vacation payout policy'}
  const calc=await api(`/employees/${employee.id}/leave-payout/preview`,policy)
  const reservation=await api(`/employees/${employee.id}/leave-payouts`,{...policy,payPeriodId:periods[0].id,fingerprint:calc.fingerprint,requestKey:randomUUID(),paymentMode:'STANDALONE'},'POST',201)
  const period=(await h.pool.query('SELECT id FROM payroll_employment_period WHERE employee_id=$1',[employee.id])).rows[0]
  await page.clock.install()
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  const form=page.getByRole('form',{name:`Standalone payment for PTO payout ${reservation.id}`,exact:true})
  await expect(form).toBeVisible()
  await form.getByLabel('PTO payment date',{exact:true}).fill('2026-09-22')
  await form.getByLabel('PTO payment-history evidence',{exact:true}).fill('Reviewed complete employer and related employer history')
  await form.getByRole('checkbox',{name:'I reconciled complete employer and related-employer payment history for this payment date.',exact:true}).check()
  await form.getByRole('combobox',{name:'Retirement PTO evidence',exact:true}).selectOption('REVIEW')
  await expect(form.getByRole('button',{name:'Create standalone PTO payroll',exact:true})).toBeDisabled()
  await form.getByRole('combobox',{name:'Employment period that earned this PTO',exact:true}).selectOption(String(period.id))
  await form.getByRole('combobox',{name:'Could this leave be used if employment continued?',exact:true}).selectOption('true')
  await form.getByLabel('Retirement PTO evidence reference',{exact:true}).fill('Retained actual earning-period and usable-leave evidence')
  const confirmation=form.getByRole('checkbox',{name:/I verified this reserved payout/});await confirmation.check()
  await form.getByLabel('PTO payment date',{exact:true}).fill('2026-09-23');await expect(confirmation).not.toBeChecked()
  await form.getByRole('checkbox',{name:'I reconciled complete employer and related-employer payment history for this payment date.',exact:true}).check();await confirmation.check()
  await form.getByRole('button',{name:'Review PTO calculation',exact:true}).click()
  const review=form.getByRole('region',{name:'PTO calculation review',exact:true})
  await expect(review).toContainText('Proposed pretax contribution: $5.00');await expect(review).toContainText('Proposed Roth contribution: $2.00');await expect(review).toContainText('Maryland income-tax wages after proposed deferral: $95.00')
  await h.pool.query("UPDATE payroll_employment_period SET ended_on='2026-09-20' WHERE id=$1",[period.id])
  await page.clock.fastForward(30001)
  await expect(form.getByRole('alert')).toContainText('Employment history changed')
  await expect(form.getByRole('button',{name:'Create standalone PTO payroll',exact:true})).toBeDisabled()
  await expect(review).not.toBeVisible()
  await confirmation.uncheck();await confirmation.check()
  await expect(form.getByRole('button',{name:'Create standalone PTO payroll',exact:true})).toBeEnabled()
  await form.getByRole('button',{name:'Review PTO calculation',exact:true}).click()
  await expect(review).toContainText('Proposed pretax contribution: $5.00')
  await page.setViewportSize({width:390,height:1100});await form.screenshot({path:'/tmp/payroll-retirement-pto-evidence-mobile.png'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await form.getByRole('button',{name:'Create standalone PTO payroll',exact:true}).click();await expect(form.getByRole('status')).toContainText('created')
  const row=(await h.pool.query("SELECT calculation_snapshot FROM payroll_run WHERE run_kind='OFF_CYCLE_PTO'")).rows[0]
  const assessment=row.calculation_snapshot.employees[0].retirementPtoAssessments[0]
  expect(assessment.status).toBe('EVIDENCE_READY');expect(assessment.source.evidence.employmentPeriodId).toBe(Number(period.id));expect(assessment.source.evidence.usableIfContinued).toBe(true);expect(assessment.source.evidence.employmentEndedOn).toBe('2026-09-20')
  expect(row.calculation_snapshot.employees[0].retirementPtoProposals[0].calculation.totalCents).toBe(700)
  expect(row.calculation_snapshot.warnings.some((w:{code:string})=>w.code==='RETIREMENT_OFF_CYCLE_REVIEW')).toBe(true)
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close()}}
})
