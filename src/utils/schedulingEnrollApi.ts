import { ALL_ENROLL_SITES, type EnrollSiteKey } from '../config/enrollSites'
import { getApiUrl } from './api'

type SchedulingEnrollApiCapabilities = {
  schedulingEnrollSites: boolean
}

let cachedCapabilities: SchedulingEnrollApiCapabilities | null = null

export async function getSchedulingEnrollApiCapabilities(): Promise<SchedulingEnrollApiCapabilities> {
  if (cachedCapabilities) return cachedCapabilities

  try {
    const res = await fetch(`${getApiUrl()}/api/health`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error('health check failed')
    const data = (await res.json()) as {
      buildId?: string
      apiFeatures?: { schedulingEnrollSites?: boolean }
    }
    cachedCapabilities = {
      schedulingEnrollSites:
        data.apiFeatures?.schedulingEnrollSites === true ||
        data.buildId === 'scheduling-enroll-sites-2026-06-15',
    }
  } catch {
    cachedCapabilities = { schedulingEnrollSites: false }
  }

  return cachedCapabilities
}

export function resolveLegacyProgramEnrollSelection(
  requestedSites: EnrollSiteKey[],
  previousSites: EnrollSiteKey[],
): { apiActive: boolean; displaySites: EnrollSiteKey[] } {
  if (requestedSites.length === 0) {
    return { apiActive: false, displaySites: [] }
  }

  const hadAll = ALL_ENROLL_SITES.every((site) => previousSites.includes(site))
  const wantsAll = ALL_ENROLL_SITES.every((site) => requestedSites.includes(site))

  // Legacy API only supports all enroll pages on or off.
  if (hadAll && !wantsAll) {
    return { apiActive: false, displaySites: [] }
  }

  return { apiActive: true, displaySites: [...ALL_ENROLL_SITES] }
}

export function adaptProgramSchedulingUpdateForApi<
  T extends { schedulingEnrollSites?: EnrollSiteKey[]; schedulingActive?: boolean },
>(payload: T, supportsEnrollSites: boolean): T {
  if (supportsEnrollSites || payload.schedulingEnrollSites === undefined) {
    return payload
  }

  const { schedulingEnrollSites, ...rest } = payload
  return {
    ...rest,
    schedulingActive: schedulingEnrollSites.length > 0,
  } as T
}

export function buildProgramSchedulingUpdatePayload(
  requestedSites: EnrollSiteKey[],
  previousSites: EnrollSiteKey[],
  supportsEnrollSites: boolean,
): {
  payload: { schedulingEnrollSites?: EnrollSiteKey[]; schedulingActive?: boolean }
  displaySites: EnrollSiteKey[]
} {
  if (supportsEnrollSites) {
    return { payload: { schedulingEnrollSites: requestedSites }, displaySites: requestedSites }
  }

  const resolved = resolveLegacyProgramEnrollSelection(requestedSites, previousSites)
  return {
    payload: { schedulingActive: resolved.apiActive },
    displaySites: resolved.displaySites,
  }
}

export function adaptFormEnrollSitesBody(
  enrollSites: EnrollSiteKey[],
  supportsEnrollSites: boolean,
): { enrollSites?: EnrollSiteKey[]; isActive?: boolean } {
  if (supportsEnrollSites) return { enrollSites }
  return { isActive: enrollSites.length > 0 }
}

export function adaptCategoryUpdateForApi(
  payload: { name: string; sortOrder?: number; isActive?: boolean; enrollSites?: EnrollSiteKey[] },
  supportsEnrollSites: boolean,
): typeof payload {
  if (supportsEnrollSites || payload.enrollSites === undefined) {
    return payload
  }

  const { enrollSites, ...rest } = payload
  return {
    ...rest,
    isActive: enrollSites.length > 0,
  }
}

/** Best-effort sites list when API only returns legacy schedulingActive. */
export function enrollSitesFromApiResponse(input: {
  schedulingEnrollSites?: EnrollSiteKey[] | null
  schedulingActive?: boolean
  enrollSites?: EnrollSiteKey[] | null
  isActive?: boolean
}): EnrollSiteKey[] {
  if (input.schedulingActive === false || input.isActive === false) {
    return []
  }
  if (Array.isArray(input.schedulingEnrollSites) && input.schedulingEnrollSites.length > 0) {
    return input.schedulingEnrollSites
  }
  if (Array.isArray(input.enrollSites) && input.enrollSites.length > 0) {
    return input.enrollSites
  }
  if (input.schedulingActive || input.isActive) {
    return [...ALL_ENROLL_SITES]
  }
  return []
}
