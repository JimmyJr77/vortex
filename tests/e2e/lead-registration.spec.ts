import {expect,test} from '@playwright/test'

test('conversion supports partial child details and optional dates for every link type',async({page})=>{
  let submitted: Record<string,unknown>|null=null
  await page.addInitScript(()=>{localStorage.setItem('vortex_admin','true');localStorage.setItem('adminToken','fixture');localStorage.setItem('vortex-admin-info',JSON.stringify({id:1,isMaster:false}));localStorage.setItem('vortex_admin_portal','new-admin')})
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname
    let data:unknown=[]
    if(path.endsWith('/new-admin/families')) data={rows:[],total:0,page:1,pageSize:25,totalPages:1}
    if(path==='/api/admin/access/me') data={isMasterAdmin:false,permissions:['classes.view','classes.manage','members.view','members.edit','scheduling.manage'],roles:['ADMIN'],user:{id:1}}
    if(path.endsWith('/leads')) data={rows:[{id:7,firstName:'Jordan',lastName:'Rivera',email:'parent@example.test',status:'new',contacted:false,followUp:false,inquiry:{campers:[{firstName:'Casey',lastName:'Rivera',dateOfBirth:'2016-01-01'},{firstName:'Alex',lastName:'Rivera',dateOfBirth:'2018-01-01'}]}}],total:1,page:1,pageSize:25,totalPages:1}
    if(path.endsWith('/lead-registration/catalog')) data=[
      {programs_id:1,program_name:'Gymnastics',class_id:2,class_name:'Foundations',form_id:4,slot_id:3,day_of_week:1,start_time:'16:00',end_time:'17:00',max_participants:10,occupied:3},
      {programs_id:1,program_name:'Gymnastics',class_id:5,class_name:'Intermediate',form_id:6,slot_id:null},
      {programs_id:7,program_name:'Trampoline',class_id:null,form_id:null,slot_id:null},
    ]
    if(path.endsWith('/7/convert')) {submitted=route.request().postDataJSON();data={id:8,status:'sent',username:'jordanr',email:'parent@example.test',expiresAt:'2026-12-01',selections:[{kind:'reserved',label:'Foundations Monday',childName:'Casey'}]}}
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto('/')
  await page.getByRole('button',{name:'Leads',exact:true}).click()
  await page.getByRole('button',{name:'Convert',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Convert Jordan Rivera'})
  await dialog.getByLabel('Child 1 last name').clear()
  await dialog.getByLabel('Child 1 birthday').clear()
  await dialog.getByRole('button',{name:'Add class link or reservation'}).click()
  await dialog.getByRole('combobox',{name:'Link type',exact:true}).selectOption('reserved')
  await dialog.getByRole('combobox',{name:'Child',exact:true}).selectOption('0')
  await dialog.getByRole('combobox',{name:'Program',exact:true}).selectOption('1')
  await dialog.getByRole('combobox',{name:'Class',exact:true}).selectOption('2')
  await dialog.getByRole('combobox',{name:'Class time',exact:true}).selectOption('3')
  await dialog.getByLabel('Enrollment start date').first().fill('2026-12-01')
  await dialog.getByRole('button',{name:'Add class link or reservation'}).click()
  await dialog.getByRole('combobox',{name:'Child',exact:true}).nth(1).selectOption('1')
  await dialog.getByRole('combobox',{name:'Program',exact:true}).nth(1).selectOption('1')
  await dialog.getByLabel('Enrollment start date').nth(1).fill('2026-12-03')
  await dialog.getByRole('button',{name:'Add class link or reservation'}).click()
  await dialog.getByRole('combobox',{name:'Link type',exact:true}).nth(2).selectOption('class')
  await dialog.getByRole('combobox',{name:'Program',exact:true}).nth(2).selectOption('1')
  await expect(dialog.getByRole('combobox',{name:'Program',exact:true}).nth(2).locator('option')).toHaveText(['Select program','Gymnastics'])
  await expect(dialog.getByRole('combobox',{name:'Class',exact:true}).nth(1).locator('option')).toHaveText(['Select class','Foundations'])
  await dialog.getByRole('combobox',{name:'Class',exact:true}).nth(1).selectOption('2')
  await dialog.getByLabel('Enrollment start date').nth(2).fill('2026-12-04')
  await dialog.getByRole('button',{name:'Add class link or reservation'}).click()
  await dialog.getByRole('combobox',{name:'Link type',exact:true}).nth(3).selectOption('reserved')
  await dialog.getByRole('combobox',{name:'Program',exact:true}).nth(3).selectOption('1')
  await dialog.getByRole('combobox',{name:'Class',exact:true}).nth(2).selectOption('2')
  await dialog.getByRole('combobox',{name:'Class time',exact:true}).nth(1).selectOption('3')
  await expect(dialog.getByLabel('Enrollment start date').nth(3)).toHaveValue('')
  await dialog.getByLabel('Days to finish registration').clear()
  await dialog.getByLabel('Instructions for the parent').fill('Complete setup, then review both children’s classes.')
  await dialog.getByRole('button',{name:'Send registration email'}).click()
  await expect(dialog.getByRole('heading',{name:'Registration email sent'})).toBeVisible()
  expect(submitted).toMatchObject({
    mode:'invite',
    children:[{firstName:'Casey',lastName:'',dateOfBirth:''},{firstName:'Alex'}],
    selections:[
      {kind:'reserved',childIndex:0,programsId:1,classEventId:2,timeSlotId:3,enrollmentStartDate:'2026-12-01'},
      {kind:'program',childIndex:1,programsId:1,enrollmentStartDate:'2026-12-03'},
      {kind:'class',childIndex:'',programsId:1,classEventId:2,enrollmentStartDate:'2026-12-04'},
      {kind:'reserved',childIndex:'',programsId:1,classEventId:2,timeSlotId:3,enrollmentStartDate:''},
    ],
    holdDays:7,
  })
})

test('invited parent fills missing family and class details before continuing to checkout',async({page})=>{
  let completion:Record<string,unknown>|null=null
  const waivers=[{id:1,name:'Test waiver',body:'Fixture waiver',version:'1',is_required:true}]
  const pendingEnrollments=[
    {memberId:9,programsId:1,classEventId:2,formId:3,slotGroupId:4,timeSlotId:5,classLabel:'Gymnastics Basics',enrollmentStartDate:'2027-01-12'},
    {memberId:10,programsId:1,classEventId:6,formId:7,slotGroupId:8,timeSlotId:9,classLabel:'Foundations',enrollmentStartDate:'2027-01-10'},
  ]
  const result={payerMemberId:9,memberIds:[9,10],pendingEnrollments,enrollmentsPrepared:true}
  await page.addInitScript(()=>{localStorage.setItem('vortex_admin','true');localStorage.setItem('adminToken','fixture');localStorage.setItem('vortex-admin-info',JSON.stringify({id:1,isMaster:false}));localStorage.setItem('vortex_admin_portal','new-admin')})
  await page.route('**/?enrollment=review',route=>route.fulfill({contentType:'text/html',body:'<h1>Member checkout</h1>'}))
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname
    let data:unknown=[]
    if(path.endsWith('/new-admin/families')) data={rows:[],total:0,page:1,pageSize:25,totalPages:1}
    if(path.endsWith('/lead/8/session')) data={
      session:'proof',username:'jordanr',guardian:{firstName:'Jordan',lastName:'Rivera',email:'parent@example.test',phone:'2025550101'},children:[{firstName:'Casey'}],waivers,
      completed:Boolean(completion),result:completion ? result : undefined,instructions:'Welcome to your classes.',expiresAt:'2026-12-01',
      selections:[
        {kind:'program',programsId:1,label:'Gymnastics',childIndex:null},
        {kind:'reserved',programsId:1,classEventId:6,schedulingFormId:7,slotGroupId:8,timeSlotId:9,childIndex:0,label:'Gymnastics / Foundations · Monday 16:00–17:00',scheduleLabel:'Monday 16:00–17:00',enrollmentStartDate:'2027-01-10'},
      ],
    }
    if(path.endsWith('/catalog/programs/1/classes')) data=[{id:2,name:'Gymnastics Basics',schedulingFormId:3}]
    if(path.endsWith('/catalog/classes/2/offerings')) data={formId:3,offerings:[],scheduleOptions:[{slotGroupId:4,timeSlotId:5,scheduleLabel:'Thursday 16:00–17:00'}]}
    if(path.endsWith('/lead/8/complete')) {completion=route.request().postDataJSON();data=result}
    if(path==='/api/members/login') return route.fulfill({json:{success:true,token:'new-member-token',member:{id:9,firstName:'Jordan',lastName:'Rivera',availablePortals:['member']}}})
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto('/signup/lead?invite=8&token=fixture-token&selection=1')
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
  await expect(page.getByPlaceholder('First name *',{exact:true})).toHaveValue('Casey')
  await page.getByPlaceholder('Last name *',{exact:true}).fill('Rivera')
  await page.locator('input[type="date"]').fill('2016-01-01')
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  const enrollments=page.getByRole('heading',{name:'Program enrollment'})
  await expect(enrollments).toBeVisible()
  await expect(page.getByLabel('Program',{exact:true}).first().locator('option:checked')).toHaveText('Gymnastics')
  await expect(page.getByLabel('Family member',{exact:true}).nth(1).locator('option:checked')).toHaveText('Casey Rivera')
  await expect(page.getByLabel('Class',{exact:true}).nth(1).locator('option:checked')).toHaveText('Foundations')
  await expect(page.getByText('Monday 16:00–17:00',{exact:true})).toBeVisible()
  await expect(page.getByLabel('Enrollment start date').nth(1)).toHaveValue('2027-01-10')
  await page.getByLabel('Family member',{exact:true}).first().selectOption({label:'Jordan Rivera'})
  await page.getByLabel('Class',{exact:true}).first().selectOption('2')
  await page.getByLabel('Class time',{exact:true}).selectOption('4:5')
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByText('Select an enrollment start date for enrollment 1.')).toBeVisible()
  await page.getByLabel('Enrollment start date').first().fill('2027-01-12')
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await page.getByRole('checkbox').first().check()
  await page.getByRole('checkbox',{name:'I AGREE TO THE SELECTED WAIVERS ABOVE'}).check()
  await page.getByPlaceholder('Legal name').fill('Jordan Rivera')
  await page.getByRole('button',{name:/Create account|Complete signup|Finish|Submit/i}).click()
  await expect(page.getByRole('heading',{name:'Next: your classes'})).toBeVisible()
  expect(completion).toMatchObject({
    token:'fixture-token',session:'proof',primaryAdult:{username:'jordannew',password:'NewPassword123!',email:'parent@example.test'},
    additionalMembers:[{firstName:'Casey',lastName:'Rivera',dateOfBirth:'2016-01-01'}],
    enrollments:[
      {memberIndex:0,classEventId:2,schedulingFormId:3,slotGroupId:4,timeSlotId:5,enrollmentStartDate:'2027-01-12'},
      {memberIndex:1,classEventId:6,schedulingFormId:7,slotGroupId:8,timeSlotId:9,enrollmentStartDate:'2027-01-10'},
    ],
  })
  await page.reload()
  await page.getByLabel('Username',{exact:true}).fill('jordannew')
  await page.getByLabel('Password',{exact:true}).fill('NewPassword123!')
  await page.getByRole('button',{name:'Sign in to finish registration'}).click()
  await page.getByRole('button',{name:'Review classes and complete enrollment'}).click()
  await expect(page).toHaveURL('/?enrollment=review')
  await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('vortex_member_enrollment_draft_v1:9:10') || 'null'))).toMatchObject({cart:[{classEventId:6,enrollmentStartDate:'2027-01-10'}]})
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
