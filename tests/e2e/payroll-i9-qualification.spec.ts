import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {supplementReceiptFixture} from '../../backend/payroll/testing/supplementReceiptFixture.js'
test('admin records current qualification and retains negative changes',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='98'.repeat(32);const h=await createHarness()
 try{
 await supplementReceiptFixture(h);await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 let lost=true
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(lost&&u.pathname.endsWith('/i9/qualification')&&route.request().method()==='POST'&&response.status()===200){lost=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic qualification response lost.'})});return}await route.fulfill({response})})
 await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click()
 const work=page.getByRole('region',{name:'Current I-9 employer qualification',exact:true})
 await work.getByLabel('Covered hiring site(s)',{exact:true}).fill('Synthetic main hiring site')
 const labels=['Employer enrolled in E-Verify','Current E-Verify good standing','All covered hiring sites enrolled','Required examiner training complete','Consistent, nondiscriminatory procedure']
 for(const label of labels)await work.getByLabel(label,{exact:true}).selectOption('yes')
 await work.getByLabel('Qualification evidence',{exact:true}).fill('Admin reviewed the current employer and site records.')
 await work.getByRole('button',{name:'Record current qualification',exact:true}).click();await expect(work.getByRole('alert')).toContainText('Synthetic qualification response lost.')
 await work.getByRole('button',{name:'Record current qualification',exact:true}).click();await expect(work.getByRole('status')).toContainText('Qualification revision 1 retained.')
 expect(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_qualification')).rows[0].count)).toBe(1)
 await work.getByRole('button',{name:'Reload qualification history (replaces unsaved entries)',exact:true}).click()
 await expect(work.getByLabel('Qualification evidence',{exact:true})).toHaveValue('')
 for(const label of labels){await expect(work.getByLabel(label,{exact:true})).toHaveValue('');await work.getByLabel(label,{exact:true}).selectOption(label==='Current E-Verify good standing'?'no':'yes')}
 await work.getByLabel('Qualification evidence',{exact:true}).fill('Current good standing could not be verified on later review.')
 await work.getByRole('button',{name:'Record current qualification',exact:true}).click();await expect(work.getByRole('status')).toContainText('Qualification revision 2 retained.')
 await work.locator('summary').click();await expect(work.locator('article')).toHaveCount(2)
 await expect(work.locator('article').first()).toContainText('Current E-Verify good standing: Not currently verified')
 await page.setViewportSize({width:390,height:844});expect(await work.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true)
 await work.screenshot({path:'/tmp/payroll-i9-qualification-mobile.png'})
 }finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
