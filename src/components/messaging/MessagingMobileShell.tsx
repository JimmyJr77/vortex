import MessagingResizeHandle from './MessagingResizeHandle'
import type { MessagingRole } from './types'
import { useMessagingPanelPreferences, type PanelPreferenceFetcher } from './useMessagingPanelPreferences'
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CalendarDays, ChevronLeft, Paperclip } from 'lucide-react'
import { messagingWorkspaceGrid, messagingViewportShowsBothPanels } from './messagingLayout'

interface MessagingMobileShellProps {
  preferenceRole?: MessagingRole
  preferenceFetcher?: PanelPreferenceFetcher
  preferenceAccountKey?: string
  selectedThreadId: number | null
  detailOpen?: boolean
  onBack: () => void
  listPanel: ReactNode
  detailPanel: ReactNode
  resourcePanel?: (visibility: { filesVisible: boolean; eventsVisible: boolean }) => ReactNode
  maximized?: boolean
}

export default function MessagingMobileShell({
  preferenceRole,
  preferenceFetcher,
  preferenceAccountKey,
  selectedThreadId,
  detailOpen = selectedThreadId != null,
  onBack,
  listPanel,
  detailPanel,
  maximized = false,
  resourcePanel,
}: MessagingMobileShellProps) {
  const { filesVisible, eventsVisible, listWidth, sidebarWidth, busy, error, retry, togglePanel, setPanelWidth } = useMessagingPanelPreferences(preferenceAccountKey, preferenceRole, preferenceFetcher)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [workspaceWidth, setWorkspaceWidth] = useState(1280)
  const [preview, setPreview] = useState<{ account?: string; listWidth?: number | null; sidebarWidth?: number | null }>({})
  const maxWidth = Math.max(240, Math.min(480, Math.floor(workspaceWidth * 0.32)))
  const displayListWidth = Math.min(maxWidth, (preview.account === preferenceAccountKey ? preview.listWidth : null) ?? listWidth)
  const displaySidebarWidth = Math.min(maxWidth, (preview.account === preferenceAccountKey ? preview.sidebarWidth : null) ?? sidebarWidth)
  const previewWidth = (panel: 'listWidth' | 'sidebarWidth', width: number | null) => setPreview(previous => ({ ...(previous.account === preferenceAccountKey ? previous : {}), account: preferenceAccountKey, [panel]: width }))
  useLayoutEffect(() => {
    const element = workspaceRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setWorkspaceWidth(element.clientWidth))
    observer.observe(element)
    setWorkspaceWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])
  const resourcesVisible = filesVisible || eventsVisible
  const listRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const previousOpen = useRef<boolean | null>(null)

  useLayoutEffect(() => {
    const wasOpen = previousOpen.current
    previousOpen.current = detailOpen
    if (messagingViewportShowsBothPanels()) return
    if (detailOpen && !wasOpen) backRef.current?.focus({ preventScroll: true })
    if (!detailOpen && wasOpen) {
      const nextFocus = listRef.current?.querySelector<HTMLElement>('button[aria-current="true"]')
        ?? listRef.current?.querySelector<HTMLElement>('h3')
      nextFocus?.focus({ preventScroll: true })
    }
  }, [detailOpen])

  return (
    <div ref={workspaceRef} style={{ '--message-list-width': `${displayListWidth}px`, '--message-sidebar-width': `${displaySidebarWidth}px` } as CSSProperties} className={`${messagingWorkspaceGrid} lg:!grid-cols-[var(--message-list-width)_minmax(0,1fr)] ${maximized && resourcePanel ? resourcesVisible ? 'xl:!grid-cols-[var(--message-list-width)_minmax(0,1fr)_var(--message-sidebar-width)]' : 'xl:!grid-cols-[var(--message-list-width)_minmax(0,1fr)]' : ''} isolate min-h-0 flex-1 bg-white ${maximized ? '' : 'rounded-2xl border border-slate-200 shadow-sm'}`}>
      <div ref={listRef} className={`relative h-full min-h-0 min-w-0 flex-col overflow-hidden lg:border-r lg:border-slate-200 ${detailOpen ? 'hidden lg:flex' : 'flex'}`}>
        {listPanel}
        <div className="hidden lg:block"><MessagingResizeHandle key={preferenceAccountKey} label="Resize conversation list" side="left" width={displayListWidth} maxWidth={maxWidth} defaultWidth={320} busy={busy} onPreview={value => previewWidth('listWidth', value)} onCommit={value => setPanelWidth('listWidth', value)} /></div>
      </div>
      <div className={`h-full min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50/80 ${detailOpen ? 'flex' : 'hidden lg:flex'}`}>
        {maximized && resourcePanel && (
          <div role="group" aria-label="Conversation panels" className="hidden shrink-0 flex-wrap items-center justify-end gap-2 border-b border-slate-200 bg-white px-4 py-2 xl:flex">
            {error && <span role="alert" className="mr-auto text-xs text-red-700">{error} <button type="button" disabled={busy} onClick={retry} className="underline">Retry</button></span>}
            {[
              { label: 'Files', visible: filesVisible, toggle: () => togglePanel('filesVisible'), Icon: Paperclip },
              { label: 'Upcoming events', visible: eventsVisible, toggle: () => togglePanel('eventsVisible'), Icon: CalendarDays },
            ].map(({ label, visible, toggle, Icon }) => (
              <button key={label} type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} disabled={busy} onClick={toggle}
                className={`inline-flex min-h-9 items-center disabled:cursor-wait disabled:opacity-50 gap-2 rounded-lg border px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 ${visible ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                <Icon className="size-4" aria-hidden />{label}
              </button>
            ))}
          </div>
        )}
        {detailOpen && (
          <div className="shrink-0 border-b border-slate-200 bg-white px-2 py-0.5 lg:hidden">
            <button
              ref={backRef}
              type="button"
              onClick={onBack}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Conversations
            </button>
          </div>
        )}
        <div className={`flex min-h-0 w-full flex-1 flex-col overflow-hidden ${maximized ? 'mx-auto max-w-5xl' : ''}`}>{detailPanel}</div>
      </div>
      {maximized && resourcePanel && resourcesVisible && <div className="relative hidden min-h-0 min-w-0 overflow-hidden border-l border-slate-200 xl:block">
        <MessagingResizeHandle key={preferenceAccountKey} label="Resize resource panels" side="right" width={displaySidebarWidth} maxWidth={maxWidth} defaultWidth={304} busy={busy} onPreview={value => previewWidth('sidebarWidth', value)} onCommit={value => setPanelWidth('sidebarWidth', value)} />
        {resourcePanel({ filesVisible, eventsVisible })}
      </div>}
    </div>
  )
}
