import type { SpecialPageConfig } from '../types/specialPages'
import { getGymnasticsSiteUrl } from './gymnasticsSite'
import { getHubSiteUrl } from './crossDomainConsent'

export const getSpecialPageHref = (page: SpecialPageConfig, currentSiteKey: string) => {
  if (page.canonicalSiteKey === currentSiteKey) return page.path
  if (page.canonicalSiteKey === 'gymnastics') return getGymnasticsSiteUrl(page.path)
  return getHubSiteUrl(page.path)
}
