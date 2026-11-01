import { test, expect } from '@playwright/test'
test('credit requires reason and retries with the same key without trusting client staff identity',async({page})=>{
  const requests: Array<{key: string;body: Record<string,unknown>}> = []
  await page.route('**/api/admin/customer-billing/families/94/credits',async route=>{
    requests.push({key:route.request().headers()['idempotency-key'],body:route.request().postDataJSON()})
    await route.fulfill({status: requests.length===1 ? 409 : 201,json:requests.length===1
      ? {success:false,message:'An invoice or payment is already pending.'} : {success:true,data:{}}})
  })
  await page.goto('/tests/e2e/fixtures/add-credit.html')
  const submit=page.getByRole('button',{name:'Add credit',exact:true})
  await expect(submit).toBeDisabled()
  await page.getByLabel('Credit amount ($)').fill('25.50')
  await expect(submit).toBeDisabled()
  await page.getByLabel('Reason (required)').fill('Class cancellation')
  await submit.click()
  await expect(page.getByRole('alert')).toContainText('already pending')
  await submit.click()
  await expect(page.getByRole('status')).toContainText('$25.50 credit added')
  expect(requests).toHaveLength(2)
  expect(requests[0].body).toEqual({amountCents:2550,reason:'Class cancellation'})
  expect(requests[0].key).toBeTruthy()
  expect(requests[1].key).toBe(requests[0].key)
})
