import { CircleHelp, MessageSquare } from 'lucide-react'

export type MessagingLeftPanel = 'threads' | 'faq-master'

interface MessagingLeftPanelTabsProps {
  active: MessagingLeftPanel
  onChange: (panel: MessagingLeftPanel) => void
  showFaqMaster?: boolean
}

export default function MessagingLeftPanelTabs({
  active,
  onChange,
  showFaqMaster = true,
}: MessagingLeftPanelTabsProps) {
  if (!showFaqMaster) return null

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Threads"
        aria-pressed={active === 'threads'}
        onClick={() => onChange('threads')}
        className={`p-1.5 rounded-lg ${active === 'threads' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
        title="Threads"
      >
        <MessageSquare className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label="FAQ library"
        aria-pressed={active === 'faq-master'}
        onClick={() => onChange('faq-master')}
        className={`p-1.5 rounded-lg ${active === 'faq-master' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
        title="FAQ library"
      >
        <CircleHelp className="w-4 h-4" />
      </button>
    </div>
  )
}
