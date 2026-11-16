import type { ReactNode } from 'react'
import { MessageSquare, type LucideIcon } from 'lucide-react'

export default function MessagingEmptyState({
  title,
  description,
  icon: Icon = MessageSquare,
  action,
  compact = false,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-10' : 'flex-1 px-6 py-12'}`}>
      <span className="mb-3 grid size-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm leading-relaxed text-slate-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
