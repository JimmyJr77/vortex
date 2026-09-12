import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
import {journalPayload} from '../../backend/payroll/quickbooks.js'
test('admin reviews and downloads the exact retained benefit journal after disconnect',async({page})=>{
 test.setTimeout(90000);test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();try{
 const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-SAVED-JOURNAL'})
 const saved=(await h.pool.query('SELECT *,payment_date AS pay_date FROM payroll_run WHERE id=$1',[run.id])).rows[0]
 const payload=journalPayload(saved,{wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'})
 await h.pool.query("INSERT INTO payroll_quickbooks_sync (facility_id,payroll_run_id,realm_id,request_id,payload,environment,status,external_id,attempts) VALUES(1,$1,'123','synthetic-saved-journal-request',$2,'sandbox','SYNCED','synthetic-journal',2)",[run.id,payload])
 for(let i=0;i<50;i++)await h.pool.query("INSERT INTO payroll_quickbooks_sync (facility_id,payroll_run_id,realm_id,request_id,payload,environment,status,external_id,attempts) VALUES(1,$1,$2,$3,$4,'sandbox','SYNCED','synthetic-newer',1)",[run.id,String(200+i),`synthetic-newer-${i}`,payload])
 const listing=await api('/quickbooks');expect(listing.jobs).toHaveLength(50);expect(listing.nextCursor).toBeTruthy();expect(listing.jobs[0].payload).toEqual(payload)
 const older=await api(`/quickbooks?before=${listing.nextCursor}`);expect(older.jobs).toHaveLength(1);expect(older.nextCursor).toBeNull();expect(older.jobs[0].request_id).toBe('synthetic-saved-journal-request')
 expect(listing.jobs.some((job:{id:number})=>job.id===older.jobs[0].id)).toBe(false)
 await api('/quickbooks?before=invalid',undefined,'GET',400)
 await api(`/quickbooks/jobs/${older.jobs[0].id}/retry`,{},'POST',409)
 const denied=await fetch(`${h.url}/api/admin/payroll/quickbooks/jobs/${older.jobs[0].id}/retry`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});expect(denied.status).toBe(404)
 const foreign=await fetch(`${h.url}/api/admin/payroll/quickbooks`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});expect((await foreign.json()).data.jobs).toEqual([])
 expect((await fetch(`${h.url}/api/admin/payroll/quickbooks`)).status).toBe(401)
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html')
 await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click()
 await page.getByRole('button',{name:'Review benefit contributions',exact:true}).click()
 const reconciliation=page.getByRole('region',{name:'Benefit contribution reconciliation',exact:true})
 await expect(reconciliation).toContainText('Collected: $125.00');await expect(reconciliation).toContainText('Medical · Family · 2026-09')
 await reconciliation.getByText('Employee deductions',{exact:true}).click();await expect(reconciliation).toContainText('Monthly Benefits · $125.00')
 await reconciliation.screenshot({path:'/tmp/payroll-benefit-reconciliation-mobile.png'})
 await page.locator('section').filter({has:page.getByRole('heading',{name:'Benefit contributions',exact:true})}).screenshot({path:'/tmp/payroll-benefit-report-mobile.png'})
 const contributionDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download benefit contributions',exact:true}).click()
 await (await contributionDownload).saveAs('/tmp/payroll-benefit-contributions.csv')
 const contributions=await readFile('/tmp/payroll-benefit-contributions.csv','utf8');expect(contributions).toContain('2026-09-18,2026-09');expect(contributions).toContain('Medical');expect(contributions).toContain('125.00');expect(contributions.trim().split('\r\n')).toHaveLength(2)
 await api('/reports/benefit-contributions.csv?start=bad&end=2026-09-30',undefined,'GET',400)
 const previewUrl='/api/admin/payroll/reports/benefit-contributions?start=2026-09-01&end=2026-09-30'
 const foreignPreview=await fetch(`${h.url}${previewUrl}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});expect((await foreignPreview.json()).data.contributions).toEqual([])
 expect((await fetch(`${h.url}${previewUrl}`)).status).toBe(401)
 await page.getByLabel('Report start date',{exact:true}).fill('2026-08-01');await page.getByLabel('Report end date',{exact:true}).fill('2026-08-31')
 await expect(reconciliation).toHaveCount(0);await page.getByRole('button',{name:'Review benefit contributions',exact:true}).click();await expect(reconciliation).toContainText('No finalized benefit contributions in this payment range.')


 await page.getByRole('button',{name:'Load older journals',exact:true}).click()
 await expect(page.getByText(`View saved journal for run ${run.id}`,{exact:true})).toHaveCount(51)
 await expect(page.getByRole('button',{name:'Load older journals',exact:true})).toHaveCount(0)
 await page.getByText(`View saved journal for run ${run.id}`,{exact:true}).last().click()
 const journal=page.getByRole('region',{name:`Saved journal for run ${run.id}`,exact:true}).last()
 await expect(journal).toContainText('2026-09 benefit contribution: Medical — Family');await expect(journal).toContainText('Credit: $125.00');await expect(journal).toContainText('Send attempts: 2');await expect(journal).toContainText('Journal balances.')
 const box=await journal.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390)
 await journal.screenshot({path:'/tmp/payroll-saved-journal-mobile.png'})
 const download=page.waitForEvent('download');await journal.getByRole('button',{name:'Download saved journal JSON',exact:true}).click()
 const file=await download;await file.saveAs('/tmp/payroll-saved-journal.json');expect(JSON.parse(await readFile('/tmp/payroll-saved-journal.json','utf8'))).toEqual(payload)
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
