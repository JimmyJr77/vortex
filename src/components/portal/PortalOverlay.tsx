import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PortalOverlayTarget } from './portalOverlayTarget'
import { PortalThemeContext } from './portalThemeContext'

/** Preserve workspace styling for floating UI without changing its positioning. */
export default function PortalOverlay({ children }: { children: ReactNode }) {
  const themed = useContext(PortalThemeContext)
  const target = useContext(PortalOverlayTarget)
  return createPortal(
    themed ? <div className="vortex-portal-theme portal-overlay-root">{children}</div> : children,
    target ?? document.body,
  )
}
