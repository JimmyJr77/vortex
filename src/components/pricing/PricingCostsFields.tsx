export interface PricingCostsValues {
  slotCostMonthlyCents: number
  freeSlotsPerUser: number
  maxFreeSlotsTotal: number | ''
}

interface Props {
  values: PricingCostsValues
  onChange: (values: PricingCostsValues) => void
  disabled?: boolean
  totalFreeSlotsLabel?: string
  totalFreeSlotsHelp?: string
}

const PricingCostsFields = ({
  values,
  onChange,
  disabled = false,
  totalFreeSlotsLabel = 'Total free slots',
  totalFreeSlotsHelp = 'Leave empty for unlimited. Caps free slots granted across all members (first-come, first-served).',
}: Props) => {
  return (
    <div className="space-y-4">
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
      <div>
        <label className="block text-sm font-semibold mb-1">{totalFreeSlotsLabel}</label>
        <input
          type="number"
          min={0}
          placeholder="Unlimited"
          disabled={disabled}
          value={values.maxFreeSlotsTotal}
          onChange={(e) => {
            const v = e.target.value
            onChange({
              ...values,
              maxFreeSlotsTotal: v === '' ? '' : Math.max(0, Number(v)),
            })
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 disabled:bg-gray-50"
        />
        <p className="text-xs text-gray-500 mt-1">{totalFreeSlotsHelp}</p>
      </div>
    </div>
  )
}

export function pricingValuesFromProgram(program: {
  pricingSlotCostMonthlyCents?: number
  pricingFreeSlotsPerUser?: number
  pricingMaxFreeSlotsTotal?: number | null
}): PricingCostsValues {
  return {
    slotCostMonthlyCents: program.pricingSlotCostMonthlyCents ?? 0,
    freeSlotsPerUser: program.pricingFreeSlotsPerUser ?? 0,
    maxFreeSlotsTotal: program.pricingMaxFreeSlotsTotal ?? '',
  }
}

export function pricingValuesFromClass(classRow: {
  formSlotCostMonthlyCents?: number
  formFreeSlotsPerUser?: number
  formMaxFreeSlotsTotal?: number | null
  slotCostMonthlyCents?: number
  freeSlotsPerUser?: number
  maxFreeSlotsTotal?: number | null
  pricingOverridesProgram?: boolean
}): PricingCostsValues {
  if (classRow.pricingOverridesProgram) {
    return {
      slotCostMonthlyCents: classRow.formSlotCostMonthlyCents ?? 0,
      freeSlotsPerUser: classRow.formFreeSlotsPerUser ?? 0,
      maxFreeSlotsTotal: classRow.formMaxFreeSlotsTotal ?? '',
    }
  }
  return {
    slotCostMonthlyCents: classRow.slotCostMonthlyCents ?? 0,
    freeSlotsPerUser: classRow.freeSlotsPerUser ?? 0,
    maxFreeSlotsTotal: classRow.maxFreeSlotsTotal ?? '',
  }
}

export default PricingCostsFields
