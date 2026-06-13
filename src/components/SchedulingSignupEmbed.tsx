import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, CheckCircle, Clock, Loader2, Plus, Trash2, Users, X } from 'lucide-react'
import {
  getSignupFieldDef,
  isParentFieldLockedByWaiver,
  type SchedulingSignupFieldDef,
} from '../config/schedulingSignupFields'
import {
  checkSchedulingEmail,
  fetchPublicSchedulingForm,
  formatSchedulingOccurrenceLabel,
  loginSchedulingAuth,
  requestSchedulingMagicLink,
  schedulingHasMultipleWeeks,
  submitSchedulingSignup,
  verifySchedulingAuthToken,
  type SchedulingFormCategory,
  type SchedulingFormDetail,
  type SchedulingSignup,
  type SchedulingSlotGroup,
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

function getBookableCategories(detail: SchedulingFormDetail): SchedulingFormCategory[] {
  return detail.categories.filter((cat) =>
    bookableGroupsForCategory(detail, cat.id ?? null).length > 0,
  )
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

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`
}

interface Props {
  formId: number
  compact?: boolean
  fromEvent?: boolean
  initialAuthToken?: string | null
  initialEmail?: string | null
}

const SchedulingSignupEmbed = ({
  formId,
  compact = false,
  fromEvent = false,
  initialAuthToken = null,
  initialEmail = null,
}: Props) => {
  const [formDetail, setFormDetail] = useState<SchedulingFormDetail | null>(null)
  const [categoryId, setCategoryId] = useState<number | null | undefined>(undefined)
  const [slotGroupId, setSlotGroupId] = useState<number | null>(null)
  const [responses, setResponses] = useState<Record<string, string | string[]>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
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
    setResponses({})
    setSuccess(false)
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
    if (!initialAuthToken || !initialEmail) return
    setIdentityLoading(true)
    verifySchedulingAuthToken(formId, initialEmail, initialAuthToken)
      .then((session) => {
        setSignupAuthToken(session.signupAuthToken)
        setAccountEmail(session.email)
        setIdentityPhase('ready')
        setIsNewUser(false)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Invalid sign-in link'))
      .finally(() => setIdentityLoading(false))
  }, [formId, initialAuthToken, initialEmail])

  const bookableCategories = useMemo(
    () => (formDetail ? getBookableCategories(formDetail) : []),
    [formDetail],
  )

  const bookableGroups: SchedulingSlotGroup[] = useMemo(() => {
    if (!formDetail || categoryId === undefined) return []
    return bookableGroupsForCategory(formDetail, categoryId)
  }, [formDetail, categoryId])

  useEffect(() => {
    if (categoryId === undefined || !formDetail) return

    const categoryChanged = prevCategoryIdRef.current !== categoryId
    prevCategoryIdRef.current = categoryId

    if (skipAutoSlotRef.current) {
      skipAutoSlotRef.current = false
      return
    }

    if (categoryChanged && bookableGroups.length === 1) {
      setSlotGroupId(bookableGroups[0].id)
    } else if (categoryChanged) {
      setSlotGroupId(null)
    }
  }, [categoryId, formDetail, bookableGroups])

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
    setCategoryId(catId)
    if (!signupAuthToken) {
      setIdentityPhase('pending')
      setIsNewUser(false)
      setMagicLinkSent(false)
    }
  }

  const handleSlotSelect = (groupId: number) => {
    setSlotGroupId(groupId)
    if (!signupAuthToken && identityPhase !== 'ready') {
      setIdentityPhase('email')
      setIsNewUser(false)
      setMagicLinkSent(false)
    }
  }

  useEffect(() => {
    if (slotGroupId == null || signupAuthToken || identityPhase === 'ready' || identityPhase === 'login') {
      return
    }
    if (identityPhase === 'pending') {
      setIdentityPhase('email')
    }
  }, [slotGroupId, signupAuthToken, identityPhase])

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
      setSignupAuthToken(session.signupAuthToken)
      setIdentityPhase('ready')
      setIsNewUser(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formDetail || categoryId === undefined || !slotGroupId) return
    if (identityPhase !== 'ready') return
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
        if (!newAccountPassword || newAccountPassword.length < 6) {
          throw new Error('Account password must be at least 6 characters')
        }
      }
      const result = await submitSchedulingSignup({
        formId: formDetail.id,
        categoryId,
        slotGroupId,
        responses: isNewUser ? payload : { email: accountEmail.trim() },
        signupAuthToken: signupAuthToken || undefined,
        password: isNewUser ? newAccountPassword : undefined,
      })
      setSignupResult(result)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setSubmitting(false)
    }
  }

  const sectionClass = compact
    ? 'bg-white rounded-xl border border-gray-200 p-4 shadow-sm'
    : 'bg-white rounded-2xl border border-gray-200 p-6 shadow-sm'

  const slotSelected = categoryId !== undefined && slotGroupId !== null
  const identityReady = identityPhase === 'ready'
  const showCategoryPick = bookableCategories.length > 1 && categoryId === undefined
  const showSlotPick = categoryId !== undefined && slotGroupId === null && bookableGroups.length > 0
  const showEmailStep = slotSelected && identityPhase === 'email'
  const showLoginStep = slotSelected && identityPhase === 'login'
  const showNewUserForm = slotSelected && identityReady && isNewUser
  const showSubmit = slotSelected && identityReady

  const selectedCategoryName = useMemo(() => {
    if (categoryId === undefined || !formDetail) return null
    return formDetail.categories.find((c) => (c.id ?? null) === categoryId)?.name ?? null
  }, [categoryId, formDetail])

  const selectedGroup = useMemo(
    () => bookableGroups.find((g) => g.id === slotGroupId) ?? null,
    [bookableGroups, slotGroupId],
  )

  if (loading && !formDetail) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-vortex-red" />
      </div>
    )
  }

  if (success) {
    const isWaitlisted = signupResult?.status === 'waitlisted'
    const positionText =
      isWaitlisted && signupResult?.waitlistPosition != null
        ? `You are #${signupResult.waitlistPosition} on the waitlist`
        : signupResult?.signupNumber != null && signupResult?.maxParticipants != null
          ? `You are number ${signupResult.signupNumber} of ${signupResult.maxParticipants}`
          : null

    return (
      <div className={`${sectionClass} text-center`}>
        <CheckCircle className={`w-12 h-12 mx-auto mb-4 ${isWaitlisted ? 'text-amber-600' : 'text-green-600'}`} />
        <h4 className="text-xl font-display font-bold text-black mb-2">
          {isWaitlisted ? "You're on the waitlist!" : "You're signed up!"}
        </h4>
        {positionText && (
          <p className="text-lg font-semibold text-black mb-2">{positionText}</p>
        )}
        <p className="text-gray-600 text-sm">
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
              {bookableGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSlotSelect(group.id)}
                  className={`text-left rounded-xl border-2 p-3 transition-all ${
                    slotGroupId === group.id
                      ? 'border-vortex-red bg-red-50'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <div className="space-y-1">
                    {group.occurrences.map((occ) => (
                      <div key={occ.id} className="flex items-center gap-2 font-bold text-black text-sm">
                        <Clock className="w-4 h-4 text-vortex-red shrink-0" />
                        {formatSchedulingOccurrenceLabel(occ, {
                          includeWeek: showWeekInLabels,
                          formatTime: formatTimeLabel,
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                    <Users className="w-4 h-4" />
                    {group.isFull
                      ? `Full — join waitlist${(group.waitlistCount ?? 0) > 0 ? ` (${group.waitlistCount} waiting)` : ''}`
                      : `${group.spotsRemaining} of ${group.maxParticipants} spots left`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {categoryId !== undefined && bookableGroups.length === 0 && (
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

        {slotSelected && selectedGroup && !showCategoryPick && !showSlotPick && (
          <div className={`${sectionClass} text-sm text-gray-700`}>
            <span className="font-semibold text-black">Selected slot: </span>
            {selectedCategoryName && <span>{selectedCategoryName} — </span>}
            {selectedGroup.occurrences.map((occ) => (
              <span key={occ.id} className="block sm:inline">
                {formatSchedulingOccurrenceLabel(occ, {
                  includeWeek: showWeekInLabels,
                  formatTime: formatTimeLabel,
                })}
              </span>
            ))}
            {!signupAuthToken && identityPhase !== 'ready' && (
              <span className="block sm:inline mt-2 sm:mt-0">
                <button
                  type="button"
                  onClick={() => {
                    skipAutoSlotRef.current = true
                    setSlotGroupId(null)
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
            {selectedGroup?.isFull ? 'Join waitlist' : 'Confirm signup'}
          </button>
        )}
      </form>
    </div>
  )
}

export default SchedulingSignupEmbed
