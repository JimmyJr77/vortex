export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
] as const

/** Basic US ZIP + city/state cross-check via Zippopotam (no API key). */
export async function verifyUsAddressZip(
  zip: string,
  state: string,
  city: string,
): Promise<{ ok: boolean; message: string }> {
  const zip5 = zip.replace(/\D/g, '').slice(0, 5)
  if (zip5.length !== 5) {
    return { ok: false, message: 'Enter a valid 5-digit ZIP code.' }
  }
  if (!state.trim()) {
    return { ok: false, message: 'Select a state.' }
  }
  if (!city.trim()) {
    return { ok: false, message: 'Enter a city.' }
  }
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip5}`)
    if (!res.ok) {
      return { ok: false, message: 'ZIP code not found. Check street, city, state, and ZIP.' }
    }
    const data = (await res.json()) as {
      places?: Array<{ 'state abbreviation': string; 'place name': string }>
    }
    const places = data.places ?? []
    const stateUpper = state.trim().toUpperCase()
    const cityLower = city.trim().toLowerCase()
    const match = places.some(
      (p) => p['state abbreviation']?.toUpperCase() === stateUpper
        && p['place name']?.toLowerCase() === cityLower,
    )
    if (!match) {
      const suggested = places[0]
      if (suggested) {
        return {
          ok: false,
          message: `ZIP ${zip5} is in ${suggested['place name']}, ${suggested['state abbreviation']}. Adjust city or state.`,
        }
      }
      return { ok: false, message: 'City, state, and ZIP do not match.' }
    }
    return { ok: true, message: 'Address verified for this ZIP, city, and state.' }
  } catch {
    return { ok: false, message: 'Could not verify address right now. You may continue anyway.' }
  }
}
