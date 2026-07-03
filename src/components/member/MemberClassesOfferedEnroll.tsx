import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle, LayoutGrid, Loader2, Search, ShoppingCart } from 'lucide-react'
import type { PublicProgramOffered } from '../../utils/publicClassesApi'
import {
  enabledBasePricingOptions,
  formatProgramPricingOptionLabel,
  type ProgramPricingOptionKey,
} from '../../utils/programPricingOptions'
import {
  maxEnabledWeeklySlots,
  onlyFlatOneXWeeklyTier,
  programUsesWeeklyTierPricing,
  weeklyTierExceedsMaxMessage,
  weeklyTierForSlotCount,
  weeklyTierTotalDollars,
} from '../../utils/weeklyTierPricing'
import type { MultiClassPassPackage } from '../../utils/multiClassPassPackages'
import {
  fetchSignupOrderPreview,
  loginSchedulingAuthFromMemberSession,
  submitSchedulingSignupBatch,
  type SignupOrderPreview,
} from '../../utils/schedulingApi'
import {
  slotOptionKey,
  type SignupClassCatalog,
} from '../signup/signupEnrollmentUtils'
import ScheduleOptionCheckboxGrid, {
  groupScheduleOptions,
} from '../signup/ScheduleOptionCheckboxGrid'
import OrderPricingSummary from '../pricing/OrderPricingSummary'
import type { MemberEnrollmentRow } from './MemberEnrollmentsPanel'

export interface EnrollableMember {
  id: number
  label: string
}

interface Props {
  apiUrl: string
  memberToken: string
  programs: PublicProgramOffered[]
  members: EnrollableMember[]
  defaultMemberId: number
  enrollments: MemberEnrollmentRow[]
  onEnrolled: () => void
}

interface CartItem {
  cartKey: string
  lineType: 'slot' | 'multi_class_pass'
  classEventId?: number
  formId?: number
  slotGroupId?: number
  timeSlotId?: number
  classLabel?: string
  scheduleLabel?: string
  priceLabel?: string | null
  programsId?: number
  programName?: string
  packageId?: string
  packageLabel?: string
  selectedPricingOptionKey?: ProgramPricingOptionKey
}

type CatalogState = SignupClassCatalog | 'loading' | 'error'

const UNSPECIFIED_SPORT = '__unspecified_sport__'
const ALL_LEVELS = '__all_levels__'
const NO_LEVEL = '__no_level__'

function classMatchesLevelFilter(skillLevel: string | null, levelFilter: string): boolean {
  if (levelFilter === ALL_LEVELS) return true
  if (levelFilter === NO_LEVEL) return skillLevel == null
  return skillLevel == null || skillLevel === levelFilter
}

function getEachClassPriceLabel(
  program: PublicProgramOffered,
  catalog: CatalogState | undefined,
): string | null {
  if (catalog && catalog !== 'loading' && catalog !== 'error' && catalog.priceLabel) {
    return catalog.priceLabel
  }
  const usesWeeklyTiers = programUsesWeeklyTierPricing(program)
  const flatOneXOnly =
    usesWeeklyTiers && onlyFlatOneXWeeklyTier(program.pricingCostOptions ?? [])
  const oneXMonthly = flatOneXOnly
    ? weeklyTierTotalDollars(1, program.pricingCostOptions ?? [])
    : null
  if (oneXMonthly != null) return `$${oneXMonthly.toFixed(2)}/mo`
  return null
}

export default function MemberClassesOfferedEnroll({
  apiUrl,
  memberToken,
  programs,
  members,
  defaultMemberId,
  enrollments,
  onEnrolled,
}: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState<number>(Number(defaultMemberId))
  const [catalogs, setCatalogs] = useState<Record<number, CatalogState>>({})
  const [cart, setCart] = useState<CartItem[]>([])
  const [view, setView] = useState<'browse' | 'checkout' | 'done'>('browse')

  const [preview, setPreview] = useState<SignupOrderPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [promoInput, setPromoInput] = useState('')
  const [promoCodes, setPromoCodes] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [doneCount, setDoneCount] = useState(0)

  const [selectedPricingByProgram, setSelectedPricingByProgram] = useState<
    Record<number, ProgramPricingOptionKey>
  >({})

  const [searchQuery, setSearchQuery] = useState('')
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [programFilter, setProgramFilter] = useState<number | 'all'>('all')
  const [levelFilter, setLevelFilter] = useState<string>(ALL_LEVELS)

  const classesWithForm = useMemo(() => {
    const out: Array<{
      classEventId: number
      formId: number
      programsId: number
      label: string
      description: string | null
      skillLevel: string | null
      programName: string
    }> = []
    for (const program of programs) {
      for (const cls of program.classes) {
        if (cls.formId != null) {
          out.push({
            classEventId: cls.id,
            formId: cls.formId,
            programsId: program.id,
            label: cls.displayName,
            description: cls.description,
            skillLevel: cls.skillLevel,
            programName: program.displayName,
          })
        }
      }
    }
    return out
  }, [programs])

  const sportOptions = useMemo(() => {
    const names = new Set<string>()
    let hasUnspecified = false
    for (const program of programs) {
      if (program.primarySportName) names.add(program.primarySportName)
      else hasUnspecified = true
    }
    return {
      named: [...names].sort((a, b) => a.localeCompare(b)),
      hasUnspecified,
    }
  }, [programs])

  const levelOptions = useMemo(() => {
    const levels = new Set<string>()
    let hasNoLevel = false
    for (const cls of classesWithForm) {
      if (cls.skillLevel) levels.add(cls.skillLevel)
      else hasNoLevel = true
    }
    return {
      named: [...levels].sort((a, b) => a.localeCompare(b)),
      hasNoLevel,
    }
  }, [classesWithForm])

  const filteredProgramSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const sections: Array<{
      program: PublicProgramOffered
      programClasses: typeof classesWithForm
    }> = []

    for (const program of programs) {
      if (programFilter !== 'all' && program.id !== programFilter) continue

      const sportKey = program.primarySportName ?? UNSPECIFIED_SPORT
      if (sportFilter !== 'all') {
        if (sportFilter === UNSPECIFIED_SPORT && program.primarySportName) continue
        if (sportFilter !== UNSPECIFIED_SPORT && sportKey !== sportFilter) continue
      }

      const programClasses = classesWithForm
        .filter((c) => c.programsId === program.id)
        .filter((c) => classMatchesLevelFilter(c.skillLevel, levelFilter))
        .filter((c) => {
          if (!q) return true
          const haystack = [
            c.label,
            c.description ?? '',
            c.programName,
            c.skillLevel ?? '',
            program.primarySportName ?? '',
          ]
            .join(' ')
            .toLowerCase()
          return haystack.includes(q)
        })
        .sort((a, b) => a.label.localeCompare(b.label))

      if (programClasses.length === 0) continue
      sections.push({ program, programClasses })
    }

    return sections
  }, [programs, classesWithForm, searchQuery, sportFilter, programFilter, levelFilter])

  const loadCatalog = useCallback(
    async (classEventId: number) => {
      setCatalogs((prev) => {
        if (prev[classEventId]) return prev
        return { ...prev, [classEventId]: 'loading' }
      })
      try {
        const res = await fetch(`${apiUrl}/api/signup/catalog/classes/${classEventId}/offerings`)
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load')
        const pack: SignupClassCatalog = data.data ?? { formId: null, offerings: [], scheduleOptions: [] }
        setCatalogs((prev) => ({
          ...prev,
          [classEventId]: {
            formId: pack.formId ?? null,
            offerings: pack.offerings ?? [],
            scheduleOptions: pack.scheduleOptions ?? [],
            priceLabel: pack.priceLabel ?? null,
            classActiveDates: pack.classActiveDates ?? null,
          },
        }))
      } catch {
        setCatalogs((prev) => ({ ...prev, [classEventId]: 'error' }))
      }
    },
    [apiUrl],
  )

  useEffect(() => {
    for (const cls of classesWithForm) {
      if (!catalogs[cls.classEventId]) void loadCatalog(cls.classEventId)
    }
  }, [classesWithForm, catalogs, loadCatalog])

  const memberEnrollmentRows = useMemo(
    () =>
      enrollments.filter(
        (row) =>
          Number(row.member_id) === Number(selectedMemberId) &&
          row.source !== 'legacy' &&
          row.form_id != null,
      ),
    [enrollments, selectedMemberId],
  )

  const existingSlotsByProgram = useMemo(() => {
    const formToProgram = new Map(classesWithForm.map((c) => [c.formId, c.programsId]))
    const counts = new Map<number, number>()
    for (const row of memberEnrollmentRows) {
      const programsId = row.form_id != null ? formToProgram.get(row.form_id) : undefined
      if (programsId != null) {
        counts.set(programsId, (counts.get(programsId) ?? 0) + 1)
      }
    }
    return counts
  }, [memberEnrollmentRows, classesWithForm])

  const countProgramSlotsInCart = (programsId: number) =>
    cart.filter((c) => c.lineType === 'slot' && c.programsId === programsId).length

  const programSlotLimitMessage = (program: PublicProgramOffered): string | null => {
    if (!programUsesWeeklyTierPricing(program)) return null
    const max = maxEnabledWeeklySlots(program.pricingCostOptions ?? [])
    const total = (existingSlotsByProgram.get(program.id) ?? 0) + countProgramSlotsInCart(program.id)
    if (total >= max) return weeklyTierExceedsMaxMessage(max)
    return null
  }

  const disabledOfferingIds = useMemo(() => {
    const ids = new Set<number>()
    for (const row of memberEnrollmentRows) {
      if (row.offering_id != null) ids.add(Number(row.offering_id))
    }
    return [...ids]
  }, [memberEnrollmentRows])

  const disabledSlotKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const row of memberEnrollmentRows) {
      if (row.slot_group_id != null && row.time_slot_id != null) {
        keys.add(slotOptionKey(row.slot_group_id, row.time_slot_id))
      }
    }
    return [...keys]
  }, [memberEnrollmentRows])

  useEffect(() => {
    if (disabledOfferingIds.length === 0 && disabledSlotKeys.length === 0) return
    setCart((prev) =>
      prev.filter((item) => {
        if (item.lineType === 'multi_class_pass') return true
        if (item.slotGroupId == null || item.timeSlotId == null) return true
        const key = slotOptionKey(item.slotGroupId, item.timeSlotId)
        if (disabledSlotKeys.includes(key)) return false
        const catalog = item.classEventId != null ? catalogs[item.classEventId] : null
        if (!catalog || catalog === 'loading' || catalog === 'error') return true
        const opt = catalog.scheduleOptions.find(
          (o) => slotOptionKey(o.slotGroupId, o.timeSlotId) === key,
        )
        if (opt?.offeringId != null && disabledOfferingIds.includes(Number(opt.offeringId))) {
          return false
        }
        return true
      }),
    )
  }, [selectedMemberId, disabledOfferingIds, disabledSlotKeys, catalogs])

  const toggleSlot = (
    classEventId: number,
    formId: number,
    classLabel: string,
    key: string,
    checked: boolean,
  ) => {
    const cartKey = `${classEventId}:${key}`
    if (!checked) {
      setCart((prev) => prev.filter((c) => c.cartKey !== cartKey))
      return
    }
    if (disabledSlotKeys.includes(key)) return
    const catalog = catalogs[classEventId]
    if (!catalog || catalog === 'loading' || catalog === 'error') return
    const opt = catalog.scheduleOptions.find(
      (o) => slotOptionKey(o.slotGroupId, o.timeSlotId) === key,
    )
    if (opt?.offeringId != null && disabledOfferingIds.includes(Number(opt.offeringId))) return
    if (!opt) return
    const programsId = classesWithForm.find((c) => c.classEventId === classEventId)?.programsId
    const program = programsId != null ? programs.find((p) => p.id === programsId) : undefined
    if (program && programUsesWeeklyTierPricing(program)) {
      const max = maxEnabledWeeklySlots(program.pricingCostOptions ?? [])
      const existing = existingSlotsByProgram.get(program.id) ?? 0
      const inCart = countProgramSlotsInCart(program.id)
      if (existing + inCart >= max) {
        return
      }
    }
    setCart((prev) => [
      ...prev,
      {
        cartKey,
        lineType: 'slot',
        classEventId,
        formId,
        slotGroupId: opt.slotGroupId,
        timeSlotId: opt.timeSlotId,
        classLabel,
        scheduleLabel: opt.scheduleLabel,
        priceLabel: opt.priceLabel,
        programsId: classesWithForm.find((c) => c.classEventId === classEventId)?.programsId,
      },
    ])
  }

  const togglePassPackage = (
    program: PublicProgramOffered,
    pkg: MultiClassPassPackage,
    checked: boolean,
  ) => {
    const cartKey = `pass:${program.id}:${pkg.id}`
    if (!checked) {
      setCart((prev) => prev.filter((c) => c.cartKey !== cartKey))
      return
    }
    setCart((prev) => [
      ...prev.filter((c) => !(c.lineType === 'multi_class_pass' && c.programsId === program.id)),
      {
        cartKey,
        lineType: 'multi_class_pass',
        programsId: program.id,
        programName: program.displayName,
        packageId: pkg.id,
        packageLabel: pkg.label,
        priceLabel: `$${(pkg.priceCents / 100).toFixed(2)}`,
      },
    ])
  }

  const buildPreviewSignups = useCallback(() => {
    return cart.map((c) => {
      if (c.lineType === 'multi_class_pass') {
        return {
          lineType: 'multi_class_pass' as const,
          programsId: c.programsId!,
          packageId: c.packageId!,
        }
      }
      const pricingKey =
        c.programsId != null && !programUsesWeeklyTierPricing(
          programs.find((p) => p.id === c.programsId) ?? {},
        )
          ? selectedPricingByProgram[c.programsId]
          : undefined
      return {
        lineType: 'slot' as const,
        formId: c.formId!,
        slotGroupId: c.slotGroupId!,
        timeSlotId: c.timeSlotId!,
        selectedPricingOptionKey: pricingKey,
        useMultiClassPass: true,
      }
    })
  }, [cart, selectedPricingByProgram, programs])

  const selectedMember =
    members.find((m) => Number(m.id) === Number(selectedMemberId)) ?? members[0]

  const goToCheckout = async () => {
    if (cart.length === 0) return
    setView('checkout')
    await runPreview(promoCodes)
  }

  const runPreview = useCallback(
    async (codes: string[]) => {
      if (cart.length === 0) return
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const firstForm =
          cart.find((c) => c.lineType === 'slot' && c.formId != null)?.formId ??
          classesWithForm[0]?.formId
        if (firstForm == null) throw new Error('Select a class or pass to continue')
        const session = await loginSchedulingAuthFromMemberSession(
          firstForm,
          memberToken,
          selectedMemberId,
        )
        const result = await fetchSignupOrderPreview({
          formId: firstForm,
          signupAuthToken: session.signupAuthToken,
          signups: buildPreviewSignups(),
          promoCodes: codes,
        })
        setPreview(result)
      } catch (err) {
        setPreview(null)
        setPreviewError(err instanceof Error ? err.message : 'Failed to load pricing')
      } finally {
        setPreviewLoading(false)
      }
    },
    [cart, memberToken, selectedMemberId, buildPreviewSignups, classesWithForm],
  )

  const applyPromo = async () => {
    const code = promoInput.trim()
    if (!code || promoCodes.includes(code)) {
      setPromoInput('')
      return
    }
    const next = [...promoCodes, code]
    setPromoCodes(next)
    setPromoInput('')
    await runPreview(next)
  }

  const removePromo = async (code: string) => {
    const next = promoCodes.filter((c) => c !== code)
    setPromoCodes(next)
    await runPreview(next)
  }

  const confirmEnrollment = async () => {
    if (cart.length === 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const slotItems = cart.filter((c) => c.lineType === 'slot')
      const passItems = cart.filter((c) => c.lineType === 'multi_class_pass')
      const byForm = new Map<number, CartItem[]>()
      for (const item of slotItems) {
        if (item.formId == null) continue
        const list = byForm.get(item.formId) ?? []
        list.push(item)
        byForm.set(item.formId, list)
      }
      let total = 0
      const firstFormId =
        slotItems[0]?.formId ?? classesWithForm.find((c) => c.programsId === passItems[0]?.programsId)?.formId
      if (firstFormId == null) throw new Error('Missing enrollment context')

      const session = await loginSchedulingAuthFromMemberSession(
        firstFormId,
        memberToken,
        selectedMemberId,
      )

      const allSignups = buildPreviewSignups()
      const result = await submitSchedulingSignupBatch({
        signups: allSignups,
        responses: {},
        signupAuthToken: session.signupAuthToken,
        promoCodes,
      })
      total += result.signups.length
      setDoneCount(total)
      setCart([])
      setPreview(null)
      setPromoCodes([])
      setView('done')
      onEnrolled()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to complete enrollment')
    } finally {
      setSubmitting(false)
    }
  }

  if (view === 'done') {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900">Enrollment complete</h3>
        <p className="text-gray-600 mt-1">
          {doneCount} {doneCount === 1 ? 'class' : 'classes'} added for{' '}
          <span className="font-semibold">{selectedMember?.label}</span>. The charges have posted to
          your family account.
        </p>
        <button
          type="button"
          onClick={() => setView('browse')}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white"
        >
          Back to classes
        </button>
      </div>
    )
  }

  if (view === 'checkout') {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setView('browse')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to class selection
        </button>

        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-sm text-gray-600">Enrolling</p>
          <p className="text-base font-semibold text-gray-900">{selectedMember?.label}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Selected items ({cart.length})</h3>
          <ul className="space-y-2">
            {cart.map((item) => (
              <li
                key={item.cartKey}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  {item.lineType === 'multi_class_pass' ? (
                    <>
                      <p className="font-semibold text-gray-900">{item.packageLabel}</p>
                      <p className="text-gray-600">{item.programName} · Multi-class package</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-900">{item.classLabel}</p>
                      <p className="text-gray-600">{item.scheduleLabel}</p>
                    </>
                  )}
                </div>
                {item.priceLabel && (
                  <span className="shrink-0 text-xs font-semibold text-vortex-red">{item.priceLabel}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {previewLoading && (
          <div className="flex items-center gap-2 text-gray-600 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Calculating your pricing…
          </div>
        )}
        {previewError && <div className="text-sm text-red-600">{previewError}</div>}
        {preview && !previewLoading && (
          <>
            <OrderPricingSummary preview={preview} />
            {(preview.hasPricing || (preview.passPurchases?.length ?? 0) > 0) && (
              <p className="text-xs text-gray-500">
                These are your real monthly prices. Final billing posts to your family account.
              </p>
            )}
            {!preview.hasPricing && (preview.passPurchases?.length ?? 0) === 0 && (
              <p className="text-sm text-amber-800">
                Pricing is not configured for the selected class yet. Contact the front desk to confirm
                your rate before completing enrollment.
              </p>
            )}
          </>
        )}

        <div className="rounded-xl border border-gray-200 px-4 py-3 space-y-2">
          <label className="block text-xs font-semibold text-gray-600">Promo code</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder="Enter code"
              className="h-9 flex-1 rounded-lg border border-gray-300 px-3 text-sm"
            />
            <button
              type="button"
              onClick={applyPromo}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Apply
            </button>
          </div>
          {promoCodes.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {promoCodes.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800"
                >
                  {code}
                  <button type="button" onClick={() => removePromo(code)} className="text-green-700">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {submitError && <div className="text-sm text-red-600">{submitError}</div>}

        <button
          type="button"
          onClick={confirmEnrollment}
          disabled={submitting || cart.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-vortex-red px-4 py-3 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Confirm enrollment
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 md:px-5 md:py-5 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutGrid className="w-7 h-7 text-vortex-red" />
            Classes Offered
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Browse the classes offered at your facility and sign up. Availability is managed through
            your facility&apos;s classes and schedule.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Enroll athlete</label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(Number(e.target.value))}
            className="w-full sm:w-72 h-10 rounded-lg border border-gray-300 px-3 text-sm bg-white"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {classesWithForm.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search classes…"
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <label className="flex flex-col gap-1 min-w-[10rem] flex-1 sm:max-w-[14rem]">
              <span className="text-xs font-semibold text-gray-600">Sport</span>
              <select
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="all">All sports</option>
                {sportOptions.named.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
                {sportOptions.hasUnspecified && (
                  <option value={UNSPECIFIED_SPORT}>Unspecified sport</option>
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1 min-w-[10rem] flex-1 sm:max-w-[14rem]">
              <span className="text-xs font-semibold text-gray-600">Program</span>
              <select
                value={programFilter === 'all' ? 'all' : String(programFilter)}
                onChange={(e) =>
                  setProgramFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="all">All programs</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 min-w-[10rem] flex-1 sm:max-w-[14rem]">
              <span className="text-xs font-semibold text-gray-600">Experience level</span>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"
              >
                <option value={ALL_LEVELS}>All levels</option>
                {levelOptions.hasNoLevel && <option value={NO_LEVEL}>No level</option>}
                {levelOptions.named.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {classesWithForm.length === 0 && (
        <p className="text-sm text-gray-500">No classes are available to enroll in right now.</p>
      )}

      {classesWithForm.length > 0 && filteredProgramSections.length === 0 && (
        <p className="text-sm text-gray-500">No classes match your search or filters.</p>
      )}

      {filteredProgramSections.map(({ program, programClasses }) => {
        const usesWeeklyTiers = programUsesWeeklyTierPricing(program)
        const nonWeeklyPricingOptions = enabledBasePricingOptions(
          program.pricingCostOptions ?? [],
        ).filter((o) => !o.key.startsWith('monthly_'))
        const passPackages = (program.multiClassPassPackages ?? []).filter((p) => p.enabled)

        const maxWeeklySlots = usesWeeklyTiers
          ? maxEnabledWeeklySlots(program.pricingCostOptions ?? [])
          : 0
        const flatOneXOnly =
          usesWeeklyTiers && onlyFlatOneXWeeklyTier(program.pricingCostOptions ?? [])
        const programSlotTotal =
          (existingSlotsByProgram.get(program.id) ?? 0) + countProgramSlotsInCart(program.id)
        const weeklyTier =
          usesWeeklyTiers && programSlotTotal > 0
            ? weeklyTierForSlotCount(programSlotTotal, program.pricingCostOptions ?? [])
            : null
        const weeklyTotalMonthly =
          usesWeeklyTiers && programSlotTotal > 0
            ? weeklyTierTotalDollars(programSlotTotal, program.pricingCostOptions ?? [])
            : null
        const limitMsg = programSlotLimitMessage(program)

        return (
          <div
            key={program.id}
            className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 space-y-4 shadow-sm"
          >
            <div>
              <h2 className="text-lg font-bold text-vortex-red">{program.displayName}</h2>
              {program.description && (
                <p className="text-sm text-gray-600 mt-1">{program.description}</p>
              )}
              {usesWeeklyTiers && !flatOneXOnly && (
                <p className="text-sm text-gray-600 mt-2">
                  {weeklyTotalMonthly != null && weeklyTier ? (
                    <>
                      Estimated monthly total:{' '}
                      <span className="font-semibold text-gray-900">
                        ${weeklyTotalMonthly.toFixed(2)}/mo
                      </span>{' '}
                      <span className="text-gray-500">
                        ({weeklyTier.slotCount}{' '}
                        {weeklyTier.slotCount === 1 ? 'class' : 'classes'})
                      </span>
                    </>
                  ) : (
                    <>Select up to {maxWeeklySlots} class slots for this program.</>
                  )}
                </p>
              )}
              {limitMsg && programSlotTotal >= maxWeeklySlots && (
                <p className="text-sm text-amber-700 mt-1">{limitMsg}</p>
              )}
            </div>

            {passPackages.length > 0 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-900">Multi-class packages</h3>
                <p className="text-xs text-gray-500">
                  Prepaid class credits for {program.displayName}. Select one package to add to your
                  enrollment.
                </p>
                <ul className="space-y-2">
                  {passPackages.map((pkg) => {
                    const cartKey = `pass:${program.id}:${pkg.id}`
                    const checked = cart.some((c) => c.cartKey === cartKey)
                    return (
                      <li
                        key={pkg.id}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
                      >
                        <label className="inline-flex items-center gap-2 flex-1 min-w-[12rem] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => togglePassPackage(program, pkg, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-vortex-red focus:ring-vortex-red"
                          />
                          <span className="text-sm font-medium text-gray-900">{pkg.label}</span>
                          <span className="text-sm text-gray-600">
                            ({pkg.classCount} {pkg.classCount === 1 ? 'class' : 'classes'})
                          </span>
                        </label>
                        <span className="text-sm font-semibold text-vortex-red">
                          ${(pkg.priceCents / 100).toFixed(2)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {nonWeeklyPricingOptions.length > 1 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Pricing option for {program.displayName}
                </label>
                <select
                  value={selectedPricingByProgram[program.id] ?? nonWeeklyPricingOptions[0]?.key ?? ''}
                  onChange={(e) =>
                    setSelectedPricingByProgram((prev) => ({
                      ...prev,
                      [program.id]: e.target.value as ProgramPricingOptionKey,
                    }))
                  }
                  className="w-full sm:w-96 h-10 rounded-lg border border-gray-300 px-3 text-sm bg-white"
                >
                  {nonWeeklyPricingOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {formatProgramPricingOptionLabel(opt)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {programClasses.map((cls) => {
              const catalog = catalogs[cls.classEventId]
              const eachClassPrice = getEachClassPriceLabel(program, catalog)
              const selectedKeysForClass = cart
                .filter((c) => c.classEventId === cls.classEventId && c.lineType === 'slot')
                .map((c) => slotOptionKey(c.slotGroupId!, c.timeSlotId!))
              return (
                <div
                  key={cls.classEventId}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3"
                >
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{cls.label}</h3>
                    {cls.skillLevel && (
                      <p className="text-xs text-gray-500 mt-0.5">Level: {cls.skillLevel}</p>
                    )}
                    {cls.description && (
                      <p className="text-sm text-gray-600 mt-1">{cls.description}</p>
                    )}
                    {eachClassPrice && (
                      <p className="text-sm text-gray-600 mt-1">
                        Each class:{' '}
                        <span className="font-semibold text-gray-900">{eachClassPrice}</span>
                      </p>
                    )}
                  </div>

                  {catalog === 'loading' && (
                    <p className="text-sm text-gray-500">Loading schedule…</p>
                  )}
                  {catalog === 'error' && (
                    <p className="text-sm text-red-600">Could not load this class&apos;s schedule.</p>
                  )}
                  {catalog && catalog !== 'loading' && catalog !== 'error' && (
                    <>
                      {catalog.classActiveDates && (
                        <p className="text-sm text-gray-700">
                          Class active dates:{' '}
                          <span className="font-medium">{catalog.classActiveDates}</span>
                        </p>
                      )}
                      {catalog.scheduleOptions.length > 0 ? (
                        <ScheduleOptionCheckboxGrid
                          groups={groupScheduleOptions(catalog.scheduleOptions)}
                          selectedSlotKeys={selectedKeysForClass}
                          disabledSlotKeys={disabledSlotKeys}
                          disabledOfferingIds={disabledOfferingIds}
                          onToggle={(key, checked) =>
                            toggleSlot(cls.classEventId, cls.formId, cls.label, key, checked)
                          }
                        />
                      ) : (
                        <p className="text-sm text-gray-500">
                          No schedule options are open for this class yet.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      <div className="sticky bottom-0 -mx-4 md:-mx-6 border-t border-gray-200 bg-white px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <span className="text-sm text-gray-600">
          {cart.length} {cart.length === 1 ? 'item' : 'items'} selected
        </span>
        <button
          type="button"
          onClick={goToCheckout}
          disabled={cart.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          <ShoppingCart className="w-4 h-4" />
          Enroll ({cart.length})
        </button>
      </div>
    </div>
  )
}
