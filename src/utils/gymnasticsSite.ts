import { GYMNASTICS_ORIGIN } from '../config/gymnasticsSeo'
import { getStubSportSiteUrl } from './sportSite'

export { GYMNASTICS_ORIGIN }

/** Gymnastics section or functional route on the unified Vortex Athletics site. */
export function getGymnasticsSiteUrl(path = '/'): string {
  return getStubSportSiteUrl('gymnastics', path)
}
