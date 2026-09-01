export function requireAdminFacilityScope({ facilityId = null, allowGlobal = false } = {}) {
  if (allowGlobal === true && facilityId == null) return null

  const normalizedFacilityId = Number(facilityId)
  if (!Number.isSafeInteger(normalizedFacilityId) || normalizedFacilityId <= 0) {
    const error = new Error('Authenticated facility scope is required.')
    error.statusCode = 403
    throw error
  }
  return normalizedFacilityId
}
