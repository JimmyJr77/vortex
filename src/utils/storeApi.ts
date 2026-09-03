import { adminApiRequest, getApiUrl } from './api'

export type StoreCategory = 'clothing' | 'equipment' | 'food' | 'drink' | 'other'
export type StorePaymentMethod = 'billing_account' | 'card' | 'cash' | 'check' | 'mobile'

export interface StoreProduct {
  id: number
  sku: string
  name: string
  description: string | null
  category: StoreCategory
  tags: StoreCategory[]
  priceCents: number
  inventoryQuantity: number | null
  isPublic: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface StoreDiscountCode {
  id: number
  code: string
  discountType: 'percent' | 'amount'
  value: number
  minimumOrderCents: number
  maxRedemptions: number | null
  redemptionCount: number
  startsAt: string | null
  endsAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface StoreOrderItem {
  id: number
  productId: number | null
  productName: string
  sku: string | null
  unitPriceCents: number
  quantity: number
  lineTotalCents: number
}

export interface StoreOrder {
  id: number
  orderNumber: string
  memberId: number | null
  purchaserName: string | null
  purchaserEmail: string | null
  source: 'public' | 'member' | 'admin'
  status: 'awaiting_payment' | 'placed' | 'fulfilled' | 'cancelled'
  paymentStatus: 'pending' | 'billed_to_account' | 'paid' | 'external'
  paymentMethod: StorePaymentMethod
  externalReference: string | null
  subtotalCents: number
  discountCents: number
  totalCents: number
  discountCode: string | null
  fulfillmentNote: string
  pickedUpAt: string | null
  createdAt: string
  updatedAt: string
  stripeCheckoutUrl: string | null
  items: StoreOrderItem[]
}

export interface StoreCartLine {
  productId: number
  quantity: number
}

function requestKey(prefix: string) {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${id}`
}

async function parseResponse<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => ({}))
  if (!response.ok || json?.success === false) throw new Error(json?.message || `Request failed (${response.status})`)
  return (json?.data ?? json) as T
}

export async function fetchPublicStoreProducts(): Promise<StoreProduct[]> {
  const response = await fetch(`${getApiUrl()}/api/store/products`)
  return parseResponse<StoreProduct[]>(response)
}

export async function fetchMemberStoreProducts(token: string): Promise<StoreProduct[]> {
  const response = await fetch(`${getApiUrl()}/api/members/store/products`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseResponse<StoreProduct[]>(response)
}

export async function fetchMemberStoreOrders(token: string): Promise<StoreOrder[]> {
  const response = await fetch(`${getApiUrl()}/api/members/store/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseResponse<StoreOrder[]>(response)
}

export async function checkoutMemberStoreOrder(
  token: string,
  payload: { items: StoreCartLine[]; paymentMethod: StorePaymentMethod; discountCode?: string },
): Promise<StoreOrder> {
  const response = await fetch(`${getApiUrl()}/api/members/store/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': requestKey('member-store'),
    },
    body: JSON.stringify(payload),
  })
  return parseResponse<StoreOrder>(response)
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return parseResponse<T>(await adminApiRequest(path, options))
}

export interface StoreDashboard {
  summary: { orderCount: number; salesCents: number; awaitingPaymentCount: number; pickupCount: number }
  lowStock: StoreProduct[]
  orders: StoreOrder[]
}

export interface StoreActionAudit {
  id: number
  action: string
  entityType: string
  entityId: number | null
  actorName: string
  details: Record<string, unknown>
  occurredAt: string
}

export const adminFetchStoreDashboard = () => adminRequest<StoreDashboard>('/api/admin/store/dashboard')
export const adminFetchStoreProducts = () => adminRequest<StoreProduct[]>('/api/admin/store/products')
export const adminFetchStoreDiscountCodes = () => adminRequest<StoreDiscountCode[]>('/api/admin/store/discount-codes')
export const adminFetchStoreActionAudit = () => adminRequest<StoreActionAudit[]>('/api/admin/store/audit')

export async function adminDownloadStoreActionAudit() {
  const response = await adminApiRequest('/api/admin/store/audit/export')
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.message || `Could not export the store action audit (${response.status}).`)
  }
  const file = await response.blob()
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = `store-action-audit-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function adminCreateStoreProduct(input: {
  sku: string; name: string; description?: string; tags: StoreCategory[]; priceCents: number
  inventoryQuantity: number | null; isPublic: boolean; sortOrder?: number
}) {
  return adminRequest<StoreProduct>('/api/admin/store/products', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
}

export async function adminUpdateStoreProduct(id: number, input: Partial<StoreProduct>) {
  return adminRequest<StoreProduct>(`/api/admin/store/products/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
}

export async function adminAdjustStoreInventory(id: number, quantityDelta: number, reason: string) {
  return adminRequest<StoreProduct>(`/api/admin/store/products/${id}/inventory`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantityDelta, reason }),
  })
}

export async function adminCreateStoreDiscount(input: {
  code: string; discountType: 'percent' | 'amount'; value: number; minimumOrderCents?: number
  maxRedemptions?: number | null; startsAt?: string | null; endsAt?: string | null
}) {
  return adminRequest<StoreDiscountCode>('/api/admin/store/discount-codes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
}

export async function adminUpdateStoreDiscount(id: number, input: { isActive: boolean }) {
  return adminRequest<StoreDiscountCode>(`/api/admin/store/discount-codes/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
}

export async function adminDeleteStoreDiscount(id: number) {
  await adminRequest(`/api/admin/store/discount-codes/${id}`, { method: 'DELETE' })
}

export interface StoreMemberOption { id: number; name: string; email: string | null }

export async function adminSearchStoreMembers(query: string): Promise<StoreMemberOption[]> {
  return adminRequest<StoreMemberOption[]>(`/api/admin/store/members?q=${encodeURIComponent(query)}`)
}

export async function adminCreateStoreOrder(payload: {
  memberId?: number | null; purchaserName?: string | null; purchaserEmail?: string | null
  items: StoreCartLine[]; paymentMethod: StorePaymentMethod; discountCode?: string; externalReference?: string
}) {
  return adminRequest<StoreOrder>('/api/admin/store/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey('admin-store') },
    body: JSON.stringify(payload),
  })
}

export async function adminUpdateStoreOrder(id: number, status: 'fulfilled' | 'cancelled') {
  return adminRequest<StoreOrder>(`/api/admin/store/orders/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
  })
}

export async function adminCollectStoreOrderPayment(id: number) {
  return adminRequest<StoreOrder>(`/api/admin/store/orders/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'collect_payment' }),
  })
}
