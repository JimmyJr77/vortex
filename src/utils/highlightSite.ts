import { resolveStubSite } from '../config/stubSites'

/** Site key used for highlights API and localStorage (hub = master site). */
export function getHighlightSiteKey(): string {
  const stub = resolveStubSite(window.location.hostname, window.location.search)
  return stub?.key ?? 'hub'
}
