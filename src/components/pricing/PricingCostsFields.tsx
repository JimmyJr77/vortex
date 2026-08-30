import { COST_AMOUNT_LABELS, COST_UNIT_LABELS, type CostUnit } from '../../utils/schedulingApi'
import type { PricingCostsValues } from './pricingCosts'

interface Props {
  values: PricingCostsValues
  onChange: (values: PricingCostsValues) => void
  disabled?: boolean
  totalFreeSlotsLabel?: string
  totalFreeSlotsHelp?: string
}

const controlClass =
  'w-full h-10 rounded-lg border border-gray-300 px-4 text-sm disabled:bg-gray-50'

const PricingCostsFields = ({
  values,
  onChange,
  disabled = false,
  totalFreeSlotsLabel = 'Total free slots',
  totalFreeSlotsHelp = 'Leave empty for unlimited. Caps free slots granted across all members (first-come, first-served).',
}: Props) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">
            {COST_AMOUNT_LABELS[values.costUnit]}
          </label>
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
            className={controlClass}
          />
          {values.costUnit === 'per_hour' && (
            <p className="text-xs text-gray-500 mt-1">
              Billable hours are computed from each class&apos;s scheduled time slots (session length
              × weekly frequency).
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Cadence</label>
          <select
            disabled={disabled}
            value={values.costUnit}
            onChange={(e) => onChange({ ...values, costUnit: e.target.value as CostUnit })}
            className={controlClass}
          >
            {(Object.keys(COST_UNIT_LABELS) as CostUnit[]).map((u) => (
              <option key={u} value={u}>
                {COST_UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </div>
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
          className={controlClass}
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
          className={controlClass}
        />
        <p className="text-xs text-gray-500 mt-1">{totalFreeSlotsHelp}</p>
      </div>
    </div>
  )
}

export default PricingCostsFields
