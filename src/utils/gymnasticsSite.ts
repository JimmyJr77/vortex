import { GYMNASTICS_ORIGIN } from '../config/gymnasticsSeo'
import { getStubSportSiteUrl } from './sportSite'

export { GYMNASTICS_ORIGIN }

/** URL for the Vortex Gymnastics site (vortex-gymnastics.com). */
export function getGymnasticsSiteUrl(path = '/'): string {
  return getStubSportSiteUrl('gymnastics', path)
}
