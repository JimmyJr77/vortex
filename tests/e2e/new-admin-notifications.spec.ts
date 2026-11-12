import { expect, test } from '@playwright/test'

for (const initialPortal of ['new-admin', 'admin']) test(`${initialPortal} routes shared alerts to Admin on desktop and mobile`, async ({ page }) => {
  await page.addInitScript((portal) => {
    localStorage.setItem('vortex_admin','true')
    localStorage.setItem('adminToken','e2e-admin-token')
    localStorage.setItem('vortex-admin-info',JSON.stringify({id:1,name:'Admin'}))
    localStorage.setItem('vortex_admin_portal',portal)
  }, initialPortal)
  let read=false
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname
    let data: unknown=[]
    if(path==='/api/admin/access/me') data={isMasterAdmin:true,permissions:[]}
    if(path==='/api/admin/notifications/1/read') read=true
    if(path==='/api/admin/notifications') data={notifications:[{id:1,kind:'system',title:'Staff announcement',body:'Schedule updated',created_at:'2026-11-12T12:00:00Z',read_at:read?'2026-11-12T13:00:00Z':null}],unreadCount:read?0:1}
    if(path==='/api/admin/billing/cancellation-requests') data=[{id:5,signup_id:12,member_name:'Alex Athlete',class_name:'Tumbling',request_reason:'Schedule change',recommended_effective_date:'2026-12-01',created_at:'2026-11-12T12:00:00Z'}]
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto('/')
  const bell=page.getByRole('button',{name:'Notifications',exact:true})
  await expect(bell).toHaveText('2')
  await bell.click()
  await page.getByRole('button',{name:/Staff announcement/}).click()
  await expect.poll(()=>read).toBe(true)
  await expect(bell).toHaveText('1')
  await page.getByRole('button',{name:/Cancellation request: Alex Athlete/}).click()
  const review=page.getByRole('dialog',{name:'Cancellation review',exact:true})
  await expect(review.getByRole('button',{name:'Approve end-of-period'})).toBeVisible()
  await review.getByRole('button',{name:'Close Cancellation review'}).click()
  await page.setViewportSize({width:390,height:844})
  await expect(bell).toBeVisible()
  await bell.click()
  await expect(page.getByRole('button',{name:/Staff announcement/})).toBeVisible()
  await page.getByRole('button',{name:'Maximize notifications',exact:true}).click()
  await expect(page.getByRole('button',{name:'Close notifications',exact:true})).toBeVisible()
})
