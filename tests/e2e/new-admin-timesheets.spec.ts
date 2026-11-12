import { expect, test, type Page } from '@playwright/test'

type Assignment = { id: number; startTime: string; endTime: string; endDate: string; minutes: number; notes: string }
type Day = { date: string; minutes: number | null; notes: string; version: number; assignments: Assignment[] }
async function setup(page: Page, admin: boolean) {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin','true')
    localStorage.setItem('adminToken','timesheet-test-token')
    localStorage.setItem('vortex-admin-info',JSON.stringify({id:1,name:'Alex Staff'}))
    localStorage.setItem('vortex_admin_portal','new-admin')
  })
  const dates=Array.from({length:7},(_,i)=>`2026-11-${String(9+i).padStart(2,'0')}`)
  const people=[{id:1,name:'Alex Staff',days:dates.map(date=>({date,minutes:date==='2026-11-09'?180:null,notes:'',version:0,assignments:date==='2026-11-11'?[{id:5,startTime:'09:00',endTime:'11:00',endDate:date,minutes:120,notes:'Coaching'}]:[]} as Day))},{id:2,name:'Taylor Coach',days:dates.map(date=>({date,minutes:date==='2026-11-10'?120:null,notes:'',version:0,assignments:[]} as Day))}]
  const writes: {path:string;body:Record<string,unknown>}[]=[]
  const reads: URLSearchParams[]=[]
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname,method=route.request().method()
    let data: unknown=[]
    if(path==='/api/admin/access/me')data={isMasterAdmin:false,permissions:[]}
    if(path==='/api/admin/notifications')data={notifications:[],unreadCount:0}
    if(path.endsWith('/timesheets/options'))data={userId:1,canViewAll:admin,people:admin?people.map(({id,name})=>({id,name})):[],timezone:'America/New_York',today:'2026-11-12'}
    if(path.endsWith('/timesheets/week')&&method==='PUT'){
      const body=route.request().postDataJSON();writes.push({path,body})
      for(const row of body.days){const day=people[0].days.find(day=>day.date===row.date)!;Object.assign(day,row,{version:day.version+1})}
      data={saved:true}
    }
    if(path.endsWith('/timesheets/assignments')&&method==='POST'){
      const body=route.request().postDataJSON();writes.push({path,body})
      people.find(p=>p.id===body.userId)!.days.find(day=>day.date===body.date)!.assignments.push({id:99,startTime:body.startTime,endTime:body.endTime,endDate:body.date,minutes:180,notes:body.notes})
      data={id:99}
    }
    if(path.endsWith('/timesheets/week')&&method==='GET'){
      reads.push(url.searchParams)
      const week=url.searchParams.get('week')!,person=url.searchParams.get('person')
      const days=Array.from({length:7},(_,i)=>new Date(Date.parse(`${week}T12:00:00Z`)+i*86400000).toISOString().slice(0,10))
      data={week,end:days[6],today:'2026-11-12',timezone:'America/New_York',userId:1,canAssign:admin,people:people.filter(p=>person==='all'||p.id===(person==='me'?1:Number(person))).map(p=>({...p,days:days.map(date=>p.days.find(day=>day.date===date)??{date,minutes:null,notes:'',version:0,assignments:[]})}))}
    }
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto('/')
  await page.getByRole('button',{name:'Open Timesheets',exact:true}).click()
  await expect(page.getByLabel('Hours worked 2026-11-09')).toHaveValue('3')
  return {writes,reads}
}

test('weekly hours default to this week, preserve actuals separately from assignments, and navigate with calendar/arrows',async({page})=>{
  const {writes,reads}=await setup(page,false)
  await expect(page.getByLabel('Choose week')).toHaveValue('2026-11-09')
  await expect(page.getByLabel('View timesheets')).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Assign time',exact:true})).toHaveCount(0)
  const assignedRow=page.getByRole('row').filter({has:page.getByLabel('Hours worked 2026-11-11')})
  await expect(assignedRow.getByRole('cell').filter({hasText:'Coaching'})).toHaveClass(/bg-amber-50/)
  await expect(assignedRow).toContainText('9:00 AM–11:00 AM')
  await expect(page.getByLabel('Hours worked 2026-11-11')).toHaveValue('')
  await page.getByLabel('Hours worked 2026-11-11').fill('3.5')
  await page.getByLabel('Hours worked 2026-11-13').fill('1.25')
  await page.getByLabel('Notes 2026-11-13').fill('Extra work')
  await page.getByRole('button',{name:'Save hours',exact:true}).click()
  await expect(page.getByText('Hours saved.',{exact:true})).toBeVisible()
  expect(writes.at(-1)?.body).toMatchObject({week:'2026-11-09',days:[{date:'2026-11-11',minutes:210},{date:'2026-11-13',minutes:75,notes:'Extra work'}]})
  await expect(page.getByText('7h 45m',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Previous week',exact:true}).click()
  await expect(page.getByLabel('Choose week')).toHaveValue('2026-11-02')
  await page.getByRole('button',{name:'Next week',exact:true}).click()
  await expect(page.getByLabel('Hours worked 2026-11-11')).toHaveValue('3.5')
  await page.getByLabel('Choose week').fill('2026-10-21')
  await expect(page.getByLabel('Choose week')).toHaveValue('2026-10-19')
  await expect.poll(()=>reads.at(-1)?.get('week')).toBe('2026-10-19')
  await page.getByRole('button',{name:'This week',exact:true}).click()
  await expect(page.getByLabel('Choose week')).toHaveValue('2026-11-09')
  await page.screenshot({path:'/private/tmp/vortex-timesheets-weekly.png',fullPage:true})
  await page.setViewportSize({width:390,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByLabel('Hours worked 2026-11-12').fill('2')
  await page.getByRole('button',{name:'Next week',exact:true}).click()
  await expect.poll(()=>writes.at(-1)?.body).toMatchObject({days:[{date:'2026-11-12',minutes:120}]})
  await page.getByRole('button',{name:'This week',exact:true}).click()
  await expect(page.getByLabel('Hours worked 2026-11-12')).toHaveValue('2')
  await page.screenshot({path:'/private/tmp/vortex-timesheets-weekly-mobile.png',fullPage:true})
})

test('admins view team totals and assign highlighted hours to a selected person',async({page})=>{
  const {writes}=await setup(page,true)
  await page.getByLabel('View timesheets').selectOption('all')
  await expect(page.getByRole('button',{name:'Taylor Coach',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Taylor Coach',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Taylor Coach',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Save hours',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'Assign time',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Assign time',exact:true})
  await expect(dialog.getByRole('combobox',{name:'Person',exact:true})).toHaveValue('2')
  await dialog.getByLabel('Date',{exact:true}).fill('2026-11-12')
  await dialog.getByLabel('Start time',{exact:true}).fill('09:00')
  await dialog.getByLabel('End time',{exact:true}).fill('12:00')
  await dialog.getByLabel('Assignment note (optional)').fill('Assigned practice')
  await dialog.getByRole('button',{name:'Assign hours',exact:true}).click()
  await expect(dialog).toHaveCount(0)
  expect(writes.at(-1)?.body).toMatchObject({userId:2,date:'2026-11-12',startTime:'09:00',endTime:'12:00',notes:'Assigned practice'})
  await expect(page.getByText('3h 0m assigned · Assigned practice')).toBeVisible()
  await expect(page.getByText('2h 0m',{exact:true}).first()).toBeVisible()
  await expect(page.getByRole('cell').filter({hasText:'Assigned practice'})).toHaveClass(/bg-amber-50/)
})
