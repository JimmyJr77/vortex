import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getApiUrl } from '../../utils/api'
import { formatPhoneNumber, PHONE_INPUT_MAX_LENGTH, PHONE_INPUT_PLACEHOLDER } from '../../utils/phoneUtils'
import { isAdult } from '../../utils/dateUtils'
import WaiverSigningBlock, { validateWaiverSigning, type PublicWaiverTemplate } from './WaiverSigningBlock'

export default function SignupInvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const apiUrl = getApiUrl()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [inviteInfo, setInviteInfo] = useState<{
    inviteeEmail: string
    minor: { firstName: string; lastName: string; dateOfBirth?: string }
    pendingPayload?: {
      enrollments?: Array<{
        programName?: string
        className?: string
        scheduleLabel?: string
        offeringLabel?: string
        priceLabel?: string
      }>
    }
  } | null>(null)
  const [waivers, setWaivers] = useState<PublicWaiverTemplate[]>([])
  const [primaryAdult, setPrimaryAdult] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
    dateOfBirth: '',
    gender: '',
    username: '',
    password: '',
    confirmPassword: '',
  })
  const [checkedTemplateIds, setCheckedTemplateIds] = useState<number[]>([])
  const [agreeAll, setAgreeAll] = useState(false)
  const [signatureName, setSignatureName] = useState('')
  const [comments, setComments] = useState('')
  const [paymentPolicyAcknowledged, setPaymentPolicyAcknowledged] = useState(false)

  const loadInvite = useCallback(async () => {
    if (!token) {
      setError('Missing invite token.')
      setLoading(false)
      return
    }
    try {
      const [inviteRes, waiversRes] = await Promise.all([
        fetch(`${apiUrl}/api/signup/invite/${encodeURIComponent(token)}/verify`, { method: 'POST' }),
        fetch(`${apiUrl}/api/signup/waivers`),
      ])
      const inviteData = await inviteRes.json()
      const waiversData = await waiversRes.json()
      if (!inviteRes.ok) throw new Error(inviteData.message || 'Invalid invite')
      setInviteInfo({
        inviteeEmail: inviteData.data?.inviteeEmail || '',
        minor: inviteData.data?.minor,
        pendingPayload: inviteData.data?.pendingPayload,
      })
      setPrimaryAdult((prev) => ({ ...prev, email: inviteData.data?.inviteeEmail || prev.email }))
      setWaivers(waiversData.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invite')
    } finally {
      setLoading(false)
    }
  }, [apiUrl, token])

  useEffect(() => {
    void loadInvite()
  }, [loadInvite])

  const submit = async () => {
    const waiverError = validateWaiverSigning({
      waivers,
      checkedTemplateIds,
      agreeAll,
      signatureName,
      paymentPolicyAcknowledged,
    })
    if (waiverError) {
      setError(waiverError)
      return
    }
    if (!primaryAdult.firstName || !primaryAdult.lastName) {
      setError('First and last name are required.')
      return
    }
    if (!primaryAdult.dateOfBirth || !isAdult(primaryAdult.dateOfBirth)) {
      setError('Parent/guardian must be 18 or older.')
      return
    }
    if (!primaryAdult.password || primaryAdult.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (primaryAdult.password !== primaryAdult.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/signup/invite/${encodeURIComponent(token)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryAdult,
          waivers: {
            signatureName,
            comments,
            acceptedTemplateIds: checkedTemplateIds,
            paymentPolicyAcknowledged,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to complete signup')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete signup')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading invite…
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full rounded-2xl bg-white border border-green-200 p-8 text-center space-y-3">
          <h1 className="text-2xl font-bold text-green-800">Signup complete</h1>
          <p className="text-sm text-gray-600">
            The family account is active. You can log in to the member portal with your new credentials.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-10 pt-below-site-header">
      <div className="max-w-3xl mx-auto mt-8 md:mt-10 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complete signup for your athlete</h1>
          {inviteInfo?.minor && (
            <p className="text-sm text-gray-600 mt-1">
              Finishing account setup for {inviteInfo.minor.firstName} {inviteInfo.minor.lastName}.
            </p>
          )}
        </div>

        {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

        {inviteInfo?.pendingPayload?.enrollments && inviteInfo.pendingPayload.enrollments.length > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-blue-900">Requested enrollments</h2>
            <p className="text-xs text-blue-800">
              Your athlete selected these classes. Enrollment will be finalized when you complete signup below.
            </p>
            <ul className="space-y-2">
              {inviteInfo.pendingPayload.enrollments.map((item, index) => (
                <li
                  key={index}
                  className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-gray-800"
                >
                  <div className="font-semibold text-gray-900">
                    {item.programName || item.className || 'Class enrollment'}
                  </div>
                  {item.scheduleLabel && (
                    <div className="text-gray-600 mt-0.5">{item.scheduleLabel}</div>
                  )}
                  {item.offeringLabel && (
                    <div className="text-xs text-gray-500 mt-0.5">{item.offeringLabel}</div>
                  )}
                  {item.priceLabel && (
                    <div className="text-xs font-semibold text-vortex-red mt-1">{item.priceLabel}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 p-4 grid gap-3 md:grid-cols-2">
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="First name *" value={primaryAdult.firstName} onChange={(e) => setPrimaryAdult((p) => ({ ...p, firstName: e.target.value }))} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Last name *" value={primaryAdult.lastName} onChange={(e) => setPrimaryAdult((p) => ({ ...p, lastName: e.target.value }))} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="email" placeholder="Email" value={primaryAdult.email} onChange={(e) => setPrimaryAdult((p) => ({ ...p, email: e.target.value }))} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="tel" placeholder={PHONE_INPUT_PLACEHOLDER} maxLength={PHONE_INPUT_MAX_LENGTH} value={primaryAdult.phone} onChange={(e) => setPrimaryAdult((p) => ({ ...p, phone: formatPhoneNumber(e.target.value) }))} />
          <input className="md:col-span-2 h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Street" value={primaryAdult.addressStreet} onChange={(e) => setPrimaryAdult((p) => ({ ...p, addressStreet: e.target.value }))} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="City" value={primaryAdult.addressCity} onChange={(e) => setPrimaryAdult((p) => ({ ...p, addressCity: e.target.value }))} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="State" value={primaryAdult.addressState} onChange={(e) => setPrimaryAdult((p) => ({ ...p, addressState: e.target.value }))} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="ZIP" value={primaryAdult.addressZip} onChange={(e) => setPrimaryAdult((p) => ({ ...p, addressZip: e.target.value }))} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="date" value={primaryAdult.dateOfBirth} onChange={(e) => setPrimaryAdult((p) => ({ ...p, dateOfBirth: e.target.value }))} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Username" value={primaryAdult.username} onChange={(e) => setPrimaryAdult((p) => ({ ...p, username: e.target.value }))} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" placeholder="Password" value={primaryAdult.password} onChange={(e) => setPrimaryAdult((p) => ({ ...p, password: e.target.value }))} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" placeholder="Confirm password" value={primaryAdult.confirmPassword} onChange={(e) => setPrimaryAdult((p) => ({ ...p, confirmPassword: e.target.value }))} />
        </div>

        <WaiverSigningBlock
          waivers={waivers}
          checkedTemplateIds={checkedTemplateIds}
          onToggleTemplate={(id, checked) => setCheckedTemplateIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))}
          agreeAll={agreeAll}
          onAgreeAllChange={setAgreeAll}
          signatureName={signatureName}
          onSignatureNameChange={setSignatureName}
          comments={comments}
          onCommentsChange={setComments}
          paymentPolicyAcknowledged={paymentPolicyAcknowledged}
          onPaymentPolicyAcknowledgedChange={setPaymentPolicyAcknowledged}
        />

        <button
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
          className="w-full py-3 rounded-lg bg-vortex-red text-white font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Complete signup &amp; sign waivers
        </button>
      </div>
    </div>
  )
}
