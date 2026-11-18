import { expect, test } from '@playwright/test'
import type { SchedulingCalendarEvent } from '../../src/utils/schedulingApi'

const classDate = '2027-01-12'
const earlierDate = '2027-01-11'
const cyclones: SchedulingCalendarEvent = {
  id: '30:98:107:2027-01-12', date: classDate, startTime: '18:00', endTime: '19:30',
  formId: 30, classEventId: 14, programsId: 9, programName: 'Fit & Flip', className: 'Cyclones',
  classDescription: null, skillLevel: null, skillRequirements: null, ageMin: 8, ageMax: 11,
  offeringId: 18, offeringLabel: null, offeringStartDate: null, offeringEndDate: null,
  slotGroupId: 98, timeSlotId: 107, maxParticipants: 6, signupCount: 2, waitlistCount: 0,
  spotsRemaining: 4, isFull: false, formActive: true, enrollVisible: true, classActive: true,
  slotGroupActive: true, slotActive: true, isCancelled: false, isTrialAssessment: false,
}

test.describe('Client-critical smoke flows', () => {
  test('mobile visitors can open each guide topic with the consent banner visible', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/blog')
    await expect(page.getByRole('dialog', { name: 'Cookie consent' })).toBeVisible()
    await page.evaluate(async () => { await document.fonts.ready })
    const navigation = page.getByRole('navigation', { name: 'Browse guides by topic' })
    const links = navigation.getByRole('link')
    await expect(links).toHaveCount(5)
    await expect.poll(() => links.evaluateAll(items => items.every(link => {
      const { x, y, width, height } = link.getBoundingClientRect()
      return height >= 44 && width >= 44 &&
        link.contains(document.elementFromPoint(x + width / 2, y + height / 2))
    }))).toBe(true)
    await navigation.getByRole('link', { name: 'Returning as an adult', exact: true }).click()
    await expect(page).toHaveURL('/blog/returning-to-gymnastics-as-an-adult')
    await expect(page.getByRole('heading', { level: 1, name: 'Returning to gymnastics as an adult' })).toBeVisible()
  })

  test('the mobile guide index and tumbling guide load the responsive tumbling photo', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const photo = page.getByRole('img', { name: 'A Vortex athlete flipping above a tumble track in Bowie, Maryland' })
    await page.goto('/blog')
    await photo.scrollIntoViewIfNeeded()
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.currentSrc)).toMatch(/tramp-tumble-hero-768\.webp$/)

    await page.getByRole('link', { name: 'Gymnastics vs. tumbling for kids' }).click()
    await expect(page).toHaveURL('/blog/gymnastics-vs-tumbling')
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.currentSrc)).toMatch(/tramp-tumble-hero-768\.webp$/)
    await expect(photo).toHaveAttribute('src', '/tramp-tumble-hero-1600.webp')
  })

  test('a direct gym link shows the shared mobile menu with keyboard navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/contact#inside-the-gym')
    await expect(page.getByRole('heading', { name: 'Inside the Bowie gym', exact: true })).toBeInViewport()
    const openMenu = page.getByRole('button', { name: 'Open menu', exact: true })
    const navigation = page.getByRole('navigation', { name: 'Mobile navigation' })
    const programs = navigation.getByText('Our Programs', { exact: true })
    const contact = navigation.getByRole('link', { name: 'Contact Us', exact: true })

    await openMenu.press('Enter')
    await programs.press('Tab')
    await expect(contact).toBeFocused()
    await contact.press('Escape')
    await expect(navigation).toBeHidden()
    await expect(openMenu).toBeFocused()

    await openMenu.press('Enter')
    await programs.press('Enter')
    await navigation.getByRole('link', { name: 'Adult gymnastics', exact: true }).press('Enter')
    await expect(page).toHaveURL('/adult-gymnastics')
    await expect(page.getByRole('heading', { name: 'Adult gymnastics and acrobatics in Bowie, MD', exact: true })).toBeVisible()

    await openMenu.press('Enter')
    await contact.click()
    await expect(page).toHaveURL('/contact')
    await expect(page.getByRole('heading', { name: 'Contact Vortex Athletics in Bowie, MD', level: 1 })).toBeVisible()
    await expect(navigation).toBeHidden()
  })

  test('the shared skip link moves keyboard focus to public content', async ({ page }) => {
    for (const path of ['/read-board', '/enroll', '/drop-in', '/contact', '/blog/youth-sports-bowie', '/gymnastics']) {
      await page.goto(path)
      const skip = page.getByRole('link', { name: 'Skip to content', exact: true })
      await skip.press('Enter')
      await expect(page).toHaveURL(`${path}#public-content`)
      const content = page.locator('#public-content')
      await expect(content).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(content.locator(':focus')).toHaveCount(1)
    }
  })

  test('families can find beginner and recreational hockey from the Bowie skating entry', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/blog/youth-sports-bowie#local-programs')
    await page.getByRole('link', { name: 'Compare youth ice hockey programs' }).click()
    await expect(page).toHaveURL('/blog/youth-sports-bowie#youth-ice-hockey')
    const winter = page.locator('#indoor-winter-sports')
    await expect(winter.getByRole('heading', { name: 'Youth ice hockey in Bowie' })).toBeInViewport()
    await expect(winter.getByRole('link', { name: 'Learn-to-Skate group lessons' }))
      .toHaveAttribute('href', 'https://www.cityofbowie.org/485/Lessons-Camps')
    await expect(winter.getByRole('link', { name: 'Future Bruins Learn-to-Play program' }))
      .toHaveAttribute('href', 'https://www.bowiehockey.org/program/bhc-learn-to-play/13025')
    await expect(winter.getByRole('link', { name: 'recreational hockey program' }))
      .toHaveAttribute('href', 'https://www.bowiehockey.org/program/bhc-recreational-program/12276')
  })

  test('families can compare boys’ apparatus classes and find a first gymnastics visit', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/gymnastics#artistic')
    await page.getByRole('link', { name: 'Compare boys’ gymnastics and apparatus classes' }).click()
    await expect(page).toHaveURL('/blog/gymnastics-vs-tumbling#boys-gymnastics')

    const comparison = page.locator('#boys-gymnastics')
    await expect(comparison.getByRole('heading')).toBeInViewport()
    await expect(comparison.getByRole('link', { name: 'See MGA’s boys’ gymnastics class' }))
      .toHaveAttribute('href', 'https://www.mga-gymnastics.com/boys.html')
    await comparison.getByRole('link', { name: 'See how a Vortex trial works' }).click()
    await expect(page).toHaveURL('/gymnastics#first-visit')
    await expect(page.locator('#first-visit').getByRole('heading', { level: 2 })).toBeInViewport()
    const access = page.locator('#gymnastics-class-access')
    await expect(access.getByRole('link', { name: 'Ask Vortex about class access or participation' }))
      .toHaveAttribute('href', '/contact#inquiry')
    await access.getByRole('link', { name: 'Compare adaptive and accessible gymnastics near Bowie' }).click()
    await expect(page).toHaveURL('/blog/gymnastics-vs-tumbling#accessible-gymnastics')
    const adaptive = page.locator('#accessible-gymnastics')
    await expect(adaptive.getByRole('heading', { name: 'Adaptive and accessible gymnastics near Bowie' })).toBeInViewport()
    await expect(adaptive.getByRole('link', { name: 'See Emilia’s adaptive gymnastics class' }))
      .toHaveAttribute('href', 'https://www.eagcgym.com/recclasses')
    await expect(adaptive.getByRole('link', { name: 'See how to request a county accommodation' }))
      .toHaveAttribute('href', 'https://www.pgparks.com/things-to-do/disability-services#disability')
  })

  test('families can distinguish the two Cyclones programs', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/gymnastics#gymnastics-level-intermediate')
    const intermediate = page.locator('#gymnastics-level-intermediate')
    await intermediate.getByRole('link', { name: 'Compare both Cyclones programs' }).click()
    await expect(page).toHaveURL('/fit-and-flip#compare-cyclones-classes')
    const comparison = page.locator('#compare-cyclones-classes')
    await expect(comparison.getByRole('heading', { name: 'Which Cyclones class should I choose?' })).toBeInViewport()
    await expect(comparison.getByText(/welcomes beginners ages 8–11 and 12–15/)).toBeVisible()
    await comparison.getByRole('link', { name: 'Check the intermediate gymnastics Cyclones skills' }).click()
    await expect(page).toHaveURL('/gymnastics#gymnastics-level-intermediate')
    await expect(intermediate.getByRole('heading', { name: 'Intermediate Cyclones' })).toBeInViewport()
  })

  test('families can compare a Fit & Flip trial with a youth performance assessment', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/fit-and-flip#first-fit-flip-class')
    await page.getByRole('link', { name: 'Compare a trial class with a youth performance assessment' }).click()
    await expect(page).toHaveURL('/blog/athletic-development-young-athletes#youth-performance-assessment')
    const comparison = page.locator('#youth-performance-assessment')
    await expect(comparison.getByRole('heading', { name: 'Should my child start with a class or a performance assessment?' })).toBeInViewport()
    await expect(comparison.getByRole('link', { name: 'See the GOAT Lab’s Athlete Analysis' }))
      .toHaveAttribute('href', 'https://www.goatlabperformance.com/programs/get-started')
    await comparison.getByRole('link', { name: 'See what to expect in a Fit & Flip trial' }).click()
    await expect(page).toHaveURL('/fit-and-flip#training-fit')
    await expect(page.locator('#training-fit').getByRole('heading', { level: 2 })).toBeInViewport()
  })

  test('Fit & Flip links families to fitness alternatives by age', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/fit-and-flip#fit-flip-trial-age')
    await page.getByRole('link', { name: 'Find a beginner gymnastics trial for ages 6–7' }).click()
    await expect(page).toHaveURL('/gymnastics#first-visit')
    await expect(page.locator('#first-visit').getByRole('heading', { level: 2 })).toBeInViewport()

    await page.goto('/fit-and-flip#fit-flip-trial-age')
    await page.getByRole('link', { name: 'Compare Bowie fitness options by age' }).click()

    await expect(page).toHaveURL('/blog/youth-sports-bowie#fitness-without-a-team')
    const fitness = page.locator('#fitness-without-a-team')
    await expect(fitness.getByRole('heading', { level: 2 })).toBeInViewport()
    await expect(fitness.getByRole('link', { name: 'See South Bowie’s open gym hours' }))
      .toHaveAttribute('href', 'https://www.pgparks.com/facilities/south-bowie-community-center')

    await page.getByRole('navigation', { name: 'In this guide' })
      .getByRole('link', { name: 'Fitness rooms for teens' }).click()
    await expect(page).toHaveURL('/blog/youth-sports-bowie#teen-fitness-rooms')
    await expect(fitness.getByRole('heading', { name: 'Which gyms in Bowie can teens use?' })).toBeInViewport()
    await expect(fitness.getByText(/Ages 13–15 need supervision from an adult with a valid fitness pass/)).toBeVisible()
    await expect(fitness.getByRole('link', { name: 'Check the county’s Youth ID rules' }))
      .toHaveAttribute('href', 'https://www.pgparks.com/facilities-rentals/community-center-fees')
    await expect(fitness.getByRole('link', { name: 'See weekly Cyclones class times' }))
      .toHaveAttribute('href', '/fit-and-flip#fit-flip-schedule')

    await fitness.getByRole('link', { name: 'See gymnastics options for teens' }).click()
    await expect(page).toHaveURL('/gymnastics#teen')
    await expect(page.locator('#teen').getByRole('heading')).toBeInViewport()

    await page.goto('/fit-and-flip#fit-flip-trial-age')
    await page.getByRole('link', { name: 'Compare sports training for ages 16–17' }).click()
    await expect(page).toHaveURL('/blog/youth-sports-bowie#high-school-sports-training')
    await expect(page.getByRole('heading', { name: 'Sports performance training for high school athletes' })).toBeInViewport()
    await expect(page.getByRole('link', { name: 'Redline’s small-group trial' }))
      .toHaveAttribute('href', 'https://booking.redlineathletics.com/free-trial-booking-page-bowie')
    await expect(page.getByRole('link', { name: 'The GOAT Lab’s assessment' }))
      .toHaveAttribute('href', 'https://www.goatlabperformance.com/programs/the-performance-lab')

    await page.goto('/fit-and-flip#choose-a-class')
    await page.getByRole('link', { name: 'Find training for a whole youth team' }).click()
    await expect(page).toHaveURL('/blog/youth-sports-bowie#youth-team-training')
    const team = page.locator('#youth-team-training')
    await expect(team.getByRole('heading', { name: 'Youth sports team training in Bowie' })).toBeInViewport()
    await expect(team.getByRole('link', { name: 'See recurring Fit & Flip class times' }))
      .toHaveAttribute('href', '/fit-and-flip#fit-flip-schedule')
    await expect(team.getByRole('link', { name: 'The GOAT Lab’s team training' }))
      .toHaveAttribute('href', 'https://www.goatlabperformance.com/programs/team-training')
  })

  test('Fit & Flip strength guidance leads to the kettlebell film moment', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/fit-and-flip#strength')
    await page.getByRole('link', { name: 'See how kids progress from bodyweight to light resistance' }).click()

    await expect(page).toHaveURL('/blog/athletic-development-young-athletes#strength-training-readiness')
    const readiness = page.locator('#strength-training-readiness')
    await expect(readiness.getByRole('heading', { level: 2 })).toBeInViewport()
    await readiness.getByRole('link', { name: 'See a kettlebell swing in the Vortex training film' }).click()
    await expect(page).toHaveURL('/watch/training-at-vortex#strength-and-handstand')
    await expect(page.getByRole('button', { name: 'Play this scene from 0:12', exact: true })).toBeInViewport()
    await expect(page.getByRole('link', { name: 'See inside the Bowie gym', exact: true }))
      .toHaveAttribute('href', '/contact#inside-the-gym')
  })

  test('the Fit & Flip landing example links to sourced growth-spurt guidance', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/fit-and-flip#fit-flip-class-example')
    await page.getByRole('link', { name: 'See how coaches can adapt a landing during a growth spurt' }).click()
    await expect(page).toHaveURL('/blog/athletic-development-young-athletes#balance-during-a-growth-spurt')
    const guidance = page.locator('#balance-during-a-growth-spurt')
    await expect(guidance.getByRole('heading', { name: 'What if my child’s balance changes during a growth spurt?' })).toBeInViewport()
    await expect(guidance.getByRole('link', { name: 'Read the American Academy of Pediatrics’ sports-readiness guidance' }))
      .toHaveAttribute('href', 'https://www.healthychildren.org/english/healthy-living/sports/pages/is-your-child-ready-for-sports.aspx')
  })

  test('families can compare weekly gymnastics times for siblings', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/blog/preschool-gymnastics-what-toddlers-learn')
    await page.getByRole('navigation', { name: 'In this guide' }).getByRole('link', { name: 'Gymnastics for siblings' }).click()
    await expect(page).toHaveURL('/blog/preschool-gymnastics-what-toddlers-learn#gymnastics-for-siblings')
    const siblings = page.locator('#gymnastics-for-siblings')
    await expect(siblings.getByRole('heading', { name: 'Can siblings take gymnastics on the same day?' })).toBeInViewport()
    await expect(siblings.getByRole('link', { name: 'Choose recurring gymnastics classes' }))
      .toHaveAttribute('href', '/enroll?program=Developmental%20Gymnastics')
    await siblings.getByRole('link', { name: 'Compare weekly youth gymnastics times' }).click()
    await expect(page).toHaveURL('/gymnastics#youth-gymnastics-schedule')
    await expect(page.locator('#youth-gymnastics-schedule').getByRole('heading', { level: 2 })).toBeInViewport()
  })

  test('the preschool guide leads to a gymnastics trial with the program selected', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/blog/preschool-gymnastics-what-toddlers-learn')
    await page.getByRole('link', { name: 'Find a free gymnastics trial' }).click()
    await expect(page).toHaveURL('/gymnastics#first-visit')
    const firstVisit = page.locator('#first-visit')
    await firstVisit.getByRole('button', { name: 'Find a free gymnastics trial', exact: true }).click()
    const trial = page.getByRole('dialog', { name: 'How old is your athlete?' })
    await expect(trial.getByText('Gymnastics', { exact: true })).toBeVisible()
    await expect(trial.getByLabel('Your child’s age')).toBeVisible()
  })

  test('homeschool families can compare local options and return to gymnastics class times', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/gymnastics#homeschool')
    const homeschool = page.locator('#homeschool')
    await expect(homeschool.getByRole('heading')).toBeInViewport()
    await homeschool.getByRole('link', { name: 'Compare homeschool gymnastics and PE near Bowie' }).click()

    await expect(page).toHaveURL('/blog/youth-sports-bowie#homeschool-pe')
    const comparison = page.locator('#homeschool-pe')
    await expect(comparison.getByRole('heading')).toBeInViewport()
    await expect(comparison.getByRole('link', { name: 'Look up seasonal homeschool classes' }))
      .toHaveAttribute('href', 'https://www.pgparks.com/your-guide')
    await comparison.getByRole('link', { name: 'Check Vortex’s weekly gymnastics times' }).click()
    await expect(page).toHaveURL('/gymnastics#youth-gymnastics-schedule')
    await expect(page.locator('#youth-gymnastics-schedule').getByRole('heading').first()).toBeInViewport()

    await page.goto('/blog/youth-sports-bowie#homeschool-pe')
    await comparison.getByRole('link', { name: 'Browse youth gymnastics drop-in classes' }).click()
    await expect(page).toHaveURL('/drop-in?program=Developmental%20Gymnastics')
    await expect(page.getByRole('heading', { name: 'Youth gymnastics drop-ins.' })).toBeVisible()
  })

  test('public homepage renders core CTAs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: 'Gymnastics & youth athletic training in Bowie, MD' })).toBeVisible()
    const navigation = page.getByRole('navigation', { name: 'Main navigation' })
    const contact = navigation.getByRole('link', { name: 'Contact Us', exact: true })
    await navigation.getByText('Our Programs', { exact: true }).press('Tab')
    await expect(contact).toBeFocused()
    await expect(contact).toHaveAttribute('href', '/contact')
    await expect(page.getByRole('link', { name: 'Directions to the Bowie gym' })).toHaveAttribute('href', '/contact')
    const visit = page.getByRole('region', { name: 'Visit Vortex in Bowie, MD' })
    await expect(visit.getByText('4961 Tesla Dr Suite E', { exact: false })).toBeVisible()
    await expect(visit.getByRole('link', { name: 'See the class schedule' })).toHaveAttribute('href', '/read-board#schedule')
    await expect(visit.getByRole('link', { name: 'See inside the Bowie gym', exact: true }))
      .toHaveAttribute('href', '/contact#inside-the-gym')
    await expect(page.getByRole('link', { name: 'Book a free trial', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Schedule', exact: true })).toHaveAttribute('href', '/read-board?tab=schedule')
    await page.setViewportSize({ width: 360, height: 740 })
    await page.getByRole('link', { name: 'Explore programs', exact: true }).click()
    await expect(page).toHaveURL('/#starting-classes')
    const startingClasses = page.getByRole('region', { name: 'Find a class by age and experience' })
    await expect(startingClasses.getByRole('heading', { level: 3 })).toBeInViewport()
    await expect(page.getByRole('dialog', { name: 'Cookie consent' })).toBeVisible()
    const choices = startingClasses.getByRole('navigation', { name: 'Choose a program by age' })
    const links = choices.getByRole('link')
    await expect(links).toHaveCount(4)
    await expect.poll(() => links.evaluateAll(items => items.every(link => {
      const { x, y, width, height } = link.getBoundingClientRect()
      return height >= 44 && width >= 44 &&
        link.contains(document.elementFromPoint(x + width / 2, y + height / 2))
    }))).toBe(true)

    for (const [name, href] of [
      ['Ages 2–5 Preschool gymnastics', '/gymnastics#preschool'],
      ['Ages 6–17 Youth gymnastics', '/gymnastics#choose-a-class'],
      ['Ages 8–15 Fit & Flip', '/fit-and-flip#fit-flip-schedule'],
      ['Ages 18 and up Adult gymnastics', '/adult-gymnastics'],
    ]) {
      await expect(choices.getByRole('link', { name, exact: true })).toHaveAttribute('href', href)
    }
  })

  test('mobile visitors can open the guide beside each starting class', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const guides = [
      { link: 'What children learn in preschool gymnastics', path: 'preschool-gymnastics-what-toddlers-learn', heading: 'What children learn in preschool gymnastics' },
      { link: 'Compare gymnastics and tumbling for kids', path: 'gymnastics-vs-tumbling', heading: 'Gymnastics vs. tumbling for kids' },
      { link: 'Compare youth sports and fitness in Bowie', path: 'youth-sports-bowie', heading: 'A parent’s guide to youth sports in Bowie, MD' },
      { link: 'Returning to gymnastics as an adult', path: 'returning-to-gymnastics-as-an-adult', heading: 'Returning to gymnastics as an adult' },
    ]
    for (const { link, path, heading } of guides) {
      await page.goto('/')
      const startingClasses = page.getByRole('region', { name: 'Find a class by age and experience' })
      await startingClasses.getByRole('link', { name: link, exact: true }).click()
      await expect(page).toHaveURL(`/blog/${path}`)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    }

    await page.goto('/gymnastics#trampoline-tumbling')
    await page.getByRole('link', { name: 'Compare tumbling classes near Bowie', exact: true }).click()
    await expect(page).toHaveURL('/blog/gymnastics-vs-tumbling#nearby-tumbling-classes')
    const nearbyTumbling = page.locator('#nearby-tumbling-classes')
    await expect(nearbyTumbling.getByRole('heading')).toBeInViewport()
    await expect(nearbyTumbling.getByRole('link', { name: /county’s current guide/ }))
      .toHaveAttribute('href', 'https://www.pgparks.com/your-guide')
    await expect(nearbyTumbling.getByRole('link', { name: 'Compare Train For Greatness tumbling levels' }))
      .toHaveAttribute('href', 'https://www.trainforgreatnessmd.com/tumbling')
    await expect(nearbyTumbling.getByRole('link', { name: 'See private tumbling lessons' }))
      .toHaveAttribute('href', 'https://www.trainforgreatnessmd.com/private-lessons')

    await page.goto('/fit-and-flip')
    await page.getByRole('link', { name: 'Compare youth athletic training in Bowie' }).click()
    await expect(page).toHaveURL('/blog/youth-sports-bowie#compare-athletic-training')
    const youthTraining = page.locator('#compare-athletic-training')
    await expect(youthTraining.getByRole('heading', { level: 2 })).toBeInViewport()
    await expect(youthTraining.getByRole('link', { name: 'See Redline’s first-session format and ages' })).toBeVisible()
    await expect(youthTraining.getByRole('link', { name: 'See the Performance Lab assessment' })).toBeVisible()
    await youthTraining.getByRole('link', { name: 'Check Cyclones trial and drop-in dates' }).click()
    await expect(page).toHaveURL('/drop-in?program=Fit%20%26%20Flip')

    await page.goto('/fit-and-flip#speed-agility')
    await page.getByRole('link', { name: 'Compare sprint starts, planned turns, and reacting' }).click()
    await expect(page).toHaveURL('/blog/athletic-development-young-athletes#speed-vs-agility')
    const agility = page.locator('#speed-vs-agility')
    await expect(agility.getByRole('heading', { level: 2 })).toBeInViewport()

    await page.goto('/fit-and-flip#speed-agility')
    await page.getByRole('link', { name: 'See how speed and agility fit youth soccer' }).click()
    await expect(page).toHaveURL('/blog/athletic-development-young-athletes#soccer-speed-and-agility')
    const soccer = page.locator('#soccer-speed-and-agility')
    await expect(soccer.getByRole('heading', { name: 'Speed and agility for youth soccer' })).toBeInViewport()
    await expect(soccer.getByRole('link', { name: 'See weekly Fit & Flip times for both age groups' }))
      .toHaveAttribute('href', '/fit-and-flip#fit-flip-schedule')
    await expect(soccer.getByRole('link', { name: 'See Bowie FC’s soccer skills programs' }))
      .toHaveAttribute('href', 'https://bowiesoccer.com/programs/')
    await soccer.getByRole('link', { name: 'See a change of direction in the Vortex training film' }).click()
    await expect(page).toHaveURL('/watch/training-at-vortex#change-of-direction')
    await expect(page.getByRole('button', { name: 'Play this scene from 0:16', exact: true })).toBeInViewport()
    await expect(page.getByRole('main').locator('video')).toHaveJSProperty('paused', true)
  })

  test('adult gymnasts can compare nearby formats and reach Typhoons dates', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/adult-gymnastics')
    const tumbling = page.locator('#adult-tumbling')
    await expect(tumbling.getByRole('heading', { name: 'Working toward a tumbling skill as an adult?' })).toBeVisible()
    await tumbling.getByRole('link', { name: 'Compare adult tumbling, gymnastics, and open gym near Bowie' }).click()
    await expect(page).toHaveURL('/blog/returning-to-gymnastics-as-an-adult#nearby-adult-gymnastics')
    const comparison = page.locator('#nearby-adult-gymnastics')
    await expect(comparison.getByRole('heading')).toBeInViewport()
    await expect(comparison.getByRole('listitem')).toHaveCount(6)
    await expect(comparison.getByText(/MGA Gymnastics in Upper Marlboro/)).toBeVisible()
    await expect(comparison.getByText(/Fairland/)).toBeVisible()
    await expect(comparison.getByRole('link', { name: 'See Emilia’s adult gymnastics class' }))
      .toHaveAttribute('href', 'https://www.eagcgym.com/recclasses')
    await expect(comparison.getByRole('link', { name: 'See Docksiders’ adult open gym details' }))
      .toHaveAttribute('href', 'https://www.docksidersgymnastics.com/adults')
    await comparison.getByRole('link', { name: 'See Typhoons drop-in dates' }).click()
    await expect(page).toHaveURL('/drop-in?program=Adult%20Fitness%20%26%20Acrobatics')
    await expect(page.getByRole('heading', { name: 'Adult gymnastics drop-ins.' })).toBeVisible()

    await page.goto('/adult-gymnastics#returning-gymnasts')
    await page.getByRole('link', { name: 'Find adult gymnastics competition options' }).click()
    await expect(page).toHaveURL('/blog/returning-to-gymnastics-as-an-adult#adult-gymnastics-competition')
    const competition = page.locator('#adult-gymnastics-competition')
    await expect(competition.getByRole('heading', { name: 'Can adults compete in gymnastics?' })).toBeInViewport()
    await expect(competition.getByRole('link', { name: 'Check individual membership' }))
      .toHaveAttribute('href', 'https://unitedclubgymnastics.org/join/')
    await expect(competition.getByRole('link', { name: 'Browse the meet calendar' }))
      .toHaveAttribute('href', 'https://unitedclubgymnastics.org/events/')

    await page.goto('/adult-gymnastics#returning-gymnasts')
    await page.getByRole('link', { name: 'Find adult gymnastics with bars, beam, or vault' }).click()
    await expect(page).toHaveURL('/blog/returning-to-gymnastics-as-an-adult#adult-gymnastics-apparatus')
    const apparatus = page.locator('#adult-gymnastics-apparatus')
    await expect(apparatus.getByRole('heading', { name: 'Where can adults practice bars, beam, and vault?' })).toBeInViewport()
    await expect(apparatus.getByRole('link', { name: 'See Dynamite’s adult apparatus classes' }))
      .toHaveAttribute('href', 'https://www.dynamitegc.com/adult-gymnastics')
    await expect(apparatus.getByRole('link', { name: 'See MGA’s open gym equipment' }))
      .toHaveAttribute('href', 'https://www.mga-gymnastics.com/opengym.html')
    await apparatus.getByRole('link', { name: 'Ask Vortex about Typhoons equipment' }).click()
    await expect(page).toHaveURL('/contact#inquiry')
    await expect(page.locator('#inquiry').getByRole('heading')).toBeInViewport()
  })

  test('competitive gymnastics leads to team evaluation guidance and the scoped enrollment catalog', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route('**/api/public/classes-offered', route => route.fulfill({ json: { success: true, data: { programs: [
      { id: 2, displayName: 'Development Gymnastics', classes: [
        { id: 26, formId: 11, displayName: 'Dirt Devils', enrollVisible: true },
      ] },
      { id: 13, displayName: 'Vortex Gymnastics Team', classes: [
        { id: 40, formId: 29, displayName: 'Vortex Gymnastics Team', ageMin: 6, skillRequirements: 'Evaluation is required.', enrollVisible: true },
      ] },
    ] } } }))
    await page.route('**/api/signup/catalog/classes/40/offerings', route => route.fulfill({ json: {
      success: true, data: { formId: 29, offerings: [], costUnit: 'per_month', scheduleOptions: [
        { slotGroupId: 20, timeSlotId: 21, offeringId: null, scheduleMode: 'day', scheduleLabel: 'Monday · 17:30–19:00', priceCents: 15000 },
      ] },
    } }))

    await page.goto('/read-board')
    await page.getByRole('link', { name: 'how gymnastics team placement works' }).click()
    await expect(page).toHaveURL('/gymnastics#competitive-gymnastics-team')
    const team = page.locator('#competitive-gymnastics-team')
    await expect(team.getByRole('heading', { level: 2 })).toBeInViewport()
    await expect(team.getByRole('link', { name: 'Find a developmental Trial Assessment' })).toHaveAttribute('href', '/gymnastics#class-placement')
    await team.getByRole('link', { name: 'Contact Vortex about a team evaluation' }).click()
    await expect(page).toHaveURL('/contact#inquiry')
    const inquiry = page.locator('#inquiry')
    await expect(inquiry.getByRole('heading', { name: 'What to include in your inquiry' })).toBeInViewport()
    await inquiry.getByRole('button', { name: 'Ask Our Team' }).click()
    await expect(page.getByRole('heading', { name: 'Athlete Inquiry' })).toBeVisible()

    await page.goto('/gymnastics#competitive-gymnastics-team')
    await team.getByRole('link', { name: 'View team practice times' }).click()
    await expect(page).toHaveURL('/enroll?program=Vortex%20Gymnastics%20Team')
    await expect(page.getByRole('combobox', { name: 'Program', exact: true })).toHaveValue('13')
    await expect(page.getByRole('heading', { name: 'Dirt Devils', level: 3 })).toHaveCount(0)
    const teamCard = page.locator('.np-enrollment-class').filter({ has: page.getByRole('heading', { name: 'Vortex Gymnastics Team', level: 3 }) })
    await expect(teamCard.getByText(/Evaluation is required\./)).toBeVisible()
    await expect(teamCard.getByRole('checkbox', { name: /Monday.*17:30/ })).toBeVisible()
  })

  test('mobile visitors can find accessibility details and gym photos from a program page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/gymnastics')
    const visit = page.getByRole('region', { name: 'Visit Vortex in Bowie' })
    await visit.getByRole('link', { name: 'Parking and accessibility' }).click()
    await expect(page).toHaveURL('/contact#parking-and-accessibility')
    const accessibility = page.getByRole('region', { name: 'Parking and accessibility' })
    await expect(accessibility.getByRole('heading')).toBeInViewport()
    await expect(accessibility.getByText(/wheelchair-accessible parking and a wheelchair-accessible entrance/)).toBeVisible()
    await expect(accessibility.getByRole('link', { name: 'View the Google Maps listing' }))
      .toHaveAttribute('href', 'https://www.google.com/maps?cid=15262285316302188709')

    await page.goBack()
    await expect(page).toHaveURL('/gymnastics')
    await visit.getByRole('link', { name: 'See inside the Bowie gym' }).click()
    await expect(page).toHaveURL('/contact#inside-the-gym')
    const gym = page.getByRole('region', { name: 'Inside the Bowie gym' })
    const gymHeading = gym.getByRole('heading', { level: 2 })
    const header = page.getByRole('banner')
    await expect(header.getByRole('button', { name: 'Open menu', exact: true })).toBeVisible()
    await expect(gymHeading).toBeInViewport()
    await expect.poll(async () => {
      const [headingBounds, headerBounds] = await Promise.all([gymHeading.boundingBox(), header.boundingBox()])
      return headingBounds !== null && headerBounds !== null && headingBounds.y >= headerBounds.y + headerBounds.height
    }).toBe(true)
    await expect(gym.getByRole('img')).toHaveCount(5)
    await expect(gym.getByRole('img', { name: /Padded trampoline/ })).toHaveAttribute('src', '/gym-DSC02700-1600.webp')
    const directions = new URL(await page.getByRole('link', { name: 'Get directions to Vortex', exact: true }).getAttribute('href') ?? '')
    expect(directions.origin + directions.pathname).toBe('https://www.google.com/maps/dir/')
    expect(directions.searchParams.get('destination')).toBe('4961 Tesla Dr Suite E, Bowie, MD 20715')
    const mobileFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
    expect(mobileFits).toBe(true)
    await gym.getByRole('link', { name: 'Find a youth gymnastics starting class' }).click()
    await expect(page).toHaveURL('/gymnastics#choose-a-class')
    await expect(page.getByRole('heading', { name: 'Find the right starting class' })).toBeInViewport()

    await page.getByRole('link', { name: 'See Vortex’s practice beams and training rings' }).click()
    await expect(page).toHaveURL('/contact#gymnastics-equipment')
    const equipment = page.getByRole('region', { name: 'Balance beams and training rings' })
    await expect(equipment.getByRole('heading')).toBeInViewport()
    for (const [name, src] of [
      ['Two low balance beams beside the tumbling track at Vortex Athletics', '/gym-DSC02690-1600.webp'],
      ['Wooden training rings hanging above red and blue mats at Vortex Athletics', '/gym-DSC02672-1600.webp'],
    ]) {
      const photo = equipment.getByRole('img', { name })
      await expect(photo).toHaveAttribute('src', src)
      await photo.scrollIntoViewIfNeeded()
      await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
      await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.currentSrc)).toMatch(/-640\.webp$/)
    }
    await equipment.getByRole('link', { name: 'Ask which equipment your class uses' }).click()
    await expect(page).toHaveURL('/contact#inquiry')
    await expect(page.getByRole('heading', { name: 'What to include in your inquiry' })).toBeInViewport()
  })

  test('homepage previews and recommendations preserve the chosen enrollment program', async ({ page }) => {
    await page.route('**/api/public/classes-offered', (route) => route.fulfill({ json: { success: true, data: { programs: [
      { id: 4, displayName: 'Developmental Gymnastics', classes: [] },
      { id: 9, displayName: 'Fit & Flip', classes: [] },
    ] } } }))
    await page.goto('/')
    await page.getByRole('button', { name: 'Explore Gymnastics', exact: true }).click()
    await page.getByRole('dialog', { name: 'Gymnastics' }).getByRole('link', { name: 'Browse classes & enroll' }).click()
    await expect(page).toHaveURL('/enroll?program=Developmental%20Gymnastics')
    await expect(page.getByRole('combobox', { name: 'Program', exact: true })).toHaveValue('4')

    await page.goto('/')
    await page.getByRole('button', { name: 'Find your fit', exact: true }).click()
    await page.getByRole('button', { name: /Become a better all-around athlete/ }).click()
    await page.getByRole('button', { name: 'Explore the program', exact: true }).click()
    await page.getByRole('dialog', { name: 'Fit & Flip' }).getByRole('link', { name: 'Browse classes & enroll' }).click()
    await expect(page).toHaveURL('/enroll?program=Fit%20%26%20Flip')
    await expect(page.getByRole('combobox', { name: 'Program', exact: true })).toHaveValue('9')
  })

  test('class schedule links preserve the selected view across history and reload', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const scheduleUrl = '/read-board?utm_source=schedule-qa#schedule'
    const eventsUrl = '/read-board?utm_source=schedule-qa#events'
    await page.route('**/api/public/classes-offered', route => route.fulfill({ json: { success: true, data: { programs: [
      { id: 10, displayName: 'Adult Fitness & Acrobatics', classes: [
        { id: 20, displayName: 'Typhoons (Adult)', enrollVisible: true, formId: 3, signupUrl: '/enroll?form=3', ageMin: 18 },
        { id: 21, displayName: 'Unpublished adult class', enrollVisible: false, formId: 23 },
      ] },
    ] } } }))
    await page.goto(scheduleUrl, { waitUntil: 'domcontentloaded' })

    const tabs = page.getByRole('navigation', { name: 'Browse classes and updates' })
    const scheduleTab = tabs.getByRole('link', { name: 'Schedule', exact: true })
    const eventsTab = tabs.getByRole('link', { name: 'Events', exact: true })
    const classesTab = tabs.getByRole('link', { name: 'Classes Offered', exact: true })
    const calendar = page.locator('section#schedule').getByRole('button', { name: 'By class', exact: true })
    await expect(scheduleTab).toHaveAttribute('aria-current', 'location')
    await expect(calendar).toBeVisible()
    await expect(page.locator('section#schedule')).toContainText('Check waitlist')
    const programTimes = page.getByRole('list', { name: 'Class times by program' })
    for (const [name, href] of [
      ['Check youth gymnastics class times', '/gymnastics#youth-gymnastics-schedule'],
      ['Check Fit & Flip class times', '/fit-and-flip#fit-flip-schedule'],
      ['Check adult class times', '/adult-gymnastics#adult-class-schedule'],
    ]) {
      const link = programTimes.getByRole('link', { name, exact: true })
      await expect(link).toBeInViewport()
      await expect(link).toHaveAttribute('href', href)
    }

    await eventsTab.click()
    await expect(page).toHaveURL(eventsUrl)
    await expect(eventsTab).toHaveAttribute('aria-current', 'location')
    await expect(page.getByRole('heading', { name: 'Upcoming Events', exact: true })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(scheduleUrl)
    await expect(scheduleTab).toHaveAttribute('aria-current', 'location')
    await expect(calendar).toBeVisible()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(scheduleUrl)
    await expect(scheduleTab).toHaveAttribute('aria-current', 'location')
    await expect(calendar).toBeVisible()

    await classesTab.click()
    await expect(page).toHaveURL('/read-board?utm_source=schedule-qa#classes')
    const classes = page.getByRole('region', { name: 'Gymnastics and fitness classes in Bowie' })
    await expect(classes.getByRole('link', { name: 'Typhoons adult gymnastics' })).toHaveAttribute('href', '/adult-gymnastics')
    await expect(classes.getByRole('heading', { name: 'Typhoons (Adult)', exact: true })).toBeVisible()
    await expect(classes.getByRole('link', { name: 'Sign Up', exact: true })).toHaveAttribute('href', '/enroll?form=3')
    await expect(classes.getByText('Unpublished adult class')).toHaveCount(0)

    await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Calendar', exact: true }).click()
    await expect(page).toHaveURL('/read-board?tab=schedule')
    await expect(scheduleTab).toHaveAttribute('aria-current', 'location')
    await expect(calendar).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    await page.getByRole('banner').getByRole('link', { name: 'Schedule', exact: true }).click()
    await expect(page).toHaveURL('/read-board?tab=schedule')
    await expect(scheduleTab).toHaveAttribute('aria-current', 'location')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('the class board keeps named placement links when the live catalog fails', async ({ page }) => {
    await page.route('**/api/public/classes-offered', route => route.fulfill({
      status: 503, json: { success: false, message: 'Class catalog unavailable' },
    }))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/read-board')
    const classes = page.getByRole('region', { name: 'Gymnastics and fitness classes in Bowie' })
    await expect(classes.getByRole('link', { name: 'Dirt Devils and Twisters for ages 2–5' })).toHaveAttribute('href', '/gymnastics#preschool')
    await expect(classes.getByText('Fit & Flip Cyclones classes for ages 8–11 and 12–15', { exact: false })).toBeVisible()
    await expect(classes.getByRole('link', { name: 'Plan your first Typhoons class' })).toHaveAttribute('href', '/adult-gymnastics#adult-availability')
    await classes.getByRole('link', { name: 'Tornadoes, gymnastics Cyclones, and Vortex A4 Elite' }).click()
    await expect(page).toHaveURL('/gymnastics#class-placement')
    await expect(page.locator('#class-placement').getByRole('heading', { level: 2 })).toBeInViewport()
  })

  test('pricing opened before startup stays open and focused on each program page', async ({ browser, baseURL }) => {
    const programs = [
      { path: '/gymnastics', program: 'Developmental Gymnastics', schedule: 'youth-gymnastics-schedule', pricing: 'youth-gymnastics-pricing', label: 'Compare youth gymnastics prices' },
      { path: '/fit-and-flip', program: 'Fit & Flip', schedule: 'fit-flip-schedule', pricing: 'fit-flip-class-pricing', label: 'Compare Fit & Flip prices' },
      { path: '/adult-gymnastics', program: 'Adult Fitness & Acrobatics', schedule: 'adult-class-schedule', pricing: 'adult-class-pricing', label: 'Compare adult gymnastics prices' },
    ]
    for (const { path, program, schedule, pricing, label } of programs) {
      const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } })
      await context.addCookies([{ name: '_vortex_cid', value: 'c_test_pricing_handoff', url: baseURL }])
      const page = await context.newPage()
      let releaseEntry = () => {}
      const entryGate = new Promise<void>(resolve => { releaseEntry = resolve })
      let releaseCatalog = () => {}
      const catalogGate = new Promise<void>(resolve => { releaseCatalog = resolve })
      let releaseConsent = () => {}
      const consentGate = new Promise<void>(resolve => { releaseConsent = resolve })
      const classes = Array.from({ length: 9 }, (_, index) => ({
        id: 20 + index, formId: 20 + index, displayName: `Published class ${index + 1}`, enrollVisible: true,
      }))
      let priceRequests = 0
      await page.route('**/api/**', async route => {
        const requestPath = new URL(route.request().url()).pathname
        const json = (data: unknown) => route.fulfill({ json: { success: true, data } })
        if (requestPath === '/api/public/classes-offered') {
          await catalogGate
          return json({ programs: [{ id: 1, displayName: program, classes }] })
        }
        if (requestPath === '/api/public/drop-ins') {
          priceRequests += 1
          return json({ classes: [], sessions: [] })
        }
        if (requestPath === '/api/consent/sync/c_test_pricing_handoff') {
          await consentGate
          return route.fulfill({ json: { success: true, consent: null } })
        }
        const form = requestPath.match(/^\/api\/scheduling\/forms\/(\d+)(\/offerings)?$/)
        if (!form) return json({})
        if (form[2]) return json([])
        const formId = Number(form[1])
        return json({ id: formId, programsId: 1, isActive: true, slotGroups: [
          { id: formId, formId, offeringId: null, isActive: true, scheduleMode: 'day', occurrences: [
            { id: formId, formId, slotGroupId: formId, isActive: true, scheduleMode: 'day',
              dayOfWeek: 1, startTime: '18:00', endTime: '19:00' },
          ] },
        ] })
      })
      await page.route(url => url.pathname === '/src/main.tsx', async route => {
        await entryGate
        await route.continue()
      })
      await page.route(url => url.pathname === path, async route => {
        const response = await route.fetch()
        const html = await response.text()
        const entry = `<div id="root" data-prerendered-program="${path}">
          <div class="np-program-page">
            <section id="${schedule}">
              <div style="height:1500px"></div>
              <details class="np-class-pricing" id="${pricing}"><summary>${label}</summary><p>First response</p></details>
            </section>
            <div style="height:1000px"></div>
          </div>
        </div>`
        expect(html).toContain('<div id="root"></div>')
        await route.fulfill({ response, body: html.replace('<div id="root"></div>', entry) })
      })
      try {
        await page.goto(`${path}#${schedule}`, { waitUntil: 'commit' })
        await expect(page.getByText('First response', { exact: true })).toHaveCount(1)
        const details = page.locator(`#${pricing}`)
        const summary = details.locator('summary')
        await summary.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
        await summary.press('Enter')
        await expect(details).toHaveAttribute('open', '')
        await expect(summary).toBeFocused()
        await expect(summary).toBeInViewport()

        releaseEntry()
        await expect(page.getByText('First response', { exact: true })).toHaveCount(0)
        await expect(details).toHaveAttribute('open', '')
        await expect(summary).toBeFocused()
        await expect(page).toHaveURL(`${path}#${schedule}`)
        releaseCatalog()
        await expect(page.locator('.np-recurring-schedule').getByText('Published class 9', { exact: false })).toBeVisible()
        const consent = page.getByRole('dialog', { name: 'Cookie consent' })
        await expect(consent).toHaveCount(0)
        releaseConsent()
        await expect(consent).toBeVisible()
        await expect.poll(() => summary.evaluate(element => {
          const { x, y, width, height } = element.getBoundingClientRect()
          return element.contains(document.elementFromPoint(x + width / 2, y + height / 2))
        })).toBe(true)
        await expect(summary).toBeFocused()
        await expect.poll(() => priceRequests).toBe(1)
      } finally {
        releaseEntry()
        releaseCatalog()
        releaseConsent()
        await context.close()
      }
    }
  })

  test('keyboard pricing links focus the opened comparison', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route('**/api/public/classes-offered', route => route.fulfill({ json: {
      success: true, data: { programs: [] },
    } }))
    await page.route('**/api/public/drop-ins', route => route.fulfill({ json: {
      success: true, data: { sessions: [] },
    } }))

    for (const { from, name, to, id } of [
      { from: '/gymnastics', name: 'Compare youth gymnastics prices', to: '/gymnastics', id: 'youth-gymnastics-pricing' },
      { from: '/fit-and-flip', name: 'Compare monthly and drop-in prices', to: '/fit-and-flip', id: 'fit-flip-class-pricing' },
      { from: '/blog/returning-to-gymnastics-as-an-adult', name: 'Compare monthly enrollment and drop-in prices', to: '/adult-gymnastics', id: 'adult-class-pricing' },
    ]) {
      await page.goto(from)
      await page.getByRole('link', { name, exact: true }).press('Enter')
      await expect(page).toHaveURL(`${to}#${id}`)
      const pricing = page.locator(`#${id}`)
      const summary = pricing.locator('summary')
      await expect(pricing).toHaveAttribute('open', '')
      await expect(summary).toBeFocused()
      await expect(summary).toBeInViewport({ ratio: 1 })
      await page.keyboard.press('Tab')
      await expect(pricing.getByRole('link', { name: 'Terms of Service', exact: true })).toBeFocused()
    }

    await page.goBack()
    await expect(page).toHaveURL('/blog/returning-to-gymnastics-as-an-adult')
    await page.goForward()
    await expect(page).toHaveURL('/adult-gymnastics#adult-class-pricing')
    const adultPricing = page.locator('#adult-class-pricing')
    await expect(adultPricing).toHaveAttribute('open', '')
    await expect(adultPricing.locator('summary')).not.toBeFocused()

    await page.goto('/gymnastics#youth-gymnastics-pricing')
    const youthPricing = page.locator('#youth-gymnastics-pricing')
    await expect(youthPricing).toHaveAttribute('open', '')
    await expect(youthPricing.locator('summary')).toBeInViewport({ ratio: 1 })
    await expect(youthPricing.locator('summary')).not.toBeFocused()
  })

  test('the youth gymnastics page lists published weekly times and keeps class levels distinct', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.clock.setFixedTime(new Date('2027-01-12T18:00:00Z'))
    const developmentalProgram = 2
    const enrollmentClass = (formId: number, displayName: string, skillLevel: string, enrollVisible = true) =>
      ({ id: formId, formId, displayName, skillLevel, enrollVisible })
    const classes = [
      enrollmentClass(9, 'Tornadoes', 'BEGINNER'),
      { ...enrollmentClass(22, 'Cyclones', 'INTERMEDIATE'), skillRequirements: 'Forward roll, handstand and round-off.', excludeFromDropIns: true },
      { ...enrollmentClass(14, 'Hidden class', 'ADVANCED', false), skillRequirements: 'Hidden placement requirement.' },
      enrollmentClass(15, 'Expired class', 'ADVANCED'),
      enrollmentClass(16, 'Different program form', 'ADVANCED'),
    ]
    await page.route('**/api/public/classes-offered', (route) => route.fulfill({ json: {
      success: true, data: { programs: [
        { id: developmentalProgram, displayName: 'Development Gymnastics', classes,
          pricingCostOptions: [{ key: 'monthly_flat', enabled: true, amountCents: 99999 }] },
        { id: 9, displayName: 'Fit & Flip', classes: [enrollmentClass(30, 'Cyclones (8–11)', 'BEGINNER')] },
        { id: 13, displayName: 'Vortex Gymnastics Team', classes: [enrollmentClass(31, 'Team', 'ADVANCED')] },
      ] },
    } }))
    const requestedForms = new Set<number>()
    await page.route(/\/api\/scheduling\/forms\/\d+(?:\/offerings)?$/, (route) => {
      const [, id, offerings] = new URL(route.request().url()).pathname.match(/\/(\d+)(\/offerings)?$/)!
      const formId = Number(id)
      requestedForms.add(formId)
      const offeringId = formId + 100
      const slot = { formId, isActive: true, scheduleMode: 'day', dayOfWeek: 2,
        dayName: 'Tuesday', startTime: '16:00', endTime: '17:30' }
      const data = offerings ? [{ id: offeringId, formId, endDate: formId === 15 ? '2026-12-31' : null }] : {
        id: formId, isActive: true, programsId: formId === 16 ? 9 : developmentalProgram,
        slotGroups: [{ id: formId, formId, offeringId, isActive: true, scheduleMode: 'day', occurrences: [slot] }],
      }
      return route.fulfill({ json: { success: true, data } })
    })

    await page.goto('/gymnastics#youth-gymnastics-schedule')
    const schedule = page.getByRole('region', { name: 'Weekly youth gymnastics class schedule' })
    await expect(schedule.getByRole('heading')).toBeInViewport()
    await expect(schedule.locator('.np-recurring-schedule summary')).toHaveText(['Tornadoes Beginner', 'Cyclones Intermediate'])
    const times = schedule.getByText('Tuesday · 4:00 PM – 5:30 PM', { exact: true })
    await expect(times.first()).toBeHidden()
    await schedule.getByText('Tornadoes Beginner', { exact: true }).click()
    await expect(times.first()).toBeVisible()
    await expect(schedule.getByText('Forward roll, handstand and round-off.')).toBeHidden()
    await schedule.getByText('Cyclones Intermediate', { exact: true }).click()
    await expect(schedule.getByText('Forward roll, handstand and round-off.')).toBeVisible()
    await expect(schedule.getByText('Hidden placement requirement.')).toHaveCount(0)
    await expect(schedule.getByRole('link', { name: 'Check dates and availability' }))
      .toHaveAttribute('href', '/enroll?program=Developmental%20Gymnastics')
    expect([...requestedForms].sort((a, b) => a - b)).toEqual([9, 15, 16, 22])

    await page.route(/\/api\/signup\/catalog\/classes\/(9|22)\/offerings$/, (route) => {
      expect(route.request().headers().authorization).toBeUndefined()
      const formId = Number(new URL(route.request().url()).pathname.split('/').at(-2))
      const option = { scheduleMode: 'day', slotGroupId: formId, offeringId: formId + 100 }
      return route.fulfill({ json: { success: true, data: {
        formId, costUnit: formId === 9 ? 'per_month' : 'per_class',
        scheduleOptions: [
          { ...option, priceCents: 15000 },
          { ...option, priceCents: 16000 },
          { ...option, offeringId: 999, priceCents: 1000 },
          { ...option, scheduleMode: 'date', priceCents: 2000 },
        ],
      } } })
    })
    await page.route('**/api/public/drop-ins', (route) => {
      expect(route.request().headers().authorization).toBeUndefined()
      const youth = { programName: 'Development Gymnastics', classId: 9, date: classDate, totalCents: 5000, isFull: false }
      return route.fulfill({ json: { success: true, data: { sessions: [
        youth,
        { ...youth, totalCents: 1000, isFull: true },
        { ...youth, totalCents: 2000, excludedFromDropIns: true },
        { ...youth, programName: 'Fit & Flip', totalCents: 3000 },
      ] } } })
    })
    await page.getByRole('link', { name: 'Compare youth gymnastics prices' }).click()
    await expect(page).toHaveURL('/gymnastics#youth-gymnastics-pricing')
    const pricing = page.locator('#youth-gymnastics-pricing')
    await expect(pricing.getByRole('table')).toBeVisible()
    const tornadoesPricing = pricing.getByRole('row', { name: /Tornadoes/ })
    await expect(tornadoesPricing.getByRole('cell')).toHaveText(['$150.00–$160.00', '$50.00'])
    await expect(tornadoesPricing.getByRole('link', { name: 'Tornadoes' }))
      .toHaveAttribute('href', '/enroll?program=Developmental%20Gymnastics&form=9')
    await expect(pricing.getByRole('row', { name: /Cyclones/ }).getByRole('cell')).toHaveText(['See enrollment', 'Unavailable'])
    await expect(pricing.getByRole('link', { name: 'Find a free gymnastics trial' })).toHaveAttribute('href', '/gymnastics#first-visit')
    await pricing.getByRole('link', { name: 'Review available drop-in dates' }).click()
    await expect(page).toHaveURL('/drop-in?program=Developmental%20Gymnastics')
    await expect(page.getByRole('heading', { name: 'Youth gymnastics drop-ins.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tornadoes' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Fit & Flip|Cyclones/ })).toHaveCount(0)
  })

  test('Fit & Flip compares current prices by program without using member benefits', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const program = 'Fit & Flip'
    const groups = [
      { id: 41, formId: 30, displayName: 'Cyclones (8–11)', ageMin: 8, priceCents: 15000 },
      { id: 42, formId: 31, displayName: 'Cyclones (12–15)', ageMin: 12, priceCents: 16000 },
    ]
    let scheduleRequests = 0
    await page.route('**/api/public/classes-offered', route => {
      scheduleRequests += 1
      return route.fulfill({ json: { success: true, data: {
        programs: [{ id: 9, displayName: program, classes: groups.map(group => ({ ...group, enrollVisible: true })) }],
      } } })
    })
    const priceRequests: { path: string; authorization?: string }[] = []
    for (const { id, formId, priceCents } of groups) {
      const offeringId = formId + 100
      const groupId = formId + 200
      const slot = { formId, isActive: true, scheduleMode: 'day', dayOfWeek: 2,
        dayName: 'Tuesday', startTime: '18:00', endTime: '19:30' }
      await page.route(`**/api/scheduling/forms/${formId}`, route => route.fulfill({ json: { success: true, data: {
        id: formId, isActive: true, programsId: 9,
        slotGroups: [{ id: groupId, formId, offeringId, isActive: true, scheduleMode: 'day', occurrences: [slot] }],
      } } }))
      await page.route(`**/api/scheduling/forms/${formId}/offerings`, route => route.fulfill({ json: { success: true, data: [{ id: offeringId, formId }] } }))
      await page.route(`**/api/signup/catalog/classes/${id}/offerings`, route => {
        const request = route.request()
        priceRequests.push({ path: new URL(request.url()).pathname, authorization: request.headers().authorization })
        return route.fulfill({ json: { success: true, data: {
          formId, costUnit: 'per_month', scheduleOptions: [
            { scheduleMode: 'day', slotGroupId: groupId, offeringId, priceCents },
            { scheduleMode: 'day', slotGroupId: groupId, offeringId: 999, priceCents: 1000 },
          ],
        } } })
      })
    }
    await page.route('**/api/public/drop-ins', route => {
      const request = route.request()
      priceRequests.push({ path: new URL(request.url()).pathname, authorization: request.headers().authorization })
      return route.fulfill({ json: { success: true, data: { sessions: [
        { programName: program, totalCents: 5000, isFull: false },
        { programName: program, totalCents: 6000, isFull: false },
        { programName: program, totalCents: 2000, isFull: true },
        { programName: program, totalCents: 1000, excludedFromDropIns: true },
        { programName: 'Adult Fitness & Acrobatics', totalCents: 2500, isFull: false },
      ] } } })
    })

    await page.goto('/fit-and-flip', { waitUntil: 'networkidle' })
    expect(scheduleRequests).toBe(0)
    const schedule = page.getByRole('region', { name: 'Recurring Fit & Flip class times' })
    await schedule.locator('.np-class-pricing').scrollIntoViewIfNeeded()
    await expect(schedule.locator('.np-recurring-schedule > ul > li')).toContainText(['Cyclones (8–11)', 'Cyclones (12–15)'])
    expect(scheduleRequests).toBe(1)
    expect(priceRequests).toEqual([])
    await page.evaluate(() => localStorage.setItem('vortex_member_token', 'test-member-token'))
    await page.goto('/blog/youth-sports-bowie')
    await page.getByRole('link', { name: 'Compare Fit & Flip prices', exact: true }).click()
    await expect(page).toHaveURL('/fit-and-flip#fit-flip-class-pricing')
    const pricing = page.locator('#fit-flip-class-pricing')
    await expect(pricing).toHaveAttribute('open', '')
    await expect(pricing.getByText('$150.00–$160.00 per month', { exact: true })).toBeVisible()
    await expect(pricing.getByText('$50.00–$60.00 per class', { exact: true })).toBeVisible()
    await expect(pricing.getByText('$0 on qualifying dates', { exact: true })).toBeVisible()
    await expect(pricing.getByText(/Paid monthly enrollment requires an active annual membership/)).toBeVisible()
    await expect(pricing.getByRole('link', { name: 'Review monthly enrollment' })).toHaveAttribute('href', '/enroll?program=Fit%20%26%20Flip')
    await expect(pricing.getByRole('link', { name: 'Review available drop-in dates' })).toHaveAttribute('href', '/drop-in?program=Fit%20%26%20Flip')
    await expect(pricing.getByRole('link', { name: 'Find a free Fit & Flip trial' })).toHaveAttribute('href', '/fit-and-flip#training-fit')
    expect(priceRequests.map(({ path }) => path).sort()).toEqual([
      '/api/public/drop-ins', '/api/signup/catalog/classes/41/offerings', '/api/signup/catalog/classes/42/offerings',
    ])
    await pricing.locator('summary').click()
    await expect(pricing).not.toHaveAttribute('open', '')
    await page.getByRole('link', { name: 'Compare monthly and drop-in prices', exact: true }).click()
    await expect(pricing).toHaveAttribute('open', '')
    await expect(pricing.getByText('$150.00–$160.00 per month', { exact: true })).toBeVisible()
    expect(priceRequests.every(({ authorization }) => authorization === undefined)).toBe(true)
  })

  test('Day view labels full classes and preserves the selected date and time', async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${classDate}T12:00:00`))
    const events = [
      cyclones,
      { ...cyclones, id: 'full', className: 'Full Cyclones', slotGroupId: 99, timeSlotId: 108,
        startTime: '19:00', signupCount: 6, spotsRemaining: 0, isFull: true },
      { ...cyclones, id: 'cancelled', className: 'Cancelled Cyclones', isCancelled: true },
      { ...cyclones, id: 'assessment', className: 'Trial Assessment', isTrialAssessment: true },
      { ...cyclones, id: 'past', className: 'Earlier Cyclones', date: earlierDate },
    ]
    await page.route('**/api/scheduling/calendar?*', route => route.fulfill({
      json: { success: true, data: { year: 2027, month: 1, events, tbdPatterns: [] } },
    }))
    await page.route('**/api/public/scheduling/classes', route => route.fulfill({
      json: { success: true, data: [] },
    }))

    await page.goto('/read-board#schedule')
    const calendar = page.locator('section#schedule')
    await calendar.getByRole('button', { name: /^day$/i }).click()
    await expect(calendar.getByText('Fit & Flip · Cancelled Cyclones', { exact: true })).toBeVisible()
    await expect(calendar.getByText('Fit & Flip · Trial Assessment', { exact: true })).toBeVisible()

    const signup = calendar.getByRole('link', { name: 'Sign Up', exact: true })
    const waitlist = calendar.getByRole('link', { name: 'Check waitlist', exact: true })
    await expect(signup).toHaveCount(1)
    await expect(signup).toHaveAttribute('href',
      `/enroll?form=30&offeringId=18&slotGroupId=98&timeSlotId=107&enrollmentStartDate=${classDate}`)
    await expect(waitlist).toHaveCount(1)
    await expect(waitlist).toHaveAttribute('href',
      `/enroll?form=30&offeringId=18&slotGroupId=99&timeSlotId=108&enrollmentStartDate=${classDate}`)

    await calendar.getByRole('button', { name: 'Previous period', exact: true }).click()
    await expect(calendar.getByText('Fit & Flip · Earlier Cyclones', { exact: true })).toBeVisible()
    await expect(signup).toHaveCount(0)
    await expect(waitlist).toHaveCount(0)
  })

  test('Day view keeps the selected date when an older calendar request finishes last', async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${classDate}T12:00:00`))
    let releaseToday = () => {}
    let finishToday = () => {}
    const holdToday = new Promise<void>(resolve => { releaseToday = resolve })
    const todayFinished = new Promise<void>(resolve => { finishToday = resolve })
    await page.route('**/api/scheduling/calendar?*', async route => {
      const params = new URL(route.request().url()).searchParams
      const start = params.get('startDate')
      const isToday = start === classDate && params.get('endDate') === classDate
      if (isToday) await holdToday
      const events = start === earlierDate
        ? [{ ...cyclones, id: 'earlier', date: earlierDate, className: 'Earlier Cyclones' }]
        : isToday ? [cyclones] : []
      const response = { json: { success: true, data: { year: 2027, month: 1, events, tbdPatterns: [] } } }
      if (isToday) {
        try {
          await route.fulfill(response)
        } catch (error) {
          if (!route.request().failure()?.errorText.includes('ABORTED')) throw error
        } finally {
          finishToday()
        }
      } else {
        await route.fulfill(response)
      }
    })
    await page.route('**/api/public/scheduling/classes', route => route.fulfill({
      json: { success: true, data: [] },
    }))

    try {
      await page.goto('/read-board#schedule')
      const calendar = page.locator('section#schedule')
      const todayRequest = page.waitForRequest(request => {
        const url = new URL(request.url())
        return url.pathname === '/api/scheduling/calendar' && url.searchParams.get('startDate') === classDate
      })
      await calendar.getByRole('button', { name: /^day$/i }).click()
      await todayRequest
      await calendar.getByRole('button', { name: 'Previous period', exact: true }).click()
      const earlierClass = calendar.getByText('Fit & Flip · Earlier Cyclones', { exact: true })
      await expect(earlierClass).toBeVisible()
      releaseToday()
      await todayFinished
      // Let the stale fetch and a subsequent React render finish if the request was not aborted.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
      await expect(earlierClass).toBeVisible()
    } finally {
      releaseToday()
    }
  })

  test('account login modal opens from public flow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const memberLogin = page.getByRole('button', { name: 'Member login', exact: true })
    await memberLogin.click()
    await expect(page.getByRole('heading', { name: 'Account Login' })).toBeVisible()
    await expect(page.getByText('Forgot password?')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(memberLogin).toBeFocused()
  })
})
