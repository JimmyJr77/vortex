import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin saves encrypted payment configuration and clears credentials and stale readiness',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(60000)
 let providerAvailable=true
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');const h=await createHarness({paymentFetcher:async()=>({ok:providerAvailable,status:providerAvailable?200:503,json:async()=>({id:'00000000-0000-4000-8000-000000000002',currency:'USD',live_mode:false})})})
 try{
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let failRead=false
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());if(failRead&&u.pathname.endsWith('/payment-connection')&&route.request().method()==='GET')return route.fulfill({status:503,json:{success:false,message:'Synthetic configuration unavailable'}});await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click()
  const view=page.getByRole('region',{name:'Payroll payment connection',exact:true}),save=view.getByRole('button',{name:'Save payment connection',exact:true})
  await expect(view).toContainText('No payment connection configured.');await expect(save).toBeDisabled()
  await view.getByLabel('Modern Treasury organization ID',{exact:true}).fill('00000000-0000-4000-8000-000000000001')
  await view.getByLabel('Employer funding account ID',{exact:true}).fill('00000000-0000-4000-8000-000000000002')
  const key=view.getByLabel('Modern Treasury API key',{exact:true});await key.fill('synthetic-browser-secret');await expect(key).toHaveAttribute('type','password')
  const reference=view.getByLabel('Payment configuration reference',{exact:true});await reference.fill('Synthetic employer connection review');await view.getByRole('checkbox').check();await reference.fill('Synthetic revised connection review');await expect(save).toBeDisabled();await view.getByRole('checkbox').check();await save.click()
  await expect(view.getByRole('status')).toContainText('Payment configuration saved');await expect(key).toHaveValue('');await expect(view).toContainText('Configured · provider verification required.');await expect(view.getByRole('checkbox')).not.toBeChecked()
  const row=(await h.pool.query('SELECT encrypted_configuration FROM payroll_payment_connection')).rows[0];expect(row.encrypted_configuration.includes(Buffer.from('synthetic-browser-secret'))).toBe(false)
  await view.getByRole('button',{name:'Verify funding account',exact:true}).click();await expect(view.getByRole('status')).toContainText('Funding account matched');await expect(view).toContainText('Configured · last funding account check passed.')
  providerAvailable=false;await view.getByRole('button',{name:'Verify funding account',exact:true}).click();await expect(view.getByRole('status')).toContainText('verification needs attention');await expect(view).toContainText('Last check: UNAVAILABLE');await expect(view).not.toContainText('Configured · last funding account check passed.')
  await view.screenshot({path:'/tmp/payroll-payment-connection-mobile.png'})
  failRead=true;await view.getByRole('button',{name:'Refresh payment connection',exact:true}).click();await expect(view.getByRole('alert')).toContainText('Synthetic configuration unavailable');await expect(view).not.toContainText('Configured · provider verification required.');await expect(save).toHaveCount(0)
 }finally{await page.unrouteAll({behavior:'wait'});await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
