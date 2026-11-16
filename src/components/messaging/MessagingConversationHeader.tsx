import type { ReactNode } from 'react'
import { MessageSquare } from 'lucide-react'

export default function MessagingConversationHeader({
  title, subtitle, badge, children,
}: {
  title: string
  subtitle?: string | null
  badge?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
      <div className="flex min-w-[10rem] flex-1 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700">
          <MessageSquare className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 break-words text-base font-semibold leading-tight text-slate-900">{title}</h3>
            {badge && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{badge}</span>}
          </div>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-600" title={subtitle}>{subtitle}</p>}
        </div>
      </div>
      {children && <div className="ml-auto flex min-w-0 items-center gap-1">{children}</div>}
    </div>
  )
}
