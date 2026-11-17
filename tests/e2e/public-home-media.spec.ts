import { expect, test } from '@playwright/test'

const trainingLoop = /\/newpage\/training-loop\.mp4(?:\?|$)/
const backgroundVideo = '.np-hero-media video'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: { success: true } }))
})

test.describe('phone homepage video', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('shows the poster and requests the background video only after Play', async ({ page }) => {
    const requestedMedia: string[] = []
    page.on('request', request => {
      if (trainingLoop.test(request.url())) requestedMedia.push(request.url())
    })

    // This check needs the initial network activity to settle before asserting the video was never requested.
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.locator('.np-hero-poster')).toBeVisible()
    await expect(page.locator(backgroundVideo)).not.toHaveAttribute('src', /.+/)
    expect(requestedMedia).toHaveLength(0)

    await page.getByRole('button', { name: 'Necessary only' }).click()
    await page.getByRole('button', { name: 'Play background video' }).click()
    await expect(page.locator(backgroundVideo)).toHaveAttribute('src', trainingLoop)
    await expect.poll(() => requestedMedia.length).toBeGreaterThan(0)
  })
})

test('desktop visits keep automatic background playback', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator(backgroundVideo)).toHaveAttribute('src', trainingLoop)
})

test('reduced motion keeps the poster while the requested film still loads', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator('.np-hero-poster')).toBeVisible()
  await expect(page.locator(backgroundVideo)).not.toHaveAttribute('src', /.+/)

  await page.getByRole('button', { name: 'Necessary only' }).click()
  await page.getByRole('button', { name: 'See us in motion' }).click()
  await expect(page.getByRole('dialog').locator('video')).toHaveAttribute('src', trainingLoop)
  await expect(page.locator(backgroundVideo)).not.toHaveAttribute('src', /.+/)
})
