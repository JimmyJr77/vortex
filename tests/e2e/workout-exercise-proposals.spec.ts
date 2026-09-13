import { stagedReviewEvidenceFixture } from '../../backend/platform/__tests__/canonicalStagedReviewEvidenceFixtures.js'
import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

test.skip(process.env.VORTEX_PROGRAMMING_SYNTHETIC_PREVIEW !== '1', 'Requires the isolated programming preview server')
test.describe.configure({ mode: 'serial' })
const base = '/api/coach/workout-programming'
const proposalName = 'Synthetic new movement concept'
const workspace = (page: Page) => page.getByRole('region', { name: 'Exercise library research', exact: true })
const staged = (page: Page) => page.getByRole('region', { name: 'Staged delivery profile revision', exact: true })
const review = (page: Page) => page.getByRole('region', { name: 'Exercise proposal review', exact: true })

test.beforeEach(async ({ page, request }) => {
  expect((await request.post('/__preview/reset')).ok()).toBeTruthy()
  await page.goto('/tests/fixtures/workout-programming.html')
  await expect(page.getByRole('button', { name: 'Generate & review session' })).toBeEnabled()
})

async function configure(page: Page) {
  for (const [label, value] of [['Athletes', '15'], ['Youngest age', '12'], ['Oldest age', '14'], ['Coaches', '2']]) {
    await page.getByRole('spinbutton', { name: label, exact: true }).fill(value)
  }
  await page.getByRole('combobox', { name: 'Training experience', exact: true }).selectOption('intermediate')
  await page.getByRole('button', { name: 'Research exercise needs & proposals' }).click()
  const panel = workspace(page)
  await expect(panel.getByRole('textbox', { name: 'Movement name', exact: true })).toBeEnabled()
  await panel.getByRole('textbox', { name: 'Movement name', exact: true }).fill(proposalName)
  await panel.getByRole('textbox', { name: 'Unmet movement demand', exact: true }).fill('Develop a missing movement stimulus with a reviewed coaching progression.')
  await panel.getByRole('listbox', { name: 'Demand movement patterns', exact: false }).selectOption({ index: 0 })
  await panel.getByRole('listbox', { name: 'Demand body regions', exact: false }).selectOption({ index: 0 })
}

async function research(page: Page) {
  const pending = page.waitForResponse((response) => response.url().endsWith(`${base}/exercise-gap/research`))
  await workspace(page).getByRole('button', { name: 'Research library coverage' }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  await expect(workspace(page).getByRole('heading', { name: `Coverage research for ${proposalName}` })).toBeVisible()
  return (await response.json()).data
}

async function propose(page: Page) {
  const pending = page.waitForResponse((response) => response.url().endsWith(`${base}/exercise-gap/propose`))
  await workspace(page).getByRole('button', { name: 'Assess gap & propose content' }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  return (await response.json()).data
}

async function stageProfile(page: Page, request: APIRequestContext, complete = false) {
  if (complete) expect((await request.post('/__preview/exercise-proposals', { data: { completeSyntheticSource: true } })).ok()).toBe(true)
  await configure(page); await research(page)
  await request.post('/__preview/exercise-proposals', { data: { mode: 'profile' } })
  const proposal = await propose(page)
  await staged(page).getByRole('checkbox', { name: 'I reviewed this proposal and want to stage an unapproved revision of the existing card.' }).check()
  const pending = page.waitForResponse((response) => response.url().endsWith('/stage-revision'))
  await staged(page).getByRole('button', { name: 'Stage profile revision' }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toEqual({ expectedProposalHash: proposal.contentHash })
  const { event } = (await response.json()).data
  await expect(staged(page).getByRole('status').filter({ hasText: 'Revision status:' })).toContainText('Revision status: Draft')
  return event
}

async function changeRevision(page: Page, action: string, summary: string) {
  await staged(page).getByRole('textbox', { name: 'Revision change summary', exact: false }).fill(summary)
  const pending = page.waitForResponse((response) => response.url().endsWith('/change'))
  await staged(page).getByRole('button', { name: action, exact: true }).click()
  return pending
}

const independentReview = (page: Page) => page.getByRole('region', { name: 'Independent staged revision review', exact: true })
async function prepareReview(page: Page, request: APIRequestContext) {
  let event = await stageProfile(page, request, true)
  const profile = stagedReviewEvidenceFixture().event.card.variants[0].profiles.at(-1)!
  profile.profileKey = event.target.profileKey
  for (const input of [{ action: 'edit', profile }, { action: 'submit' }]) {
    const result = await request.post(`${base}/staged-card-revisions/${event.stagedRevisionId}/change`, { data: {
      ...input, expectedEventHash: event.contentHash, changeSummary: 'Prepare a complete synthetic candidate for browser review verification.',
    } })
    expect(result.status(), await result.text()).toBe(200); event = (await result.json()).data
  }
  await staged(page).getByRole('button', { name: 'Refresh staged revision' }).click()
  await expect(independentReview(page)).toContainText('An independent coach must review this revision.')
  await expect(independentReview(page).getByRole('combobox', { name: 'Review category' })).toHaveCount(0)
  await request.post('/__preview/exercise-proposals', { data: { syntheticReviewer: '8' } })
  await staged(page).getByRole('button', { name: 'Refresh staged revision' }).click()
  await expect(independentReview(page).getByRole('combobox', { name: 'Review category' })).toBeEnabled()
  return event
}
async function draftClassification(page: Page, record: string, outcome = 'approve') {
  const panel = independentReview(page)
  await panel.getByRole('combobox', { name: 'Classification to review' }).selectOption(record)
  await panel.getByRole('combobox', { name: 'Classification decision' }).selectOption(outcome)
  await panel.getByRole('textbox', { name: 'Staged reviewer evidence', exact: false }).fill('Synthetic browser observation of this exact saved profile classification.')
}
async function saveReview(page: Page, button: string) {
  const response = page.waitForResponse((item) => item.url().endsWith('/reviews'))
  await independentReview(page).getByRole('button', { name: button, exact: true }).click()
  const result = await response
  if (result.ok()) await expect(independentReview(page).getByText('Unsaved review evidence.', { exact: false })).toHaveCount(0)
  return result
}

test('independent coaches inspect the complete candidate, record real review contracts, and invalidate approval with later evidence', async ({ page, request }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message))
  const event = await prepareReview(page, request)
  const source = (await (await request.get('/__preview/state')).json()).exerciseProposals.sourceCard
  const panel = independentReview(page)
  await panel.getByRole('button', { name: 'Inspect complete proposed card' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Read-only inspection · version 2')
  await expect(dialog.getByRole('combobox', { name: 'Delivery profile', exact: true })).toHaveValue(event.target.profileKey)
  await expect(dialog.getByRole('textbox', { name: 'Canonical name', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: /Save|Publish|Approve|Record.*review/ })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close canonical card editor' }).click()
  const records = await panel.getByRole('combobox', { name: 'Classification to review' }).locator('option').evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value).filter(Boolean))
  expect(records.length).toBeGreaterThan(1)
  for (const record of records) {
    await draftClassification(page, record)
    await expect(staged(page).getByRole('textbox', { name: 'Purpose', exact: true })).toBeDisabled()
    await expect(staged(page).getByRole('button', { name: 'Refresh staged revision' })).toBeDisabled()
    await expect(page.getByRole('spinbutton', { name: 'Athletes', exact: true })).toBeDisabled()
    expect((await saveReview(page, 'Record classification review')).status()).toBe(200)
  }
  await panel.getByRole('combobox', { name: 'Review category' }).selectOption('media')
  await expect(panel.getByRole('checkbox').first()).not.toBeChecked()
  await expect(panel.getByRole('button', { name: 'Record staged media review' })).toBeDisabled()
  await panel.getByRole('spinbutton', { name: 'Observed demonstration quality (1–100)' }).fill('90')
  await panel.getByRole('combobox', { name: 'Playback status' }).selectOption('healthy')
  await panel.getByRole('combobox', { name: 'Exact card match' }).selectOption('yes')
  await panel.getByRole('textbox', { name: 'Observed review evidence' }).fill('Synthetic manual playback observations for browser verification only.')
  for (const checkbox of await panel.getByRole('checkbox').all()) await checkbox.check()
  expect((await saveReview(page, 'Record staged media review')).status()).toBe(200)
  await expect(panel).toContainText('All publication readiness gates pass.')
  await panel.getByRole('combobox', { name: 'Review category' }).selectOption('card')
  await panel.getByRole('textbox', { name: 'Staged reviewer evidence', exact: false }).fill('Synthetic independent review of the complete candidate and current evidence.')
  await expect(panel.getByRole('button', { name: 'Approve complete candidate' })).toBeDisabled()
  await panel.getByRole('checkbox', { name: 'I personally reviewed this complete candidate', exact: false }).check()
  expect((await saveReview(page, 'Approve complete candidate')).status()).toBe(200)
  await expect(panel).toContainText('Candidate approved by coach 8')
  await expect(panel).toContainText('Publication is still pending.')
  await panel.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/private/tmp/vortex-staged-review-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await panel.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '/private/tmp/vortex-staged-review-mobile.png' })
  await draftClassification(page, records[0], 'reject')
  expect((await saveReview(page, 'Record classification review')).status()).toBe(200)
  await expect(panel).toContainText('This candidate has no current full-card approval.')
  const after = (await (await request.get('/__preview/state')).json()).exerciseProposals
  expect(after.sourceCard).toEqual(source); expect(after.cardCount).toBe(0)
  expect(errors).toEqual([])
})

test('concurrent staged reviews preserve local evidence until discard and refresh', async ({ page, request }) => {
  const event = await prepareReview(page, request)
  const panel = independentReview(page)
  const record = await panel.getByRole('combobox', { name: 'Classification to review' }).locator('option').nth(1).getAttribute('value')
  await draftClassification(page, record!)
  const [recordType, facetType, termKey] = JSON.parse(record!)
  const other = await request.post(`${base}/staged-card-revisions/${event.stagedRevisionId}/reviews`, { data: {
    expectedEventHash: event.contentHash, kind: 'taxonomy', recordType, facetType, ...(termKey ? { termKey } : {}), outcome: 'reject',
    notes: 'Synthetic separate browser review changed the staged evidence before this save.',
  } })
  expect(other.status()).toBe(200)
  expect((await saveReview(page, 'Record classification review')).status()).toBe(409)
  await expect(panel.getByRole('textbox', { name: 'Staged reviewer evidence', exact: false })).toContainText('Synthetic browser observation')
  await expect(panel.getByRole('button', { name: 'Record classification review' })).toBeDisabled()
  await panel.getByRole('button', { name: 'Discard review evidence' }).click()
  await staged(page).getByRole('button', { name: 'Refresh staged revision' }).click()
  await expect(panel.getByRole('combobox', { name: 'Review category' })).toBeEnabled()
  await panel.getByText('Recorded review evidence · 1', { exact: true }).click()
  await expect(panel).toContainText('Synthetic separate browser review changed')
})

test('an interrupted review response recovers recorded evidence before retrying', async ({ page, request }) => {
  await prepareReview(page, request)
  const panel = independentReview(page)
  const record = await panel.getByRole('combobox', { name: 'Classification to review' }).locator('option').nth(1).getAttribute('value')
  await draftClassification(page, record!)
  await page.route('**/staged-card-revisions/*/reviews', async (route) => {
    expect((await route.fetch()).status()).toBe(200)
    await route.abort('failed')
  }, { times: 1 })
  await panel.getByRole('button', { name: 'Record classification review' }).click()
  await expect(staged(page)).toContainText('The save outcome could not be confirmed.')
  await expect(panel.getByRole('button', { name: 'Record classification review' })).toBeDisabled()
  await panel.getByRole('button', { name: 'Discard review evidence' }).click()
  await staged(page).getByRole('button', { name: 'Refresh staged revision' }).click()
  await expect(panel.getByText('Recorded review evidence · 1', { exact: true })).toBeVisible()
  await expect(panel.getByRole('combobox', { name: 'Review category' })).toBeEnabled()
  expect((await (await request.get('/__preview/state')).json()).exerciseProposals.stagedEventCount).toBe(4)
})

test('staged profile edits, review transitions and history recovery preserve the published source', async ({ page, request }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message))
  const event = await stageProfile(page, request)
  const before = (await (await request.get('/__preview/state')).json()).exerciseProposals
  const panel = staged(page)
  await expect(panel.getByRole('textbox', { name: 'Canonical name', exact: true })).toHaveCount(0)
  await expect(panel.getByRole('textbox', { name: 'Profile key', exact: true })).toHaveCount(0)
  await panel.getByRole('textbox', { name: 'Purpose', exact: true }).fill('Coach-reviewed strength delivery for the same exact movement.')
  await panel.getByRole('spinbutton', { name: 'Rest seconds', exact: true }).fill('90')
  await panel.getByRole('textbox', { name: 'Stop rules', exact: true }).fill('Stop at loss of movement quality.\nStop if the prescribed rhythm cannot be maintained.')
  await panel.getByText('Profile classifications', { exact: true }).click()
  await panel.getByRole('combobox', { name: 'Add Athleticism tenet term', exact: true }).selectOption('strength')
  await expect(page.getByRole('spinbutton', { name: 'Athletes', exact: true })).toBeDisabled()
  await expect(review(page).getByRole('button', { name: 'Refresh proposal status' })).toBeDisabled()
  await expect(panel.getByRole('button', { name: 'Submit revision for review' })).toBeDisabled()
  const saved = await changeRevision(page, 'Save profile changes', 'Adjusted recovery and quality cues after reviewing the proposal.')
  expect(saved.status()).toBe(200)
  const payload = saved.request().postDataJSON()
  expect(Object.keys(payload).sort()).toEqual(['action', 'changeSummary', 'expectedEventHash', 'profile'])
  expect(payload.expectedEventHash).toBe(event.contentHash)
  expect(payload.profile.dosage.restSeconds).toBe(90)
  expect(payload.profile.stopRules).toHaveLength(2)
  expect(payload.profile.taxonomyV2.assignments[0]).toMatchObject({ key: 'strength', reviewStatus: 'suggested' })
  await expect(panel.getByRole('button', { name: 'Discard profile changes' })).toHaveCount(0)
  const submitted = await changeRevision(page, 'Submit revision for review', 'Ready for independent profile review and evidence collection.')
  expect(submitted.status()).toBe(200)
  await expect(panel.getByRole('status').filter({ hasText: 'Revision status:' })).toContainText('Awaiting review')
  await page.reload()
  await page.getByRole('button', { name: 'Research exercise needs & proposals' }).click()
  await workspace(page).getByText('Exercise proposal history · 1', { exact: true }).click()
  await workspace(page).getByRole('button', { name: new RegExp(`^${proposalName}`) }).click()
  await expect(panel.getByRole('status').filter({ hasText: 'Revision status:' })).toContainText('Awaiting review')
  await expect(panel.getByRole('spinbutton', { name: 'Rest seconds', exact: true })).toHaveValue('90')
  expect((await changeRevision(page, 'Return revision to draft', 'Return to draft for the next coaching review pass.')).status()).toBe(200)
  await expect(panel.getByRole('status').filter({ hasText: 'Revision status:' })).toContainText('Draft')
  await panel.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/private/tmp/vortex-staged-profile-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await panel.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '/private/tmp/vortex-staged-profile-mobile.png' })
  expect((await changeRevision(page, 'Archive revision', 'Archive the synthetic revision after completing this review.')).status()).toBe(200)
  await expect(panel.getByRole('status').filter({ hasText: 'Revision status:' })).toContainText('Archived')
  await expect(panel.getByRole('button', { name: 'Save profile changes' })).toHaveCount(0)
  await expect(panel.getByRole('textbox', { name: 'Purpose', exact: true })).toBeDisabled()
  const after = (await (await request.get('/__preview/state')).json()).exerciseProposals
  expect(after.sourceCard).toEqual(before.sourceCard)
  expect(after.cardCount).toBe(0); expect(after.creatorCalls).toBe(1); expect(after.stagedEventCount).toBe(5)
  expect(errors).toEqual([])
})

test('invalid profile fields preserve edits and prevent review status changes', async ({ page, request }) => {
  await stageProfile(page, request)
  const panel = staged(page)
  await panel.getByText('Advanced programming fields', { exact: true }).click()
  await panel.getByRole('textbox', { name: 'Time model', exact: true }).fill('{invalid')
  await panel.getByRole('textbox', { name: 'Revision change summary', exact: false }).fill('Test invalid structured timing before saving any changes.')
  await expect(panel.getByRole('alert')).toContainText('Time model must be a valid JSON object.')
  await expect(panel.getByRole('button', { name: 'Save profile changes' })).toBeDisabled()
  await panel.getByRole('button', { name: 'Discard profile changes' }).click()
  await panel.getByRole('spinbutton', { name: 'Minimum sets', exact: true }).fill('4')
  const invalid = await changeRevision(page, 'Save profile changes', 'Test a reversed set range against canonical validation.')
  expect(invalid.status()).toBe(400)
  await expect(panel.getByRole('spinbutton', { name: 'Minimum sets', exact: true })).toHaveValue('4')
  await expect(panel.getByRole('button', { name: 'Submit revision for review' })).toBeDisabled()
  expect((await (await request.get('/__preview/state')).json()).exerciseProposals.stagedEventCount).toBe(1)
  await panel.getByRole('button', { name: 'Discard profile changes' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Athletes', exact: true })).toBeEnabled()
})

test('stale sources block submission, refresh explains the mismatch and archival remains available', async ({ page, request }) => {
  await stageProfile(page, request)
  await request.post('/__preview/exercise-proposals', { data: { changeProfileSource: true } })
  expect((await changeRevision(page, 'Submit revision for review', 'Submit the candidate after the published source was changed.')).status()).toBe(409)
  const panel = staged(page)
  await panel.getByRole('button', { name: 'Refresh staged revision' }).click()
  await expect(panel.getByRole('alert')).toContainText('The published source changed.')
  await expect(panel.getByRole('textbox', { name: 'Purpose', exact: true })).toBeDisabled()
  await expect(panel.getByRole('button', { name: 'Submit revision for review' })).toBeDisabled()
  expect((await changeRevision(page, 'Archive revision', 'Archive stale revision and research the current source.')).status()).toBe(200)
  await expect(panel.getByRole('status').filter({ hasText: 'Revision status:' })).toContainText('Archived')
})

test('concurrent edits cannot overwrite the saved revision and local edits remain recoverable', async ({ page, request }) => {
  const event = await stageProfile(page, request)
  const panel = staged(page)
  await panel.getByRole('textbox', { name: 'Quality gate', exact: true }).fill('Local unsaved quality gate requiring review.')
  const changed = await request.post(`${base}/staged-card-revisions/${event.stagedRevisionId}/change`, { data: {
    action: 'submit', expectedEventHash: event.contentHash, changeSummary: 'A separate coach submitted this exact staged revision for review.',
  } })
  expect(changed.status()).toBe(200)
  expect((await changeRevision(page, 'Save profile changes', 'Attempt saving from the older staged revision version.')).status()).toBe(409)
  await expect(panel.getByRole('textbox', { name: 'Quality gate', exact: true })).toHaveValue('Local unsaved quality gate requiring review.')
  await expect(panel.getByRole('button', { name: 'Save profile changes' })).toBeDisabled()
  await panel.getByRole('button', { name: 'Discard profile changes' }).click()
  await panel.getByRole('button', { name: 'Refresh staged revision' }).click()
  await expect(panel.getByRole('status').filter({ hasText: 'Revision status:' })).toContainText('Awaiting review')
  expect((await (await request.get('/__preview/state')).json()).exerciseProposals.stagedEventCount).toBe(2)
})

test('a lost staging response recovers through a read without creating another revision', async ({ page, request }) => {
  await configure(page); await research(page)
  await request.post('/__preview/exercise-proposals', { data: { mode: 'profile' } })
  await propose(page)
  await staged(page).getByRole('checkbox', { name: 'I reviewed this proposal and want to stage an unapproved revision of the existing card.' }).check()
  await page.route('**/exercise-proposals/*/stage-revision', async (route) => {
    expect((await route.fetch()).status()).toBe(200)
    await route.abort('failed')
  }, { times: 1 })
  await staged(page).getByRole('button', { name: 'Stage profile revision' }).click()
  await expect(workspace(page).getByRole('alert')).toBeVisible()
  await staged(page).getByRole('button', { name: 'Refresh revision status' }).click()
  await expect(staged(page).getByRole('status').filter({ hasText: 'Revision status:' })).toContainText('Draft')
  const state = (await (await request.get('/__preview/state')).json()).exerciseProposals
  expect(state.stagedEventCount).toBe(1); expect(state.cardCount).toBe(0); expect(state.creatorCalls).toBe(1)
})

test('revoked library access removes the staged candidate and prevents additional writes', async ({ page, request }) => {
  await stageProfile(page, request)
  await request.post('/__preview/exercise-proposals', { data: { denyLibrary: true } })
  expect((await changeRevision(page, 'Submit revision for review', 'Try submitting after library management access was revoked.')).status()).toBe(403)
  await expect(staged(page).getByRole('form', { name: 'Edit staged delivery profile' })).toHaveCount(0)
  await expect(staged(page).getByRole('button', { name: 'Stage profile revision' })).toHaveCount(0)
  expect((await (await request.get('/__preview/state')).json()).exerciseProposals.stagedEventCount).toBe(1)
})

test('research, human review, acceptance, canonical editor and reload recovery form one flow', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await configure(page)
  const evidence = await research(page)
  expect(evidence.coverage.catalogSearchComplete).toBe(true)
  expect((await (await request.get('/__preview/state')).json()).exerciseProposals.creatorCalls).toBe(0)
  const saved = await propose(page)
  expect(saved.state).toBe('AI_PROPOSED')
  await expect(review(page).getByText('Original session demand', { exact: true })).toBeVisible()
  await expect(review(page).getByText('60 minutes · 15 athletes · ages 12–14')).toBeVisible()
  await expect(review(page).getByRole('button', { name: 'Accept as canonical draft' })).toBeDisabled()
  expect((await (await request.get('/__preview/state')).json()).exerciseProposals.cardCount).toBe(0)
  await review(page).getByRole('checkbox', { name: 'I reviewed this proposal and want to add it as an unapproved canonical draft.' }).check()
  const acceptedResponse = page.waitForResponse((response) => response.url().endsWith('/accept'))
  await review(page).getByRole('button', { name: 'Accept as canonical draft' }).click()
  const accepted = await acceptedResponse
  expect(accepted.status()).toBe(200)
  expect(accepted.request().postDataJSON()).toEqual({ expectedProposalHash: saved.contentHash })
  await expect(review(page).getByRole('status')).toContainText('Current status: draft')
  await review(page).getByRole('button', { name: 'Open canonical card' }).click()
  const editor = page.getByRole('dialog')
  await expect(editor).toBeVisible()
  await expect(editor.getByRole('textbox', { name: 'Canonical name', exact: true })).toHaveValue(proposalName)
  await page.getByRole('button', { name: 'Close canonical card editor' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Research exercise needs & proposals' }).click()
  await workspace(page).getByText('Exercise proposal history · 1', { exact: true }).click()
  await workspace(page).getByRole('button', { name: new RegExp(`^${proposalName}`) }).click()
  await expect(review(page).getByRole('status')).toContainText('Current status: draft')
  await expect(review(page).getByRole('button', { name: 'Accept as canonical draft' })).toHaveCount(0)
  const state = (await (await request.get('/__preview/state')).json()).exerciseProposals
  expect(state.cardCount).toBe(1); expect(state.auditCount).toBe(1); expect(state.creatorCalls).toBe(1)
  expect(errors).toEqual([])
  await review(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/private/tmp/vortex-exercise-proposal-review.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await review(page).scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '/private/tmp/vortex-exercise-proposal-review-mobile.png' })
})

test('changed session controls require fresh research and cannot reuse the old research submission', async ({ page }) => {
  await configure(page); await research(page)
  await page.getByRole('spinbutton', { name: 'Athletes', exact: true }).fill('16')
  await expect(workspace(page).getByRole('button', { name: 'Assess gap & propose content' })).toBeDisabled()
  await expect(workspace(page).getByText('The session controls or exercise need changed. Research coverage again before proposing content.')).toBeVisible()
  const updated = await research(page)
  expect(updated.requestHash).toBeTruthy()
  await expect(workspace(page).getByRole('button', { name: 'Assess gap & propose content' })).toBeEnabled()
})

test('reuse and clarification outcomes do not create proposals or invoke the Creator', async ({ page, request }) => {
  await configure(page); await research(page)
  await request.post('/__preview/exercise-proposals', { data: { mode: 'reuse' } })
  expect((await propose(page)).state).toBe('REUSE_EXISTING')
  await expect(workspace(page).getByRole('heading', { name: 'Reuse existing canonical content' })).toBeVisible()
  await workspace(page).getByRole('button', { name: /^Open / }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close canonical card editor' }).click()
  await request.post('/__preview/exercise-proposals', { data: { mode: 'needs_review' } })
  expect((await propose(page)).state).toBe('NEEDS_COACH_REVIEW')
  await expect(workspace(page).getByText('Confirm the intended stimulus before adding content.')).toBeVisible()
  const state = (await (await request.get('/__preview/state')).json()).exerciseProposals
  expect(state.creatorCalls).toBe(0); expect(state.auditCount).toBe(0); expect(state.cardCount).toBe(0)
})

test('invalid Creator output is a reviewable attempt without an acceptance action', async ({ page, request }) => {
  await configure(page); await research(page)
  await request.post('/__preview/exercise-proposals', { data: { mode: 'invalid' } })
  expect((await propose(page)).state).toBe('NEEDS_COACH_REVIEW')
  await expect(review(page).getByText('This attempt needs coach review and has no proposal to accept.')).toBeVisible()
  await expect(review(page).getByRole('button', { name: 'Accept as canonical draft' })).toHaveCount(0)
  expect((await (await request.get('/__preview/state')).json()).exerciseProposals.cardCount).toBe(0)
})

test('profile proposals show their source and quarantine boundary without offering to create a duplicate card', async ({ page, request }) => {
  await configure(page); await research(page)
  await request.post('/__preview/exercise-proposals', { data: { mode: 'profile' } })
  expect((await propose(page)).proposal.kind).toBe('delivery_profile')
  await expect(review(page).getByRole('button', { name: 'Inspect source card' })).toBeVisible()
  await expect(staged(page).getByRole('button', { name: 'Stage profile revision' })).toBeDisabled()
  await expect(review(page).getByRole('button', { name: 'Accept as canonical draft' })).toHaveCount(0)
  await review(page).getByRole('button', { name: 'Inspect source card' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close canonical card editor' }).click()
})

test('library permission failure keeps research disabled and reveals no private history', async ({ page, request }) => {
  await request.post('/__preview/exercise-proposals', { data: { denyLibrary: true } })
  await page.getByRole('button', { name: 'Research exercise needs & proposals' }).click()
  await expect(workspace(page).getByRole('alert')).toContainText('requires workout and library management access')
  await expect(workspace(page).getByRole('textbox', { name: 'Movement name', exact: true })).toBeDisabled()
  expect((await (await request.get('/__preview/state')).json()).exerciseProposals.creatorCalls).toBe(0)
})

test('canceling a pending Creator releases session controls and leaves no accepted card or applicable proposal', async ({ page, request }) => {
  await configure(page); await research(page)
  await request.post('/__preview/exercise-proposals', { data: { delayMs: 2500 } })
  await workspace(page).getByRole('button', { name: 'Assess gap & propose content' }).click()
  await expect.poll(async () => (await (await request.get('/__preview/state')).json()).exerciseProposals.inFlight).toBe(1)
  await expect(page.getByRole('spinbutton', { name: 'Athletes', exact: true })).toBeDisabled()
  await workspace(page).getByRole('button', { name: 'Cancel library request' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Athletes', exact: true })).toBeEnabled()
  await expect.poll(async () => (await (await request.get('/__preview/state')).json()).exerciseProposals.inFlight).toBe(0)
  const state = (await (await request.get('/__preview/state')).json()).exerciseProposals
  expect(state.auditCount).toBe(0); expect(state.cardCount).toBe(0)
})
