import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {correctionPaymentFixture} from '../../backend/payroll/testing/correctionPaymentFixture.js'
import {payStatementPdf,statementLines} from '../../backend/payroll/payStatement.js'
import fs from 'node:fs/promises'
for(const openingAccruedMinutes of [0,2250])test(`authorized correction is visible in regular payroll with opening leave ${openingAccruedMinutes}`,async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(15000);test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();try{
 const {api,request,input,target}=await correctionPaymentFixture(h,{openingAccruedMinutes})
 const preview=await api(`/requests/${request.id}/payroll-correction-payment-preview`,input)
 await api(`/requests/${request.id}/payroll-correction-authorizations`,{...input,fingerprint:preview.fingerprint,requestKey:'browser-payroll-authorization',reason:'Authorize reviewed correction in the selected regular payroll',confirmed:true},'POST',201)
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html')
 await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
 await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(target.id))
 await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
 const review=page.getByRole('region',{name:'Authorized payroll corrections',exact:true})
 await expect(review.getByText(/prior-period wages: \$75.00/)).toBeVisible()
 await expect(review.getByText(`Current worked hours: 40.00. Target leave accrual: ${openingAccruedMinutes?66:80} minutes.`,{exact:true})).toBeVisible()
 await review.screenshot({path:`/tmp/payroll-authorized-correction-${openingAccruedMinutes}.png`})
 await page.getByRole('button',{name:'Save draft snapshot',exact:true}).click()
 await page.getByRole('row').filter({hasText:'Sep 4, 2026'}).getByRole('button',{name:'Open review',exact:true}).click()
 await page.getByRole('button',{name:'Send to review',exact:true}).click()
 await page.getByRole('button',{name:'Approve run',exact:true}).click()
 await page.getByRole('textbox',{name:'External payment confirmation',exact:true}).fill('SYNTHETIC-BROWSER-CORRECTION-PAID')
 await page.getByRole('button',{name:'Confirm paid & finalize',exact:true}).click()
 await expect(page.getByText('Payroll finalized and employee statements saved.',{exact:true})).toBeVisible()
 const row=(await h.pool.query('SELECT re.*,p.period_start,p.period_end,COALESCE(r.payment_date,p.pay_date) AS pay_date FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.pay_period_id=$1',[target.id])).rows[0]
 expect(row.statement_snapshot.correctionSettlements[0].paymentApplied).toBe(true)
 expect(statementLines(row).lines.some(line=>line[0]==='Prior-period wage correction'&&line[1].includes('settlement #')&&line[2]===7500)).toBe(true)
 if(openingAccruedMinutes===0)await fs.writeFile('/tmp/payroll-correction-settled.pdf',await payStatementPdf(row))
 await page.reload();await page.getByRole('button',{name:'Requests & approvals',exact:true}).click()
 await page.getByRole('button',{name:'Load payment authorizations',exact:true}).click()
 await expect(page.getByText(/settled with payroll/)).toBeVisible()
 await expect(page.getByText(/corrected time and leave are applied/)).toBeVisible()
 await page.getByText(/settled with payroll/).locator('..').screenshot({path:`/tmp/payroll-correction-settled-${openingAccruedMinutes}.png`})
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
