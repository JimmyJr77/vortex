import { useEffect, useRef } from 'react'
import { getCoachToken } from '../coach/api'
import { getAdminToken, getApiUrl } from '../utils/api'
import type { MessageRow, MessagingRole } from '../components/messaging/types'

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
  connectionKey?: string
  enabled?: boolean
  threadId?: number | null
  onMessageCreated?: (payload: Omit<MessageRealtimePayload, 'data'> & { data?: MessageRow }) => void
  onReadUpdated?: (payload: MessageRealtimePayload) => void
  onNotificationCreated?: (payload: MessageRealtimePayload) => void
  onPanelPreferencesInvalidated?: () => void
  onReactionsInvalidated?: (threadId: number) => void
}

function messageFromEvent(data: unknown): MessageRow | undefined {
  const message = data && typeof data === 'object' && 'message' in data ? data.message : data
  if (!message || typeof message !== 'object' || !('id' in message) || !('created_at' in message)) return
  if (!Number.isSafeInteger(Number(message.id)) || typeof message.created_at !== 'string') return
  return message as MessageRow
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
  connectionKey,
  threadId = null,
  onMessageCreated,
  onReadUpdated,
  onNotificationCreated,
  onReactionsInvalidated,
  onPanelPreferencesInvalidated,
}: UseMessageRealtimeOptions): void {
  const callbacksRef = useRef({ onMessageCreated, onReadUpdated, onNotificationCreated, onReactionsInvalidated, onPanelPreferencesInvalidated })
  callbacksRef.current = { onMessageCreated, onReadUpdated, onNotificationCreated, onReactionsInvalidated, onPanelPreferencesInvalidated }

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
        if (callbacksRef.current.onReactionsInvalidated) {
          ws.send(JSON.stringify({ action: 'subscribe_reactions', threadId: id, portal: role }))
        }
      }
    }

    const handlePayload = (payload: MessageRealtimePayload) => {
      switch (payload.type) {
        case 'message.created':
          callbacksRef.current.onMessageCreated?.({ ...payload, data: messageFromEvent(payload.data) })
          break
        case 'read.updated':
          callbacksRef.current.onReadUpdated?.(payload)
          break
        case 'notification.created':
          callbacksRef.current.onNotificationCreated?.(payload)
          break
        case 'panel_preferences_subscription':
        case 'message.panel_preferences_updated':
          callbacksRef.current.onPanelPreferencesInvalidated?.()
          break
        case 'reaction_subscription':
        case 'message.reactions_updated':
          if (threadId != null && Number(payload.threadId) === threadId) {
            callbacksRef.current.onReactionsInvalidated?.(threadId)
          }
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
        if (disposed) return
        attempt = 0
        if (callbacksRef.current.onPanelPreferencesInvalidated) {
          ws?.send(JSON.stringify({ action: 'subscribe_panel_preferences', portal: role }))
        }
        if (threadId != null) subscribeThread(threadId)
      }

      ws.onmessage = (event) => {
        if (disposed) return
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
  }, [enabled, role, threadId, connectionKey])
}
