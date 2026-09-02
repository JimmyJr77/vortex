import type { AccountDirectoryRow } from '../accountDirectory'

export type MemberAccountTab =
  | 'details'
  | 'security'
  | 'notes'
  | 'missed-classes'

export type MemberDirectorySummary = Pick<
  AccountDirectoryRow,
  | 'recordStatus'
  | 'portalAccess'
  | 'staffAccess'
  | 'household'
  | 'participation'
  | 'waiver'
  | 'ageGroup'
  | 'dataQuality'
>

export interface MemberEnrollment {
  id: number
  programId?: number
  program_id?: number
  iterationId?: number | null
  programDisplayName?: string
  program_display_name?: string
  daysPerWeek?: number
  days_per_week?: number
  selectedDays?: string[] | string
  selected_days?: string[] | string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export interface MemberDetailData {
  id: number
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  username?: string | null
  dateOfBirth?: string | null
  age?: number | null
  familyId?: number | null
  familyName?: string | null
  familyUsername?: string | null
  address?: string | null
  billingStreet?: string | null
  billingCity?: string | null
  billingState?: string | null
  billingZip?: string | null
  isActive?: boolean
  isFamilyPayer?: boolean
  enrollments?: MemberEnrollment[]
  parentGuardians?: Array<{
    id: number
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
    username?: string | null
  }>
  children?: Array<{
    id: number
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
    dateOfBirth?: string | null
  }>
  emergencyContacts?: Array<{
    id?: number
    name?: string
    phone?: string
    relationship?: string
    email?: string
  }>
  medicalNotes?: string | null
  internalFlags?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface MemberFamilyData {
  familyUsername?: string
  members?: Array<{
    id: number
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    dateOfBirth?: string
    age?: number | null
    isActive?: boolean
    isFamilyPayer?: boolean
  }>
}
