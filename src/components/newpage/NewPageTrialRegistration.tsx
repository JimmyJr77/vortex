import { trackBookingConfirmation, trackEvent } from '../../utils/analyticsClient'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Loader2, Plus } from 'lucide-react'
import FamilySignupWizard, { type FreeTrialSignupSelection } from '../signup/FamilySignupWizard'
import SignupBirthdayField from '../signup/SignupBirthdayField'
import SignupPasswordInput from '../signup/SignupPasswordInput'
import WaiverSigningBlock from '../signup/WaiverSigningBlock'
import { validateWaiverSigning, type PublicWaiverTemplate } from '../signup/waiverSigningUtils'
import { getApiUrl } from '../../utils/api'
import { getBusinessAcquisition } from '../../utils/businessAcquisition'
import { calculateAge, formatDateForDisplay, isAdult } from '../../utils/dateUtils'
import { clearPortalSession, getMemberSessionToken, loginMemberWithCredentials, persistMemberSession } from '../../utils/portalSession'
import './NewPageTrialRegistration.css'

export type { FreeTrialSignupSelection }

interface Props {
  selection: FreeTrialSignupSelection
  sourcePath?: string
  onBack: () => void
  onComplete?: () => void
}

interface TrialFamilyMember {
  id: number
  first_name: string
  last_name: string
  date_of_birth: string | null
  ageGroup: 'adult' | 'youth' | 'unknown'
  canSignWaiver: boolean
}

function clockTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
}

export default function NewPageTrialRegistration({ selection, sourcePath = '/', onBack, onComplete }: Props) {
  const apiUrl = getApiUrl()
  const [token, setToken] = useState(getMemberSessionToken)
  const [view, setView] = useState<'new' | 'login'>('new')
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [members, setMembers] = useState<TrialFamilyMember[]>([])
  const [canAddChild, setCanAddChild] = useState(false)
  const [memberId, setMemberId] = useState<number | null>(null)
  const [waivers, setWaivers] = useState<PublicWaiverTemplate[]>([])
  const [checkedTemplateIds, setCheckedTemplateIds] = useState<number[]>([])
  const [agreeAll, setAgreeAll] = useState(false)
  const [pottyTrainedConfirmed, setPottyTrainedConfirmed] = useState(false)
  const [signatureName, setSignatureName] = useState('')
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingFamily, setLoadingFamily] = useState(Boolean(token))
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [child, setChild] = useState({ firstName: '', lastName: '', dateOfBirth: '', hasLegalAuthority: false })
  const errorRef = useRef<HTMLDivElement>(null)
  const successRef = useRef<HTMLHeadingElement>(null)
  const selectedMember = members.find(member => member.id === memberId)
  const children = members.filter(member => member.ageGroup === 'youth' && member.canSignWaiver)
  const dateLabel = formatDateForDisplay(selection.classDate, { weekday: 'long', month: 'long', day: 'numeric' })
  const isEvaluation = selection.program === 'gymnastics' && selection.gymnasticsTrack === 'experienced' && selection.experience === 'experienced'

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  useEffect(() => {
    if (confirmed) successRef.current?.focus()
  }, [confirmed])

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    setLoadingFamily(true)
    setError(null)
    void (async () => {
      try {
        const [familyRes, waiversRes] = await Promise.all([
          fetch(`${apiUrl}/api/members/family`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }),
          fetch(`${apiUrl}/api/signup/waivers`, { signal: controller.signal }),
        ])
        const [familyData, waiversData] = await Promise.all([familyRes.json(), waiversRes.json()])
        if (familyRes.status === 401) {
          if (getMemberSessionToken() === token) clearPortalSession()
          setToken(null)
          setView('login')
          setMemberId(null)
          throw new Error('Your session has expired. Sign in as the parent or guardian to continue.')
        }
        if (!familyRes.ok || !familyData.success) throw new Error(familyData.message || 'Unable to load your family. Sign in again or try again.')
        if (!waiversRes.ok || !waiversData.success) throw new Error(waiversData.message || 'Unable to load the current waivers. Please try again.')
        if (controller.signal.aborted) return
        setMembers((familyData.familyMembers ?? []).map((member: TrialFamilyMember) => ({ ...member, id: Number(member.id) }))
          .filter((member: TrialFamilyMember) => Number.isSafeInteger(member.id) && member.id > 0))
        setCanAddChild(familyData.householdAccess?.canAddFamilyMembers === true)
        setWaivers(waiversData.data ?? [])
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load registration.')
      } finally {
        if (!controller.signal.aborted) setLoadingFamily(false)
      }
    })()
    return () => controller.abort()
  }, [apiUrl, token, loadAttempt])

  const complete = () => {
    setConfirmed(true)
    onComplete?.()
  }

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const login = await loginMemberWithCredentials(apiUrl, { emailOrUsername: loginName.trim(), password })
      persistMemberSession(login.token, login.member)
      setMemberId(null)
      setMembers([])
      setCheckedTemplateIds([])
      setAgreeAll(false)
      setPottyTrainedConfirmed(false)
      setSignatureName('')
      setComments('')
      setToken(login.token)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  const addChild = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!child.dateOfBirth || isAdult(child.dateOfBirth)) {
      setError('Enter a valid date of birth for a child under 18.')
      return
    }
    if (!child.hasLegalAuthority) {
      setError('Confirm that you are this child’s parent or legal guardian.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/members/family`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(child),
      })
      const data = await res.json()
      if (!res.ok || !data.success || !data.data?.id) throw new Error(data.message || 'Unable to add your child.')
      setMemberId(Number(data.data.id))
      setCheckedTemplateIds([])
      setAgreeAll(false)
      setPottyTrainedConfirmed(false)
      setSignatureName('')
      setComments('')
      setAddingChild(false)
      setChild({ firstName: '', lastName: '', dateOfBirth: '', hasLegalAuthority: false })
      setLoadAttempt(attempt => attempt + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add your child.')
    } finally {
      setLoading(false)
    }
  }

  const confirmMemberTrial = async () => {
    setError(null)
    if (!selectedMember || !children.some(member => member.id === memberId)) {
      setError('Select the child who will attend. A parent or legal guardian must complete registration.')
      return
    }
    if (selection.gymnasticsTrack === 'mommy-me' && !pottyTrainedConfirmed) {
      setError('A parent or legal guardian must confirm that their child is potty trained for Mommy & Me.')
      return
    }
    const waiverError = validateWaiverSigning({ waivers, checkedTemplateIds, agreeAll, signatureName })
    if (waiverError) {
      setError(waiverError)
      return
    }
    setLoading(true)
    try {
      trackEvent('trial_confirm_submit', sourcePath, { properties: { program_slug: selection.program } })
      const res = await fetch(`${apiUrl}/api/members/free-trials/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          memberId, slotGroupId: selection.slotGroupId, classDate: selection.classDate, program: selection.program,
          acquisition: getBusinessAcquisition(),
          gymnasticsTrack: selection.gymnasticsTrack,
          pottyTrained: selection.gymnasticsTrack === 'mommy-me' ? pottyTrainedConfirmed : selection.pottyTrained,
          experience: selection.experience,
          waivers: {
            acceptedTemplateIds: checkedTemplateIds, signatureName, comments,
            paymentPolicyAcknowledged: agreeAll && waivers.some(waiver => waiver.waiver_type === 'PAYMENT_POLICY' && checkedTemplateIds.includes(waiver.id)),
          },
        }),
      })
      const data = await res.json()
      if (res.status === 401) {
        if (getMemberSessionToken() === token) clearPortalSession()
        setToken(null)
        setView('login')
        setMemberId(null)
        throw new Error('Your session has expired. Sign in as the parent or guardian to continue.')
      }
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to confirm your free trial.')
      if (data.data?.status !== 'confirmed' || data.data?.benefitType !== 'free_trial' || data.data?.totalCents !== 0) {
        throw new Error(`We could not verify this ${isEvaluation ? 'evaluation' : 'free trial'}. Please contact Vortex before attending.`)
      }
      trackBookingConfirmation('trial_confirmed', sourcePath, data.data.id, { program_slug: selection.program })
      complete()
    } catch (err) {
      trackEvent('trial_confirm_error', sourcePath, { properties: { program_slug: selection.program } })
      setError(err instanceof Error ? err.message : 'Unable to confirm your free trial.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="np-trial-registration">
    {!confirmed && <button type="button" className="np-trial-text-button" onClick={onBack} disabled={loading}>
      <ArrowLeft aria-hidden="true" size={16} /> {isEvaluation ? 'Change evaluation time' : 'Change class'}
    </button>}
    <div className="np-trial-booking-summary">
      <div>
        <span className="np-trial-eyebrow">{isEvaluation ? confirmed ? 'Your confirmed evaluation' : 'Your free private evaluation' : confirmed ? 'Your confirmed class' : 'Your free trial'}</span>
        <h3>{selection.className}</h3>
        <p>{dateLabel}</p>
        <p>{clockTime(selection.startTime)}–{clockTime(selection.endTime)}</p>
        {isEvaluation && <p>30 minutes · 1:1 with a coach</p>}
      </div>
      <strong>$0<span>No payment required</span></strong>
    </div>

    {confirmed ? <div className="np-trial-confirmed" role="status">
      <span className="np-trial-confirmed-icon"><Check aria-hidden="true" size={28} /></span>
      <h3 ref={successRef} tabIndex={-1}>{isEvaluation ? 'Their private evaluation is booked.' : 'You’re in. Let’s get moving.'}</h3>
      <p>Your child’s {isEvaluation ? 'free private evaluation' : 'free trial'} is confirmed{selectedMember ? ` for ${selectedMember.first_name}` : ''}. Registration and waivers are complete, and nothing is due.</p>
      <p>We look forward to seeing you on {dateLabel} at {clockTime(selection.startTime)}.</p>
      <a href="/?login=1" className="np-trial-text-button">Visit the member portal</a>
    </div> : <>
      <p className="np-trial-registration-intro">A parent or legal guardian must register the athlete and sign the waivers. {isEvaluation ? 'This free evaluation is a private 30-minute session with a coach to recommend the right class.' : 'One free trial per athlete, for life.'}</p>
      {error && <div ref={errorRef} tabIndex={-1} className="np-trial-registration-error" role="alert">{error}</div>}

      {!token ? <>
        <div className="np-trial-account-choice" role="group" aria-label="Choose account option">
          <button type="button" disabled={loading} aria-pressed={view === 'new'} onClick={() => { setView('new'); setError(null) }}>New family</button>
          <button type="button" disabled={loading} aria-pressed={view === 'login'} onClick={() => { setView('login'); setError(null) }}>Already a member</button>
        </div>
        {view === 'new' ? <FamilySignupWizard freeTrial={selection} trialSourcePath={sourcePath} onComplete={complete} /> : <form onSubmit={signIn} className="np-trial-form">
          <h3>Sign in as the parent or guardian</h3>
          <label htmlFor="np-trial-login">Email or username</label>
          <input id="np-trial-login" autoComplete="username" required value={loginName} onChange={event => setLoginName(event.target.value)} />
          <label htmlFor="np-trial-password">Password</label>
          <SignupPasswordInput id="np-trial-password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
          <button type="submit" className="np-trial-primary-button" disabled={loading}>{loading && <Loader2 className="animate-spin" size={18} aria-hidden="true" />} Sign in and continue</button>
        </form>}
      </> : loadingFamily ? <p className="np-trial-registration-loading" role="status"><Loader2 className="animate-spin" size={20} aria-hidden="true" /> Loading your family and waivers…</p> : <>
        <div className="np-trial-family-heading">
          <h3>{isEvaluation ? 'Who’s coming for an evaluation?' : 'Who’s coming to class?'}</h3>
          <button type="button" className="np-trial-text-button" disabled={loading} onClick={() => { setToken(null); setView('login'); setMemberId(null); setError(null); setCheckedTemplateIds([]); setAgreeAll(false); setPottyTrainedConfirmed(false); setSignatureName(''); setComments('') }}>Use another account</button>
        </div>
        {error && <button type="button" className="np-trial-text-button" disabled={loading} onClick={() => setLoadAttempt(attempt => attempt + 1)}>Reload family and waivers</button>}
        {children.length > 0 ? <fieldset className="np-trial-child-options">
          <legend>Select your child</legend>
          {children.map(member => <label key={member.id} className={memberId === member.id ? 'is-selected' : ''}>
            <input type="radio" name="np-trial-child" value={member.id} checked={memberId === member.id} disabled={loading} onChange={() => { setMemberId(member.id); setCheckedTemplateIds([]); setAgreeAll(false); setPottyTrainedConfirmed(false); setSignatureName(''); setComments(''); setError(null) }} />
            <span><strong>{member.first_name} {member.last_name}</strong><span>Age {calculateAge(member.date_of_birth) ?? 'not available'}</span></span>
          </label>)}
        </fieldset> : <p className="np-trial-registration-intro">There are no children you can register with this account. Sign in as their parent or legal guardian{canAddChild ? ', or add your child below.' : '. Contact the gym if your family details need updating.'}</p>}

        {canAddChild && !addingChild && <button type="button" className="np-trial-text-button" disabled={loading} onClick={() => setAddingChild(true)}><Plus aria-hidden="true" size={16} /> Add a child to your family</button>}
        {addingChild && <form className="np-trial-form np-trial-add-child" onSubmit={addChild}>
          <h3>Add your child</h3>
          <label htmlFor="np-trial-child-first">First name</label><input id="np-trial-child-first" required value={child.firstName} onChange={event => setChild(current => ({ ...current, firstName: event.target.value }))} />
          <label htmlFor="np-trial-child-last">Last name</label><input id="np-trial-child-last" required value={child.lastName} onChange={event => setChild(current => ({ ...current, lastName: event.target.value }))} />
          <SignupBirthdayField id="np-trial-child-birthday" value={child.dateOfBirth} onChange={dateOfBirth => setChild(current => ({ ...current, dateOfBirth }))} />
          <label className="np-trial-legal-checkbox"><input type="checkbox" checked={child.hasLegalAuthority} onChange={event => setChild(current => ({ ...current, hasLegalAuthority: event.target.checked }))} /> I am this child’s parent or legal guardian and have authority to register them.</label>
          <div className="np-trial-button-row"><button type="button" className="np-trial-text-button" disabled={loading} onClick={() => setAddingChild(false)}>Cancel</button><button type="submit" className="np-trial-primary-button" disabled={loading}>{loading && <Loader2 className="animate-spin" size={18} aria-hidden="true" />} Add child</button></div>
        </form>}

        {selectedMember && !addingChild && <div className="np-trial-member-waivers">
          <h3>Review and sign for {selectedMember.first_name}</h3>
          {selection.gymnasticsTrack === 'mommy-me' && <label className="np-trial-potty-confirmation">
            <input type="checkbox" required checked={pottyTrainedConfirmed} disabled={loading} onChange={event => setPottyTrainedConfirmed(event.target.checked)} />
            <span>I am this child’s parent or legal guardian and confirm that my child is potty trained. This is required for Mommy &amp; Me.</span>
          </label>}
          <WaiverSigningBlock waivers={waivers} checkedTemplateIds={checkedTemplateIds}
            onToggleTemplate={(id, checked) => setCheckedTemplateIds(current => checked ? [...current, id] : current.filter(item => item !== id))}
            agreeAll={agreeAll} onAgreeAllChange={setAgreeAll} signatureName={signatureName} onSignatureNameChange={setSignatureName} comments={comments} onCommentsChange={setComments} readOnly={loading} />
          <button type="button" className="np-trial-primary-button" disabled={loading || waivers.length === 0} onClick={() => void confirmMemberTrial()}>{loading && <Loader2 className="animate-spin" size={18} aria-hidden="true" />} {isEvaluation ? 'Confirm free evaluation · $0' : 'Confirm free trial · $0'}</button>
        </div>}
      </>}
    </>}
  </div>
}
