import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { coachFetch } from '../coach/api'
import { adminApiRequest } from '../utils/api'
import {
  dispatchNotificationNavigate,
  isNotificationNavigable,
  resolveNotificationTarget,
} from '../utils/notificationNavigation'
import { HEADER_ACTION_BTN } from './PortalNavButtons'

interface NotificationRow {
  id: number
  kind: string
  title: string
  body?: string | null
  payload?: Record<string, unknown>
  read_at?: string | null
  created_at: string
}

interface NotificationBellProps {
  apiPrefix: 'coach' | 'member' | 'admin'
  onOpenThread?: (threadId: number) => void
}

const MAX_LOAD_ATTEMPTS = 4
const PANEL_MARGIN = 12

interface PanelPosition {
  top: number
  left: number
  width: number
  maxHeight: number
}

async function portalFetch<T>(
  apiPrefix: NotificationBellProps['apiPrefix'],
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  if (apiPrefix === 'admin') {
    const res = await adminApiRequest(endpoint, options)
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.success === false) {
      throw new Error(json?.message || `Request failed: ${res.status}`)
    }
    return (json?.data ?? json) as T
  }
  return coachFetch<T>(endpoint, options)
}

export default function NotificationBell({ apiPrefix, onOpenThread }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const base = `/api/${apiPrefix}/notifications`

  const load = useCallback(async (attempt = 0) => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    setLoading(true)
    try {
      const data = await portalFetch<{ notifications: NotificationRow[]; unreadCount: number }>(apiPrefix, base)
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      const shouldRetry =
        attempt < MAX_LOAD_ATTEMPTS
        && /502|503|504|failed to fetch|network/i.test(message)
      if (shouldRetry) {
        retryTimerRef.current = setTimeout(() => {
          void load(attempt + 1)
        }, 1500 * (attempt + 1))
        return
      }
    } finally {
      setLoading(false)
    }
  }, [apiPrefix, base])

  const updatePanelPosition = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const width = Math.min(320, viewportWidth - PANEL_MARGIN * 2)
    const left = Math.max(
      PANEL_MARGIN,
      Math.min(rect.right - width, viewportWidth - width - PANEL_MARGIN),
    )
    const top = rect.bottom + 8
    const maxHeight = Math.max(160, window.innerHeight - top - PANEL_MARGIN)
    setPanelPos({ top, left, width, maxHeight })
  }, [])

  useEffect(() => {
    void load()
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [load])

  useEffect(() => {
    if (!open) {
      setPanelPos(null)
      return
    }
    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const markRead = async (id: number) => {
    try {
      await portalFetch(apiPrefix, `${base}/${id}/read`, { method: 'PATCH' })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      /* best-effort */
    }
  }

  const markAllRead = async () => {
    try {
      await portalFetch(apiPrefix, `${base}/mark-all-read`, { method: 'POST', body: '{}' })
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      )
      setUnreadCount(0)
    } catch {
      /* best-effort */
    }
  }

  const handleNotificationClick = (notification: NotificationRow) => {
    if (!notification.read_at) void markRead(notification.id)
    const target = resolveNotificationTarget(notification.kind, notification.payload, apiPrefix)
    if (!target) return
    setOpen(false)
    if (onOpenThread && target.threadId != null) {
      onOpenThread(target.threadId)
      return
    }
    dispatchNotificationNavigate(target)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) void load()
        }}
        className={`relative ${HEADER_ACTION_BTN} ${
          unreadCount > 0
            ? 'notification-bell-unread text-white hover:opacity-90'
            : 'bg-gray-700 text-white hover:bg-gray-600'
        }`}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'notification-bell-icon' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-vortex-red text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && panelPos && (
        <div
          className="fixed z-[100] overflow-auto overscroll-contain bg-white border border-gray-200 rounded-xl shadow-lg"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            width: panelPos.width,
            maxHeight: panelPos.maxHeight,
          }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 sticky top-0 bg-white z-10">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-vortex-red font-medium hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {loading && notifications.length === 0 ? (
            <p className="text-sm text-gray-500 p-4">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-gray-500 p-4">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((n) => {
                const navigable = isNotificationNavigable(n.kind, n.payload, apiPrefix)
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 ${
                        !n.read_at ? 'bg-blue-50/50' : ''
                      } ${navigable ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="text-sm font-medium text-gray-900">{n.title}</div>
                      {n.body && (
                        <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.body}</div>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="text-[10px] text-gray-400">
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                        {navigable && (
                          <span className="text-[10px] font-semibold text-vortex-red shrink-0">Open</span>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
