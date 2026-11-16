import { expect, test, type WebSocketRoute } from '@playwright/test'

for (const portal of ['admin', 'coach', 'member'] as const) {
  test(`${portal} panels sync between open browsers and recover after reconnect`, async ({ browser }) => {
    let preferences = { filesVisible: true, eventsVisible: true }
    const sockets = new Set<WebSocketRoute>()
    const contexts = await Promise.all([browser.newContext({ viewport: { width: 1440, height: 900 } }), browser.newContext({ viewport: { width: 1440, height: 900 } })])
    try {
      const pages = await Promise.all(contexts.map(async context => {
        const page = await context.newPage()
        await page.addInitScript(role => {
          const account = { id: 21, memberId: 12, fullName: 'Panel Test', email: 'panels@example.com', roles: [role.toUpperCase()], isCoach: role === 'coach', availablePortals: [role] }
          if (role === 'admin') {
            localStorage.setItem('vortex_admin', 'true')
            localStorage.setItem('adminToken', 'panels-token')
            localStorage.setItem('vortex-admin-id', '21')
            localStorage.setItem('vortex-admin-info', JSON.stringify(account))
            localStorage.setItem('vortex_admin_portal', 'new-admin')
          } else {
            localStorage.setItem('vortex_member_token', 'panels-token')
            localStorage.setItem('vortex_member', JSON.stringify(account))
          }
        }, portal)
        await page.routeWebSocket('**/ws/messages**', socket => {
          socket.onMessage(raw => {
            if (JSON.parse(String(raw)).action === 'subscribe_panel_preferences') {
              sockets.add(socket)
              socket.send(JSON.stringify({ type: 'panel_preferences_subscription' }))
            }
          })
          socket.onClose(() => sockets.delete(socket))
        })
        await page.route('**/api/**', async route => {
          const path = new URL(route.request().url()).pathname
          let data: unknown = []
          if (path.endsWith('/panel-preferences')) {
            if (route.request().method() === 'PATCH') {
              preferences = { ...preferences, ...route.request().postDataJSON() }
              for (const socket of sockets) socket.send(JSON.stringify({ type: 'message.panel_preferences_updated' }))
            }
            data = { ...preferences }
          }
          if (path === '/api/admin/access/me') data = { isMasterAdmin: true, permissions: [], user: { id: 21 } }
          if (path === '/api/members/me') data = { id: 21, memberId: 12, firstName: 'Panel', lastName: 'Test', isActive: true, enrollments: [] }
          if (path.endsWith('/portal-config')) data = { hiddenTabs: [], tabOrder: ['home', 'messages'] }
          await route.fulfill({ json: { success: true, data } })
        })
        await page.goto(portal === 'admin' ? '/' : '/?login=1')
        await page.getByRole('button', { name: portal === 'admin' ? 'Open Messages' : portal === 'coach' ? 'Messages Talk with athletes, coaches, and admins.' : 'Messages Talk with your coaches.', exact: true }).click()
        await page.getByRole('button', { name: 'Full screen messages', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Hide files', exact: true })).toBeEnabled()
        return page
      }))
      const [first, second] = pages
      await first.getByRole('button', { name: 'Hide files', exact: true }).click()
      await expect(second.getByRole('button', { name: 'Show files', exact: true })).toBeEnabled()
      await second.getByRole('button', { name: 'Hide upcoming events', exact: true }).click()
      await expect(first.getByRole('button', { name: 'Show upcoming events', exact: true })).toBeEnabled()
      await expect(first.getByRole('complementary', { name: 'Conversation resources' })).toHaveCount(0)
      // Independent partial updates from two active sessions must both survive.
      await Promise.all([first.getByRole('button', { name: 'Show files', exact: true }).click(), second.getByRole('button', { name: 'Show upcoming events', exact: true }).click()])
      for (const page of pages) {
        await expect(page.getByRole('button', { name: 'Hide files', exact: true })).toBeEnabled()
        await expect(page.getByRole('button', { name: 'Hide upcoming events', exact: true })).toBeEnabled()
      }
      for (const socket of sockets) socket.close({ code: 1012, reason: 'Reconnect test' })
      sockets.clear()
      preferences = { filesVisible: false, eventsVisible: false }
      for (const page of pages) {
        await expect(page.getByRole('button', { name: 'Show files', exact: true })).toBeEnabled()
        await expect(page.getByRole('button', { name: 'Show upcoming events', exact: true })).toBeEnabled()
      }
    } finally {
      await Promise.all(contexts.map(context => context.close()))
    }
  })
}
