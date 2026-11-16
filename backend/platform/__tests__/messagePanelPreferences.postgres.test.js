import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { registerMessagePlatformRoutes } from '../messagePlatformRoutes.js'

const connectionString = process.env.MESSAGING_TEST_DATABASE_URL

test('account panel settings persist across sessions and isolate users, facilities, and portals', { skip: !connectionString }, async () => {
  const pool = new pg.Pool({ connectionString })
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    await db.query('CREATE TABLE public.facility (id BIGINT PRIMARY KEY)')
    await db.query('CREATE TABLE public.app_user (id BIGINT PRIMARY KEY)')
    await db.query('INSERT INTO public.facility VALUES (1), (2)')
    await db.query('INSERT INTO public.app_user VALUES (10), (20), (30), (40)')
    await db.query(await readFile(new URL('../../migrations/866_message_panel_preferences.sql', import.meta.url), 'utf8'))
    const routes = new Map()
    registerMessagePlatformRoutes(Object.fromEntries(['get', 'patch', 'post', 'put', 'delete'].map((method) => [method, (path, auth, handler) => routes.set(`${method} ${path}`, handler)])), db, {
      auth() {}, num: Number,
      isStaffAdmin: ({ user }) => user.role === 'ADMIN',
      ok: (res, data) => Object.assign(res, { status: 200, data }),
      bad: (res, message, status = 400) => Object.assign(res, { status, message }),
    })
    const call = async (portal, method, user, body, access = true) => {
      const response = { set() {} }
      await routes.get(`${method} /api/${portal}/messages/panel-preferences`)({ platformAuth: { user, portalAccess: { [portal]: access } }, body }, response)
      return response
    }
    for (const [portal, id] of [['admin', 10], ['coach', 20], ['member', 30]]) {
      const user = { id, facility_id: 1, role: portal.toUpperCase() }
      assert.deepEqual((await call(portal, 'get', user)).data, { filesVisible: true, eventsVisible: true })
      assert.deepEqual((await call(portal, 'patch', user, { filesVisible: false })).data, { filesVisible: false, eventsVisible: true })
      // A fresh request/session reads the account's saved preference.
      assert.deepEqual((await call(portal, 'get', { ...user })).data, { filesVisible: false, eventsVisible: true })
      assert.deepEqual((await call(portal, 'patch', user, { eventsVisible: false })).data, { filesVisible: false, eventsVisible: false })
      assert.deepEqual((await call(portal, 'get', { ...user, facility_id: 2 })).data, { filesVisible: true, eventsVisible: true })
      assert.equal((await call(portal, 'patch', user, { filesVisible: 'false' })).status, 400)
      assert.equal((await call(portal, 'patch', user, { user_id: 40, filesVisible: true })).status, 400)
      assert.equal((await call(portal, 'get', user, undefined, false)).status, 403)
    }
    assert.deepEqual((await call('member', 'get', { id: 40, facility_id: 1 })).data, { filesVisible: true, eventsVisible: true })
    // A staff account's preferences are the same when it uses another authorized portal.
    assert.deepEqual((await call('coach', 'get', { id: 10, facility_id: 1 })).data, { filesVisible: false, eventsVisible: false })
  } finally {
    await db.query('ROLLBACK')
    db.release()
    await pool.end()
  }
})
