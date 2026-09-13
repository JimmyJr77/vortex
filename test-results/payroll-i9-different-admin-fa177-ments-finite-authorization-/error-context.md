# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: payroll-i9-different.spec.ts >> admin signs different replacement documents (finite authorization)
- Location: tests/e2e/payroll-i9-different.spec.ts:4:44

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('region', { name: 'Different-document replacement workspace', exact: true }).getByRole('region', { name: 'Replacement document B copies', exact: true }).getByRole('region', { name: 'Official replacement document B copy page review', exact: true }).getByRole('status')
Expected substring: "Page 2 of 2 displayed and review visit saved."
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 30000ms
  - waiting for getByRole('region', { name: 'Different-document replacement workspace', exact: true }).getByRole('region', { name: 'Replacement document B copies', exact: true }).getByRole('region', { name: 'Official replacement document B copy page review', exact: true }).getByRole('status')
    3 × locator resolved to <p role="status" class="text-sm">Loading page…</p>
      - unexpected value "Loading page…"

```

```yaml
- banner:
  - text: Payroll operations
  - heading "Hire, onboard, and manage your team." [level=1]
  - paragraph: Employees, onboarding, schedules, time records, payroll previews, compliance sources, and accounting exports in one audit trail.
  - text: Setup readiness 89%
  - paragraph: Authorized ACH payments can be submitted from approved runs. Tax filings and payment settlement reconciliation remain separate.
- navigation "Payroll sections":
  - button "Overview"
  - button "Requests & approvals"
  - button "Employer setup"
  - button "People & onboarding"
  - button "Daily time"
  - button "Schedules"
  - button "Pay setup & leave"
  - button "Payroll runs"
  - button "Compliance"
  - button "Reports & QuickBooks"
- heading "New employee setup" [level=3]
- paragraph: Creates an onboarding record; it does not make the person payroll-ready.
- text: Employee number
- textbox "Employee number":
  - /placeholder: EMP-002
- text: Hire date
- textbox "Hire date"
- text: Legal first name
- textbox "Legal first name"
- text: Legal middle name
- textbox "Legal middle name"
- text: Legal last name
- textbox "Legal last name"
- text: Preferred name
- textbox "Preferred name"
- text: Personal email
- textbox "Personal email"
- text: Phone
- textbox "Phone"
- text: Job title
- textbox "Job title":
  - /placeholder: Gymnastics instructor
- text: Pay basis
- combobox "Pay basis":
  - option "Hourly" [selected]
  - option "Salary"
- text: Hourly rate
- spinbutton "Hourly rate"
- text: Work state
- textbox "Work state": MD
- text: Residence state
- textbox "Residence state": MD
- text: Primary work location
- textbox "Primary work location": 4961 Tesla Dr, Suite E, Bowie, MD 20715
- button "Create onboarding record"
- paragraph: Starter packet
- link "Federal Form W-4":
  - /url: https://www.irs.gov/pub/irs-pdf/fw4.pdf
- link "USCIS Form I-9 and instructions":
  - /url: https://www.uscis.gov/i-9
- link "Maryland Form MW507":
  - /url: https://www.marylandcomptroller.gov/forms/current_forms/MW507.pdf
- link "Maryland sick and safe leave materials":
  - /url: https://labor.maryland.gov/paidleave/
- paragraph: The hiring checklist tracks these forms along with wage notices, policies, emergency contacts, payment setup, and role training.
- heading "Employees" [level=3]
- paragraph: Select an employee to review their onboarding packet and manage access.
- button "Monthly Benefits MONTHLY-BENEFITS · Employee · $25.00/hr ACTIVE":
  - paragraph: Monthly Benefits
  - paragraph: MONTHLY-BENEFITS · Employee · $25.00/hr
  - text: ACTIVE
- heading "Monthly onboarding" [level=3]
- paragraph: Record status only after the underlying form or provider confirmation exists.
- paragraph: Employee self-service invitation
- paragraph: Creates a one-time seven-day link. Redemption starts a revocable 30-day session; only token hashes are stored.
- textbox "Employee invitation email":
  - /placeholder: employee@example.com
- button "Create link" [disabled]
- button "Create & email" [disabled]
- region "Employee filing identity":
  - heading "Employee filing identity" [level=3]
  - paragraph: Store the legal identity and US mailing address used for tax documents. A correction creates a new retained revision. Full identifiers are encrypted and are not displayed in history.
  - button "Open filing identity"
- region "Employee direct deposit account":
  - heading "Employee direct deposit account" [level=2]
  - paragraph: Employees can add and verify their bank account in Onboarding, then authorize wage deposits. You can also link an existing verified provider account after reviewing ownership evidence.
  - button "Refresh employee payment account"
  - paragraph: Employee has not started bank enrollment.
  - paragraph: No provider account linked.
  - paragraph: Configure the employer payment connection in Employer setup first.
  - group "Link verified provider account":
    - text: Link verified provider account Employee provider account ID
    - textbox "Employee provider account ID" [disabled]
    - text: Account ownership review reference
    - textbox "Account ownership review reference" [disabled]
    - checkbox "I reviewed the evidence linking this provider account to this employee." [disabled]
    - text: I reviewed the evidence linking this provider account to this employee.
    - button "Link employee payment account" [disabled]
  - region "Bank enrollment history":
    - heading "Bank enrollment history" [level=3]
    - paragraph: Review earlier accounts and check saved operations. Status checks do not send deposits or change wage authorization.
    - button "Review enrollment history"
- region "Employee check recipient":
  - heading "Check recipient" [level=3]
  - paragraph: Prepare this employee’s legal check name and provider recipient. These steps do not issue a check or deliver wages.
  - button "Refresh check recipient"
  - paragraph: "Employer setup: NOT CONFIGURED"
  - group "Review recipient name":
    - text: Review recipient name Legal name on check
    - textbox "Legal name on check" [disabled]: Monthly Benefits
    - text: Check recipient review reference
    - textbox "Check recipient review reference" [disabled]
    - checkbox "I reviewed this employee’s legal check name and authorize recipient setup." [disabled]
    - text: I reviewed this employee’s legal check name and authorize recipient setup.
    - button "Save check recipient" [disabled]
- region "Employment history":
  - heading "Employment history" [level=3]
  - paragraph: Recorded hire and separation dates define when work can be scheduled or entered.
  - list:
    - listitem:
      - paragraph: 2026-09-01 through no end recorded
      - paragraph: Employment period 3
- region "Unused PTO payout":
  - heading "Unused PTO payout" [level=2]
  - paragraph: Review the vacation payout policy communicated at hiring and its applicable hourly payout rate. Salary alone does not establish that rate.
  - group:
    - text: PTO minutes to pay out
    - spinbutton "PTO minutes to pay out"
    - paragraph: 60 minutes equals one hour. Enter exact minutes to include partial-hour balances.
    - text: Reviewed PTO payout rate ($/hour)
    - spinbutton "Reviewed PTO payout rate ($/hour)"
    - text: PTO payout policy evidence
    - textbox "PTO payout policy evidence"
    - checkbox "I verified the communicated payout policy and applicable rate."
    - text: I verified the communicated payout policy and applicable rate.
    - checkbox "This pays unused vacation/PTO and is not an attendance bonus."
    - text: This pays unused vacation/PTO and is not an attendance bonus.
    - button "Calculate PTO payout"
- heading "Hiring checklist & review" [level=2]
- paragraph: Each submission is saved and reviewed by your hiring admin. Save progress on unfinished steps and return later. Only submitted steps are ready for admin review.
- button "Refresh checklist"
- paragraph: 4 of 13 steps complete
- progressbar "Onboarding progress"
- paragraph: "Next: Personal details & emergency contact"
- navigation "Onboarding next steps":
  - heading "Hiring review next steps" [level=3]
  - 'button "Continue: State new-hire report"'
  - list:
    - listitem:
      - button "Personal details & emergency contact"
      - paragraph: Employee submission needed.
    - listitem:
      - button "Federal Form W-4"
      - paragraph: Employee submission needed.
    - listitem:
      - button "State withholding certificate"
      - paragraph: Employee submission needed.
    - listitem:
      - button "Offer & wage notice acknowledgment"
      - paragraph: Employee submission needed.
    - listitem:
      - button "Handbook & leave policy acknowledgment"
      - paragraph: Employee submission needed.
    - listitem:
      - button "Availability & first-day planning"
      - paragraph: Employee submission needed.
    - listitem:
      - button "State new-hire report"
      - paragraph: Hiring admin action required.
    - listitem:
      - button "Role training & safeguarding"
      - paragraph: Hiring admin action required.
    - listitem:
      - button "First shift & access ready"
      - paragraph: Hiring admin action required.
- group:
  - text: Personal details & emergency contact OPEN Employee · due 2026-09-01
  - paragraph: Confirm your legal name, home address, phone, and emergency contact.
  - text: Review evidence / instructions
  - textbox "Review evidence / instructions":
    - /placeholder: Verification performed, confirmation reference, or changes needed
  - button "Verify & complete" [disabled]
  - button "Request changes" [disabled]
  - region "Onboarding revision history":
    - button "View saved history"
- group: Federal Form W-4 OPEN Employee · due 2026-09-01
- group: State withholding certificate OPEN Employee · due 2026-09-01
- group: Form I-9 employee section COMPLETE Employee · due 2026-09-01
- group: Payment election COMPLETE Employee · due 2026-09-01
- group: Offer & wage notice acknowledgment OPEN Employee · due 2026-09-01
- group: Handbook & leave policy acknowledgment OPEN Employee · due 2026-09-01
- group: Availability & first-day planning OPEN Employee · due 2026-09-01
- group:
  - text: Employer I-9 review COMPLETE Hiring admin · due 2026-09-04
  - paragraph: Examine the employee-selected acceptable documents and complete employer Section 2. Record the signed form or secure-provider reference.
  - paragraph: "Admin review: Employer signed the current retained I-9 packet and examination record."
  - term: i9EmployerSignedAt
  - definition: 2026-09-13T07:30:08.408Z
  - term: i9EmployerDocumentId
  - definition: "3"
  - term: i9EmployerSignatureId
  - definition: "1"
  - term: i9EmployeeSubmissionId
  - definition: "1"
  - list:
    - listitem:
      - button "Form-I9-employer-signed.pdf"
    - listitem:
      - button "I9-A1-copy-bb882754.pdf"
  - region "Retained employer I-9 evidence":
    - heading "Signed employer evidence and follow-ups" [level=3]
    - paragraph: Reopen the examiner’s retained findings and signed documents here. Follow-up status is tracked separately from the original certification.
    - button "Refresh signed employer evidence"
    - group:
      - text: Current certification · cycle 1 · 2026-09-13T07:30:08.408Z
      - paragraph: "Signed by Reviewer Alice. Examination: 2026-09-01. Completion due: 2026-09-04. Signed after the recorded deadline."
      - blockquote: I attest, under penalty of perjury, that (1) I have examined the documentation presented by the above-named employee, (2) the above-listed documentation appears to be genuine and to relate to the employee named, and (3) to the best of my knowledge, the employee is authorized to work in the United States.
      - paragraph:
        - strong: "Examiner identity and authority:"
        - text: Authenticated hiring admin performed the synthetic examination.
      - paragraph: "Business days: Monday, Tuesday, Wednesday, Thursday, Friday. Closures: None recorded."
      - paragraph:
        - strong: "Late-completion explanation:"
        - text: Historical synthetic fixture certified at the actual current date.
      - button "Download signed employer I-9"
      - 'heading "Document A1: receipt" [level=4]'
      - paragraph: "Form notation: RA 09/01/2026: Synthetic lost document replacement receipt."
      - paragraph: "Rule evidence: Synthetic lost-document receipt retained for replacement by November 30, 2026."
      - link "Examiner’s official rule reference":
        - /url: https://www.uscis.gov/i-9-central
      - paragraph: "Recorded follow-up: receipt replacement · 2026-11-30"
      - button "Download document A1 copy 1 (2 page(s))"
      - heading "Associated compliance tasks" [level=4]
      - paragraph: I-9 document follow-up · open · due 2026-11-30
      - paragraph: Review the retained examination for employer certification 1, document row A1. Complete the required document follow-up and retain the resulting I-9 evidence.
      - region "Receipt replacement workspace":
        - button "Replace receipt with actual document"
      - region "Different-document replacement workspace":
        - heading "Different replacement documents" [level=4]
        - paragraph: Record the acceptable documents the employee chose. The new certification stays with the original signed I-9.
        - button "Reload saved replacement"
        - button "Save replacement draft"
        - status: Draft restored. Signatures, consent and copy selections require fresh review.
        - paragraph: "Receipt row A1; due 2026-11-30. Original first day employed: 2026-09-01."
        - group:
          - text: Replacement document combination
          - combobox "Replacement document combination":
            - option "Choose documents presented"
            - option "List A"
            - option "List B and List C" [selected]
          - group "List B document":
            - text: List B document List B document — Document title
            - textbox "List B document — Document title": Synthetic document
            - text: List B document — Issuing authority
            - textbox "List B document — Issuing authority": Synthetic issuer
            - text: List B document — Document number
            - textbox "List B document — Document number": SYNTHETIC-B
            - text: List B document — Expiration (if any)
            - textbox "List B document — Expiration (if any)": 2030-01-01
          - group "List C document":
            - text: List C document List C document — Document title
            - textbox "List C document — Document title": Synthetic document
            - text: List C document — Issuing authority
            - textbox "List C document — Issuing authority": Synthetic issuer
            - text: List C document — Document number
            - textbox "List C document — Document number": SYNTHETIC-C
            - text: List C document — Expiration (if any)
            - textbox "List C document — Expiration (if any)": 2030-01-01
          - text: Replacement examination method
          - combobox "Replacement examination method":
            - option "Choose examination method"
            - option "Physical examination" [selected]
            - option "Authorized alternative procedure"
          - text: Replacement examiner name and title
          - textbox "Replacement examiner name and title": Reviewer Alice, Hiring Administrator
          - text: Employer business name
          - textbox "Employer business name": Synthetic Employer
          - text: Employer business address
          - textbox "Employer business address": 20 Example Road, Bowie, MD 20715
          - text: Reason for different replacement documents
          - textbox "Reason for different replacement documents": Employee selected different acceptable documents after the original receipt.
          - text: Replacement examiner initials
          - textbox "Replacement examiner initials": RA
          - text: Additional replacement information
          - textbox "Additional replacement information"
          - button "Prepare replacement certification"
  - text: Review evidence / instructions
  - textbox "Review evidence / instructions":
    - /placeholder: Verification performed, confirmation reference, or changes needed
  - button "Verify & complete" [disabled]
  - button "Request changes" [disabled]
  - region "Onboarding revision history":
    - button "View saved history"
- group: State new-hire report OPEN Hiring admin · due 2026-09-21
- group: Pay, classification & benefits review COMPLETE Hiring admin · due 2026-09-01
- group: Role training & safeguarding OPEN Hiring admin · due 2026-09-01
- group: First shift & access ready OPEN Hiring admin · due 2026-09-01
```

# Test source

```ts
  1   | import {test,expect} from '@playwright/test'
  2   | import {createHarness} from '../../backend/payroll/testing/harness.js'
  3   | import {receiptFixture} from '../../backend/payroll/testing/receiptFixture.js'
  4   | for(const authorizedWorker of [false,true])test(`admin signs different replacement documents (${authorizedWorker?'finite authorization':'citizen'})`,async({page})=>{
  5   |  test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000);page.setDefaultTimeout(15000)
  6   |  const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='96'.repeat(32)
  7   |  const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  8   |  try{
  9   |   const {pdf}=await receiptFixture(h,{authorizedWorker})
  10  |   await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  11  |   let failContext=true,loseUpload=true,loseSign=true
  12  |   await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());if(failContext&&u.pathname.includes('/different-documents/')&&u.pathname.endsWith('/context')){failContext=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic context outage.'})});return}const response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0});if(loseUpload&&route.request().method()==='POST'&&u.pathname.includes('/different-documents/')&&u.pathname.endsWith('/copies')){expect(response.status()).toBe(200);loseUpload=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic upload response lost.'})});return}if(loseSign&&u.pathname.includes('/different-documents/')&&u.pathname.endsWith('/sign')){expect(response.status()).toBe(200);loseSign=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic signing response lost.'})});return}await route.fulfill({response})})
  13  |   await page.setViewportSize({width:1100,height:950})
  14  |   await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Employer I-9 review'}).click()
  15  |   const records=page.getByRole('region',{name:'Retained employer I-9 evidence',exact:true});await records.locator('summary').filter({hasText:'Current certification'}).click()
  16  |   await records.getByRole('button',{name:'Prepare different replacement documents',exact:true}).click()
  17  |   const work=page.getByRole('region',{name:'Different-document replacement workspace',exact:true})
  18  |   await expect(work.getByRole('alert')).toContainText('Synthetic context outage.')
  19  |   await work.getByRole('button',{name:'Reload saved replacement',exact:true}).click()
  20  |   await expect(work.getByLabel('Employer business name',{exact:true})).not.toHaveValue('')
  21  |   await expect(work.getByLabel('Replacement examiner name and title',{exact:true})).toHaveValue('')
  22  |   await work.getByLabel('Replacement document combination',{exact:true}).selectOption('LIST_B_C')
  23  |   for(const row of ['B','C'])for(const [label,value] of [['Document title','Synthetic document'],['Issuing authority','Synthetic issuer'],['Document number',`SYNTHETIC-${row}`],['Expiration (if any)','2030-01-01']])await work.getByLabel(`List ${row} document — ${label}`,{exact:true}).fill(value)
  24  |   await work.getByLabel('Replacement examination method',{exact:true}).selectOption('PHYSICAL')
  25  |   await work.getByLabel('Replacement examiner name and title',{exact:true}).fill('Reviewer Alice, Hiring Administrator')
  26  |   await work.getByLabel('Reason for different replacement documents',{exact:true}).fill('Employee selected different acceptable documents after the original receipt.')
  27  |   await work.getByLabel('Replacement examiner initials',{exact:true}).fill('RA')
  28  |   await work.getByRole('button',{name:'Save replacement draft',exact:true}).click()
  29  |   await expect(work.getByRole('status')).toContainText('Private draft saved')
  30  |   await work.getByLabel('Reason for different replacement documents',{exact:true}).fill('Unsaved changes should be discarded on explicit reload.')
  31  |   await work.getByRole('button',{name:'Reload saved replacement',exact:true}).click()
  32  |   await expect(work.getByLabel('Reason for different replacement documents',{exact:true})).toHaveValue('Employee selected different acceptable documents after the original receipt.')
  33  |   await work.getByRole('button',{name:'Prepare replacement certification',exact:true}).click()
  34  |   for(const [title,count] of [['Review new replacement certification',2],['Review original employer I-9',4],['Review original employee I-9',4]] as const){
  35  |    const viewer=work.getByRole('region',{name:`Official ${title} page review`,exact:true})
  36  |    for(let n=1;n<=count;n++){
  37  |     await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click()
  38  |     await expect(viewer.getByRole('status')).toContainText(`Page ${n} of ${count} displayed and review visit saved.`,{timeout:30000})
  39  |    }
  40  |   }
  41  |   expect((await h.pool.query('SELECT * FROM payroll_i9_different_page_visit')).rowCount).toBe(10)
  42  |   for(const row of ['B','C']){
  43  |    const copies=work.getByRole('region',{name:`Replacement document ${row} copies`,exact:true})
  44  |    await copies.getByLabel('Replacement document copy (PDF, PNG or JPEG, up to 5 MB)',{exact:true}).setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:pdf})
  45  |    await copies.getByRole('button',{name:'Retain replacement copy',exact:true}).click()
  46  |    if(row==='B'){await expect(copies.getByRole('alert')).toContainText('Synthetic upload response lost.');await copies.getByRole('button',{name:'Retain replacement copy',exact:true}).click()}
  47  |    await copies.getByRole('checkbox',{name:'Use replacement copy 1',exact:true}).check()
  48  |    await copies.getByRole('button',{name:'Review replacement copy 1 (2 pages)',exact:true}).click()
  49  |    const viewer=copies.getByRole('region',{name:`Official replacement document ${row} copy page review`,exact:true})
  50  |    for(let n=1;n<=2;n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of 2 displayed and review visit saved.`,{timeout:30000})}
  51  |   }
  52  |   expect((await h.pool.query('SELECT * FROM payroll_i9_different_copy')).rowCount).toBe(2)
  53  |   expect((await h.pool.query('SELECT * FROM payroll_i9_different_copy_page')).rowCount).toBe(4)
  54  | 
  55  |   await page.screenshot({path:'/tmp/payroll-different-workspace-desktop.png',fullPage:true})
  56  |   await page.setViewportSize({width:390,height:844})
  57  |   expect(await work.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  58  |   await work.getByRole('heading',{name:'Different replacement documents',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/payroll-different-workspace-mobile.png'})
  59  |   const exam=work.getByRole('region',{name:'Replacement examination and signing',exact:true})
  60  |   await exam.getByLabel('Replacement examiner identity and authority',{exact:true}).fill('Authenticated examiner personally examined the replacement originals.')
  61  |   await exam.getByLabel('Originals examined in the employee’s physical presence',{exact:true}).selectOption('yes')
  62  |   await exam.getByLabel('Employment lasts fewer than three business days',{exact:true}).selectOption('no')
  63  |   for(const day of ['Monday','Tuesday','Wednesday','Thursday','Friday'])await exam.getByRole('checkbox',{name:day,exact:true}).check()
  64  |   await exam.getByLabel('Current employment authorization is indefinite',{exact:true}).selectOption(authorizedWorker?'no':'yes')
  65  |   if(authorizedWorker)await exam.getByLabel('Current employment authorization expiration (if finite)',{exact:true}).fill('2030-01-01')
  66  |   await exam.getByLabel('Current employment authorization evidence',{exact:true}).fill('Reviewed current employment authorization and acceptable replacement documentation.')
  67  |   for(const label of ['I confirmed the employer business calendar','These are different acceptable documents replacing the receipt','The employee chose the replacement documents','I reviewed the current Section 1 and preparer certifications','The originals reasonably appear genuine and relate to this employee'])await exam.getByRole('checkbox',{name:label,exact:true}).check()
  68  |   for(const row of ['B','C']){
  69  |    await exam.getByRole('checkbox',{name:`Document ${row}: selected copies include every required side and page`,exact:true}).check()
  70  |    await exam.getByRole('checkbox',{name:`Document ${row}: acceptable for the selected list or combination`,exact:true}).check()
  71  |    await exam.getByLabel(`Document ${row}: Acceptance`,{exact:true}).selectOption('STANDARD')
  72  |    await exam.getByLabel(`Document ${row}: Next action`,{exact:true}).selectOption(authorizedWorker&&row==='C'?'REVERIFICATION':'NONE')
  73  |    if(authorizedWorker&&row==='C'){await exam.getByLabel(`Document ${row}: Next action date`,{exact:true}).fill('2030-01-01');await exam.getByLabel(`Document ${row}: Official rule URL`,{exact:true}).fill('https://www.uscis.gov/i-9-central');await exam.getByLabel(`Document ${row}: Acceptance and follow-up evidence`,{exact:true}).fill('Examiner verified the current employment authorization deadline.')}else await exam.getByRole('checkbox',{name:`Document ${row}: no follow-up is required`,exact:true}).check()
  74  |   }
  75  |   const consent=['I read and agree to the replacement employer certification','I am the examiner who performed this replacement examination','I reviewed every packet and selected copy page','My identity and authority as the named replacement examiner are confirmed']
  76  |   for(const label of consent)await exam.getByRole('checkbox',{name:label,exact:true}).check()
  77  |   await exam.getByLabel('Replacement examiner electronic signature',{exact:true}).fill('Reviewer Alice')
  78  |   await exam.getByLabel('Current employment authorization evidence',{exact:true}).fill('Verified current employment authorization against the retained replacement documentation.')
  79  |   await expect(exam.getByRole('checkbox',{name:consent[0],exact:true})).not.toBeChecked()
  80  |   await expect(exam.getByLabel('Replacement examiner electronic signature',{exact:true})).toHaveValue('')
  81  |   for(const label of consent)await exam.getByRole('checkbox',{name:label,exact:true}).check()
  82  |   await exam.getByLabel('Replacement examiner electronic signature',{exact:true}).fill('Reviewer Alice')
  83  |   await work.getByRole('button',{name:'Save replacement draft',exact:true}).click()
  84  |   await expect(work.getByRole('status').filter({hasText:'Private draft saved'})).toBeVisible()
  85  |   await work.getByRole('button',{name:'Reload saved replacement',exact:true}).click()
  86  |   await expect(work.getByRole('status')).toContainText('Draft restored.')
  87  |   await work.getByRole('button',{name:'Prepare replacement certification',exact:true}).click()
  88  |   for(const [title,count] of [['Review new replacement certification',2],['Review original employer I-9',4],['Review original employee I-9',4]] as const){
  89  |    const viewer=work.getByRole('region',{name:`Official ${title} page review`,exact:true})
  90  |    for(let n=1;n<=count;n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of ${count} displayed and review visit saved.`,{timeout:30000})}
  91  |   }
  92  |   for(const row of ['B','C']){
  93  |    const copies=work.getByRole('region',{name:`Replacement document ${row} copies`,exact:true})
  94  |    await expect(copies.getByRole('checkbox',{name:'Use replacement copy 1',exact:true})).not.toBeChecked()
  95  |    await copies.getByRole('checkbox',{name:'Use replacement copy 1',exact:true}).check()
  96  |    await copies.getByRole('button',{name:'Review replacement copy 1 (2 pages)',exact:true}).click()
  97  |    const viewer=copies.getByRole('region',{name:`Official replacement document ${row} copy page review`,exact:true})
> 98  |    for(let n=1;n<=2;n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of 2 displayed and review visit saved.`,{timeout:30000})}
      |                                                                                                                                          ^ Error: expect(locator).toContainText(expected) failed
  99  |   }
  100 |   await expect(exam.getByLabel('Current employment authorization evidence',{exact:true})).toHaveValue('Verified current employment authorization against the retained replacement documentation.')
  101 |   await expect(exam.getByRole('checkbox',{name:'Monday',exact:true})).toBeChecked()
  102 |   await expect(exam.getByLabel('Replacement examiner electronic signature',{exact:true})).toHaveValue('')
  103 |   await expect(exam.getByRole('checkbox',{name:consent[0],exact:true})).not.toBeChecked()
  104 |   for(const label of ['I confirmed the employer business calendar','These are different acceptable documents replacing the receipt','The employee chose the replacement documents','I reviewed the current Section 1 and preparer certifications','The originals reasonably appear genuine and relate to this employee'])await exam.getByRole('checkbox',{name:label,exact:true}).check()
  105 |   for(const row of ['B','C']){
  106 |    await exam.getByRole('checkbox',{name:`Document ${row}: selected copies include every required side and page`,exact:true}).check()
  107 |    await exam.getByRole('checkbox',{name:`Document ${row}: acceptable for the selected list or combination`,exact:true}).check()
  108 |    if(!authorizedWorker||row==='B')await exam.getByRole('checkbox',{name:`Document ${row}: no follow-up is required`,exact:true}).check()
  109 |   }
  110 |   for(const label of consent)await exam.getByRole('checkbox',{name:label,exact:true}).check()
  111 |   await exam.getByLabel('Replacement examiner electronic signature',{exact:true}).fill('Reviewer Alice')
  112 |   await exam.screenshot({path:'/tmp/payroll-different-examination-ui.png'})
  113 |   await exam.getByRole('button',{name:'Sign replacement certification',exact:true}).click()
  114 |   await expect(exam.getByRole('alert')).toContainText('Synthetic signing response lost.')
  115 |   await exam.getByRole('button',{name:'Sign replacement certification',exact:true}).click()
  116 |   const history=records.locator('details').filter({has:page.locator('summary').filter({hasText:'Signed different-document replacement'})}).last()
  117 |   await history.locator('summary').click()
  118 |   await expect(history).toContainText(authorizedWorker?'Recorded authorization: through 2030-01-01.':'Recorded authorization: indefinite.')
  119 |   const download=page.waitForEvent('download');await history.getByRole('button',{name:'Download signed different-document certification',exact:true}).click()
  120 |   await (await download).saveAs('/tmp/payroll-different-ui-signed.pdf')
  121 |   expect((await h.pool.query('SELECT * FROM payroll_i9_different_signature')).rowCount).toBe(1)
  122 |   const followups=(await h.pool.query("SELECT kind,due_on::text FROM payroll_i9_signature_followup WHERE row_key LIKE 'DIFFERENT:%'")).rows
  123 |   expect(followups).toEqual(authorizedWorker?[{kind:'REVERIFICATION',due_on:'2030-01-01'}]:[])
  124 |   await expect(records.getByRole('button',{name:'Prepare different replacement documents',exact:true})).toHaveCount(0)
  125 |   expect(errors).toEqual([])
  126 |  }finally{
  127 |   await page.unrouteAll({behavior:'wait'}).catch(()=>{});await page.close().catch(()=>{});await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old
  128 |  }
  129 | })
  130 | 
```