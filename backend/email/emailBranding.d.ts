export interface VortexEmailSignature {
  name: string
  address: string
  website: string
  phone: string
  logoUrl: string
}

export const EMAIL_LAYOUT_VERSION: string
export const EMAIL_LOGO_URL: string
export const EMAIL_SIGNATURE: Readonly<VortexEmailSignature>
