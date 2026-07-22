import { getApiUrl } from './api'
import type { ProgramPricingOption } from './programPricingOptions'
import type { MultiClassPassPackage } from './multiClassPassPackages'

export interface PublicClassOffered {
  id: number
  displayName: string
  description: string | null
  skillLevel: string | null
  ageMin: number | null
  ageMax: number | null
  skillRequirements: string | null
  formId: number | null
  enrollVisible?: boolean
  signupUrl: string | null
}

export interface PublicProgramOffered {
  id: number
  displayName: string
  description: string | null
  primarySportName?: string | null
  pricingCostOptions?: ProgramPricingOption[]
  multiClassPassPackages?: MultiClassPassPackage[]
  classes: PublicClassOffered[]
}

export interface ClassesOfferedResponse {
  programs: PublicProgramOffered[]
}

export async function fetchClassesOffered(): Promise<ClassesOfferedResponse> {
  const res = await fetch(`${getApiUrl()}/api/public/classes-offered`)
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to load classes offered')
  }
  return data.data as ClassesOfferedResponse
}

export interface MemberMultiClassPassBalance {
  id: number
  memberId: number
  programsId: number
  packageId: string
  classCountPurchased: number
  classesRemaining: number
  priceCents: number
  packageLabel: string | null
  purchasedAt: string
}

export async function fetchMemberMultiClassPasses(memberToken: string): Promise<MemberMultiClassPassBalance[]> {
  const res = await fetch(`${getApiUrl()}/api/members/multi-class-passes`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to load multi-class passes')
  }
  return data.data ?? []
}
