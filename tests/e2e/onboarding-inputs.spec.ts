import {test,expect} from '@playwright/test'
test('phone formatting and explicit existing-account confirmation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let linked=false
 await page.route('**/api/payroll/employee/account-link',async route=>{
 if(route.request().method()==='POST'){expect(route.request().postDataJSON()).toEqual({accountToken:'synthetic-token',confirmed:true});linked=true}
 await route.fulfill({json:{success:true,data:{linked,email:linked?'existing@example.test':null}}})
 })
 await page.route('**/api/members/login',async route=>{expect(route.request().postDataJSON()).toEqual({emailOrUsername:'existing@example.test',password:'synthetic-password'});await route.fulfill({json:{success:true,token:'synthetic-token',member:{email:'existing@example.test'}}})})
 await page.goto('/tests/support/onboarding-inputs.html')
 const phone=page.getByRole('textbox',{name:'Phone',exact:true})
 await phone.pressSequentially('6175550123',{delay:30});await expect(phone).toHaveValue('617-555-0123')
 for(const value of ['617-555-0123','(617) 555-0123','+1 (617) 555-0123']){await phone.fill(value);await expect(phone).toHaveValue('617-555-0123');await expect(page.getByTestId('saved-phone')).toHaveText('617-555-0123')}
 await phone.evaluate((el:HTMLInputElement)=>el.setSelectionRange(4,4));await phone.press('Backspace');await expect(phone).toHaveValue('615-550-123')
 await phone.fill('');await phone.pressSequentially('617-555-0123',{delay:30});await expect(phone).toHaveValue('617-555-0123')
 await page.getByLabel('Vortex email or username').fill('existing@example.test');await page.getByLabel('Vortex password').fill('synthetic-password');await page.getByRole('button',{name:'Verify existing account'}).click()
 await expect(page.getByRole('button',{name:'Confirm account link'})).toBeVisible();expect(linked).toBe(false)
 await page.getByRole('button',{name:'Confirm account link'}).click();await expect(page.getByRole('region',{name:'Existing Vortex account'}).getByRole('status')).toContainText('Linked to existing@example.test')
 await page.screenshot({path:'/tmp/onboarding-inputs-verified.png',fullPage:true});expect(errors).toEqual([])
})
