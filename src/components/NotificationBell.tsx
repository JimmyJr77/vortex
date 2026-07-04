import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { coachFetch } from '../coach/api'

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
}

const MAX_LOAD_ATTEMPTS = 4

export default function NotificationBell({ apiPrefix }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const base = `/api/${apiPrefix}/notifications`

  const isStub = apiPrefix === 'admin'

  const load = useCallback(async (attempt = 0) => {
    if (isStub) return
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    setLoading(true)
    try {
      const data = await coachFetch<{ notifications: NotificationRow[]; unreadCount: number }>(base)
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
  }, [base, isStub])

  useEffect(() => {
    if (!isStub) void load()
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [load, isStub])

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
      await coachFetch(`${base}/${id}/read`, { method: 'PATCH' })
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
      await coachFetch(`${base}/mark-all-read`, { method: 'POST', body: '{}' })
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      )
      setUnreadCount(0)
    } catch {
      /* best-effort */
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) void load()
        }}
        className={`relative flex items-center justify-center px-3 md:px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
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
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
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
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read_at) void markRead(n.id)
                    }}
                    className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 ${!n.read_at ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="text-sm font-medium text-gray-900">{n.title}</div>
                    {n.body && (
                      <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.body}</div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
