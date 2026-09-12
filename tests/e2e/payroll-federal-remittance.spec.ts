import {federalRemittanceBankSample} from '../../backend/payroll/testing/federalRemittanceBankSample.js'
import {federalRemittanceInstruction} from '../../backend/payroll/federalRemittanceInstruction.js'
import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
test('admin retains a federal remittance review and refreshes changed liabilities',async({page})=>{
 test.setTimeout(90000);test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const h=await createHarness()
 try{
 const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-REMITTANCE-BROWSER'})
 await api('/federal-deposit-schedule',{year:2026,schedule:'MONTHLY',priorYearNextDay:false,source:'Synthetic verified monthly schedule',confirmed:true})
 await api('/filing-identity',{identifier:'123456789',legalName:'Synthetic Employer',address:{line1:'1 Test Way',line2:'',city:'Baltimore',state:'MD',postalCode:'21201',country:'US'},confirmed:true,expectedRevision:0,reference:'Synthetic verified employer identity'},'POST',201)
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1000});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Compliance',exact:true}).click()
 const panel=page.getByRole('region',{name:'Federal remittance review',exact:true})
 await panel.getByLabel('Federal deposit obligation').selectOption({index:1})
 await panel.getByLabel('Planned tax settlement date').fill('2026-10-15')
 await panel.getByRole('button',{name:'Preview federal remittance',exact:true}).click()
 await expect(panel.getByText('Tax period ends 2026-09-30 · EIN ending 6789')).toBeVisible()
 await expect(panel).not.toContainText('123456789')
 const retain=panel.getByRole('button',{name:'Retain remittance review',exact:true});await expect(retain).toBeDisabled()
 await panel.getByLabel('Federal remittance review reference').fill('Synthetic browser retained review')
 await panel.getByRole('checkbox').check();await retain.click()
 await expect(panel.getByRole('status')).toContainText('No tax payment has been scheduled.')
 await panel.getByText('Federal remittance review history',{exact:true}).click();await expect(panel.getByText(/Current review/)).toBeVisible()
 const model=await api('/federal-remittance-review?year=2026'),sample=federalRemittanceBankSample(federalRemittanceInstruction({agency:'IRS_941',year:2026,quarter:3,ein:'123456789',amountCents:Number(model.history[0].amount_cents),settlementDate:'2026-10-15'}))
 await panel.getByText('Compare bank tax fields',{exact:true}).click()
 await panel.getByLabel('Bank ACH sample').setInputFiles({name:'synthetic.ach',mimeType:'text/plain',buffer:Buffer.from(sample)})
 await panel.getByRole('button',{name:'Compare tax fields',exact:true}).click();await expect(panel.getByText('Tax fields match this review.',{exact:true})).toBeVisible();await panel.screenshot({path:'/tmp/payroll-bank-fields-mobile.png'})
 await panel.getByLabel('Bank ACH sample').setInputFiles({name:'invalid.ach',mimeType:'text/plain',buffer:Buffer.from('invalid')})
 await expect(panel.getByText('Tax fields match this review.',{exact:true})).toHaveCount(0)
 await panel.getByRole('button',{name:'Compare tax fields',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('94 characters')
 await api('/tax-deposits',{agency:'IRS_941',year:2026,quarter:3,paidOn:'2026-09-10',amountCents:1,reference:'SYNTHETIC-BROWSER-PRIOR-DEPOSIT',confirmed:true},'POST',201)
 await panel.getByRole('button',{name:'Refresh remittance obligations',exact:true}).click();await expect(panel.getByText(/Needs refreshed review/)).toBeVisible()
 await panel.getByRole('button',{name:'Preview federal remittance',exact:true}).click();await expect(retain).toBeDisabled()
 await panel.screenshot({path:'/tmp/payroll-federal-remittance-mobile.png'})
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close();if(old)process.env.PAYROLL_DOCUMENT_KEY=old;else delete process.env.PAYROLL_DOCUMENT_KEY}
})
