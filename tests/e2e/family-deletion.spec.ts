import { expect, test } from '@playwright/test'

test('archived family deletion requires confirmation, reports blockers, and refreshes after success', async ({ page }) => {
  let deleted = false
  let blocked = true
  let deletes = 0
  await page.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'DELETE') {
      expect(url.pathname).toBe('/api/admin/families/155')
      deletes++
      if (blocked) return route.fulfill({ status: 409, json: { success: false, blockers: [{ message: 'Billing history is linked to this family.' }] } })
      deleted = true
      return route.fulfill({ json: { success: true } })
    }
    const archived = url.searchParams.get('record') === 'archived'
    const rows = deleted ? [] : [{ id: 155, name: 'Tester Family', archived, peopleCount: 3 }]
    return route.fulfill({ json: { success: true, data: { rows, total: rows.length, page: 1, pageSize: 25, totalPages: 1 } } })
  })
  await page.goto('/tests/fixtures/archive-actions.html?scenario=families')
  const open = page.getByRole('button', { name: 'Open family', exact: true })
  const archive = page.getByRole('button', { name: 'Archive Tester Family', exact: true })
  await expect(archive).toBeVisible()
  await expect(page.getByRole('button', { name: 'Permanently delete Tester Family', exact: true })).toHaveCount(0)
  const metrics = (button: typeof open) => button.evaluate(element => ({ height: element.getBoundingClientRect().height, fontSize: getComputedStyle(element).fontSize }))
  expect(await metrics(archive)).toEqual(await metrics(open))
  await page.getByRole('button', { name: 'View Archives', exact: true }).click()
  await page.getByRole('button', { name: 'Families', exact: true }).click()
  const remove = page.getByRole('button', { name: 'Permanently delete Tester Family', exact: true })
  const restore = page.getByRole('button', { name: 'Restore Tester Family', exact: true })
  await expect(remove).toBeVisible()
  expect(await metrics(remove)).toEqual(await metrics(restore))
  await remove.click()
  const dialog = page.getByRole('dialog', { name: 'Delete permanently', exact: true })
  await expect(dialog).toContainText('the family, its members, and their unused member logins')
  await expect(dialog.getByRole('button', { name: 'Delete permanently', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  expect(deletes).toBe(0)
  await remove.click()
  await dialog.getByLabel('Type DELETE to confirm').fill('DELETE')
  await dialog.getByRole('button', { name: 'Delete permanently', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Billing history is linked to this family.')
  await expect(remove).toBeVisible()
  blocked = false
  await remove.click()
  await dialog.getByLabel('Type DELETE to confirm').fill('DELETE')
  await dialog.getByRole('button', { name: 'Delete permanently', exact: true }).click()
  await expect(page.getByText('No archived families match your search.')).toBeVisible()
  expect(deletes).toBe(2)
})
