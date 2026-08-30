import type { CostUnit } from '../../utils/schedulingApi'

export interface PricingCostsValues {
  slotCostMonthlyCents: number
  costUnit: CostUnit
  freeSlotsPerUser: number
  maxFreeSlotsTotal: number | ''
}

export function pricingValuesFromProgram(program: {
  pricingSlotCostMonthlyCents?: number
  pricingCostUnit?: CostUnit
  pricingFreeSlotsPerUser?: number
  pricingMaxFreeSlotsTotal?: number | null
}): PricingCostsValues {
  return {
    slotCostMonthlyCents: program.pricingSlotCostMonthlyCents ?? 0,
    costUnit: program.pricingCostUnit ?? 'per_month',
    freeSlotsPerUser: program.pricingFreeSlotsPerUser ?? 0,
    maxFreeSlotsTotal: program.pricingMaxFreeSlotsTotal ?? '',
  }
}

export function pricingValuesFromClass(classRow: {
  formSlotCostMonthlyCents?: number
  formCostUnit?: CostUnit | null
  formFreeSlotsPerUser?: number
  formMaxFreeSlotsTotal?: number | null
  slotCostMonthlyCents?: number
  costUnit?: CostUnit
  freeSlotsPerUser?: number
  maxFreeSlotsTotal?: number | null
  pricingOverridesProgram?: boolean
}): PricingCostsValues {
  if (classRow.pricingOverridesProgram) {
    return {
      slotCostMonthlyCents: classRow.formSlotCostMonthlyCents ?? 0,
      costUnit: classRow.formCostUnit ?? classRow.costUnit ?? 'per_month',
      freeSlotsPerUser: classRow.formFreeSlotsPerUser ?? 0,
      maxFreeSlotsTotal: classRow.formMaxFreeSlotsTotal ?? '',
    }
  }
  return {
    slotCostMonthlyCents: classRow.slotCostMonthlyCents ?? 0,
    costUnit: classRow.costUnit ?? 'per_month',
    freeSlotsPerUser: classRow.freeSlotsPerUser ?? 0,
    maxFreeSlotsTotal: classRow.maxFreeSlotsTotal ?? '',
  }
}
