import {expect,type Page} from '@playwright/test'
import {nativeW4,nativeMW507,nativeI9,nativeEmployerI9} from './nativePayrollJourney'

export async function nativeJourneyRehireCompletion(admin:Page,employee:Page,number:string,startDate:string,acceptedOn:string,pdf:Buffer){
 const profile=employee.locator('details').filter({has:employee.locator('summary',{hasText:'Personal details & emergency contact'})})
 for(const [label,value] of Object.entries({'Legal first name':'Morgan','Legal last name':'Browser','Home street address':'2 Test Street','City':'Bowie','State':'MD','ZIP code':'20715','Phone':'5550100201','Emergency contact name':'Taylor','Emergency contact phone':'5550100202','Relationship':'Friend'}))await profile.getByLabel(label,{exact:true}).fill(value)
 await profile.getByRole('button',{name:'Submit for review'}).click()
 await expect(employee.getByRole('status')).toHaveText('Step submitted for review.')
 await employee.screenshot({path:'/tmp/payroll-employee-mobile.png',fullPage:true})
 await admin.reload();await admin.getByRole('button',{name:'People & onboarding',exact:true}).click();await admin.getByRole('button',{name:new RegExp(number)}).click()
 const review=admin.locator('details').filter({has:admin.locator('summary',{hasText:'Personal details & emergency contact'})})
 await expect(review.getByText('2 Test Street',{exact:true})).toBeVisible()
 await review.getByLabel('Review evidence / instructions').fill('Verified legal name and emergency contact details.')
 await review.getByRole('button',{name:'Verify & complete'}).click()
 await expect(review.locator('summary')).toContainText('COMPLETE')
 await admin.screenshot({path:'/tmp/payroll-admin-review.png',fullPage:true})
 await admin.locator('summary').filter({hasText:'Form I-9 employee section'}).click()
 const hiring=admin.getByRole('region',{name:'I-9 hiring context',exact:true})
 await hiring.getByLabel('Offer accepted on',{exact:true}).fill(acceptedOn)
 await hiring.getByRole('combobox',{name:'Employer and hiring-site E-Verify participation',exact:true}).selectOption('false')
 await hiring.getByLabel('Offer and participation verification evidence',{exact:true}).fill('Synthetic accepted offer and hiring-site participation verified for this new hire.')
 await hiring.getByRole('checkbox').check()
 await hiring.getByRole('button',{name:'Record I-9 hiring context',exact:true}).click()
 await expect(hiring.getByRole('status')).toContainText('I-9 hiring context recorded.')
 await employee.goto('/tests/support/payroll.html?employee=1')
 await employee.getByRole('button',{name:'Onboarding',exact:true}).click()
 for (const title of ['Federal Form W-4','State withholding certificate','Form I-9 employee section','Payment election','Offer & wage notice acknowledgment','Handbook & leave policy acknowledgment','Availability & first-day planning']) {
  const step=employee.locator('details').filter({has:employee.locator('summary',{hasText:title})})
  await step.locator('summary').first().click()
  if(title==='Federal Form W-4'){await nativeW4(employee);continue}
  if(title==='State withholding certificate'){await nativeMW507(employee);continue}
  if(title==='Form I-9 employee section'){await nativeI9(employee,false);continue}
  if (title==='Payment election') await step.getByLabel('Payment method').selectOption('CHECK')
  else if (title.includes('acknowledgment')) { await step.getByLabel('Your full name').fill('Morgan Browser');await step.getByRole('checkbox').check() }
  else await step.getByLabel('Availability & first-day questions').fill('Weekday mornings; ready for orientation.')
  await step.getByRole('button',{name:'Submit for review',exact:true}).click()
  await expect(step.locator('summary').first()).toContainText('SUBMITTED')
 }
 const benefitsStep=employee.locator('details').filter({has:employee.getByText('Pay, classification & benefits review',{exact:true})})
 await benefitsStep.locator('summary').first().click()
 await benefitsStep.getByLabel('Your benefits choice',{exact:true}).selectOption('ENROLL')
 await benefitsStep.getByLabel('Benefits choice signature',{exact:true}).fill('Morgan Browser')
 await benefitsStep.getByLabel('I read the displayed benefits offering and confirm this choice with my typed name.',{exact:true}).check()
 await benefitsStep.getByRole('button',{name:'Submit benefits choice',exact:true}).click()
 await expect(employee.getByRole('status')).toHaveText('Benefits choice submitted to your hiring admin.')
 await admin.getByRole('button',{name:'Schedules',exact:true}).click()
 await admin.getByLabel('Starts',{exact:true}).fill(`${startDate}T09:00`)
 await admin.getByLabel('Ends',{exact:true}).fill(`${startDate}T13:00`)
 await admin.getByRole('button',{name:'Schedule shift',exact:true}).click()
 await expect(admin.getByText('Shift scheduled.',{exact:true})).toBeVisible()
 await admin.getByRole('button',{name:'People & onboarding',exact:true}).click()
 await admin.getByRole('button',{name:new RegExp(number)}).click()
 // Switching back reloads the employee packet after employee submissions.
 await admin.reload();await admin.getByRole('button',{name:'People & onboarding',exact:true}).click();await admin.getByRole('button',{name:new RegExp(number)}).click()
 for (const title of ['Federal Form W-4','State withholding certificate','Form I-9 employee section','Payment election','Offer & wage notice acknowledgment','Handbook & leave policy acknowledgment','Availability & first-day planning','Employer I-9 review','State new-hire report','Pay, classification & benefits review','Role training & safeguarding','First shift & access ready']) {
  if(title==='Pay, classification & benefits review'){
   await admin.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
   await expect(admin.getByLabel('MW507 exemptions',{exact:true})).toHaveValue('1')
   await expect(admin.getByLabel('MW507 exemptions',{exact:true})).toBeDisabled()
   await admin.getByRole('textbox',{name:'Certificate correctness and revocation evidence',exact:true}).fill('Reviewed the native signed certificate and employer correspondence.')
   await admin.getByRole('textbox',{name:'Residence and local-rate evidence',exact:true}).fill('Verified Maryland residence and applicable synthetic local rate.')
   for(const prefix of ['I reviewed the signed certificate','I checked the employer’s Comptroller correspondence','I verified Maryland work and residence'])await admin.getByRole('checkbox',{name:prefix,exact:false}).check()
   await admin.getByLabel('Verification source',{exact:true}).fill('Synthetic signed hiring W-4 and MW507 reviewed with applicable local rate')
   await admin.getByLabel('I verified these values against signed forms',{exact:false}).check()
   await admin.getByRole('button',{name:'Save verified tax elections',exact:true}).click()
   await expect(admin.getByText('Verified elections saved. New payroll drafts calculate withholding automatically.')).toBeVisible()
   await admin.getByRole('button',{name:'People & onboarding',exact:true}).click()
  }
  const step=admin.locator('details').filter({has:admin.locator('summary',{hasText:title})})
  await step.locator('summary').first().click()
  if(title==='Employer I-9 review'){await nativeEmployerI9(admin,pdf,0,{start:startDate,exam:acceptedOn});continue}
  if(title==='Pay, classification & benefits review'){
   await step.getByLabel('Benefits disposition',{exact:true}).selectOption('ENROLLED')
   await step.getByLabel('Benefits effective or eligibility date',{exact:true}).fill(startDate)
   await step.getByLabel('Benefits explanation for employee',{exact:true}).fill('Synthetic employer-paid coverage enrollment was confirmed with no employee deduction.')
   await step.getByLabel('Benefits review evidence',{exact:true}).fill('Synthetic carrier enrollment confirmation for the signed employee choice')
   await step.getByLabel('I verified the benefits disposition, effective date and supporting evidence.',{exact:true}).check()
  }
  await step.getByLabel('Review evidence / instructions').fill('Verified test evidence, signed forms, and orientation setup.')
  await step.getByRole('button',{name:'Verify & complete',exact:true}).click()
  await expect(step.locator('summary').first()).toContainText('COMPLETE')
 }
 await expect(admin.getByRole('button',{name:'Complete onboarding & activate employee'})).toBeEnabled()
 await admin.getByRole('button',{name:'Complete onboarding & activate employee'}).click()
 await expect(admin.getByText('Onboarding complete. Employee activated.',{exact:true})).toBeVisible()
 console.info('Journey: second native hiring cycle activated')
}
