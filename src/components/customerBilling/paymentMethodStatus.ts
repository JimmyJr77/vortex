import type { CustomerBillingOverview } from './types'

export function paymentMethodIsMissing(method: CustomerBillingOverview['paymentMethod']): boolean {
  return !method.available && (method.syncStatus === 'current' || method.syncStatus === 'not_linked')
}
