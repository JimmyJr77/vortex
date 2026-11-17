import type { SpecialPageConfig } from '../types/specialPages'
import publicLandingRedirects from '../config/publicLandingRedirects.json'
import { getGymnasticsSiteUrl } from './gymnasticsSite'
import { getHubSiteUrl } from './crossDomainConsent'

export const getSpecialPageHref = (page: SpecialPageConfig, currentSiteKey: string) => {
  const redirect = (publicLandingRedirects as Partial<Record<string, string>>)[page.path]
  if (redirect) return currentSiteKey === 'hub' ? redirect : getHubSiteUrl(redirect)
  if (page.canonicalSiteKey === currentSiteKey) return page.path
  if (page.canonicalSiteKey === 'gymnastics') return getGymnasticsSiteUrl(page.path)
  return getHubSiteUrl(page.path)
}
