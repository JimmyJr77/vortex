import { expect, test, type Page } from '@playwright/test'
import { summarizeMonths, acquisitionMetrics } from '../../backend/newAdmin/enrollmentMetrics.js'

const trend = { year: 2026, asOf: '2026-11-09', coverageStart: '2026-01-19', notes: ['Siblings and transfers count once per family.'], months: Array.from({ length: 11 }, (_, i) => ({
  key: `2026-${String(i + 1).padStart(2, '0')}`, label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'][i],
  openingFamilies: i ? 20 : null, newFamilies: i ? 4 : 20, canceledFamilies: i ? 3 : 0,
  lostFamilies: i ? 2 : null, lossRate: i ? 10 : null, partial: i === 10, provisional: i >= 7,
})) }
async function prepare(page: Page, { permission = true, failure = false, empty = false, financial = true, editable = true, saveFailure = false } = {}) {
  const rollingMonths = [{...trend.months[0],key:'2025-11',label:'Nov',newFamilies:null}, {...trend.months[0],key:'2025-12',label:'Dec',newFamilies:null}, ...trend.months.slice(0,10)]
  const current = {families:20,students:30,studentsPerFamily:1.5,classes:[{id:'1',name:'Tumbling',count:20},{id:'2',name:'Team',count:20}],genders:[{label:'Boys',count:12},{label:'Girls',count:18}],ages:[{label:'Age 8',count:30}],teams:[{label:'Team',count:20},{label:'Non-team',count:10}],membership:financial ? {monthlyRevenueCents:450000,averageMembershipCents:15000,pricedStudents:30} : null}
  const summary = summarizeMonths(rollingMonths)
  const spending = [{month:'2026-10',amount_cents:60000 as number | null,version:1}]
  const buildData = () => ({...trend,rollingMonths,summary,current,acquisition:financial ? acquisitionMetrics([...rollingMonths,trend.months.at(-1)],spending,current,summary) : null,permissions:{canViewFinancial:financial,canEditMarketing:editable}})

  const requests: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
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
    if (path.startsWith('/api/admin/accounting/')) data = null
    if (path === '/api/admin/new-admin/families') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (path === '/api/admin/new-admin/classes') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (path === '/api/admin/new-admin/enrollment-trend') {
      if (failure) { failure = false; return route.fulfill({ status: 503, json: { success: false, message: 'Enrollment history is temporarily unavailable.' } }) }
      data = empty ? { ...buildData(), summary:summarizeMonths([]), coverageStart: null, months: trend.months.map(row => ({ ...row, openingFamilies: null, newFamilies: null, canceledFamilies: null, lostFamilies: null, lossRate: null })) } : buildData()
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
  if (permission) await page.getByRole('navigation', { name: 'New Admin sections' }).getByRole('button', { name: 'Dashboard', exact: true }).click()
  return { requests, errors }
}

test('New Admin overlays all family measures; view changes are local and mobile/table remain accessible', async ({ page }) => {
  const { requests, errors } = await prepare(page)
  const dashboard = page.getByRole('region', { name: 'Enrollment & Loss Data' })
  await expect(dashboard.getByRole('heading', { name: 'Enrollment & Loss Data', exact: true })).toBeVisible()
  const chart = dashboard.getByRole('group', {name:'Family enrollment trend'})
  await expect(chart.locator('.recharts-line')).toHaveCount(3)
  if (process.env.ENROLLMENT_SCREENSHOTS) await page.screenshot({path:process.env.ENROLLMENT_SCREENSHOTS+'/desktop.png',fullPage:true})
  await dashboard.getByRole('button', { name: 'Bar graph', exact: true }).click()
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
  await dashboard.getByText('Calculation details').click()
  await expect(dashboard.getByText('Siblings and transfers count once per family.')).toBeVisible()
  await page.getByRole('button', { name: 'Refresh New Admin', exact: true }).click()
  await expect(chart.locator('.recharts-line')).toHaveCount(3)
  expect(requests.filter(path => path.endsWith('/enrollment-trend'))).toHaveLength(2)
  expect(errors).toEqual([])
})
test('dashboard read errors can be retried and empty data does not become a fabricated zero', async ({ page }) => {
  await prepare(page, { failure: true, empty: true })
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('No enrollment history is available for this year.')).toBeVisible()
  await expect(page.getByRole('article',{name:'New Families last 12 months',exact:true})).toContainText('Unavailable')
})
test('staff without family access cannot open or fetch the family dashboard', async ({ page }) => {
  const { requests } = await prepare(page, { permission: false })
  const nav = page.getByRole('navigation', { name: 'New Admin sections' })
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
  await page.getByRole('button',{name:'Refresh New Admin'}).click()
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
