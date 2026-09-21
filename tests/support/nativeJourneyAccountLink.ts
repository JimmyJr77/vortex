import {expect,type Page} from '@playwright/test'
import {createRequire} from 'node:module'
const jwt=createRequire(new URL('../../backend/package.json',import.meta.url))('jsonwebtoken')

/** Only canonical credential verification is synthetic. Payroll linking/session routes use the real harness. */
export async function nativeJourneyAccountLink(employee:Page,h:any,employeeNumber:string) {
 const email='existing-native-hire@example.test',password='Synthetic-Vortex-Account-2026'
 await h.pool.query(`CREATE TABLE app_user(id BIGINT PRIMARY KEY,facility_id BIGINT,email TEXT,is_active BOOLEAN);
 INSERT INTO app_user VALUES(101,1,'existing-native-hire@example.test',true)`)
 const accountToken=jwt.sign({userId:101,email},'synthetic-account-link-test-secret',{expiresIn:'1h'})
 await employee.context().route('**/api/members/login',async route=>{
  expect(route.request().postDataJSON()).toEqual({emailOrUsername:email,password})
  await route.fulfill({json:{success:true,token:accountToken,member:{email}}})
 })
 const section=employee.getByRole('region',{name:'Existing Vortex account'})
 await section.getByLabel('Vortex email or username').fill(email)
 await section.getByLabel('Vortex password').fill(password)
 await section.getByRole('button',{name:'Verify existing account',exact:true}).click()
 await expect(section.getByRole('button',{name:'Confirm account link',exact:true})).toBeVisible()
 expect((await h.pool.query('SELECT * FROM payroll_employee_account_link')).rowCount).toBe(0)
 await section.getByRole('button',{name:'Confirm account link',exact:true}).click()
 await expect(section.getByRole('status')).toContainText(`Linked to ${email}`)
 await employee.getByRole('button',{name:'Sign out',exact:true}).click()
 await nativeJourneyLinkedSignIn(employee)
 const link=(await h.pool.query(`SELECT e.employee_number,e.portal_password_hash,l.user_id FROM payroll_employee_account_link l JOIN payroll_employee e ON e.id=l.employee_id`)).rows[0]
 expect(link.employee_number).toBe(employeeNumber)
 expect(Number(link.user_id)).toBe(101)
 expect(link.portal_password_hash).toBeNull()
 expect((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='EMPLOYEE_ACCOUNT_SIGN_IN'")).rowCount).toBe(1)
 await employee.screenshot({path:'/tmp/payroll-native-linked-account.png',fullPage:true})
}

export async function nativeJourneyLinkedSignIn(employee:Page){
 const section=employee.getByRole('region',{name:'Existing Vortex account'})
 await section.getByLabel('Vortex email or username').fill('existing-native-hire@example.test')
 await section.getByLabel('Vortex password').fill('Synthetic-Vortex-Account-2026')
 await section.getByRole('button',{name:'Sign in with Vortex account',exact:true}).click()
 await expect(employee.getByText('Hi, Morgan')).toBeVisible()
 await expect(employee.getByRole('alert')).toHaveCount(0)
 await expect(employee.getByText('Your payroll session has ended.',{exact:false})).toHaveCount(0)
}
