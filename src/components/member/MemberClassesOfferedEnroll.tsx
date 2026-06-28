import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle, Loader2, ShoppingCart } from 'lucide-react'
import type { PublicProgramOffered } from '../../utils/publicClassesApi'
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
  onEnrolled: () => void
}

interface CartItem {
  cartKey: string
  classEventId: number
  formId: number
  slotGroupId: number
  timeSlotId: number
  classLabel: string
  scheduleLabel: string
  priceLabel: string | null
}

type CatalogState = SignupClassCatalog | 'loading' | 'error'

export default function MemberClassesOfferedEnroll({
  apiUrl,
  memberToken,
  programs,
  members,
  defaultMemberId,
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

  const classesWithForm = useMemo(() => {
    const out: Array<{ classEventId: number; formId: number; label: string; description: string | null; programName: string }> = []
    for (const program of programs) {
      for (const cls of program.classes) {
        if (cls.formId != null) {
          out.push({
            classEventId: cls.id,
            formId: cls.formId,
            label: cls.displayName,
            description: cls.description,
            programName: program.displayName,
          })
        }
      }
    }
    return out
  }, [programs])

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
    const catalog = catalogs[classEventId]
    if (!catalog || catalog === 'loading' || catalog === 'error') return
    const opt = catalog.scheduleOptions.find(
      (o) => slotOptionKey(o.slotGroupId, o.timeSlotId) === key,
    )
    if (!opt) return
    setCart((prev) => [
      ...prev,
      {
        cartKey,
        classEventId,
        formId,
        slotGroupId: opt.slotGroupId,
        timeSlotId: opt.timeSlotId,
        classLabel,
        scheduleLabel: opt.scheduleLabel,
        priceLabel: opt.priceLabel,
      },
    ])
  }

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
        const firstForm = cart[0].formId
        const session = await loginSchedulingAuthFromMemberSession(
          firstForm,
          memberToken,
          selectedMemberId,
        )
        const result = await fetchSignupOrderPreview({
          formId: firstForm,
          signupAuthToken: session.signupAuthToken,
          signups: cart.map((c) => ({
            formId: c.formId,
            slotGroupId: c.slotGroupId,
            timeSlotId: c.timeSlotId,
          })),
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
    [cart, memberToken, selectedMemberId],
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
      // The signup auth token is form-scoped, so submit one batch per form.
      const byForm = new Map<number, CartItem[]>()
      for (const item of cart) {
        const list = byForm.get(item.formId) ?? []
        list.push(item)
        byForm.set(item.formId, list)
      }
      let total = 0
      for (const [formId, items] of byForm) {
        const session = await loginSchedulingAuthFromMemberSession(
          formId,
          memberToken,
          selectedMemberId,
        )
        const result = await submitSchedulingSignupBatch({
          signups: items.map((c) => ({
            formId: c.formId,
            slotGroupId: c.slotGroupId,
            timeSlotId: c.timeSlotId,
          })),
          responses: {},
          signupAuthToken: session.signupAuthToken,
          promoCodes,
        })
        total += result.signups.length
      }
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
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Selected classes ({cart.length})</h3>
          <ul className="space-y-2">
            {cart.map((item) => (
              <li
                key={item.cartKey}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{item.classLabel}</p>
                  <p className="text-gray-600">{item.scheduleLabel}</p>
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
            <p className="text-xs text-gray-500">
              These are your real monthly prices. Final billing posts to your family account.
            </p>
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
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <label className="block text-xs font-semibold text-gray-600 mb-1">Enroll athlete</label>
        <select
          value={selectedMemberId}
          onChange={(e) => setSelectedMemberId(Number(e.target.value))}
          className="w-full sm:w-72 h-10 rounded-lg border border-gray-300 px-3 text-sm"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {classesWithForm.length === 0 && (
        <p className="text-sm text-gray-500">No classes are available to enroll in right now.</p>
      )}

      <div className="space-y-6">
        {classesWithForm.map((cls) => {
          const catalog = catalogs[cls.classEventId]
          const selectedKeysForClass = cart
            .filter((c) => c.classEventId === cls.classEventId)
            .map((c) => slotOptionKey(c.slotGroupId, c.timeSlotId))
          return (
            <div
              key={cls.classEventId}
              className="rounded-xl border border-gray-200 p-4 space-y-3"
            >
              <div>
                <h3 className="text-base font-bold text-gray-900">{cls.label}</h3>
                <p className="text-xs text-gray-500">{cls.programName}</p>
                {cls.description && (
                  <p className="text-sm text-gray-600 mt-1">{cls.description}</p>
                )}
              </div>

              {catalog === 'loading' && (
                <p className="text-sm text-gray-500">Loading schedule…</p>
              )}
              {catalog === 'error' && (
                <p className="text-sm text-red-600">Could not load this class's schedule.</p>
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

      <div className="sticky bottom-0 -mx-4 md:-mx-6 border-t border-gray-200 bg-white px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <span className="text-sm text-gray-600">
          {cart.length} {cart.length === 1 ? 'class' : 'classes'} selected
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
