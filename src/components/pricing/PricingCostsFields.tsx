export interface PricingCostsValues {
  maxSlotsPerUser: number | ''
  slotCostMonthlyCents: number
  freeSlotsPerUser: number
}

interface Props {
  values: PricingCostsValues
  onChange: (values: PricingCostsValues) => void
  disabled?: boolean
}

const PricingCostsFields = ({ values, onChange, disabled = false }: Props) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold mb-1">Max slots per user</label>
        <input
          type="number"
          min={1}
          placeholder="Unlimited"
          disabled={disabled}
          value={values.maxSlotsPerUser}
          onChange={(e) => {
            const v = e.target.value
            onChange({
              ...values,
              maxSlotsPerUser: v === '' ? '' : Math.max(1, Number(v)),
            })
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 disabled:bg-gray-50"
        />
        <p className="text-xs text-gray-500 mt-1">Leave empty for no limit.</p>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Cost per slot per month ($)</label>
        <input
          type="number"
          min={0}
          step={0.01}
          disabled={disabled}
          value={values.slotCostMonthlyCents / 100}
          onChange={(e) => {
            onChange({
              ...values,
              slotCostMonthlyCents: Math.round((Number(e.target.value) || 0) * 100),
            })
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 disabled:bg-gray-50"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Free slots per user</label>
        <input
          type="number"
          min={0}
          disabled={disabled}
          value={values.freeSlotsPerUser}
          onChange={(e) => {
            onChange({
              ...values,
              freeSlotsPerUser: Math.max(0, Number(e.target.value) || 0),
            })
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 disabled:bg-gray-50"
        />
      </div>
    </div>
  )
}

export function pricingValuesFromProgram(program: {
  pricingMaxSlotsPerUser?: number | null
  pricingSlotCostMonthlyCents?: number
  pricingFreeSlotsPerUser?: number
}): PricingCostsValues {
  return {
    maxSlotsPerUser: program.pricingMaxSlotsPerUser ?? '',
    slotCostMonthlyCents: program.pricingSlotCostMonthlyCents ?? 0,
    freeSlotsPerUser: program.pricingFreeSlotsPerUser ?? 0,
  }
}

export function pricingValuesFromClass(classRow: {
  formMaxSlotsPerUser?: number | null
  formSlotCostMonthlyCents?: number
  formFreeSlotsPerUser?: number
  maxSlotsPerUser?: number | null
  slotCostMonthlyCents?: number
  freeSlotsPerUser?: number
  pricingOverridesProgram?: boolean
}): PricingCostsValues {
  if (classRow.pricingOverridesProgram) {
    return {
      maxSlotsPerUser: classRow.formMaxSlotsPerUser ?? '',
      slotCostMonthlyCents: classRow.formSlotCostMonthlyCents ?? 0,
      freeSlotsPerUser: classRow.formFreeSlotsPerUser ?? 0,
    }
  }
  return {
    maxSlotsPerUser: classRow.maxSlotsPerUser ?? '',
    slotCostMonthlyCents: classRow.slotCostMonthlyCents ?? 0,
    freeSlotsPerUser: classRow.freeSlotsPerUser ?? 0,
  }
}

export default PricingCostsFields
