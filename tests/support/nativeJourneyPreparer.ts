import {expect,type Page} from '@playwright/test'

export async function nativeJourneyPreparer(admin:Page,apiUrl:string,count=1){
 const roster=admin.getByRole('region',{name:'I-9 preparer roster',exact:true})
 const profiles=[{first:'Alice',last:'Translator'},{first:'Sam',last:'Preparer'}].slice(0,count)
 const invitations:Array<{href:string,first:string,last:string}>=[]
 for(const profile of profiles){
 await roster.getByLabel('Intended preparer name (first, optional middle initial, last)',{exact:true}).fill(`${profile.first} ${profile.last}`)
 await roster.getByLabel('Preparer email',{exact:true}).fill(`${profile.first.toLowerCase()}@example.test`)
 await roster.getByLabel('Preparer identity and contact verification evidence',{exact:true}).fill('Synthetic preparer identity and private contact verified for Morgan Browser.')
 await roster.getByRole('checkbox',{name:'I verified this intended recipient',exact:false}).check()
 await roster.getByRole('button',{name:'Create private preparer invitation',exact:true}).click()
 const link=roster.getByRole('textbox',{name:'Private preparer link',exact:false})
 await expect(link).toBeVisible()
 const invitation=new URL(await link.inputValue())
 expect(invitations.some(saved=>saved.href===invitation.href)).toBe(false)
 invitations.push({...profile,href:invitation.href})
 }
 const complete=roster.getByRole('checkbox',{name:'I confirmed this list includes every preparer',exact:false})
 await expect(complete).toBeDisabled()
 for(const [index,profile] of invitations.entries()){
 const guestContext=await admin.context().browser()!.newContext({viewport:{width:390,height:950}})
 const guest=await guestContext.newPage(),errors:string[]=[]
 guest.on('pageerror',error=>errors.push(error.message))
 try{
  await guestContext.route('**/api/payroll/preparer/**',async route=>{
   const url=new URL(route.request().url())
   await route.fulfill({response:await route.fetch({url:`${apiUrl}${url.pathname}${url.search}`,maxRetries:route.request().method()==='GET'?2:0})})
  })
  await guest.goto(profile.href)
  await expect(guest.getByRole('heading',{name:'I-9 preparer / translator certification',exact:true})).toBeVisible()
  await expect(guest.getByText(`This invitation is for ${profile.first} ${profile.last}`,{exact:false})).toBeVisible()
  expect(guest.url()).not.toContain('#access=')
  expect(await guest.evaluate(()=>localStorage.getItem('adminToken'))).toBeNull()
  for(const [label,value] of [['Preparer first name',profile.first],['Preparer last name',profile.last],['Preparer street address','20 Example Road'],['Preparer city or town','Bowie'],['Preparer state','MD'],['Preparer ZIP code','20715']])await guest.getByLabel(label,{exact:true}).fill(value)
  await guest.getByRole('button',{name:'Prepare my Supplement A',exact:true}).click()
  await expect(guest.getByRole('status')).toContainText('Page 1 of 1 displayed and review visit saved.')
  const sign=guest.getByRole('button',{name:'Sign my Supplement A',exact:true})
  await expect(sign).toBeDisabled()
  await guest.getByRole('checkbox',{name:'I am the intended preparer',exact:false}).check()
  await guest.getByLabel('Preparer electronic signature',{exact:true}).fill(`${profile.first} ${profile.last}`)
  await sign.click();await expect(guest.getByRole('status')).toContainText('Your Supplement A was signed')
  await guest.reload();await expect(guest.getByRole('status')).toContainText('Your Supplement A was signed')
  await guest.screenshot({path:`/tmp/payroll-native-preparer-${index+1}-receipt.png`})
  expect(errors).toEqual([])
 }finally{await guestContext.unrouteAll({behavior:'wait'});await guestContext.close()}
 await roster.getByRole('button',{name:'Refresh preparer certifications',exact:true}).click()
 await expect(roster).toContainText('Signed')
 if(index<invitations.length-1)await expect(complete).toBeDisabled()
 }
 await complete.check()
}
