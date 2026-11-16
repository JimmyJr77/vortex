import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { messagingWorkspaceGrid, messagingViewportShowsBothPanels } from './messagingLayout'

interface MessagingMobileShellProps {
  selectedThreadId: number | null
  detailOpen?: boolean
  onBack: () => void
  listPanel: ReactNode
  detailPanel: ReactNode
  maximized?: boolean
}

export default function MessagingMobileShell({
  selectedThreadId,
  detailOpen = selectedThreadId != null,
  onBack,
  listPanel,
  detailPanel,
  maximized = false,
}: MessagingMobileShellProps) {
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
    <div className={`${messagingWorkspaceGrid} isolate min-h-0 flex-1 bg-white ${maximized ? '' : 'rounded-2xl border border-slate-200 shadow-sm'}`}>
      <div ref={listRef} className={`h-full min-h-0 min-w-0 flex-col overflow-hidden lg:border-r lg:border-slate-200 ${detailOpen ? 'hidden lg:flex' : 'flex'}`}>
        {listPanel}
      </div>
      <div className={`h-full min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50/80 ${detailOpen ? 'flex' : 'hidden lg:flex'}`}>
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{detailPanel}</div>
      </div>
    </div>
  )
}
