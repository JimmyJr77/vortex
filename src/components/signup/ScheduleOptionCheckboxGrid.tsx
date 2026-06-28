import { Clock } from 'lucide-react'
import { slotOptionKey, type SignupScheduleOption } from './signupEnrollmentUtils'

export interface GroupedScheduleOptions {
  offeringLabel: string
  offeringDates: string | null
  options: SignupScheduleOption[]
}

/**
 * Group flat scheduleOptions by offering, preserving first-seen order. Shared by
 * the family signup picker, the signup wizard, and the member-portal enrollment UI.
 */
export function groupScheduleOptions(scheduleOptions: SignupScheduleOption[]): GroupedScheduleOptions[] {
  const groups = new Map<string, GroupedScheduleOptions>()
  for (const opt of scheduleOptions) {
    const key = opt.offeringId != null ? String(opt.offeringId) : '__general__'
    if (!groups.has(key)) {
      groups.set(key, {
        offeringLabel: opt.offeringLabel || 'Schedule options',
        offeringDates: opt.offeringDates,
        options: [],
      })
    }
    groups.get(key)!.options.push(opt)
  }
  return [...groups.values()]
}

/**
 * Presentational checkbox grid for selecting class day/date/time slots. Order is
 * offering dates -> offering label -> day/time checkboxes (one per slot group,
 * label fuses days and time). This is the standard parent-signup selection UI.
 */
export default function ScheduleOptionCheckboxGrid({
  groups,
  selectedSlotKeys,
  onToggle,
  disabledSlotKeys = [],
  disabledOfferingIds = [],
}: {
  groups: GroupedScheduleOptions[]
  selectedSlotKeys: string[]
  onToggle: (key: string, checked: boolean) => void
  disabledSlotKeys?: string[]
  disabledOfferingIds?: number[]
}) {
  const disabledSlotSet = new Set(disabledSlotKeys)
  const disabledOfferingSet = new Set(disabledOfferingIds)

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const offeringKey = group.options[0]?.offeringId ?? null
        const offeringDisabled =
          offeringKey != null && disabledOfferingSet.has(Number(offeringKey))
        return (
        <div
          key={`${group.offeringLabel}-${group.offeringDates ?? 'general'}`}
          className={`space-y-2 rounded-xl p-2 -mx-2 ${
            offeringDisabled ? 'bg-gray-100 opacity-70' : ''
          }`}
        >
          {group.offeringDates && (
            <p className={`text-sm ${offeringDisabled ? 'text-gray-500' : 'text-gray-600'}`}>
              {group.offeringDates}
            </p>
          )}
          {group.offeringLabel && group.offeringLabel !== 'Schedule options' && (
            <p className={`text-sm font-semibold ${offeringDisabled ? 'text-gray-500' : 'text-gray-800'}`}>
              {group.offeringLabel}
              {offeringDisabled && (
                <span className="ml-2 text-xs font-medium text-gray-500">(Already enrolled)</span>
              )}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {group.options.map((opt) => {
              const key = slotOptionKey(opt.slotGroupId, opt.timeSlotId)
              const checked = selectedSlotKeys.includes(key)
              const slotDisabled = offeringDisabled || disabledSlotSet.has(key)
              return (
                <label
                  key={key}
                  className={`flex items-start gap-3 rounded-xl border-2 p-3 transition-colors ${
                    slotDisabled
                      ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      : checked
                        ? 'border-vortex-red bg-red-50 cursor-pointer'
                        : 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 shrink-0"
                    checked={checked}
                    disabled={slotDisabled}
                    onChange={(e) => {
                      if (!slotDisabled) onToggle(key, e.target.checked)
                    }}
                  />
                  <span className="text-sm min-w-0">
                    <span className="flex items-center gap-1.5 font-medium text-gray-900">
                      <Clock className="w-3.5 h-3.5 text-vortex-red shrink-0" />
                      {opt.scheduleLabel}
                    </span>
                    {opt.priceLabel && (
                      <span className="block text-xs font-semibold text-vortex-red mt-1">
                        {opt.priceLabel}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
        )
      })}
    </div>
  )
}
