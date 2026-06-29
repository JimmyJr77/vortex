import { getApiUrl, adminApiRequest } from './api'
import { type CostUnit } from './schedulingApi'
import {
  enabledBasePricingOptions,
  type ProgramPricingOption,
  type ProgramPricingOptionKey,
} from './programPricingOptions'
import { type MultiClassPassPackage } from './multiClassPassPackages'

export type ProgramPricingApiCapabilities = {
  pricingCostOptions: boolean
  multiClassPassPackages: boolean
}

let cachedCapabilities: ProgramPricingApiCapabilities | null = null
/** Set after API rejects pricingCostOptions payloads (stale production backend). */
let forceLegacyProgramPricing = false

export function invalidateProgramPricingApiCapabilities(): void {
  cachedCapabilities = null
}

export function markProgramPricingCostOptionsUnsupported(): void {
  forceLegacyProgramPricing = true
  cachedCapabilities = { pricingCostOptions: false, multiClassPassPackages: false }
}

function costUnitFromPricingOptionKey(key: ProgramPricingOptionKey): CostUnit {
  if (key === 'per_class') return 'per_class'
  if (key === 'per_hour') return 'per_hour'
  if (key === 'per_offering') return 'per_offering'
  return 'per_month'
}

/** Map checkbox pricing UI to legacy single-cost columns for older backends. */
export function legacyProgramPricingPayloadFromOptions(options: ProgramPricingOption[]): {
  pricingSlotCostMonthlyCents: number
  pricingCostUnit: CostUnit
} {
  const enabled = enabledBasePricingOptions(options)
  if (enabled.length > 1) {
    throw new Error(
      'This backend only supports one program price at a time. Enable a single pricing option, or redeploy the backend (buildId pricing-save-fix-2026-06-29 or newer).',
    )
  }

  const primary =
    enabled.find((o) => o.key === 'monthly_1x') ??
    enabled.find((o) => o.key === 'per_class') ??
    enabled[0]

  if (!primary) {
    return { pricingSlotCostMonthlyCents: 0, pricingCostUnit: 'per_month' }
  }

  return {
    pricingSlotCostMonthlyCents: primary.amountCents,
    pricingCostUnit: costUnitFromPricingOptionKey(primary.key),
  }
}

export async function getProgramPricingApiCapabilities(): Promise<ProgramPricingApiCapabilities> {
  if (cachedCapabilities) return cachedCapabilities

  if (forceLegacyProgramPricing) {
    cachedCapabilities = { pricingCostOptions: false, multiClassPassPackages: false }
    return cachedCapabilities
  }

  try {
    const res = await fetch(`${getApiUrl()}/api/health`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = (await res.json()) as {
        buildId?: string
        apiFeatures?: {
          programPricingCostOptions?: boolean
          multiClassPassPackages?: boolean
        }
      }
      if (data.apiFeatures?.programPricingCostOptions === true) {
        cachedCapabilities = {
          pricingCostOptions: true,
          multiClassPassPackages: data.apiFeatures.multiClassPassPackages === true,
        }
        return cachedCapabilities
      }
      if (data.buildId === 'pricing-save-fix-2026-06-29') {
        cachedCapabilities = { pricingCostOptions: true, multiClassPassPackages: true }
        return cachedCapabilities
      }
    }
  } catch {
    // fall through to admin probe
  }

  try {
    const res = await adminApiRequest('/api/admin/programs-top?archived=false')
    if (res.ok) {
      const data = (await res.json()) as { data?: Array<Record<string, unknown>> }
      const sample = data.data?.[0]
      if (sample && Object.prototype.hasOwnProperty.call(sample, 'pricingCostOptions')) {
        cachedCapabilities = {
          pricingCostOptions: true,
          multiClassPassPackages: Object.prototype.hasOwnProperty.call(sample, 'multiClassPassPackages'),
        }
        return cachedCapabilities
      }
    }
  } catch {
    // default legacy below
  }

  cachedCapabilities = { pricingCostOptions: false, multiClassPassPackages: false }
  return cachedCapabilities
}

export function adaptProgramPricingUpdateForApi<
  T extends {
    pricingCostOptions?: ProgramPricingOption[]
    multiClassPassPackages?: MultiClassPassPackage[]
    pricingSlotCostMonthlyCents?: number
    pricingCostUnit?: CostUnit
  },
>(payload: T, supportsPricingCostOptions: boolean): T {
  if (supportsPricingCostOptions || payload.pricingCostOptions === undefined) {
    return payload
  }

  const { pricingCostOptions, multiClassPassPackages: _packages, ...rest } = payload
  return {
    ...rest,
    ...legacyProgramPricingPayloadFromOptions(pricingCostOptions),
  } as T
}

export function pricingCostOptionsRejected(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('pricingcostoptions') && lower.includes('not allowed')
}

export function multiClassPassPackagesRejected(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('multiclasspasspackages') && lower.includes('not allowed')
}
