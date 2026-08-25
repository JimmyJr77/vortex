import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Maximize2, RefreshCw, X } from 'lucide-react'
import { coachFetch } from '../coach/api'
import { adminApiRequest } from '../utils/api'
import {
  dispatchNotificationNavigate,
  isNotificationNavigable,
  resolveNotificationTarget,
} from '../utils/notificationNavigation'
import {
  highlightNotificationLabel,
  isHighlightNotification,
} from '../utils/notificationHighlight'
import { HEADER_ACTION_BTN } from './PortalNavButtons'

interface NotificationRow {
  id: number | string
  kind: string
  title: string
  body?: string | null
  payload?: Record<string, unknown>
  read_at?: string | null
  created_at: string
  persistent?: boolean
}

interface PendingCancellationRequest {
  id: number
  member_name?: string | null
  class_name?: string | null
  request_reason?: string | null
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

async function loadPendingCancellationAlerts(): Promise<NotificationRow[]> {
  try {
    const response = await adminApiRequest('/api/admin/billing/cancellation-requests?status=pending')
    if (response.status === 403) return []
    const json = await response.json().catch(() => ({}))
    if (!response.ok || json?.success === false) return []
    const rows = (json?.data ?? []) as PendingCancellationRequest[]
    return rows.map((row) => ({
      id: `cancellation-request-${row.id}`,
      kind: 'cancellation_request',
      title: `Cancellation request: ${row.member_name?.trim() || 'Family member'}`,
      body: [
        row.class_name?.trim() || 'Enrollment',
        'Awaiting administrator review',
        row.request_reason?.trim() ? `Comments: ${row.request_reason.trim()}` : null,
      ].filter(Boolean).join(' · '),
      payload: {
        type: 'cancellation_request',
        cancellation_request_id: row.id,
      },
      read_at: null,
      created_at: row.created_at,
      persistent: true,
    }))
  } catch {
    return []
  }
}

function NotificationList({
  notifications,
  apiPrefix,
  compact,
  onSelect,
}: {
  notifications: NotificationRow[]
  apiPrefix: NotificationBellProps['apiPrefix']
  compact: boolean
  onSelect: (notification: NotificationRow) => void
}) {
  return (
    <ul className="divide-y divide-gray-100">
      {notifications.map((notification) => {
        const navigable = isNotificationNavigable(
          notification.kind,
          notification.payload,
          apiPrefix,
        )
        const highlighted = isHighlightNotification(notification.kind, notification.payload)
        const highlightLabel = notification.persistent
          ? 'Action required'
          : highlightNotificationLabel(notification.kind, notification.payload)
        const isCritical = notification.payload?.critical === true
        return (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => onSelect(notification)}
              className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 ${
                !notification.read_at && highlighted
                  ? isCritical
                    ? 'bg-orange-50 border-l-4 border-l-orange-500'
                    : 'bg-amber-50 border-l-4 border-l-amber-500'
                  : highlighted
                    ? isCritical
                      ? 'border-l-4 border-l-orange-200'
                      : 'border-l-4 border-l-amber-200'
                    : ''
              } ${navigable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {highlightLabel && (
                <div
                  className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${
                    isCritical ? 'text-orange-700' : 'text-amber-700'
                  }`}
                >
                  {highlightLabel}
                </div>
              )}
              <div className="text-sm font-medium text-gray-900">{notification.title}</div>
              {notification.body && (
                <div className={`text-xs text-gray-600 mt-0.5 ${compact ? 'line-clamp-2' : ''}`}>
                  {notification.body}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 mt-1">
                <div className="text-[10px] text-gray-400">
                  {new Date(notification.created_at).toLocaleString()}
                </div>
                {navigable && (
                  <span className="text-[10px] font-semibold text-vortex-red shrink-0">
                    {notification.persistent ? 'Review' : 'Open'}
                  </span>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
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
  const [maximized, setMaximized] = useState(false)
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
      const cancellationAlertsPromise = apiPrefix === 'admin'
        ? loadPendingCancellationAlerts()
        : Promise.resolve([])
      const data = await portalFetch<{ notifications: NotificationRow[]; unreadCount: number }>(apiPrefix, base)
      const cancellationAlerts = await cancellationAlertsPromise
      setNotifications([...cancellationAlerts, ...data.notifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ))
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
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 60_000)
    return () => {
      window.clearInterval(refreshTimer)
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

  useEffect(() => {
    if (!open && !maximized) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      setMaximized(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [maximized, open])

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
        prev.map((n) => n.persistent
          ? n
          : { ...n, read_at: n.read_at ?? new Date().toISOString() }),
      )
      setUnreadCount(0)
    } catch {
      /* best-effort */
    }
  }

  const handleNotificationClick = (notification: NotificationRow) => {
    if (!notification.persistent && !notification.read_at && typeof notification.id === 'number') {
      void markRead(notification.id)
    }
    const target = resolveNotificationTarget(notification.kind, notification.payload, apiPrefix)
    if (!target) return
    setOpen(false)
    setMaximized(false)
    if (onOpenThread && target.threadId != null) {
      onOpenThread(target.threadId)
      return
    }
    dispatchNotificationNavigate(target)
  }

  const persistentAlertCount = notifications.filter((notification) => notification.persistent).length
  const highlightedCount = unreadCount + persistentAlertCount
  const compactNotifications = notifications.slice(0, 5)

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setMaximized(false)
          setOpen((o) => !o)
          if (!open) void load()
        }}
        className={`relative ${HEADER_ACTION_BTN} ${
          highlightedCount > 0
            ? 'notification-bell-unread text-white hover:opacity-90'
            : 'bg-gray-700 text-white hover:bg-gray-600'
        }`}
        aria-label="Notifications"
        aria-expanded={open || maximized}
      >
        <Bell className={`w-4 h-4 ${highlightedCount > 0 ? 'notification-bell-icon' : ''}`} />
        {highlightedCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-vortex-red text-white text-[10px] font-bold flex items-center justify-center">
            {highlightedCount > 9 ? '9+' : highlightedCount}
          </span>
        )}
      </button>
      {open && panelPos && (
        <div
          className="fixed z-[100] flex flex-col overflow-hidden bg-white border border-gray-200 rounded-xl shadow-lg"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            width: panelPos.width,
            maxHeight: panelPos.maxHeight,
          }}
          aria-label="Recent alerts"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 sticky top-0 bg-white z-10">
            <span className="text-sm font-semibold text-gray-800">Recent alerts</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs text-vortex-red font-medium hover:underline"
                >
                  Mark read
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setMaximized(true)
                  void load()
                }}
                aria-label="Maximize notifications"
                title="Maximize notifications"
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {loading && notifications.length === 0 ? (
              <p className="text-sm text-gray-500 p-4">Loading…</p>
            ) : compactNotifications.length === 0 ? (
              <p className="text-sm text-gray-500 p-4">No alerts yet.</p>
            ) : (
              <NotificationList
                notifications={compactNotifications}
                apiPrefix={apiPrefix}
                compact
                onSelect={handleNotificationClick}
              />
            )}
          </div>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setMaximized(true)
                void load()
              }}
              className="border-t border-gray-100 px-3 py-2 text-center text-xs font-semibold text-vortex-red hover:bg-gray-50"
            >
              View all {notifications.length}{' '}
              {notifications.length === 1 ? 'alert' : 'alerts'}
            </button>
          )}
        </div>
      )}

      {maximized && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={() => setMaximized(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-center-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="flex max-h-[min(48rem,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <div>
                <h2 id="notification-center-title" className="text-xl font-bold text-gray-900">
                  Notifications
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Recent alerts and items that need your attention.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setMaximized(false)}
                  aria-label="Close notifications"
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loading && notifications.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">Loading…</p>
              ) : notifications.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">No notifications yet.</p>
              ) : (
                <NotificationList
                  notifications={notifications}
                  apiPrefix={apiPrefix}
                  compact={false}
                  onSelect={handleNotificationClick}
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-3 text-xs text-gray-500">
              <span>
                {apiPrefix === 'admin'
                  ? 'Pending cancellation requests remain here until approved or declined.'
                  : 'Recent notifications from your Vortex account.'}
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="shrink-0 font-semibold text-vortex-red hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
