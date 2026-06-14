import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, CheckCircle, Clock, Loader2, Plus, Trash2, Users, X } from 'lucide-react'
import {
  getSignupFieldDef,
  isParentFieldLockedByWaiver,
  type SchedulingSignupFieldDef,
} from '../config/schedulingSignupFields'
import SchoolAutocompleteInput from './scheduling/SchoolAutocompleteInput'
import {
  checkSchedulingEmail,
  fetchMySchedulingSignups,
  fetchProgramSignupOptions,
  fetchPublicSchedulingForm,
  formatSchedulingOccurrenceLabel,
  getSchedulingMemberEmail,
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
  type SchedulingSignup,
  type SchedulingSignupCompleteDetail,
  type SchedulingSlotGroup,
  type SchedulingTimeSlot,
} from '../utils/schedulingApi'

function formatTimeLabel(time: string) {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function bookableGroupsForCategory(
  detail: SchedulingFormDetail,
  catId: number | null,
): SchedulingSlotGroup[] {
  return (detail.slotGroups ?? []).filter(
    (group) => (group.categoryId ?? null) === catId,
  )
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
): SlotPickOption[] {
  return bookableGroupsForCategory(detail, catId).flatMap((group) =>
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

type IdentityPhase = 'pending' | 'email' | 'login' | 'ready'
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

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`
}

interface Props {
  formId: number
  compact?: boolean
  fromEvent?: boolean
  initialAuthToken?: string | null
  initialEmail?: string | null
  onSignupComplete?: (detail: SchedulingSignupCompleteDetail) => void
}

const SchedulingSignupEmbed = ({
  formId,
  compact = false,
  fromEvent = false,
  initialAuthToken = null,
  initialEmail = null,
  onSignupComplete,
}: Props) => {
  const [formDetail, setFormDetail] = useState<SchedulingFormDetail | null>(null)
  const [categoryId, setCategoryId] = useState<number | null | undefined>(undefined)
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
  const [browseCategoryKey, setBrowseCategoryKey] = useState<string>('')
  const [signedUpSlotKeys, setSignedUpSlotKeys] = useState<Set<string>>(new Set())
  const [signupResults, setSignupResults] = useState<SchedulingSignup[]>([])
  const [signupResult, setSignupResult] = useState<SchedulingSignup | null>(null)
  const [identityPhase, setIdentityPhase] = useState<IdentityPhase>('pending')
  const [accountEmail, setAccountEmail] = useState(initialEmail || '')
  const [accountPassword, setAccountPassword] = useState('')
  const [newAccountPassword, setNewAccountPassword] = useState('')
  const [signupAuthToken, setSignupAuthToken] = useState<string | null>(null)
  const [isNewUser, setIsNewUser] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [identityLoading, setIdentityLoading] = useState(false)
  const skipAutoSlotRef = useRef(false)
  const prevCategoryIdRef = useRef<number | null | undefined>(undefined)

  useEffect(() => {
    prevCategoryIdRef.current = undefined
    skipAutoSlotRef.current = false
    setLoading(true)
    setCategoryId(undefined)
    setSlotGroupId(null)
    setTimeSlotId(null)
    setResponses({})
    setSuccess(false)
    setSignupPhase('select')
    setCartItems([])
    setProgramOptions([])
    setSelectedSlots({})
    setBrowseCategoryKey('')
    setSignedUpSlotKeys(new Set())
    setSignupResults([])
    setSignupResult(null)
    setError(null)
    setIdentityPhase('pending')
    setSignupAuthToken(null)
    setIsNewUser(false)
    setAccountEmail(initialEmail || '')
    setAccountPassword('')
    setNewAccountPassword('')
    setMagicLinkSent(false)
    fetchPublicSchedulingForm(formId, undefined, { fromEvent })
      .then((detail) => {
        setFormDetail(detail)
        const bookable = getBookableCategories(detail)
        if (bookable.length === 1) {
          setCategoryId(bookable[0].id ?? null)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load form'))
      .finally(() => setLoading(false))
  }, [formId, fromEvent])

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
        void loadSignedUpSlots(session.email)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Invalid sign-in link'))
      .finally(() => setIdentityLoading(false))
  }, [formId, initialAuthToken, initialEmail])

  const loadSignedUpSlots = useCallback(async (email: string) => {
    try {
      const signups = await fetchMySchedulingSignups(email)
      setSignedUpSlotKeys(new Set(signups.map((s) => memberSignupSlotKey(s))))
    } catch {
      setSignedUpSlotKeys(new Set())
    }
  }, [])

  useEffect(() => {
    const email =
      accountEmail.trim() ||
      initialEmail?.trim() ||
      getSchedulingMemberEmail()?.trim().toLowerCase() ||
      ''
    if (email) void loadSignedUpSlots(email)
  }, [accountEmail, initialEmail, identityPhase, loadSignedUpSlots])

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

  const bookableGroups: SchedulingSlotGroup[] = useMemo(() => {
    if (!formDetail || categoryId === undefined) return []
    return bookableGroupsForCategory(formDetail, categoryId)
  }, [formDetail, categoryId])

  const slotOptions = useMemo(() => {
    if (!formDetail || categoryId === undefined) return []
    return slotOptionsForCategory(formDetail, categoryId)
  }, [formDetail, categoryId])

  useEffect(() => {
    if (categoryId === undefined || !formDetail) return

    const categoryChanged = prevCategoryIdRef.current !== categoryId
    prevCategoryIdRef.current = categoryId

    if (skipAutoSlotRef.current) {
      skipAutoSlotRef.current = false
      return
    }

    if (categoryChanged && slotOptions.length === 1) {
      const only = slotOptions[0]
      const signedUp =
        formDetail &&
        isSlotAlreadySignedUp(formDetail.id, categoryId ?? null, only.slotGroupId, only.timeSlotId)
      if (!signedUp) {
        setSlotGroupId(only.slotGroupId)
        setTimeSlotId(only.timeSlotId)
      }
    } else if (categoryChanged) {
      setSlotGroupId(null)
      setTimeSlotId(null)
    }
  }, [categoryId, formDetail, slotOptions, isSlotAlreadySignedUp])

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
    setCategoryId(catId)
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
      setIdentityPhase('ready')
      setIsNewUser(false)
      void loadSignedUpSlots(accountEmail.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
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
    if (!formDetail || categoryId === undefined || !slotGroupId || !timeSlotId || identityPhase !== 'ready') {
      setProgramOptions([])
      return
    }

    const email = accountEmail.trim() || initialEmail?.trim() || ''
    setProgramOptionsLoading(true)
    fetchProgramSignupOptions(formId, {
      email: email || undefined,
    })
      .then((data) => {
        setProgramOptions(data.options)
        const fromApi = collectSignedUpSlotKeysFromOptions(data.options)
        if (fromApi.size > 0) {
          setSignedUpSlotKeys((prev) => new Set([...prev, ...fromApi]))
        }
      })
      .catch(() => setProgramOptions([]))
      .finally(() => setProgramOptionsLoading(false))
  }, [formDetail, formId, categoryId, slotGroupId, timeSlotId, identityPhase, accountEmail, initialEmail])

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

  useEffect(() => {
    if (otherCategoryBundles.length === 0) {
      setBrowseCategoryKey('')
      return
    }
    if (!browseCategoryKey || !otherCategoryBundles.some((b) => b.key === browseCategoryKey)) {
      setBrowseCategoryKey(otherCategoryBundles[0].key)
    }
  }, [otherCategoryBundles, browseCategoryKey])

  const browseCategoryBundle = useMemo(
    () => otherCategoryBundles.find((b) => b.key === browseCategoryKey) ?? null,
    [otherCategoryBundles, browseCategoryKey],
  )

  const selectedSlotList = useMemo(() => Object.values(selectedSlots), [selectedSlots])

  useEffect(() => {
    if (!formDetail || categoryId === undefined || !slotGroupId || !timeSlotId) return
    if (
      isSlotAlreadySignedUp(formDetail.id, categoryId ?? null, slotGroupId, timeSlotId)
    ) {
      return
    }
    const bundle = currentCategoryBundle
    const slot = bundle?.slots.find(
      (s) => s.slotGroupId === slotGroupId && s.timeSlotId === timeSlotId,
    )
    if (!bundle || !slot) return
    const slotKey = slotSelectionKey(
      bundle.formId,
      bundle.categoryId,
      slotGroupId,
      timeSlotId,
    )
    setSelectedSlots((prev) => {
      if (prev[slotKey]) return prev
      return {
        ...prev,
        [slotKey]: {
          key: slotKey,
          formId: bundle.formId,
          formTitle: bundle.formTitle,
          categoryId: bundle.categoryId,
          categoryName: bundle.categoryName,
          slotGroupId,
          timeSlotId,
          slotLabel: slot.label,
          isFull: slot.isFull,
        },
      }
    })
  }, [
    formDetail,
    categoryId,
    slotGroupId,
    timeSlotId,
    currentCategoryBundle,
    isSlotAlreadySignedUp,
  ])

  const sectionClass = compact
    ? 'bg-white rounded-xl border border-gray-200 p-4 shadow-sm'
    : 'bg-white rounded-2xl border border-gray-200 p-6 shadow-sm'

  const slotSelected = categoryId !== undefined && slotGroupId !== null && timeSlotId !== null
  const identityReady = identityPhase === 'ready'
  const showCategoryPick = bookableCategories.length > 1 && categoryId === undefined
  const showSlotPick = categoryId !== undefined && timeSlotId === null && slotOptions.length > 0
  const showEmailStep = slotSelected && identityPhase === 'email'
  const showLoginStep = slotSelected && identityPhase === 'login'
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

  const selectedGroup = useMemo(
    () => bookableGroups.find((g) => g.id === slotGroupId) ?? null,
    [bookableGroups, slotGroupId],
  )

  const selectedOccurrence = useMemo(
    () => slotOptions.find((o) => o.timeSlotId === timeSlotId)?.occurrence ?? null,
    [slotOptions, timeSlotId],
  )

  const buildCartItems = (): SignupCartItem[] => Object.values(selectedSlots)

  const slotConflictsWithSelected = (
    slot: ProgramClassSlotOption,
    bundle: ProgramClassOption,
  ): boolean => {
    const thisKey = slotSelectionKey(
      bundle.formId,
      bundle.categoryId,
      slot.slotGroupId,
      slot.timeSlotId,
    )
    for (const item of selectedSlotList) {
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

  const slotConflictsWithEnrolled = (
    slot: ProgramClassSlotOption,
    bundle: ProgramClassOption,
  ): boolean => {
    for (const catBundle of categoryBundles) {
      for (const enrolled of catBundle.slots) {
        const enrolledKey = slotSelectionKey(
          catBundle.formId,
          catBundle.categoryId,
          enrolled.slotGroupId,
          enrolled.timeSlotId,
        )
        const isEnrolled =
          enrolled.alreadySignedUp ||
          isSlotAlreadySignedUp(
            catBundle.formId,
            catBundle.categoryId,
            enrolled.slotGroupId,
            enrolled.timeSlotId,
          )
        if (!isEnrolled) continue
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

  const toggleCategorySlot = (
    bundle: ProgramClassOption,
    slot: ProgramClassSlotOption,
    checked: boolean,
  ) => {
    const isEnrolled =
      slot.alreadySignedUp ||
      isSlotAlreadySignedUp(
        bundle.formId,
        bundle.categoryId,
        slot.slotGroupId,
        slot.timeSlotId,
      )
    if (isEnrolled) return

    const slotKey = slotSelectionKey(
      bundle.formId,
      bundle.categoryId,
      slot.slotGroupId,
      slot.timeSlotId,
    )

    if (checked) {
      if (slotConflictsWithSelected(slot, bundle) || slotConflictsWithEnrolled(slot, bundle)) {
        return
      }
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
      if (bundle.formId === formDetail?.id && bundle.categoryId === categoryId) {
        setSlotGroupId(slot.slotGroupId)
        setTimeSlotId(slot.timeSlotId)
      }
      return
    }

    if (Object.keys(selectedSlots).length <= 1 && selectedSlots[slotKey]) {
      setError('At least one class time must remain selected')
      return
    }
    setError(null)
    setSelectedSlots((prev) => {
      const next = { ...prev }
      delete next[slotKey]
      if (bundle.formId === formDetail?.id && bundle.categoryId === categoryId) {
        const remaining = Object.values(next)
        const sameCategory = remaining.find(
          (item) =>
            item.formId === formDetail?.id && (item.categoryId ?? null) === (categoryId ?? null),
        )
        if (sameCategory) {
          setSlotGroupId(sameCategory.slotGroupId)
          setTimeSlotId(sameCategory.timeSlotId)
        } else if (remaining[0]) {
          setSlotGroupId(remaining[0].slotGroupId)
          setTimeSlotId(remaining[0].timeSlotId)
          if (remaining[0].formId === formDetail?.id) {
            setCategoryId(remaining[0].categoryId)
          }
        } else {
          setSlotGroupId(null)
          setTimeSlotId(null)
        }
      }
      return next
    })
  }

  const renderCategorySlotList = (bundle: ProgramClassOption) => {
    return (
      <ul className="space-y-2">
        {bundle.slots.map((slot) => {
          const slotKey = slotSelectionKey(
            bundle.formId,
            bundle.categoryId,
            slot.slotGroupId,
            slot.timeSlotId,
          )
          const isAlreadySignedUp =
            slot.alreadySignedUp ||
            isSlotAlreadySignedUp(
              bundle.formId,
              bundle.categoryId,
              slot.slotGroupId,
              slot.timeSlotId,
            )
          const isSelected = Boolean(selectedSlots[slotKey])
          const isChecked = isAlreadySignedUp || isSelected
          const hasConflict =
            !isChecked &&
            (slotConflictsWithSelected(slot, bundle) || slotConflictsWithEnrolled(slot, bundle))
          const inputId = `slot-${slotKey}`

          return (
            <li key={inputId}>
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
                  onChange={(e) => toggleCategorySlot(bundle, slot, e.target.checked)}
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
        })}
      </ul>
    )
  }

  const handleGoToReview = () => {
    if (!formDetail || categoryId === undefined || !slotGroupId || !timeSlotId) return
    if (identityPhase !== 'ready') return
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
    setCartItems(buildCartItems())
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
      })
      setSignupResults(result.signups)
      setSignupResult(result.signups[0] ?? null)
      setSuccess(true)
      const email = accountEmail.trim() || initialEmail?.trim() || ''
      if (email) void loadSignedUpSlots(email)
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
        {signupResult?.pricing?.hasPricing && (
          <div className="mt-4 text-left rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
            <p className="font-semibold text-black mb-2">Monthly cost summary</p>
            {signupResult.categoryName && signupResult.slotLabel && (
              <p className="mb-2 text-gray-600">
                Slot: {signupResult.categoryName} — {signupResult.slotLabel}
              </p>
            )}
            <ul className="space-y-1">
              <li>Slots held: {signupResult.pricing.totalSlots}</li>
              {signupResult.pricing.hasFreeSlots && (
                <li>Free slots remaining: {signupResult.pricing.freeSlotsRemaining}</li>
              )}
              <li>Non-discounted total: {formatMoney(signupResult.pricing.nonDiscountedMonthly)}/mo</li>
              {signupResult.pricing.discountMonthly > 0 && (
                <li>Discount: -{formatMoney(signupResult.pricing.discountMonthly)}/mo</li>
              )}
              <li className="font-semibold text-black">
                Your total: {formatMoney(signupResult.pricing.discountedMonthly)}/mo
              </li>
            </ul>
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
                {cartItems.map((item) => (
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
                ))}
              </ul>
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
              Choose a category
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bookableCategories.map((cat) => (
                <button
                  key={cat.id ?? 'none'}
                  type="button"
                  onClick={() => handleCategorySelect(cat.id ?? null)}
                  className="text-left rounded-xl border-2 p-3 border-gray-200 hover:border-gray-400 transition-all"
                >
                  <span className="font-bold text-black block text-sm">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showSlotPick && (
          <div className={sectionClass}>
            {selectedCategoryName && bookableCategories.length > 1 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 mb-3">
                <span>
                  Category: <span className="font-semibold text-black">{selectedCategoryName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryId(undefined)
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
              Choose your time
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

        {categoryId !== undefined && slotOptions.length === 0 && (
          <div className={`${sectionClass} text-sm text-gray-600`}>
            No available times for this category.
            {bookableCategories.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setCategoryId(undefined)
                  setSlotGroupId(null)
                  setIdentityPhase('pending')
                }}
                className="ml-2 text-vortex-red font-semibold hover:underline"
              >
                Choose another category
              </button>
            )}
          </div>
        )}

        {slotSelected && selectedGroup && selectedOccurrence && !showCategoryPick && !showSlotPick && (
          <div className={`${sectionClass} text-sm text-gray-700`}>
            <span className="font-semibold text-black">Selected slot: </span>
            {selectedCategoryName && <span>{selectedCategoryName} — </span>}
            <span>
              {formatSchedulingOccurrenceLabel(selectedOccurrence, {
                includeWeek: showWeekInLabels,
                formatTime: formatTimeLabel,
              })}
            </span>
            {!signupAuthToken && identityPhase !== 'ready' && (
              <span className="block sm:inline mt-2 sm:mt-0">
                <button
                  type="button"
                  onClick={() => {
                    skipAutoSlotRef.current = true
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
                    {renderCategorySlotList(currentCategoryBundle)}
                  </div>
                )}

                {otherCategoryBundles.length > 0 && (
                  <div>
                    <label
                      htmlFor="browse-category-select"
                      className="block text-sm font-semibold text-black mb-2"
                    >
                      Other category
                    </label>
                    <select
                      id="browse-category-select"
                      value={browseCategoryKey}
                      onChange={(e) => setBrowseCategoryKey(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-4"
                    >
                      {otherCategoryBundles.map((bundle) => (
                        <option key={bundle.key} value={bundle.key}>
                          {bundle.formTitle !== formDetail.title
                            ? `${bundle.formTitle} — ${bundle.categoryName}`
                            : bundle.categoryName}
                        </option>
                      ))}
                    </select>
                    {browseCategoryBundle && (
                      <div>
                        <p className="text-sm font-semibold text-black mb-3">
                          {browseCategoryBundle.formTitle !== formDetail.title
                            ? `${browseCategoryBundle.formTitle} — ${browseCategoryBundle.categoryName}`
                            : browseCategoryBundle.categoryName}
                        </p>
                        {renderCategorySlotList(browseCategoryBundle)}
                      </div>
                    )}
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
