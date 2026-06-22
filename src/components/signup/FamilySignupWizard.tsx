import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Loader2, Plus, Trash2, UserPlus } from 'lucide-react'
import { getApiUrl, adminApiRequest } from '../../utils/api'
import { cleanPhoneNumber, formatPhoneForDisplay, formatPhoneNumber, PHONE_INPUT_MAX_LENGTH } from '../../utils/phoneUtils'
import { formatDateForInput, isAdult } from '../../utils/dateUtils'
import { maybeSuggestUsername } from '../../utils/signupUsername'
import { graduationYearsForPicker } from '../../utils/promoDiscountModel'
import { US_STATES, verifyUsAddressZip } from '../../utils/usStates'
import SchoolAutocompleteInput from '../scheduling/SchoolAutocompleteInput'
import FamilySearchCombobox, { type FamilySearchOption } from './FamilySearchCombobox'
import WaiverSigningBlock, { validateWaiverSigning, type PublicWaiverTemplate } from './WaiverSigningBlock'

type WizardMode = 'public' | 'admin' | 'minor-start' | 'admin-edit'
type EmailSource = 'parent' | 'youth'

function parseAddress(address: string | null | undefined): { street: string; city: string; state: string; zip: string } {
  if (!address) return { street: '', city: '', state: '', zip: '' }
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 3) {
    const street = parts[0]
    const city = parts[1]
    const stateZipParts = (parts[2] || '').split(/\s+/).filter(Boolean)
    if (stateZipParts.length >= 2) {
      return { street, city, state: stateZipParts[0], zip: stateZipParts.slice(1).join(' ') }
    }
    if (stateZipParts.length === 1) {
      const value = stateZipParts[0]
      return value.length === 2
        ? { street, city, state: value, zip: '' }
        : { street, city, state: '', zip: value }
    }
    return { street, city, state: '', zip: '' }
  }
  if (parts.length === 2) return { street: parts[0], city: parts[1], state: '', zip: '' }
  return { street: address, city: '', state: '', zip: '' }
}

function combineAddress(street: string, city: string, state: string, zip: string): string {
  const parts: string[] = []
  if (street.trim()) parts.push(street.trim())
  if (city.trim()) parts.push(city.trim())
  const stateZip = [state.trim(), zip.trim()].filter(Boolean).join(' ')
  if (stateZip) parts.push(stateZip)
  return parts.join(', ')
}

interface ApiMemberRecord {
  id: number
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  username?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  address?: string | null
  billingStreet?: string | null
  billingCity?: string | null
  billingState?: string | null
  billingZip?: string | null
  graduationYear?: number | null
  currentSchool?: string | null
}

interface SignupMemberForm {
  clientId: string
  memberId?: number
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
  emailSource?: EmailSource
  useParentPassword?: boolean
  currentSchool?: string
  graduationYear?: number | ''
}

interface TopProgramOption {
  id: number
  name: string
  displayName?: string | null
}

interface ClassOption {
  id: number
  name: string
  displayName?: string | null
  schedulingFormId?: number | null
}

interface OfferingOption {
  id: number
  label: string | null
  startDate: string
  endDate: string
}

interface ScheduleOption {
  slotGroupId: number
  timeSlotId: number
  offeringId: number | null
  offeringLabel: string | null
  offeringDates: string | null
  scheduleLabel: string
  priceCents: number | null
  priceLabel: string | null
}

interface ClassCatalogPack {
  formId: number | null
  offerings: OfferingOption[]
  scheduleOptions: ScheduleOption[]
  priceLabel?: string | null
}

interface EnrollmentRow {
  memberClientId: string
  programsId: number | ''
  classEventId: number | ''
  offeringIds: number[]
  selectedSlotKeys: string[]
  schedulingFormId?: number
  slotGroupId?: number
  timeSlotId?: number
  locked?: boolean
}

function slotOptionKey(slotGroupId: number, timeSlotId: number) {
  return `${slotGroupId}:${timeSlotId}`
}

interface EnrollPrefill {
  locked: boolean
  formId: number
  programsId: number | null
  classEventId: number | null
  offeringId?: number
  slotGroupId?: number
  timeSlotId?: number
  classDisplayName?: string | null
  programDisplayName?: string | null
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
  emailSource: 'parent',
  useParentPassword: false,
  currentSchool: '',
  graduationYear: '',
})

const emptyEnrollment = (): EnrollmentRow => ({
  memberClientId: '',
  programsId: '',
  classEventId: '',
  offeringIds: [],
  selectedSlotKeys: [],
})

interface FamilySignupWizardProps {
  mode?: WizardMode
  editMemberId?: number | null
  returnTo?: string | null
  onComplete?: (result: unknown) => void
  onCancel?: () => void
}

function mapApiMemberToForm(
  record: ApiMemberRecord,
  primaryEmail?: string,
  billing?: { billingStreet?: string | null; billingCity?: string | null; billingState?: string | null; billingZip?: string | null },
): SignupMemberForm {
  const addressSource = record.address
    || (record.billingStreet ? combineAddress(record.billingStreet, record.billingCity || '', record.billingState || '', record.billingZip || '') : '')
    || (billing?.billingStreet ? combineAddress(billing.billingStreet, billing.billingCity || '', billing.billingState || '', billing.billingZip || '') : '')
  const addressParts = parseAddress(addressSource)
  const email = record.email || ''
  const emailSource: EmailSource = primaryEmail && email && email.toLowerCase() !== primaryEmail.toLowerCase() ? 'youth' : 'parent'
  return {
    clientId: crypto.randomUUID(),
    memberId: record.id,
    firstName: record.firstName || '',
    lastName: record.lastName || '',
    email,
    phone: formatPhoneForDisplay(record.phone),
    addressStreet: addressParts.street,
    addressCity: addressParts.city,
    addressState: addressParts.state,
    addressZip: addressParts.zip,
    dateOfBirth: record.dateOfBirth ? formatDateForInput(record.dateOfBirth) : '',
    gender: record.gender || '',
    username: record.username || '',
    password: '',
    confirmPassword: '',
    emailSource,
    useParentPassword: false,
    currentSchool: record.currentSchool || '',
    graduationYear: record.graduationYear ?? '',
  }
}

export default function FamilySignupWizard({
  mode = 'public',
  editMemberId = null,
  returnTo = null,
  onComplete,
  onCancel,
}: FamilySignupWizardProps) {
  const apiUrl = getApiUrl()
  const isAdmin = mode === 'admin'
  const isAdminEdit = mode === 'admin-edit'
  const isMinorStart = mode === 'minor-start'

  const [step, setStep] = useState(isAdmin ? 0 : 1)
  const [accountLoaded, setAccountLoaded] = useState(!isAdminEdit)
  const [editFamilyId, setEditFamilyId] = useState<number | null>(null)
  const [savedMemberIds, setSavedMemberIds] = useState<number[]>([])
  const [familyMode, setFamilyMode] = useState<'new' | 'existing'>('new')
  const [existingFamilyId, setExistingFamilyId] = useState<number | null>(null)
  const [familySearch, setFamilySearch] = useState('')
  const [primaryAdult, setPrimaryAdult] = useState<SignupMemberForm>(emptyMember)
  const [additionalMembers, setAdditionalMembers] = useState<SignupMemberForm[]>([])
  const [parentEmail, setParentEmail] = useState('')
  const [topPrograms, setTopPrograms] = useState<TopProgramOption[]>([])
  const [classesByProgram, setClassesByProgram] = useState<Record<number, ClassOption[]>>({})
  const [offeringsByClass, setOfferingsByClass] = useState<Record<number, ClassCatalogPack>>({})
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [enrollPrefill, setEnrollPrefill] = useState<EnrollPrefill | null>(null)
  const prefillApplied = useRef(false)
  const [waivers, setWaivers] = useState<PublicWaiverTemplate[]>([])
  const [checkedTemplateIds, setCheckedTemplateIds] = useState<number[]>([])
  const [agreeAll, setAgreeAll] = useState(false)
  const [signatureName, setSignatureName] = useState('')
  const [comments, setComments] = useState('')
  const [paymentPolicyAcknowledged, setPaymentPolicyAcknowledged] = useState(false)
  const [addressVerifyMessage, setAddressVerifyMessage] = useState<string | null>(null)
  const [addressVerified, setAddressVerified] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const allAthletes = useMemo(() => {
    const athletes: SignupMemberForm[] = []
    if (!isMinorStart) athletes.push(primaryAdult)
    athletes.push(...additionalMembers)
    return athletes.filter((m) => m.firstName && m.lastName)
  }, [primaryAdult, additionalMembers, isMinorStart])

  const parentEmailOptions = useMemo(() => {
    const emails: Array<{ value: string; label: string }> = []
    if (primaryAdult.email.trim()) {
      emails.push({
        value: primaryAdult.email.trim(),
        label: `${primaryAdult.firstName || 'Primary'} ${primaryAdult.lastName || 'adult'} — ${primaryAdult.email.trim()}`,
      })
    }
    return emails
  }, [primaryAdult])

  const loadCatalogAndWaivers = useCallback(async () => {
    try {
      const [programsRes, waiversRes] = await Promise.all([
        fetch(`${apiUrl}/api/signup/catalog/programs`),
        fetch(`${apiUrl}/api/signup/waivers`),
      ])
      const programsData = await programsRes.json()
      const waiversData = await waiversRes.json()
      if (!programsRes.ok) {
        throw new Error(programsData.message || 'Failed to load programs')
      }
      if (!waiversRes.ok) {
        throw new Error(waiversData.message || 'Failed to load waivers')
      }
      setTopPrograms(programsData.data ?? [])
      setWaivers(waiversData.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load programs or waivers.')
    }
  }, [apiUrl])

  useEffect(() => {
    void loadCatalogAndWaivers()
  }, [loadCatalogAndWaivers])

  useEffect(() => {
    if (!isAdminEdit || !editMemberId) return
    let cancelled = false
    const loadAccount = async () => {
      setLoading(true)
      setError(null)
      try {
        const anchorRes = await adminApiRequest(`/api/admin/members/${editMemberId}`)
        const anchorData = await anchorRes.json()
        if (!anchorRes.ok || !anchorData.success) {
          throw new Error(anchorData.message || 'Failed to load member')
        }
        const anchor = anchorData.data as ApiMemberRecord & { familyId?: number | null }
        const familyId = anchor.familyId ?? null
        setEditFamilyId(familyId)

        if (familyId) {
          const familyRes = await adminApiRequest(`/api/admin/families/${familyId}`)
          const familyData = await familyRes.json()
          if (!familyRes.ok || !familyData.success) {
            throw new Error(familyData.message || 'Failed to load family')
          }
          const family = familyData.data
          const billing = family.billingAccount
          const payerId = billing?.payerMemberId ?? family.members?.find((m: { isFamilyPayer?: boolean }) => m.isFamilyPayer)?.id
          const memberIds: number[] = (family.members || []).map((m: { id: number }) => m.id)
          setSavedMemberIds(memberIds)

          const fullRecords = await Promise.all(
            memberIds.map(async (id) => {
              const res = await adminApiRequest(`/api/admin/members/${id}`)
              const json = await res.json()
              return json.success ? (json.data as ApiMemberRecord) : null
            }),
          )
          const records = fullRecords.filter(Boolean) as ApiMemberRecord[]
          const payerRecord = records.find((r) => r.id === payerId) || records[0]
          const others = records.filter((r) => r.id !== payerRecord?.id)
          if (!payerRecord) throw new Error('Family has no members to edit')

          const primary = mapApiMemberToForm(payerRecord, payerRecord.email || undefined, billing)
          if (!cancelled) {
            setPrimaryAdult(primary)
            setAdditionalMembers(
              others.map((m) => mapApiMemberToForm(m, primary.email || undefined, billing)),
            )
          }
        } else {
          setSavedMemberIds([anchor.id])
          if (!cancelled) {
            setPrimaryAdult(mapApiMemberToForm(anchor))
            setAdditionalMembers([])
          }
        }
        if (!cancelled) setAccountLoaded(true)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load account')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadAccount()
    return () => { cancelled = true }
  }, [isAdminEdit, editMemberId])

  useEffect(() => {
    if (!isAdminEdit || !accountLoaded || !primaryAdult.memberId) return
    void adminApiRequest(`/api/admin/members/${primaryAdult.memberId}/waivers`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success || !Array.isArray(data.data)) return
        const mapped: PublicWaiverTemplate[] = data.data.map((row: Record<string, unknown>) => ({
          id: Number(row.id),
          name: String(row.name || ''),
          version: String(row.version || ''),
          body: String(row.body || ''),
          waiver_type: row.waiver_type as string | null,
          is_required: row.is_required !== false,
          acceptance_id: row.acceptance_id != null ? Number(row.acceptance_id) : null,
          accepted_at: row.accepted_at as string | null,
        }))
        setWaivers(mapped)
        setCheckedTemplateIds(
          mapped.filter((w) => w.acceptance_id != null).map((w) => w.id),
        )
      })
      .catch(() => {})
  }, [isAdminEdit, accountLoaded, primaryAdult.memberId])

  useEffect(() => {
    if (!returnTo) return
    try {
      const url = new URL(returnTo, window.location.origin)
      const formId = url.searchParams.get('form')
      if (!formId) return
      const offeringId = url.searchParams.get('offeringId')
      const slotGroupId = url.searchParams.get('slotGroupId')
      const timeSlotId = url.searchParams.get('timeSlotId')
      void fetch(`${apiUrl}/api/signup/catalog/prefill/${formId}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.success) return
          setEnrollPrefill({
            locked: true,
            formId: Number(formId),
            programsId: data.data.programsId,
            classEventId: data.data.classEventId,
            offeringId: offeringId ? Number(offeringId) : undefined,
            slotGroupId: slotGroupId ? Number(slotGroupId) : undefined,
            timeSlotId: timeSlotId ? Number(timeSlotId) : undefined,
            classDisplayName: data.data.classDisplayName,
            programDisplayName: data.data.programDisplayName,
          })
        })
        .catch(() => {})
    } catch {
      // ignore invalid return URL
    }
  }, [returnTo, apiUrl])

  const loadClassesForProgram = useCallback(async (programsId: number) => {
    if (classesByProgram[programsId]) return
    const res = await fetch(`${apiUrl}/api/signup/catalog/programs/${programsId}/classes`)
    const data = await res.json()
    setClassesByProgram((prev) => ({ ...prev, [programsId]: data.data ?? [] }))
  }, [apiUrl, classesByProgram])

  const loadOfferingsForClass = useCallback(async (classEventId: number) => {
    if (offeringsByClass[classEventId]) return
    const res = await fetch(`${apiUrl}/api/signup/catalog/classes/${classEventId}/offerings`)
    const data = await res.json()
    const pack: ClassCatalogPack = data.data ?? {
      formId: null,
      offerings: [],
      scheduleOptions: [],
    }
    setOfferingsByClass((prev) => ({
      ...prev,
      [classEventId]: {
        formId: pack.formId ?? null,
        offerings: pack.offerings ?? [],
        scheduleOptions: pack.scheduleOptions ?? [],
        priceLabel: pack.priceLabel ?? null,
      },
    }))
  }, [apiUrl, offeringsByClass])

  const applyEnrollPrefill = useCallback(async () => {
    if (!enrollPrefill || prefillApplied.current) return
    prefillApplied.current = true
    if (enrollPrefill.programsId) {
      await loadClassesForProgram(enrollPrefill.programsId)
    }
    if (enrollPrefill.classEventId) {
      await loadOfferingsForClass(enrollPrefill.classEventId)
    }
    const offeringIds = enrollPrefill.offeringId ? [enrollPrefill.offeringId] : []
    setEnrollments([
      {
        memberClientId: '',
        programsId: enrollPrefill.programsId ?? '',
        classEventId: enrollPrefill.classEventId ?? '',
        offeringIds,
        selectedSlotKeys:
          enrollPrefill.slotGroupId != null && enrollPrefill.timeSlotId != null
            ? [slotOptionKey(enrollPrefill.slotGroupId, enrollPrefill.timeSlotId)]
            : [],
        schedulingFormId: enrollPrefill.formId,
        slotGroupId: enrollPrefill.slotGroupId,
        timeSlotId: enrollPrefill.timeSlotId,
      },
    ])
  }, [enrollPrefill, loadClassesForProgram, loadOfferingsForClass])

  useEffect(() => {
    const onEnrollmentStep = (step === 2 && isMinorStart) || (step === 3 && !isMinorStart)
    if (onEnrollmentStep && enrollPrefill) {
      void applyEnrollPrefill()
    }
  }, [step, isMinorStart, enrollPrefill, applyEnrollPrefill])

  useEffect(() => {
    const onEnrollmentStep = isMinorStart ? step === 2 : step === 3
    if (!isMinorStart || !onEnrollmentStep) return
    const minor = additionalMembers[0]
    if (!minor?.clientId) return
    setEnrollments((prev) => {
      if (prev.length === 0) {
        return [{ ...emptyEnrollment(), memberClientId: minor.clientId }]
      }
      if (prev.every((row) => !row.memberClientId)) {
        return prev.map((row, i) => (i === 0 ? { ...row, memberClientId: minor.clientId } : row))
      }
      return prev
    })
  }, [isMinorStart, step, additionalMembers])

  useEffect(() => {
    if (!primaryAdult.email.trim()) return
    setAdditionalMembers((prev) =>
      prev.map((m) =>
        m.emailSource === 'youth'
          ? m
          : { ...m, emailSource: 'parent' as EmailSource, email: '' },
      ),
    )
  }, [primaryAdult.email])

  useEffect(() => {
    if (isMinorStart && additionalMembers.length === 0) {
      setAdditionalMembers([emptyMember()])
    }
  }, [isMinorStart, additionalMembers.length])

  const suggestUsernameForMember = (
    firstName: string,
    lastName: string,
    currentUsername: string,
  ) => maybeSuggestUsername(apiUrl, firstName, lastName, currentUsername)

  const graduationYears = useMemo(() => graduationYearsForPicker(), [])

  const handleVerifyAddress = async () => {
    setAddressVerifyMessage(null)
    const result = await verifyUsAddressZip(
      primaryAdult.addressZip,
      primaryAdult.addressState,
      primaryAdult.addressCity,
    )
    setAddressVerifyMessage(result.message)
    setAddressVerified(result.ok)
  }

  const renderYouthAthleteFields = (
    member: SignupMemberForm,
    onChange: (updates: Partial<SignupMemberForm>) => void,
    fieldIdPrefix: string,
    { alwaysShow = false } = {},
  ) => {
    const showYouthFields = alwaysShow || (member.dateOfBirth !== '' && !isAdult(member.dateOfBirth))
    if (!showYouthFields) return null
    return (
      <>
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Current School</label>
          <SchoolAutocompleteInput
            id={`${fieldIdPrefix}-current-school`}
            value={member.currentSchool ?? ''}
            onChange={(value) => onChange({ currentSchool: value })}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Graduation Year</label>
          <select
            className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
            value={member.graduationYear ?? ''}
            onChange={(e) =>
              onChange({
                graduationYear: e.target.value === '' ? '' : Number(e.target.value),
              })
            }
          >
            <option value="">Select year</option>
            {graduationYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </>
    )
  }

  const renderPrimaryAdultFields = (
    member: SignupMemberForm,
    onChange: (updates: Partial<SignupMemberForm>) => void,
    _fieldIdPrefix: string,
    showLogin = true,
  ) => {
    const handleNameBlur = async () => {
      const suggested = await suggestUsernameForMember(member.firstName, member.lastName, member.username)
      if (suggested) onChange({ username: suggested })
    }

    return (
    <div className="grid gap-3 md:grid-cols-2">
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="First name *" value={member.firstName} onChange={(e) => onChange({ firstName: e.target.value })} onBlur={() => void handleNameBlur()} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Last name *" value={member.lastName} onChange={(e) => onChange({ lastName: e.target.value })} onBlur={() => void handleNameBlur()} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="email" placeholder="Email *" value={member.email} onChange={(e) => onChange({ email: e.target.value })} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="tel" placeholder="Phone number *" maxLength={PHONE_INPUT_MAX_LENGTH} value={member.phone} onChange={(e) => onChange({ phone: formatPhoneNumber(e.target.value) })} />
      <input className="md:col-span-2 h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Street address *" value={member.addressStreet} onChange={(e) => { onChange({ addressStreet: e.target.value }); setAddressVerified(false) }} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="City *" value={member.addressCity} onChange={(e) => { onChange({ addressCity: e.target.value }); setAddressVerified(false) }} />
      <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={member.addressState} onChange={(e) => { onChange({ addressState: e.target.value }); setAddressVerified(false) }}>
        <option value="">State *</option>
        {US_STATES.map((s) => (
          <option key={s.code} value={s.code}>{s.name}</option>
        ))}
      </select>
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="ZIP *" value={member.addressZip} onChange={(e) => { onChange({ addressZip: e.target.value }); setAddressVerified(false) }} />
      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void handleVerifyAddress()} className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          Verify address
        </button>
        {addressVerifyMessage && (
          <span className={`text-xs ${addressVerified ? 'text-green-700' : 'text-amber-800'}`}>{addressVerifyMessage}</span>
        )}
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Date of birth (DOB) *</label>
        <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" type="date" value={member.dateOfBirth} onChange={(e) => onChange({ dateOfBirth: e.target.value })} />
      </div>
      <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm self-end" value={member.gender} onChange={(e) => onChange({ gender: e.target.value })}>
        <option value="">Gender</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
        <option value="non-binary">Non-binary</option>
        <option value="prefer-not-to-say">Prefer not to say</option>
      </select>
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Username *" value={member.username} onChange={(e) => onChange({ username: e.target.value })} />
      {showLogin && (
        <>
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" placeholder={isAdminEdit ? 'New password (optional)' : 'Password *'} value={member.password} onChange={(e) => onChange({ password: e.target.value })} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" placeholder={isAdminEdit ? 'Confirm new password' : 'Confirm password *'} value={member.confirmPassword} onChange={(e) => onChange({ confirmPassword: e.target.value })} />
        </>
      )}
      {!showLogin && <div className="hidden md:block" aria-hidden />}
    </div>
    )
  }

  const renderMinorAthleteFields = (
    member: SignupMemberForm,
    onChange: (updates: Partial<SignupMemberForm>) => void,
    fieldIdPrefix: string,
  ) => (
    <div className="grid gap-3 md:grid-cols-2">
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="First name *" value={member.firstName} onChange={(e) => onChange({ firstName: e.target.value })} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Last name *" value={member.lastName} onChange={(e) => onChange({ lastName: e.target.value })} />
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Date of birth (DOB) *</label>
        <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" type="date" value={member.dateOfBirth} onChange={(e) => onChange({ dateOfBirth: e.target.value })} />
      </div>
      <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm self-end" value={member.gender} onChange={(e) => onChange({ gender: e.target.value })}>
        <option value="">Gender</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
        <option value="non-binary">Non-binary</option>
        <option value="prefer-not-to-say">Prefer not to say</option>
      </select>
      {renderYouthAthleteFields(member, onChange, fieldIdPrefix, { alwaysShow: true })}
    </div>
  )

  const renderFamilyMemberFields = (
    member: SignupMemberForm,
    onChange: (updates: Partial<SignupMemberForm>) => void,
    fieldIdPrefix: string,
    index: number,
  ) => {
    const emailSource = member.emailSource ?? 'parent'
    const parentEmailValue = parentEmailOptions[0]?.value ?? primaryAdult.email

    const handleNameBlur = async () => {
      const suggested = await suggestUsernameForMember(member.firstName, member.lastName, member.username)
      if (suggested) onChange({ username: suggested })
    }

    const useParentPassword = member.useParentPassword ?? false

    return (
      <div className="grid gap-3 md:grid-cols-2">
        <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="First name *" value={member.firstName} onChange={(e) => onChange({ firstName: e.target.value })} onBlur={() => void handleNameBlur()} />
        <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Last name *" value={member.lastName} onChange={(e) => onChange({ lastName: e.target.value })} onBlur={() => void handleNameBlur()} />
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
          <select
            className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm mb-2"
            value={emailSource === 'youth' ? 'youth' : parentEmailValue || 'parent'}
            onChange={(e) => {
              const val = e.target.value
              if (val === 'youth') {
                onChange({ emailSource: 'youth', email: '' })
              } else {
                onChange({ emailSource: 'parent', email: '' })
              }
            }}
          >
            {parentEmailOptions.length > 0 ? (
              parentEmailOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>Use parent/guardian email — {opt.label.split(' — ')[1]}</option>
              ))
            ) : (
              <option value="parent">Use parent/guardian email</option>
            )}
            <option value="youth">Youth Athlete Email (all emails and messaging sent to the athlete are also sent to the parent/guardian by default)</option>
          </select>
          {emailSource === 'youth' && (
            <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" type="email" placeholder="Athlete email *" value={member.email} onChange={(e) => onChange({ email: e.target.value })} />
          )}
          {emailSource === 'parent' && (
            <p className="text-xs text-gray-500">
              Contact email: {parentEmailValue || primaryAdult.email || '—'} (messages go to parent/guardian)
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 invisible" aria-hidden="true">
            Date of birth (DOB) *
          </label>
          <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" type="tel" placeholder="Phone number" maxLength={PHONE_INPUT_MAX_LENGTH} value={member.phone} onChange={(e) => onChange({ phone: formatPhoneNumber(e.target.value) })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date of birth (DOB) *</label>
          <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" type="date" value={member.dateOfBirth} onChange={(e) => onChange({ dateOfBirth: e.target.value })} />
        </div>
        <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={member.gender} onChange={(e) => onChange({ gender: e.target.value })}>
          <option value="">Gender</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="non-binary">Non-binary</option>
          <option value="prefer-not-to-say">Prefer not to say</option>
        </select>
        <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Username *" value={member.username} onChange={(e) => onChange({ username: e.target.value })} />
        <label className="md:col-span-2 flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={useParentPassword}
            onChange={(e) => {
              const checked = e.target.checked
              onChange(
                checked
                  ? { useParentPassword: true, password: '', confirmPassword: '' }
                  : { useParentPassword: false },
              )
            }}
          />
          <span>Use Parent/Guardian password</span>
        </label>
        {!useParentPassword && (
          <>
            <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" placeholder={isAdminEdit ? 'New password (optional)' : 'Password *'} value={member.password} onChange={(e) => onChange({ password: e.target.value })} />
            <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" placeholder={isAdminEdit ? 'Confirm new password' : 'Confirm password *'} value={member.confirmPassword} onChange={(e) => onChange({ confirmPassword: e.target.value })} />
          </>
        )}
        {renderYouthAthleteFields(member, onChange, `${fieldIdPrefix}-${index}`)}
        <p className="md:col-span-2 text-xs text-gray-500 italic">
          Athlete accounts support additional training and learning opportunities, to include challenges, workout tips, skill libraries and other fitness related items.
        </p>
      </div>
    )
  }

  const renderMemberFields = (
    member: SignupMemberForm,
    onChange: (updates: Partial<SignupMemberForm>) => void,
    { showLogin = true, fieldIdPrefix = 'member', memberIndex = 0, variant = 'primary' as 'primary' | 'family' | 'minor-athlete' } = {},
  ) => {
    if (variant === 'minor-athlete') {
      return renderMinorAthleteFields(member, onChange, fieldIdPrefix)
    }
    if (variant === 'family') {
      return renderFamilyMemberFields(member, onChange, fieldIdPrefix, memberIndex)
    }
    return renderPrimaryAdultFields(member, onChange, fieldIdPrefix, showLogin)
  }

  const validatePrimaryStep = (adult: SignupMemberForm = primaryAdult) => {
    if (isMinorStart) {
      const minor = additionalMembers[0]
      if (!minor?.firstName || !minor?.lastName) return 'Minor first and last name are required.'
      if (!minor.dateOfBirth || isAdult(minor.dateOfBirth)) return 'Minor must be under 18.'
      if (!minor.currentSchool?.trim()) return 'Current school is required for youth athletes.'
      if (!parentEmail.trim()) return 'Parent/guardian email is required.'
      return null
    }
    if (!adult.firstName || !adult.lastName) return 'First and last name are required.'
    if (!adult.email?.trim()) return 'Email is required.'
    if (cleanPhoneNumber(adult.phone || '').length !== 10) return 'A valid 10-digit phone number is required.'
    if (!adult.addressStreet?.trim()) return 'Street address is required.'
    if (!adult.addressCity?.trim()) return 'City is required.'
    if (!adult.addressState?.trim()) return 'State is required.'
    if (!adult.addressZip?.trim()) return 'ZIP code is required.'
    if (!adult.dateOfBirth || !isAdult(adult.dateOfBirth)) return 'Primary account holder must be 18 or older.'
    if (!adult.username?.trim()) return 'Username is required.'
    if (!isAdminEdit) {
      if (!adult.password || adult.password.length < 8) return 'Password must be at least 8 characters.'
      if (adult.password !== adult.confirmPassword) return 'Passwords do not match.'
    } else if (adult.password) {
      if (adult.password.length < 8) return 'Password must be at least 8 characters.'
      if (adult.password !== adult.confirmPassword) return 'Passwords do not match.'
    }
    return null
  }

  const usesParentContactEmail = (member: SignupMemberForm) => (member.emailSource ?? 'parent') === 'parent'

  const validateFamilyMembersStep = (members: SignupMemberForm[] = additionalMembers) => {
    for (const member of members) {
      if (!member.firstName || !member.lastName) return 'Each family member needs a first and last name.'
      if (!member.username?.trim()) return `Username is required for ${member.firstName || 'each member'}.`
      const minor = Boolean(member.dateOfBirth) && !isAdult(member.dateOfBirth)
      if (usesParentContactEmail(member)) {
        if (!minor) {
          return `${member.firstName} must have their own email address (adults cannot share a parent email).`
        }
        if (!primaryAdult.email?.trim()) {
          return 'Primary adult email is required when a minor uses parent/guardian contact email.'
        }
      } else if (!member.email?.trim()) {
        return `Email is required for ${member.firstName || 'each member'}.`
      }
      if (member.useParentPassword && !isAdminEdit) {
        if (!primaryAdult.password || primaryAdult.password.length < 8) {
          return 'Primary adult password is required when sharing login with a family member.'
        }
      }
      if (!isAdminEdit && !member.useParentPassword) {
        if (!member.password || member.password.length < 8) return `Password must be at least 8 characters for ${member.firstName || 'each member'}.`
        if (member.password !== member.confirmPassword) return `Passwords do not match for ${member.firstName || 'each member'}.`
      } else if (member.password && !member.useParentPassword) {
        if (member.password.length < 8) return `Password must be at least 8 characters for ${member.firstName || 'each member'}.`
        if (member.password !== member.confirmPassword) return `Passwords do not match for ${member.firstName || 'each member'}.`
      }
      if (!member.dateOfBirth) return `Date of birth is required for ${member.firstName || 'each member'}.`
    }
    return null
  }

  const validateEnrollmentStep = () => {
    for (let i = 0; i < enrollments.length; i++) {
      if (!enrollments[i].memberClientId) {
        return `Select a family member for enrollment ${i + 1}.`
      }
    }
    return null
  }

  const buildMemberUpdatePayload = (member: SignupMemberForm, inheritPrimaryAddress = false) => {
    const street = inheritPrimaryAddress ? primaryAdult.addressStreet : member.addressStreet
    const city = inheritPrimaryAddress ? primaryAdult.addressCity : member.addressCity
    const state = inheritPrimaryAddress ? primaryAdult.addressState : member.addressState
    const zip = inheritPrimaryAddress ? primaryAdult.addressZip : member.addressZip
    const payload: Record<string, unknown> = {
      firstName: member.firstName,
      lastName: member.lastName,
      email: usesParentContactEmail(member) ? null : (member.email || null),
      emailSource: member.emailSource ?? 'parent',
      phone: member.phone ? cleanPhoneNumber(member.phone) : null,
      address: combineAddress(street, city, state, zip) || null,
      username: member.username || null,
      dateOfBirth: member.dateOfBirth || null,
      gender: member.gender || null,
    }
    if (member === primaryAdult) {
      payload.billingStreet = primaryAdult.addressStreet || null
      payload.billingCity = primaryAdult.addressCity || null
      payload.billingState = primaryAdult.addressState || null
      payload.billingZip = primaryAdult.addressZip || null
    }
    if (member.graduationYear !== '' && member.graduationYear != null) {
      payload.graduationYear = member.graduationYear
    }
    if (member.password && member.password.length >= 8) {
      payload.password = member.password
    }
    return payload
  }

  const saveAdminEdit = async () => {
    const membersToSave = [primaryAdult, ...additionalMembers]
    for (const member of membersToSave) {
      if (!member.memberId) continue
      const inheritAddress = member !== primaryAdult
      const res = await adminApiRequest(`/api/admin/members/${member.memberId}`, {
        method: 'PUT',
        body: JSON.stringify(buildMemberUpdatePayload(member, inheritAddress)),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || `Failed to update ${member.firstName} ${member.lastName}`)
      }
    }

    const unsignedRequired = waivers.filter((w) => w.is_required !== false && !w.acceptance_id)
    if (unsignedRequired.some((w) => !checkedTemplateIds.includes(w.id))) {
      throw new Error('All required waivers must be accepted.')
    }

    if (checkedTemplateIds.length > 0 && signatureName.trim() && savedMemberIds.length > 0) {
      const signerId = primaryAdult.memberId ?? savedMemberIds[0]
      for (const memberId of savedMemberIds) {
        for (const templateId of checkedTemplateIds) {
          const waiver = waivers.find((w) => w.id === templateId)
          if (waiver?.acceptance_id) continue
          await adminApiRequest(`/api/admin/members/${memberId}/waivers/acceptance`, {
            method: 'POST',
            body: JSON.stringify({
              waiverTemplateId: templateId,
              acceptedByMemberId: signerId,
              signatureName: signatureName.trim(),
            }),
          })
        }
      }
    }

    setSuccessMessage('Account updated successfully!')
    onComplete?.({ familyId: editFamilyId, memberIds: savedMemberIds })
  }

  const buildEnrollmentSubmitRows = () => {
    const memberIndexMap = new Map<string, number>()
    if (!isMinorStart) memberIndexMap.set(primaryAdult.clientId, 0)
    additionalMembers.forEach((member, idx) => {
      memberIndexMap.set(member.clientId, isMinorStart ? idx : idx + 1)
    })

    const rows: Array<Record<string, unknown>> = []
    for (const row of enrollments) {
      if (row.classEventId === '' || row.memberClientId === '') continue
      const classEventId = Number(row.classEventId)
      const pack = offeringsByClass[classEventId]
      const classes = row.programsId !== '' ? (classesByProgram[Number(row.programsId)] ?? []) : []
      const classOption = classes.find((c) => c.id === classEventId)
      const programOption = topPrograms.find((p) => p.id === Number(row.programsId))
      const memberIndex = memberIndexMap.get(row.memberClientId)
      const base = {
        memberIndex,
        classEventId,
        programId: classEventId,
        schedulingFormId: row.schedulingFormId ?? pack?.formId ?? undefined,
        programName: programOption?.displayName || programOption?.name || classOption?.displayName || classOption?.name,
        className: classOption?.displayName || classOption?.name,
        daysPerWeek: 1,
      }

      if (row.selectedSlotKeys.length > 0) {
        for (const key of row.selectedSlotKeys) {
          const opt = pack?.scheduleOptions?.find(
            (o) => slotOptionKey(o.slotGroupId, o.timeSlotId) === key,
          )
          if (!opt) continue
          rows.push({
            ...base,
            slotGroupId: opt.slotGroupId,
            timeSlotId: opt.timeSlotId,
            offeringId: opt.offeringId,
            offeringLabel: opt.offeringLabel,
            scheduleLabel: opt.scheduleLabel,
            priceCents: opt.priceCents,
            priceLabel: opt.priceLabel,
          })
        }
      } else {
        rows.push({
          ...base,
          offeringIds: row.offeringIds,
          slotGroupId: row.slotGroupId,
          timeSlotId: row.timeSlotId,
        })
      }
    }
    return rows
  }

  const buildPayload = () => {
    return {
      existingFamilyId: isAdmin && familyMode === 'existing' ? existingFamilyId : null,
      primaryAdult: isMinorStart ? undefined : primaryAdult,
      additionalMembers: (isMinorStart ? additionalMembers.slice(0, 1) : additionalMembers).map((member) => ({
        ...member,
        email: usesParentContactEmail(member) ? '' : member.email,
        ...(member.useParentPassword && !isMinorStart
          ? {
              password: primaryAdult.password,
              confirmPassword: primaryAdult.confirmPassword,
            }
          : {}),
        addressStreet: primaryAdult.addressStreet,
        addressCity: primaryAdult.addressCity,
        addressState: primaryAdult.addressState,
        addressZip: primaryAdult.addressZip,
      })),
      enrollments: buildEnrollmentSubmitRows(),
      waivers: {
        signatureName,
        comments,
        acceptedTemplateIds: checkedTemplateIds,
        paymentPolicyAcknowledged,
      },
    }
  }

  const updateEnrollmentRow = (index: number, patch: Partial<EnrollmentRow>) => {
    setEnrollments((prev) => prev.map((row, i) => {
      if (i !== index) return row
      const next = { ...row, ...patch }
      if (patch.programsId !== undefined && patch.programsId !== row.programsId) {
        next.classEventId = ''
        next.offeringIds = []
        next.selectedSlotKeys = []
        next.schedulingFormId = undefined
        next.slotGroupId = undefined
        next.timeSlotId = undefined
        if (patch.programsId !== '') void loadClassesForProgram(Number(patch.programsId))
      }
      if (patch.classEventId !== undefined && patch.classEventId !== row.classEventId) {
        next.offeringIds = []
        next.selectedSlotKeys = []
        next.slotGroupId = undefined
        next.timeSlotId = undefined
        if (patch.classEventId !== '') {
          void loadOfferingsForClass(Number(patch.classEventId))
          const cls = classesByProgram[Number(next.programsId)]?.find((c) => c.id === Number(patch.classEventId))
          next.schedulingFormId = cls?.schedulingFormId ?? undefined
        }
      }
      return next
    }))
  }

  const toggleSlotSelection = (rowIndex: number, key: string, checked: boolean) => {
    setEnrollments((prev) => prev.map((row, i) => {
      if (i !== rowIndex) return row
      const selectedSlotKeys = checked
        ? [...row.selectedSlotKeys, key]
        : row.selectedSlotKeys.filter((k) => k !== key)
      return { ...row, selectedSlotKeys }
    }))
  }

  const submit = async () => {
    if (!isMinorStart) {
      const allWaiversAlreadySigned = waivers.length > 0
        && waivers.every((w) => w.is_required === false || w.acceptance_id != null)
      if (!allWaiversAlreadySigned) {
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
      }
    }

    const enrollmentErr = validateEnrollmentStep()
    if (enrollmentErr) {
      setError(enrollmentErr)
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (isAdminEdit) {
        await saveAdminEdit()
        return
      }
      if (isMinorStart) {
        const minor = additionalMembers[0]
        const payload = {
          minor,
          parentEmail,
          enrollments: buildEnrollmentSubmitRows(),
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
        if (returnTo) {
          window.location.href = returnTo
          return
        }
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
      if (returnTo) {
        window.location.href = returnTo
        return
      }
      setSuccessMessage('Account created successfully!')
      onComplete?.(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const maxStep = isMinorStart ? 3 : 4
  const enrollmentStep = isMinorStart ? 2 : 3

  if (isAdminEdit && !accountLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-600">
        <Loader2 className="w-8 h-8 animate-spin text-vortex-red" />
        <p className="text-sm">Loading account…</p>
      </div>
    )
  }

  const goNext = async () => {
    setError(null)
    if (step === 0 && isAdmin) {
      if (familyMode === 'existing' && !existingFamilyId) {
        setError('Search for and select an existing family to continue.')
        return
      }
      setStep(1)
      return
    }
    if (step === 1) {
      let adult = primaryAdult
      if (!isMinorStart) {
        const suggested = await suggestUsernameForMember(adult.firstName, adult.lastName, adult.username)
        if (suggested) {
          adult = { ...adult, username: suggested }
          setPrimaryAdult(adult)
        }
      }
      const err = validatePrimaryStep(adult)
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
      const updatedMembers = await Promise.all(
        additionalMembers.map(async (member) => {
          const suggested = await suggestUsernameForMember(member.firstName, member.lastName, member.username)
          return suggested ? { ...member, username: suggested } : member
        }),
      )
      if (updatedMembers.some((member, index) => member.username !== additionalMembers[index]?.username)) {
        setAdditionalMembers(updatedMembers)
      }
      const err = validateFamilyMembersStep(updatedMembers)
      if (err) {
        setError(err)
        return
      }
    }
    if (step === enrollmentStep && step < maxStep) {
      const err = validateEnrollmentStep()
      if (err) {
        setError(err)
        return
      }
    }
    if (step === maxStep) {
      await submit()
      return
    }
    setStep((prev) => prev + 1)
  }

  const renderEnrollmentSection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Program enrollment</h3>
        <button
          type="button"
          onClick={() => setEnrollments((prev) => [...prev, emptyEnrollment()])}
          className="inline-flex items-center gap-1 text-sm text-vortex-red font-semibold"
        >
          <UserPlus className="w-4 h-4" /> Add enrollment
        </button>
      </div>
      {enrollPrefill && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          Pre-selected from scheduling: {enrollPrefill.programDisplayName || 'Program'}
          {enrollPrefill.classDisplayName ? ` → ${enrollPrefill.classDisplayName}` : ''}
          {enrollPrefill.offeringId ? ' (offering selected)' : ''}
          <span className="block mt-1 text-blue-800">
            You can remove this enrollment or add more classes below.
          </span>
        </div>
      )}
      {enrollments.length === 0 && (
        <p className="text-sm text-gray-500">Optional: enroll in a program now, or continue without enrolling and sign up for classes later.</p>
      )}
      {enrollments.map((row, index) => {
        const classes = row.programsId !== '' ? (classesByProgram[Number(row.programsId)] ?? []) : []
        const catalog = row.classEventId !== '' ? offeringsByClass[Number(row.classEventId)] : null
        const scheduleOptions = catalog?.scheduleOptions ?? []
        const groupedScheduleOptions = (() => {
          const groups = new Map<string, {
            offeringLabel: string
            offeringDates: string | null
            options: ScheduleOption[]
          }>()
          for (const opt of scheduleOptions) {
            const key = opt.offeringId != null ? String(opt.offeringId) : '__general__'
            if (!groups.has(key)) {
              groups.set(key, {
                offeringLabel: opt.offeringLabel || 'Schedule options',
                offeringDates: opt.offeringDates,
                options: [],
              })
            }
            groups.get(key)!.options.push(opt)
          }
          return [...groups.values()]
        })()

        return (
          <div key={index} className="rounded-xl border border-gray-200 p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Family member</label>
                <select
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                  value={row.memberClientId}
                  onChange={(e) => updateEnrollmentRow(index, { memberClientId: e.target.value })}
                >
                  <option value="">Select family member</option>
                  {allAthletes.map((m) => (
                    <option key={m.clientId} value={m.clientId}>{m.firstName} {m.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Program</label>
                <select
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                  value={row.programsId}
                  onChange={(e) => updateEnrollmentRow(index, {
                    programsId: e.target.value === '' ? '' : Number(e.target.value),
                  })}
                >
                  <option value="">Select program</option>
                  {topPrograms.map((p) => (
                    <option key={p.id} value={p.id}>{p.displayName || p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Class</label>
              <select
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                value={row.classEventId}
                disabled={row.programsId === ''}
                onChange={(e) => updateEnrollmentRow(index, {
                  classEventId: e.target.value === '' ? '' : Number(e.target.value),
                })}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName || c.name}</option>
                ))}
              </select>
            </div>

            {scheduleOptions.length > 0 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Offerings & schedule (select all that apply)
                  </label>
                  {catalog?.priceLabel && (
                    <p className="text-xs text-gray-500 mb-2">Typical price: {catalog.priceLabel}</p>
                  )}
                </div>
                {groupedScheduleOptions.map((group) => (
                  <div key={`${group.offeringLabel}-${group.offeringDates ?? 'general'}`} className="space-y-2">
                    <p className="text-sm font-semibold text-gray-800">
                      {group.offeringLabel}
                      {group.offeringDates && (
                        <span className="text-gray-500 font-normal"> · {group.offeringDates}</span>
                      )}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.options.map((opt) => {
                        const key = slotOptionKey(opt.slotGroupId, opt.timeSlotId)
                        const checked = row.selectedSlotKeys.includes(key)
                        return (
                          <label
                            key={key}
                            className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition-colors ${
                              checked
                                ? 'border-vortex-red bg-red-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 shrink-0"
                              checked={checked}
                              onChange={(e) => toggleSlotSelection(index, key, e.target.checked)}
                            />
                            <span className="text-sm min-w-0">
                              <span className="flex items-center gap-1.5 font-medium text-gray-900">
                                <Clock className="w-3.5 h-3.5 text-vortex-red shrink-0" />
                                {opt.scheduleLabel}
                              </span>
                              {opt.priceLabel && (
                                <span className="block text-xs font-semibold text-vortex-red mt-1">
                                  {opt.priceLabel}
                                </span>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setEnrollments((prev) => prev.filter((_, i) => i !== index))}
              className="text-xs text-red-600 font-semibold"
            >
              Remove enrollment
            </button>
          </div>
        )
      })}
    </div>
  )

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
          {isAdminEdit
            ? 'Edit Vortex account'
            : isMinorStart
              ? 'Youth signup — invite a parent'
              : isAdmin
                ? 'Create Vortex account'
                : 'Join Vortex Athletics'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Step {step} of {maxStep} —{' '}
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
            <button type="button" onClick={() => { setFamilyMode('new'); setExistingFamilyId(null); setFamilySearch('') }} className={`px-4 py-2 rounded-lg text-sm font-semibold ${familyMode === 'new' ? 'bg-vortex-red text-white' : 'border border-gray-300'}`}>
              New family
            </button>
            <button type="button" onClick={() => setFamilyMode('existing')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${familyMode === 'existing' ? 'bg-vortex-red text-white' : 'border border-gray-300'}`}>
              Falls under existing family
            </button>
          </div>
          {familyMode === 'existing' && (
            <div className="space-y-3 rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-600">
                Start typing a family name from the Vortex accounts list. Select a match — no family password is required for admin setup.
              </p>
              <FamilySearchCombobox
                value={familySearch}
                selectedFamilyId={existingFamilyId}
                onQueryChange={setFamilySearch}
                onSelect={(family: FamilySearchOption | null) => {
                  setExistingFamilyId(family?.id ?? null)
                }}
              />
            </div>
          )}
        </div>
      )}

      {step === 1 && !isMinorStart && (
        <div className="rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Primary adult (parent/guardian or adult athlete)</h3>
          {renderMemberFields(primaryAdult, (updates) => setPrimaryAdult((prev) => ({ ...prev, ...updates })), { fieldIdPrefix: 'primary' })}
        </div>
      )}

      {step === 1 && isMinorStart && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Youth athlete (under 18)</h3>
            {additionalMembers[0] && renderMemberFields(
              additionalMembers[0],
              (updates) => setAdditionalMembers((prev) => [{ ...prev[0], ...updates }]),
              { variant: 'minor-athlete', fieldIdPrefix: 'minor-athlete' },
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
            {!isAdminEdit && (
            <button
              type="button"
              onClick={() => {
                const m = emptyMember()
                if (primaryAdult.email) {
                  m.emailSource = 'parent'
                  m.email = ''
                }
                setAdditionalMembers((prev) => [...prev, m])
              }}
              className="inline-flex items-center gap-1 text-sm text-vortex-red font-semibold"
            >
              <Plus className="w-4 h-4" /> Add member
            </button>
            )}
          </div>
          {additionalMembers.length === 0 && (
            <p className="text-sm text-gray-500">No additional members yet. Continue if only one person is joining.</p>
          )}
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
                { variant: 'family', fieldIdPrefix: `family-${index}`, memberIndex: index },
              )}
            </div>
          ))}
        </div>
      )}

      {step === enrollmentStep && renderEnrollmentSection()}

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
            {step >= maxStep ? (isMinorStart ? 'Send invite' : isAdminEdit ? 'Save account' : 'Create account') : 'Continue'}
            {step < maxStep && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
