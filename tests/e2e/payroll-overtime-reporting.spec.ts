import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
test('admin reviews actual overtime premiums and suppresses inconsistent retained sources',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000);page.setDefaultTimeout(10000)
 const h=await createHarness();try{
 const {api,employee,periods}=await monthlyBenefitsFixture(h)
 await h.pool.query("UPDATE payroll_time_entry SET clock_in='2026-09-10T04:00:00Z',clock_out='2026-09-10T20:00:00Z' WHERE employee_id=$1 AND clock_in::date='2026-09-10'",[employee.id])
 for(const day of ['08','09'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[employee.id,`2026-09-${day}T04:00:00Z`,`2026-09-${day}T20:00:00Z`])
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click()
 const view=page.getByRole('region',{name:'Overtime reporting source review',exact:true});await view.getByRole('button',{name:'Review 2026 overtime sources',exact:true}).click();await expect(view).toContainText('No finalized employee payments in 2026.')
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-OVERTIME-REPORT'})
 await view.getByRole('button',{name:'Review 2026 overtime sources',exact:true}).click();await expect(view).toContainText('Retained paid overtime premium: $100.00');await expect(view).toContainText('FLSA qualification review required.')
 await view.screenshot({path:'/tmp/payroll-overtime-source-mobile.png'})
 await view.getByText('Record FLSA qualification review',{exact:true}).click()
 await view.getByRole('combobox',{name:'FLSA treatment',exact:true}).selectOption('FLSA_REQUIRED')
 await view.getByLabel('Qualified overtime premium ($)',{exact:true}).fill('100.01')
 await view.getByLabel('FLSA review reference',{exact:true}).fill('Synthetic mixed required and additional premium review')
 await view.getByRole('checkbox').check();await expect(view.getByRole('button',{name:'Save qualification review',exact:true})).toBeDisabled()
 await view.getByLabel('Qualified overtime premium ($)',{exact:true}).fill('75.00');await expect(view.getByRole('checkbox')).not.toBeChecked();await view.getByRole('checkbox').check()
 await view.getByRole('button',{name:'Save qualification review',exact:true}).click();await expect(view.getByRole('status')).toHaveText('Qualification review saved.')
 await view.getByText('Qualification review history',{exact:true}).click();await expect(view).toContainText('CURRENT · Review 1 · $75.00');await view.screenshot({path:'/tmp/payroll-qualification-form-mobile.png'})
 await view.getByRole('button',{name:'Review 2026 overtime sources',exact:true}).click();await expect(view).toContainText('Reviewed qualified premium: $75.00')

 await view.getByText('Record FLSA qualification review',{exact:true}).click()
 await view.getByRole('combobox',{name:'FLSA treatment',exact:true}).selectOption('NOT_FLSA_REQUIRED');await view.getByLabel('Qualified overtime premium ($)',{exact:true}).fill('0.00');await view.getByLabel('FLSA review reference',{exact:true}).fill('Synthetic revised FLSA coverage source');await view.getByRole('checkbox').check()
 const row=(await h.pool.query('SELECT id,statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0],changed=structuredClone(row.statement_snapshot);changed.workweekPayments[0].premiumCents++
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$2 WHERE id=$1',[row.id,changed])
 await view.getByRole('button',{name:'Save qualification review',exact:true}).click();await expect(view.getByRole('alert')).toContainText('Payroll premium evidence changed');await expect(view.getByRole('button',{name:'Save qualification review',exact:true})).toBeDisabled()
 await view.getByRole('button',{name:'Review 2026 overtime sources',exact:true}).click();await expect(view).toContainText('Paid premium unavailable');await expect(view).toContainText('Retained workweek payments do not reconcile.');await expect(view).not.toContainText('Retained paid overtime premium: $100.00');await expect(view).not.toContainText('Reviewed qualified premium: $75.00');await expect(view).toContainText('Qualification review is stale.')
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$2 WHERE id=$1',[row.id,row.statement_snapshot])
 await view.getByRole('button',{name:'Review 2026 overtime sources',exact:true}).click();await expect(view).toContainText('Retained paid overtime premium: $100.00')
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
