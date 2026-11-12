import { expect, test } from '@playwright/test'

test('schedule selection highlights the slot and combines roster status and athlete search', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin','true')
    localStorage.setItem('adminToken','e2e-admin-token')
    localStorage.setItem('vortex-admin-info',JSON.stringify({id:1,name:'Admin'}))
    localStorage.setItem('vortex_admin_portal','new-admin')
  })
  const klass={id:1,name:'Tumbling',programName:'Gymnastics',capacity:40,enrolledCount:30,isActive:true,details:{displayName:'Tumbling'}}
  const slot={id:100,dayOfWeek:1,startTime:'16:00',endTime:'17:00',isActive:true}
  const groups=[{id:10,capacity:30,enrolledCount:29,waitlistCount:1,slots:[slot]},{id:20,capacity:10,enrolledCount:1,waitlistCount:0,slots:[{...slot,id:200,dayOfWeek:3}]}]
  const rows=[...Array.from({length:27},(_,i)=>({id:i+1,memberId:i+1,firstName:`Athlete ${i+1}`,lastName:'Active',status:'confirmed',enrollmentStatus:'active',slotGroupId:10,timeSlotId:100})),
    {id:30,memberId:30,firstName:'Jordan',lastName:'Paused',status:'paused',enrollmentStatus:'paused',slotGroupId:10,timeSlotId:null},
    {id:31,memberId:31,firstName:'Taylor',lastName:'Paused',status:'paused',enrollmentStatus:'paused',slotGroupId:20,timeSlotId:200},
    {id:32,memberId:32,firstName:'Casey',lastName:'Former',status:'cancelled',enrollmentStatus:'disenrolled',slotGroupId:10,timeSlotId:100},
    {id:33,memberId:33,firstName:'Alex',lastName:'Waiting',status:'waitlisted',enrollmentStatus:'waitlisted',slotGroupId:10,timeSlotId:100}]
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),params=url.searchParams
    let data: unknown=[]
    if(url.pathname==='/api/admin/access/me') data={isMasterAdmin:true,permissions:[]}
    if(url.pathname==='/api/admin/new-admin/classes') data={rows:[klass],total:1,page:1,totalPages:1}
    if(url.pathname==='/api/admin/new-admin/classes/1') data={class:klass,groups,roster:{rows:[],total:0,page:1,totalPages:0}}
    if(url.pathname==='/api/admin/new-admin/classes/1/roster') {
      const filtered=rows.filter(row=>(!params.has('slotGroupId') || row.slotGroupId===Number(params.get('slotGroupId'))) &&
        (!params.has('timeSlotId') || row.timeSlotId===null || row.timeSlotId===Number(params.get('timeSlotId'))) &&
        (params.get('status')==='all' || row.enrollmentStatus===params.get('status')) &&
        `${row.firstName} ${row.lastName}`.toLowerCase().includes((params.get('search') || '').toLowerCase()))
      const current=Number(params.get('page'))
      data={rows:filtered.slice((current-1)*25,current*25),total:filtered.length,page:current,totalPages:Math.ceil(filtered.length/25)}
    }
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto('/')
  await page.getByRole('navigation',{name:'Admin sections'}).getByRole('button',{name:'Classes & schedules',exact:true}).click()
  await page.getByRole('button',{name:'Tumbling',exact:true}).click()
  const roster=page.getByRole('region',{name:'Class roster'})
  await roster.getByRole('button',{name:'Next',exact:true}).click()
  await expect(roster.getByText(/Page 2 of/)).toBeVisible()
  const monday=page.getByRole('button',{name:'Monday · 4:00 PM–5:00 PM',exact:true})
  await monday.click()
  await expect(monday).toHaveAttribute('aria-pressed','true')
  await expect(roster.getByText(/Page 1 of/)).toBeVisible()
  await roster.getByLabel('Enrollment status').selectOption('paused')
  await expect(roster.getByRole('button',{name:'Jordan Paused',exact:true})).toBeVisible()
  await expect(roster.getByRole('button',{name:'Taylor Paused',exact:true})).toHaveCount(0)
  await roster.getByLabel('Search athletes').fill('Taylor')
  await expect(roster.getByText('No athletes match this schedule, status, and search.')).toBeVisible()
  await expect(roster.getByLabel('Search athletes')).toBeFocused()
  await page.getByRole('button',{name:'All schedules',exact:true}).click()
  await expect(roster.getByRole('button',{name:'Taylor Paused',exact:true})).toBeVisible()
  await roster.getByLabel('Search athletes').fill('')
  await roster.getByLabel('Enrollment status').selectOption('disenrolled')
  await expect(roster.getByRole('cell',{name:'Disenrolled',exact:true})).toBeVisible()
  await roster.getByLabel('Enrollment status').selectOption('waitlisted')
  await expect(roster.getByRole('cell',{name:'Wait listed',exact:true})).toBeVisible()
  await roster.getByLabel('Enrollment status').selectOption('active')
  await expect(roster.getByRole('cell',{name:'Active',exact:true}).first()).toBeVisible()
})
