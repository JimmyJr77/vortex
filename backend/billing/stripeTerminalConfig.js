import { stripeEnabled } from './stripeBilling.js'

export function terminalLocationForFacility(facilityId, env = process.env) {
  if (env.STRIPE_TERMINAL_ENABLED !== 'true') return null
  try {
    const locations = JSON.parse(env.STRIPE_TERMINAL_LOCATIONS ?? '{}')
    const location = Object.hasOwn(locations, String(facilityId)) ? locations[facilityId] : null
    // A Stripe location identifies one facility, even if the Stripe account is shared.
    if (typeof location !== 'string' || !/^tml_[a-zA-Z0-9]+$/.test(location)) return null
    return Object.values(locations).filter((value) => value === location).length === 1 ? location : null
  } catch {
    return null
  }
}

export function terminalEnabledForFacility(facilityId) {
  return stripeEnabled() && Boolean(terminalLocationForFacility(facilityId))
}
