import { expect, test, type Page } from '@playwright/test'

const initialPrograms = () => [
  { id: 10, displayName: 'Developmental Gymnastics', description: 'Build foundational skills.', primarySportName: 'Gymnastics', classes: [
    { id: 101, displayName: 'Dirt Devils', formId: 1001 },
    { id: 102, displayName: 'Twisters', formId: 1002 },
    { id: 103, displayName: 'Tornadoes', formId: 1003 },
  ] },
  { id: 30, displayName: 'Fit & Flip', description: 'Adult gymnastics.', primarySportName: 'Gymnastics', classes: [
    { id: 301, displayName: 'Adult Basics', formId: 3001 },
  ] },
  { id: 20, displayName: 'Vortex Gymnastics Team', description: 'VGT is the official artistic gymnastics team of Vortex Gymnastics', primarySportName: 'Gymnastics', classes: [
    { id: 201, displayName: 'Team Practice', formId: 2001 },
  ] },
]

async function setup(page: Page, { manage = true, failSave = false } = {}) {
  let programs = initialPrograms()
  let hasSavedOrder = false
  const writes: unknown[] = []
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('guest')) {
      localStorage.setItem('vortex_admin', 'true')
      localStorage.setItem('adminToken', 'fixture')
    }
  })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/admin/access/me') return route.fulfill({ json: { success: true, data: { isMasterAdmin: false, permissions: manage ? ['classes.manage'] : ['classes.view'] } } })
    if (path === '/api/public/classes-offered') {
      const catalog = programs.map((program, index) => ({ ...program, enrollmentSortOrder: hasSavedOrder ? index : null }))
      return route.fulfill({ json: { success: true, data: { programs: catalog } } })
    }
    if (path === '/api/admin/new-admin/enroll-order') {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON()
        writes.push(body)
        if (failSave) return route.fulfill({ status: 409, json: { success: false, message: 'The catalog changed. Reload the order and try again.' } })
        programs = body.programs.map((item: { id: number; classIds: number[] }) => {
          const current = programs.find(program => program.id === item.id)!
          return { ...current, classes: item.classIds.map(id => current.classes.find(klass => klass.id === id)!) }
        })
        hasSavedOrder = true
        return route.fulfill({ json: { success: true, data: { saved: true } } })
      }
      return route.fulfill({ json: { success: true, data: { programs } } })
    }
    if (path === '/api/members/billing/annual-membership') return route.fulfill({ json: { success: true, data: { available: false, active: false } } })
    if (/\/api\/signup\/catalog\/classes\/\d+\/offerings$/.test(path)) return route.fulfill({ json: { success: true, data: { formId: 1, offerings: [], scheduleOptions: [] } } })
    return route.fulfill({ json: { success: true, data: [] } })
  })
  await page.goto('/tests/fixtures/enroll-order.html?sportFilter=Gymnastics')
  return { writes }
}

const catalogNames = (page: Page) => page.getByRole('heading', { level: 3 })

test('admin saves order and anonymous visitors and members see it after reload', async ({ page }) => {
  const { writes } = await setup(page)
  await expect(catalogNames(page)).toHaveText(['Dirt Devils', 'Twisters', 'Tornadoes', 'Team Practice', 'Adult Basics'])
  await page.getByRole('button', { name: 'Edit order', exact: true }).click()
  const editor = page.getByRole('region', { name: 'Enrollment display order' })
  const moveTeamUp = editor.getByRole('button', { name: 'Move section Vortex Gymnastics Team up', exact: true })
  await moveTeamUp.click()
  await moveTeamUp.click()
  await editor.getByRole('button', { name: 'Move Twisters up in Developmental Gymnastics', exact: true }).click()
  await editor.getByRole('button', { name: 'Save order', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Enrollment order saved for everyone.')
  expect(writes).toEqual([{ programs: [{ id: 20, classIds: [201] }, { id: 10, classIds: [102, 101, 103] }, { id: 30, classIds: [301] }] }])
  const savedOrder = ['Team Practice', 'Twisters', 'Dirt Devils', 'Tornadoes', 'Adult Basics']
  await expect(catalogNames(page)).toHaveText(savedOrder)
  await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('guest', 'true') })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Edit order' })).toHaveCount(0)
  await expect(catalogNames(page)).toHaveText(savedOrder)
  await expect(page.getByText('VGT is the official artistic gymnastics team of Vortex Gymnastics')).toBeVisible()
  await page.goto('/tests/fixtures/enroll-order.html?member')
  await expect(catalogNames(page).filter({ hasText: /^(Team Practice|Twisters|Dirt Devils|Tornadoes|Adult Basics)$/ })).toHaveText(savedOrder)
})

test('failed ordering save retains the draft and cancel leaves published order unchanged', async ({ page }) => {
  const { writes } = await setup(page, { failSave: true })
  await page.getByRole('button', { name: 'Edit order', exact: true }).click()
  const editor = page.getByRole('region', { name: 'Enrollment display order' })
  await editor.getByRole('button', { name: 'Move section Vortex Gymnastics Team up', exact: true }).click()
  await editor.getByRole('button', { name: 'Save order', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('The catalog changed.')
  await expect(editor.getByRole('button', { name: 'Reload saved order' })).toBeVisible()
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(catalogNames(page)).toHaveText(['Dirt Devils', 'Twisters', 'Tornadoes', 'Team Practice', 'Adult Basics'])
  expect(writes).toHaveLength(1)
})

test('signed-in staff without class-management permission cannot edit the display order', async ({ page }) => {
  await setup(page, { manage: false })
  await expect(page.getByRole('heading', { name: 'Dirt Devils', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Enrollment display order' })).toHaveCount(0)
})
