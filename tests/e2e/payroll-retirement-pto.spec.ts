import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {regularRetirementFixture} from '../../backend/payroll/testing/regularRetirementFixture.js'
for(const stateVariant of ['REVIEWED','MD_LUMP_SUM','MD_LUMP_SUM_EXTRA'])for(const federalMethod of ['FLAT_22','AGGREGATE'])test(`admin calculates retirement PTO, reviews state withholding and finalizes ${federalMethod} ${stateVariant} payroll`,async({page})=>{
 const additional=stateVariant==='MD_LUMP_SUM_EXTRA',stateMethod=additional?'MD_LUMP_SUM':stateVariant
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const h=await createHarness({databaseNow:'2026-09-11T12:00:00.000Z',retirementNow:()=>new Date('2026-09-11T12:00:00Z')});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const unusedPto={inServiceDeferrals:'INCLUDED',postSeveranceDeferrals:'INCLUDED',postSeverance415:'INCLUDED',limitationYear:'CALENDAR_YEAR',terms:'Actual plan unused-leave cashout compensation review'}
  const {api,employee,periods}=await regularRetirementFixture(h,{unusedPto,hourlyRateCents:10000})
  const regularDate=additional?'2026-09-15':'2026-09-18'
  const regular=await api('/runs',{payPeriodId:periods[0].id,paymentDate:regularDate},'POST',201);await api(`/runs/${regular.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${regular.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${regular.id}/finalize`,{paymentDate:regularDate,paymentConfirmationReference:'SYNTHETIC-PRIOR-RETIREMENT-PTO'})
  if(additional){
   await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed additional withholding election',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1,extraWithholdingCents:500}},'PATCH')
   const path=`/employees/${employee.id}/maryland-additional-agreements`,current=await api(path)
   await api(path,{status:'ACTIVE',expectedRevision:0,requestKey:randomUUID(),confirmed:true,sourceReference:'Synthetic signed payment date additional withholding agreement',effectiveOn:'2026-09-16',amountCents:500,periodBasis:'PAYMENT_DATE',electionFingerprint:current.currentElectionFingerprint},'POST',201)
  }
  await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-09-01',480,'Synthetic earned vacation')",[employee.id])
  const policy={leaveType:'PTO',minutes:240,hourlyRateCents:2500,policyVerified:true,unusedVacationVerified:true,policyReference:'Retained actual unused vacation payment policy'}
  const calc=await api(`/employees/${employee.id}/leave-payout/preview`,policy),reservation=await api(`/employees/${employee.id}/leave-payouts`,{...policy,payPeriodId:periods[1].id,fingerprint:calc.fingerprint,requestKey:randomUUID(),paymentMode:'STANDALONE'},'POST',201)
  const period=(await h.pool.query('SELECT id FROM payroll_employment_period WHERE employee_id=$1',[employee.id])).rows[0]
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  const form=page.getByRole('form',{name:`Standalone payment for PTO payout ${reservation.id}`,exact:true})
  await expect(form.getByRole('combobox',{name:'PTO state withholding method',exact:true})).toHaveValue('MD_LUMP_SUM')
  await form.getByRole('combobox',{name:'PTO state withholding method',exact:true}).selectOption(stateMethod)
  await form.getByLabel('PTO payment date',{exact:true}).fill('2026-09-22');await form.getByLabel('PTO payment-history evidence',{exact:true}).fill('Reviewed complete employer and related employer history')
  await form.getByRole('combobox',{name:'PTO federal withholding method',exact:true}).selectOption(federalMethod)
  await form.getByRole('checkbox',{name:'I reconciled complete employer and related-employer payment history for this payment date.',exact:true}).check()
  await form.getByRole('combobox',{name:'Retirement PTO evidence',exact:true}).selectOption('REVIEW');await form.getByRole('combobox',{name:'Employment period that earned this PTO',exact:true}).selectOption(String(period.id));await form.getByRole('combobox',{name:'Could this leave be used if employment continued?',exact:true}).selectOption('true')
  await form.getByLabel('Retirement PTO evidence reference',{exact:true}).fill('Retained actual earning period and usable leave evidence');await form.getByRole('checkbox',{name:/I verified this reserved payout/}).check()
  await expect(form.getByRole('combobox',{name:'PTO federal withholding method',exact:true})).toHaveValue(federalMethod)
  await form.getByRole('button',{name:'Review PTO calculation',exact:true}).click()
  const review=form.getByRole('region',{name:'PTO calculation review',exact:true});await expect(review).toContainText(stateMethod==='REVIEWED'?'Proposed pretax contribution: $5.00':'Calculated pretax contribution: $5.00')
  const stateHistory=form.locator('details').filter({has:page.getByText('Prior Maryland payment evidence',{exact:true})})
  await stateHistory.locator('summary').click();await expect(stateHistory).toContainText('Recorded state wages and withholding reconcile.');await expect(stateHistory).toContainText('$760.00 Maryland wages');await expect(stateHistory).toContainText('Additional withholding: $0.00 applied of $0.00 requested.');await stateHistory.screenshot({path:`/tmp/payroll-maryland-pto-history-${federalMethod}.png`})
  if(stateMethod==='REVIEWED'){
  await form.getByLabel('Reviewed Maryland PTO withholding ($)',{exact:true}).fill('7.60');await form.getByLabel('Maryland PTO calculation source',{exact:true}).fill('Synthetic professional state calculation for the displayed taxable wages')
  await form.getByRole('checkbox',{name:/I verified this state withholding amount/}).check();await form.getByRole('button',{name:'Review PTO calculation',exact:true}).click()
  }else{await expect(review).toContainText(additional?'Automatic Maryland withholding: $14.22':'Automatic Maryland withholding: $9.22');await expect(review).toContainText('$95.00 taxable wages × 9.70%');await expect(review.getByRole('link',{name:'Maryland withholding table'})).toHaveAttribute('href',/pm320\.pdf$/)}
  if(additional){await expect(review).toContainText('$9.22 base withholding');await expect(review).toContainText('$5.00 agreed; $0.00 already paid or reserved; $5.00 applied to this payment.')}
  await expect(review).toContainText('Calculated pretax contribution: $5.00');await expect(review).toContainText('Calculated Roth contribution: $2.00');await expect(review).toContainText('Deductions: $7.00')
  if(federalMethod==='FLAT_22')await expect(review).toContainText(stateMethod==='REVIEWED'?'Calculated net pay: $56.85':additional?'Calculated net pay: $50.23':'Calculated net pay: $55.23')
  else await expect(review).toContainText(stateMethod==='REVIEWED'?'Calculated net pay: $68.25':additional?'Calculated net pay: $61.63':'Calculated net pay: $66.63')
  await page.setViewportSize({width:390,height:1100});await review.screenshot({path:`/tmp/payroll-retirement-pto-${federalMethod}-${stateVariant}.png`})
  await form.getByRole('button',{name:'Create standalone PTO payroll',exact:true}).click();await expect(form.getByRole('status')).toContainText('created')
  await page.getByRole('button',{name:'Payroll runs',exact:true}).click();await page.getByRole('row').filter({hasText:'Standalone PTO payout'}).getByRole('button',{name:'Open review',exact:true}).click()
  await page.getByRole('button',{name:'Send to review',exact:true}).click();await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1");await page.getByRole('button',{name:'Approve run',exact:true}).click()
  await page.getByLabel('External payment confirmation',{exact:true}).fill('SYNTHETIC-NATIVE-RETIREMENT-PTO');const finalized=page.waitForResponse(r=>/\/runs\/\d+\/finalize$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST',{timeout:30000});await page.getByRole('button',{name:'Confirm paid & finalize',exact:true}).click();expect((await finalized).status()).toBe(200);await expect(page.getByText('Payroll finalized and employee statements saved.',{exact:true})).toBeVisible({timeout:15000})
  const row=(await h.pool.query("SELECT r.status,re.statement_snapshot FROM payroll_run r JOIN payroll_run_employee re ON re.payroll_run_id=r.id WHERE r.run_kind='OFF_CYCLE_PTO'")).rows[0]
  if(stateMethod==='MD_LUMP_SUM'){expect(row.statement_snapshot.incomeTaxWageBasis.stateCalculation.stateIncomeTaxCents).toBe(additional?1422:922);expect(row.statement_snapshot.incomeTaxWageBasis.stateCalculation.rateBasisPoints).toBe(970)}
  if(additional){expect(row.statement_snapshot.incomeTaxWageBasis.stateTaxComponents.appliedAdditionalCents).toBe(500);expect(row.statement_snapshot.incomeTaxWageBasis.stateCalculation.baseIncomeTaxCents).toBe(922)}
  expect(row.status).toBe('FINALIZED');expect(row.statement_snapshot.supplementalTax.method).toBe(federalMethod);expect(row.statement_snapshot.retirement.plans[0].ordinaryPretaxCents).toBe(500);expect(row.statement_snapshot.incomeTaxWageBasis.marylandWagesCents).toBe(9500);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close()}}
})
