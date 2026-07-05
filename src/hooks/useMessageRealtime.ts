import { useEffect, useRef } from 'react'
import { getCoachToken } from '../coach/api'
import { getAdminToken, getApiUrl } from '../utils/api'
import type { MessagingRole } from '../components/messaging/types'

export interface MessageRealtimePayload {
  type: string
  facilityId?: number
  threadId?: number
  userId?: number
  memberId?: number
  data?: unknown
  ts?: number
}

export interface UseMessageRealtimeOptions {
  role: MessagingRole
  enabled?: boolean
  threadId?: number | null
  onMessageCreated?: (payload: MessageRealtimePayload) => void
  onReadUpdated?: (payload: MessageRealtimePayload) => void
  onNotificationCreated?: (payload: MessageRealtimePayload) => void
}

function wsOrigin(): string {
  const api = getApiUrl()
  const url = new URL(api)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.origin
}

function authToken(role: MessagingRole): string | null {
  if (role === 'admin') return getAdminToken()
  return getCoachToken()
}

export function useMessageRealtime({
  role,
  enabled = true,
  threadId = null,
  onMessageCreated,
  onReadUpdated,
  onNotificationCreated,
}: UseMessageRealtimeOptions): void {
  const callbacksRef = useRef({ onMessageCreated, onReadUpdated, onNotificationCreated })
  callbacksRef.current = { onMessageCreated, onReadUpdated, onNotificationCreated }

  useEffect(() => {
    if (!enabled) return

    const token = authToken(role)
    if (!token) return

    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let disposed = false
    let attempt = 0

    const subscribeThread = (id: number) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'subscribe', channels: [`thread:${id}`] }))
      }
    }

    const handlePayload = (payload: MessageRealtimePayload) => {
      switch (payload.type) {
        case 'message.created':
          callbacksRef.current.onMessageCreated?.(payload)
          break
        case 'read.updated':
          callbacksRef.current.onReadUpdated?.(payload)
          break
        case 'notification.created':
          callbacksRef.current.onNotificationCreated?.(payload)
          break
        default:
          break
      }
    }

    const connect = () => {
      if (disposed) return
      const url = `${wsOrigin()}/ws/messages?token=${encodeURIComponent(token)}`
      ws = new WebSocket(url)

      ws.onopen = () => {
        attempt = 0
        if (threadId != null) subscribeThread(threadId)
      }

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as MessageRealtimePayload
          handlePayload(payload)
        } catch {
          /* ignore malformed */
        }
      }

      ws.onclose = () => {
        if (disposed) return
        const delay = Math.min(30_000, 1_000 * 2 ** attempt)
        attempt += 1
        reconnectTimer = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws?.close()
      }
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [enabled, role, threadId])
}
