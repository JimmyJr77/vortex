import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { messagingWorkspaceGrid } from './messagingLayout'

interface MessagingMobileShellProps {
  selectedThreadId: number | null
  onSelectThread?: (id: number | null) => void
  onBack: () => void
  listPanel: ReactNode
  detailPanel: ReactNode
  maximized?: boolean
}

export default function MessagingMobileShell({
  selectedThreadId,
  onBack,
  listPanel,
  detailPanel,
  maximized = false,
}: MessagingMobileShellProps) {
  const showDetail = selectedThreadId != null
  const panelClass = `messaging-panel flex flex-col min-h-0 flex-1 h-full max-h-full overflow-hidden${maximized ? ' messaging-panel--maximized' : ''}`

  return (
    <div className={`${messagingWorkspaceGrid} min-h-0 flex-1 h-full max-h-full`}>
      <div className={`min-h-0 flex flex-col h-full max-h-full overflow-hidden ${showDetail ? 'hidden lg:flex' : 'flex'}`}>
        {listPanel}
      </div>
      <div className={`min-h-0 flex flex-col h-full max-h-full overflow-hidden ${showDetail ? 'flex' : 'hidden lg:flex'}`}>
        <div className={panelClass}>
          {showDetail && (
            <div className="lg:hidden shrink-0 px-3 py-2 border-b border-gray-100 flex items-center gap-2 bg-white">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-gray-900"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden />
                Back
              </button>
            </div>
          )}
          <div className="flex flex-col flex-1 min-h-0 max-h-full overflow-hidden">{detailPanel}</div>
        </div>
      </div>
    </div>
  )
}
