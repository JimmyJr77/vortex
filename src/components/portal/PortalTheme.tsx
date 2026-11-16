import type { ReactNode } from 'react'
import { PortalThemeContext } from './portalThemeContext'
import './PortalTheme.css'

/** Shared presentation for authenticated workspaces; portal state stays with each shell. */
export default function PortalTheme({ children }: { children: ReactNode }) {
  return <PortalThemeContext.Provider value={true}><div className="vortex-portal-theme">{children}</div></PortalThemeContext.Provider>
}
