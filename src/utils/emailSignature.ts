export interface VortexEmailSignature {
  name: string
  address: string
  website: string
  phone: string
  logoUrl: string
}

// Older preview responses may omit signature metadata. Keep their preview
// consistent with the standard sender until the backend is redeployed.
export const defaultEmailSignature: VortexEmailSignature = {
  name: 'Vortex Athletics & Gymnastics',
  address: '4961 Tesla Dr, Ste E, Bowie, MD 20715',
  website: 'www.vortexathletics.com',
  phone: '443-422-4794 (gym)',
  logoUrl: 'https://vortexathletics.com/vortex-athletics-gymnastics-logo.png',
}
