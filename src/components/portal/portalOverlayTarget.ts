import { createContext } from 'react'

/** A modal can host its floating controls inside the browser's top layer. */
export const PortalOverlayTarget = createContext<HTMLElement | null>(null)
