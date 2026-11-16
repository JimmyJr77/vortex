import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import { WebSocket } from 'ws'
import { registerMessagePlatformRoutes } from '../messagePlatformRoutes.js'
import { attachMessageWebSocket } from '../messageRealtime.js'
import { loadEnrichedMessageById, loadEnrichedMessagesForThread } from '../messageThreads.js'

const connectionString = process.env.MESSAGING_TEST_DATABASE_URL
const EMOJI = '👍'
const ACTORS = {
  admin: { id: 10, facility_id: 1, role: 'ADMIN' },
  coach: { id: 20, facility_id: 1, role: 'COACH' },
  member: { id: 30, member_id: 10, facility_id: 1, role: 'MEMBER' },
}

function reactionRoutes(db) {
  const routes = new Map()
  const app = Object.fromEntries(['get', 'post', 'patch', 'put', 'delete'].map((method) => [
    method, (path, _auth, handler) => routes.set(`${method} ${path}`, handler),
  ]))
  registerMessagePlatformRoutes(app, db, {
    ok: (res, data) => Object.assign(res, { status: 200, data }),
    bad: (res, message, status = 400) => Object.assign(res, { status, message }),
    auth: () => {},
    num: Number,
    isStaffAdmin: ({ user }) => user.role === 'ADMIN',
    memberCanAccessMessageThread: () => false,
  })

  return async (portal, method, { threadId = 1, messageId = 101, actorPortal = portal } = {}) => {
    const basePath = `/api/${portal}/messages/:threadId`
    const path = method === 'get'
      ? `${basePath}/reactions`
      : `${basePath}/messages/:messageId/reactions${method === 'delete' ? '/:emoji' : ''}`
    const handler = routes.get(`${method} ${path}`)
    assert.ok(handler, `${method.toUpperCase()} ${path} is registered`)
    const response = {}
    const headers = new Map()
    Object.defineProperty(response, 'set', { value: (name, value) => headers.set(name, value) })
    await handler({
      platformAuth: { user: ACTORS[actorPortal], portalAccess: { [actorPortal]: true } },
      params: { threadId: String(threadId), messageId: String(messageId), emoji: EMOJI },
      body: { emoji: EMOJI },
    }, response)
    if (method === 'get' && response.status === 200) {
      assert.equal(headers.get('Cache-Control'), 'private, no-store')
    }
    return response
  }
}

function expectedReaction(count, reactedByViewer) {
  return { emoji: EMOJI, count, reacted_by_viewer: reactedByViewer }
}

async function assertMutation(react, portal, method, count, reactedByViewer) {
  const response = await react(portal, method)
  assert.equal(response.status, 200, response.message)
  assert.deepEqual(response.data.map(({ reactors, ...reaction }) => {
    assert.equal(reactors.length, reaction.count)
    return reaction
  }), [expectedReaction(count, reactedByViewer)])
}

async function openReactionSockets(db) {
  const server = createServer()
  const jwtSecret = 'local-reaction-regression'
  const wss = attachMessageWebSocket(server, { jwtSecret, pool: db })
  const sockets = []
  const listening = once(server, 'listening')
  server.listen(0, '127.0.0.1')
  await listening
  const url = `ws://127.0.0.1:${server.address().port}/ws/messages`

  return {
    async connect(portal) {
      const actor = ACTORS[portal]
      const token = jwt.sign({ userId: actor.id, memberId: actor.member_id }, jwtSecret)
      const socket = new WebSocket(`${url}?token=${encodeURIComponent(token)}`)
      const events = []
      sockets.push(socket)
      socket.on('message', (raw) => events.push(JSON.parse(String(raw))))
      await once(socket, 'open', { signal: AbortSignal.timeout(2_000) })
      return { socket, events }
    },
    async close() {
      for (const socket of sockets) socket.terminate()
      await new Promise((resolve) => wss.close(resolve))
      await new Promise((resolve) => server.close(resolve))
    },
  }
}

async function reactionSubscribe(client, portal, threadId) {
  client.socket.send(JSON.stringify({ action: 'subscribe_reactions', threadId, portal }))
  const signal = AbortSignal.timeout(2_000)
  while (!client.events.some((event) => event.type === 'reaction_subscription' && event.threadId === threadId)) {
    await once(client.socket, 'message', { signal })
  }
}

async function readReactionEvents(client) {
  // A pong follows the previous frames queued by the server for this socket.
  const pong = once(client.socket, 'pong', { signal: AbortSignal.timeout(2_000) })
  client.socket.ping()
  await pong
  return client.events.filter((event) => event.type === 'message.reactions_updated')
}

async function assertRealtimeReactions(db, react) {
  const network = await openReactionSockets(db)
  try {
    const [admin, member, coachOnOtherThread, unauthorizedMember] = await Promise.all([
      network.connect('admin'), network.connect('member'), network.connect('coach'), network.connect('member'),
    ])
    unauthorizedMember.socket.send(JSON.stringify({ action: 'subscribe', channels: ['thread:1'] }))
    unauthorizedMember.socket.send(JSON.stringify({ action: 'subscribe_reactions', threadId: 1, portal: 'admin' }))
    unauthorizedMember.socket.send(JSON.stringify({ action: 'subscribe_reactions', threadId: 3, portal: 'member' }))
    await Promise.all([
      reactionSubscribe(admin, 'admin', 1),
      reactionSubscribe(member, 'member', 1),
      reactionSubscribe(coachOnOtherThread, 'coach', 2),
    ])

    await assertMutation(react, 'member', 'post', 2, true)
    await assertMutation(react, 'member', 'post', 2, true)
    assert.deepEqual(await react('admin', 'get'), { status: 200, data: { 101: [expectedReaction(2, false)] } })
    assert.deepEqual(await react('member', 'get'), { status: 200, data: { 101: [expectedReaction(2, true)] } })
    assert.deepEqual(await react('member', 'get', { threadId: 3 }), { status: 404, message: 'Thread not found.' })
    for (const method of ['get', 'post', 'delete']) {
      assert.deepEqual(await react('member', method, { actorPortal: 'admin' }), { status: 403, message: 'Portal access required.' })
    }
    await assertMutation(react, 'member', 'delete', 1, false)
    await assertMutation(react, 'member', 'delete', 1, false)
    assert.deepEqual(await react('member', 'get'), { status: 200, data: { 101: [expectedReaction(1, false)] } })

    for (const client of [admin, member]) {
      const events = await readReactionEvents(client)
      assert.deepEqual(events.map(({ type, threadId }) => ({ type, threadId })), [
        { type: 'message.reactions_updated', threadId: 1 },
        { type: 'message.reactions_updated', threadId: 1 },
      ])
      assert.ok(events.every((event) => !('data' in event)), 'updates only invalidate a conversation snapshot')
    }

    const otherThreadMutation = await react('coach', 'post', { threadId: 2, messageId: 201 })
    assert.equal(otherThreadMutation.status, 200, otherThreadMutation.message)
    const deniedThreadMutation = await react('admin', 'post', { threadId: 3, messageId: 301 })
    assert.equal(deniedThreadMutation.status, 200, deniedThreadMutation.message)
    assert.deepEqual((await readReactionEvents(coachOnOtherThread)).map(({ threadId }) => threadId), [2])
    assert.deepEqual(await readReactionEvents(unauthorizedMember), [])
    assert.equal(unauthorizedMember.events.some((event) => event.type === 'reaction_subscription'), false)

    await reactionSubscribe(coachOnOtherThread, 'coach', 1)
    assert.deepEqual(await react('coach', 'delete'), { status: 200, data: [] })
    assert.deepEqual(await react('member', 'get'), { status: 200, data: {} })
    assert.deepEqual(await react('coach', 'delete', { threadId: 2, messageId: 201 }), { status: 200, data: [] })
    assert.deepEqual((await readReactionEvents(coachOnOtherThread)).map(({ threadId }) => threadId), [2, 1])
  } finally {
    await network.close()
  }
}

test('message reactions keep ownership across portal mutations and conversation reloads', {
  skip: !connectionString && 'Requires MESSAGING_TEST_DATABASE_URL for an empty local PostgreSQL database',
  timeout: 12_000,
}, async () => {
  const url = new URL(connectionString)
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol)
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    && !url.search && !url.hash && /^\/vortex_messaging_test(?:_[a-z0-9_]+)?$/.test(url.pathname),
  'Use an empty local database named vortex_messaging_test (optionally with a suffix)')

  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(`
      CREATE SCHEMA coaching;
      CREATE TABLE public.facility (id bigint PRIMARY KEY);
      CREATE TABLE public.app_user (id bigint PRIMARY KEY, facility_id bigint, full_name text, role text);
      CREATE TABLE public.app_user_role (user_id bigint, role text);
      CREATE TABLE public.member (id bigint PRIMARY KEY, app_user_id bigint, first_name text);
      CREATE TABLE coaching.message_thread (id bigint PRIMARY KEY, facility_id bigint, member_id bigint, coach_user_id bigint, subject text);
      CREATE TABLE coaching.message (
        id bigint PRIMARY KEY, thread_id bigint, created_at timestamptz NOT NULL DEFAULT now(),
        sender_user_id bigint, sender_member_id bigint, sender_portal text, body text
      );
      CREATE TABLE coaching.message_thread_participant (thread_id bigint, user_id bigint, member_id bigint);
      CREATE VIEW public.v_app_user_access_context AS
        SELECT au.id AS user_id, au.facility_id, au.full_name, au.role AS primary_storage_role,
          ARRAY[au.role] AS storage_roles, m.id AS member_id,
          NULL::bigint AS owner_user_id, NULL::bigint AS family_id,
          NULL::text AS email, NULL::text AS phone, NULL::text AS username,
          ARRAY[]::text[] AS staff_roles, true AS is_active, false AS is_owner,
          true AS staff_access_active, true AS member_portal_access_active,
          CASE WHEN m.id IS NOT NULL THEN 'active' ELSE 'no_login' END AS member_portal_status,
          au.role = 'ADMIN' AS can_access_admin_portal,
          au.role = 'COACH' AS can_access_coach_portal,
          au.role = 'MEMBER' AS can_access_member_portal
        FROM public.app_user au LEFT JOIN public.member m ON m.app_user_id = au.id;

      INSERT INTO public.facility VALUES (1);
      INSERT INTO public.app_user VALUES
        (10, 1, 'Admin User', 'ADMIN'), (20, 1, 'Coach User', 'COACH'), (30, 1, 'Member User', 'MEMBER');
      INSERT INTO public.member VALUES (10, 30, 'Member');
      INSERT INTO coaching.message_thread VALUES
        (1, 1, 10, 20, 'Conversation'), (2, 1, 10, 20, 'Other conversation'), (3, 1, NULL, 20, 'Staff-only conversation');
      INSERT INTO coaching.message_thread_participant (thread_id, member_id) VALUES (1, 10), (2, 10);
      INSERT INTO coaching.message (id, thread_id, sender_user_id, body) VALUES
        (101, 1, 20, 'First message'), (102, 1, 20, 'Second message'), (201, 2, 20, 'Other message'), (301, 3, 20, 'Staff message');
    `)

    const react = reactionRoutes(db)
    await assertMutation(react, 'admin', 'post', 1, true)
    await assertMutation(react, 'admin', 'post', 1, true)
    await assertMutation(react, 'member', 'delete', 1, false)
    await assertMutation(react, 'coach', 'post', 2, true)
    await assertMutation(react, 'member', 'post', 3, true)
    await assertMutation(react, 'member', 'post', 3, true)
    await assertMutation(react, 'admin', 'delete', 2, false)
    await assertMutation(react, 'admin', 'delete', 2, false)

    for (const [viewer, ownsReaction] of [[{ userId: 10 }, false], [{ userId: 20 }, true], [{ memberId: 10 }, true]]) {
      const messages = await loadEnrichedMessagesForThread(db, 1, viewer)
      assert.deepEqual(messages.find(({ id }) => Number(id) === 101).reactions, [expectedReaction(2, ownsReaction)])
      assert.deepEqual(messages.find(({ id }) => Number(id) === 102).reactions, [])
    }
    assert.deepEqual((await loadEnrichedMessageById(db, 101)).reactions, [expectedReaction(2, false)])

    assert.deepEqual(await react('coach', 'delete', { threadId: 2 }), { status: 404, message: 'Message not found.' })
    assert.deepEqual(await react('admin', 'post', { threadId: 2 }), { status: 404, message: 'Message not found.' })
    await assertMutation(react, 'member', 'delete', 1, false)
    assert.deepEqual((await loadEnrichedMessagesForThread(db, 1, { userId: 20 }))
      .find(({ id }) => Number(id) === 101).reactions, [expectedReaction(1, true)])

    await db.query('UPDATE coaching.message SET deleted_at = now() WHERE id = 102')
    assert.deepEqual(await react('member', 'post', { messageId: 102 }), { status: 404, message: 'Message not found.' })
    await assertRealtimeReactions(db, react)
  } finally {
    await db.query('ROLLBACK')
    await db.end()
  }
})
