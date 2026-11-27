import { EMAIL_SIGNATURE } from '../../backend/email/emailBranding.js'

export type { VortexEmailSignature } from '../../backend/email/emailBranding.js'

// Older preview responses may omit signature metadata. Keep their preview
// consistent with the standard sender until the backend is redeployed.
export const defaultEmailSignature = EMAIL_SIGNATURE
