import type { InquiryCamper } from '../config/inquiryOptions'
import { getApiUrl } from './api'

const LEGACY_CLASS_TYPE_MAP: Record<string, 'Adult Classes' | 'Child Classes'> = {
  Camps: 'Child Classes',
  'Youth Classes': 'Child Classes',
  'Homeschool Program': 'Adult Classes',
  'Gymnastics Summer Camp': 'Child Classes',
  'Summer Athletic Development Program': 'Child Classes',
}

type RegistrationApiCapabilities = {
  registrationInquiryOverhaul: boolean
}

let cachedCapabilities: RegistrationApiCapabilities | null = null

export async function getRegistrationApiCapabilities(): Promise<RegistrationApiCapabilities> {
  if (cachedCapabilities) return cachedCapabilities

  try {
    const res = await fetch(`${getApiUrl()}/api/health`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error('health check failed')
    const data = (await res.json()) as {
      buildId?: string
      apiFeatures?: { registrationInquiryOverhaul?: boolean }
    }
    cachedCapabilities = {
      registrationInquiryOverhaul:
        data.apiFeatures?.registrationInquiryOverhaul === true ||
        data.buildId === 'inquiry-overhaul-2026-06-15',
    }
  } catch {
    cachedCapabilities = { registrationInquiryOverhaul: false }
  }

  return cachedCapabilities
}

/** Map inquiry payloads for older production APIs that only accept legacy class types. */
export function adaptRegistrationPayloadForApi(
  payload: Record<string, unknown>,
  supportsInquiryOverhaul: boolean,
): Record<string, unknown> {
  if (supportsInquiryOverhaul) return payload

  const out: Record<string, unknown> = { ...payload }
  const extras: string[] = []

  if (Array.isArray(out.classTypes)) {
    const mapped = (out.classTypes as string[])
      .map((type) => {
        if (type === 'Adult Classes' || type === 'Child Classes') return type
        return LEGACY_CLASS_TYPE_MAP[type] ?? null
      })
      .filter(Boolean) as string[]
    out.classTypes = [...new Set(mapped)]
  }

  if (out.inquirySource) {
    extras.push(`Inquiry source: ${String(out.inquirySource)}`)
    delete out.inquirySource
  }

  if (out.submitterRole) {
    extras.push(`Submitter role: ${String(out.submitterRole)}`)
    delete out.submitterRole
  }

  if (Array.isArray(out.campers) && out.campers.length > 0) {
    const lines = (out.campers as InquiryCamper[]).map((camper, index) => {
      const parts = [`Camper ${index + 1}`]
      if (camper.firstName) parts.push(camper.firstName)
      if (camper.lastName) parts.push(camper.lastName)
      if (camper.dateOfBirth) parts.push(`DOB ${camper.dateOfBirth}`)
      return parts.join(' — ')
    })
    extras.push(lines.join('\n'))
    delete out.campers
  }

  if (extras.length > 0) {
    const prefix = extras.join('\n')
    out.message = out.message ? `${prefix}\n\n${out.message}` : prefix
  }

  return out
}
