export interface PublicWaiverTemplate {
  id: number
  name: string
  version: string
  body: string
  waiver_type?: string | null
  is_required?: boolean
  acceptance_id?: number | null
  accepted_at?: string | null
}

export function validateWaiverSigning({
  waivers,
  checkedTemplateIds,
  agreeAll,
  signatureName,
}: {
  waivers: PublicWaiverTemplate[]
  checkedTemplateIds: number[]
  agreeAll: boolean
  signatureName: string
  paymentPolicyAcknowledged?: boolean
}): string | null {
  if (waivers.length === 0) {
    return 'Waivers could not be loaded. Refresh the page before creating your account.'
  }
  const required = waivers.filter((waiver) => waiver.is_required !== false && !waiver.acceptance_id)
  for (const waiver of required) {
    if (!checkedTemplateIds.includes(waiver.id)) {
      return `Please agree to ${waiver.name}.`
    }
  }
  if (!agreeAll) return 'Please check "I AGREE TO ALL OF THE ABOVE".'
  if (!signatureName.trim()) return 'Full name signature is required.'
  return null
}
