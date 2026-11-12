import { expect, test, type Page } from '@playwright/test'
import { buildBillingDashboard } from '../../backend/newAdmin/billingDashboardMetrics.js'
import { summarizeMonths, summarizeQuarters, summarizeLossRates, acquisitionMetrics } from '../../backend/newAdmin/enrollmentMetrics.js'

const trend = { year: 2026, asOf: '2026-11-09', coverageStart: '2026-01-19', notes: ['Siblings and transfers count once per family.'], months: Array.from({ length: 11 }, (_, i) => ({
  key: `2026-${String(i + 1).padStart(2, '0')}`, label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'][i],
  openingFamilies: i ? 20 : null, newFamilies: i ? 4 : 20, canceledFamilies: i ? 3 : 0,
  lostFamilies: i ? 2 : null, lossRate: i ? 10 : null, partial: i === 10, provisional: i >= 7,
})) }
async function prepare(page: Page, { permission = true, failure = false, empty = false, financial = true, editable = true, saveFailure = false, legacy = false, studentHistory = true, legacyQuarterRates = false, legacyRevenue = false } = {}) {
  const rollingMonths = [{...trend.months[0],key:'2025-11',label:'Nov',newFamilies:null}, {...trend.months[0],key:'2025-12',label:'Dec',newFamilies:null}, ...trend.months.slice(0,10)]
  const current = {families:20,students:30,studentsPerFamily:1.5,classes:[{id:'1',name:'Tumbling',count:20},{id:'2',name:'Team',count:20}],genders:[{label:'Boys',count:12},{label:'Girls',count:18}],ages:[{label:'Age 8',count:30}],teams:[{label:'Team',count:20},{label:'Non-team',count:10}],membership:financial ? {monthlyRevenueCents:450000,averageMembershipCents:15000,averageFamilyMembershipCents:22500,pricedStudents:30} : null}
  const summary = summarizeMonths(rollingMonths)
  const studentRate = (row: typeof trend.months[number]) => row.lossRate == null ? null : row.partial ? 50 : row.key === '2026-10' ? 30 : 20
  const studentSummary = studentHistory ? summarizeLossRates(rollingMonths.map(row => ({lossRate: studentRate(row)}))) : undefined
  const spending = [{month:'2026-10',amount_cents:60000 as number | null,version:1}]
  const quarterMonths = [...rollingMonths, trend.months.at(-1)!]
  const quarters = summarizeQuarters(trend.asOf, quarterMonths)
  const studentQuarters = summarizeQuarters(trend.asOf, quarterMonths.map(row => ({ ...row, newFamilies: 6, canceledFamilies: 4, lossRate: studentRate(row) })))
  if (legacyQuarterRates) for (const quarter of [...quarters, ...studentQuarters]) {
    delete quarter.averageLossRate
    delete quarter.lossRateMonths
  }
  const buildData = () => ({...trend,studentMonths:trend.months.map(row=>({...row,openingStudents:30,newStudents:6,canceledStudents:4,lostStudents:3,lossRate:studentRate(row)})),studentNotes:['Students count once across all classes.'],rollingMonths,summary,studentSummary,quarters,studentQuarters,current:{...current,familyBreakdowns:{...current,ages:[{label:"Age 8",count:20}]}},acquisition:financial ? acquisitionMetrics([...rollingMonths,trend.months.at(-1)],spending,current,summary) : null,permissions:{canViewFinancial:financial,canEditMarketing:editable}})

  const requests: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.text().includes('of chart should be greater than 0')) errors.push(message.text())
  })
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Dashboard Admin', isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    requests.push(path)
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: permission ? ['members.view',...(financial ? ['billing.view'] : []),...(editable ? ['marketing.manage'] : [])] : ['classes.view'], roles: ['ADMIN'], user: { id: 1 } }
    if (path === '/api/admin/new-admin/billing-dashboard') {
      const billing = buildBillingDashboard({today:'2026-11-10',payments:[
      {id:1,amount_cents:30000,occurred_date:'2026-10-05'}, {id:2,amount_cents:9000,occurred_date:'2026-09-05'},
      {id:3,amount_cents:12000,occurred_date:'2026-11-05'}, {id:4,amount_cents:8000,occurred_date:'2025-10-05'},
    ],refunds:[{id:1,payment_id:3,amount_cents:2000,occurred_date:'2026-11-06'}, {id:2,payment_id:4,amount_cents:1000,occurred_date:'2025-10-06'}],
    allocations:[{billing_payment_id:1,amount_cents:20000,class_name:'Team',gender:'female',date_of_birth:'2016-01-01'},
      {billing_payment_id:1,amount_cents:10000,class_name:'Tumbling',gender:'male',date_of_birth:'2018-01-01'}],accounts:[
      {id:1,family_id:1,family_name:'Current Fixture',balance_cents:12000}, {id:2,family_id:2,family_name:'Overdue Fixture',balance_cents:7000},
      {id:3,family_id:3,family_name:'Credit Fixture',balance_cents:-5000},
    ],lines:[{id:1,account_id:1,open_cents:12000,service_month:'2026-11'}, {id:2,account_id:2,open_cents:7000,service_month:'2026-10'}]})
      if (legacyRevenue) {
        delete billing.quarters
        delete billing.summary.sixMonthAverageCents
        delete billing.summary.nineMonthAverageCents
      }
      data = billing
    }
    if (path.startsWith('/api/admin/accounting/')) data = null
    if (path === '/api/admin/new-admin/families') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (path === '/api/admin/new-admin/classes') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (path === '/api/admin/new-admin/enrollment-trend') {
      if (failure) { failure = false; return route.fulfill({ status: 503, json: { success: false, message: 'Enrollment history is temporarily unavailable.' } }) }
      data = empty ? { ...buildData(), quarters:summarizeQuarters(trend.asOf, []), studentQuarters:summarizeQuarters(trend.asOf, []), summary:summarizeMonths([]), studentSummary:summarizeLossRates([]), coverageStart: null, months: trend.months.map(row => ({ ...row, openingFamilies: null, newFamilies: null, canceledFamilies: null, lostFamilies: null, lossRate: null })) } : buildData()
      if (legacy) { data = trend; legacy = false }
    }
    if (path.includes('/marketing-spend/')) {
      if (saveFailure) {saveFailure=false; return route.fulfill({status:503,json:{success:false,message:'Unable to save spending.'}})}
      const body = route.request().postDataJSON(), month = path.split('/').at(-1)!
      const existing = spending.find(row=>row.month===month)
      if (existing) {existing.amount_cents=body.amountCents;existing.version++}
      else spending.push({month,amount_cents:body.amountCents,version:1})
    }
    return route.fulfill({ status: 200, json: { success: true, data } })
  })
  await page.goto('/')
  if (permission) await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Dashboard', exact: true }).click()
  return { requests, errors }
}

test('Admin overlays all family measures; view changes are local and mobile/table remain accessible', async ({ page }) => {
  const { requests, errors } = await prepare(page)
  const dashboard = page.getByRole('region', { name: 'Enrollment & Loss Data' })
  await expect(dashboard.getByRole('heading', { name: 'Enrollment & Loss Data', exact: true })).toBeVisible()
  const chart = dashboard.getByRole('group', {name:'Family enrollment trend'})
  await expect(chart.locator('.recharts-line')).toHaveCount(3)
  if (process.env.ENROLLMENT_SCREENSHOTS) await page.screenshot({path:process.env.ENROLLMENT_SCREENSHOTS+'/desktop.png',fullPage:true})
  await chart.getByRole('button', { name: 'Bar graph', exact: true }).click()
  await expect(chart.locator('.recharts-bar')).toHaveCount(2)
  await expect(chart.locator('.recharts-line')).toHaveCount(1)
  await dashboard.getByRole('button', { name: 'Table', exact: true }).click()
  await expect(chart.getByRole('table')).toBeVisible()
  await expect(chart.getByRole('row')).toHaveCount(12)
  await expect(chart.getByRole('row').filter({ hasText: 'Feb' })).toContainText('10.0%')
  await expect(chart.getByRole('row').filter({ hasText: 'Jan' })).toContainText('Unavailable')
  await expect(chart.getByRole('row').filter({ hasText: 'Nov' })).toContainText('Nov (partial)')
  expect(requests.filter(path => path.endsWith('/enrollment-trend'))).toHaveLength(1)
  expect(requests.some(path => path.includes('customer-billing'))).toBe(false)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  if (process.env.ENROLLMENT_SCREENSHOTS) await page.screenshot({path:process.env.ENROLLMENT_SCREENSHOTS+'/mobile.png',fullPage:true})
  await dashboard.getByRole('button', { name: 'Timeline', exact: true }).click()
  await expect(chart.locator('.recharts-surface').first()).toBeVisible()
  await expect.poll(async () => chart.locator('.recharts-surface').first().evaluate(element => {
    const { width, height } = element.getBoundingClientRect()
    return width > 0 && width <= window.innerWidth && height > 0
  })).toBe(true)
  await dashboard.getByText('Calculation details').click()
  await expect(dashboard.getByText('Siblings and transfers count once per family.')).toBeVisible()
  await page.getByRole('button', { name: 'Refresh Admin', exact: true }).click()
  await expect(chart.locator('.recharts-line')).toHaveCount(3)
  expect(requests.filter(path => path.endsWith('/enrollment-trend'))).toHaveLength(2)
  expect(errors).toEqual([])
})
test('dashboard read errors can be retried and empty data does not become a fabricated zero', async ({ page }) => {
  await prepare(page, { failure: true, empty: true })
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('No enrollment history is available for this year.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'New families', exact: true }).getByRole('article', { name: 'CY 2026 Q4 to date' })).toContainText('Unavailable')
  const loss = page.getByRole('region', { name: 'Family loss rate', exact: true })
  await expect(loss.getByRole('article')).toHaveCount(5)
  await expect(loss.getByRole('article', { name: 'CY 2026 Q4 to date' })).toContainText('Unavailable')
  await expect(loss.getByRole('article', { name: 'CY 2026 Q4 to date' })).toContainText('0 of 2 months with recorded data')
})
test('the population selector updates quarters, cancellations, loss rates and breakdowns together', async ({ page }) => {
  const { requests, errors } = await prepare(page)
  const additions = page.getByRole('region', { name: 'New families', exact: true })
  await expect(additions.getByRole('article')).toHaveCount(5)
  await expect(additions.getByRole('article', { name: 'CY 2026 Q1', exact: true })).toContainText('Monthly avg: 9.3')
  await expect(additions.getByRole('article', { name: 'CY 2026 Q4 to date' })).toContainText('Monthly avg: 4.0')
  await expect(additions.getByRole('article', { name: 'Previous 4 full quarters' })).toContainText('CY 2025 Q4 – CY 2026 Q3')
  await expect(page.getByRole('region', { name: 'Family cancellations' }).getByRole('article', { name: 'CY 2026 Q4 to date' })).toContainText('Monthly avg: 3.0')
  const labels = ['CY 2026 Q1', 'CY 2026 Q2', 'CY 2026 Q3', 'CY 2026 Q4 to date', 'Previous 4 full quarters']
  for (const heading of ['New families', 'Family cancellations', 'Family loss rate']) {
    const row = page.getByRole('region', { name: heading, exact: true })
    expect(await row.getByRole('article').evaluateAll(cards => cards.map(card => card.getAttribute('aria-label')))).toEqual(labels)
  }
  const familyLoss = page.getByRole('region', { name: 'Family loss rate', exact: true })
  await expect(familyLoss.getByRole('article', { name: 'CY 2026 Q4 to date' })).toContainText('10.0%')
  await expect(page.getByRole('article', { name: /Last month loss rate|Previous 3 months avg loss rate|Previous 12 months avg loss rate/ })).toHaveCount(0)
  await expect(page.getByRole('article', { name: 'Ages', exact: true })).toContainText('20 (100.0%)')
  await page.getByRole('button', { name: 'Students', exact: true }).click()
  await expect(page.getByRole('region', { name: 'New students', exact: true }).getByRole('article', { name: 'CY 2026 Q4 to date' })).toContainText('Monthly avg: 6.0')
  await expect(page.getByRole('region', { name: 'Student cancellations' }).getByRole('article', { name: 'CY 2026 Q4 to date' })).toContainText('Monthly avg: 4.0')
  const studentLoss = page.getByRole('region', { name: 'Student loss rate', exact: true })
  expect(await studentLoss.getByRole('article').evaluateAll(cards => cards.map(card => card.getAttribute('aria-label')))).toEqual(labels)
  await expect(studentLoss.getByRole('article', { name: 'CY 2026 Q4 to date' })).toContainText('40.0%')
  await expect(studentLoss.getByRole('article', { name: 'CY 2026 Q4 to date' })).toContainText('Includes the current month to date')
  await expect(studentLoss.getByRole('article', { name: 'CY 2026 Q3', exact: true })).toContainText('20.0%')
  await expect(studentLoss.getByRole('article', { name: 'Previous 4 full quarters' })).toContainText('20.0%')
  await expect(studentLoss.getByRole('article', { name: 'Previous 4 full quarters' })).toContainText('8 of 12 months with recorded data')
  await expect(studentLoss.getByRole('article', { name: 'Previous 4 full quarters' })).toContainText('CY 2025 Q4 – CY 2026 Q3')
  await expect(studentLoss.getByRole('article', { name: 'CY 2026 Q1', exact: true })).toContainText('Avg monthly loss rate')
  await expect(page.getByRole('article', { name: 'Ages', exact: true })).toContainText('30 (100.0%)')
  for (const [name, value] of [['Current families', '20'], ['Current students', '30'], ['Average students per family', '1.50']]) {
    await expect(page.getByRole('article', { name, exact: true })).toContainText(value)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  if (process.env.ENROLLMENT_SCREENSHOTS) await studentLoss.screenshot({path:process.env.ENROLLMENT_SCREENSHOTS+'/quarterly-student-loss-mobile.png'})
  expect(requests.filter(path => path.endsWith('/enrollment-trend'))).toHaveLength(1)
  expect(errors).toEqual([])
})
test('older quarter responses still show matching period loss rates without a rolling student summary', async ({ page }) => {
  await prepare(page, { studentHistory: false, legacyQuarterRates: true })
  await page.getByRole('button', { name: 'Students', exact: true }).click()
  const loss = page.getByRole('region', { name: 'Student loss rate', exact: true })
  await expect(loss.getByRole('article', { name: 'CY 2026 Q4 to date' })).toContainText('40.0%')
  await expect(loss.getByRole('article', { name: 'Previous 4 full quarters' })).toContainText('20.0%')
  await expect(loss.getByRole('article', { name: 'Previous 4 full quarters' })).toContainText('8 of 12 months with recorded data')
})
test('older backend responses retain the timeline until expanded metrics arrive on refresh', async ({ page }) => {
  const { errors } = await prepare(page, { legacy: true })
  const chart = page.getByRole('group', { name: 'Family enrollment trend' })
  await expect(chart.locator('.recharts-line')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Save spending' })).toHaveCount(0)
  await chart.getByRole('button', { name: 'Table', exact: true }).click()
  await expect(chart.getByRole('row').filter({ hasText: 'Feb' })).toContainText('10.0%')
  await page.getByRole('button', { name: 'Refresh Admin', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Current students', exact: true })).toContainText('30')
  await expect(page.getByRole('button', { name: 'Save spending' })).toBeVisible()
  expect(errors).toEqual([])
})
test('staff without family access cannot open or fetch the family dashboard', async ({ page }) => {
  const { requests } = await prepare(page, { permission: false })
  const nav = page.getByRole('navigation', { name: 'Admin sections' })
  await expect(nav.getByRole('button', { name: 'Classes & schedules' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Dashboard', exact: true })).toHaveCount(0)
  expect(requests.some(path => path.endsWith('/enrollment-trend'))).toBe(false)
})

test('marketing spending saves, recalculates family value and survives navigation; errors preserve input', async ({page}) => {
  const {requests,errors} = await prepare(page,{saveFailure:true})
  await expect(page.getByRole('article',{name:'Value per marketing dollar',exact:true})).toContainText('$15.00 per $1')
  await page.getByRole('combobox',{name:'Marketing spend month'}).selectOption('2026-10')
  const amount = page.getByRole('textbox',{name:'Marketing spend in dollars'})
  await amount.fill('-1')
  await page.getByRole('button',{name:'Save spending'}).click()
  await expect(page.getByRole('alert')).toContainText('two decimal places')
  expect(requests.filter(path=>path.includes('/marketing-spend/'))).toHaveLength(0)
  await amount.fill('1200')
  await page.getByRole('button',{name:'Save spending'}).click()
  await expect(page.getByRole('alert')).toContainText('Unable to save spending')
  await expect(amount).toHaveValue('1200')
  await page.getByRole('button',{name:'Save spending'}).click()
  await expect(page.getByRole('article',{name:'Value per marketing dollar',exact:true})).toContainText('$7.50 per $1')
  await expect(page.getByRole('status')).toContainText('Oct 2026 saved')
  await page.getByRole('button',{name:'Refresh Admin'}).click()
  await expect(page.getByRole('article',{name:'Average acquisition cost per family',exact:true})).toContainText('$300.00')
  await page.getByRole('combobox',{name:'Marketing spend month'}).selectOption('2026-10')
  await amount.fill('0'); await page.getByRole('button',{name:'Save spending'}).click()
  await expect(page.getByRole('article',{name:'Value per marketing dollar',exact:true})).toContainText('Unavailable')
  await amount.fill(''); await page.getByRole('button',{name:'Save spending'}).click()
  await expect(page.getByRole('article',{name:'Average acquisition cost per family',exact:true})).toContainText('Unavailable')
  expect(errors).toEqual([])
})
test('financial viewing and marketing editing follow separate permissions; removed language stays absent', async ({page}) => {
  await prepare(page,{financial:false,editable:false})
  await expect(page.getByText('Billing access is required', {exact:false})).toBeVisible()
  await expect(page.getByRole('button',{name:'Save spending'})).toHaveCount(0)
  await expect(page.getByRole('article',{name:'Current students',exact:true})).toContainText('30')
  await expect(page.getByText(/provisional|Recorded history begins|Months marked/)).toHaveCount(0)
})

test('student toggle updates all graph views without another request; family membership card totals siblings', async ({page}) => {
  const {requests,errors} = await prepare(page)
  await expect(page.getByRole('article',{name:'Average membership cost per family',exact:true})).toContainText('$225.00')
  await expect(page.getByText('Loss rate = starting families lost ÷ starting enrolled families × 100.',{exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'Students',exact:true}).click()
  const chart = page.getByRole('group',{name:'Student enrollment trend',exact:true})
  await expect(chart.locator('.recharts-line')).toHaveCount(3)
  await chart.getByRole('button',{name:'Bar graph',exact:true}).click()
  await expect(chart.locator('.recharts-bar')).toHaveCount(2)
  await chart.getByRole('button',{name:'Table',exact:true}).click()
  await expect(chart.getByRole('columnheader',{name:'New students',exact:true})).toBeVisible()
  await expect(chart.getByRole('row').filter({hasText:'Feb'})).toContainText('6')
  await page.getByRole('button',{name:'Families',exact:true}).click()
  await expect(page.getByRole('group',{name:'Family enrollment trend',exact:true}).getByRole('columnheader',{name:'New families',exact:true})).toBeVisible()
  expect(requests.filter(path=>path.endsWith('/enrollment-trend'))).toHaveLength(1)
  expect(errors).toEqual([])
})

test('revenue switches locally by class, gender and age; unpaid periods and credits show the right families', async ({page}) => {
  const {requests,errors} = await prepare(page)
  const billing = page.getByRole('region',{name:'Billing & Revenue',exact:true})
  const quarters = billing.getByRole('region', {name:'Quarterly revenue',exact:true})
  const monthly = billing.getByRole('region', {name:'Monthly revenue',exact:true})
  const averages = billing.getByRole('region', {name:'Revenue averages & total',exact:true})
  for (const row of [quarters, monthly, averages]) await expect(row.getByRole('article')).toHaveCount(5)
  expect((await billing.getByRole('heading', {level:3}).allTextContents()).slice(0,3)).toEqual(['Quarterly revenue','Monthly revenue','Revenue averages & total'])
  for (const [label, value] of [['CY 2025 Q4','$70.00'],['CY 2026 Q1','$0.00'],['CY 2026 Q2','$0.00'],['CY 2026 Q3','$90.00'],['CY 2026 Q4 to date','$400.00']]) {
    await expect(quarters.getByRole('article',{name:label,exact:true})).toContainText(value)
  }
  for (const [label, value] of [['Jul 2026','$0.00'],['Aug 2026','$0.00'],['Sep 2026','$90.00'],['Oct 2026','$300.00'],['Nov 2026 to date','$100.00']]) {
    await expect(monthly.getByRole('article',{name:label,exact:true})).toContainText(value)
  }
  for (const [label, value] of [['3-month average revenue','$130.00'],['6-month average revenue','$65.00'],['9-month average revenue','$43.33'],['12-month average revenue','$32.50'],['Total revenue previous 12 months','$390.00']]) {
    await expect(averages.getByRole('article',{name:label,exact:true})).toContainText(value)
  }
  await expect(averages.getByRole('article',{name:'Total revenue previous 12 months'})).toContainText('Nov 2025 – Oct 2026')
  if (process.env.ENROLLMENT_SCREENSHOTS) await averages.screenshot({path:process.env.ENROLLMENT_SCREENSHOTS+'/revenue-averages-desktop.png'})
  const chart=billing.getByRole('group',{name:'Revenue trend',exact:true})
  await expect(chart.locator('.recharts-line')).toHaveCount(1)
  await chart.getByRole('button',{name:'Table',exact:true}).click()
  await expect(chart.getByRole('row').filter({hasText:'Oct 2026'})).toContainText('$300.00')
  await expect(chart.getByRole('row')).toHaveCount(14)
  await expect(chart.getByRole('row').filter({hasText:'Nov 2026'})).toContainText('$100.00')
  for (const [group,label,value] of [['class','Team','$200.00'],['gender','Girls','$200.00'],['age','Age 10','$200.00']]) {
    await chart.getByRole('combobox',{name:'Revenue breakdown'}).selectOption(group)
    await chart.getByRole('combobox',{name:'Revenue segment'}).selectOption(label)
    await expect(chart.getByRole('row').filter({hasText:'Oct 2026'})).toContainText(value)
  }
  await chart.getByRole('button',{name:'Bar graph',exact:true}).click()
  await expect(chart.locator('.recharts-bar')).toHaveCount(1)
  await chart.getByRole('combobox',{name:'Revenue breakdown'}).selectOption('all')
  await chart.getByRole('button',{name:'Timeline',exact:true}).click()
  const unpaid = billing.getByRole('region',{name:'Unpaid accounts',exact:true})
  await expect(unpaid).toContainText('Current Fixture')
  await expect(unpaid).toContainText('$120.00')
  await expect(unpaid.getByText('Overdue Fixture')).toHaveCount(0)
  await unpaid.getByRole('button',{name:'Last month +',exact:true}).click()
  await expect(unpaid).toContainText('Overdue Fixture')
  await expect(unpaid).toContainText('$70.00')
  await expect(unpaid.getByText('Current Fixture')).toHaveCount(0)
  await unpaid.getByRole('searchbox',{name:'Find a family'}).fill('absent')
  await expect(unpaid).toContainText('No families match')
  await unpaid.getByRole('searchbox',{name:'Find a family'}).fill('')
  await expect(billing.getByRole('region',{name:'Account credits'})).toContainText('Credit Fixture')
  await expect(billing.getByRole('region',{name:'Account credits'})).toContainText('$50.00')
  expect(requests.filter(path=>path.endsWith('/billing-dashboard'))).toHaveLength(1)
  await page.setViewportSize({width:390,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  if (process.env.ENROLLMENT_SCREENSHOTS) await averages.screenshot({path:process.env.ENROLLMENT_SCREENSHOTS+'/revenue-averages-mobile.png'})
  if (process.env.ENROLLMENT_SCREENSHOTS) await page.screenshot({path:process.env.ENROLLMENT_SCREENSHOTS+'/billing-mobile.png',fullPage:true})
  expect(errors).toEqual([])
})

test('older revenue responses keep monthly averages accurate without fabricating an incomplete quarter total', async ({page}) => {
  await prepare(page,{legacyRevenue:true})
  const billing = page.getByRole('region', {name:'Billing & Revenue',exact:true})
  const quarters = billing.getByRole('region', {name:'Quarterly revenue',exact:true})
  await expect(quarters.getByRole('article',{name:'CY 2025 Q4',exact:true})).toContainText('Unavailable')
  await expect(quarters.getByRole('article',{name:'CY 2026 Q4 to date',exact:true})).toContainText('$400.00')
  await expect(billing.getByRole('article',{name:'6-month average revenue',exact:true})).toContainText('$65.00')
  await expect(billing.getByRole('article',{name:'9-month average revenue',exact:true})).toContainText('$43.33')
})

test('staff without billing permission never request revenue or account balances', async ({page})=>{
  const {requests} = await prepare(page,{financial:false,editable:false})
  await expect(page.getByRole('article',{name:'Current students',exact:true})).toBeVisible()
  await expect(page.getByRole('region',{name:'Billing & Revenue'})).toHaveCount(0)
  expect(requests.some(path=>path.endsWith('/billing-dashboard'))).toBe(false)
})
