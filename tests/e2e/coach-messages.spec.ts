import { expect, test, type Page, type WebSocketRoute } from '@playwright/test'

const THREADS = [
  { id: '41', subject: 'Training plan', last_message_body: 'Training history', unread_count: 1 },
  { id: '42', subject: 'Weekend session', last_message_body: 'Weekend history' },
]
const ARCHIVED_THREAD = { id: '44', subject: 'Past season', last_message_body: 'Archived history', status: 'archived' }

async function openCoachMessages(page: Page, { mobile = false, longHistory = false } = {}) {
  const readThreads: number[] = []
  const replies: Array<{ threadId: number; body: string }> = []
  const newMessages: Array<Record<string, unknown>> = []
  const threads = THREADS.map((thread) => ({ ...thread }))
  const sockets = new Map<number, WebSocketRoute>()
  await page.addInitScript(() => {
    localStorage.setItem('vortex_member_token', 'e2e-coach-token')
    localStorage.setItem('vortex_member', JSON.stringify({
      id: 12,
      fullName: 'Coach Test',
      email: 'coach@example.com',
      roles: ['COACH'],
      isCoach: true,
      availablePortals: ['coach'],
    }))
  })
  await page.routeWebSocket('**/ws/messages**', (socket) => {
    socket.onMessage((message) => {
      const data = JSON.parse(String(message))
      const threadId = Number(data.channels?.[0]?.split(':')[1])
      if (threadId) sockets.set(threadId, socket)
    })
  })
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const { pathname, searchParams } = new URL(request.url())
    const isPost = request.method() === 'POST'
    const threadRequest = pathname.match(/^\/api\/coach\/messages\/(\d+)(\/read)?$/)
    let data: unknown = []

    if (pathname === '/api/coach/portal-config') {
      data = { hiddenTabs: [], tabOrder: ['home', 'messages'] }
    } else if (pathname === '/api/coach/messages' && isPost) {
      const payload = request.postDataJSON()
      newMessages.push(payload)
      const thread = { id: '43', subject: payload.subject, last_message_body: payload.body }
      threads.push(thread)
      data = { thread }
    } else if (pathname === '/api/coach/messages') {
      data = searchParams.get('status') === 'archived' ? [ARCHIVED_THREAD] : threads
    } else if (pathname === '/api/coach/messages/recipient-options') {
      data = [{ id: 8, key: 'member:8', kind: 'member', name: 'Jordan Athlete' }]
    } else if (pathname === '/api/coach/messages/schedule-inbox-rows') {
      data = [{ row_key: 'event:9', source: 'event', title: 'Spring showcase', where_text: 'Main gym' }]
    } else if (threadRequest) {
      const id = Number(threadRequest[1])
      const thread = threads.find((row) => Number(row.id) === id)
      if (threadRequest[2]) {
        readThreads.push(id)
        if (thread) thread.unread_count = 0
      } else if (isPost) {
        const { body } = request.postDataJSON()
        replies.push({ threadId: id, body })
        data = { id: id + 1000, body, created_at: '2026-07-01T13:00:00Z' }
      } else {
        const conversation = id === Number(ARCHIVED_THREAD.id) ? ARCHIVED_THREAD : thread
        data = {
          thread: conversation,
          messages: longHistory && id === 41
            ? Array.from({ length: 25 }, (_, index) => ({
                id: String(1000 + index),
                body: `Training note ${index + 1}`,
                created_at: '2026-07-01T12:00:00Z',
              }))
            : [{ id: String(id), body: conversation?.last_message_body, created_at: '2026-07-01T12:00:00Z' }],
        }
      }
    }

    await route.fulfill({ json: { success: true, data } })
  })

  await page.goto('/?login=1', { waitUntil: 'domcontentloaded' })
  if (mobile) await page.getByRole('button', { name: 'Open navigation menu' }).click()
  await page.getByRole('navigation', { name: 'Coach navigation' }).getByRole('button', { name: 'Messages', exact: true }).click()
  await expect(page.getByRole('button', { name: /Training plan/ })).toBeVisible()
  return { readThreads, replies, newMessages, sockets }
}

test('marks a conversation read only after opening it and keeps drafts with their conversations', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 920 })
  const { readThreads, replies } = await openCoachMessages(page)
  await expect(page.getByText('Choose a conversation')).toBeVisible()
  expect(readThreads).toEqual([])

  const editor = page.getByRole('textbox', { name: 'Reply message' })
  await page.getByRole('button', { name: /Training plan/ }).click()
  await expect.poll(() => readThreads).toEqual([41])
  await editor.fill('Draft for training only')

  await page.getByRole('button', { name: /Weekend session/ }).click()
  await expect(page.getByRole('heading', { name: 'Weekend session' })).toBeVisible()
  await expect(editor).toHaveValue('')
  await editor.fill('A separate weekend draft')

  await page.getByRole('button', { name: /Training plan/ }).click()
  await expect(editor).toHaveValue('Draft for training only')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect.poll(() => replies).toEqual([{ threadId: 41, body: 'Draft for training only' }])
  await expect(page.getByText('Draft for training only')).toBeVisible()

  await page.getByRole('button', { name: /Weekend session/ }).click()
  await expect(editor).toHaveValue('A separate weekend draft')
})

test('selects recipients in the new message dialog', async ({ page }) => {
  const { newMessages } = await openCoachMessages(page)
  await page.getByRole('button', { name: 'New message', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New message' })
  await dialog.getByPlaceholder('Find athletes, coaches, or admins').fill('Jordan')
  await dialog.getByRole('option', { name: /Jordan Athlete/ }).click()
  await dialog.getByRole('textbox', { name: /Subject/ }).fill('A new conversation')
  await dialog.getByRole('textbox', { name: 'Message', exact: true }).fill('Ready for practice?')
  await dialog.getByRole('button', { name: 'Send message' }).click()
  await expect.poll(() => newMessages).toEqual([expect.objectContaining({
    subject: 'A new conversation',
    body: 'Ready for practice?',
    recipient_member_ids: [8],
  })])
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name: 'A new conversation' })).toBeVisible()
})

test('opens schedule details and calendar creation on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openCoachMessages(page, { mobile: true })
  await page.getByRole('combobox', { name: 'More conversation filters' }).selectOption('scheduling')
  await page.getByRole('button', { name: /Spring showcase/ }).click()
  await expect(page.getByRole('heading', { name: 'Spring showcase' })).toBeVisible()
  await expect(page.getByText('No chat linked yet for this schedule entry.')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Reply message' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Conversations', exact: true }).click()
  await page.getByRole('button', { name: 'New calendar item' }).click()
  await expect(page.getByRole('heading', { name: 'New calendar item' })).toBeVisible()
})

test('renders wrapped realtime messages and opens archived history separately', async ({ page }) => {
  const { readThreads, sockets } = await openCoachMessages(page, { longHistory: true })
  await page.getByRole('button', { name: /Training plan/ }).click()
  await expect(page.getByRole('heading', { name: 'Training plan' })).toBeVisible()
  await expect.poll(() => sockets.has(41)).toBe(true)
  const scrollArea = page.getByRole('log', { name: 'Conversation history' }).locator('..')
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(64)
  await scrollArea.evaluate((element) => {
    element.scrollTop = 0
    element.dispatchEvent(new Event('scroll'))
  })

  sockets.get(41)?.send(JSON.stringify({
    type: 'message.created',
    threadId: 41,
    data: { message: { id: '107', body: 'Received live', created_at: '2026-07-01T13:00:00Z' } },
  }))
  await expect(page.getByText('Received live', { exact: true })).toBeVisible()
  expect(await scrollArea.evaluate((element) => element.scrollTop)).toBe(0)

  await page.getByRole('combobox', { name: 'More conversation filters' }).selectOption('archived')
  await page.getByRole('button', { name: /Past season/ }).click()
  await expect(page.getByRole('heading', { name: 'Past season' })).toBeVisible()
  await expect(page.getByText('Archived history', { exact: true }).last()).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Reply message' })).toHaveCount(0)
  expect(readThreads).toEqual([41])
  await page.getByRole('group', { name: 'Quick filters' }).getByRole('button', { name: 'Messages' }).click()
  await expect(page.getByRole('button', { name: /Training plan/ })).toBeVisible()
})
