import { expect, test, type Page } from '@playwright/test'

async function authenticate(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T15:00:00Z'))
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin','true')
    localStorage.setItem('adminToken','e2e-admin-token')
    localStorage.setItem('vortex-admin-info',JSON.stringify({id:1,name:'Enrollment Manager',isMaster:false}))
    localStorage.setItem('vortex_admin_portal','new-admin')
  })
}

test('lead filters combine contact, children and keyword searches and reset together', async ({ page }) => {
  await authenticate(page)
  const requests: URL[] = []
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url())
    let data: unknown = []
    if (url.pathname === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: ['members.view'], roles: ['ADMIN'], user: { id: 1 } }
    if (url.pathname.startsWith('/api/admin/accounting/')) data = null
    if (url.pathname === '/api/admin/new-admin/families') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (url.pathname === '/api/admin/new-admin/leads') {
      requests.push(url)
      data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    }
    return route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Leads', exact: true }).click()
  const filters = page.getByRole('region', { name: 'Lead filters' })
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveCount(0)
  await filters.getByRole('button', { name: 'Not contacted', exact: true }).click()
  await expect(filters.getByRole('button', { name: 'Converted', exact: true })).toHaveCount(0)
  await filters.getByRole('button', { name: 'Follow-up Needed', exact: true }).click()
  await expect(filters.getByRole('button', { name: 'Follow-up Needed', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(filters.getByLabel('Adult Classes', { exact: true })).toHaveCount(0)
  await filters.getByLabel('Min age', { exact: true }).fill('7')
  await filters.getByLabel('Max age', { exact: true }).fill('12')
  await filters.getByLabel('Gender (kid)', { exact: true }).selectOption('female')
  await filters.getByLabel('Name, email, phone', { exact: true }).fill('Rivera')
  await filters.getByLabel('Keywords', { exact: true }).fill('trial Tuesday')
  await expect.poll(() => Object.fromEntries(requests.at(-1)?.searchParams ?? [])).toMatchObject({ contacted: 'false', followUp: 'true', ageMin: '7', ageMax: '12', gender: 'female', search: 'Rivera', keywords: 'trial Tuesday', page: '1' })
  await filters.getByRole('button', { name: 'Contacted', exact: true }).click()
  await expect.poll(() => Object.fromEntries(requests.at(-1)?.searchParams ?? [])).toMatchObject({ contacted: 'true' })
  await filters.getByLabel('Min age', { exact: true }).fill('20')
  await expect(page.getByRole('alert')).toContainText('minimum age no greater than maximum age')
  await filters.getByRole('button', { name: 'Reset filters', exact: true }).click()
  await expect.poll(() => Object.fromEntries(requests.at(-1)?.searchParams ?? [])).toMatchObject({ contacted: '', followUp: '', ageMin: '', ageMax: '', gender: '', search: '', keywords: '', page: '1' })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await filters.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
})

test('enrollment actions expose dates, waitlist position, activation and timed discounts in Admin', async ({ page }) => {
  await authenticate(page)
  let status = 'confirmed'
  const requests: Record<string, unknown>[] = []
  const klass = { id:1,formId:10,programsId:2,name:'Tumbling',programName:'Gymnastics',isActive:true,capacity:12,enrolledCount:1,waitlistCount:0,details:{} }
  const paged = (rows: unknown[]) => ({rows,total:rows.length,page:1,pageSize:25,totalPages:1})
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    let data: unknown = []
    if (path === '/api/admin/access/me') data = {isMasterAdmin:false,permissions:['classes.view','classes.manage','members.view','members.edit','scheduling.manage'],roles:['ADMIN'],user:{id:1}}
    if (path === '/api/admin/new-admin/families') data = paged([])
    if (path === '/api/admin/new-admin/classes') data = paged([klass])
    if (path === '/api/admin/new-admin/classes/1') data = {class:klass,groups:[],roster:paged([{id:21,memberId:11,firstName:'Avery',lastName:'Rivera',status,startDate:'2026-09-01',slotGroupId:31,waitlistPosition:status==='waitlisted'?2:null}])}
    if (path === '/api/admin/new-admin/classes/1/roster') data = paged([{id:21,memberId:11,firstName:'Avery',lastName:'Rivera',status,enrollmentStatus:status==='confirmed'?'active':status==='cancelled'?'disenrolled':status,startDate:'2026-09-01',slotGroupId:31,waitlistPosition:status==='waitlisted'?2:null}])
    if (path === '/api/admin/scheduling/members/11/enrollments') data = { member:{id:11,firstName:'Avery',lastName:'Rivera'},rows:[{id:21,form_id:10,source:'scheduling',class_name:'Tumbling',program_name:'Gymnastics',status,waitlist_position:status==='waitlisted'?2:null,actions:[]}] }
    if (path === '/api/admin/scheduling/forms/10') data = {id:10,title:'Tumbling',isActive:true,slotGroups:[],slots:[],signupFields:[]}
    if (path === '/api/admin/scheduling/discount-rules') data = {rules:[],globalSettings:{}}
    if (path === '/api/admin/scheduling/signups/21' && req.method()==='PATCH') {
      const body = req.postDataJSON(); requests.push(body); status=body.status
    }
    if (path === '/api/admin/scheduling/signups/21/discount' && req.method()==='POST') requests.push(req.postDataJSON())
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto('/')
  await page.getByRole('navigation',{name:'Admin sections'}).getByRole('button',{name:'Classes & schedules',exact:true}).click()
  await expect(page.getByRole('columnheader').last()).toHaveText('Actions')
  await expect(page.getByRole('row').filter({has:page.getByRole('button',{name:'Edit class: Tumbling'})}).getByRole('cell').last().getByRole('button',{name:'Edit class: Tumbling'})).toBeVisible()
  await page.getByRole('button',{name:'Tumbling',exact:true}).click()
  const open = async () => { await page.getByRole('button',{name:'Manage enrollment'}).click(); return page.getByRole('dialog',{name:'Manage enrollment'}) }
  let dialog = await open()
  await expect(dialog.getByRole('button',{name:'Mark completed'})).toHaveCount(0)
  await expect(dialog.getByRole('button',{name:'Delete enrollment'})).toHaveCount(0)
  await expect(dialog.getByRole('button',{name:'Switch class'})).toBeVisible()
  await dialog.getByLabel('Action date').fill('2026-11-01')
  await dialog.getByRole('button',{name:'Switch class'}).click()
  const move=page.getByRole('dialog',{name:'Move to another class'})
  await expect(move.getByLabel('Move effective date')).toHaveValue('2026-11-01')
  await move.getByRole('button',{name:'Close new enrollment'}).click()
  await dialog.getByRole('button',{name:'Waitlist',exact:true}).click()
  await expect(dialog).toBeHidden()
  expect(requests.at(-1)).toMatchObject({status:'waitlisted',effectiveDate:'2026-11-01'})
  await expect(page.getByText('Waitlist #2',{exact:true})).toBeVisible()
  dialog = await open()
  await expect(dialog.getByText('Avery Rivera · Waitlist #2')).toBeVisible()
  await dialog.getByLabel('Action date').fill('2026-11-09')
  await dialog.getByRole('button',{name:'Activate',exact:true}).click()
  await expect(dialog).toBeHidden()
  expect(requests.at(-1)).toMatchObject({status:'confirmed',effectiveDate:'2026-11-09'})
  dialog = await open()
  await dialog.getByLabel('Discount percentage').fill('25')
  await dialog.getByLabel('Discount duration').selectOption('months')
  await dialog.getByLabel('Number of discount months').fill('3')
  await dialog.getByRole('button',{name:'Apply discount'}).click()
  await expect(dialog).toBeHidden()
  expect(requests.at(-1)).toMatchObject({mode:'manual',percent:25,duration:'months',durationMonths:3,effectiveFromMonth:'2026-11'})
  dialog = await open()
  await dialog.getByLabel('Action date').fill('2026-11-10')
  await dialog.getByRole('button',{name:'Disenroll',exact:true}).click()
  await expect(dialog).toBeHidden()
  dialog = await open()
  await dialog.getByLabel('Action date').fill('2026-11-12')
  await dialog.getByRole('button',{name:'Reenroll',exact:true}).click()
  await expect(page.getByRole('dialog',{name:'Add family enrollment'})).toBeVisible()
  await expect(page.getByLabel('Enrollment start date')).toHaveValue('2026-11-12')
})

test('leads support contacted, follow-up, original inquiry and shared account notes', async ({ page }) => {
  await authenticate(page)
  const lead = {id:5,firstName:'Jordan',lastName:'Rivera',email:'jordan@example.test',phone:'555-0100',status:'new',contacted:false,followUp:false,notes:'Original staff note',message:'Interested in a tumbling trial',createdAt:'2026-10-01',convertedMemberId:null,inquiry:{athleteAge:9,interests:['Tumbling'],campers:[{firstName:'Casey',lastName:'Rivera',gender:'female',dateOfBirth:'2016-11-12'}]}}
  const notes = [{id:1,subjectType:'member',subjectId:11,noteType:'staff_note',body:'Account note from old admin',authorName:'Coach Taylor',createdAt:'2026-10-03T12:00:00Z'}]
  await page.route('**/api/**',async route => {
    const req=route.request(),path=new URL(req.url()).pathname
    let data: unknown=[]
    if(path==='/api/admin/access/me') data={isMasterAdmin:false,permissions:['members.view','members.edit'],roles:['ADMIN'],user:{id:1}}
    if(path==='/api/admin/new-admin/families') data={rows:[],total:0,page:1,pageSize:25,totalPages:1}
    if(path==='/api/admin/new-admin/leads') data={rows:[lead],total:1,page:1,pageSize:25,totalPages:1}
    if(path==='/api/admin/new-admin/leads/5'&&req.method()==='PATCH') {Object.assign(lead,req.postDataJSON());data=lead}
    if(path==='/api/admin/new-admin/leads/5/notes') data=notes
    if(path==='/api/admin/notes'&&req.method()==='POST') {
      expect(req.postDataJSON()).toMatchObject({subjectType:'registration',subjectId:5,noteType:'staff_note',body:'Called family; trial booked'})
      const note={...req.postDataJSON(),id:2,authorName:'Coach Taylor',createdAt:'2026-11-11T15:00:00Z'};notes.push(note);data=note
    }
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto('/')
  await page.getByRole('button',{name:'Leads',exact:true}).click()
  await expect(page.getByRole('columnheader')).toHaveText(['Contacted','Follow-up','Name','Contact','Status','Kid details','Actions'])
  await expect(page.getByRole('button',{name:'Edit',exact:true})).toHaveCount(0)
  await expect(page.getByText('Female · 9 years old')).toBeVisible()
  await page.getByLabel('Contacted Jordan Rivera').click()
  await expect(page.getByLabel('Contacted Jordan Rivera')).toBeChecked()
  await page.getByLabel('Follow up Jordan Rivera').click()
  await expect(page.getByLabel('Follow up Jordan Rivera')).toBeChecked()
  await page.getByRole('button',{name:'Notes',exact:true}).click()
  const notesDialog=page.getByRole('dialog',{name:'Notes · Jordan Rivera'})
  await expect(notesDialog.getByText('Account note from old admin')).toBeVisible()
  await notesDialog.getByLabel('Add a note').fill('Called family; trial booked')
  await notesDialog.getByRole('button',{name:'Add note',exact:true}).click()
  await expect(notesDialog.getByText('Called family; trial booked')).toBeVisible()
  await notesDialog.getByRole('button',{name:'Close'}).click()
  await page.getByRole('button',{name:'Jordan Rivera',exact:true}).click()
  const inquiry=page.getByRole('dialog',{name:'Notes · Jordan Rivera'})
  await expect(inquiry.getByText('Interested in a tumbling trial')).toBeVisible()
  await expect(inquiry.getByRole('region',{name:'Scrollable account notes'})).toBeVisible()
  await inquiry.getByRole('button',{name:'Edit lead information'}).click()
  await expect(inquiry.getByLabel('Inquiry message')).toHaveValue('Interested in a tumbling trial')
  await inquiry.getByLabel('Inquiry message').fill('Trial scheduled for Saturday')
  await inquiry.getByRole('button',{name:'Save lead'}).click()
  await expect(inquiry.getByText('Trial scheduled for Saturday')).toBeVisible()
  expect(lead.message).toBe('Trial scheduled for Saturday')
})
