import { getApiUrl } from './api'
import { getCurrentEnrollSiteKey } from './enrollSite'

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
  classes: PublicClassOffered[]
}

export interface ClassesOfferedResponse {
  programs: PublicProgramOffered[]
}

export async function fetchClassesOffered(): Promise<ClassesOfferedResponse> {
  const site = getCurrentEnrollSiteKey()
  const res = await fetch(`${getApiUrl()}/api/public/classes-offered?site=${encodeURIComponent(site)}`)
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to load classes offered')
  }
  return data.data as ClassesOfferedResponse
}
