import { expect, test } from '@playwright/test'

const trainingLoop = /\/newpage\/training-loop\.mp4(?:\?|$)/
const backgroundVideo = '.np-hero-media video'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: { success: true } }))
})

test.describe('phone homepage video', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })

  test('shows the poster and requests the background video only after Play', async ({ page }) => {
    const requestedMedia: string[] = []
    const requestedFitAndFlipPhotos = new Set<string>()
    page.on('request', request => {
      if (trainingLoop.test(request.url())) requestedMedia.push(request.url())
      const path = new URL(request.url()).pathname
      if (/^\/fit-and-flip-card(?:-\d+)?\.webp$/.test(path)) requestedFitAndFlipPhotos.add(path)
    })

    // This check needs the initial network activity to settle before asserting the video was never requested.
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.locator('.np-hero-poster')).toBeVisible()
    await expect(page.locator(backgroundVideo)).not.toHaveAttribute('src', /.+/)
    expect(requestedMedia).toHaveLength(0)
    const fitAndFlipCard = page.getByRole('button', { name: 'Explore Fit & Flip', exact: true })
    const fitAndFlipPhoto = fitAndFlipCard.getByRole('img')
    await expect.poll(() => fitAndFlipPhoto.evaluate((image: HTMLImageElement) => image.currentSrc))
      .toMatch(/fit-and-flip-card-480\.webp$/)
    expect([...requestedFitAndFlipPhotos]).toEqual(['/fit-and-flip-card-480.webp'])
    const galleryHeading = page.getByRole('heading', { name: 'THE COMPLETE ATHLETE', exact: true })
    await expect(galleryHeading).not.toHaveClass(/\bfont-display\b/)

    await page.getByRole('button', { name: 'Necessary only' }).click()
    await page.getByRole('button', { name: 'Play background video' }).click()
    await expect(page.locator(backgroundVideo)).toHaveAttribute('src', trainingLoop)
    await expect.poll(() => requestedMedia.length).toBeGreaterThan(0)

    await galleryHeading.scrollIntoViewIfNeeded()
    await expect(galleryHeading).toHaveClass(/\bfont-display\b/)

    const handstandPhoto = page.getByRole('img', { name: 'An athlete practicing a controlled handstand at Vortex' })
    await handstandPhoto.scrollIntoViewIfNeeded()
    await expect.poll(() => handstandPhoto.evaluate((image: HTMLImageElement) => image.currentSrc)).toMatch(/calisthenics-card-640\.webp$/)
  })

  test('the training film has a direct, user-controlled player on mobile', async ({ page }) => {
    const requestedMedia: string[] = []
    page.on('request', request => {
      if (trainingLoop.test(request.url())) requestedMedia.push(request.url())
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Necessary only' }).click()
    await page.getByRole('link', { name: 'Watch the Vortex training film' }).click()
    await expect(page).toHaveURL('/watch/training-at-vortex')
    await expect(page.getByRole('heading', { level: 1, name: 'Gymnastics and athletic training at Vortex' })).toBeVisible()
    const film = page.getByRole('main').locator('video')
    await expect(film).toBeVisible()
    await expect(film).toHaveAttribute('poster', '/newpage/training-film-poster.jpg')
    await expect(film).toHaveAttribute('preload', 'none')
    await expect(film).toHaveJSProperty('controls', true)
    expect(requestedMedia).toHaveLength(0)
    await page.getByRole('link', { name: 'Play from 0:16', exact: true }).click()
    await expect.poll(() => film.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThanOrEqual(16)
    await expect.poll(() => requestedMedia.length).toBeGreaterThan(0)
    await expect(film).toHaveJSProperty('duration', 24)
    await expect(page.getByRole('region', { name: 'What you’ll see' }).getByRole('listitem')).toHaveCount(4)
    const descriptions = film.locator('track[kind="descriptions"]')
    await descriptions.evaluate((element: HTMLTrackElement) => { element.track.mode = 'hidden' })
    await expect.poll(() => descriptions.evaluate((element: HTMLTrackElement) =>
      Array.from(element.track.cues ?? []).some(cue => cue.startTime === 16 && /cone/i.test((cue as VTTCue).text)),
    )).toBe(true)
    await expect(page.getByRole('link', { name: 'Watch the Vortex introduction on YouTube' }))
      .toHaveAttribute('href', 'https://www.youtube.com/watch?v=bvGYBIgc_H8')
    await page.locator('#strength-and-handstand').getByRole('link', { name: 'How adults can work toward a handstand' }).click()
    await expect(page).toHaveURL('/adult-gymnastics#adult-handstand-preparation')
    await expect(page.locator('#adult-handstand-preparation').getByRole('heading')).toBeInViewport()
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
  const player = page.getByRole('dialog').locator('video')
  await expect(player).toHaveAttribute('src', trainingLoop)
  const heroSource = await page.locator('.np-hero-poster').evaluate((image: HTMLImageElement) => image.currentSrc)
  await expect(player).toHaveAttribute('poster', heroSource)
  await expect(page.locator(backgroundVideo)).not.toHaveAttribute('src', /.+/)
})
