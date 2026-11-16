import { expect, test, type Page, type WebSocketRoute } from '@playwright/test'

type Portal = 'admin' | 'coach' | 'member'

const THREAD = { id: '81', subject: 'Practice updates', last_message_body: 'Practice starts at six.' }
const MESSAGE = { id: '240', body: THREAD.last_message_body, sender_name: 'Practice Staff', sender_user_id: 100, sender_portal: 'coach', created_at: '2026-11-16T16:00:00Z' }
const EMOJI = '👍'
const ACCOUNTS = {
  admin: { id: 21, fullName: 'Admin Test', email: 'admin@example.com', availablePortals: ['admin'] },
  coach: { id: 22, fullName: 'Coach Test', email: 'coach@example.com', roles: ['COACH'], isCoach: true, availablePortals: ['coach'] },
  member: { id: 23, fullName: 'Member Test', email: 'member@example.com', availablePortals: ['member'] },
}

function sharedConversation() {
  const participantsWhoReacted = new Set<Portal>()
  const subscribers = new Map<Portal, WebSocketRoute>()
  const paused = new Set<Portal>()
  const pendingSubscriptions = new Map<Portal, WebSocketRoute>()
  const changes: Array<{ portal: Portal; method: string; emoji: string }> = []
  const reactionsFor = (portal: Portal) => participantsWhoReacted.size > 0
    ? [{ emoji: EMOJI, count: participantsWhoReacted.size, reacted_by_viewer: participantsWhoReacted.has(portal) }]
    : []

  function subscribe(portal: Portal, socket: WebSocketRoute) {
    subscribers.set(portal, socket)
    socket.send(JSON.stringify({ type: 'reaction_subscription', threadId: Number(THREAD.id) }))
  }

  function disconnect(portal: Portal) {
    paused.add(portal)
    subscribers.get(portal)?.close({ code: 1012, reason: 'Simulated reconnect' })
    subscribers.delete(portal)
  }

  function resume(portal: Portal) {
    paused.delete(portal)
    const socket = pendingSubscriptions.get(portal)
    if (socket) subscribe(portal, socket)
    pendingSubscriptions.delete(portal)
  }

  async function preparePortal(page: Page, portal: Portal) {
    await page.addInitScript(({ portal: role, account }) => {
      if (role === 'admin') {
        localStorage.setItem('vortex_admin', 'true')
        localStorage.setItem('adminToken', 'reaction-admin-token')
        localStorage.setItem('vortex-admin-id', String(account.id))
        localStorage.setItem('vortex-admin-info', JSON.stringify({ id: account.id, name: account.fullName }))
        localStorage.setItem('vortex_admin_portal', 'new-admin')
      } else {
        localStorage.setItem('vortex_member_token', `reaction-${role}-token`)
        localStorage.setItem('vortex_member', JSON.stringify(account))
      }
    }, { portal, account: ACCOUNTS[portal] })

    await page.routeWebSocket('**/ws/messages**', (socket) => {
      socket.onMessage((message) => {
        const frame = JSON.parse(String(message))
        if (frame.action === 'subscribe_reactions' && Number(frame.threadId) === Number(THREAD.id) && frame.portal === portal) {
          if (paused.has(portal)) pendingSubscriptions.set(portal, socket)
          else subscribe(portal, socket)
        }
      })
    })
    await page.route('**/api/**', async (route) => {
      const request = route.request()
      const { pathname } = new URL(request.url())
      const method = request.method()
      const inboxPath = `/api/${portal}/messages`
      const detailPath = `${inboxPath}/${THREAD.id}`
      const reactionsSummaryPath = `${detailPath}/reactions`
      const reactionPath = `${detailPath}/messages/${MESSAGE.id}/reactions`
      const requesterAuthorized = request.headers().authorization === `Bearer reaction-${portal}-token`
      let data: unknown = []

      if (pathname === '/api/admin/access/me') data = { isMasterAdmin: true, permissions: [], user: { id: ACCOUNTS.admin.id } }
      if (pathname === '/api/members/me') data = { ...ACCOUNTS.member, firstName: 'Member', lastName: 'Test', isActive: true, enrollments: [] }
      if (pathname === '/api/coach/portal-config' || pathname === '/api/members/portal-config') data = { hiddenTabs: [], tabOrder: ['home', 'messages'] }
      if (pathname === inboxPath) data = [THREAD]
      if (pathname === detailPath) {
        data = {
          thread: THREAD,
          messages: [{ ...MESSAGE, reactions: reactionsFor(portal) }],
        }
      }
      if (pathname === reactionsSummaryPath) {
        if (method !== 'GET' || !requesterAuthorized) {
          await route.fulfill({ status: 400, json: { success: false, message: 'Invalid reaction summary request' } })
          return
        }
        const reactions = reactionsFor(portal)
        data = reactions.length === 0 ? {} : { [MESSAGE.id]: reactions }
      }
      if (pathname === reactionPath || pathname.startsWith(`${reactionPath}/`)) {
        const adding = method === 'POST' && pathname === reactionPath
        const removing = method === 'DELETE' && pathname.startsWith(`${reactionPath}/`)
        const emoji = adding
          ? request.postDataJSON().emoji
          : decodeURIComponent(pathname.slice(reactionPath.length + 1))
        if (!requesterAuthorized || emoji !== EMOJI || (!adding && !removing)) {
          await route.fulfill({ status: 400, json: { success: false, message: 'Invalid reaction request' } })
          return
        }
        changes.push({ portal, method, emoji })
        if (adding) participantsWhoReacted.add(portal)
        else participantsWhoReacted.delete(portal)
        data = reactionsFor(portal)

        const event = JSON.stringify({
          type: 'message.reactions_updated',
          threadId: Number(THREAD.id),
        })
        for (const socket of subscribers.values()) socket.send(event)
      }
      await route.fulfill({ json: { success: true, data } })
    })

    return async () => {
      await page.goto(portal === 'admin' ? '/' : '/?login=1', { waitUntil: 'domcontentloaded' })
      if (portal === 'admin') {
        await page.getByRole('button', { name: 'Open Messages', exact: true }).click()
      } else {
        const navigation = portal === 'member' ? 'Member navigation' : 'Coach navigation'
        await page.getByRole('navigation', { name: navigation }).getByRole('button', { name: 'Messages', exact: true }).click()
      }
      await page.getByRole('button', { name: /Practice updates/ }).click()
      await expect(page.getByRole('log', { name: 'Conversation history' }).getByText(MESSAGE.body)).toBeVisible()
    }
  }

  return { changes, preparePortal, subscribers, pendingSubscriptions, disconnect, resume }
}

test('reaction counts update live across all portals while each person keeps their own reaction', async ({ browser, baseURL }) => {
  const [admin, coach, member] = await Promise.all(Array.from({ length: 3 }, () => browser.newPage({ baseURL })))
  try {
    const { changes, preparePortal, subscribers, pendingSubscriptions, disconnect, resume } = sharedConversation()
    const [openAdmin, openCoach, openMember] = await Promise.all([
      preparePortal(admin, 'admin'),
      preparePortal(coach, 'coach'),
      preparePortal(member, 'member'),
    ])
    const reactionChip = (page: Page) => page
      .getByRole('log', { name: 'Conversation history' })
      .getByRole('button', { name: 'Thumbs up reaction' })
    const expectReaction = async (page: Page, count: number, ownsReaction: boolean) => {
      await expect(reactionChip(page)).toContainText(String(count))
      await expect(reactionChip(page)).toHaveAttribute('aria-pressed', String(ownsReaction))
    }
    const expectSharedReaction = async (count: number, owners: Portal[]) => {
      await Promise.all([
        expectReaction(admin, count, owners.includes('admin')),
        expectReaction(coach, count, owners.includes('coach')),
        expectReaction(member, count, owners.includes('member')),
      ])
    }
    const openPicker = async (page: Page) => {
      await page.getByRole('button', { name: /^Actions for message from/ }).click()
      return page.getByRole('group', { name: 'Message actions' }).getByRole('button', { name: 'Thumbs up reaction' })
    }

    await Promise.all([openAdmin(), openCoach(), openMember()])
    await expect.poll(() => subscribers.size).toBe(3)

    await (await openPicker(admin)).click()
    await expectSharedReaction(1, ['admin'])

    await reactionChip(coach).click()
    await expectSharedReaction(2, ['admin', 'coach'])

    const memberChoice = await openPicker(member)
    await expect(memberChoice).toHaveAttribute('aria-pressed', 'false')
    await memberChoice.click()
    await expectSharedReaction(3, ['admin', 'coach', 'member'])
    await reactionChip(member).click()
    await expectSharedReaction(2, ['admin', 'coach'])

    disconnect('member')
    await reactionChip(coach).click()
    await expectReaction(admin, 1, true)
    await expectReaction(coach, 1, false)
    await expectReaction(member, 2, false)
    await expect.poll(() => pendingSubscriptions.has('member')).toBe(true)
    resume('member')
    await expectSharedReaction(1, ['admin'])

    await reactionChip(admin).click()
    await Promise.all([admin, coach, member].map((page) => expect(reactionChip(page)).toHaveCount(0)))

    expect(changes).toEqual([
      { portal: 'admin', method: 'POST', emoji: EMOJI },
      { portal: 'coach', method: 'POST', emoji: EMOJI },
      { portal: 'member', method: 'POST', emoji: EMOJI },
      { portal: 'member', method: 'DELETE', emoji: EMOJI },
      { portal: 'coach', method: 'DELETE', emoji: EMOJI },
      { portal: 'admin', method: 'DELETE', emoji: EMOJI },
    ])

    const [adminChoice, coachChoice] = await Promise.all([openPicker(admin), openPicker(coach)])
    await Promise.all([adminChoice.click(), coachChoice.click()])
    await expectSharedReaction(2, ['admin', 'coach'])
    expect(changes.slice(6)).toHaveLength(2)
    expect(changes.slice(6)).toEqual(expect.arrayContaining([
      { portal: 'admin', method: 'POST', emoji: EMOJI },
      { portal: 'coach', method: 'POST', emoji: EMOJI },
    ]))
  } finally {
    await Promise.all([admin.close(), coach.close(), member.close()])
  }
})
