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
}: {
  groups: GroupedScheduleOptions[]
  selectedSlotKeys: string[]
  onToggle: (key: string, checked: boolean) => void
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={`${group.offeringLabel}-${group.offeringDates ?? 'general'}`} className="space-y-2">
          {group.offeringDates && (
            <p className="text-sm text-gray-600">{group.offeringDates}</p>
          )}
          {group.offeringLabel && group.offeringLabel !== 'Schedule options' && (
            <p className="text-sm font-semibold text-gray-800">{group.offeringLabel}</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {group.options.map((opt) => {
              const key = slotOptionKey(opt.slotGroupId, opt.timeSlotId)
              const checked = selectedSlotKeys.includes(key)
              return (
                <label
                  key={key}
                  className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition-colors ${
                    checked
                      ? 'border-vortex-red bg-red-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 shrink-0"
                    checked={checked}
                    onChange={(e) => onToggle(key, e.target.checked)}
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
      ))}
    </div>
  )
}
