import { createServer } from 'node:http'
import { once } from 'node:events'
import jwt from 'jsonwebtoken'
import { WebSocket } from 'ws'
import { attachMessageWebSocket } from '../messageRealtime.js'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { registerMessagePlatformRoutes } from '../messagePlatformRoutes.js'

const connectionString = process.env.MESSAGING_TEST_DATABASE_URL

test('account panel settings persist across sessions and isolate users, facilities, and portals', { skip: !connectionString }, async () => {
  const pool = new pg.Pool({ connectionString })
  const db = await pool.connect()
  const server = createServer()
  const wss = attachMessageWebSocket(server, { pool: db, jwtSecret: 'preference-test-only' })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const sockets = []
  const connect = async (portal, id) => {
    const token = jwt.sign({ userId: id }, 'preference-test-only')
    const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws/messages?token=${token}`)
    sockets.push(socket)
    const frames = []
    socket.on('message', raw => frames.push(JSON.parse(String(raw))))
    await once(socket, 'open')
    socket.send(JSON.stringify({ action: 'subscribe_panel_preferences', portal, userId: 10, facilityId: 99 }))
    for (let i = 0; i < 100 && !frames.some(f => f.type === 'panel_preferences_subscription'); i++) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    assert.ok(frames.some(f => f.type === 'panel_preferences_subscription'))
    return { socket, frames }
  }
  try {
    await db.query('BEGIN')
    await db.query('CREATE TABLE public.facility (id BIGINT PRIMARY KEY)')
    await db.query('CREATE TABLE public.app_user (id BIGINT PRIMARY KEY, facility_id BIGINT, role TEXT)')
    await db.query('INSERT INTO public.facility VALUES (1), (2)')
    await db.query("INSERT INTO public.app_user VALUES (10, 1, 'ADMIN'), (20, 1, 'COACH'), (30, 1, 'MEMBER'), (40, 1, 'MEMBER')")
    await db.query(`CREATE VIEW public.v_app_user_access_context AS
      SELECT id AS user_id, facility_id, role AS primary_storage_role, ARRAY[role] AS storage_roles,
        NULL::bigint AS member_id, NULL::bigint AS owner_user_id, NULL::bigint AS family_id,
        NULL::text AS full_name, NULL::text AS email, NULL::text AS phone, NULL::text AS username,
        ARRAY[]::text[] AS staff_roles, true AS is_active, false AS is_owner,
        true AS staff_access_active, true AS member_portal_access_active, 'active' AS member_portal_status,
        role = 'ADMIN' AS can_access_admin_portal, role = 'COACH' AS can_access_coach_portal,
        role = 'MEMBER' AS can_access_member_portal FROM public.app_user`)
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
    const outsider = await connect('member', 40)
    outsider.socket.send(JSON.stringify({ action: 'subscribe', channels: ['user:10', 'facility:1'] }))
    for (const [portal, id] of [['admin', 10], ['coach', 20], ['member', 30]]) {
      const user = { id, facility_id: 1, role: portal.toUpperCase() }
      const sessions = await Promise.all([connect(portal, id), connect(portal, id)])
      assert.deepEqual((await call(portal, 'get', user)).data, { filesVisible: true, eventsVisible: true })
      assert.deepEqual((await call(portal, 'patch', user, { filesVisible: false })).data, { filesVisible: false, eventsVisible: true })
      // A fresh request/session reads the account's saved preference.
      assert.deepEqual((await call(portal, 'get', { ...user })).data, { filesVisible: false, eventsVisible: true })
      assert.deepEqual((await call(portal, 'patch', user, { eventsVisible: false })).data, { filesVisible: false, eventsVisible: false })
      assert.deepEqual((await call(portal, 'get', { ...user, facility_id: 2 })).data, { filesVisible: true, eventsVisible: true })
      assert.equal((await call(portal, 'patch', user, { filesVisible: 'false' })).status, 400)
      assert.equal((await call(portal, 'patch', user, { user_id: 40, filesVisible: true })).status, 400)
      assert.equal((await call(portal, 'get', user, undefined, false)).status, 403)
      for (const session of sessions) {
        const pong = once(session.socket, 'pong')
        session.socket.ping()
        await pong
        assert.equal(session.frames.filter(f => f.type === 'message.panel_preferences_updated').length, 2)
      }
      assert.equal(outsider.frames.filter(f => f.type === 'message.panel_preferences_updated').length, 0)

    }
    assert.deepEqual((await call('member', 'get', { id: 40, facility_id: 1 })).data, { filesVisible: true, eventsVisible: true })
    // A staff account's preferences are the same when it uses another authorized portal.
    assert.deepEqual((await call('coach', 'get', { id: 10, facility_id: 1 })).data, { filesVisible: false, eventsVisible: false })
  } finally {
    for (const socket of sockets) socket.terminate()
    await new Promise(resolve => wss.close(resolve))
    await new Promise(resolve => server.close(resolve))
    await db.query('ROLLBACK')
    db.release()
    await pool.end()
  }
})
