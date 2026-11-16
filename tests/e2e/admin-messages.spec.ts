import { expect, test, type Page } from '@playwright/test'

const date = '2026-11-16T16:00:00Z'
const recipients = [{ key: 'member:12', id: 12, kind: 'member', name: 'Jamie Lee' }]
const threads = [
  { id: 8, subject: 'Practice updates', participant_names: 'Jamie Lee', unread_count: 1, last_message_at: date, last_message_body: 'What time is practice?' },
  { id: 9, subject: 'Enrollment question', participant_names: 'Morgan Park', unread_count: 0, last_message_at: '2026-11-15T16:00:00Z', last_message_body: 'Thanks for the details.' },
]
const message = (id: number, body: string) => ({ id, body, sender_name: 'Jamie Lee', sender_member_id: 12, sender_portal: 'member', created_at: date })

async function openMessages(page: Page) {
  const reads: number[] = []
  let panelPreferences = { filesVisible: true, eventsVisible: true }
  const sent: { path: string; body: string; recipient_member_ids?: number[] }[] = []
  let blockedThread: Promise<void> | undefined
  let rejectNextReply = false
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-id', '1')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Admin' }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })

  await page.route('**/api/**', async (route) => {
    const { pathname: path, searchParams } = new URL(route.request().url())
    const method = route.request().method()
    let data: unknown = []
    if (path === '/api/admin/messages/panel-preferences') {
      if (method === 'PATCH') panelPreferences = { ...panelPreferences, ...route.request().postDataJSON() }
      data = panelPreferences
    }
    if (path === '/api/admin/access/me') data = { isMasterAdmin: true, permissions: [], user: { id: 1 } }
    if (path === '/api/admin/messages/recipient-options') data = recipients
    if (path === '/api/admin/messages/schedule-inbox-rows') data = [
      { row_key: 'calendar_item:80', source: 'calendar_item', title: 'Open gym', where_text: 'Main gym', discussion_thread_id: null },
    ]
    if (path === '/api/admin/messages' && method === 'GET') {
      data = searchParams.get('status') === 'archived' ? [] : threads.map((thread) => ({ ...thread, unread_count: reads.includes(thread.id) ? 0 : thread.unread_count }))
    }
    if (path === '/api/admin/messages' && method === 'POST') {
      const body = route.request().postDataJSON()
      sent.push({ path, ...body })
      data = { thread: { id: 10, subject: body.subject }, message: message(101, body.body) }
    }
    if (/^\/api\/admin\/messages\/\d+$/.test(path)) {
      const id = Number(path.split('/').at(-1))
      if (id === 8 && method === 'GET' && blockedThread) await blockedThread
      const thread = threads.find((row) => row.id === id) ?? { id: 10, subject: 'Meet information', last_message_body: 'Meet starts at 9.' }
      if (method === 'GET') {
        const peer = id === 9 ? { member_id: 13, name: 'Morgan Park' } : { member_id: 12, name: 'Jamie Lee' }
        data = {
          thread: { ...thread, participants: [peer] },
          messages: [{ ...message(id * 10, thread.last_message_body), sender_name: peer.name, sender_member_id: peer.member_id }],
        }
      }
      if (method === 'POST') {
        if (rejectNextReply) {
          rejectNextReply = false
          await route.fulfill({ status: 503, json: { success: false, message: 'Could not send. Try again.' } })
          return
        }
        const body = route.request().postDataJSON()
        sent.push({ path, ...body })
        data = { ...message(100, body.body), sender_name: 'Admin', sender_member_id: null, sender_user_id: 1, sender_portal: 'admin' }
      }
    }
    if (/^\/api\/admin\/messages\/\d+\/read$/.test(path)) reads.push(Number(path.split('/').at(-2)))
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Messages', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible()
  return {
    reads,
    sent,
    blockFirstThread: (until: Promise<void>) => { blockedThread = until },
    rejectReply: () => { rejectNextReply = true },
  }
}

test('admin can search the inbox and send to a person selected inside the compose dialog', async ({ page }) => {
  const { reads, sent } = await openMessages(page)
  await expect(page.getByRole('heading', { name: 'Conversations', exact: true })).toBeVisible()
  await expect(page.getByText('Select a conversation', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Practice updates/ })).toBeVisible()
  expect(reads).toEqual([])

  const search = page.getByRole('searchbox', { name: 'Search conversations' })
  await search.fill('Enrollment')
  await expect(page.getByRole('button', { name: /Practice updates/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Enrollment question/ })).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(search).toHaveValue('')

  await page.getByRole('button', { name: 'New message', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New message' })
  const picker = dialog.getByRole('combobox', { name: 'Recipients' })
  await picker.fill('Jamie')
  await dialog.getByRole('option', { name: /Jamie Lee/ }).click()
  await expect(dialog.getByRole('button', { name: 'Remove Jamie Lee' })).toBeVisible()
  await dialog.getByRole('textbox', { name: /Subject/ }).fill('Meet information')
  await dialog.getByRole('textbox', { name: 'Message', exact: true }).fill('Meet starts at 9.')
  await picker.press('Enter')
  await expect(dialog).toBeVisible()
  expect(sent).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Send message' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Meet information' })).toBeVisible()
  expect(sent).toEqual([expect.objectContaining({ path: '/api/admin/messages', body: 'Meet starts at 9.', recipient_member_ids: [12] })])
})

test('admin keeps replies with their conversation and ignores a late thread response', async ({ page }) => {
  const { reads, sent, blockFirstThread, rejectReply } = await openMessages(page)
  let release!: () => void
  blockFirstThread(new Promise<void>((resolve) => { release = resolve }))
  const first = page.getByRole('button', { name: /Practice updates/ })
  const second = page.getByRole('button', { name: /Enrollment question/ })
  const firstRequest = page.waitForRequest('**/api/admin/messages/8')
  await first.click()
  await firstRequest
  await second.click()
  await expect(page.getByRole('heading', { name: 'Enrollment question' })).toBeVisible()
  const lateResponse = page.waitForResponse('**/api/admin/messages/8')
  release()
  await lateResponse
  await expect(page.getByRole('heading', { name: 'Enrollment question' })).toBeVisible()
  expect(reads).not.toContain(8)

  const reply = page.getByRole('textbox', { name: 'Reply message' })
  await reply.fill('Enrollment draft')
  await first.click()
  await expect(page.getByRole('heading', { name: 'Practice updates' })).toBeVisible()
  await expect(reply).toHaveValue('')
  await second.click()
  await expect(reply).toHaveValue('Enrollment draft')
  const send = page.getByRole('button', { name: 'Send', exact: true })
  rejectReply()
  await send.click()
  await expect(page.getByRole('alert')).toHaveText('Could not send. Try again.')
  await expect(reply).toHaveValue('Enrollment draft')
  await send.click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('log', { name: 'Conversation history' }).getByText('You', { exact: true })).toBeVisible()
  await expect(page.getByText('Enrollment draft', { exact: true })).toBeVisible()
  expect(sent).toEqual([expect.objectContaining({ path: '/api/admin/messages/9', body: 'Enrollment draft' })])

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Conversations', exact: true })).toBeVisible()
  await expect(first).not.toBeVisible()
  await page.getByRole('button', { name: 'Conversations', exact: true }).click()
  await expect(first).toBeVisible()
  await expect(page.getByRole('button', { name: 'New message', exact: true })).toBeVisible()

  await page.getByRole('combobox', { name: 'More conversation filters' }).selectOption('scheduling')
  await page.getByRole('button', { name: /Open gym/ }).click()
  await expect(page.getByRole('heading', { name: 'Open gym' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Reply message' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Conversations', exact: true }).click()
  await page.getByRole('button', { name: 'New calendar item', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'New calendar item' })).toBeVisible()
})

test('full-screen messages show conversation files and upcoming events beside a narrower chat', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openMessages(page)
  await page.route('**/api/admin/messages/schedule-inbox-rows', (route) => route.fulfill({ json: { success: true, data: [
    { row_key: 'event:1', source: 'event', title: 'Upcoming meet', when_start: '2099-01-01T16:00:00Z', where_text: 'Main gym' },
    { row_key: 'event:2', source: 'event', title: 'Past meet', when_start: '2020-01-01T16:00:00Z' },
  ] } }))
  await page.route('**/api/admin/messages/8', (route) => route.fulfill({ json: { success: true, data: {
    thread: { ...threads[0], participants: recipients },
    messages: [
      { ...message(80, 'Please review'), attachment_url: '/schedule.pdf', attachment_name: 'Schedule.pdf', files: [{ url: '/schedule.pdf', name: 'Schedule.pdf' }] },
      { ...message(81, 'Removed file'), deleted_at: date, files: [{ url: '/deleted.pdf', name: 'Deleted.pdf' }] },
    ],
  } } }))
  await page.getByRole('button', { name: /Practice updates/ }).click()
  await page.getByRole('button', { name: 'Full screen messages', exact: true }).click()
  const sidebar = page.getByRole('complementary', { name: 'Conversation resources' })
  await expect(sidebar).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Schedule.pdf' })).toHaveCount(1)
  await expect(sidebar.getByText('Deleted.pdf')).toHaveCount(0)
  await expect(sidebar.getByText('Upcoming meet')).toBeVisible()
  await expect(sidebar.getByText('Past meet')).toHaveCount(0)
  const bounds = await sidebar.boundingBox()
  expect(bounds!.width).toBeGreaterThanOrEqual(300)
  expect(bounds!.width).toBeLessThanOrEqual(304)
  expect(bounds!.x).toBeGreaterThan(900)
  const chatToolbar = page.getByRole('group', { name: 'Conversation panels' })
  const chatBefore = await chatToolbar.boundingBox()
  await page.getByRole('button', { name: 'Hide files', exact: true }).click()
  await expect(sidebar.getByRole('region', { name: 'Shared files', exact: true })).toHaveCount(0)
  await expect(sidebar.getByText('Upcoming meet')).toBeVisible()
  await page.getByRole('button', { name: 'Hide upcoming events', exact: true }).click()
  await expect(sidebar).toHaveCount(0)
  const chatAfter = await chatToolbar.boundingBox()
  expect(chatAfter!.width).toBeGreaterThan(chatBefore!.width)
  await page.getByRole('button', { name: 'Show files', exact: true }).click()
  await expect(sidebar.getByRole('link', { name: 'Schedule.pdf' })).toBeVisible()
  await expect(sidebar.getByRole('region', { name: 'Upcoming events', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show upcoming events', exact: true }).click()
  await expect(sidebar.getByText('Upcoming meet')).toBeVisible()
  await page.getByRole('button', { name: /Enrollment question/ }).click()
  await expect(sidebar.getByText('No files shared yet.')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(sidebar).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
