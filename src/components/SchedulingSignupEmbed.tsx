import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, CheckCircle, Clock, Loader2, Plus, Trash2, Users, X } from 'lucide-react'
import {
  getSignupFieldDef,
  isParentFieldLockedByWaiver,
  type SchedulingSignupFieldDef,
} from '../config/schedulingSignupFields'
import SchoolAutocompleteInput from './scheduling/SchoolAutocompleteInput'
import {
  changeSchedulingAuthPassword,
  checkSchedulingEmail,
  fetchMySchedulingSignups,
  fetchProgramSignupOptions,
  fetchPublicSchedulingForm,
  fetchPublicSchedulingOfferings,
  fetchSignupOrderPreview,
  formatSchedulingOccurrenceLabel,
  loginSchedulingAuth,
  memberSignupSlotKey,
  requestSchedulingMagicLink,
  schedulingHasMultipleWeeks,
  submitSchedulingSignupBatch,
  saveSchedulingMemberEmail,
  verifySchedulingAuthToken,
  type ProgramClassOption,
  type ProgramClassSlotOption,
  type SchedulingFormCategory,
  type SchedulingFormDetail,
  type SchedulingOffering,
  type SchedulingSignup,
  type SchedulingSignupCompleteDetail,
  type SignupOrderPreview,
  type SchedulingSlotGroup,
  type SchedulingTimeSlot,
} from '../utils/schedulingApi'

function formatTimeLabel(time: string) {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

type CategorySlotFilter = {
  offeringId?: number | null
  requireOfferingSelection?: boolean
}

function bookableGroupsForCategory(
  detail: SchedulingFormDetail,
  catId: number | null,
  filter?: CategorySlotFilter,
): SchedulingSlotGroup[] {
  return (detail.slotGroups ?? []).filter((group) => {
    if ((group.categoryId ?? null) !== catId) return false
    if (filter?.requireOfferingSelection && filter.offeringId === undefined) return false
    if (filter?.offeringId !== undefined) {
      return (group.offeringId ?? null) === filter.offeringId
    }
    return true
  })
}

type SlotPickOption = {
  key: string
  slotGroupId: number
  timeSlotId: number
  group: SchedulingSlotGroup
  occurrence: SchedulingSlotGroup['occurrences'][number]
}

function slotOptionsForCategory(
  detail: SchedulingFormDetail,
  catId: number | null,
  filter?: CategorySlotFilter,
): SlotPickOption[] {
  return bookableGroupsForCategory(detail, catId, filter).flatMap((group) =>
    group.occurrences.map((occurrence) => ({
      key: `${group.id}-${occurrence.id}`,
      slotGroupId: group.id,
      timeSlotId: occurrence.id,
      group,
      occurrence,
    })),
  )
}

function getBookableCategories(detail: SchedulingFormDetail): SchedulingFormCategory[] {
  return detail.categories.filter((cat) =>
    bookableGroupsForCategory(detail, cat.id ?? null).length > 0,
  )
}

function categoryBundleKey(formId: number, categoryId: number | null) {
  return `${formId}:${categoryId ?? 'none'}`
}

function slotSelectionKey(
  formId: number,
  categoryId: number | null,
  slotGroupId: number,
  timeSlotId: number,
) {
  return `${formId}:${categoryId ?? 'none'}:${slotGroupId}:${timeSlotId}`
}

function slotOptionFromOccurrence(
  group: SchedulingSlotGroup,
  occurrence: SchedulingTimeSlot,
  includeWeek: boolean,
  alreadySignedUp = false,
): ProgramClassSlotOption {
  return {
    slotGroupId: group.id,
    timeSlotId: occurrence.id,
    label: formatSchedulingOccurrenceLabel(occurrence, {
      includeWeek,
      formatTime: formatTimeLabel,
    }),
    isFull: group.isFull,
    spotsRemaining: group.spotsRemaining,
    waitlistCount: group.waitlistCount ?? 0,
    alreadySignedUp,
    scheduleMode: occurrence.scheduleMode,
    dayOfWeek: occurrence.dayOfWeek,
    dayName: occurrence.dayName,
    specificDate: occurrence.specificDate,
    startTime: occurrence.startTime,
    endTime: occurrence.endTime,
    weekLetter: occurrence.weekLetter,
  }
}

function bundlesFromFormDetail(
  detail: SchedulingFormDetail,
  signedUpSlotKeys: Set<string>,
): ProgramClassOption[] {
  const includeWeek = schedulingHasMultipleWeeks(detail.slotGroups ?? [])
  return getBookableCategories(detail).map((cat) => {
    const catId = cat.id ?? null
    const slots = slotOptionsForCategory(detail, catId).map((opt) => {
      const signedUp = signedUpSlotKeys.has(
        memberSignupSlotKey({
          formId: detail.id,
          categoryId: catId,
          slotGroupId: opt.slotGroupId,
          timeSlotId: opt.timeSlotId,
        }),
      )
      return slotOptionFromOccurrence(opt.group, opt.occurrence, includeWeek, signedUp)
    })
    return {
      key: categoryBundleKey(detail.id, catId),
      formId: detail.id,
      formTitle: detail.title,
      categoryId: catId,
      categoryName: cat.name,
      slots,
    }
  })
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function sameScheduleDay(a: ProgramClassSlotOption, b: ProgramClassSlotOption): boolean {
  if (a.scheduleMode === 'date' && b.scheduleMode === 'date') {
    return Boolean(a.specificDate && a.specificDate === b.specificDate)
  }
  if (a.scheduleMode === 'day' && b.scheduleMode === 'day') {
    return a.dayOfWeek != null && a.dayOfWeek === b.dayOfWeek
  }
  return false
}

function timeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const s1 = timeToMinutes(startA)
  const e1 = timeToMinutes(endA)
  const s2 = timeToMinutes(startB)
  const e2 = timeToMinutes(endB)
  return s1 < e2 && s2 < e1
}

function slotsConflict(a: ProgramClassSlotOption, b: ProgramClassSlotOption): boolean {
  if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false
  return sameScheduleDay(a, b) && timeRangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)
}

function mergeCategoryBundles(
  primary: ProgramClassOption[],
  extra: ProgramClassOption[],
): ProgramClassOption[] {
  const byKey = new Map<string, ProgramClassOption>()
  for (const bundle of primary) byKey.set(bundle.key, bundle)
  for (const bundle of extra) {
    const existing = byKey.get(bundle.key)
    if (!existing) {
      byKey.set(bundle.key, bundle)
      continue
    }
    const slotsByKey = new Map(
      existing.slots.map((slot) => [`${slot.slotGroupId}:${slot.timeSlotId}`, slot]),
    )
    for (const slot of bundle.slots) {
      const slotKey = `${slot.slotGroupId}:${slot.timeSlotId}`
      const prev = slotsByKey.get(slotKey)
      if (prev) {
        slotsByKey.set(slotKey, {
          ...prev,
          alreadySignedUp: Boolean(prev.alreadySignedUp || slot.alreadySignedUp),
        })
      } else {
        slotsByKey.set(slotKey, slot)
      }
    }
    byKey.set(bundle.key, { ...existing, slots: [...slotsByKey.values()] })
  }
  return [...byKey.values()]
}

function collectSignedUpSlotKeysFromOptions(options: ProgramClassOption[]): Set<string> {
  const keys = new Set<string>()
  for (const bundle of options) {
    for (const slot of bundle.slots) {
      if (!slot.alreadySignedUp) continue
      keys.add(
        memberSignupSlotKey({
          formId: bundle.formId,
          categoryId: bundle.categoryId,
          slotGroupId: slot.slotGroupId,
          timeSlotId: slot.timeSlotId,
        }),
      )
    }
  }
  return keys
}

function SignupFieldInput({
  field,
  value,
  onChange,
}: {
  field: SchedulingSignupFieldDef
  value: string | string[]
  onChange: (val: string | string[]) => void
}) {
  const id = `signup-${field.key}`

  if (field.type === 'email_list') {
    const emails = Array.isArray(value) ? value : value ? [String(value)] : ['']
    return (
      <div className="space-y-2">
        {emails.map((email, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="email"
              value={email}
              placeholder="friend@email.com"
              onChange={(e) => {
                const next = [...emails]
                next[idx] = e.target.value
                onChange(next)
              }}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-vortex-red"
            />
            {emails.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(emails.filter((_, i) => i !== idx))}
                className="text-red-600 p-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...emails, ''])}
          className="inline-flex items-center gap-1 text-sm text-vortex-red font-semibold"
        >
          <Plus className="w-4 h-4" /> Add email
        </button>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        id={id}
        rows={3}
        required={field.required}
        value={String(value || '')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-vortex-red focus:ring-2 focus:ring-vortex-red/20 outline-none"
      />
    )
  }

  if (field.key === 'current_school') {
    return (
      <SchoolAutocompleteInput
        id={id}
        required={field.required}
        value={String(value || '')}
        onChange={(val) => onChange(val)}
      />
    )
  }

  const inputType =
    field.type === 'number' ? 'number'
    : field.type === 'email' ? 'email'
    : field.type === 'phone' ? 'tel'
    : field.type === 'date' ? 'date'
    : 'text'

  return (
    <input
      id={id}
      type={inputType}
      required={field.required}
      value={String(value || '')}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-vortex-red focus:ring-2 focus:ring-vortex-red/20 outline-none"
    />
  )
}

type IdentityPhase = 'pending' | 'email' | 'login' | 'must_change_password' | 'ready'
type SignupPhase = 'select' | 'review'

type SignupCartItem = {
  key: string
  formId: number
  formTitle: string
  categoryId: number | null
  categoryName: string
  slotGroupId: number
  timeSlotId: number
  slotLabel: string
  isFull: boolean
}

type SelectedSlotMap = Record<string, SignupCartItem>

function signedUpSlotSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const key of a) {
    if (!b.has(key)) return false
  }
  return true
}

function isSlotEnrolled(
  bundle: ProgramClassOption,
  slot: ProgramClassSlotOption,
  signedUpSlotKeys: Set<string>,
): boolean {
  return (
    slot.alreadySignedUp ||
    signedUpSlotKeys.has(
      memberSignupSlotKey({
        formId: bundle.formId,
        categoryId: bundle.categoryId,
        slotGroupId: slot.slotGroupId,
        timeSlotId: slot.timeSlotId,
      }),
    )
  )
}

function slotConflictsWithSelectedItems(
  slot: ProgramClassSlotOption,
  bundle: ProgramClassOption,
  selectedItems: SignupCartItem[],
  categoryBundles: ProgramClassOption[],
): boolean {
  const thisKey = slotSelectionKey(
    bundle.formId,
    bundle.categoryId,
    slot.slotGroupId,
    slot.timeSlotId,
  )
  for (const item of selectedItems) {
    const selectedBundle = categoryBundles.find(
      (b) =>
        b.formId === item.formId && (b.categoryId ?? null) === (item.categoryId ?? null),
    )
    const selectedSlot = selectedBundle?.slots.find(
      (s) => s.slotGroupId === item.slotGroupId && s.timeSlotId === item.timeSlotId,
    )
    if (!selectedSlot) continue
    const otherKey = slotSelectionKey(
      item.formId,
      item.categoryId,
      item.slotGroupId,
      item.timeSlotId,
    )
    if (otherKey === thisKey) continue
    if (slotsConflict(slot, selectedSlot)) return true
  }
  return false
}

function slotConflictsWithEnrolledSlots(
  slot: ProgramClassSlotOption,
  bundle: ProgramClassOption,
  categoryBundles: ProgramClassOption[],
  signedUpSlotKeys: Set<string>,
): boolean {
  for (const catBundle of categoryBundles) {
    for (const enrolled of catBundle.slots) {
      const enrolledKey = slotSelectionKey(
        catBundle.formId,
        catBundle.categoryId,
        enrolled.slotGroupId,
        enrolled.timeSlotId,
      )
      if (
        !enrolled.alreadySignedUp &&
        !signedUpSlotKeys.has(
          memberSignupSlotKey({
            formId: catBundle.formId,
            categoryId: catBundle.categoryId,
            slotGroupId: enrolled.slotGroupId,
            timeSlotId: enrolled.timeSlotId,
          }),
        )
      ) {
        continue
      }
      const candidateKey = slotSelectionKey(
        bundle.formId,
        bundle.categoryId,
        slot.slotGroupId,
        slot.timeSlotId,
      )
      if (enrolledKey === candidateKey) continue
      if (slotsConflict(slot, enrolled)) return true
    }
  }
  return false
}

type CategorySlotToggleHandler = (
  bundle: ProgramClassOption,
  slot: ProgramClassSlotOption,
  checked: boolean,
) => void

const CategorySlotRow = memo(function CategorySlotRow({
  bundle,
  slot,
  isSelected,
  isAlreadySignedUp,
  hasConflict,
  onToggleSlot,
}: {
  bundle: ProgramClassOption
  slot: ProgramClassSlotOption
  isSelected: boolean
  isAlreadySignedUp: boolean
  hasConflict: boolean
  onToggleSlot: CategorySlotToggleHandler
}) {
  const slotKey = slotSelectionKey(
    bundle.formId,
    bundle.categoryId,
    slot.slotGroupId,
    slot.timeSlotId,
  )
  const isChecked = isAlreadySignedUp || isSelected
  const inputId = `slot-${slotKey}`

  return (
    <li>
      <label
        htmlFor={inputId}
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
          isAlreadySignedUp
            ? 'border-gray-200 bg-gray-100 opacity-70 cursor-not-allowed'
            : hasConflict
              ? 'border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed'
              : isChecked
                ? 'border-vortex-red bg-red-50/40 cursor-pointer'
                : 'border-gray-200 hover:border-gray-300 cursor-pointer'
        }`}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={isChecked}
          disabled={hasConflict || isAlreadySignedUp}
          onChange={(e) => onToggleSlot(bundle, slot, e.target.checked)}
          className="mt-0.5"
        />
        <span className="flex-1 min-w-0">
          <span className="font-semibold text-black block">{slot.label}</span>
          <span className="text-xs text-gray-600 mt-1 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 shrink-0" />
            {isAlreadySignedUp
              ? 'Already signed up'
              : slot.isFull
                ? `Full — join waitlist${slot.waitlistCount > 0 ? ` (${slot.waitlistCount} waiting)` : ''}`
                : `${slot.spotsRemaining} spots left`}
          </span>
        </span>
        {hasConflict && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold shrink-0">
            <Clock className="w-3 h-3" />
            Conflict
          </span>
        )}
      </label>
    </li>
  )
})

const CategorySlotList = memo(function CategorySlotList({
  bundle,
  selectedItems,
  categoryBundles,
  signedUpSlotKeys,
  onToggleSlot,
}: {
  bundle: ProgramClassOption
  selectedItems: SignupCartItem[]
  categoryBundles: ProgramClassOption[]
  signedUpSlotKeys: Set<string>
  onToggleSlot: CategorySlotToggleHandler
}) {
  return (
    <ul className="space-y-2">
      {bundle.slots.map((slot) => {
        const slotKey = slotSelectionKey(
          bundle.formId,
          bundle.categoryId,
          slot.slotGroupId,
          slot.timeSlotId,
        )
        const isAlreadySignedUp = isSlotEnrolled(bundle, slot, signedUpSlotKeys)
        const isSelected = selectedItems.some((item) => item.key === slotKey)
        const isChecked = isAlreadySignedUp || isSelected
        const hasConflict =
          !isChecked &&
          (slotConflictsWithSelectedItems(slot, bundle, selectedItems, categoryBundles) ||
            slotConflictsWithEnrolledSlots(slot, bundle, categoryBundles, signedUpSlotKeys))

        return (
          <CategorySlotRow
            key={slotKey}
            bundle={bundle}
            slot={slot}
            isSelected={isSelected}
            isAlreadySignedUp={isAlreadySignedUp}
            hasConflict={hasConflict}
            onToggleSlot={onToggleSlot}
          />
        )
      })}
    </ul>
  )
})

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`
}

function SignupOrderPricingSummary({
  preview,
  compact,
  variant = 'review',
  emphasizeCombinedTotal = false,
}: {
  preview: SignupOrderPreview
  compact?: boolean
  variant?: 'review' | 'success'
  emphasizeCombinedTotal?: boolean
}) {
  if (!preview.hasPricing) return null

  const pricingHeading =
    variant === 'success' ? 'Monthly pricing summary' : 'Estimated monthly pricing'

  return (
    <div className="mt-6 space-y-4">
      {emphasizeCombinedTotal && (
        <div className="rounded-xl border-2 border-black bg-white px-4 py-3 text-center sm:text-left">
          <p className="text-sm text-gray-600">Combined estimated total</p>
          <p className={`font-display font-bold text-black ${compact ? 'text-xl' : 'text-2xl'}`}>
            {formatMoney(preview.estimatedMonthlyTotal)}/mo
          </p>
        </div>
      )}
      {preview.existingClasses.length > 0 && (
        <div>
          <h5 className={`font-semibold text-black mb-2 ${compact ? 'text-sm' : 'text-base'}`}>
            Your current classes
          </h5>
          <ul className="space-y-2">
            {preview.existingClasses.map((item) => (
              <li
                key={item.id ?? `${item.formId}-${item.slotLabel}`}
                className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              >
                {item.formTitle && (
                  <p className="font-semibold text-black">{item.formTitle}</p>
                )}
                <p>
                  {item.categoryName}
                  {item.slotLabel ? ` — ${item.slotLabel}` : ''}
                </p>
                {item.status === 'waitlisted' && (
                  <p className="text-xs text-amber-700 mt-1">On waitlist</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.formSummaries.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-700">
          <h5 className={`font-semibold text-black mb-3 ${compact ? 'text-sm' : 'text-base'}`}>
            {pricingHeading}
          </h5>

          {preview.newSignups.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Classes in this signup ({preview.newSignups.length})
              </p>
              <ul className="space-y-2">
                {preview.newSignups.map((item) => (
                  <li
                    key={item.slotKey ?? `${item.formId}-${item.categoryName}-${item.slotLabel}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      {item.formTitle && (
                        <p className="font-semibold text-black">{item.formTitle}</p>
                      )}
                      <p>
                        {item.categoryName}
                        {item.slotLabel ? ` — ${item.slotLabel}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-right font-semibold text-black">
                      {item.incrementalMonthly != null && item.incrementalMonthly > 0
                        ? `+${formatMoney(item.incrementalMonthly)}/mo`
                        : 'Free'}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="space-y-3">
            {preview.formSummaries.map((summary) => (
              <li key={summary.formId}>
                <p className="font-semibold text-black">{summary.formTitle}</p>
                {summary.pricingAfter ? (
                  <ul className="mt-1 space-y-0.5">
                    <li>
                      Slots: {summary.existingSlotCount} current
                      {summary.newSlotCount > 0
                        ? ` + ${summary.newSlotCount} new = ${summary.totalSlotCount} total`
                        : ''}
                    </li>
                    {summary.pricingAfter.hasFreeSlots && (
                      <li>
                        Free classes remaining after signup:{' '}
                        {summary.pricingAfter.freeSlotsRemaining}
                      </li>
                    )}
                    <li>
                      Subtotal before discounts:{' '}
                      {formatMoney(summary.pricingAfter.nonDiscountedMonthly)}/mo
                    </li>
                    {summary.discountMonthly > 0 && (
                      <li className="text-green-700">
                        Free class discount: -{formatMoney(summary.discountMonthly)}/mo
                      </li>
                    )}
                    <li>
                      Total after discounts: {formatMoney(summary.pricingAfter.discountedMonthly)}/mo
                    </li>
                    {summary.incrementalMonthly > 0 && (
                      <li>
                        Added by this signup: +{formatMoney(summary.incrementalMonthly)}/mo
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="mt-1 text-gray-600">No pricing configured for this class.</p>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 pt-3 border-t border-gray-200 space-y-1">
            {preview.existingClasses.length > 0 && (
              <p>
                Current order total: {formatMoney(preview.existingMonthlyTotal)}/mo
              </p>
            )}
            {preview.newSignupMonthlyTotal > 0 && (
              <p>
                New signups add: +{formatMoney(preview.newSignupMonthlyTotal)}/mo
              </p>
            )}
            <p className="font-semibold text-black">
              Estimated total: {formatMoney(preview.estimatedMonthlyTotal)}/mo
            </p>
            {preview.totalDiscountMonthly > 0 && (
              <p className="text-green-700">
                Total discounts applied: -{formatMoney(preview.totalDiscountMonthly)}/mo
              </p>
            )}
          </div>
        </div>
      )}

      {preview.discounts?.enabled &&
        (preview.discounts.totalDiscountCents > 0 || preview.discounts.orderDiscounts.length > 0) && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm">
            <h5 className={`font-semibold text-green-900 mb-2 ${compact ? 'text-sm' : 'text-base'}`}>
              Discounts &amp; promos applied
            </h5>
            <ul className="space-y-1">
              {preview.discounts.lines.flatMap((line) =>
                line.applied.map((applied, i) => (
                  <li key={`${line.key}-${i}`} className="flex justify-between text-green-800">
                    <span>{applied.name}</span>
                    <span>-{formatMoney(applied.amountCents / 100)}</span>
                  </li>
                )),
              )}
              {preview.discounts.orderDiscounts.map((d, i) => (
                <li key={`order-${i}`} className="flex justify-between text-green-800">
                  <span>{d.name}</span>
                  <span>-{formatMoney(d.amountCents / 100)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 pt-2 border-t border-green-200 flex justify-between font-semibold text-green-900">
              <span>Estimated after discounts</span>
              <span>{formatMoney(preview.discounts.totalCents / 100)}/mo</span>
            </div>
          </div>
        )}

      <p className="text-xs text-gray-500 italic">{preview.disclaimer}</p>
    </div>
  )
}

interface Props {
  formId: number
  compact?: boolean
  fromEvent?: boolean
  initialAuthToken?: string | null
  initialEmail?: string | null
  initialCategoryId?: number | null
  onSignupComplete?: (detail: SchedulingSignupCompleteDetail) => void
}

const SchedulingSignupEmbed = ({
  formId,
  compact = false,
  fromEvent = false,
  initialAuthToken = null,
  initialEmail = null,
  initialCategoryId,
  onSignupComplete,
}: Props) => {
  const [formDetail, setFormDetail] = useState<SchedulingFormDetail | null>(null)
  const [categoryId, setCategoryId] = useState<number | null | undefined>(undefined)
  const [offeringId, setOfferingId] = useState<number | null | undefined>(undefined)
  const [categoryOfferings, setCategoryOfferings] = useState<SchedulingOffering[]>([])
  const [offeringsLoading, setOfferingsLoading] = useState(false)
  const [slotGroupId, setSlotGroupId] = useState<number | null>(null)
  const [timeSlotId, setTimeSlotId] = useState<number | null>(null)
  const [responses, setResponses] = useState<Record<string, string | string[]>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [signupPhase, setSignupPhase] = useState<SignupPhase>('select')
  const [cartItems, setCartItems] = useState<SignupCartItem[]>([])
  const [programOptions, setProgramOptions] = useState<ProgramClassOption[]>([])
  const [programOptionsLoading, setProgramOptionsLoading] = useState(false)
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlotMap>({})
  const [signedUpSlotKeys, setSignedUpSlotKeys] = useState<Set<string>>(new Set())
  const [signupResults, setSignupResults] = useState<SchedulingSignup[]>([])
  const [signupResult, setSignupResult] = useState<SchedulingSignup | null>(null)
  const [identityPhase, setIdentityPhase] = useState<IdentityPhase>('pending')
  const [accountEmail, setAccountEmail] = useState(initialEmail || '')
  const [accountPassword, setAccountPassword] = useState('')
  const [newAccountPassword, setNewAccountPassword] = useState('')
  const [forcedNewPassword, setForcedNewPassword] = useState('')
  const [forcedConfirmPassword, setForcedConfirmPassword] = useState('')
  const [signupAuthToken, setSignupAuthToken] = useState<string | null>(null)
  const [orderPreview, setOrderPreview] = useState<SignupOrderPreview | null>(null)
  const [orderPreviewLoading, setOrderPreviewLoading] = useState(false)
  const [confirmedOrderPreview, setConfirmedOrderPreview] = useState<SignupOrderPreview | null>(null)
  const [confirmedOrderPreviewLoading, setConfirmedOrderPreviewLoading] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [appliedPromoCodes, setAppliedPromoCodes] = useState<string[]>([])
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [identityLoading, setIdentityLoading] = useState(false)
  const prevCategoryIdRef = useRef<number | null | undefined>(undefined)
  const programOptionsFetchKeyRef = useRef<string | null>(null)
  const signedUpSlotsFetchRef = useRef<{ key: string; promise: Promise<void> } | null>(null)

  useEffect(() => {
    prevCategoryIdRef.current = undefined
    setLoading(true)
    setCategoryId(undefined)
    setOfferingId(undefined)
    setCategoryOfferings([])
    setSlotGroupId(null)
    setTimeSlotId(null)
    setResponses({})
    setSuccess(false)
    setSignupPhase('select')
    setCartItems([])
    setProgramOptions([])
    setSelectedSlots({})
    setSignedUpSlotKeys(new Set())
    programOptionsFetchKeyRef.current = null
    signedUpSlotsFetchRef.current = null
    setSignupResults([])
    setSignupResult(null)
    setError(null)
    setIdentityPhase('pending')
    setSignupAuthToken(null)
    setOrderPreview(null)
    setOrderPreviewLoading(false)
    setConfirmedOrderPreview(null)
    setConfirmedOrderPreviewLoading(false)
    setIsNewUser(false)
    setAccountEmail(initialEmail || '')
    setAccountPassword('')
    setNewAccountPassword('')
    setMagicLinkSent(false)
    fetchPublicSchedulingForm(formId, undefined, { fromEvent })
      .then((detail) => {
        setFormDetail(detail)
        const bookable = getBookableCategories(detail)
        if (initialCategoryId !== undefined) {
          const match = bookable.find((c) => (c.id ?? null) === initialCategoryId)
          if (match) {
            setCategoryId(match.id ?? null)
          }
        } else if (bookable.length === 1) {
          setCategoryId(bookable[0].id ?? null)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load form'))
      .finally(() => setLoading(false))
  }, [formId, fromEvent, initialCategoryId])

  useEffect(() => {
    if (categoryId === undefined) {
      setCategoryOfferings([])
      setOfferingId(undefined)
      return
    }

    setOfferingsLoading(true)
    fetchPublicSchedulingOfferings(formId, categoryId)
      .then((offerings) => {
        setCategoryOfferings(offerings)
        if (offerings.length === 1) {
          setOfferingId(offerings[0].id)
        } else {
          setOfferingId(offerings.length > 0 ? undefined : null)
        }
      })
      .catch(() => {
        setCategoryOfferings([])
        setOfferingId(null)
      })
      .finally(() => setOfferingsLoading(false))
  }, [formId, categoryId])

  useEffect(() => {
    const email =
      accountEmail.trim() ||
      (typeof responses.email === 'string' ? responses.email.trim() : '') ||
      initialEmail?.trim() ||
      ''
    onSignupComplete?.({
      completed: success,
      formId: success ? formId : undefined,
      formIds: success ? signupResults.map((r) => r.formId) : undefined,
      email: success && email ? email : undefined,
    })
  }, [success, formId, accountEmail, responses.email, initialEmail, onSignupComplete, signupResults])

  useEffect(() => {
    if (!initialAuthToken || !initialEmail) return
    setIdentityLoading(true)
    verifySchedulingAuthToken(formId, initialEmail, initialAuthToken)
      .then((session) => {
        setSignupAuthToken(session.signupAuthToken)
        setAccountEmail(session.email)
        saveSchedulingMemberEmail(session.email)
        setIdentityPhase('ready')
        setIsNewUser(false)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Invalid sign-in link'))
      .finally(() => setIdentityLoading(false))
  }, [formId, initialAuthToken, initialEmail])

  const loadSignedUpSlots = useCallback(async (email: string, options?: { force?: boolean }) => {
    const key = email.trim().toLowerCase()
    if (!key) return

    if (!options?.force && signedUpSlotsFetchRef.current?.key === key) {
      return signedUpSlotsFetchRef.current.promise
    }

    const promise = (async () => {
      try {
        const signups = await fetchMySchedulingSignups(key)
        const next = new Set(signups.map((s) => memberSignupSlotKey(s)))
        setSignedUpSlotKeys((prev) => (signedUpSlotSetsEqual(prev, next) ? prev : next))
      } catch {
        setSignedUpSlotKeys((prev) => (prev.size === 0 ? prev : new Set()))
      } finally {
        if (signedUpSlotsFetchRef.current?.key === key) {
          signedUpSlotsFetchRef.current = null
        }
      }
    })()

    signedUpSlotsFetchRef.current = { key, promise }
    return promise
  }, [])

  useEffect(() => {
    if (identityPhase !== 'ready') return
    const email = accountEmail.trim() || initialEmail?.trim() || ''
    if (!email) return
    void loadSignedUpSlots(email)
  }, [accountEmail, initialEmail, identityPhase, loadSignedUpSlots])

  useEffect(() => {
    if (success) return
    if (signupPhase !== 'review' || cartItems.length === 0) {
      setOrderPreview(null)
      setOrderPreviewLoading(false)
      return
    }

    const email =
      accountEmail.trim() ||
      (typeof responses.email === 'string' ? responses.email.trim() : '') ||
      initialEmail?.trim() ||
      ''
    if (!signupAuthToken && !email) return

    let cancelled = false
    setOrderPreviewLoading(true)

    fetchSignupOrderPreview({
      formId,
      email: signupAuthToken ? undefined : email,
      signupAuthToken: signupAuthToken || undefined,
      signups: cartItems.map((item) => ({
        formId: item.formId,
        categoryId: item.categoryId,
        slotGroupId: item.slotGroupId,
        timeSlotId: item.timeSlotId,
      })),
      promoCodes: appliedPromoCodes,
      currentSchool: typeof responses.current_school === 'string' ? responses.current_school : null,
    })
      .then((preview) => {
        if (!cancelled) setOrderPreview(preview)
      })
      .catch(() => {
        if (!cancelled) setOrderPreview(null)
      })
      .finally(() => {
        if (!cancelled) setOrderPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    success,
    signupPhase,
    cartItems,
    accountEmail,
    responses.email,
    responses.current_school,
    initialEmail,
    signupAuthToken,
    formId,
    appliedPromoCodes,
  ])

  const loadConfirmedOrderPreview = useCallback(async () => {
    const email =
      accountEmail.trim() ||
      (typeof responses.email === 'string' ? responses.email.trim() : '') ||
      initialEmail?.trim() ||
      ''
    if (!signupAuthToken && !email) return null

    setConfirmedOrderPreviewLoading(true)
    try {
      const preview = await fetchSignupOrderPreview({
        formId,
        email: signupAuthToken ? undefined : email,
        signupAuthToken: signupAuthToken || undefined,
        signups: [],
      })
      setConfirmedOrderPreview(preview)
      return preview
    } catch {
      setConfirmedOrderPreview(null)
      return null
    } finally {
      setConfirmedOrderPreviewLoading(false)
    }
  }, [accountEmail, responses.email, initialEmail, signupAuthToken, formId])

  const isSlotAlreadySignedUp = useCallback(
    (
      targetFormId: number,
      targetCategoryId: number | null,
      targetSlotGroupId: number,
      targetTimeSlotId: number,
    ) =>
      signedUpSlotKeys.has(
        memberSignupSlotKey({
          formId: targetFormId,
          categoryId: targetCategoryId,
          slotGroupId: targetSlotGroupId,
          timeSlotId: targetTimeSlotId,
        }),
      ),
    [signedUpSlotKeys],
  )

  const bookableCategories = useMemo(
    () => (formDetail ? getBookableCategories(formDetail) : []),
    [formDetail],
  )

  const requiresOfferingSelection = categoryOfferings.length > 0

  const slotFilter = useMemo((): CategorySlotFilter | undefined => {
    if (categoryId === undefined) return undefined
    if (requiresOfferingSelection) {
      return {
        requireOfferingSelection: offeringId === undefined,
        offeringId: offeringId ?? null,
      }
    }
    return undefined
  }, [categoryId, requiresOfferingSelection, offeringId])

  const bookableGroups: SchedulingSlotGroup[] = useMemo(() => {
    if (!formDetail || categoryId === undefined) return []
    return bookableGroupsForCategory(formDetail, categoryId, slotFilter)
  }, [formDetail, categoryId, slotFilter])

  const slotOptions = useMemo(() => {
    if (!formDetail || categoryId === undefined) return []
    return slotOptionsForCategory(formDetail, categoryId, slotFilter)
  }, [formDetail, categoryId, slotFilter])

  useEffect(() => {
    if (categoryId === undefined || !formDetail || offeringsLoading) return
    if (requiresOfferingSelection && offeringId === undefined) return

    const categoryChanged = prevCategoryIdRef.current !== categoryId
    prevCategoryIdRef.current = categoryId

    if (categoryChanged) {
      setSlotGroupId(null)
      setTimeSlotId(null)
    }
  }, [
    categoryId,
    formDetail,
    offeringsLoading,
    requiresOfferingSelection,
    offeringId,
  ])

  const showWeekInLabels = useMemo(
    () => schedulingHasMultipleWeeks(bookableGroups),
    [bookableGroups],
  )

  const mandateWaiver = formDetail?.mandateWaiver ?? false

  const enabledFields = useMemo(() => {
    if (!formDetail) return []
    return formDetail.signupFields
      .map((key) => {
        const def = getSignupFieldDef(key)
        if (!def) return null
        if (isParentFieldLockedByWaiver(key, mandateWaiver)) {
          return { ...def, required: true }
        }
        return def
      })
      .filter((f): f is SchedulingSignupFieldDef => Boolean(f))
  }, [formDetail, mandateWaiver])

  const handleCategorySelect = (catId: number | null) => {
    setSlotGroupId(null)
    setTimeSlotId(null)
    setOfferingId(undefined)
    setCategoryId(catId)
    if (!signupAuthToken) {
      setIdentityPhase('pending')
      setIsNewUser(false)
      setMagicLinkSent(false)
    }
  }

  const handleOfferingSelect = (nextOfferingId: number) => {
    setSlotGroupId(null)
    setTimeSlotId(null)
    setOfferingId(nextOfferingId)
    if (!signupAuthToken) {
      setIdentityPhase('pending')
      setIsNewUser(false)
      setMagicLinkSent(false)
    }
  }

  const handleSlotSelect = (option: SlotPickOption) => {
    if (
      formDetail &&
      isSlotAlreadySignedUp(
        formDetail.id,
        categoryId ?? null,
        option.slotGroupId,
        option.timeSlotId,
      )
    ) {
      return
    }
    setSlotGroupId(option.slotGroupId)
    setTimeSlotId(option.timeSlotId)
    if (formDetail) {
      const slotKey = slotSelectionKey(
        formDetail.id,
        categoryId ?? null,
        option.slotGroupId,
        option.timeSlotId,
      )
      const categoryName =
        formDetail.categories.find((c) => (c.id ?? null) === (categoryId ?? null))?.name ??
        'No Category'
      setSelectedSlots((prev) => ({
        ...prev,
        [slotKey]: {
          key: slotKey,
          formId: formDetail.id,
          formTitle: formDetail.title,
          categoryId: categoryId ?? null,
          categoryName,
          slotGroupId: option.slotGroupId,
          timeSlotId: option.timeSlotId,
          slotLabel: formatSchedulingOccurrenceLabel(option.occurrence, {
            includeWeek: schedulingHasMultipleWeeks(bookableGroupsForCategory(formDetail, categoryId ?? null)),
            formatTime: formatTimeLabel,
          }),
          isFull: option.group.isFull,
        },
      }))
    }
    if (!signupAuthToken && identityPhase !== 'ready') {
      setIdentityPhase('email')
      setIsNewUser(false)
      setMagicLinkSent(false)
    }
  }

  useEffect(() => {
    if (slotGroupId == null || timeSlotId == null || signupAuthToken || identityPhase === 'ready' || identityPhase === 'login') {
      return
    }
    if (identityPhase === 'pending') {
      setIdentityPhase('email')
    }
  }, [slotGroupId, timeSlotId, signupAuthToken, identityPhase])

  const handleEmailContinue = async () => {
    const email = accountEmail.trim()
    if (!email) {
      setError('Enter your email address')
      return
    }
    setIdentityLoading(true)
    setError(null)
    setMagicLinkSent(false)
    try {
      const check = await checkSchedulingEmail(formId, email)
      saveSchedulingMemberEmail(email)
      if (check.exists) {
        setIsNewUser(false)
        setIdentityPhase('login')
        if (!check.hasPassword) {
          await requestSchedulingMagicLink(formId, email)
          setMagicLinkSent(true)
        }
      } else {
        setIsNewUser(true)
        setIdentityPhase('ready')
        setResponses((prev) => ({ ...prev, email }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check email')
    } finally {
      setIdentityLoading(false)
    }
  }

  const handleLogin = async () => {
    setIdentityLoading(true)
    setError(null)
    try {
      const session = await loginSchedulingAuth(formId, accountEmail.trim(), accountPassword)
      saveSchedulingMemberEmail(accountEmail.trim())
      setSignupAuthToken(session.signupAuthToken)
      setIsNewUser(false)
      if (session.mustChangePassword) {
        setForcedNewPassword('')
        setForcedConfirmPassword('')
        setIdentityPhase('must_change_password')
      } else {
        setIdentityPhase('ready')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setIdentityLoading(false)
    }
  }

  const handleForcedPasswordChange = async () => {
    if (!signupAuthToken) return
    if (forcedNewPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (forcedNewPassword !== forcedConfirmPassword) {
      setError('Passwords do not match')
      return
    }
    setIdentityLoading(true)
    setError(null)
    try {
      const session = await changeSchedulingAuthPassword(
        formId,
        signupAuthToken,
        forcedNewPassword,
      )
      setSignupAuthToken(session.signupAuthToken)
      setForcedNewPassword('')
      setForcedConfirmPassword('')
      setIdentityPhase('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setIdentityLoading(false)
    }
  }

  const handleMagicLink = async () => {
    setIdentityLoading(true)
    setError(null)
    try {
      await requestSchedulingMagicLink(formId, accountEmail.trim())
      setMagicLinkSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send link')
    } finally {
      setIdentityLoading(false)
    }
  }

  useEffect(() => {
    if (!formDetail || identityPhase !== 'ready') return

    const email = accountEmail.trim() || initialEmail?.trim() || ''
    if (!email) return

    const fetchKey = `${formId}:${email.toLowerCase()}`
    if (programOptionsFetchKeyRef.current === fetchKey) return
    programOptionsFetchKeyRef.current = fetchKey

    setProgramOptionsLoading(true)
    fetchProgramSignupOptions(formId, { email })
      .then((data) => {
        setProgramOptions(data.options)
        const fromApi = collectSignedUpSlotKeysFromOptions(data.options)
        if (fromApi.size > 0) {
          setSignedUpSlotKeys((prev) => new Set([...prev, ...fromApi]))
        }
      })
      .catch(() => setProgramOptions([]))
      .finally(() => setProgramOptionsLoading(false))
  }, [formDetail, formId, identityPhase, accountEmail, initialEmail])

  const categoryBundles = useMemo(() => {
    if (!formDetail) return []
    const localBundles = bundlesFromFormDetail(formDetail, signedUpSlotKeys)
    return mergeCategoryBundles(localBundles, programOptions)
  }, [formDetail, programOptions, signedUpSlotKeys])

  const currentCategoryKey = useMemo(() => {
    if (!formDetail || categoryId === undefined) return null
    return categoryBundleKey(formDetail.id, categoryId)
  }, [formDetail, categoryId])

  const currentCategoryBundle = useMemo(
    () => categoryBundles.find((b) => b.key === currentCategoryKey) ?? null,
    [categoryBundles, currentCategoryKey],
  )

  const otherCategoryBundles = useMemo(() => {
    if (!currentCategoryKey) return categoryBundles
    return categoryBundles.filter((b) => b.key !== currentCategoryKey)
  }, [categoryBundles, currentCategoryKey])

  const selectedSlotList = useMemo(() => Object.values(selectedSlots), [selectedSlots])

  const pendingSlotList = useMemo(
    () =>
      selectedSlotList.filter(
        (item) =>
          !isSlotAlreadySignedUp(
            item.formId,
            item.categoryId,
            item.slotGroupId,
            item.timeSlotId,
          ),
      ),
    [selectedSlotList, isSlotAlreadySignedUp],
  )

  const countEnrolledOnForm = useCallback(
    (targetFormId: number) => {
      let count = 0
      for (const key of signedUpSlotKeys) {
        if (key.startsWith(`${targetFormId}:`)) count += 1
      }
      return count
    },
    [signedUpSlotKeys],
  )

  const remainingSlotsForForm = useCallback(
    (targetFormId: number) => {
      const max = formDetail?.maxSlotsPerUser
      if (max == null) return Number.POSITIVE_INFINITY
      const enrolled = countEnrolledOnForm(targetFormId)
      const pending = pendingSlotList.filter((item) => item.formId === targetFormId).length
      return Math.max(0, max - enrolled - pending)
    },
    [formDetail?.maxSlotsPerUser, countEnrolledOnForm, pendingSlotList],
  )

  const sectionClass = compact
    ? 'bg-white rounded-xl border border-gray-200 p-4 shadow-sm'
    : 'bg-white rounded-2xl border border-gray-200 p-6 shadow-sm'

  const slotSelected = categoryId !== undefined && slotGroupId !== null && timeSlotId !== null
  const identityReady = identityPhase === 'ready'
  const showCategoryPick = categoryId === undefined && bookableCategories.length > 0
  const showOfferingPick =
    categoryId !== undefined &&
    offeringId === undefined &&
    requiresOfferingSelection &&
    !offeringsLoading
  const showSlotPick =
    categoryId !== undefined &&
    !showOfferingPick &&
    !offeringsLoading &&
    timeSlotId === null &&
    slotOptions.length > 0
  const showEmailStep = slotSelected && identityPhase === 'email'
  const showLoginStep = slotSelected && identityPhase === 'login'
  const showMustChangePasswordStep = slotSelected && identityPhase === 'must_change_password'
  const showNewUserForm = slotSelected && identityReady && isNewUser && signupPhase === 'select'
  const showSubmit = slotSelected && identityReady && signupPhase === 'select'
  const showReview = signupPhase === 'review'
  const showAddMoreClasses =
    showSubmit &&
    (categoryBundles.length > 1 || categoryBundles.some((b) => b.slots.length > 1))

  const selectedCategoryName = useMemo(() => {
    if (categoryId === undefined || !formDetail) return null
    return formDetail.categories.find((c) => (c.id ?? null) === categoryId)?.name ?? null
  }, [categoryId, formDetail])

  const selectedOfferingLabel = useMemo(() => {
    if (offeringId == null) return null
    const offering = categoryOfferings.find((item) => item.id === offeringId)
    if (!offering) return null
    return (
      offering.label?.trim() ||
      (offering.startDate && offering.endDate
        ? `${offering.startDate} – ${offering.endDate}`
        : offering.startDate || offering.endDate || 'Offering')
    )
  }, [categoryOfferings, offeringId])

  const selectedGroup = useMemo(
    () => bookableGroups.find((g) => g.id === slotGroupId) ?? null,
    [bookableGroups, slotGroupId],
  )

  const selectedOccurrence = useMemo(
    () => slotOptions.find((o) => o.timeSlotId === timeSlotId)?.occurrence ?? null,
    [slotOptions, timeSlotId],
  )

  const toggleCategorySlot = useCallback(
    (bundle: ProgramClassOption, slot: ProgramClassSlotOption, checked: boolean) => {
      if (isSlotEnrolled(bundle, slot, signedUpSlotKeys)) return

      const slotKey = slotSelectionKey(
        bundle.formId,
        bundle.categoryId,
        slot.slotGroupId,
        slot.timeSlotId,
      )

      if (checked) {
        if (
          slotConflictsWithSelectedItems(slot, bundle, selectedSlotList, categoryBundles) ||
          slotConflictsWithEnrolledSlots(slot, bundle, categoryBundles, signedUpSlotKeys)
        ) {
          return
        }
        if (remainingSlotsForForm(bundle.formId) <= 0) {
          const max = formDetail?.maxSlotsPerUser
          setError(
            max != null
              ? `You can only sign up for ${max} slot${max === 1 ? '' : 's'} in this class`
              : 'No more slots available for this class',
          )
          return
        }
        setError(null)
        const item: SignupCartItem = {
          key: slotKey,
          formId: bundle.formId,
          formTitle: bundle.formTitle,
          categoryId: bundle.categoryId,
          categoryName: bundle.categoryName,
          slotGroupId: slot.slotGroupId,
          timeSlotId: slot.timeSlotId,
          slotLabel: slot.label,
          isFull: slot.isFull,
        }
        setSelectedSlots((prev) => ({ ...prev, [slotKey]: item }))
        return
      }

      setSelectedSlots((prev) => {
        const pendingAfterRemove = Object.values(prev).filter((item) => {
          if (item.key === slotKey) return false
          return !signedUpSlotKeys.has(
            memberSignupSlotKey({
              formId: item.formId,
              categoryId: item.categoryId,
              slotGroupId: item.slotGroupId,
              timeSlotId: item.timeSlotId,
            }),
          )
        })
        if (pendingAfterRemove.length < 1) {
          setError('Select at least one new class time to sign up')
          return prev
        }
        setError(null)
        const next = { ...prev }
        delete next[slotKey]
        return next
      })
    },
    [
      signedUpSlotKeys,
      selectedSlotList,
      categoryBundles,
      remainingSlotsForForm,
      formDetail?.maxSlotsPerUser,
    ],
  )

  const handleGoToReview = () => {
    if (!formDetail || categoryId === undefined || !slotGroupId || !timeSlotId) return
    if (identityPhase !== 'ready') return
    if (pendingSlotList.length < 1) {
      setError('Select at least one new class time to sign up')
      return
    }
    if (isNewUser) {
      if (!newAccountPassword || newAccountPassword.length < 6) {
        setError('Account password must be at least 6 characters')
        return
      }
      for (const field of enabledFields) {
        if (!field.required) continue
        const raw = responses[field.key]
        const empty =
          field.type === 'email_list'
            ? !(Array.isArray(raw) ? raw : []).some((s) => String(s).trim())
            : raw == null || String(raw).trim() === ''
        if (empty) {
          setError(`${field.label} is required`)
          return
        }
      }
    }
    setError(null)
    setCartItems([...pendingSlotList])
    setSignupPhase('review')
  }

  const handleFinalSubmit = async () => {
    if (!formDetail || cartItems.length === 0 || identityPhase !== 'ready') return
    setSubmitting(true)
    setError(null)
    try {
      const payload: Record<string, string | boolean | number | string[]> = {}
      if (isNewUser) {
        for (const field of enabledFields) {
          const raw = responses[field.key]
          if (field.type === 'email_list') {
            const list = (Array.isArray(raw) ? raw : []).map((s) => s.trim()).filter(Boolean)
            if (list.length > 0) payload[field.key] = list
          } else if (raw != null && String(raw).trim() !== '') {
            payload[field.key] = field.type === 'number' ? Number(raw) : String(raw).trim()
          }
        }
      }
      const result = await submitSchedulingSignupBatch({
        signups: cartItems
          .filter(
            (item) =>
              !isSlotAlreadySignedUp(
                item.formId,
                item.categoryId,
                item.slotGroupId,
                item.timeSlotId,
              ),
          )
          .map((item) => ({
          formId: item.formId,
          categoryId: item.categoryId,
          slotGroupId: item.slotGroupId,
          timeSlotId: item.timeSlotId,
        })),
        responses: isNewUser ? payload : { email: accountEmail.trim() },
        signupAuthToken: signupAuthToken || undefined,
        password: isNewUser ? newAccountPassword : undefined,
        promoCodes: appliedPromoCodes,
      })
      setSignupResults(result.signups)
      setSignupResult(result.signups[0] ?? null)
      setSuccess(true)
      void loadConfirmedOrderPreview()
      const email = accountEmail.trim() || initialEmail?.trim() || ''
      if (email) void loadSignedUpSlots(email, { force: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (signupPhase === 'select') {
      handleGoToReview()
    } else {
      void handleFinalSubmit()
    }
  }

  if (loading && !formDetail) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-vortex-red" />
      </div>
    )
  }

  if (success) {
    const multiple = signupResults.length > 1
    const isWaitlisted = signupResults.some((r) => r.status === 'waitlisted')
    const positionText =
      !multiple && signupResult?.status === 'waitlisted' && signupResult?.waitlistPosition != null
        ? `You are #${signupResult.waitlistPosition} on the waitlist`
        : !multiple &&
            signupResult?.signupNumber != null &&
            signupResult?.maxParticipants != null
          ? `You are number ${signupResult.signupNumber} of ${signupResult.maxParticipants}`
          : null

    return (
      <div className={`${sectionClass} text-center`}>
        <CheckCircle className={`w-12 h-12 mx-auto mb-4 ${isWaitlisted ? 'text-amber-600' : 'text-green-600'}`} />
        <h4 className="text-xl font-display font-bold text-black mb-2">
          {multiple
            ? `You're signed up for ${signupResults.length} classes!`
            : isWaitlisted
              ? "You're on the waitlist!"
              : "You're signed up!"}
        </h4>
        {positionText && (
          <p className="text-lg font-semibold text-black mb-2">{positionText}</p>
        )}
        {multiple && (
          <ul className="mt-4 text-left space-y-2 text-sm text-gray-700">
            {signupResults.map((result) => (
              <li
                key={result.id}
                className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <p className="font-semibold text-black">
                  {result.formTitle || formDetail?.title}
                </p>
                {result.categoryName && result.slotLabel && (
                  <p className="text-gray-600">
                    {result.categoryName} — {result.slotLabel}
                  </p>
                )}
                <p className="text-xs mt-1 text-gray-500">
                  {result.status === 'waitlisted' ? 'Waitlisted' : 'Confirmed'}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-gray-600 text-sm mt-4">
          {isWaitlisted
            ? "We'll email you if a spot opens up. Check your inbox for details."
            : 'Check your email for confirmation with your event details.'}
        </p>
        {mandateWaiver && (
          <p className="text-gray-600 text-sm mt-2">
            Your parent or guardian will receive a separate waiver email.
          </p>
        )}
        {(orderPreviewLoading || confirmedOrderPreviewLoading) && !orderPreview && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your pricing summary…
          </div>
        )}
        {orderPreview && (
          <div className="mt-4 text-left">
            <SignupOrderPricingSummary
              preview={
                confirmedOrderPreview?.hasPricing
                  ? {
                      ...orderPreview,
                      existingClasses: confirmedOrderPreview.existingClasses,
                      formSummaries: confirmedOrderPreview.formSummaries,
                      existingMonthlyTotal: confirmedOrderPreview.existingMonthlyTotal,
                      estimatedMonthlyTotal: confirmedOrderPreview.estimatedMonthlyTotal,
                      totalDiscountMonthly: confirmedOrderPreview.totalDiscountMonthly,
                    }
                  : orderPreview
              }
              compact={compact}
              variant="success"
              emphasizeCombinedTotal={multiple}
            />
          </div>
        )}
      </div>
    )
  }

  if (!formDetail) {
    return (
      <div className={`${sectionClass} text-sm text-gray-600`}>
        {error || 'This signup form is not available.'}
      </div>
    )
  }

  if (bookableCategories.length === 0) {
    return (
      <div className={`${sectionClass} text-sm text-gray-600`}>
        No signup slots available right now.
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-8'}>
      {!compact && (
        <div className={sectionClass}>
          <h3 className="text-2xl font-display font-bold text-black mb-2">{formDetail.title}</h3>
          {formDetail.description && (
            <p className="text-gray-600 text-sm mb-3">{formDetail.description}</p>
          )}
          {(formDetail.startDate || formDetail.endDate) && (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {formDetail.startDate && `Opens ${formDetail.startDate}`}
              {formDetail.startDate && formDetail.endDate && ' · '}
              {formDetail.endDate && `Closes ${formDetail.endDate}`}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className={compact ? 'space-y-4' : 'space-y-8'}>
        {showReview ? (
          <div className={sectionClass}>
            <h4 className={`font-bold text-black mb-2 ${compact ? 'text-base' : 'text-xl'}`}>
              Review your signups
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Confirm the classes below, or remove any you do not want before submitting.
            </p>
            {cartItems.length === 0 ? (
              <p className="text-sm text-gray-600">No classes selected.</p>
            ) : (
              <ul className="space-y-3">
                {cartItems.map((item) => {
                  const itemSlotKey = memberSignupSlotKey(item)
                  const previewItem = orderPreview?.newSignups.find(
                    (entry) => entry.slotKey === itemSlotKey,
                  )
                  return (
                  <li
                    key={item.key}
                    className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3"
                  >
                    <div className="text-sm text-gray-700 min-w-0">
                      {item.formTitle !== formDetail.title && (
                        <p className="font-semibold text-black">{item.formTitle}</p>
                      )}
                      <p>
                        <span className="font-semibold text-black">{item.categoryName}</span>
                        {' — '}
                        {item.slotLabel}
                      </p>
                      {item.isFull && (
                        <p className="text-xs text-amber-700 mt-1">Will join waitlist if full</p>
                      )}
                      {previewItem &&
                        orderPreview?.hasPricing &&
                        previewItem.incrementalMonthly != null &&
                        previewItem.incrementalMonthly > 0 && (
                          <p className="text-xs text-gray-600 mt-1">
                            Est. +{formatMoney(previewItem.incrementalMonthly)}/mo
                          </p>
                        )}
                      {previewItem &&
                        orderPreview?.hasPricing &&
                        previewItem.incrementalMonthly === 0 && (
                          <p className="text-xs text-green-700 mt-1">Included at no extra cost</p>
                        )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCartItems((prev) => prev.filter((entry) => entry.key !== item.key))
                        setSelectedSlots((prev) => {
                          const next = { ...prev }
                          delete next[item.key]
                          return next
                        })
                      }}
                      className="shrink-0 text-red-600 hover:text-red-800 p-1"
                      aria-label={`Remove ${item.categoryName}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-5">
              <label className="block text-sm font-semibold text-black mb-1">Promo code</label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  className="flex-1 min-w-[8rem] rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase"
                />
                <button
                  type="button"
                  onClick={() => {
                    const code = promoInput.trim()
                    if (code && !appliedPromoCodes.includes(code)) {
                      setAppliedPromoCodes((prev) => [...prev, code])
                    }
                    setPromoInput('')
                  }}
                  className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  Apply
                </button>
              </div>
              {appliedPromoCodes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {appliedPromoCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                    >
                      {code}
                      <button
                        type="button"
                        onClick={() => setAppliedPromoCodes((prev) => prev.filter((c) => c !== code))}
                        className="text-gray-400 hover:text-red-600"
                        aria-label={`Remove ${code}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {orderPreviewLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading your order and pricing…
              </div>
            )}
            {orderPreview && !orderPreviewLoading && (
              <SignupOrderPricingSummary preview={orderPreview} compact={compact} />
            )}

            <div className="flex flex-wrap gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  setSelectedSlots(Object.fromEntries(cartItems.map((item) => [item.key, item])))
                  setSignupPhase('select')
                }}
                className="text-sm text-gray-600 font-semibold hover:underline"
              >
                Back to add or change classes
              </button>
            </div>
          </div>
        ) : (
          <>
        {showCategoryPick && (
          <div className={sectionClass}>
            <h4 className={`font-bold text-black mb-3 ${compact ? 'text-base' : 'text-xl'}`}>
              Category
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bookableCategories.map((cat) => (
                <button
                  key={cat.id ?? 'none'}
                  type="button"
                  onClick={() => handleCategorySelect(cat.id ?? null)}
                  className="text-left rounded-xl border-2 p-3 border-gray-200 hover:border-vortex-red transition-all"
                >
                  <span className="font-bold text-black block text-sm">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {offeringsLoading && categoryId !== undefined && (
          <div className={`${sectionClass} flex items-center gap-2 text-sm text-gray-500`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading offerings…
          </div>
        )}

        {showOfferingPick && (
          <div className={sectionClass}>
            {selectedCategoryName && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 mb-3">
                <span>
                  Category: <span className="font-semibold text-black">{selectedCategoryName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryId(undefined)
                    setOfferingId(undefined)
                    setSlotGroupId(null)
                    setTimeSlotId(null)
                    setIdentityPhase('pending')
                  }}
                  className="text-vortex-red font-semibold hover:underline"
                >
                  Change category
                </button>
              </div>
            )}
            <h4 className={`font-bold text-black mb-3 ${compact ? 'text-base' : 'text-xl'}`}>
              Offering
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categoryOfferings.map((offering) => {
                const label =
                  offering.label?.trim() ||
                  (offering.startDate && offering.endDate
                    ? `${offering.startDate} – ${offering.endDate}`
                    : offering.startDate || offering.endDate || 'Offering')
                return (
                  <button
                    key={offering.id}
                    type="button"
                    onClick={() => handleOfferingSelect(offering.id)}
                    className="text-left rounded-xl border-2 p-3 border-gray-200 hover:border-vortex-red transition-all"
                  >
                    <span className="font-bold text-black block text-sm">{label}</span>
                    {offering.label && offering.startDate && offering.endDate && (
                      <span className="text-xs text-gray-600 mt-1 block">
                        {offering.startDate} – {offering.endDate}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {showSlotPick && (
          <div className={sectionClass}>
            {selectedCategoryName && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 mb-3">
                <span>
                  Category: <span className="font-semibold text-black">{selectedCategoryName}</span>
                </span>
                {selectedOfferingLabel && (
                  <span>
                    Offering:{' '}
                    <span className="font-semibold text-black">{selectedOfferingLabel}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (requiresOfferingSelection) {
                      setOfferingId(undefined)
                    } else {
                      setCategoryId(undefined)
                    }
                    setSlotGroupId(null)
                    setTimeSlotId(null)
                    setIdentityPhase('pending')
                  }}
                  className="text-vortex-red font-semibold hover:underline"
                >
                  {requiresOfferingSelection ? 'Change offering' : 'Change category'}
                </button>
              </div>
            )}
            <h4 className={`font-bold text-black mb-3 ${compact ? 'text-base' : 'text-xl'}`}>
              Time slot
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {slotOptions.map((option) => {
                const alreadySignedUp = isSlotAlreadySignedUp(
                  formDetail.id,
                  categoryId ?? null,
                  option.slotGroupId,
                  option.timeSlotId,
                )
                return (
                <button
                  key={option.key}
                  type="button"
                  disabled={alreadySignedUp}
                  onClick={() => !alreadySignedUp && handleSlotSelect(option)}
                  className={`text-left rounded-xl border-2 p-3 transition-all ${
                    alreadySignedUp
                      ? 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
                      : timeSlotId === option.timeSlotId
                        ? 'border-vortex-red bg-red-50'
                        : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-black text-sm">
                      <Clock className="w-4 h-4 text-vortex-red shrink-0" />
                      {formatSchedulingOccurrenceLabel(option.occurrence, {
                        includeWeek: showWeekInLabels,
                        formatTime: formatTimeLabel,
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                    <Users className="w-4 h-4" />
                    {alreadySignedUp
                      ? 'Already signed up'
                      : option.group.isFull
                        ? `Full — join waitlist${(option.group.waitlistCount ?? 0) > 0 ? ` (${option.group.waitlistCount} waiting)` : ''}`
                        : `${option.group.spotsRemaining} of ${option.group.maxParticipants} spots left`}
                  </div>
                </button>
                )
              })}
            </div>
          </div>
        )}

        {categoryId !== undefined && !offeringsLoading && !showOfferingPick && slotOptions.length === 0 && (
          <div className={`${sectionClass} text-sm text-gray-600`}>
            No available times for this {requiresOfferingSelection ? 'offering' : 'category'}.
            <button
              type="button"
              onClick={() => {
                if (requiresOfferingSelection && offeringId != null) {
                  setOfferingId(undefined)
                } else {
                  setCategoryId(undefined)
                  setOfferingId(undefined)
                }
                setSlotGroupId(null)
                setTimeSlotId(null)
                setIdentityPhase('pending')
              }}
              className="ml-2 text-vortex-red font-semibold hover:underline"
            >
              {requiresOfferingSelection && offeringId != null
                ? 'Choose another offering'
                : 'Choose another category'}
            </button>
          </div>
        )}

        {slotSelected && selectedGroup && selectedOccurrence && !showCategoryPick && !showOfferingPick && !showSlotPick && (
          <div className={`${sectionClass} text-sm text-gray-700`}>
            <span className="font-semibold text-black">Starting slot: </span>
            {selectedCategoryName && <span>{selectedCategoryName} — </span>}
            <span>
              {formatSchedulingOccurrenceLabel(selectedOccurrence, {
                includeWeek: showWeekInLabels,
                formatTime: formatTimeLabel,
              })}
            </span>
            {pendingSlotList.length > 1 && (
              <p className="mt-2 text-gray-600">
                {pendingSlotList.length} new class times selected for signup.
              </p>
            )}
            {!signupAuthToken && identityPhase !== 'ready' && (
              <span className="block sm:inline mt-2 sm:mt-0">
                <button
                  type="button"
                  onClick={() => {
                    setSlotGroupId(null)
                    setTimeSlotId(null)
                    setIdentityPhase('pending')
                  }}
                  className="text-vortex-red font-semibold hover:underline"
                >
                  Change slot
                </button>
                {bookableCategories.length > 1 && (
                  <>
                    <span className="text-gray-400 mx-2">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryId(undefined)
                        setSlotGroupId(null)
                        setIdentityPhase('pending')
                      }}
                      className="text-vortex-red font-semibold hover:underline"
                    >
                      Change category
                    </button>
                  </>
                )}
              </span>
            )}
          </div>
        )}

        {showEmailStep && (
          <div className={sectionClass}>
            <h4 className={`font-bold text-black mb-3 ${compact ? 'text-base' : 'text-xl'}`}>
              Your email
            </h4>
            <p className="text-sm text-gray-600 mb-3">
              Enter the email for your Vortex account. Returning members can sign in and skip the form.
            </p>
            <input
              type="email"
              required
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-vortex-red outline-none"
              placeholder="you@email.com"
            />
            <button
              type="button"
              disabled={identityLoading}
              onClick={handleEmailContinue}
              className="mt-4 inline-flex items-center gap-2 bg-vortex-red text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60"
            >
              {identityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Continue
            </button>
          </div>
        )}

        {showMustChangePasswordStep && (
          <div className={sectionClass}>
            <h4 className={`font-bold text-black mb-2 ${compact ? 'text-base' : 'text-xl'}`}>
              Choose a new password
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Your temporary password must be changed before you can continue.
            </p>
            <label className="block text-sm font-semibold text-gray-700 mb-2">New password</label>
            <input
              type="password"
              value={forcedNewPassword}
              onChange={(e) => setForcedNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-vortex-red outline-none mb-3"
              autoComplete="new-password"
            />
            <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm password</label>
            <input
              type="password"
              value={forcedConfirmPassword}
              onChange={(e) => setForcedConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-vortex-red outline-none mb-4"
              autoComplete="new-password"
            />
            <button
              type="button"
              disabled={identityLoading}
              onClick={() => void handleForcedPasswordChange()}
              className="inline-flex items-center gap-2 bg-vortex-red text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60"
            >
              {identityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save and continue
            </button>
          </div>
        )}

        {showLoginStep && (
          <div className={sectionClass}>
            <h4 className={`font-bold text-black mb-2 ${compact ? 'text-base' : 'text-xl'}`}>
              Welcome back
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Sign in as <span className="font-semibold text-black">{accountEmail}</span>
            </p>
            {magicLinkSent && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
                Check your email for a sign-in link if you do not know your password.
              </p>
            )}
            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={accountPassword}
              onChange={(e) => setAccountPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-vortex-red outline-none mb-3"
              autoComplete="current-password"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={identityLoading}
                onClick={handleLogin}
                className="inline-flex items-center gap-2 bg-vortex-red text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                {identityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Sign in
              </button>
              <button
                type="button"
                disabled={identityLoading}
                onClick={handleMagicLink}
                className="text-sm text-vortex-red font-semibold hover:underline"
              >
                Email me a sign-in link
              </button>
              <button
                type="button"
                onClick={() => {
                  setIdentityPhase('email')
                  setAccountPassword('')
                  setMagicLinkSent(false)
                }}
                className="text-sm text-gray-600 hover:underline"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {slotSelected && identityReady && !isNewUser && (
          <div className={`${sectionClass} text-sm text-green-800 bg-green-50 border border-green-200`}>
            Signed in as <span className="font-semibold">{accountEmail}</span>.
          </div>
        )}

        {showNewUserForm && (
          <div className={sectionClass}>
            <h4 className={`font-bold text-black mb-3 ${compact ? 'text-base' : 'text-xl'}`}>
              Your information
            </h4>
            {mandateWaiver && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4">
                A waiver is required. Your parent or guardian will receive a separate email with a waiver link.
              </div>
            )}
            <div className="space-y-4">
              {enabledFields.map((field) => (
                <div key={field.key}>
                  <label htmlFor={`signup-${field.key}`} className="block text-sm font-semibold text-gray-700 mb-2">
                    {field.label}
                    {field.required && <span className="text-vortex-red ml-1">*</span>}
                  </label>
                  <SignupFieldInput
                    field={field}
                    value={responses[field.key] ?? (field.type === 'email_list' ? [''] : '')}
                    onChange={(val) => setResponses((prev) => ({ ...prev, [field.key]: val }))}
                  />
                </div>
              ))}
              <div>
                <label htmlFor="signup-account-password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Account password
                  <span className="text-vortex-red ml-1">*</span>
                </label>
                <input
                  id="signup-account-password"
                  type="password"
                  required
                  minLength={6}
                  value={newAccountPassword}
                  onChange={(e) => setNewAccountPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-vortex-red outline-none"
                  autoComplete="new-password"
                  placeholder="Create a password for your member account"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can complete your full profile later in the member portal.
                </p>
              </div>
            </div>
          </div>
        )}

        {showAddMoreClasses && (
          <div className={sectionClass}>
            <h4 className={`font-bold text-black mb-2 ${compact ? 'text-base' : 'text-xl'}`}>
              Add more classes
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Other classes in this program available for signup:
            </p>
            {programOptionsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading available classes…
              </div>
            ) : (
              <div className="space-y-6">
                {currentCategoryBundle && (
                  <div>
                    <p className="text-sm font-semibold text-black mb-3">
                      Current Selected Category: {currentCategoryBundle.categoryName}
                    </p>
                    <CategorySlotList
                      bundle={currentCategoryBundle}
                      selectedItems={selectedSlotList}
                      categoryBundles={categoryBundles}
                      signedUpSlotKeys={signedUpSlotKeys}
                      onToggleSlot={toggleCategorySlot}
                    />
                  </div>
                )}

                {otherCategoryBundles.length > 0 && (
                  <div className="space-y-6">
                    {otherCategoryBundles.map((bundle) => (
                      <div key={bundle.key}>
                        <p className="text-sm font-semibold text-black mb-3">
                          {bundle.formTitle !== formDetail.title
                            ? `${bundle.formTitle} — ${bundle.categoryName}`
                            : bundle.categoryName}
                        </p>
                        <CategorySlotList
                          bundle={bundle}
                          selectedItems={selectedSlotList}
                          categoryBundles={categoryBundles}
                          signedUpSlotKeys={signedUpSlotKeys}
                          onToggleSlot={toggleCategorySlot}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
          </>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 flex justify-between text-sm">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {showSubmit && (
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 bg-vortex-red text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {selectedGroup?.isFull ? 'Continue to waitlist signup' : 'Confirm signup'}
          </button>
        )}

        {showReview && (
          <button
            type="submit"
            disabled={submitting || cartItems.length === 0}
            className="inline-flex items-center justify-center gap-2 bg-vortex-red text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {cartItems.length === 1 ? 'Submit signup' : `Submit ${cartItems.length} signups`}
          </button>
        )}
      </form>
    </div>
  )
}

export default SchedulingSignupEmbed
