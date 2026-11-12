import {expect,test} from '@playwright/test'

test('conversion supports two children, program links and immediate class reservations',async({page})=>{
  let submitted: Record<string,unknown>|null=null
  await page.addInitScript(()=>{localStorage.setItem('vortex_admin','true');localStorage.setItem('adminToken','fixture');localStorage.setItem('vortex-admin-info',JSON.stringify({id:1,isMaster:false}));localStorage.setItem('vortex_admin_portal','new-admin')})
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname
    let data:unknown=[]
    if(path.endsWith('/new-admin/families')) data={rows:[],total:0,page:1,pageSize:25,totalPages:1}
    if(path==='/api/admin/access/me') data={isMasterAdmin:false,permissions:['classes.view','classes.manage','members.view','members.edit','scheduling.manage'],roles:['ADMIN'],user:{id:1}}
    if(path.endsWith('/leads')) data={rows:[{id:7,firstName:'Jordan',lastName:'Rivera',email:'parent@example.test',status:'new',contacted:false,followUp:false,inquiry:{campers:[{firstName:'Casey',lastName:'Rivera',dateOfBirth:'2016-01-01'},{firstName:'Alex',lastName:'Rivera',dateOfBirth:'2018-01-01'}]}}],total:1,page:1,pageSize:25,totalPages:1}
    if(path.endsWith('/lead-registration/catalog')) data=[{programs_id:1,program_name:'Gymnastics',class_id:2,class_name:'Foundations',slot_id:3,day_of_week:1,start_time:'16:00',end_time:'17:00',max_participants:10,occupied:3}]
    if(path.endsWith('/7/convert')) {submitted=route.request().postDataJSON();data={id:8,status:'sent',username:'jordanr',email:'parent@example.test',expiresAt:'2026-12-01',selections:[{kind:'reserved',label:'Foundations Monday',childName:'Casey'}]}}
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto('/')
  await page.getByRole('button',{name:'Leads',exact:true}).click()
  await page.getByRole('button',{name:'Convert',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Convert Jordan Rivera'})
  await dialog.getByRole('button',{name:'Add class link or reservation'}).click()
  await dialog.getByRole('combobox',{name:'Link type',exact:true}).selectOption('reserved')
  await dialog.getByRole('combobox',{name:'Child',exact:true}).selectOption('0')
  await dialog.getByRole('combobox',{name:'Program',exact:true}).selectOption('1')
  await dialog.getByRole('combobox',{name:'Class',exact:true}).selectOption('2')
  await dialog.getByRole('combobox',{name:'Class time',exact:true}).selectOption('3')
  await dialog.getByLabel('Enrollment start date').fill('2026-12-01')
  await dialog.getByRole('button',{name:'Add class link or reservation'}).click()
  await dialog.getByRole('combobox',{name:'Child',exact:true}).nth(1).selectOption('1')
  await dialog.getByRole('combobox',{name:'Program',exact:true}).nth(1).selectOption('1')
  await dialog.getByLabel('Instructions for the parent').fill('Complete setup, then review both children’s classes.')
  await dialog.getByRole('button',{name:'Send registration email'}).click()
  await expect(dialog.getByRole('heading',{name:'Registration email sent'})).toBeVisible()
  expect(submitted).toMatchObject({mode:'invite',children:[{firstName:'Casey'},{firstName:'Alex'}],selections:[{kind:'reserved',childIndex:0,programsId:1,classEventId:2,timeSlotId:3},{kind:'program',childIndex:1,programsId:1}],holdDays:7})
})

test('invited parent signs in to prefilling and changes username and password before completing setup',async({page})=>{
  let completion:Record<string,unknown>|null=null
  const waivers=[{id:1,name:'Test waiver',body:'Fixture waiver',version:'1',is_required:true}]
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname
    let data:unknown=[]
    if(path.endsWith('/new-admin/families')) data={rows:[],total:0,page:1,pageSize:25,totalPages:1}
    if(path.endsWith('/lead/8/session')) data={session:'proof',username:'jordanr',guardian:{firstName:'Jordan',lastName:'Rivera',email:'parent@example.test',phone:'2025550101'},children:[],waivers,completed:false,instructions:'Welcome to your classes.',selections:[{kind:'program',programsId:1,label:'Gymnastics',childName:''}],expiresAt:'2026-12-01'}
    if(path.endsWith('/lead/8/complete')) {completion=route.request().postDataJSON();data={payerMemberId:9,memberIds:[9],pendingEnrollments:[]}}
    if(path==='/api/members/login') return route.fulfill({json:{success:true,token:'new-member-token',member:{id:9,firstName:'Jordan',lastName:'Rivera',availablePortals:['member']}}})
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto('/signup/lead?invite=8&token=fixture-token')
  await page.getByLabel('Username',{exact:true}).fill('jordanr')
  await page.getByLabel('Password',{exact:true}).fill('Temporary123')
  await page.getByRole('button',{name:'Sign in to finish registration'}).click()
  await expect(page.getByPlaceholder('First name *',{exact:true})).toHaveValue('Jordan')
  await page.getByPlaceholder('Street address *').fill('100 Test Street')
  await page.getByPlaceholder('City *').fill('Albany')
  await page.locator('select').filter({has:page.locator('option[value="NY"]')}).selectOption('NY')
  await page.getByPlaceholder('ZIP *').fill('12207')
  await page.locator('input[type="date"]').fill('1988-01-01')
  await page.getByPlaceholder('Username *',{exact:true}).fill('jordannew')
  await page.getByPlaceholder('Password *',{exact:true}).fill('NewPassword123!')
  await page.getByPlaceholder('Confirm password *',{exact:true}).fill('NewPassword123!')
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await page.getByRole('checkbox').first().check()
  await page.getByRole('checkbox',{name:'I AGREE TO THE SELECTED WAIVERS ABOVE'}).check()
  await page.getByPlaceholder('Legal name').fill('Jordan Rivera')
  await page.getByRole('button',{name:/Create account|Complete signup|Finish|Submit/i}).click()
  await expect(page.getByRole('heading',{name:'Next: your classes'})).toBeVisible()
  expect(completion).toMatchObject({token:'fixture-token',session:'proof',primaryAdult:{username:'jordannew',password:'NewPassword123!',email:'parent@example.test'}})
  await expect(page.getByRole('link',{name:'Choose a class in this program'})).toHaveAttribute('href','/enroll?programsId=1')
})

test('class and program archives use their actions and display the active-class guard',async({page})=>{
  let archivedClass=false
  await page.addInitScript(()=>{localStorage.setItem('vortex_admin','true');localStorage.setItem('adminToken','fixture');localStorage.setItem('vortex-admin-info',JSON.stringify({id:1,isMaster:false}));localStorage.setItem('vortex_admin_portal','new-admin')})
  const klass={id:2,formId:3,programsId:1,name:'Foundations',programName:'Gymnastics',isActive:true,enrolledCount:0,capacity:10,waitlistCount:0,details:{}}
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname
    let data:unknown=[]
    if(path.endsWith('/new-admin/families')) data={rows:[],total:0,page:1,pageSize:25,totalPages:1}
    if(path==='/api/admin/access/me')data={isMasterAdmin:false,permissions:['classes.view','classes.manage','members.view','members.edit','scheduling.manage'],roles:['ADMIN'],user:{id:1}}
    if(path.endsWith('/new-admin/classes')) data={rows:archivedClass?[]:[klass],total:archivedClass?0:1,page:1,pageSize:25,totalPages:1}
    if(path.endsWith('/new-admin/classes/2/roster')) data={rows:[],total:0,page:1,pageSize:25,totalPages:0}
    if(path.endsWith('/new-admin/classes/2')) data={class:klass,groups:[],roster:{rows:[],total:0,page:1,pageSize:25,totalPages:1}}
    if(path==='/api/admin/programs/2/archive')archivedClass=true
    if(path==='/api/admin/programs-top')data=[{id:1,displayName:'Gymnastics',archived:false}]
    if(path==='/api/admin/programs-top/1/archive'&&!archivedClass)return route.fulfill({status:409,json:{success:false,message:'Close or archive all active classes before archiving this program.'}})
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto('/')
  await page.getByRole('button',{name:'Open Classes & schedules',exact:true}).click()
  await page.getByRole('button',{name:'Edit program',exact:true}).click()
  let dialog=page.getByRole('dialog',{name:'Edit program'})
  await dialog.getByRole('combobox',{name:'Program',exact:true}).selectOption('1')
  await dialog.getByRole('button',{name:'Archive program',exact:true}).click()
  await page.getByRole('dialog',{name:'Archive item',exact:true}).getByLabel('Type ARCHIVE to confirm').fill('ARCHIVE')
  await page.getByRole('dialog',{name:'Archive item',exact:true}).getByRole('button',{name:'Archive',exact:true}).click()
  await expect(dialog.getByRole('alert')).toContainText('all active classes')
  await dialog.getByRole('button',{name:'Close Edit program'}).click()
  await page.getByRole('button',{name:'Foundations',exact:true}).click()
  await page.getByRole('button',{name:'Archive class',exact:true}).click()
  await page.getByRole('dialog',{name:'Archive item',exact:true}).getByLabel('Type ARCHIVE to confirm').fill('ARCHIVE')
  await page.getByRole('dialog',{name:'Archive item',exact:true}).getByRole('button',{name:'Archive',exact:true}).click()
  await expect(page.getByText('No classes match this search.')).toBeVisible()
  await page.getByRole('button',{name:'Edit program',exact:true}).click()
  dialog=page.getByRole('dialog',{name:'Edit program'})
  await dialog.getByRole('combobox',{name:'Program',exact:true}).selectOption('1')
  await dialog.getByRole('button',{name:'Archive program',exact:true}).click()
  await page.getByRole('dialog',{name:'Archive item',exact:true}).getByLabel('Type ARCHIVE to confirm').fill('ARCHIVE')
  await page.getByRole('dialog',{name:'Archive item',exact:true}).getByRole('button',{name:'Archive',exact:true}).click()
  await expect(dialog).toBeHidden()
})
