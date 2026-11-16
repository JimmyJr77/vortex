import type { ReactNode } from 'react'
import './PortalTheme.css'

/** Shared presentation for authenticated workspaces; portal state stays with each shell. */
export default function PortalTheme({ children }: { children: ReactNode }) {
  return <div className="vortex-portal-theme">{children}</div>
}
