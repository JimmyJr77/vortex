import { continueFamilyEnrollmentCheckout } from '../../utils/familyEnrollmentCheckout'
import TextInput from '../common/TextInput'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SignupBirthdayField from './SignupBirthdayField'
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, UserPlus } from 'lucide-react'
import ScheduleOptionCheckboxGrid from './ScheduleOptionCheckboxGrid'
import { groupScheduleOptions } from './scheduleOptionGrouping'
import { getApiUrl, adminApiRequest } from '../../utils/api'
import { loginMemberWithCredentials } from '../../utils/portalSession'
import { cleanPhoneNumber, formatPhoneForDisplay, isCompletePhoneNumber, PHONE_FORMAT_ERROR } from '../../utils/phoneUtils'
import { formatDateForInput, isAdult } from '../../utils/dateUtils'
import { maybeSuggestUsername } from '../../utils/signupUsername'
import { graduationYearsForPicker } from '../../utils/promoDiscountModel'
import { US_STATES, verifyUsAddressZip } from '../../utils/usStates'
import SchoolAutocompleteInput from '../scheduling/SchoolAutocompleteInput'
import FamilySearchCombobox, { type FamilySearchOption } from './FamilySearchCombobox'
import WaiverSigningBlock from './WaiverSigningBlock'
import { validateWaiverSigning, type PublicWaiverTemplate } from './waiverSigningUtils'
import { flushEvents, trackEvent } from '../../utils/analyticsClient'
import type { ProgramPricingOptionKey } from '../../utils/programPricingOptions'
import {
  clearPublicEnrollmentCart,
  loadPublicEnrollmentCart,
} from '../../utils/publicEnrollmentCart'
import { pendingEnrollmentsToRows } from './signupEnrollmentUtils'
import EnrollmentStartDateField from '../enroll/EnrollmentStartDateField'

type WizardMode = 'public' | 'admin' | 'minor-start' | 'admin-edit' | 'waivers-memberships'
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
  hasLogin?: boolean
  hasLoginPassword?: boolean
  loginUsername?: string | null
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
  portalAccessRequested?: boolean
  hasLogin?: boolean
  hasLoginPassword?: boolean
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
  classActiveDates?: string | null
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
  selectedPricingOptionKey?: ProgramPricingOptionKey
  locked?: boolean
  enrollmentStartDate: string
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
  enrollmentStartDate?: string
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
  portalAccessRequested: false,
  currentSchool: '',
  graduationYear: '',
})

const emptyEnrollment = (): EnrollmentRow => ({
  memberClientId: '',
  programsId: '',
  classEventId: '',
  offeringIds: [],
  selectedSlotKeys: [],
  enrollmentStartDate: '',
})

export interface LeadEnrollmentSelection {
  kind: 'program' | 'class' | 'reserved'
  label: string
  childIndex?: number | null
  childName?: string
  programsId: number
  programName?: string
  classEventId?: number
  className?: string
  schedulingFormId?: number
  slotGroupId?: number
  timeSlotId?: number
  scheduleLabel?: string
  enrollmentStartDate?: string | null
}

export interface LeadRegistrationSetup {
  inviteId: number
  token: string
  session: string
  username: string
  guardian: { firstName: string; lastName: string; email: string; phone: string }
  children: { firstName?: string; lastName?: string; dateOfBirth?: string; gender?: string }[]
  waivers: PublicWaiverTemplate[]
  selections: LeadEnrollmentSelection[]
  focusedSelection?: number | null
}

interface FamilySignupWizardProps {
  leadRegistration?: LeadRegistrationSetup
  mode?: WizardMode
  editMemberId?: number | null
  returnTo?: string | null
  onComplete?: (result: unknown) => void
  onCancel?: () => void
  pendingDropInId?: string | null
}

function mapApiMemberToForm(
  record: ApiMemberRecord,
  primaryEmail?: string,
  billing?: { billingStreet?: string | null; billingCity?: string | null; billingState?: string | null; billingZip?: string | null },
): SignupMemberForm {
  const addressParts = parseAddress(record.address)
  const email = record.email || ''
  const emailSource: EmailSource = email && (!primaryEmail || email.toLowerCase() !== primaryEmail.toLowerCase()) ? 'youth' : 'parent'
  const username = (record.hasLogin ? record.loginUsername : record.username) || ''
  return {
    clientId: crypto.randomUUID(),
    memberId: record.id,
    firstName: record.firstName || '',
    lastName: record.lastName || '',
    email,
    phone: formatPhoneForDisplay(record.phone),
    addressStreet: addressParts.street || record.billingStreet || billing?.billingStreet || '',
    addressCity: addressParts.city || record.billingCity || billing?.billingCity || '',
    addressState: addressParts.state || record.billingState || billing?.billingState || '',
    addressZip: addressParts.zip || record.billingZip || billing?.billingZip || '',
    dateOfBirth: record.dateOfBirth ? formatDateForInput(record.dateOfBirth) : '',
    gender: record.gender || '',
    username,
    password: '',
    confirmPassword: '',
    emailSource,
    portalAccessRequested: record.hasLogin === true || Boolean(username),
    hasLogin: record.hasLogin === true,
    hasLoginPassword: record.hasLoginPassword === true,
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
  pendingDropInId = null,
  leadRegistration,
}: FamilySignupWizardProps) {
  const apiUrl = getApiUrl()
  const isAdmin = mode === 'admin'
  const isAdminEdit = mode === 'admin-edit'
  const isMinorStart = mode === 'minor-start'
  const isWaiversMemberships = mode === 'waivers-memberships'

  const [step, setStep] = useState(isAdmin ? 0 : 1)
  const [accountLoaded, setAccountLoaded] = useState(!isAdminEdit)
  const [editFamilyId, setEditFamilyId] = useState<number | null>(null)
  const loadedAdminMembers = useRef(new Map<number, SignupMemberForm>())
  const [savedMemberIds, setSavedMemberIds] = useState<number[]>([])
  const [familyMode, setFamilyMode] = useState<'new' | 'existing'>('new')
  const [existingFamilyId, setExistingFamilyId] = useState<number | null>(null)
  const [familySearch, setFamilySearch] = useState('')
  const [primaryAdult, setPrimaryAdult] = useState<SignupMemberForm>(() => ({
    ...emptyMember(),
    ...leadRegistration?.guardian,
    phone: formatPhoneForDisplay(leadRegistration?.guardian.phone),
    username: leadRegistration?.username || '',
  }))
  const [additionalMembers, setAdditionalMembers] = useState<SignupMemberForm[]>(() => (leadRegistration?.children ?? []).map((child) => ({
    ...emptyMember(),
    firstName: child.firstName ?? '',
    lastName: child.lastName ?? '',
    dateOfBirth: formatDateForInput(child.dateOfBirth),
    gender: child.gender ?? '',
  })))
  const [parentEmail, setParentEmail] = useState('')
  const [topPrograms, setTopPrograms] = useState<TopProgramOption[]>([])
  const [classesByProgram, setClassesByProgram] = useState<Record<number, ClassOption[]>>({})
  const [offeringsByClass, setOfferingsByClass] = useState<Record<number, ClassCatalogPack>>({})
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>(() => (leadRegistration?.selections ?? []).map((selection) => ({
    ...emptyEnrollment(),
    memberClientId: selection.childIndex != null ? additionalMembers[selection.childIndex]?.clientId ?? '' : '',
    programsId: selection.programsId,
    classEventId: selection.classEventId ?? '',
    schedulingFormId: selection.schedulingFormId,
    slotGroupId: selection.slotGroupId,
    timeSlotId: selection.timeSlotId,
    enrollmentStartDate: selection.enrollmentStartDate ?? '',
  })))
  const [enrollPrefill, setEnrollPrefill] = useState<EnrollPrefill | null>(null)
  const prefillApplied = useRef(false)
  const [publicCartSelections] = useState(() =>
    mode === 'public' && !returnTo && !leadRegistration ? loadPublicEnrollmentCart() : [],
  )
  const publicCartApplied = useRef(false)
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
  const [successDestination, setSuccessDestination] = useState('/?enrollment=review')

  // Funnel events only for parent-facing signups; admin flows are staff actions.
  const isPublicFunnel = mode === 'public' || mode === 'minor-start' || isWaiversMemberships
  const signupStartTracked = useRef(false)
  useEffect(() => {
    if (!isPublicFunnel || signupStartTracked.current) return
    signupStartTracked.current = true
    trackEvent('sign_up_start', window.location.pathname, {
      properties: { signup_mode: mode },
    })
  }, [isPublicFunnel, mode])

  const allAthletes = useMemo(() => {
    const athletes: SignupMemberForm[] = []
    if (!isMinorStart) athletes.push(primaryAdult)
    athletes.push(...additionalMembers)
    return athletes.filter((m) => m.firstName && m.lastName)
  }, [primaryAdult, additionalMembers, isMinorStart])

  const loadCatalogAndWaivers = useCallback(async () => {
    if (leadRegistration) { setWaivers(leadRegistration.waivers); return }
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
  }, [apiUrl, leadRegistration])

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

          const primary = mapApiMemberToForm(payerRecord, undefined, billing)
          const additional = others.map((member) => mapApiMemberToForm(member, primary.email || undefined, billing))
          if (!cancelled) {
            loadedAdminMembers.current = new Map([primary, ...additional].map((member) => [member.memberId!, member]))
            setPrimaryAdult(primary)
            setAdditionalMembers(additional)
          }
        } else {
          setSavedMemberIds([anchor.id])
          if (!cancelled) {
            const primary = mapApiMemberToForm(anchor)
            loadedAdminMembers.current = new Map([[anchor.id, primary]])
            setPrimaryAdult(primary)
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
      const enrollmentStartDate = url.searchParams.get('enrollmentStartDate')
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
            enrollmentStartDate: enrollmentStartDate || undefined,
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
    try {
      const leadQuery = leadRegistration ? '?leadRegistration=1' : ''
      const res = await fetch(`${apiUrl}/api/signup/catalog/programs/${programsId}/classes${leadQuery}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Unable to load classes.')
      setClassesByProgram((prev) => ({ ...prev, [programsId]: data.data ?? [] }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load classes.')
    }
  }, [apiUrl, classesByProgram, leadRegistration])

  const loadOfferingsForClass = useCallback(async (classEventId: number) => {
    if (offeringsByClass[classEventId]) return
    try {
      const leadQuery = leadRegistration ? '?leadRegistration=1' : ''
      const res = await fetch(`${apiUrl}/api/signup/catalog/classes/${classEventId}/offerings${leadQuery}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Unable to load class times.')
      const pack: Partial<ClassCatalogPack> = data.data ?? {}
      setOfferingsByClass((prev) => ({
        ...prev,
        [classEventId]: {
          formId: pack.formId ?? null,
          offerings: pack.offerings ?? [],
          scheduleOptions: pack.scheduleOptions ?? [],
          priceLabel: pack.priceLabel ?? null,
          classActiveDates: pack.classActiveDates ?? null,
        },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load class times.')
    }
  }, [apiUrl, offeringsByClass, leadRegistration])

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
        enrollmentStartDate: enrollPrefill.enrollmentStartDate ?? '',
      },
    ])
  }, [enrollPrefill, loadClassesForProgram, loadOfferingsForClass])

  const applyPublicEnrollmentCart = useCallback(async () => {
    if (publicCartSelections.length === 0 || publicCartApplied.current || enrollPrefill) return
    publicCartApplied.current = true
    const groupedRows = pendingEnrollmentsToRows(publicCartSelections)
    const programsIds = [...new Set(groupedRows
      .map((row) => Number(row.programsId))
      .filter(Number.isFinite))]
    const classEventIds = [...new Set(groupedRows
      .map((row) => Number(row.classEventId))
      .filter(Number.isFinite))]

    await Promise.all(programsIds.map((programsId) => loadClassesForProgram(programsId)))
    await Promise.all(classEventIds.map((classEventId) => loadOfferingsForClass(classEventId)))
    setEnrollments(groupedRows.map((row) => ({
      ...row,
      memberClientId: '',
      selectedPricingOptionKey: publicCartSelections.find(
        (item) => item.classEventId === Number(row.classEventId),
      )?.selectedPricingOptionKey,
    })))
  }, [
    enrollPrefill,
    loadClassesForProgram,
    loadOfferingsForClass,
    publicCartSelections,
  ])

  useEffect(() => {
    const onEnrollmentStep = (step === 2 && isMinorStart) || (step === 3 && !isMinorStart)
    if (onEnrollmentStep && enrollPrefill) {
      void applyEnrollPrefill()
    }
  }, [step, isMinorStart, enrollPrefill, applyEnrollPrefill])

  useEffect(() => {
    const onEnrollmentStep = step === 3 && !isMinorStart
    if (onEnrollmentStep && publicCartSelections.length > 0 && !enrollPrefill) {
      void applyPublicEnrollmentCart()
    }
  }, [
    applyPublicEnrollmentCart,
    enrollPrefill,
    isMinorStart,
    publicCartSelections.length,
    step,
  ])

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

  const suggestUsernameForMember = async (member: SignupMemberForm, isPrimary = false) => {
    if (isAdminEdit || (isPrimary && leadRegistration)) return
    const { clientId, firstName, lastName, username } = member
    const suggested = await maybeSuggestUsername(apiUrl, firstName, lastName, username)
    if (!suggested) return

    const applySuggestion = (current: SignupMemberForm) => (
      current.clientId === clientId && current.firstName === firstName && current.lastName === lastName
        && current.username === username && (isPrimary || current.portalAccessRequested === true)
        ? { ...current, username: suggested }
        : current
    )
    if (isPrimary) setPrimaryAdult(applySuggestion)
    else setAdditionalMembers((current) => current.map(applySuggestion))
  }

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
    fieldIdPrefix: string,
    showLogin = true,
  ) => {
    const handleNameBlur = () => void suggestUsernameForMember(member, true)

    return (
    <div className="grid gap-3 md:grid-cols-2">
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="First name *" value={member.firstName} onChange={(e) => onChange({ firstName: e.target.value })} onBlur={() => void handleNameBlur()} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Last name *" value={member.lastName} onChange={(e) => onChange({ lastName: e.target.value })} onBlur={() => void handleNameBlur()} />
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="email" placeholder="Email *" value={member.email} readOnly={Boolean(leadRegistration)} onChange={(e) => onChange({ email: e.target.value })} />
      <TextInput className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="tel" aria-label="Phone number" aria-required="true" value={member.phone} onChange={(e) => onChange({ phone: e.target.value })} />
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
      <SignupBirthdayField id={`${fieldIdPrefix}-birthday`} value={member.dateOfBirth} onChange={(dateOfBirth) => onChange({ dateOfBirth })} />
      <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm self-end" value={member.gender} onChange={(e) => onChange({ gender: e.target.value })}>
        <option value="">Gender</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
        <option value="non-binary">Non-binary</option>
        <option value="prefer-not-to-say">Prefer not to say</option>
      </select>
      <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Username *" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={50} value={member.username} onChange={(e) => onChange({ username: e.target.value })} />
      {showLogin && (
        <>
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" autoComplete="new-password" placeholder={isAdminEdit ? 'New password (optional)' : 'Password *'} value={member.password} onChange={(e) => onChange({ password: e.target.value })} />
          <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" autoComplete="new-password" placeholder={isAdminEdit ? 'Confirm new password' : 'Confirm password *'} value={member.confirmPassword} onChange={(e) => onChange({ confirmPassword: e.target.value })} />
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
      <SignupBirthdayField id={`${fieldIdPrefix}-birthday`} value={member.dateOfBirth} onChange={(dateOfBirth) => onChange({ dateOfBirth })} />
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
    const parentEmailValue = primaryAdult.email.trim()
    const isAddedLeadMember = Boolean(leadRegistration && index >= leadRegistration.children.length)
    const nameLabelClass = leadRegistration ? 'text-xs font-semibold text-gray-600' : 'sr-only'

    const handleNameBlur = () => {
      if (member.portalAccessRequested !== true) return
      void suggestUsernameForMember(member)
    }

    return (
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <span className={nameLabelClass}>First name *</span>
          <input className="h-10 min-w-0 rounded-lg border border-gray-300 px-3 text-sm" placeholder="First name *" value={member.firstName} onChange={(e) => onChange({ firstName: e.target.value })} onBlur={() => void handleNameBlur()} />
        </label>
        <label className="grid gap-1">
          <span className={nameLabelClass}>Last name *</span>
          <input className="h-10 min-w-0 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Last name *" value={member.lastName} onChange={(e) => onChange({ lastName: e.target.value })} onBlur={() => void handleNameBlur()} />
        </label>
        <div className="md:col-span-2">
          <label htmlFor={`${fieldIdPrefix}-email-source`} className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
          <select
            id={`${fieldIdPrefix}-email-source`}
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
            <option value={parentEmailValue || 'parent'}>
              {isAddedLeadMember ? 'Use parent/guardian email (for children)' : 'Use parent/guardian email'}
              {parentEmailValue && ` — ${parentEmailValue}`}
            </option>
            <option value="youth">
              {isAddedLeadMember
                ? 'Use this family member’s own email'
                : 'Youth Athlete Email (all emails and messaging sent to the athlete are also sent to the parent/guardian by default)'}
            </option>
          </select>
          {emailSource === 'youth' && (
            <input className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" type="email" placeholder={isAddedLeadMember ? 'Email address *' : 'Athlete email *'} value={member.email} onChange={(e) => onChange({ email: e.target.value })} />
          )}
          {emailSource === 'parent' && (
            <p className="text-xs text-gray-500">
              Contact email: {parentEmailValue || '—'} (messages go to parent/guardian)
            </p>
          )}
        </div>
        <div className="self-end">
          <TextInput className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" type="tel" aria-label="Phone number" value={member.phone} onChange={(e) => onChange({ phone: e.target.value })} />
        </div>
        <SignupBirthdayField id={`${fieldIdPrefix}-birthday`} value={member.dateOfBirth} onChange={(dateOfBirth) => onChange({ dateOfBirth })} />
        <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={member.gender} onChange={(e) => onChange({ gender: e.target.value })}>
          <option value="">Gender</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="non-binary">Non-binary</option>
          <option value="prefer-not-to-say">Prefer not to say</option>
        </select>
        <label className="md:col-span-2 flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={member.portalAccessRequested === true}
            disabled={isAdminEdit && member.hasLogin}
            onChange={(e) => {
              const checked = e.target.checked
              onChange(checked
                ? { portalAccessRequested: true }
                : {
                    portalAccessRequested: false,
                    username: '',
                    password: '',
                    confirmPassword: '',
                  })
              if (checked) void suggestUsernameForMember(member)
            }}
          />
          <span>
            {isAdminEdit && member.hasLogin ? 'Member Portal login' : 'Create a separate Member Portal login'}
            <span className="mt-0.5 block text-xs text-gray-500">
              Leave this off for children or anyone who does not need their own sign-in. Access can be set up later.
            </span>
          </span>
        </label>
        {member.portalAccessRequested === true && (
          <>
            <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" placeholder="Username *" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={50} value={member.username} onChange={(e) => onChange({ username: e.target.value })} />
            <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" autoComplete="new-password" placeholder={isAdminEdit ? 'New password (optional)' : 'Password *'} value={member.password} onChange={(e) => onChange({ password: e.target.value })} />
            <input className="h-10 rounded-lg border border-gray-300 px-3 text-sm" type="password" autoComplete="new-password" placeholder={isAdminEdit ? 'Confirm new password' : 'Confirm password *'} value={member.confirmPassword} onChange={(e) => onChange({ confirmPassword: e.target.value })} />
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
      if (minor.phone && !isCompletePhoneNumber(minor.phone)) return PHONE_FORMAT_ERROR
      if (!parentEmail.trim()) return 'Parent/guardian email is required.'
      return null
    }
    if (!adult.firstName || !adult.lastName) return 'First and last name are required.'
    if (!adult.email?.trim()) return 'Email is required.'
    if (!isAdminEdit && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adult.email.trim())) return 'Enter a valid email address.'
    if (!isCompletePhoneNumber(adult.phone || '')) return 'A valid 10-digit phone number is required.'
    if (!adult.addressStreet?.trim()) return 'Street address is required.'
    if (!adult.addressCity?.trim()) return 'City is required.'
    if (!adult.addressState?.trim()) return 'State is required.'
    if (!adult.addressZip?.trim()) return 'ZIP code is required.'
    if (!adult.dateOfBirth || !isAdult(adult.dateOfBirth)) return 'Primary account holder must be 18 or older.'
    if (!adult.username?.trim() && !isAdminEdit) return 'Username is required.'
    if (!isAdminEdit && /[@\s\p{C}]/u.test(adult.username.trim())) return 'Choose a username without @, spaces, or control characters.'
    if (!isAdminEdit && /^\+?[\d().-]+$/.test(adult.username.trim()) && /^1?\d{10}$/.test(cleanPhoneNumber(adult.username))) return 'Choose a username that is different from a phone number.'
    if (!isAdminEdit) {
      if (!adult.password || adult.password.length < 8) return 'Password must be at least 8 characters.'
      if (new TextEncoder().encode(adult.password).length > 72) return 'Choose a password of 72 bytes or fewer.'
      if (adult.password !== adult.confirmPassword) return 'Passwords do not match.'
    } else if (adult.password) {
      if (adult.password.length < 8) return 'Password must be at least 8 characters.'
      if (new TextEncoder().encode(adult.password).length > 72) return 'Choose a password of 72 bytes or fewer.'
      if (adult.password !== adult.confirmPassword) return 'Passwords do not match.'
    }
    return null
  }

  const usesParentContactEmail = (member: SignupMemberForm) => (member.emailSource ?? 'parent') === 'parent'

  const validateFamilyMembersStep = (members: SignupMemberForm[] = additionalMembers) => {
    for (const member of members) {
      if (!member.firstName || !member.lastName) return 'Each family member needs a first and last name.'
      if (!member.dateOfBirth) return `Date of birth is required for ${member.firstName || 'each member'}.`
      if (member.phone && !isCompletePhoneNumber(member.phone)) return `Enter a 10-digit phone number for ${member.firstName}.`
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
      if (member.portalAccessRequested === true && !member.username?.trim() && !(isAdminEdit && member.hasLogin)) {
        return `Username is required to create Member Portal access for ${member.firstName || 'this member'}.`
      }
      if (!isAdminEdit && member.portalAccessRequested === true) {
        if (!member.password || member.password.length < 8) return `Password must be at least 8 characters for ${member.firstName || 'each member'}.`
        if (member.password !== member.confirmPassword) return `Passwords do not match for ${member.firstName || 'each member'}.`
      } else if (isAdminEdit && member.portalAccessRequested === true && (!member.hasLoginPassword || member.password)) {
        if (member.password.length < 8) return `Password must be at least 8 characters for ${member.firstName || 'each member'}.`
        if (new TextEncoder().encode(member.password).length > 72) return `Choose a password of 72 bytes or fewer for ${member.firstName || 'each member'}.`
        if (member.password !== member.confirmPassword) return `Passwords do not match for ${member.firstName || 'each member'}.`
      }
    }
    return null
  }

  const validateEnrollmentStep = () => {
    const selectedSlots = new Set<string>()
    for (let i = 0; i < enrollments.length; i++) {
      const row = enrollments[i]
      if (!allAthletes.some((member) => member.clientId === row.memberClientId)) {
        return `Select a family member for enrollment ${i + 1}.`
      }
      if (leadRegistration && row.classEventId === '') {
        return `Select a class for enrollment ${i + 1}.`
      }
      if (row.classEventId !== '' && !row.enrollmentStartDate) {
        return `Select an enrollment start date for enrollment ${i + 1}.`
      }
      const slots = row.selectedSlotKeys.length > 0
        ? row.selectedSlotKeys
        : row.slotGroupId != null && row.timeSlotId != null
          ? [slotOptionKey(row.slotGroupId, row.timeSlotId)]
          : []
      if (leadRegistration && slots.length === 0) {
        return `Select a class time for enrollment ${i + 1}.`
      }
      for (const slot of slots) {
        const key = `${row.memberClientId}:${row.classEventId}:${slot}`
        if (selectedSlots.has(key)) {
          return 'This class time is selected more than once for the same family member. Choose a different family member or remove the duplicate enrollment.'
        }
        selectedSlots.add(key)
      }
    }
    return null
  }

  const buildMemberUpdatePayload = (member: SignupMemberForm, primary: SignupMemberForm) => {
    const isPrimary = member.memberId === primary.memberId
    const { addressStreet: street, addressCity: city, addressState: state, addressZip: zip } = primary
    const payload: Record<string, unknown> = {
      firstName: member.firstName,
      lastName: member.lastName,
      email: !isPrimary && usesParentContactEmail(member) ? null : (member.email.trim() || null),
      phone: formatPhoneForDisplay(member.phone) || null,
      address: combineAddress(street, city, state, zip) || null,
      username: member.username.trim() || null,
      dateOfBirth: member.dateOfBirth || null,
      gender: member.gender || null,
    }
    if (isPrimary) {
      payload.billingStreet = street || null
      payload.billingCity = city || null
      payload.billingState = state || null
      payload.billingZip = zip || null
    }
    if (member.password) {
      payload.password = member.password
    }
    return payload
  }

  const saveAdminEdit = async () => {
    const membersToSave = [primaryAdult, ...additionalMembers]
    const originalPrimary = primaryAdult.memberId == null ? undefined : loadedAdminMembers.current.get(primaryAdult.memberId)
    for (const member of membersToSave) {
      if (!member.memberId) continue
      const original = loadedAdminMembers.current.get(member.memberId)
      if (!original || !originalPrimary) continue
      const previous = buildMemberUpdatePayload(original, originalPrimary)
      const payload = Object.fromEntries(Object.entries(buildMemberUpdatePayload(member, primaryAdult))
        .filter(([key, value]) => value !== previous[key]))
      if (Object.keys(payload).length === 0) continue
      const res = await adminApiRequest(`/api/admin/members/${member.memberId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
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
      const signerId = primaryAdult.memberId
      const waiverTargetIds = membersToSave
        .filter((member) => (
          member.memberId != null
          && (member.memberId === signerId || (member.dateOfBirth !== '' && !isAdult(member.dateOfBirth)))
        ))
        .map((member) => Number(member.memberId))
      if (!signerId) {
        throw new Error('Select a verified adult signer before recording waiver acceptance.')
      }
      for (const memberId of waiverTargetIds) {
        for (const templateId of checkedTemplateIds) {
          const waiver = waivers.find((w) => w.id === templateId)
          if (waiver?.acceptance_id) continue
          const acceptanceResponse = await adminApiRequest(`/api/admin/members/${memberId}/waivers/acceptance`, {
            method: 'POST',
            body: JSON.stringify({
              waiverTemplateId: templateId,
              acceptedByMemberId: signerId,
              signatureName: signatureName.trim(),
            }),
          })
          if (!acceptanceResponse.ok) {
            const acceptancePayload = await acceptanceResponse.json().catch(() => ({}))
            throw new Error(acceptancePayload.message || 'Unable to record waiver acceptance.')
          }
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
    for (const [index, row] of enrollments.entries()) {
      if (row.classEventId === '' || row.memberClientId === '') continue
      const classEventId = Number(row.classEventId)
      const pack = offeringsByClass[classEventId]
      const classes = row.programsId !== '' ? (classesByProgram[Number(row.programsId)] ?? []) : []
      const classOption = classes.find((c) => c.id === classEventId)
      const programOption = topPrograms.find((p) => p.id === Number(row.programsId))
      const memberIndex = memberIndexMap.get(row.memberClientId)
      const invited = leadRegistration?.selections[index]
      const base = {
        memberIndex,
        classEventId,
        programId: classEventId,
        programsId: row.programsId !== '' ? Number(row.programsId) : undefined,
        schedulingFormId: invited && invited.kind !== 'reserved'
          ? pack?.formId ?? row.schedulingFormId
          : row.schedulingFormId ?? pack?.formId ?? undefined,
        programName: programOption?.displayName || programOption?.name || classOption?.displayName || classOption?.name,
        className: classOption?.displayName || classOption?.name,
        classActiveDates: pack?.classActiveDates ?? undefined,
        daysPerWeek: 1,
        selectedPricingOptionKey: row.selectedPricingOptionKey,
        enrollmentStartDate: row.enrollmentStartDate || undefined,
        scheduleLabel: invited?.scheduleLabel,
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
        username: member.portalAccessRequested === true ? member.username : '',
        password: member.portalAccessRequested === true ? member.password : '',
        confirmPassword: member.portalAccessRequested === true ? member.confirmPassword : '',
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
      pendingDropInId: pendingDropInId && /^\d+$/.test(pendingDropInId) ? Number(pendingDropInId) : null,
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
        next.selectedPricingOptionKey = undefined
        if (patch.programsId !== '') void loadClassesForProgram(Number(patch.programsId))
      }
      if (patch.classEventId !== undefined && patch.classEventId !== row.classEventId) {
        next.offeringIds = []
        next.selectedSlotKeys = []
        next.slotGroupId = undefined
        next.timeSlotId = undefined
        next.selectedPricingOptionKey = undefined
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
      const hasUnsignedSelectedWaivers = checkedTemplateIds.some((templateId) =>
        waivers.some((waiver) => waiver.id === templateId && waiver.acceptance_id == null),
      )
      if (!allWaiversAlreadySigned || hasUnsignedSelectedWaivers) {
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
        if (isPublicFunnel) {
          trackEvent('waiver_completed', window.location.pathname, {
            properties: { waiver_count: waivers.length },
          })
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
            ? 'We emailed your parent/guardian a secure link to create the adult account, sign waivers on your behalf, and finalize enrollment.'
            : `Invite created. Share this link: ${data.data?.inviteUrl ?? ''}`,
        )
        if (returnTo) {
          void flushEvents({ useBeacon: true })
          window.location.href = returnTo
          return
        }
        onComplete?.(data.data)
        return
      }

      const payload = buildPayload()
      const endpoint = leadRegistration ? `/api/signup/lead/${leadRegistration.inviteId}/complete` : isAdmin ? '/api/admin/signup/family' : '/api/signup/family'
      const res = isAdmin
        ? await adminApiRequest(endpoint, { method: 'POST', body: JSON.stringify(leadRegistration ? { ...payload, token: leadRegistration.token, session: leadRegistration.session } : payload) })
        : await fetch(`${apiUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadRegistration ? { ...payload, token: leadRegistration.token, session: leadRegistration.session } : payload),
          })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Signup failed')
      if (leadRegistration) {
        const login = await loginMemberWithCredentials(apiUrl, {
          emailOrUsername: primaryAdult.username,
          password: primaryAdult.password,
        }).catch(() => null)
        onComplete?.({ ...data.data, ...login })
        setSuccessMessage('Account setup completed.')
        return
      }
      if (publicCartSelections.length > 0) clearPublicEnrollmentCart()
      if (isPublicFunnel) {
        trackEvent('sign_up', window.location.pathname, {
          properties: {
            method: 'family_wizard',
            family_member_count: 1 + additionalMembers.length,
            enrollment_count: enrollments.length,
          },
        })
      }
      const pendingDropIn = data.data?.completedDropIn?.status === 'payment_pending' ? data.data.completedDropIn : null
      if (!isAdmin && (returnTo || pendingDropIn || data.data?.pendingEnrollments?.length > 0)) {
        const pendingEnrollments = data.data?.pendingEnrollments ?? []
        const destination = pendingDropIn ? `/drop-in?booking=${Number(pendingDropIn.id)}`
          : pendingEnrollments.length > 0 ? '/?enrollment=review' : returnTo ?? '/?enrollment=review'
        void flushEvents({ useBeacon: true })
        if (await continueFamilyEnrollmentCheckout(apiUrl, { ...data.data, pendingEnrollments }, primaryAdult, destination)) return
        const loginDestination = new URL(destination, window.location.origin)
        loginDestination.searchParams.set('login', '1')
        setSuccessDestination(destination === '/?enrollment=review' ? destination : `${loginDestination.pathname}${loginDestination.search}${loginDestination.hash}`)
        setSuccessMessage('Account created. Your class selections are awaiting checkout. Sign in to pay by credit card.')
        return
      }
      if (returnTo) {
        // Flush before hard navigation so the conversion event is not lost.
        void flushEvents({ useBeacon: true })
        window.location.href = returnTo
        return
      }
      if (isWaiversMemberships) {
        try {
          const login = await loginMemberWithCredentials(apiUrl, {
            emailOrUsername: primaryAdult.username,
            password: primaryAdult.password,
          })
          onComplete?.({ ...data.data, ...login })
          return
        } catch (loginErr) {
          console.warn('[signup] auto-login after waivers signup failed:', loginErr)
        }
        onComplete?.(data.data)
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

  const maxStep = isMinorStart ? 2 : isWaiversMemberships ? 3 : 4
  const enrollmentStep = isMinorStart ? 2 : 3
  const waiverStep = isWaiversMemberships ? 3 : 4

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
      const err = validateFamilyMembersStep()
      if (err) {
        setError(err)
        return
      }
      if (leadRegistration && !isWaiversMemberships) {
        const programIds = new Set(leadRegistration.selections.filter((item) => item.kind === 'program').map((item) => item.programsId))
        const classIds = new Set(leadRegistration.selections.flatMap((item) =>
          item.kind === 'class' && item.classEventId != null ? [item.classEventId] : [],
        ))
        setLoading(true)
        await Promise.all([
          ...Array.from(programIds, loadClassesForProgram),
          ...Array.from(classIds, loadOfferingsForClass),
        ])
        setLoading(false)
      }
    }
    if (step === enrollmentStep && !isWaiversMemberships) {
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
        {!leadRegistration && <button
          type="button"
          onClick={() => setEnrollments((prev) => [...prev, emptyEnrollment()])}
          className="inline-flex items-center gap-1 text-sm text-vortex-red font-semibold"
        >
          <UserPlus className="w-4 h-4" /> Add enrollment
        </button>}
      </div>
      <p className="text-sm text-gray-600">
        {leadRegistration
          ? 'Review the selections in your invitation and fill in the remaining details before checkout.'
          : 'Each enrollment is for one family member. To enroll another child in the same class, use “Enroll another family member in this class” below. Changing the family member on an existing enrollment only changes who that enrollment is for.'}
      </p>
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
      {!enrollPrefill && publicCartSelections.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          Your {publicCartSelections.length}{' '}
          {publicCartSelections.length === 1 ? 'selected class time is' : 'selected class times are'} ready.
          <span className="block mt-1 text-blue-800">
            Choose who each class is for. You can still change schedules or add more classes below.
          </span>
        </div>
      )}
      {enrollments.length === 0 && (
        <p className="text-sm text-gray-500">Optional: enroll in a program now, or continue without enrolling and sign up for classes later.</p>
      )}
      {enrollments.map((row, index) => {
        const invited = leadRegistration?.selections[index]
        const reservedTime = invited?.kind === 'reserved'
        const programLabel = invited?.programName ?? invited?.label.split(' / ')[0]
        const classLabel = invited?.className ?? invited?.label.split(' / ')[1]?.split(' · ')[0] ?? invited?.label
        const classes = row.programsId !== '' ? (classesByProgram[Number(row.programsId)] ?? []) : []
        const catalog = row.classEventId !== '' ? offeringsByClass[Number(row.classEventId)] : null
        const scheduleOptions = catalog?.scheduleOptions ?? []
        const groupedScheduleOptions = groupScheduleOptions(scheduleOptions)

        return (
          <div key={index} className={`rounded-xl border p-4 space-y-4 ${leadRegistration?.focusedSelection === index ? 'border-vortex-red' : 'border-gray-200'}`}>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor={`enrollment-member-${index}`} className="block text-xs font-semibold text-gray-600 mb-1">Family member</label>
                <select
                  id={`enrollment-member-${index}`}
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                  value={row.memberClientId}
                  disabled={invited?.childIndex != null}
                  onChange={(e) => updateEnrollmentRow(index, { memberClientId: e.target.value })}
                >
                  <option value="">Select family member</option>
                  {allAthletes.map((m) => (
                    <option key={m.clientId} value={m.clientId}>{m.firstName} {m.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`enrollment-program-${index}`} className="block text-xs font-semibold text-gray-600 mb-1">Program</label>
                <select
                  id={`enrollment-program-${index}`}
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                  value={row.programsId}
                  disabled={Boolean(invited)}
                  onChange={(e) => updateEnrollmentRow(index, {
                    programsId: e.target.value === '' ? '' : Number(e.target.value),
                  })}
                >
                  <option value="">Select program</option>
                  {invited ? <option value={invited.programsId}>{programLabel}</option> : topPrograms.map((p) => (
                    <option key={p.id} value={p.id}>{p.displayName || p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor={`enrollment-class-${index}`} className="block text-xs font-semibold text-gray-600 mb-1">Class</label>
              <select
                id={`enrollment-class-${index}`}
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                value={row.classEventId}
                disabled={row.programsId === '' || invited?.classEventId != null}
                onChange={(e) => updateEnrollmentRow(index, {
                  classEventId: e.target.value === '' ? '' : Number(e.target.value),
                })}
              >
                <option value="">Select class</option>
                {invited?.classEventId != null ? <option value={invited.classEventId}>{classLabel}</option> : classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName || c.name}</option>
                ))}
              </select>
            </div>

            {invited?.kind === 'program' && classes.length === 0 && (
              <p className="text-sm text-gray-600">
                {classesByProgram[invited.programsId] ? 'No classes are currently available for this program.' : 'Classes could not be loaded.'}
                {!classesByProgram[invited.programsId] && <button type="button" className="ml-2 text-vortex-red underline" onClick={() => void loadClassesForProgram(invited.programsId)}>Retry</button>}
              </p>
            )}

            {catalog?.classActiveDates && (
              <p className="text-sm text-gray-700">
                Class active dates: <span className="font-medium">{catalog.classActiveDates}</span>
              </p>
            )}

            <EnrollmentStartDateField
              id={`family-enrollment-start-date-${index}`}
              value={row.enrollmentStartDate}
              onChange={(value) => updateEnrollmentRow(index, { enrollmentStartDate: value })}
              required={Boolean(invited) || row.classEventId !== ''}
            />

            {reservedTime && (
              <div>
                <p className="text-xs font-semibold text-gray-600">Reserved class time</p>
                <p className="mt-1 text-sm">{invited.scheduleLabel ?? invited.label}</p>
              </div>
            )}

            {invited && !reservedTime && row.classEventId !== '' && (
              <div>
                <label htmlFor={`enrollment-time-${index}`} className="mb-1 block text-xs font-semibold text-gray-600">Class time</label>
                <select
                  id={`enrollment-time-${index}`}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
                  value={row.selectedSlotKeys[0] ?? ''}
                  onChange={(event) => updateEnrollmentRow(index, { selectedSlotKeys: event.target.value ? [event.target.value] : [] })}
                >
                  <option value="">Select class time</option>
                  {groupedScheduleOptions.map((group) => (
                    <optgroup key={group.options[0].slotGroupId} label={[group.offeringLabel, group.offeringDates].filter(Boolean).join(' · ')}>
                      {group.options.map((option) => {
                        const key = slotOptionKey(option.slotGroupId, option.timeSlotId)
                        return <option key={key} value={key}>{option.scheduleLabel}</option>
                      })}
                    </optgroup>
                  ))}
                </select>
                {catalog?.priceLabel && <p className="mt-1 text-xs text-gray-500">Typical price {catalog.priceLabel}</p>}
                {catalog && scheduleOptions.length === 0 && <p className="mt-1 text-sm text-gray-600">No class times are currently available.</p>}
                {!catalog && error && <button type="button" className="mt-1 text-sm text-vortex-red underline" onClick={() => void loadOfferingsForClass(Number(row.classEventId))}>Retry loading class times</button>}
              </div>
            )}

            {!invited && scheduleOptions.length > 0 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Active dates & schedule (select all that apply)
                  </label>
                  {catalog?.priceLabel && (
                    <p className="text-xs text-gray-500 mb-2">Typical price: {catalog.priceLabel}</p>
                  )}
                </div>
                <ScheduleOptionCheckboxGrid
                  groups={groupedScheduleOptions}
                  selectedSlotKeys={row.selectedSlotKeys}
                  onToggle={(key, checked) => toggleSlotSelection(index, key, checked)}
                />
              </div>
            )}

            {!invited && !isMinorStart && allAthletes.length > 1 && row.classEventId !== '' && (
              <button
                type="button"
                onClick={() => setEnrollments((prev) => [...prev, {
                  ...row,
                  memberClientId: '',
                  selectedSlotKeys: [...row.selectedSlotKeys],
                  offeringIds: [...row.offeringIds],
                }])}
                className="block text-sm text-vortex-red font-semibold"
              >
                <UserPlus className="mr-1 inline h-4 w-4" />
                Enroll another family member in this class
              </button>
            )}
            {!invited && <button
              type="button"
              onClick={() => setEnrollments((prev) => prev.filter((_, i) => i !== index))}
              className="text-xs text-red-600 font-semibold"
            >
              Remove enrollment
            </button>}
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
        {!isAdmin && <a href={successDestination} className="mt-4 inline-block font-semibold text-vortex-red">Continue to member portal</a>}
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
          {step === 2 && (isMinorStart ? 'Enrollment & send invite' : 'Family members')}
          {step === 3 && !isMinorStart && !isWaiversMemberships && 'Enrollment'}
          {step === waiverStep && !isMinorStart && 'Waivers'}
        </p>
      </div>

      {leadRegistration && step === 1 && <p className="rounded-lg bg-blue-50 p-3 text-sm">Choose a new password to replace the temporary password. You may also change the suggested username.</p>}
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
          {leadRegistration && (
            <section aria-labelledby="lead-primary-member" className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 id="lead-primary-member" className="font-semibold text-gray-900">Family member 1 · Primary account holder</h3>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => { setError(null); setStep(1) }}
                  className="text-sm font-semibold text-vortex-red disabled:opacity-50"
                >
                  Edit primary account holder
                </button>
              </div>
              <p className="mt-2 font-medium text-gray-800">{primaryAdult.firstName} {primaryAdult.lastName}</p>
              <p className="break-all text-sm text-gray-600">{primaryAdult.email}</p>
              <p className="text-sm text-gray-600">{formatPhoneForDisplay(primaryAdult.phone)}</p>
            </section>
          )}
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
                if (isPublicFunnel) {
                  trackEvent('family_member_added', window.location.pathname, {
                    properties: { member_index: additionalMembers.length + 1 },
                  })
                }
                setAdditionalMembers((prev) => [...prev, m])
              }}
              className="inline-flex items-center gap-1 text-sm text-vortex-red font-semibold"
            >
              <Plus className="w-4 h-4" /> Add member
            </button>
            )}
          </div>
          {leadRegistration && (
            <p className="text-sm text-gray-600">
              {leadRegistration.children.length > 0 && 'Confirm the details for each child on your invitation. '}
              Use Add member for another child or adult in your family.
            </p>
          )}
          {additionalMembers.length === 0 && (
            <p className="text-sm text-gray-500">No additional members yet. Continue if only one person is joining.</p>
          )}
          {additionalMembers.map((member, index) => {
            const memberNumber = index + (leadRegistration ? 2 : 1)
            const isInvitedChild = Boolean(leadRegistration && index < leadRegistration.children.length)
            return (
              <div key={member.clientId} className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-gray-800">
                    Family member {memberNumber}{isInvitedChild ? ` · Child ${index + 1}` : ''}
                  </h4>
                  {!isInvitedChild && (
                    <button type="button" aria-label={`Remove family member ${memberNumber}`} onClick={() => setAdditionalMembers((prev) => prev.filter((m) => m.clientId !== member.clientId))} className="text-gray-500 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {renderMemberFields(
                  member,
                  (updates) => setAdditionalMembers((prev) => prev.map((m) => (m.clientId === member.clientId ? { ...m, ...updates } : m))),
                  { variant: 'family', fieldIdPrefix: `family-${index}`, memberIndex: index },
                )}
              </div>
            )
          })}
        </div>
      )}

      {step === enrollmentStep && !isWaiversMemberships && renderEnrollmentSection()}

      {step === waiverStep && !isMinorStart && (
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
