import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  defaultOpen?: boolean
  badge?: ReactNode
  children: ReactNode
}

const CollapsiblePricingSection = ({
  title,
  description,
  defaultOpen = true,
  badge,
  children,
}: Props) => {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50/80 transition-colors"
      >
        <span className="mt-0.5 text-gray-500 shrink-0">
          {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{title}</span>
            {badge}
          </span>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </span>
      </button>
      {open && <div className="border-t border-gray-100 px-4 pb-4 pt-2">{children}</div>}
    </div>
  )
}

export default CollapsiblePricingSection
