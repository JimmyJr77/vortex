import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react'
import FamilySignupWizard from '../signup/FamilySignupWizard'
import DateOfBirthInput from '../DateOfBirthInput'
import WaiverSigningBlock from '../signup/WaiverSigningBlock'
import {
  validateWaiverSigning,
  type PublicWaiverTemplate,
} from '../signup/waiverSigningUtils'
import Login from '../Login'
import { getApiUrl } from '../../utils/api'
import {
  persistMemberSession,
  type PortalAccount,
} from '../../utils/portalSession'
import {
  confirmAnnualMembershipCheckoutSession,
  createAnnualMembershipCheckoutSession,
  fetchAnnualMembershipOffer,
  previewAnnualMembershipCheckout,
  type AnnualMembershipOffer,
  type AnnualMembershipPreview,
} from '../../utils/schedulingApi'

type Phase =
  | 'loading'
  | 'guest-entry'
  | 'guest-register'
  | 'ask-register-more'
  | 'add-members'
  | 'sign-waivers'
  | 'membership-upsell'
  | 'thank-you'

type ThankYouKind = 'waivers-only' | 'membership-paid' | 'membership-declined'

interface FamilyMemberRow {
  id: number
  firstName: string
  lastName: string
  dateOfBirth?: string | null
}

interface AthleteMembershipRow {
  member: FamilyMemberRow
  offer: AnnualMembershipOffer | null
}

const MEMBERSHIP_BENEFITS = [
  'Free drop-in classes ($200 value)',
  'Discounts on follow-on drop-ins and block purchases',
  'Free $25 Vortex t-shirt',
  'Vortex app access to exercises, skills, games, and drills',
  'Full VALD biometric account access (speed, agility, power, verticals)',
]

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function readStoredSession(): { token: string; account: PortalAccount } | null {
  try {
    const token = localStorage.getItem('vortex_member_token')
    const raw = localStorage.getItem('vortex_member')
    if (!token || !raw) return null
    return { token, account: JSON.parse(raw) as PortalAccount }
  } catch {
    return null
  }
}

function memberDisplayName(member: FamilyMemberRow): string {
  return [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || 'Athlete'
}

export default function WaiversMembershipsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isClassEnrollmentMembershipPrompt = searchParams.get('source') === 'class-enrollment'
  const [phase, setPhase] = useState<Phase>('loading')
  const [token, setToken] = useState<string | null>(null)
  const [account, setAccount] = useState<PortalAccount | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [familyMembers, setFamilyMembers] = useState<FamilyMemberRow[]>([])
  const [addedDuringVisit, setAddedDuringVisit] = useState(false)

  const [waivers, setWaivers] = useState<PublicWaiverTemplate[]>([])
  const [checkedTemplateIds, setCheckedTemplateIds] = useState<number[]>([])
  const [agreeAll, setAgreeAll] = useState(false)
  const [signatureName, setSignatureName] = useState('')
  const [comments, setComments] = useState('')
  const [paymentPolicyAcknowledged, setPaymentPolicyAcknowledged] = useState(false)

  const [addForm, setAddForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
  })

  const [athleteRows, setAthleteRows] = useState<AthleteMembershipRow[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([])
  const [promoCodesByMemberId, setPromoCodesByMemberId] = useState<Record<number, string>>({})
  const [membershipPreview, setMembershipPreview] = useState<AnnualMembershipPreview | null>(null)
  const [thankYouKind, setThankYouKind] = useState<ThankYouKind>('waivers-only')
  /** Secondary CTA on ask-register-more: continue vs completion states. */
  const [registerMoreContinue, setRegisterMoreContinue] = useState<
    'loading' | 'continue' | 'waivers-complete' | 'memberships-active'
  >('loading')
  const stripeReturnHandled = useRef(false)
  const initialLoadDone = useRef(false)

  const applySession = useCallback((nextToken: string, nextAccount: PortalAccount) => {
    persistMemberSession(nextToken, nextAccount)
    setToken(nextToken)
    setAccount(nextAccount)
  }, [])

  const loadFamilyMembers = useCallback(async (memberToken: string): Promise<FamilyMemberRow[]> => {
    const apiUrl = getApiUrl()
    const res = await fetch(`${apiUrl}/api/members/family`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || 'Failed to load family members.')
    const rows = Array.isArray(data.familyMembers) ? data.familyMembers : []
    return rows
      .map((row: Record<string, unknown>) => ({
        id: Number(row.id),
        firstName: String(row.first_name || row.firstName || ''),
        lastName: String(row.last_name || row.lastName || ''),
        dateOfBirth: (row.date_of_birth || row.dateOfBirth || null) as string | null,
      }))
      .filter((row: FamilyMemberRow) => Number.isFinite(row.id) && row.id > 0)
  }, [])

  const loadWaivers = useCallback(async (memberToken: string): Promise<PublicWaiverTemplate[]> => {
    const apiUrl = getApiUrl()
    const res = await fetch(`${apiUrl}/api/members/waivers`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || 'Failed to load waivers.')
    return Array.isArray(data.data) ? data.data : []
  }, [])

  const loadMembershipRows = useCallback(
    async (memberToken: string, members: FamilyMemberRow[]): Promise<AthleteMembershipRow[]> => {
      const rows = await Promise.all(
        members.map(async (member) => {
          try {
            const offer = await fetchAnnualMembershipOffer(memberToken, member.id)
            return { member, offer }
          } catch {
            return { member, offer: null }
          }
        }),
      )
      return rows
    },
    [],
  )

  const goToMembershipOrThanks = useCallback(
    async (memberToken: string, members: FamilyMemberRow[]) => {
      const rows = await loadMembershipRows(memberToken, members)
      setAthleteRows(rows)
      const needsMembership = rows.filter((row) => row.offer && !row.offer.active)
      if (needsMembership.length === 0) {
        setThankYouKind('waivers-only')
        setPhase('thank-you')
        return
      }
      setSelectedMemberIds(needsMembership.map((row) => row.member.id))
      setPhase('membership-upsell')
    },
    [loadMembershipRows],
  )

  const goToWaiversOrMembership = useCallback(
    async (memberToken: string, members: FamilyMemberRow[], forceWaivers: boolean) => {
      const templates = await loadWaivers(memberToken)
      const unsignedRequired = templates.filter(
        (w) => w.is_required !== false && w.acceptance_id == null,
      )
      if (forceWaivers || unsignedRequired.length > 0) {
        // When signing for newly added family members, require a fresh attestation.
        setWaivers(
          forceWaivers
            ? templates.map((w) => ({ ...w, acceptance_id: null, accepted_at: null }))
            : templates,
        )
        setCheckedTemplateIds([])
        setAgreeAll(false)
        setComments('')
        setPaymentPolicyAcknowledged(false)
        const defaultName = [account?.firstName, account?.lastName].filter(Boolean).join(' ')
        setSignatureName(defaultName)
        setPhase('sign-waivers')
        return
      }
      await goToMembershipOrThanks(memberToken, members)
    },
    [account?.firstName, account?.lastName, goToMembershipOrThanks, loadWaivers],
  )

  const refreshRegisterMoreContinue = useCallback(
    async (memberToken: string, members: FamilyMemberRow[]) => {
      setRegisterMoreContinue('loading')
      try {
        if (members.length === 0) {
          setRegisterMoreContinue('continue')
          return
        }
        const [templates, rows] = await Promise.all([
          loadWaivers(memberToken),
          loadMembershipRows(memberToken, members),
        ])
        const required = templates.filter((w) => w.is_required !== false)
        const allWaiversSigned = required.every((w) => w.acceptance_id != null)
        const allMembershipsActive = rows.every((row) => Boolean(row.offer?.active))
        const needsMembership = rows.some((row) => row.offer && !row.offer.active)

        if (allMembershipsActive) {
          setRegisterMoreContinue('memberships-active')
        } else if (allWaiversSigned && !needsMembership) {
          setRegisterMoreContinue('waivers-complete')
        } else {
          // Unsigned waivers and/or unpaid memberships — continue through the flow.
          setRegisterMoreContinue('continue')
        }
      } catch {
        setRegisterMoreContinue('continue')
      }
    },
    [loadMembershipRows, loadWaivers],
  )

  // Initial session + Stripe return handling
  useEffect(() => {
    const membershipStatus = searchParams.get('membership')
    const sessionId = searchParams.get('session_id')

    if (membershipStatus === 'paid' || membershipStatus === 'cancelled') {
      if (stripeReturnHandled.current) return
      stripeReturnHandled.current = true
      initialLoadDone.current = true

      const stored = readStoredSession()
      if (!stored) {
        setPhase('guest-entry')
        setLoginOpen(true)
        return
      }

      applySession(stored.token, stored.account)
      void (async () => {
        try {
          setBusy(true)
          if (membershipStatus === 'paid' && sessionId) {
            await confirmAnnualMembershipCheckoutSession(stored.token, {
              checkoutSessionId: sessionId,
            })
            setThankYouKind('membership-paid')
          } else {
            setThankYouKind('membership-declined')
          }
          setPhase('thank-you')
          setSearchParams({}, { replace: true })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not confirm membership payment.')
          try {
            const members = await loadFamilyMembers(stored.token)
            setFamilyMembers(members)
            await goToMembershipOrThanks(stored.token, members)
          } catch {
            setPhase('guest-entry')
          }
        } finally {
          setBusy(false)
        }
      })()
      return
    }

    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const stored = readStoredSession()
    if (stored) {
      applySession(stored.token, stored.account)
      void (async () => {
        try {
          setBusy(true)
          const members = await loadFamilyMembers(stored.token)
          setFamilyMembers(members)
          if (isClassEnrollmentMembershipPrompt) {
            await goToMembershipOrThanks(stored.token, members)
          } else {
            setPhase('ask-register-more')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load family.')
          setPhase('ask-register-more')
        } finally {
          setBusy(false)
        }
      })()
      return
    }

    setPhase('guest-entry')
  }, [
    applySession,
    goToMembershipOrThanks,
    loadFamilyMembers,
    isClassEnrollmentMembershipPrompt,
    searchParams,
    setSearchParams,
  ])

  useEffect(() => {
    if (phase !== 'ask-register-more' || !token) return
    void refreshRegisterMoreContinue(token, familyMembers)
  }, [phase, token, familyMembers, refreshRegisterMoreContinue])

  const handleStayOnPageLogin = (nextToken: string, nextAccount: PortalAccount) => {
    applySession(nextToken, nextAccount)
    setLoginOpen(false)
    setError(null)
    void (async () => {
      try {
        setBusy(true)
        const members = await loadFamilyMembers(nextToken)
        setFamilyMembers(members)
        setPhase('ask-register-more')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load family.')
        setPhase('ask-register-more')
      } finally {
        setBusy(false)
      }
    })()
  }

  const handleGuestSignupComplete = (result: unknown) => {
    const data = (result || {}) as {
      token?: string
      member?: PortalAccount
      memberIds?: number[]
    }
    if (data.token && data.member) {
      applySession(data.token, data.member)
      void (async () => {
        try {
          setBusy(true)
          const members = await loadFamilyMembers(data.token!)
          setFamilyMembers(members)
          // Waivers already signed during guest registration.
          await goToMembershipOrThanks(data.token!, members)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Account created — please continue.')
          setPhase('ask-register-more')
        } finally {
          setBusy(false)
        }
      })()
      return
    }
    setError('Account created. Please log in to continue with membership.')
    setPhase('guest-entry')
    setLoginOpen(true)
  }

  const submitAddMember = async () => {
    if (!token) return
    if (!addForm.firstName.trim() || !addForm.lastName.trim()) {
      setError('First and last name are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const apiUrl = getApiUrl()
      const res = await fetch(`${apiUrl}/api/members/family`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: addForm.firstName.trim(),
          lastName: addForm.lastName.trim(),
          email: addForm.email.trim() || null,
          phone: addForm.phone.trim() || null,
          dateOfBirth: addForm.dateOfBirth || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to add family member.')
      setAddedDuringVisit(true)
      setAddForm({ firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '' })
      const members = await loadFamilyMembers(token)
      setFamilyMembers(members)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add family member.')
    } finally {
      setBusy(false)
    }
  }

  const finishAddingMembers = async () => {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      const members = familyMembers.length ? familyMembers : await loadFamilyMembers(token)
      setFamilyMembers(members)
      await goToWaiversOrMembership(token, members, addedDuringVisit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue.')
    } finally {
      setBusy(false)
    }
  }

  const skipRegisterMore = async () => {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      const members = familyMembers.length ? familyMembers : await loadFamilyMembers(token)
      setFamilyMembers(members)
      await goToWaiversOrMembership(token, members, false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue.')
    } finally {
      setBusy(false)
    }
  }

  const submitWaivers = async () => {
    if (!token) return
    const validationError = validateWaiverSigning({
      waivers,
      checkedTemplateIds,
      agreeAll,
      signatureName,
      paymentPolicyAcknowledged,
    })
    if (validationError) {
      setError(validationError)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const memberIds = familyMembers.map((m) => m.id)
      const unsignedIds = waivers.filter((w) => !w.acceptance_id).map((w) => w.id)
      const apiUrl = getApiUrl()
      const res = await fetch(`${apiUrl}/api/members/waivers/accept-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signatureName: signatureName.trim(),
          comments,
          acceptedTemplateIds: unsignedIds.length > 0 ? unsignedIds : checkedTemplateIds,
          paymentPolicyAcknowledged,
          memberIds: memberIds.length > 0 ? memberIds : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to submit waivers.')
      await goToMembershipOrThanks(token, familyMembers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit waivers.')
    } finally {
      setBusy(false)
    }
  }

  const needsMembershipRows = useMemo(
    () => athleteRows.filter((row) => row.offer && !row.offer.active),
    [athleteRows],
  )

  const feeCents = needsMembershipRows[0]?.offer?.amountCents ?? 0
  const previewByMemberId = useMemo(() => {
    const map = new Map<number, AnnualMembershipPreview['athletes'][number]>()
    for (const athlete of membershipPreview?.athletes || []) {
      map.set(athlete.memberId, athlete)
    }
    return map
  }, [membershipPreview])

  const checkoutTotalCents =
    membershipPreview && selectedMemberIds.length > 0
      ? selectedMemberIds.reduce((sum, id) => {
          const row = previewByMemberId.get(id)
          return sum + (row?.netCents ?? feeCents)
        }, 0)
      : feeCents * selectedMemberIds.length

  const selectedPromoCount = selectedMemberIds.filter((id) =>
    Boolean(promoCodesByMemberId[id]?.trim()),
  ).length
  const selectedDiscountCents =
    membershipPreview && selectedMemberIds.length > 0
      ? selectedMemberIds.reduce((sum, id) => sum + (previewByMemberId.get(id)?.discountCents ?? 0), 0)
      : 0
  const hasInvalidSelectedPromo = selectedMemberIds.some((id) => {
    const row = previewByMemberId.get(id)
    return Boolean(promoCodesByMemberId[id]?.trim()) && row && !row.promoValid
  })

  useEffect(() => {
    if (phase !== 'membership-upsell' || !token || selectedMemberIds.length === 0) {
      setMembershipPreview(null)
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      const promoCodes: Record<number, string> = {}
      for (const id of selectedMemberIds) {
        const code = promoCodesByMemberId[id]?.trim()
        if (code) promoCodes[id] = code
      }
      void previewAnnualMembershipCheckout(token, {
        memberIds: selectedMemberIds,
        promoCodesByMemberId: Object.keys(promoCodes).length > 0 ? promoCodes : undefined,
      })
        .then((preview) => {
          if (!cancelled) setMembershipPreview(preview)
        })
        .catch(() => {
          if (!cancelled) setMembershipPreview(null)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [phase, token, selectedMemberIds, promoCodesByMemberId])

  const startMembershipCheckout = async () => {
    if (!token || selectedMemberIds.length === 0) return
    if (hasInvalidSelectedPromo) {
      setError('Fix invalid discount codes before checkout.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const origin = window.location.origin
      const promoCodes: Record<number, string> = {}
      for (const id of selectedMemberIds) {
        const code = promoCodesByMemberId[id]?.trim()
        if (code) promoCodes[id] = code
      }
      const session = await createAnnualMembershipCheckoutSession(token, {
        memberIds: selectedMemberIds,
        promoCodesByMemberId: Object.keys(promoCodes).length > 0 ? promoCodes : undefined,
        successUrl: `${origin}/waivers-memberships?membership=paid&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/waivers-memberships?membership=cancelled`,
      })
      // A 100%-waived promo activates memberships server-side with no payment step.
      if (session?.free) {
        setThankYouKind('membership-paid')
        setPhase('thank-you')
        setBusy(false)
        return
      }
      if (!session?.url) throw new Error('Checkout did not return a payment link.')
      window.location.href = session.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start membership checkout.')
      setBusy(false)
    }
  }

  const declineMembership = () => {
    setThankYouKind('membership-declined')
    setPhase('thank-you')
  }

  const toggleSelected = (memberId: number, checked: boolean) => {
    setSelectedMemberIds((prev) =>
      checked ? [...new Set([...prev, memberId])] : prev.filter((id) => id !== memberId),
    )
  }

  const setMemberPromoCode = (memberId: number, value: string) => {
    const normalized = value.toUpperCase().replace(/\s/g, '')
    setPromoCodesByMemberId((prev) => {
      if (!normalized) {
        const next = { ...prev }
        delete next[memberId]
        return next
      }
      return { ...prev, [memberId]: normalized }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-10 pt-below-site-header">
      <div className="max-w-3xl mx-auto mt-8 md:mt-10 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Waivers & Memberships</h1>
          <p className="text-sm text-gray-600 mt-1">
            {isClassEnrollmentMembershipPrompt
              ? 'We are checking annual membership for the athletes in your class enrollment.'
              : 'Register your family, sign waivers, and optionally purchase annual memberships — all in one place.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
        )}

        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-600">
            <Loader2 className="w-8 h-8 animate-spin text-vortex-red" />
            <p className="text-sm">Loading…</p>
          </div>
        )}

        {phase === 'guest-entry' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              New here? Create a family account and sign waivers. Already registered? Log in to update
              waivers or buy memberships.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setPhase('guest-register')
                }}
                className="px-4 py-2.5 rounded-lg bg-vortex-red text-white text-sm font-semibold hover:bg-red-700"
              >
                Register family
              </button>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Log in
              </button>
            </div>
          </div>
        )}

        {phase === 'guest-register' && (
          <FamilySignupWizard
            mode="waivers-memberships"
            onComplete={handleGuestSignupComplete}
            onCancel={() => setPhase('guest-entry')}
          />
        )}

        {phase === 'ask-register-more' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Welcome{account?.firstName ? `, ${account.firstName}` : ''}. Register anyone else under
              this family?
            </p>
            {familyMembers.length > 0 && (
              <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                {familyMembers.map((m) => (
                  <li key={m.id}>{memberDisplayName(m)}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  setPhase('add-members')
                }}
                className="px-4 py-2.5 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60"
              >
                Yes — add family members
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  registerMoreContinue === 'loading' ||
                  registerMoreContinue === 'waivers-complete' ||
                  registerMoreContinue === 'memberships-active'
                }
                onClick={() => void skipRegisterMore()}
                className={`px-4 py-2.5 rounded-lg border text-sm font-semibold disabled:cursor-not-allowed ${
                  registerMoreContinue === 'waivers-complete' ||
                  registerMoreContinue === 'memberships-active'
                    ? 'border-gray-200 bg-gray-100 text-gray-500'
                    : 'border-gray-300 text-gray-800 disabled:opacity-60'
                }`}
              >
                {busy
                  ? 'Continuing…'
                  : registerMoreContinue === 'loading'
                    ? 'Checking…'
                    : registerMoreContinue === 'memberships-active'
                      ? 'Memberships Active'
                      : registerMoreContinue === 'waivers-complete'
                        ? 'Waivers Complete'
                        : 'No — continue to Membership'}
              </button>
            </div>
          </div>
        )}

        {phase === 'add-members' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-gray-900">Add family members</h2>
              <p className="text-sm text-gray-600 mt-1">
                Add children or other athletes, then continue to sign waivers for everyone.
              </p>
            </div>
            {familyMembers.length > 0 && (
              <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                {familyMembers.map((m) => (
                  <li key={m.id}>{memberDisplayName(m)}</li>
                ))}
              </ul>
            )}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={addForm.firstName}
                onChange={(e) => setAddForm((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder="First name"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={addForm.lastName}
                onChange={(e) => setAddForm((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder="Last name"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email (optional for children)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="tel"
                value={addForm.phone}
                onChange={(e) => setAddForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone (optional)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <DateOfBirthInput
                value={addForm.dateOfBirth}
                onChange={(e) => setAddForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                containerClassName="md:col-span-2"
                required
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitAddMember()}
                className="inline-flex items-center justify-center gap-2 md:col-span-2 px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60"
              >
                <UserPlus className="w-4 h-4" />
                {busy ? 'Adding…' : 'Add member'}
              </button>
            </div>
            <div className="flex justify-between gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPhase('ask-register-more')}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finishAddingMembers()}
                className="px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60"
              >
                Continue to waivers
              </button>
            </div>
          </div>
        )}

        {phase === 'sign-waivers' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-gray-900">Sign waivers</h2>
              <p className="text-sm text-gray-600 mt-1">
                One parent signature covers all family members listed below.
              </p>
              {familyMembers.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Signing for: {familyMembers.map(memberDisplayName).join(', ')}
                </p>
              )}
            </div>
            <WaiverSigningBlock
              waivers={waivers}
              checkedTemplateIds={checkedTemplateIds}
              onToggleTemplate={(id, checked) =>
                setCheckedTemplateIds((prev) =>
                  checked ? [...prev, id] : prev.filter((x) => x !== id),
                )
              }
              agreeAll={agreeAll}
              onAgreeAllChange={setAgreeAll}
              signatureName={signatureName}
              onSignatureNameChange={setSignatureName}
              comments={comments}
              onCommentsChange={setComments}
              paymentPolicyAcknowledged={paymentPolicyAcknowledged}
              onPaymentPolicyAcknowledgedChange={setPaymentPolicyAcknowledged}
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitWaivers()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit waivers
              </button>
            </div>
          </div>
        )}

        {phase === 'membership-upsell' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isClassEnrollmentMembershipPrompt
                  ? 'Annual Membership for Class Enrollment'
                  : 'Annual Membership'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isClassEnrollmentMembershipPrompt
                  ? 'We found athletes without an active membership. Select who needs one and pay once in a single checkout.'
                  : 'Membership is per athlete. Select who needs one and pay once in a single checkout.'}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Membership benefits</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {MEMBERSHIP_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-vortex-red shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Select athletes</h3>
              {athleteRows.map(({ member, offer }) => {
                const active = Boolean(offer?.active)
                const available = offer?.available !== false
                const checked = selectedMemberIds.includes(member.id)
                const preview = previewByMemberId.get(member.id)
                const lineNet = checked ? (preview?.netCents ?? offer?.amountCents ?? feeCents) : null
                const lineDiscount = checked ? (preview?.discountCents ?? 0) : 0
                const waived = Boolean(checked && preview?.waived)
                return (
                  <div
                    key={member.id}
                    className={`rounded-lg border px-4 py-3 space-y-2 ${
                      active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        disabled={active || !available || busy}
                        checked={active ? false : checked}
                        onChange={(e) => toggleSelected(member.id, e.target.checked)}
                      />
                      <span className="flex-1">
                        <span className="block font-medium text-gray-900">
                          {memberDisplayName(member)}
                        </span>
                        <span className="block text-sm text-gray-600">
                          {active
                            ? `Active member${offer?.renewsOn ? ` · renews ${offer.renewsOn}` : ''}`
                            : available
                              ? waived
                                ? `${formatMoney(0)} / year (membership waived)`
                                : lineDiscount > 0 && lineNet != null
                                  ? `${formatMoney(lineNet)} / year (${formatMoney(lineDiscount)} off)`
                                  : `${formatMoney(offer?.amountCents ?? feeCents)} / year`
                              : 'Membership unavailable'}
                        </span>
                      </span>
                    </label>
                    {!active && available && (
                      <div className="pl-7">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          Discount code (optional)
                        </label>
                        <input
                          type="text"
                          value={promoCodesByMemberId[member.id] || ''}
                          onChange={(e) => setMemberPromoCode(member.id, e.target.value)}
                          disabled={busy}
                          placeholder="Enter code for this athlete"
                          className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase font-mono disabled:opacity-60"
                        />
                        {checked && preview?.promoError ? (
                          <p className="text-xs text-red-600 mt-1">{preview.promoError}</p>
                        ) : null}
                        {checked && waived ? (
                          <p className="text-xs text-green-700 mt-1">
                            Free annual membership promo applied — no payment needed for this athlete.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {selectedMemberIds.length > 0 && (
              <p className="text-sm font-semibold text-gray-900">
                Total due today: {formatMoney(checkoutTotalCents)}
                {selectedDiscountCents > 0
                  ? ` (${formatMoney(selectedDiscountCents)} discount applied)`
                  : selectedMemberIds.length > 1
                    ? ` (${selectedMemberIds.length} athletes)`
                    : ''}
                {selectedPromoCount > 0 && selectedDiscountCents === 0 && !hasInvalidSelectedPromo
                  ? ' — checking discount…'
                  : ''}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={busy || selectedMemberIds.length === 0 || hasInvalidSelectedPromo}
                onClick={() => void startMembershipCheckout()}
                className="px-4 py-2.5 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60"
              >
                {busy
                  ? 'Starting checkout…'
                  : checkoutTotalCents === 0 && selectedMemberIds.length > 0
                    ? 'Activate free membership'
                    : 'Purchase membership'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={declineMembership}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold disabled:opacity-60"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {phase === 'thank-you' && (
          <div className="space-y-4 text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            {thankYouKind === 'membership-paid' && (
              <>
                <h2 className="text-xl font-bold text-gray-900">You&apos;re all set</h2>
                <p className="text-sm text-gray-600">
                  Thanks for completing registration, waivers, and annual membership. We&apos;re
                  excited to have you at Vortex.
                </p>
              </>
            )}
            {thankYouKind === 'membership-declined' && (
              <>
                <h2 className="text-xl font-bold text-gray-900">Thanks for registering</h2>
                <p className="text-sm text-gray-600">
                  Your registration and waivers are complete. Annual membership is available anytime
                  from your member portal or this page.
                </p>
              </>
            )}
            {thankYouKind === 'waivers-only' && (
              <>
                <h2 className="text-xl font-bold text-gray-900">Thank you</h2>
                <p className="text-sm text-gray-600">
                  Your waivers are up to date, and your family already has active annual membership
                  coverage where needed.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <Login isOpen={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={handleStayOnPageLogin} />
    </div>
  )
}
