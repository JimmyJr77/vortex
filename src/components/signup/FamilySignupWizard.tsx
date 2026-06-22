import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, UserPlus } from 'lucide-react'
import { getApiUrl, adminApiRequest } from '../../utils/api'
import { formatPhoneNumber, PHONE_INPUT_MAX_LENGTH, PHONE_INPUT_PLACEHOLDER } from '../../utils/phoneUtils'
import { isAdult } from '../../utils/dateUtils'
import WaiverSigningBlock, { validateWaiverSigning, type PublicWaiverTemplate } from './WaiverSigningBlock'

type WizardMode = 'public' | 'admin' | 'minor-start'

interface SignupMemberForm {
  clientId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  addressStreet: string
  addressCity: string
  addressState: string
  addressZip: string
  dateOfBirth: string
  gender: string
  username: string
  password: string
  confirmPassword: string
  sameContactAsPrimary?: boolean
}

interface ProgramOption {
  id: number
  name: string
  display_name?: string
}

interface EnrollmentRow {
  memberClientId: string
  programId: number | ''
}

interface FamilyOption {
  id: number
  familyName: string
  familyUsername?: string
  memberCount?: number
}

const emptyMember = (): SignupMemberForm => ({
  clientId: crypto.randomUUID(),
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

interface FamilySignupWizardProps {
  mode?: WizardMode
  onComplete?: (result: unknown) => void
  onCancel?: () => void
}

export default function FamilySignupWizard({
  mode = 'public',
  onComplete,
  onCancel,
}: FamilySignupWizardProps) {
  const apiUrl = getApiUrl()
  const isAdmin = mode === 'admin'
  const isMinorStart = mode === 'minor-start'

  const [step, setStep] = useState(isAdmin ? 0 : 1)
  const [familyMode, setFamilyMode] = useState<'new' | 'existing'>('new')
  const [existingFamilyId, setExistingFamilyId] = useState<number | null>(null)
  const [familySearch, setFamilySearch] = useState('')
  const [familyPassword, setFamilyPassword] = useState('')
  const [familyOptions, setFamilyOptions] = useState<FamilyOption[]>([])
  const [primaryAdult, setPrimaryAdult] = useState<SignupMemberForm>(emptyMember)
  const [additionalMembers, setAdditionalMembers] = useState<SignupMemberForm[]>([])
  const [parentEmail, setParentEmail] = useState('')
  const [programs, setPrograms] = useState<ProgramOption[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [waivers, setWaivers] = useState<PublicWaiverTemplate[]>([])
  const [checkedTemplateIds, setCheckedTemplateIds] = useState<number[]>([])
  const [agreeAll, setAgreeAll] = useState(false)
  const [signatureName, setSignatureName] = useState('')
  const [comments, setComments] = useState('')
  const [paymentPolicyAcknowledged, setPaymentPolicyAcknowledged] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const allAthletes = useMemo(() => {
    const athletes: SignupMemberForm[] = []
    if (!isMinorStart) athletes.push(primaryAdult)
    athletes.push(...additionalMembers)
    return athletes.filter((m) => m.firstName && m.lastName)
  }, [primaryAdult, additionalMembers, isMinorStart])

  const loadProgramsAndWaivers = useCallback(async () => {
    try {
      const [programsRes, waiversRes] = await Promise.all([
        fetch(`${apiUrl}/api/signup/programs`),
        fetch(`${apiUrl}/api/signup/waivers`),
      ])
      const programsData = await programsRes.json()
      const waiversData = await waiversRes.json()
      setPrograms(programsData.data ?? [])
      setWaivers(waiversData.data ?? [])
    } catch {
      setError('Failed to load programs or waivers.')
    }
  }, [apiUrl])

  useEffect(() => {
    void loadProgramsAndWaivers()
  }, [loadProgramsAndWaivers])

  useEffect(() => {
    if (isMinorStart && additionalMembers.length === 0) {
      setAdditionalMembers([emptyMember()])
    }
  }, [isMinorStart, additionalMembers.length])

  const searchFamilies = async () => {
    if (!familySearch.trim()) return
    try {
      const res = await adminApiRequest(`/api/admin/families/search?search=${encodeURIComponent(familySearch.trim())}`)
      const data = await res.json()
      setFamilyOptions(data.data ?? [])
    } catch {
      setError('Failed to search families.')
    }
  }

  const verifyExistingFamily = async () => {
    if (!existingFamilyId || !familyPassword) {
      setError('Select a family and enter the family password.')
      return false
    }
    try {
      const res = await adminApiRequest('/api/admin/families/verify', {
        method: 'POST',
        body: JSON.stringify({ familyId: existingFamilyId, familyPassword }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Family verification failed')
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Family verification failed')
      return false
    }
  }

  const renderMemberFields = (
    member: SignupMemberForm,
    onChange: (updates: Partial<SignupMemberForm>) => void,
    { showLogin = true, showSameContact = false } = {},
  ) => (
    <div className="grid gap-3 md:grid-cols-2">
      {showSameContact && (
        <label className="md:col-span-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={member.sameContactAsPrimary === true}
            onChange={(e) => onChange({ sameContactAsPrimary: e.target.checked })}
          />
          Same email/phone as primary adult
        </label>
      )}
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="First name *" value={member.firstName} onChange={(e) => onChange({ firstName: e.target.value })} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Last name *" value={member.lastName} onChange={(e) => onChange({ lastName: e.target.value })} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="email" placeholder="Email" value={member.email} onChange={(e) => onChange({ email: e.target.value })} disabled={member.sameContactAsPrimary} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="tel" placeholder={PHONE_INPUT_PLACEHOLDER} maxLength={PHONE_INPUT_MAX_LENGTH} value={member.phone} onChange={(e) => onChange({ phone: formatPhoneNumber(e.target.value) })} disabled={member.sameContactAsPrimary} />
      <input className="md:col-span-2 h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Street address" value={member.addressStreet} onChange={(e) => onChange({ addressStreet: e.target.value })} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="City" value={member.addressCity} onChange={(e) => onChange({ addressCity: e.target.value })} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="State" value={member.addressState} onChange={(e) => onChange({ addressState: e.target.value })} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="ZIP" value={member.addressZip} onChange={(e) => onChange({ addressZip: e.target.value })} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="date" value={member.dateOfBirth} onChange={(e) => onChange({ dateOfBirth: e.target.value })} />
      <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={member.gender} onChange={(e) => onChange({ gender: e.target.value })}>
        <option value="">Gender</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
        <option value="non-binary">Non-binary</option>
        <option value="prefer-not-to-say">Prefer not to say</option>
      </select>
      {showLogin && (!member.dateOfBirth || isAdult(member.dateOfBirth)) && (
        <>
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Username" value={member.username} onChange={(e) => onChange({ username: e.target.value })} />
          <div />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" placeholder="Password" value={member.password} onChange={(e) => onChange({ password: e.target.value })} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" placeholder="Confirm password" value={member.confirmPassword} onChange={(e) => onChange({ confirmPassword: e.target.value })} />
        </>
      )}
    </div>
  )

  const validatePrimaryStep = () => {
    if (isMinorStart) {
      const minor = additionalMembers[0]
      if (!minor?.firstName || !minor?.lastName) return 'Minor first and last name are required.'
      if (!minor.dateOfBirth || isAdult(minor.dateOfBirth)) return 'Minor must be under 18.'
      if (!parentEmail.trim()) return 'Parent/guardian email is required.'
      return null
    }
    if (!primaryAdult.firstName || !primaryAdult.lastName) return 'First and last name are required.'
    if (!primaryAdult.dateOfBirth || !isAdult(primaryAdult.dateOfBirth)) return 'Primary account holder must be 18 or older.'
    if (!primaryAdult.password || primaryAdult.password.length < 8) return 'Password must be at least 8 characters.'
    if (primaryAdult.password !== primaryAdult.confirmPassword) return 'Passwords do not match.'
    return null
  }

  const buildPayload = () => {
    const memberIndexMap = new Map<string, number>()
    if (!isMinorStart) memberIndexMap.set(primaryAdult.clientId, 0)
    additionalMembers.forEach((member, idx) => {
      memberIndexMap.set(member.clientId, isMinorStart ? idx : idx + 1)
    })

    return {
      existingFamilyId: isAdmin && familyMode === 'existing' ? existingFamilyId : null,
      primaryAdult: isMinorStart ? undefined : primaryAdult,
      additionalMembers: (isMinorStart ? additionalMembers.slice(0, 1) : additionalMembers).map((member) => ({
        ...member,
        ...(member.sameContactAsPrimary
          ? {
              email: primaryAdult.email,
              phone: primaryAdult.phone,
              addressStreet: primaryAdult.addressStreet,
              addressCity: primaryAdult.addressCity,
              addressState: primaryAdult.addressState,
              addressZip: primaryAdult.addressZip,
            }
          : {}),
      })),
      enrollments: enrollments
        .filter((row) => row.programId !== '')
        .map((row) => ({
          memberIndex: memberIndexMap.get(row.memberClientId) ?? 0,
          programId: Number(row.programId),
          daysPerWeek: 1,
        })),
      waivers: {
        signatureName,
        comments,
        acceptedTemplateIds: checkedTemplateIds,
        paymentPolicyAcknowledged,
      },
    }
  }

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

    setLoading(true)
    setError(null)
    try {
      if (isMinorStart) {
        const minor = additionalMembers[0]
        const payload = {
          minor,
          parentEmail,
          enrollments: enrollments
            .filter((row) => row.programId !== '')
            .map((row) => ({ programId: Number(row.programId), daysPerWeek: 1 })),
        }
        const res = await fetch(`${apiUrl}/api/signup/minor-start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Signup failed')
        setSuccessMessage(
          data.data?.inviteSent
            ? 'Invite sent! A parent/guardian will receive an email to complete signup.'
            : `Invite created. Share this link: ${data.data?.inviteUrl ?? ''}`,
        )
        onComplete?.(data.data)
        return
      }

      const payload = buildPayload()
      const endpoint = isAdmin ? '/api/admin/signup/family' : '/api/signup/family'
      const res = isAdmin
        ? await adminApiRequest(endpoint, { method: 'POST', body: JSON.stringify(payload) })
        : await fetch(`${apiUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Signup failed')
      setSuccessMessage('Account created successfully!')
      onComplete?.(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const maxStep = isMinorStart ? 3 : 4

  const goNext = async () => {
    setError(null)
    if (step === 0 && isAdmin) {
      if (familyMode === 'existing') {
        const ok = await verifyExistingFamily()
        if (!ok) return
      }
      setStep(1)
      return
    }
    if (step === 1) {
      const err = validatePrimaryStep()
      if (err) {
        setError(err)
        return
      }
      if (isMinorStart) {
        setStep(2)
        return
      }
    }
    if (step === 2 && !isMinorStart) {
      // family members step — optional
    }
    if (step === maxStep) {
      await submit()
      return
    }
    setStep((prev) => prev + 1)
  }

  if (successMessage) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-3">
        <h3 className="text-lg font-bold text-green-800">Success</h3>
        <p className="text-sm text-green-700">{successMessage}</p>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-vortex-red text-white rounded-lg text-sm font-semibold">
            Close
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {isMinorStart ? 'Youth signup — invite a parent' : isAdmin ? 'Create Vortex account' : 'Join Vortex Athletics'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Step {step + (isAdmin ? 0 : 0)} of {maxStep + (isAdmin ? 0 : 0)} —{' '}
          {step === 0 && isAdmin && 'Family setup'}
          {step === 1 && (isMinorStart ? 'Athlete info' : 'Primary adult')}
          {step === 2 && (isMinorStart ? 'Enrollment' : 'Family members')}
          {step === 3 && (isMinorStart ? 'Review & send invite' : 'Enrollment')}
          {step === 4 && 'Waivers'}
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {step === 0 && isAdmin && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <button type="button" onClick={() => setFamilyMode('new')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${familyMode === 'new' ? 'bg-vortex-red text-white' : 'border border-gray-300'}`}>
              New family
            </button>
            <button type="button" onClick={() => setFamilyMode('existing')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${familyMode === 'existing' ? 'bg-vortex-red text-white' : 'border border-gray-300'}`}>
              Falls under existing family
            </button>
          </div>
          {familyMode === 'existing' && (
            <div className="space-y-3 rounded-xl border border-gray-200 p-4">
              <div className="flex gap-2">
                <input className="flex-1 h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Search family name or username" value={familySearch} onChange={(e) => setFamilySearch(e.target.value)} />
                <button type="button" onClick={() => void searchFamilies()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Search</button>
              </div>
              <select className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" value={existingFamilyId ?? ''} onChange={(e) => setExistingFamilyId(Number(e.target.value) || null)}>
                <option value="">Select family</option>
                {familyOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.familyName} ({f.familyUsername})</option>
                ))}
              </select>
              <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" placeholder="Family password" value={familyPassword} onChange={(e) => setFamilyPassword(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {step === 1 && !isMinorStart && (
        <div className="rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Primary adult (parent/guardian or adult athlete)</h3>
          {renderMemberFields(primaryAdult, (updates) => setPrimaryAdult((prev) => ({ ...prev, ...updates })), { showLogin: true })}
        </div>
      )}

      {step === 1 && isMinorStart && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Youth athlete (under 18)</h3>
            {additionalMembers[0] && renderMemberFields(
              additionalMembers[0],
              (updates) => setAdditionalMembers((prev) => [{ ...prev[0], ...updates }]),
              { showLogin: false },
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Parent/guardian email *</label>
            <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} placeholder="parent@example.com" />
          </div>
        </div>
      )}

      {step === 2 && !isMinorStart && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Additional family members</h3>
            <button type="button" onClick={() => setAdditionalMembers((prev) => [...prev, emptyMember()])} className="inline-flex items-center gap-1 text-sm text-vortex-red font-semibold">
              <Plus className="w-4 h-4" /> Add member
            </button>
          </div>
          {additionalMembers.length === 0 && <p className="text-sm text-gray-500">No additional members yet. Skip if only one athlete.</p>}
          {additionalMembers.map((member, index) => (
            <div key={member.clientId} className="rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-800">Family member {index + 1}</span>
                <button type="button" onClick={() => setAdditionalMembers((prev) => prev.filter((m) => m.clientId !== member.clientId))} className="text-gray-500 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {renderMemberFields(
                member,
                (updates) => setAdditionalMembers((prev) => prev.map((m) => (m.clientId === member.clientId ? { ...m, ...updates } : m))),
                { showLogin: true, showSameContact: true },
              )}
            </div>
          ))}
        </div>
      )}

      {((step === 2 && isMinorStart) || (step === 3 && !isMinorStart)) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Program enrollment</h3>
            <button
              type="button"
              onClick={() => setEnrollments((prev) => [...prev, { memberClientId: allAthletes[0]?.clientId ?? primaryAdult.clientId, programId: '' }])}
              className="inline-flex items-center gap-1 text-sm text-vortex-red font-semibold"
            >
              <UserPlus className="w-4 h-4" /> Add enrollment
            </button>
          </div>
          {enrollments.length === 0 && <p className="text-sm text-gray-500">Optional: add class enrollments now or enroll later from scheduling.</p>}
          {enrollments.map((row, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-2">
              <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={row.memberClientId} onChange={(e) => setEnrollments((prev) => prev.map((r, i) => (i === index ? { ...r, memberClientId: e.target.value } : r)))}>
                {allAthletes.map((m) => (
                  <option key={m.clientId} value={m.clientId}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
              <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={row.programId} onChange={(e) => setEnrollments((prev) => prev.map((r, i) => (i === index ? { ...r, programId: e.target.value === '' ? '' : Number(e.target.value) } : r)))}>
                <option value="">Select program</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {step === 3 && isMinorStart && (
        <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
          <p>We&apos;ll email your parent/guardian a secure link to create the adult account, sign waivers on your behalf, and finalize enrollment.</p>
        </div>
      )}

      {step === 4 && !isMinorStart && (
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
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          disabled={step <= (isAdmin ? 0 : 1) || loading}
          onClick={() => setStep((prev) => Math.max(isAdmin ? 0 : 1, prev - 1))}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => void goNext()}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {step >= maxStep ? (isMinorStart ? 'Send invite' : 'Create account') : 'Continue'}
            {step < maxStep && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
