import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, Loader2, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import type { PublicProgramOffered } from '../../utils/publicClassesApi'
import {
  CLASS_SKILL_LEVEL_FILTER_OPTIONS,
  formatAgeRange,
  formatSkillLevel,
  type ClassSkillLevelFilter,
} from '../../utils/classDisplayUtils'
import {
  enabledBasePricingOptions,
  formatProgramPricingOptionLabel,
  type ProgramPricingOption,
  type ProgramPricingOptionKey,
} from '../../utils/programPricingOptions'
import {
  maxEnabledWeeklySlots,
  programUsesWeeklyTierPricing,
  weeklyTierForSlotCount,
  weeklyTierTotalCents,
} from '../../utils/weeklyTierPricing'
import {
  loadPublicEnrollmentCart,
  savePublicEnrollmentCart,
  type PublicEnrollmentCartItem,
} from '../../utils/publicEnrollmentCart'
import { trackEvent } from '../../utils/analyticsClient'
import {
  fetchSignupOrderPreview,
  type SignupOrderPreview,
} from '../../utils/schedulingApi'
import {
  slotOptionKey,
  type SignupClassCatalog,
} from '../signup/signupEnrollmentUtils'
import ScheduleOptionCheckboxGrid, {
  groupScheduleOptions,
} from '../signup/ScheduleOptionCheckboxGrid'

type CatalogState = SignupClassCatalog | 'loading' | 'error'

interface Props {
  apiUrl: string
  programs: PublicProgramOffered[]
  initialSportFilter?: string
  initialProgramId?: number | null
  initialFocusedFormId?: number | null
}

interface CatalogClass {
  classEventId: number
  formId: number
  programsId: number
  label: string
  description: string | null
  skillLevel: string | null
  ageMin: number | null
  ageMax: number | null
  programName: string
}

interface MultiClassDiscountRow {
  ruleId: number
  name: string
  amountCents: number
  qualifiedLabel: string | null
  nextTierHint: string | null
}

const UNSPECIFIED_SPORT = '__unspecified_sport__'

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function classMatchesLevel(skillLevel: string | null, filter: ClassSkillLevelFilter) {
  return filter === 'all' || skillLevel == null || skillLevel === filter
}

function nonWeeklyOptions(program: PublicProgramOffered): ProgramPricingOption[] {
  return enabledBasePricingOptions(program.pricingCostOptions ?? []).filter(
    (option) => !option.key.startsWith('monthly_'),
  )
}

function defaultPricingKey(program?: PublicProgramOffered): ProgramPricingOptionKey | undefined {
  if (!program) return undefined
  return nonWeeklyOptions(program)[0]?.key
}

function estimateProgramSubtotal(
  program: PublicProgramOffered,
  items: PublicEnrollmentCartItem[],
  selectedPricingKey?: ProgramPricingOptionKey,
): { cents: number | null; detail: string } {
  if (programUsesWeeklyTierPricing(program)) {
    const cents = weeklyTierTotalCents(items.length, program.pricingCostOptions ?? [])
    const tier = weeklyTierForSlotCount(items.length, program.pricingCostOptions ?? [])
    return {
      cents,
      detail: tier
        ? `${tier.slotCount} ${tier.slotCount === 1 ? 'class' : 'classes'} per week`
        : `${items.length} selected`,
    }
  }

  const options = nonWeeklyOptions(program)
  const option =
    options.find((candidate) => candidate.key === selectedPricingKey) ?? options[0]
  if (option) {
    const oneCharge =
      option.key === 'monthly_flat' || option.key.startsWith('unlimited_')
    return {
      cents: option.amountCents * (oneCharge ? 1 : items.length),
      detail: formatProgramPricingOptionLabel(option),
    }
  }

  const itemPrices = items.map((item) => item.priceCents).filter((value) => value != null)
  return itemPrices.length === items.length
    ? { cents: itemPrices.reduce((sum, value) => sum + Number(value), 0), detail: 'Scheduled class pricing' }
    : { cents: null, detail: 'Price confirmed during enrollment' }
}

function summarizeMultiClassDiscount(preview: SignupOrderPreview | null) {
  const grouped = new Map<number, MultiClassDiscountRow>()
  const add = (
    ruleId: number,
    name: string,
    amountCents: number,
    qualifiedLabel?: string | null,
    nextTierHint?: string | null,
  ) => {
    const current = grouped.get(ruleId)
    if (current) {
      current.amountCents += amountCents
      current.qualifiedLabel ||= qualifiedLabel ?? null
      current.nextTierHint ||= nextTierHint ?? null
      return
    }
    grouped.set(ruleId, {
      ruleId,
      name,
      amountCents,
      qualifiedLabel: qualifiedLabel ?? null,
      nextTierHint: nextTierHint ?? null,
    })
  }

  if (preview?.discounts?.enabled) {
    for (const line of preview.discounts.lines) {
      for (const applied of line.applied) {
        if (applied.type !== 'multi_class') continue
        add(
          applied.ruleId,
          applied.name,
          applied.amountCents,
          applied.qualifiedLabel,
          applied.nextTierHint,
        )
      }
    }
    for (const applied of preview.discounts.orderDiscounts) {
      if (applied.type !== 'multi_class') continue
      add(
        applied.ruleId,
        applied.name,
        applied.amountCents,
        applied.qualifiedLabel,
        applied.nextTierHint,
      )
    }
  }

  const rows = [...grouped.values()]
  return {
    rows,
    totalCents: rows.reduce((sum, row) => sum + row.amountCents, 0),
  }
}

export default function PublicClassesOfferedEnroll({
  apiUrl,
  programs,
  initialSportFilter = 'all',
  initialProgramId = null,
  initialFocusedFormId = null,
}: Props) {
  const navigate = useNavigate()
  const [catalogs, setCatalogs] = useState<Record<number, CatalogState>>({})
  const [cart, setCart] = useState<PublicEnrollmentCartItem[]>(loadPublicEnrollmentCart)
  const [searchQuery, setSearchQuery] = useState('')
  const [sportFilter, setSportFilter] = useState(initialSportFilter)
  const [programFilter, setProgramFilter] = useState<number | 'all'>(
    initialProgramId ?? 'all',
  )
  const [levelFilter, setLevelFilter] = useState<ClassSkillLevelFilter>('all')
  const [selectedPricingByProgram, setSelectedPricingByProgram] = useState<
    Record<number, ProgramPricingOptionKey>
  >({})
  const [discountPreview, setDiscountPreview] = useState<SignupOrderPreview | null>(null)
  const [discountPreviewLoading, setDiscountPreviewLoading] = useState(false)
  const [discountPreviewUnavailable, setDiscountPreviewUnavailable] = useState(false)

  const classesWithForm = useMemo<CatalogClass[]>(() => {
    const result: CatalogClass[] = []
    for (const program of programs) {
      for (const classItem of program.classes) {
        if (classItem.formId == null) continue
        result.push({
          classEventId: classItem.id,
          formId: classItem.formId,
          programsId: program.id,
          label: classItem.displayName,
          description: classItem.description,
          skillLevel: classItem.skillLevel,
          ageMin: classItem.ageMin,
          ageMax: classItem.ageMax,
          programName: program.displayName,
        })
      }
    }
    return result
  }, [programs])

  const validClassIds = useMemo(
    () => new Set(classesWithForm.map((classItem) => classItem.classEventId)),
    [classesWithForm],
  )

  useEffect(() => {
    setCart((current) => current.filter((item) => validClassIds.has(item.classEventId)))
  }, [validClassIds])

  const loadCatalog = useCallback(async (classEventId: number) => {
    setCatalogs((current) => current[classEventId]
      ? current
      : { ...current, [classEventId]: 'loading' })
    try {
      const response = await fetch(
        `${apiUrl}/api/signup/catalog/classes/${classEventId}/offerings`,
      )
      const body = await response.json()
      if (!response.ok || !body.success) {
        throw new Error(body.message || 'Failed to load class schedule')
      }
      const catalog = body.data ?? { formId: null, offerings: [], scheduleOptions: [] }
      setCatalogs((current) => ({
        ...current,
        [classEventId]: {
          formId: catalog.formId ?? null,
          offerings: catalog.offerings ?? [],
          scheduleOptions: catalog.scheduleOptions ?? [],
          priceLabel: catalog.priceLabel ?? null,
          classActiveDates: catalog.classActiveDates ?? null,
        },
      }))
    } catch {
      setCatalogs((current) => ({ ...current, [classEventId]: 'error' }))
    }
  }, [apiUrl])

  useEffect(() => {
    for (const classItem of classesWithForm) {
      if (!catalogs[classItem.classEventId]) void loadCatalog(classItem.classEventId)
    }
  }, [catalogs, classesWithForm, loadCatalog])

  const sportOptions = useMemo(() => {
    const names = new Set<string>()
    let hasUnspecified = false
    for (const program of programs) {
      if (program.primarySportName) names.add(program.primarySportName)
      else hasUnspecified = true
    }
    return { named: [...names].sort(), hasUnspecified }
  }, [programs])

  const programOptions = useMemo(() => {
    if (sportFilter === 'all') return programs
    return programs.filter(
      (program) => (program.primarySportName ?? UNSPECIFIED_SPORT) === sportFilter,
    )
  }, [programs, sportFilter])

  const filteredProgramSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return programs.flatMap((program) => {
      if (programFilter !== 'all' && program.id !== programFilter) return []
      if (
        sportFilter !== 'all' &&
        (program.primarySportName ?? UNSPECIFIED_SPORT) !== sportFilter
      ) return []

      const programClasses = classesWithForm
        .filter((classItem) => classItem.programsId === program.id)
        .filter((classItem) => classMatchesLevel(classItem.skillLevel, levelFilter))
        .filter((classItem) => {
          if (!query) return true
          return [
            classItem.label,
            classItem.description ?? '',
            classItem.programName,
            classItem.skillLevel ?? '',
            program.primarySportName ?? '',
          ].join(' ').toLowerCase().includes(query)
        })
        .sort((a, b) => a.label.localeCompare(b.label))
      return programClasses.length > 0 ? [{ program, programClasses }] : []
    })
  }, [classesWithForm, levelFilter, programFilter, programs, searchQuery, sportFilter])

  const cartByProgram = useMemo(() => {
    const result = new Map<number, PublicEnrollmentCartItem[]>()
    for (const item of cart) {
      const list = result.get(item.programsId) ?? []
      list.push(item)
      result.set(item.programsId, list)
    }
    return result
  }, [cart])

  const pricingBreakdown = useMemo(() => {
    let knownTotal = 0
    let hasUnknown = false
    const rows = programs.flatMap((program) => {
      const items = cartByProgram.get(program.id) ?? []
      if (items.length === 0) return []
      const subtotal = estimateProgramSubtotal(
        program,
        items,
        selectedPricingByProgram[program.id] ?? defaultPricingKey(program),
      )
      if (subtotal.cents == null) hasUnknown = true
      else knownTotal += subtotal.cents
      return [{ program, items, ...subtotal }]
    })
    return { rows, knownTotal, hasUnknown }
  }, [cartByProgram, programs, selectedPricingByProgram])

  useEffect(() => {
    if (cart.length === 0) {
      setDiscountPreview(null)
      setDiscountPreviewLoading(false)
      setDiscountPreviewUnavailable(false)
      return
    }

    let active = true
    setDiscountPreview(null)
    setDiscountPreviewLoading(true)
    setDiscountPreviewUnavailable(false)
    const timer = window.setTimeout(() => {
      void fetchSignupOrderPreview({
        formId: cart[0].schedulingFormId,
        anonymousEstimate: true,
        signups: cart.map((item) => ({
          formId: item.schedulingFormId,
          slotGroupId: item.slotGroupId,
          timeSlotId: item.timeSlotId,
          selectedPricingOptionKey:
            selectedPricingByProgram[item.programsId] ??
            defaultPricingKey(programs.find((program) => program.id === item.programsId)),
        })),
      })
        .then((preview) => {
          if (!active) return
          setDiscountPreview(preview)
          setDiscountPreviewUnavailable(false)
        })
        .catch(() => {
          if (!active) return
          setDiscountPreview(null)
          setDiscountPreviewUnavailable(true)
        })
        .finally(() => {
          if (active) setDiscountPreviewLoading(false)
        })
    }, 200)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [cart, programs, selectedPricingByProgram])

  const multiClassDiscount = useMemo(
    () => summarizeMultiClassDiscount(discountPreview),
    [discountPreview],
  )
  const estimatedTotalAfterDiscount = Math.max(
    0,
    pricingBreakdown.knownTotal - multiClassDiscount.totalCents,
  )

  useEffect(() => {
    savePublicEnrollmentCart(cart.map((item) => ({
      ...item,
      selectedPricingOptionKey:
        selectedPricingByProgram[item.programsId] ??
        defaultPricingKey(programs.find((program) => program.id === item.programsId)!),
    })))
  }, [cart, programs, selectedPricingByProgram])

  const toggleSlot = (
    classItem: CatalogClass,
    key: string,
    checked: boolean,
  ) => {
    const cartKey = `${classItem.classEventId}:${key}`
    if (!checked) {
      setCart((current) => current.filter(
        (item) => `${item.classEventId}:${slotOptionKey(item.slotGroupId, item.timeSlotId)}` !== cartKey,
      ))
      return
    }

    const catalog = catalogs[classItem.classEventId]
    if (!catalog || catalog === 'loading' || catalog === 'error') return
    const option = catalog.scheduleOptions.find(
      (candidate) => slotOptionKey(candidate.slotGroupId, candidate.timeSlotId) === key,
    )
    if (!option) return

    const program = programs.find((candidate) => candidate.id === classItem.programsId)
    if (program && programUsesWeeklyTierPricing(program)) {
      const maxSlots = maxEnabledWeeklySlots(program.pricingCostOptions ?? [])
      const selectedCount = cartByProgram.get(program.id)?.length ?? 0
      if (maxSlots > 0 && selectedCount >= maxSlots) return
    }

    setCart((current) => [
      ...current,
      {
        classEventId: classItem.classEventId,
        programsId: classItem.programsId,
        schedulingFormId: classItem.formId,
        slotGroupId: option.slotGroupId,
        timeSlotId: option.timeSlotId,
        offeringId: option.offeringId ?? undefined,
        programName: classItem.programName,
        className: classItem.label,
        scheduleLabel: option.scheduleLabel,
        priceCents: option.priceCents ?? undefined,
        priceLabel: option.priceLabel ?? undefined,
        classActiveDates: catalog.classActiveDates ?? undefined,
      },
    ])
  }

  const removeCartItem = (item: PublicEnrollmentCartItem) => {
    setCart((current) => current.filter((candidate) => !(
      candidate.classEventId === item.classEventId &&
      candidate.slotGroupId === item.slotGroupId &&
      candidate.timeSlotId === item.timeSlotId
    )))
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSportFilter('all')
    setProgramFilter('all')
    setLevelFilter('all')
  }

  const continueToAccount = () => {
    if (cart.length === 0) return
    const items = cart.map((item) => ({
      ...item,
      selectedPricingOptionKey:
        selectedPricingByProgram[item.programsId] ??
        defaultPricingKey(programs.find((program) => program.id === item.programsId)!),
    }))
    savePublicEnrollmentCart(items)
    trackEvent('begin_checkout', window.location.pathname, {
      properties: { checkout_type: 'public_account_signup', item_count: items.length },
    })
    navigate('/signup/family?source=enroll')
  }

  const hasFilters =
    searchQuery !== '' || sportFilter !== 'all' || programFilter !== 'all' || levelFilter !== 'all'

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 space-y-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <LayoutGrid className="w-7 h-7 text-vortex-red" />
              Browse classes
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Select any available schedules. You will choose the family member for each class while creating your account.
            </p>
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-vortex-red">
              <X className="w-4 h-4" /> Clear
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search classes…" className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex flex-col gap-1 min-w-[10rem] flex-1 sm:max-w-[14rem]">
            <span className="text-xs font-semibold text-gray-600">Sport</span>
            <select value={sportFilter} onChange={(event) => {
              const nextSport = event.target.value
              setSportFilter(nextSport)
              if (programFilter !== 'all') {
                const selected = programs.find((program) => program.id === programFilter)
                if (nextSport !== 'all' && (selected?.primarySportName ?? UNSPECIFIED_SPORT) !== nextSport) setProgramFilter('all')
              }
            }} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm">
              <option value="all">All sports</option>
              {sportOptions.named.map((sport) => <option key={sport} value={sport}>{sport}</option>)}
              {sportOptions.hasUnspecified && <option value={UNSPECIFIED_SPORT}>Unspecified sport</option>}
            </select>
          </label>
          <label className="flex flex-col gap-1 min-w-[10rem] flex-1 sm:max-w-[14rem]">
            <span className="text-xs font-semibold text-gray-600">Program</span>
            <select value={programFilter === 'all' ? 'all' : String(programFilter)} onChange={(event) => setProgramFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm">
              <option value="all">All programs</option>
              {programOptions.map((program) => <option key={program.id} value={program.id}>{program.displayName}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 min-w-[10rem] flex-1 sm:max-w-[14rem]">
            <span className="text-xs font-semibold text-gray-600">Experience level</span>
            <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as ClassSkillLevelFilter)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm">
              {CLASS_SKILL_LEVEL_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {filteredProgramSections.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
          No classes match your search or filters.
        </div>
      )}

      {filteredProgramSections.map(({ program, programClasses }) => {
        const selectedCount = cartByProgram.get(program.id)?.length ?? 0
        const maxSlots = programUsesWeeklyTierPricing(program)
          ? maxEnabledWeeklySlots(program.pricingCostOptions ?? [])
          : 0
        const options = nonWeeklyOptions(program)
        return (
          <div key={program.id} className="rounded-xl border border-vortex-red bg-white p-4 md:p-5 space-y-4 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-vortex-red">{program.displayName}</h2>
              {program.description && <p className="text-sm text-gray-600 mt-1">{program.description}</p>}
              {programUsesWeeklyTierPricing(program) && maxSlots > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {selectedCount > 0 ? `${selectedCount} of ${maxSlots} weekly class slots selected.` : `Select up to ${maxSlots} weekly class slots.`}
                </p>
              )}
            </div>

            {options.length > 1 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pricing option for {program.displayName}</label>
                <select value={selectedPricingByProgram[program.id] ?? options[0].key} onChange={(event) => setSelectedPricingByProgram((current) => ({ ...current, [program.id]: event.target.value as ProgramPricingOptionKey }))} className="w-full sm:w-96 h-10 rounded-lg border border-gray-300 px-3 text-sm bg-white">
                  {options.map((option) => <option key={option.key} value={option.key}>{formatProgramPricingOptionLabel(option)}</option>)}
                </select>
              </div>
            )}

            {programClasses.map((classItem) => {
              const catalog = catalogs[classItem.classEventId]
              const selectedKeys = cart
                .filter((item) => item.classEventId === classItem.classEventId)
                .map((item) => slotOptionKey(item.slotGroupId, item.timeSlotId))
              const focused = classItem.formId === initialFocusedFormId
              return (
                <div key={classItem.classEventId} className={`rounded-xl border bg-gray-50 p-4 space-y-3 ${focused ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'}`}>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{classItem.label}</h3>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>Age: {formatAgeRange(classItem.ageMin, classItem.ageMax)}</span>
                      <span>Level: {formatSkillLevel(classItem.skillLevel)}</span>
                    </div>
                    {classItem.description && <p className="text-sm text-gray-600 mt-1">{classItem.description}</p>}
                  </div>
                  {catalog === 'loading' && <p className="inline-flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading schedule…</p>}
                  {catalog === 'error' && <p className="text-sm text-red-600">Could not load this class&apos;s schedule.</p>}
                  {catalog && catalog !== 'loading' && catalog !== 'error' && (
                    <>
                      {catalog.classActiveDates && <p className="text-sm text-gray-700">Class active dates: <span className="font-medium">{catalog.classActiveDates}</span></p>}
                      {catalog.scheduleOptions.length > 0 ? (
                        <ScheduleOptionCheckboxGrid
                          groups={groupScheduleOptions(catalog.scheduleOptions)}
                          selectedSlotKeys={selectedKeys}
                          onToggle={(key, checked) => toggleSlot(classItem, key, checked)}
                        />
                      ) : (
                        <p className="text-sm text-gray-500">No schedule options are open for this class yet.</p>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {cart.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Selection and price breakdown</h2>
            <p className="text-xs text-gray-500 mt-1">Final pricing is confirmed after the account and athlete details are entered.</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {cart.map((item) => (
              <li key={`${item.classEventId}:${item.slotGroupId}:${item.timeSlotId}`} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{item.className}</p>
                  <p className="text-xs text-gray-600">{item.programName} · {item.scheduleLabel}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {item.priceLabel && <span className="text-xs font-semibold text-vortex-red">{item.priceLabel}</span>}
                  <button type="button" onClick={() => removeCartItem(item)} aria-label={`Remove ${item.className} ${item.scheduleLabel}`} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-200 pt-3 space-y-2">
            {pricingBreakdown.rows.map((row) => (
              <div key={row.program.id} className="flex items-start justify-between gap-4 text-sm">
                <div>
                  <span className="font-semibold text-gray-800">{row.program.displayName}</span>
                  <span className="block text-xs text-gray-500">{row.detail}</span>
                </div>
                <span className="font-semibold text-gray-900">{row.cents == null ? 'To be confirmed' : money(row.cents)}</span>
              </div>
            ))}
            {discountPreviewLoading && (
              <div className="flex items-center justify-between gap-4 text-sm text-gray-500">
                <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating multi-class discount</span>
              </div>
            )}
            {multiClassDiscount.rows.map((row) => (
              <div key={row.ruleId} className="flex items-start justify-between gap-4 text-sm">
                <div>
                  <span className="font-semibold text-green-800">{row.name}</span>
                  {row.qualifiedLabel && <span className="block text-xs text-green-700">{row.qualifiedLabel}</span>}
                  {row.nextTierHint && <span className="block text-xs text-gray-500">{row.nextTierHint}</span>}
                </div>
                <span className="font-semibold text-green-800">−{money(row.amountCents)}</span>
              </div>
            ))}
            {discountPreviewUnavailable && cart.length > 1 && (
              <p className="text-xs text-gray-500">Multi-class savings will be confirmed during account setup.</p>
            )}
            <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-3">
              <span className="font-bold text-gray-900">Estimated total</span>
              <span className="text-lg font-bold text-vortex-red">
                {money(estimatedTotalAfterDiscount)}{pricingBreakdown.hasUnknown ? ' + pending prices' : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 md:-mx-6 border-t border-gray-200 bg-white/95 backdrop-blur px-4 md:px-6 py-3 flex items-center justify-between gap-3 shadow-[0_-8px_20px_rgba(0,0,0,0.06)]">
        <span className="text-sm text-gray-600">{cart.length} {cart.length === 1 ? 'class time' : 'class times'} selected</span>
        <button type="button" onClick={continueToAccount} disabled={cart.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          <ShoppingCart className="w-4 h-4" /> Continue to account setup
        </button>
      </div>
    </div>
  )
}
