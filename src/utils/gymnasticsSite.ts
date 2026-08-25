import { GYMNASTICS_ORIGIN } from '../config/gymnasticsSeo'
import { getStubSportSiteUrl } from './sportSite'

export { GYMNASTICS_ORIGIN }

/** URL for the canonical Vortex Gymnastics site. */
export function getGymnasticsSiteUrl(path = '/'): string {
  return getStubSportSiteUrl('gymnastics', path)
}
