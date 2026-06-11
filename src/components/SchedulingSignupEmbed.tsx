import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, CheckCircle, Clock, Loader2, Plus, Trash2, Users, X } from 'lucide-react'
import {
  getSignupFieldDef,
  isParentFieldLockedByWaiver,
  type SchedulingSignupFieldDef,
} from '../config/schedulingSignupFields'
import {
  fetchPublicSchedulingForm,
  formatSchedulingOccurrenceLabel,
  schedulingHasMultipleWeeks,
  submitSchedulingSignup,
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

interface Props {
  formId: number
  compact?: boolean
  fromEvent?: boolean
}

const SchedulingSignupEmbed = ({ formId, compact = false, fromEvent = false }: Props) => {
  const [formDetail, setFormDetail] = useState<SchedulingFormDetail | null>(null)
  const [categoryId, setCategoryId] = useState<number | null | undefined>(undefined)
  const [slotGroupId, setSlotGroupId] = useState<number | null>(null)
  const [responses, setResponses] = useState<Record<string, string | string[]>>({})
  const [loading, setLoading] = useState(true)
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [signupResult, setSignupResult] = useState<SchedulingSignup | null>(null)
  const manualCategoryPickRef = useRef(false)

  useEffect(() => {
    manualCategoryPickRef.current = false
    setLoading(true)
    setCategoryId(undefined)
    setSlotGroupId(null)
    setResponses({})
    setSuccess(false)
    setSignupResult(null)
    setError(null)
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
    if (!manualCategoryPickRef.current || categoryId === undefined) return
    setCategoryLoading(true)
    fetchPublicSchedulingForm(formId, categoryId, { fromEvent })
      .then(setFormDetail)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load form'))
      .finally(() => {
        setCategoryLoading(false)
        manualCategoryPickRef.current = false
      })
    setSlotGroupId(null)
  }, [formId, categoryId, fromEvent])

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
    if (bookableGroups.length === 1) {
      setSlotGroupId(bookableGroups[0].id)
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
    manualCategoryPickRef.current = true
    setSlotGroupId(null)
    setCategoryId(catId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formDetail || categoryId === undefined || !slotGroupId) return
    setSubmitting(true)
    setError(null)
    try {
      const payload: Record<string, string | boolean | number | string[]> = {}
      for (const field of enabledFields) {
        const raw = responses[field.key]
        if (field.type === 'email_list') {
          const list = (Array.isArray(raw) ? raw : []).map((s) => s.trim()).filter(Boolean)
          if (list.length > 0) payload[field.key] = list
        } else if (raw != null && String(raw).trim() !== '') {
          payload[field.key] = field.type === 'number' ? Number(raw) : String(raw).trim()
        }
      }
      const result = await submitSchedulingSignup({
        formId: formDetail.id,
        categoryId,
        slotGroupId,
        responses: payload,
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

  const showCategoryPick = bookableCategories.length > 1 && categoryId === undefined
  const showSlotPick =
    categoryId !== undefined && bookableGroups.length > 1 && slotGroupId === null
  const showSignup = categoryId !== undefined && slotGroupId !== null

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

        {categoryLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-vortex-red" />
          </div>
        )}

        {!categoryLoading && showSlotPick && (
          <div className={sectionClass}>
            {selectedCategoryName && bookableCategories.length > 1 && (
              <p className="text-sm text-gray-600 mb-3">
                Category: <span className="font-semibold text-black">{selectedCategoryName}</span>
              </p>
            )}
            <h4 className={`font-bold text-black mb-3 ${compact ? 'text-base' : 'text-xl'}`}>
              Choose your time
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bookableGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSlotGroupId(group.id)}
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

        {!categoryLoading && categoryId !== undefined && bookableGroups.length === 0 && (
          <div className={`${sectionClass} text-sm text-gray-600`}>
            No available times for this category.
          </div>
        )}

        {!categoryLoading && showSignup && (
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
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 flex justify-between text-sm">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {!categoryLoading && showSignup && (
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
