import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
import {hashPayrollToken} from '../../backend/payroll/employeeAuth.js'
const {PDFDocument}=createRequire(new URL('../../backend/package.json',import.meta.url))('pdf-lib')
test('employee reads PDF proof, consents, downloads confirmation and withdraws electronic W-2 consent',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');const h=await createHarness()
 try{
 const {employee}=await monthlyBenefitsFixture(h);await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[employee.id,hashPayrollToken('browser-consent-session')])
 await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','browser-consent-session'))
 await page.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html?employee');await page.getByRole('button',{name:'Onboarding',exact:true}).click()
 const prefs=page.getByRole('region',{name:'Electronic W-2 preferences',exact:true}),load=prefs.getByRole('button',{name:'Review W-2 delivery preferences',exact:true});await load.click();await expect(prefs).toContainText('Paper delivery is selected.');await expect(prefs).toContainText('Scope of consent');await expect(prefs).toContainText('Payroll contact:')
 const sample=page.waitForEvent('download');await prefs.getByRole('button',{name:'Download PDF access check',exact:true}).click();const sampleFile=await sample,pdf=await PDFDocument.load(await readFile((await sampleFile.path())!)),code=pdf.getForm().getTextField('access-code').getText()
 const save=prefs.getByRole('button',{name:'Save electronic W-2 consent',exact:true});await expect(save).toBeDisabled();await prefs.getByLabel('Code from your PDF',{exact:true}).fill(code);await prefs.getByLabel('Your signature',{exact:true}).fill('Synthetic Browser Employee');await prefs.getByRole('checkbox').check();await prefs.getByLabel('Your signature',{exact:true}).fill('Synthetic Final Signature');await expect(save).toBeDisabled();await prefs.getByRole('checkbox').check();await prefs.locator('fieldset').screenshot({path:'/tmp/payroll-w2-consent-form-mobile.png'});await save.click();await expect(prefs).toContainText('Electronic consent is current.');await expect(prefs.getByRole('status')).toContainText('consent was saved')
 const confirmation=page.waitForEvent('download');await prefs.getByRole('button',{name:/Download confirmation/}).click();const confirmationText=await readFile((await (await confirmation).path())!,'utf8');expect(confirmationText).toContain('Synthetic Final Signature');expect(confirmationText).toContain('2026 W-2 delivery preference')
 await h.pool.query("UPDATE payroll_settings SET business_address='Synthetic changed employer address' WHERE facility_id=1");await load.click();await expect(prefs).toContainText('The disclosure changed.')
 const withdraw=prefs.getByRole('button',{name:'Withdraw electronic consent',exact:true});await expect(withdraw).toBeDisabled();await prefs.getByLabel('I want to withdraw electronic W-2 consent now.',{exact:true}).check();await withdraw.click();await expect(prefs).toContainText('Paper delivery is selected.');await expect(prefs.getByRole('status')).toContainText('Electronic consent withdrawn, effective');await expect(prefs.locator('article')).toHaveCount(2);await prefs.locator('article').first().screenshot({path:'/tmp/payroll-w2-withdrawal-mobile.png'})
 await page.route('**/w2-electronic/consent',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic preferences unavailable'})}));await load.click();await expect(prefs.getByRole('alert')).toHaveText('Synthetic preferences unavailable');await expect(prefs.locator('article')).toHaveCount(0)
 }catch(e){if(!page.isClosed())console.error(await page.getByRole('region',{name:'Electronic W-2 preferences',exact:true}).getByRole('alert').allTextContents().catch(()=>[]));if(!page.isClosed())await page.screenshot({path:'/tmp/payroll-w2-consent-failure.png'}).catch(()=>{});throw e}finally{await page.unrouteAll({behavior:'wait'}).catch(()=>{});await page.close().catch(()=>{});await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
