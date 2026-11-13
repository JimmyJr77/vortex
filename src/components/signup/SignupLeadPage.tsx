import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import FamilySignupWizard, { type LeadRegistrationSetup } from './FamilySignupWizard'
import { getApiUrl } from '../../utils/api'
import { loginMemberWithCredentials, persistMemberSession, type PortalAccount } from '../../utils/portalSession'
import { saveFamilyCheckoutSelections, type PendingFamilyEnrollment } from '../../utils/familyEnrollmentCheckout'

type Result = {
  payerMemberId: number
  memberIds?: number[]
  pendingEnrollments: PendingFamilyEnrollment[]
  enrollmentsPrepared?: boolean
  token?: string
  member?: PortalAccount
}

type Invitation = Omit<LeadRegistrationSetup, 'inviteId' | 'token'> & {
  completed: boolean
  result?: Result
  instructions: string
  expiresAt: string
}

const actionClass = 'rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white disabled:opacity-50'
const memberPortalReview = '/?enrollment=review'

export default function SignupLeadPage() {
  const [params] = useSearchParams()
  const inviteId = Number(params.get('invite'))
  const token = params.get('token') || ''
  const focusedSelection = params.has('selection') ? Number(params.get('selection')) : null
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [info, setInfo] = useState<Invitation | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const setup = useMemo(() => info ? { ...info, inviteId, token, focusedSelection } : undefined, [info, inviteId, token, focusedSelection])

  const complete = (value: unknown) => {
    const saved = value as Result
    if (saved.token && saved.member) {
      persistMemberSession(saved.token, saved.member)
      setSignedIn(true)
    }
    setResult(saved)
  }

  const login = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`${getApiUrl()}/api/signup/lead/${inviteId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, username, password }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to open registration.')
      const invitation = data.data as Invitation
      if (invitation.completed && invitation.result) {
        const memberLogin = await loginMemberWithCredentials(getApiUrl(), {
          emailOrUsername: username,
          password,
        })
        complete({ ...invitation.result, ...memberLogin })
      }
      setInfo(invitation)
      setPassword('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.')
    } finally {
      setBusy(false)
    }
  }

  const checkout = () => {
    if (!result) return
    saveFamilyCheckoutSelections(result.payerMemberId, result.pendingEnrollments)
    window.location.assign(memberPortalReview)
  }

  const pending = result?.pendingEnrollments ?? []
  const legacyLinks = result && !result.enrollmentsPrepared ? info?.selections.filter((item) => item.kind !== 'reserved') ?? [] : []

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-12 pt-below-site-header">
      <main className="mx-auto mt-8 max-w-4xl rounded-2xl border bg-white p-6 sm:p-8">
        <h1 className="mb-3 text-2xl font-bold">Your Vortex registration</h1>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
        {!info ? (
          <form onSubmit={login} className="max-w-lg space-y-4">
            <p>Use the username and temporary password in your invitation email. After setup, sign in with your username, email, or phone number and your new password.</p>
            <label className="block font-medium">
              Username
              <input className="mt-1 w-full rounded-lg border p-3" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label className="block font-medium">
              Password
              <input className="mt-1 w-full rounded-lg border p-3" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {(!token || !inviteId) && <p className="text-sm text-red-700">Open the complete registration link from your invitation email.</p>}
            <button className={actionClass} disabled={busy || !token || !inviteId}>
              {busy ? 'Signing in…' : 'Sign in to finish registration'}
            </button>
          </form>
        ) : (
          <>
            {!result && info.selections.some((item) => item.kind === 'reserved') && (
              <p className="mb-4 text-sm text-slate-600">Reserved class places are held until {new Date(info.expiresAt).toLocaleDateString()}. Complete checkout to confirm enrollment.</p>
            )}
            {info.instructions && <p className="mb-5 whitespace-pre-wrap rounded-lg bg-blue-50 p-4">{info.instructions}</p>}
            {result ? (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold">{pending.length || legacyLinks.length ? 'Next: your classes' : 'Your family account is ready'}</h2>
                {(pending.length > 0 || legacyLinks.length > 0) && (
                  <p>Your family account is ready. Review each athlete’s classes and pay by credit card. Class enrollment is confirmed once tuition and any annual registration fee due for that athlete are paid.</p>
                )}
                {!signedIn && <p className="rounded-lg bg-amber-50 p-4">Sign in with your current credentials to continue to the Member Portal.</p>}
                {pending.length > 0 && <button className={actionClass} onClick={checkout}>Review classes and complete enrollment</button>}
                {legacyLinks.length > 0 && (
                  <ul className="space-y-3">
                    {legacyLinks.map((selection, index) => {
                      const memberId = selection.childIndex != null ? result.memberIds?.[selection.childIndex + 1] : undefined
                      const query = new URLSearchParams({ enrollment: 'browse', programsId: String(selection.programsId) })
                      if (selection.classEventId) query.set('classEventId', String(selection.classEventId))
                      if (memberId) query.set('memberId', String(memberId))
                      if (selection.enrollmentStartDate) query.set('enrollmentStartDate', selection.enrollmentStartDate)
                      return <li key={index}><a className="font-semibold text-vortex-red underline" href={`/?${query}`}>{selection.childName ? `${selection.childName} · ` : ''}{selection.label}</a></li>
                    })}
                  </ul>
                )}
                {pending.length === 0 && legacyLinks.length === 0 && <a className="font-semibold text-vortex-red underline" href="/?enrollment=browse">Go to Member Portal</a>}
              </section>
            ) : setup && (
              <FamilySignupWizard mode={setup.selections.length > 0 ? 'public' : 'waivers-memberships'} leadRegistration={setup} onComplete={complete} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
