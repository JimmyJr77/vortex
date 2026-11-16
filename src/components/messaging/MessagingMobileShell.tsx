import type { MessagingRole } from './types'
import { useMessagingPanelPreferences, type PanelPreferenceFetcher } from './useMessagingPanelPreferences'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
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
  const { filesVisible, eventsVisible, busy, error, retry, togglePanel } = useMessagingPanelPreferences(preferenceAccountKey, preferenceRole, preferenceFetcher)
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
    <div className={`${messagingWorkspaceGrid} ${maximized && resourcePanel ? resourcesVisible ? 'xl:!grid-cols-[minmax(260px,20rem)_minmax(0,1fr)_19rem]' : 'xl:!grid-cols-[minmax(260px,20rem)_minmax(0,1fr)]' : ''} isolate min-h-0 flex-1 bg-white ${maximized ? '' : 'rounded-2xl border border-slate-200 shadow-sm'}`}>
      <div ref={listRef} className={`h-full min-h-0 min-w-0 flex-col overflow-hidden lg:border-r lg:border-slate-200 ${detailOpen ? 'hidden lg:flex' : 'flex'}`}>
        {listPanel}
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
      {maximized && resourcePanel && resourcesVisible && <div className="hidden min-h-0 min-w-0 overflow-hidden border-l border-slate-200 xl:block">{resourcePanel({ filesVisible, eventsVisible })}</div>}
    </div>
  )
}
