import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import FamilySignupWizard, { type LeadRegistrationSetup } from './FamilySignupWizard'
import { getApiUrl } from '../../utils/api'
import { persistMemberSession, type PortalAccount } from '../../utils/portalSession'
import { saveFamilyCheckoutSelections, type PendingFamilyEnrollment } from '../../utils/familyEnrollmentCheckout'
import type { PublicWaiverTemplate } from './waiverSigningUtils'

type Result = { payerMemberId: number; pendingEnrollments: PendingFamilyEnrollment[]; token?: string; member?: PortalAccount }
type Invitation = Omit<LeadRegistrationSetup, 'inviteId' | 'token'> & { completed: boolean; result?: Result; instructions: string; expiresAt: string; waivers: PublicWaiverTemplate[]; selections: { kind: string; label: string; childName: string; programsId: number; schedulingFormId?: number; childIndex?: number }[] }
export default function SignupLeadPage() {
  const [params] = useSearchParams()
  const inviteId = Number(params.get('invite')), token = params.get('token') || ''
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [info, setInfo] = useState<Invitation | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const setup = useMemo(() => info ? { ...info, inviteId, token } : undefined, [info, inviteId, token])
  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      const response = await fetch(`${getApiUrl()}/api/signup/lead/${inviteId}/session`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ token, username, password }) })
      const data = await response.json()
      if (!response.ok || !data.success) throw Error(data.message || 'Unable to open registration.')
      setInfo(data.data)
      if (data.data.completed) {
        setResult(data.data.result)
        const memberLogin = await fetch(`${getApiUrl()}/api/members/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({emailOrUsername:username,password}) }).then(res=>res.json())
        if (memberLogin.token && memberLogin.member) { persistMemberSession(memberLogin.token,memberLogin.member); setSignedIn(true) }
      }
      setPassword('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to sign in.') }
    finally { setBusy(false) }
  }
  const complete = (value: unknown) => {
    const saved = value as Result
    if (saved.token && saved.member) { persistMemberSession(saved.token,saved.member); setSignedIn(true) }
    setResult(saved)
  }
  const checkout = () => {
    if (!result) return
    saveFamilyCheckoutSelections(result.payerMemberId,result.pendingEnrollments)
    window.location.assign('/?enrollment=review')
  }
  return <div className="min-h-screen bg-gray-50 px-4 pb-12 pt-below-site-header"><main className="mx-auto mt-8 max-w-4xl rounded-2xl border bg-white p-6 sm:p-8"><h1 className="mb-3 text-2xl font-bold">Your Vortex registration</h1>{error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}{!info ? <form onSubmit={login} className="max-w-lg space-y-4"><p>Use the username and temporary password in your invitation email to finish setting up your family account. If you already completed setup, use your current username and password.</p><label className="block font-medium">Username<input className="mt-1 w-full rounded-lg border p-3" autoComplete="username" required value={username} onChange={event=>setUsername(event.target.value)} /></label><label className="block font-medium">Password<input className="mt-1 w-full rounded-lg border p-3" type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} /></label><button className="rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={busy || !token || !inviteId}>{busy ? 'Signing in…' : 'Sign in to finish registration'}</button></form> : <><p className="mb-4 text-sm text-slate-600">{result ? 'Your family account is ready. Continue with the class links below.' : `Confirm your family details and choose a new password. Reserved class places are held until ${new Date(info.expiresAt).toLocaleDateString()}; payment is required to confirm enrollment.`}</p>{info.instructions && <p className="mb-5 whitespace-pre-wrap rounded-lg bg-blue-50 p-4">{info.instructions}</p>}{!result && setup ? <FamilySignupWizard mode="waivers-memberships" leadRegistration={setup} onComplete={complete} /> : <section className="space-y-4"><h2 className="text-xl font-semibold">Next: your classes</h2>{!signedIn && <p className="rounded-lg bg-amber-50 p-4">Account setup succeeded. Sign in to your Member Portal with your new credentials to continue.</p>}{result && result.pendingEnrollments.length > 0 && <button className="rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white" onClick={checkout}>Review reserved classes and complete payment</button>}<ul className="space-y-3">{info.selections.map((selection,index)=><li key={index} className={`rounded-lg border p-4 ${params.get('selection') === String(index) ? 'border-red-500' : ''}`}><p className="font-semibold">{selection.childName ? `${selection.childName} · ` : ''}{selection.label}</p>{selection.kind === 'reserved' ? <p className="mt-1 text-sm text-slate-600">{result?.pendingEnrollments.length ? 'Use the payment button above to review reserved classes for all children.' : 'Open your Member Portal to view this enrollment.'}</p> : <a className="mt-2 inline-block font-semibold text-vortex-red underline" href={`/enroll?${new URLSearchParams({ programsId:String(selection.programsId), ...(selection.schedulingFormId ? {form:String(selection.schedulingFormId)} : {}) })}`}>Choose {selection.kind === 'program' ? 'a class in this program' : 'a time for this class'}</a>}</li>)}</ul><a className="inline-block font-semibold text-vortex-red underline" href="/?enrollment=review">Go to Member Portal</a>{info.selections.length === 0 && <a className="ml-4 inline-block font-semibold text-vortex-red underline" href="/enroll">Browse classes</a>}</section>}</>}</main></div>
}
