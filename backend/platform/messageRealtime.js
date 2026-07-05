/**
 * WebSocket realtime channel for coaching messages.
 */

import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'
import { URL } from 'url'

/** @type {Set<{ ws: import('ws').WebSocket, facilityId?: number, threadIds: Set<number>, userId?: number, memberId?: number }>} */
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

function channelKey(type, id) {
  return `${type}:${id}`
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
        userId: decoded.member_id ? undefined : Number(decoded.id || decoded.userId) || undefined,
        memberId: decoded.member_id ? Number(decoded.member_id ?? decoded.id) : undefined,
      }
      clients.add(client)

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(String(raw))
          if (msg.action === 'subscribe' && Array.isArray(msg.channels)) {
            for (const ch of msg.channels) subscribeClient(client, String(ch))
            ws.send(JSON.stringify({ type: 'subscribed', channels: msg.channels }))
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
