import type { ReactNode } from 'react'

interface MessagingThreadDetailShellProps {
  header: ReactNode
  footer?: ReactNode
  children: ReactNode
}

/** Thread detail: fixed header/footer with a single scroll region for messages + contextual blocks. */
export default function MessagingThreadDetailShell({
  header,
  footer,
  children,
}: MessagingThreadDetailShellProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="shrink-0">{header}</div>
      <div className="messaging-scroll flex-1 min-h-0 overflow-y-auto">{children}</div>
      {footer ? <div className="shrink-0">{footer}</div> : null}
    </div>
  )
}
