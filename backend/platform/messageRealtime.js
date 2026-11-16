/**
 * WebSocket realtime channel for coaching messages.
 */

import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'
import { URL } from 'url'
import { loadCanonicalAccessContext, resolveCanonicalTokenUserId } from './accessContext.js'
import { queryMinorChildGuardianMemberIds } from './coachRoster.js'
import { coachCanAccessThreadWithParticipants, memberIsThreadParticipant } from './messageThreads.js'

/** @type {Set<{ ws: import('ws').WebSocket, facilityId?: number, threadIds: Set<number>, reactionThreadId: number | null, userId?: number, memberId?: number }>} */
const clients = new Set()

function parseToken(req, jwtSecret) {
  try {
    const url = new URL(req.url, 'http://localhost')
    const queryToken = url.searchParams.get('token')
    const authHeader = req.headers.authorization
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const token = queryToken || headerToken
    if (!token) return null
    return jwt.verify(token, jwtSecret)
  } catch {
    return null
  }
}

function subscribeClient(client, channel) {
  const [type, rawId] = channel.split(':')
  const id = Number(rawId)
  if (!Number.isFinite(id)) return
  if (type === 'facility') client.facilityId = id
  else if (type === 'thread') client.threadIds.add(id)
  else if (type === 'user') client.userId = id
  else if (type === 'member') client.memberId = id
}

async function canSubscribeToReactions(pool, decoded, threadId, portal) {
  if (!Number.isSafeInteger(threadId) || threadId <= 0 || !['admin', 'coach', 'member'].includes(portal)) return false
  const userId = await resolveCanonicalTokenUserId(pool, decoded)
  const access = await loadCanonicalAccessContext(pool, userId)
  if (!access?.isActive || !access.facilityId || !access.portalAccess[portal]) return false

  const { rows: [thread] } = await pool.query(
    'SELECT * FROM coaching.message_thread WHERE id = $1 AND facility_id = $2',
    [threadId, access.facilityId],
  )
  if (!thread) return false
  if (portal === 'admin') return true
  if (portal === 'coach') return coachCanAccessThreadWithParticipants(pool, thread, access.userId)
  if (access.memberId == null) return false
  if (Number(thread.member_id) === access.memberId || await memberIsThreadParticipant(pool, threadId, access.memberId)) return true

  const guardians = await queryMinorChildGuardianMemberIds(pool, thread.member_id, access.facilityId)
  return guardians.includes(access.memberId)
}

/** Send an invalidation only. Each viewer fetches their own reaction state over HTTP. */
export function broadcastReactionUpdate(threadId) {
  const id = Number(threadId)
  const payload = JSON.stringify({ type: 'message.reactions_updated', threadId: id })
  for (const client of clients) {
    if (client.ws.readyState !== 1 || client.reactionThreadId !== id) continue
    try {
      client.ws.send(payload)
    } catch {
      // A dropped connection must not fail the saved reaction.
    }
  }
}

export function broadcastMessageEvent({ type, facilityId, threadId, userId, memberId, data }) {
  const payload = JSON.stringify({ type, facilityId, threadId, userId, memberId, data, ts: Date.now() })
  for (const client of clients) {
    if (client.ws.readyState !== 1) continue
    let match = false
    if (facilityId != null && client.facilityId === Number(facilityId)) match = true
    if (threadId != null && client.threadIds.has(Number(threadId))) match = true
    if (userId != null && client.userId === Number(userId)) match = true
    if (memberId != null && client.memberId === Number(memberId)) match = true
    if (match) {
      try {
        client.ws.send(payload)
      } catch {
        /* ignore */
      }
    }
  }
}

export function attachMessageWebSocket(server, { jwtSecret, pool }) {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws/messages')) {
      return
    }
    const decoded = parseToken(req, jwtSecret)
    if (!decoded) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const client = {
        ws,
        facilityId: decoded.facility_id ?? decoded.facilityId ?? undefined,
        threadIds: new Set(),
        reactionThreadId: null,
        userId: decoded.member_id ? undefined : Number(decoded.id || decoded.userId) || undefined,
        memberId: decoded.member_id ? Number(decoded.member_id ?? decoded.id) : undefined,
      }
      clients.add(client)

      let reactionSubscription = 0
      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(String(raw))
          if (msg.action === 'subscribe' && Array.isArray(msg.channels)) {
            for (const ch of msg.channels) subscribeClient(client, String(ch))
            ws.send(JSON.stringify({ type: 'subscribed', channels: msg.channels }))
          } else if (msg.action === 'subscribe_reactions') {
            const request = ++reactionSubscription
            client.reactionThreadId = null
            const threadId = Number(msg.threadId)
            if (await canSubscribeToReactions(pool, decoded, threadId, msg.portal) && request === reactionSubscription && ws.readyState === 1) {
              client.reactionThreadId = threadId
              ws.send(JSON.stringify({ type: 'reaction_subscription', threadId }))
            }
          }
        } catch {
          /* ignore malformed */
        }
      })

      ws.on('close', () => clients.delete(client))
      ws.send(JSON.stringify({ type: 'connected' }))
    })
  })

  console.log('✅ Message WebSocket attached at /ws/messages')
  return wss
}
