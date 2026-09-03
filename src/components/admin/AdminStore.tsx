import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Check, ClipboardList, Copy, Download, History, LoaderCircle, PackagePlus, Pencil, Plus, ReceiptText, RefreshCw, Search, ShoppingBag, Tag, X } from 'lucide-react'
import {
  adminAdjustStoreInventory,
  adminCollectStoreOrderPayment,
  adminCreateStoreDiscount,
  adminCreateStoreOrder,
  adminCreateStoreProduct,
  adminDeleteStoreDiscount,
  adminDownloadStoreActionAudit,
  adminFetchStoreActionAudit,
  adminFetchStoreDashboard,
  adminFetchStoreDiscountCodes,
  adminFetchStoreProducts,
  adminSearchStoreMembers,
  adminUpdateStoreDiscount,
  adminUpdateStoreOrder,
  adminUpdateStoreProduct,
  type StoreCartLine,
  type StoreActionAudit,
  type StoreDiscountCode,
  type StoreMemberOption,
  type StoreOrder,
  type StorePaymentMethod,
  type StoreProduct,
  type StoreCategory,
} from '../../utils/storeApi'

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`

const STORE_CATEGORY_OPTIONS: Array<{ value: StoreCategory; label: string }> = [
  { value: 'clothing', label: 'Clothing' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'food', label: 'Food' },
  { value: 'drink', label: 'Drink' },
  { value: 'other', label: 'Other' },
]

const CHECKOUT_SECTION_ORDER: StoreCategory[] = ['food', 'drink', 'clothing', 'equipment', 'other']

const checkoutSectionLabel = (category: StoreCategory) => (
  STORE_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category
)

const primaryCheckoutCategory = (product: StoreProduct): StoreCategory => {
  for (const category of CHECKOUT_SECTION_ORDER) {
    if (product.tags.includes(category)) return category
  }
  return product.category
}

const storeTagLabels = (tags: StoreCategory[]) => (
  tags.map((tag) => STORE_CATEGORY_OPTIONS.find((option) => option.value === tag)?.label ?? tag).join(', ')
)

const storeCategoryLabel = (category: StoreCategory) => storeTagLabels([category])

const YOUTH_CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const
const ADULT_CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const
const CLOTHING_SIZE_SORT_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const

type ClothingSizeGroup = 'youth' | 'adult'
type CatalogSortKey = 'name' | 'sku'

type ParsedClothingProduct = {
  baseName: string
  baseSku: string
  group: ClothingSizeGroup | null
  size: string | null
}

const clothingSizeRank = (size: string | null) => {
  if (!size) return CLOTHING_SIZE_SORT_ORDER.length
  const index = CLOTHING_SIZE_SORT_ORDER.indexOf(size.toUpperCase() as typeof CLOTHING_SIZE_SORT_ORDER[number])
  return index === -1 ? CLOTHING_SIZE_SORT_ORDER.length : index
}

const parseClothingSkuSuffix = (sku: string) => {
  const match = sku.match(/^(.+)-(Y|A)(XXS|XS|S|M|L|XL|XXL|XXXL)$/)
  if (!match) return null
  return {
    baseSku: match[1],
    group: match[2] === 'Y' ? 'youth' as const : 'adult' as const,
    size: match[3],
  }
}

const parseClothingProduct = (product: StoreProduct): ParsedClothingProduct => {
  if (!product.tags.includes('clothing')) {
    return { baseName: product.name, baseSku: product.sku, group: null, size: null }
  }

  const nameMatch = product.name.match(/^(.+?)\s+\((Youth|Adult)\s+(XXS|XS|S|M|L|XL|XXL|XXXL)\)$/i)
  if (nameMatch) {
    const skuSuffix = parseClothingSkuSuffix(product.sku)
    return {
      baseName: nameMatch[1],
      baseSku: skuSuffix?.baseSku ?? product.sku,
      group: nameMatch[2].toLowerCase() as ClothingSizeGroup,
      size: nameMatch[3].toUpperCase(),
    }
  }

  const skuSuffix = parseClothingSkuSuffix(product.sku)
  if (skuSuffix) {
    return {
      baseName: product.name,
      baseSku: skuSuffix.baseSku,
      group: skuSuffix.group,
      size: skuSuffix.size,
    }
  }

  return { baseName: product.name, baseSku: product.sku, group: null, size: null }
}

const compareClothingSize = (left: ParsedClothingProduct, right: ParsedClothingProduct) => {
  if (left.size == null && right.size == null) return 0
  if (left.size == null) return -1
  if (right.size == null) return 1
  if (left.group !== right.group) {
    if (left.group === 'youth') return -1
    if (right.group === 'youth') return 1
    if (left.group === 'adult') return -1
    if (right.group === 'adult') return 1
  }
  return clothingSizeRank(left.size) - clothingSizeRank(right.size)
}

const compareCatalogProducts = (
  left: StoreProduct,
  right: StoreProduct,
  sort: CatalogSortKey,
  direction: 'asc' | 'desc',
) => {
  const factor = direction === 'asc' ? 1 : -1
  if (left.isActive !== right.isActive) return left.isActive ? -1 : 1

  const parsedLeft = parseClothingProduct(left)
  const parsedRight = parseClothingProduct(right)

  if (sort === 'name') {
    const baseCompare = parsedLeft.baseName.localeCompare(parsedRight.baseName, undefined, { sensitivity: 'base' })
    if (baseCompare !== 0) return factor * baseCompare
    const sizeCompare = compareClothingSize(parsedLeft, parsedRight)
    if (sizeCompare !== 0) return factor * sizeCompare
    return factor * left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  }

  const baseCompare = parsedLeft.baseSku.localeCompare(parsedRight.baseSku, undefined, { sensitivity: 'base' })
  if (baseCompare !== 0) return factor * baseCompare
  const sizeCompare = compareClothingSize(parsedLeft, parsedRight)
  if (sizeCompare !== 0) return factor * sizeCompare
  return factor * left.sku.localeCompare(right.sku, undefined, { sensitivity: 'base' })
}

const compareCheckoutProducts = (left: StoreProduct, right: StoreProduct) => {
  if (primaryCheckoutCategory(left) === 'clothing' && primaryCheckoutCategory(right) === 'clothing') {
    return compareCatalogProducts(left, right, 'name', 'asc')
  }
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
}

type ProductDraft = {
  sku: string
  name: string
  description: string
  tags: StoreCategory[]
  priceCents: number
  inventoryQuantity: number | null
  isPublic: boolean
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const nextSequentialCopySku = (baseSku: string, catalog: StoreProduct[]) => {
  const pattern = new RegExp(`^${escapeRegExp(baseSku)}-(\\d+)$`)
  let maxNumber = 0
  for (const product of catalog) {
    const match = product.sku.match(pattern)
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]))
  }
  return `${baseSku}-${maxNumber + 1}`
}

const buildClothingSizeVariants = (base: ProductDraft, groups: ClothingSizeGroup[]) => {
  const variants: ProductDraft[] = []
  for (const group of groups) {
    const sizes = group === 'youth' ? YOUTH_CLOTHING_SIZES : ADULT_CLOTHING_SIZES
    const labelPrefix = group === 'youth' ? 'Youth' : 'Adult'
    const skuPrefix = group === 'youth' ? 'Y' : 'A'
    for (const size of sizes) {
      variants.push({
        ...base,
        name: `${base.name} (${labelPrefix} ${size})`,
        sku: `${base.sku}-${skuPrefix}${size}`,
      })
    }
  }
  return variants
}

const clothingVariantCount = (groups: ClothingSizeGroup[]) => groups.reduce(
  (sum, group) => sum + (group === 'youth' ? YOUTH_CLOTHING_SIZES.length : ADULT_CLOTHING_SIZES.length),
  0,
)

const emptyProduct: { sku: string; name: string; description: string; tags: StoreCategory[]; price: string; inventory: string; isPublic: boolean } = {
  sku: '',
  name: '',
  description: '',
  tags: ['clothing'],
  price: '',
  inventory: '',
  isPublic: true,
}
type DiscountForm = { code: string; type: 'percent' | 'amount'; value: string; minimum: string; max: string }
const emptyDiscount: DiscountForm = { code: '', type: 'percent', value: '', minimum: '', max: '' }
type AuditSortKey = 'date' | 'person' | 'action'

const auditActionLabel = (action: string) => action.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

function auditSummary(event: StoreActionAudit) {
  const details = event.details
  const changes = details.changes
  if (changes && typeof changes === 'object' && !Array.isArray(changes)) return `Changed: ${Object.keys(changes).join(', ')}`
  const item = typeof details.productName === 'string' ? details.productName : typeof details.name === 'string' ? details.name : ''
  const order = typeof details.orderNumber === 'string' ? details.orderNumber : ''
  const code = typeof details.code === 'string' ? details.code : typeof details.discountCode === 'string' ? details.discountCode : ''
  return [item, order, code].filter(Boolean).join(' · ') || 'Details saved in the audit record.'
}

export default function AdminStore() {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [discounts, setDiscounts] = useState<StoreDiscountCode[]>([])
  const [orders, setOrders] = useState<StoreOrder[]>([])
  const [summary, setSummary] = useState({ orderCount: 0, salesCents: 0, awaitingPaymentCount: 0, pickupCount: 0 })
  const [lowStock, setLowStock] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [productForm, setProductForm] = useState(emptyProduct)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [copySourceProductId, setCopySourceProductId] = useState('')
  const [applyYouthSizingVariants, setApplyYouthSizingVariants] = useState(false)
  const [applyAdultSizingVariants, setApplyAdultSizingVariants] = useState(false)
  const [discountForm, setDiscountForm] = useState<DiscountForm>(emptyDiscount)
  const [saleCart, setSaleCart] = useState<Record<number, number>>({})
  const [productSearch, setProductSearch] = useState('')
  const [salePayment, setSalePayment] = useState<StorePaymentMethod>('card')
  const [saleCode, setSaleCode] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberOptions, setMemberOptions] = useState<StoreMemberOption[]>([])
  const [selectedMember, setSelectedMember] = useState<StoreMemberOption | null>(null)
  const [saleEmail, setSaleEmail] = useState('')
  const [saleName, setSaleName] = useState('')
  const [saleReference, setSaleReference] = useState('')
  const [pendingCardEntryUrl, setPendingCardEntryUrl] = useState<string | null>(null)
  const [auditActions, setAuditActions] = useState<StoreActionAudit[]>([])
  const [showAuditActions, setShowAuditActions] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditExporting, setAuditExporting] = useState(false)
  const [auditSort, setAuditSort] = useState<AuditSortKey>('date')
  const [auditSortDirection, setAuditSortDirection] = useState<'asc' | 'desc'>('desc')
  const [catalogSort, setCatalogSort] = useState<CatalogSortKey>('name')
  const [catalogSortDirection, setCatalogSortDirection] = useState<'asc' | 'desc'>('asc')

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashboard, productRows, discountRows] = await Promise.all([
        adminFetchStoreDashboard(),
        adminFetchStoreProducts(),
        adminFetchStoreDiscountCodes(),
      ])
      setSummary(dashboard.summary)
      setLowStock(dashboard.lowStock)
      setOrders(dashboard.orders)
      setProducts(productRows)
      setDiscounts(discountRows)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the store desk.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAuditActions = useCallback(async () => {
    setAuditLoading(true)
    try {
      setAuditActions(await adminFetchStoreActionAudit())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the store action audit.')
    } finally {
      setAuditLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    if (showAuditActions) void loadAuditActions()
  }, [showAuditActions, loadAuditActions])

  useEffect(() => {
    if (!memberSearch.trim() || selectedMember?.name === memberSearch) {
      setMemberOptions([])
      return
    }
    const handle = window.setTimeout(() => {
      void adminSearchStoreMembers(memberSearch).then(setMemberOptions).catch(() => setMemberOptions([]))
    }, 250)
    return () => window.clearTimeout(handle)
  }, [memberSearch, selectedMember])

  const activeProducts = useMemo(() => products.filter((product) => product.isActive), [products])
  const checkoutProductSections = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase()
    const filtered = activeProducts.filter((product) => {
      if (!query) return true
      return [
        product.name,
        product.sku,
        product.description ?? '',
        storeTagLabels(product.tags),
      ].some((value) => value.toLocaleLowerCase().includes(query))
    })

    return CHECKOUT_SECTION_ORDER.map((category) => ({
      category,
      label: checkoutSectionLabel(category),
      products: filtered
        .filter((product) => primaryCheckoutCategory(product) === category)
        .sort(compareCheckoutProducts),
    })).filter((section) => section.products.length > 0)
  }, [activeProducts, productSearch])
  const checkoutProductCount = checkoutProductSections.reduce((sum, section) => sum + section.products.length, 0)
  const saleLines = useMemo(() => activeProducts.flatMap((product) => {
    const quantity = saleCart[product.id] ?? 0
    return quantity > 0 ? [{ product, quantity }] : []
  }), [activeProducts, saleCart])
  const saleSubtotal = saleLines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0)
  const sortedAuditActions = useMemo(() => [...auditActions].sort((left, right) => {
    const direction = auditSortDirection === 'asc' ? 1 : -1
    if (auditSort === 'date') return direction * (new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime())
    if (auditSort === 'person') return direction * left.actorName.localeCompare(right.actorName)
    return direction * auditActionLabel(left.action).localeCompare(auditActionLabel(right.action))
  }), [auditActions, auditSort, auditSortDirection])
  const sortedCatalogProducts = useMemo(
    () => [...products].sort((left, right) => compareCatalogProducts(left, right, catalogSort, catalogSortDirection)),
    [products, catalogSort, catalogSortDirection],
  )

  const runSave = async (task: () => Promise<void>, success: string) => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await task()
      setNotice(success)
      await reload()
      if (showAuditActions) await loadAuditActions()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Store update failed.')
    } finally {
      setSaving(false)
    }
  }

  const sortAuditBy = (sort: AuditSortKey) => {
    if (auditSort === sort) setAuditSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
    else {
      setAuditSort(sort)
      setAuditSortDirection(sort === 'date' ? 'desc' : 'asc')
    }
  }

  const sortCatalogBy = (sort: CatalogSortKey) => {
    if (catalogSort === sort) setCatalogSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
    else {
      setCatalogSort(sort)
      setCatalogSortDirection('asc')
    }
  }

  const catalogSortIndicator = (sort: CatalogSortKey) => (
    catalogSort === sort ? (catalogSortDirection === 'asc' ? ' ↑' : ' ↓') : ''
  )

  const downloadActionAudit = async () => {
    setAuditExporting(true)
    setError(null)
    try {
      await adminDownloadStoreActionAudit()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download the store action audit.')
    } finally {
      setAuditExporting(false)
    }
  }

  const submitProduct = () => {
    const sizeGroups: ClothingSizeGroup[] = []
    if (applyYouthSizingVariants) sizeGroups.push('youth')
    if (applyAdultSizingVariants) sizeGroups.push('adult')
    const successMessage = editingProductId == null
      ? (sizeGroups.length > 0 ? `${clothingVariantCount(sizeGroups)} clothing size variants added.` : 'Store item added.')
      : 'Store item updated.'

    void runSave(async () => {
      const productInput: ProductDraft = {
        sku: productForm.sku,
        name: productForm.name,
        description: productForm.description,
        tags: productForm.tags,
        priceCents: Math.round(Number(productForm.price) * 100),
        inventoryQuantity: productForm.inventory === '' ? null : Number(productForm.inventory),
        isPublic: productForm.isPublic,
      }

      if (editingProductId == null && sizeGroups.length > 0) {
        const variants = buildClothingSizeVariants(productInput, sizeGroups)
        for (const variant of variants) await adminCreateStoreProduct(variant)
      } else if (editingProductId == null) await adminCreateStoreProduct(productInput)
      else await adminUpdateStoreProduct(editingProductId, productInput)

      setProductForm(emptyProduct)
      setCopySourceProductId('')
      setApplyYouthSizingVariants(false)
      setApplyAdultSizingVariants(false)
      setEditingProductId(null)
    }, successMessage)
  }

  const toggleProductTag = (tag: StoreCategory) => {
    setProductForm((form) => {
      const hasTag = form.tags.includes(tag)
      if (hasTag && form.tags.length === 1) return form
      if (tag === 'clothing' && hasTag) {
        setApplyYouthSizingVariants(false)
        setApplyAdultSizingVariants(false)
      }
      return {
        ...form,
        tags: hasTag ? form.tags.filter((currentTag) => currentTag !== tag) : [...form.tags, tag],
      }
    })
  }

  const startEditingProduct = (product: StoreProduct) => {
    setEditingProductId(product.id)
    setCopySourceProductId('')
    setProductForm({
      sku: product.sku,
      name: product.name,
      description: product.description ?? '',
      tags: product.tags,
      price: (product.priceCents / 100).toFixed(2),
      inventory: product.inventoryQuantity == null ? '' : String(product.inventoryQuantity),
      isPublic: product.isPublic,
    })
    window.setTimeout(() => document.getElementById('store-item-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  const cancelProductEdit = () => {
    setEditingProductId(null)
    setProductForm(emptyProduct)
    setCopySourceProductId('')
    setApplyYouthSizingVariants(false)
    setApplyAdultSizingVariants(false)
  }

  const copyProductToForm = (productId: string) => {
    setCopySourceProductId(productId)
    const product = products.find((item) => String(item.id) === productId)
    if (!product) {
      setProductForm(emptyProduct)
      return
    }
    setProductForm({
      sku: '',
      name: product.name,
      description: product.description ?? '',
      tags: product.tags,
      price: (product.priceCents / 100).toFixed(2),
      inventory: product.inventoryQuantity == null ? '' : String(product.inventoryQuantity),
      isPublic: product.isPublic,
    })
  }

  const createDiscount = () => void runSave(async () => {
    await adminCreateStoreDiscount({
      code: discountForm.code,
      discountType: discountForm.type,
      value: discountForm.type === 'amount' ? Math.round(Number(discountForm.value) * 100) : Number(discountForm.value),
      minimumOrderCents: discountForm.minimum === '' ? 0 : Math.round(Number(discountForm.minimum) * 100),
      maxRedemptions: discountForm.max === '' ? null : Number(discountForm.max),
    })
    setDiscountForm(emptyDiscount)
  }, 'Store discount code added.')

  const setSaleQuantity = (product: StoreProduct, value: number) => {
    const max = product.inventoryQuantity ?? 20
    const quantity = Math.max(0, Math.min(max, value))
    setSaleCart((current) => {
      const next = { ...current }
      if (quantity === 0) delete next[product.id]
      else next[product.id] = quantity
      return next
    })
  }

  const chooseMember = (member: StoreMemberOption) => {
    setSelectedMember(member)
    setMemberSearch(member.name)
    setSaleName(member.name)
    setSaleEmail(member.email || '')
    setMemberOptions([])
  }

  const recordSale = () => void runSave(async () => {
    const items: StoreCartLine[] = saleLines.map(({ product, quantity }) => ({ productId: product.id, quantity }))
    const order = await adminCreateStoreOrder({
      memberId: selectedMember?.id ?? null,
      purchaserName: saleName || null,
      purchaserEmail: saleEmail || null,
      paymentMethod: salePayment,
      items,
      discountCode: saleCode || undefined,
      externalReference: saleReference || undefined,
    })
    setPendingCardEntryUrl(order.stripeCheckoutUrl)
    setSaleCart({})
    setSaleCode('')
    setSaleReference('')
  }, salePayment === 'card' ? 'Secure card entry is ready. The sale will be marked paid after Stripe confirms it.' : 'Sale recorded and receipt sent when an email is available.')

  const updateProduct = (product: StoreProduct, change: Partial<StoreProduct>, success = 'Store item updated.') => void runSave(async () => {
    await adminUpdateStoreProduct(product.id, change)
  }, success)

  const quickCopyProduct = (product: StoreProduct) => void runSave(async () => {
    await adminCreateStoreProduct({
      sku: nextSequentialCopySku(product.sku, products),
      name: product.name,
      description: product.description ?? '',
      tags: product.tags,
      priceCents: product.priceCents,
      inventoryQuantity: product.inventoryQuantity,
      isPublic: product.isPublic,
      sortOrder: product.sortOrder + 1,
    })
  }, 'Store item copied.')

  const adjustInventory = (product: StoreProduct) => {
    const raw = window.prompt(`Adjust ${product.name} inventory by (use - to subtract):`)
    if (raw == null) return
    const quantityDelta = Number(raw)
    if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
      setError('Inventory adjustment must be a non-zero whole number.')
      return
    }
    const reason = window.prompt('Reason for this inventory adjustment:')
    if (!reason?.trim()) return
    void runSave(async () => { await adminAdjustStoreInventory(product.id, quantityDelta, reason.trim()) }, 'Inventory updated.')
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="flex items-center gap-2 text-sm font-bold tracking-wide text-vortex-red"><ShoppingBag className="h-4 w-4" /> STORE DESK</div><h2 className="mt-1 font-display text-3xl font-bold text-gray-950">Sales, pickup, and inventory.</h2><p className="mt-1 text-sm text-gray-600">Store discount codes live here. Apparel can be public; food and drink can stay front-desk only.</p></div>
        <button type="button" onClick={() => void reload()} disabled={loading || saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {notice && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[['Recorded sales', formatMoney(summary.salesCents)], ['Confirmed orders', String(summary.orderCount)], ['Awaiting card payment', String(summary.awaitingPaymentCount)], ['Ready for pickup', String(summary.pickupCount)]].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p><strong className="mt-1 block text-2xl text-gray-950">{value}</strong></div>)}
      </div>

      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-vortex-red" />
              <h3 className="font-display text-xl font-bold text-gray-950">Checkout</h3>
            </div>
            <p className="mt-1 text-sm text-gray-600">Record cash, check, or mobile payment, prepare secure card entry, or add the purchase to a member’s account.</p>
          </div>
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <div className="space-y-3"><label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Member (optional except monthly account)<div className="relative mt-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setSelectedMember(null) }} placeholder="Search member" className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-black" />{memberOptions.length > 0 && <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">{memberOptions.map((member) => <button type="button" key={member.id} onClick={() => chooseMember(member)} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"><strong>{member.name}</strong>{member.email && <span className="ml-2 text-xs text-gray-500">{member.email}</span>}</button>)}</div>}</div></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold uppercase tracking-wide text-gray-500">Receipt name<input value={saleName} onChange={(event) => setSaleName(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-normal normal-case outline-none focus:border-black" /></label><label className="text-xs font-bold uppercase tracking-wide text-gray-500">Receipt email<input type="email" value={saleEmail} onChange={(event) => setSaleEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-normal normal-case outline-none focus:border-black" /></label></div></div>
            <div className="space-y-3"><label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Payment method<select value={salePayment} onChange={(event) => { const paymentMethod = event.target.value as StorePaymentMethod; setSalePayment(paymentMethod); if (paymentMethod !== 'card') setPendingCardEntryUrl(null) }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-black"><option value="card">Input credit/debit details</option><option value="card_terminal" disabled>Card terminal (not available)</option><option value="billing_account">Bill monthly account</option><option value="cash">Cash</option><option value="check">Check</option><option value="mobile">Mobile payment</option></select></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold uppercase tracking-wide text-gray-500">Store code<input value={saleCode} onChange={(event) => setSaleCode(event.target.value.toUpperCase())} placeholder="Optional" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-semibold outline-none focus:border-black" /></label><label className="text-xs font-bold uppercase tracking-wide text-gray-500">Reference<input value={saleReference} onChange={(event) => setSaleReference(event.target.value)} placeholder="Check #, mobile ID…" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-normal normal-case outline-none focus:border-black" /></label></div></div>
          </div>
          <div className="border-t border-gray-100 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Add items</p>
              <label className="relative block w-full sm:w-72">
                <span className="sr-only">Search store products</span>
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products or SKU" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm outline-none focus:border-black" />
                {productSearch && (
                  <button type="button" onClick={() => setProductSearch('')} aria-label="Clear product search" className="absolute right-2 top-2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
            </div>
            <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/60">
              {checkoutProductSections.length === 0 ? (
                <p className="px-3 py-5 text-center text-sm text-gray-500">
                  {productSearch.trim() ? `No active products match “${productSearch}”.` : 'No active products are available for checkout.'}
                </p>
              ) : checkoutProductSections.map((section, sectionIndex) => (
                <section key={section.category} className={sectionIndex > 0 ? 'border-t-2 border-gray-300' : ''}>
                  <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-100 px-4 py-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700">{section.label}</h4>
                  </div>
                  <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    {section.products.map((product) => {
                      const quantity = saleCart[product.id] ?? 0
                      const out = product.inventoryQuantity === 0
                      return (
                        <div key={product.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
                          <div className="min-w-0">
                            <strong className="block truncate text-sm text-gray-900">{product.name}</strong>
                            <span className="text-xs text-gray-500">
                              {formatMoney(product.priceCents)}
                              {product.inventoryQuantity != null ? ` · ${product.inventoryQuantity} in stock` : ''}
                            </span>
                          </div>
                          {quantity === 0 ? (
                            <button type="button" disabled={out} onClick={() => setSaleQuantity(product, 1)} className="shrink-0 rounded-md bg-black px-2.5 py-1.5 text-xs font-bold text-white hover:bg-vortex-red disabled:opacity-40">Add</button>
                          ) : (
                            <div className="flex shrink-0 items-center gap-2">
                              <button type="button" onClick={() => setSaleQuantity(product, quantity - 1)} className="rounded border border-gray-300 p-1"><X className="h-3.5 w-3.5" /></button>
                              <strong className="text-sm">{quantity}</strong>
                              <button type="button" disabled={product.inventoryQuantity != null && quantity >= product.inventoryQuantity} onClick={() => setSaleQuantity(product, quantity + 1)} className="rounded border border-gray-300 p-1 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
            {checkoutProductCount > 0 && (
              <p className="mt-2 text-xs text-gray-500">{checkoutProductCount} item{checkoutProductCount === 1 ? '' : 's'} shown across {checkoutProductSections.length} section{checkoutProductSections.length === 1 ? '' : 's'}.</p>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gray-950 px-4 py-3 text-white"><div><span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Sale subtotal</span><strong className="ml-3 text-xl">{formatMoney(saleSubtotal)}</strong></div><button type="button" disabled={saving || saleLines.length === 0 || (salePayment === 'billing_account' && !selectedMember)} onClick={recordSale} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-bold hover:bg-red-700 disabled:opacity-50">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}{salePayment === 'card' ? 'Prepare secure card entry' : 'Record sale'}</button></div>
            {pendingCardEntryUrl && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"><div><strong className="block">Secure card entry is ready.</strong><span className="text-xs text-sky-800">Enter the customer’s card directly in Stripe. This sale stays pending until Stripe confirms payment.</span></div><a href={pendingCardEntryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg bg-sky-700 px-3 py-2 text-sm font-bold text-white hover:bg-sky-800">Input credit/debit details</a></div>}
          </div>
        </section>

        <section id="store-item-form" className="min-w-0 scroll-mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-vortex-red" /><h3 className="font-display text-xl font-bold text-gray-950">Add store item</h3></div>{editingProductId != null && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">Editing item</span>}</div>
          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)]">
              <div className="grid gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Copy item
                    <select value={copySourceProductId} disabled={editingProductId != null} onChange={(event) => copyProductToForm(event.target.value)} title={editingProductId != null ? 'Save your changes or cancel to add a new item.' : 'Copies item details and price; enter a new SKU before saving.'} className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal normal-case outline-none focus:border-black disabled:cursor-not-allowed disabled:bg-gray-100">
                      <option value="">Start a new item</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}{product.isActive ? '' : ' (archived)'}</option>)}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><input value={productForm.name} onChange={(event) => setProductForm((form) => ({ ...form, name: event.target.value }))} placeholder="Item name" className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black" /><input value={productForm.sku} onChange={(event) => setProductForm((form) => ({ ...form, sku: event.target.value.toUpperCase() }))} placeholder="SKU" aria-label="SKU" className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-semibold uppercase outline-none focus:border-black" /></div>
                <input value={productForm.description} onChange={(event) => setProductForm((form) => ({ ...form, description: event.target.value }))} placeholder="Brief description" className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><input type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => setProductForm((form) => ({ ...form, price: event.target.value }))} placeholder="Price" className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black" /><input type="number" min="0" step="1" value={productForm.inventory} onChange={(event) => setProductForm((form) => ({ ...form, inventory: event.target.value }))} placeholder="Stock" className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black" /></div>
              </div>
              <fieldset className="flex min-h-[218px] self-stretch flex-col gap-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                <legend>Item tags</legend>
                <div role="group" aria-label="Item tags" className="grid flex-1 content-start gap-1.5 rounded-lg border border-gray-300 bg-white p-2 normal-case tracking-normal">
                  {STORE_CATEGORY_OPTIONS.map((option) => {
                    const isSelected = productForm.tags.includes(option.value)
                    const isOnlyTag = isSelected && productForm.tags.length === 1
                    return <button
                      type="button"
                      key={option.value}
                      aria-pressed={isSelected}
                      disabled={isOnlyTag}
                      aria-label={`${isSelected ? 'Remove' : 'Add'} ${option.label} tag`}
                      title={isOnlyTag ? 'Each item needs at least one tag' : `${isSelected ? 'Remove' : 'Add'} ${option.label} tag`}
                      onClick={() => toggleProductTag(option.value)}
                      className={`rounded-md px-2.5 py-1.5 text-left text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${isSelected ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {option.label}
                    </button>
                  })}
                </div>
              </fieldset>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={productForm.isPublic} onChange={(event) => setProductForm((form) => ({ ...form, isPublic: event.target.checked }))} />Show in public/member store</label>
            {productForm.tags.includes('clothing') && editingProductId == null && (
              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Clothing size variants</p>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={applyYouthSizingVariants} onChange={(event) => setApplyYouthSizingVariants(event.target.checked)} />
                  Apply all youth sizing variants
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={applyAdultSizingVariants} onChange={(event) => setApplyAdultSizingVariants(event.target.checked)} />
                  Apply all adult sizing variants
                </label>
                <p className="text-xs text-gray-500">Creates one item per size with the size in the name and SKU (for example, T-Shirt (Youth XS) · VTX-TS-001-RED-YXS).</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={submitProduct} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-vortex-red disabled:opacity-50">{editingProductId != null ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingProductId != null ? 'Save changes' : 'Add item'}</button>{editingProductId != null && <button type="button" disabled={saving} onClick={cancelProductEdit} className="min-h-11 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>}</div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
          <div>
            <h3 className="font-display text-xl font-bold text-gray-950">Catalog & inventory</h3>
            <p className="mt-1 text-sm text-gray-600">Archive instead of deleting anything with order history.</p>
          </div>
          {lowStock.length > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
              {lowStock.length} low-stock item{lowStock.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[780px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3">
                  <button type="button" onClick={() => sortCatalogBy('name')} aria-pressed={catalogSort === 'name'} className="inline-flex items-center gap-1 hover:text-gray-950">
                    Item{catalogSortIndicator('name')}
                  </button>
                </th>
                <th className="px-5 py-3">
                  <button type="button" onClick={() => sortCatalogBy('sku')} aria-pressed={catalogSort === 'sku'} className="inline-flex items-center gap-1 hover:text-gray-950">
                    SKU{catalogSortIndicator('sku')}
                  </button>
                </th>
                <th className="px-5 py-3">Price</th>
                <th className="px-5 py-3">Inventory</th>
                <th className="px-5 py-3">Visibility</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedCatalogProducts.map((product) => (
                <tr key={product.id} className={!product.isActive ? 'bg-gray-50 text-gray-400' : ''}>
                  <td className="px-5 py-3">
                    <strong className="text-gray-900">{product.name}</strong>
                    <span className="ml-2 text-xs text-gray-500">{storeCategoryLabel(product.category)}</span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-gray-700">{product.sku}</td>
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={(product.priceCents / 100).toFixed(2)}
                      onBlur={(event) => {
                        const cents = Math.round(Number(event.target.value) * 100)
                        if (Number.isSafeInteger(cents) && cents !== product.priceCents) updateProduct(product, { priceCents: cents }, 'Price updated.')
                      }}
                      className="w-20 rounded border border-gray-300 px-2 py-1.5 font-semibold text-gray-900"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <span className={product.inventoryQuantity != null && product.inventoryQuantity <= 5 ? 'font-bold text-amber-700' : 'text-gray-700'}>
                      {product.inventoryQuantity == null ? 'Not tracked' : product.inventoryQuantity}
                    </span>
                    {product.inventoryQuantity != null && (
                      <button type="button" onClick={() => adjustInventory(product)} className="ml-2 text-xs font-bold text-vortex-red hover:underline">Adjust</button>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={product.isPublic}
                        disabled={!product.isActive || saving}
                        onChange={(event) => updateProduct(product, { isPublic: event.target.checked }, event.target.checked ? 'Item is now public.' : 'Item is now front-desk only.')}
                      />
                      Public
                    </label>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button type="button" aria-label={`Edit ${product.name}`} title="Edit item" disabled={saving} onClick={() => startEditingProduct(product)} className="inline-flex rounded p-1.5 text-gray-700 hover:bg-gray-100 hover:text-gray-950 disabled:opacity-40"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label={`Copy ${product.name}`} title="Copy item" disabled={saving || !product.isActive} onClick={() => quickCopyProduct(product)} className="inline-flex rounded p-1.5 text-gray-700 hover:bg-gray-100 hover:text-gray-950 disabled:opacity-40"><Copy className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label={`Archive ${product.name}`} title="Archive item" disabled={saving || !product.isActive} onClick={() => updateProduct(product, { isActive: false }, 'Item archived.')} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"><Archive className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Tag className="h-5 w-5 text-vortex-red" /><div><h3 className="font-display text-xl font-bold text-gray-950">Store discount codes</h3><p className="text-sm text-gray-600">These apply only to the store.</p></div></div><div className="mt-4 grid gap-3"><div className="grid grid-cols-3 gap-3"><input value={discountForm.code} onChange={(event) => setDiscountForm((form) => ({ ...form, code: event.target.value.toUpperCase() }))} placeholder="CODE" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-bold uppercase outline-none focus:border-black" /><select value={discountForm.type} onChange={(event) => setDiscountForm((form) => ({ ...form, type: event.target.value as typeof form.type }))} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="percent">Percent</option><option value="amount">Dollar amount</option></select><input type="number" min="1" step={discountForm.type === 'amount' ? '0.01' : '1'} value={discountForm.value} onChange={(event) => setDiscountForm((form) => ({ ...form, value: event.target.value }))} placeholder={discountForm.type === 'amount' ? '$ off' : '% off'} className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black" /></div><div className="grid grid-cols-2 gap-3"><input type="number" min="0" step="0.01" value={discountForm.minimum} onChange={(event) => setDiscountForm((form) => ({ ...form, minimum: event.target.value }))} placeholder="Minimum order $ (optional)" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black" /><input type="number" min="1" step="1" value={discountForm.max} onChange={(event) => setDiscountForm((form) => ({ ...form, max: event.target.value }))} placeholder="Max uses (optional)" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black" /></div><button type="button" disabled={saving} onClick={createDiscount} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-50"><Plus className="h-4 w-4" />Add store code</button></div><div className="mt-5 divide-y divide-gray-100 border-t border-gray-100">{discounts.length === 0 ? <p className="py-4 text-sm text-gray-500">No store discount codes yet.</p> : discounts.map((discount) => <div key={discount.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong className="text-gray-950">{discount.code}</strong><span className="ml-2 text-gray-500">{discount.discountType === 'percent' ? `${discount.value}% off` : `${formatMoney(discount.value)} off`} · {discount.redemptionCount}{discount.maxRedemptions == null ? '' : `/${discount.maxRedemptions}`} uses</span></div><div className="flex gap-2"><button type="button" onClick={() => void runSave(async () => { await adminUpdateStoreDiscount(discount.id, { isActive: !discount.isActive }) }, discount.isActive ? 'Store code disabled.' : 'Store code enabled.')} className={`rounded px-2.5 py-1.5 text-xs font-bold ${discount.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{discount.isActive ? 'Active' : 'Disabled'}</button><button type="button" onClick={() => void runSave(async () => { await adminDeleteStoreDiscount(discount.id) }, 'Store discount code deleted.')} className="rounded px-2 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100">Delete</button></div></div>)}</div></section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-vortex-red" />
            <div>
              <h3 className="font-display text-xl font-bold text-gray-950">Recent sales & pickup</h3>
              <p className="text-sm text-gray-600">Collect pickup payments, then mark placed orders picked up at the gym.</p>
            </div>
          </div>
          <div className="mt-4 divide-y divide-gray-100">
            {orders.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">No store sales have been recorded.</p>
            ) : orders.map((order) => (
              <div key={order.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <strong className="text-sm text-gray-950">{order.orderNumber}</strong>
                    <span className="ml-2 text-xs text-gray-500">{order.purchaserName || 'Walk-in'} · {new Date(order.createdAt).toLocaleDateString()}</span>
                    <p className="mt-1 text-xs text-gray-600">{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}</p>
                  </div>
                  <strong className="text-sm text-gray-950">{formatMoney(order.totalCents)}</strong>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{order.paymentMethod.replace('_', ' ')}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${order.status === 'fulfilled' ? 'bg-green-100 text-green-800' : order.status === 'placed' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{order.status === 'fulfilled' ? 'Picked up' : order.status.replace('_', ' ')}</span>
                  {order.status === 'placed' && <button type="button" onClick={() => void runSave(async () => { await adminUpdateStoreOrder(order.id, 'fulfilled') }, 'Order marked picked up.')} className="ml-auto inline-flex items-center gap-1 rounded bg-black px-2.5 py-1.5 text-xs font-bold text-white hover:bg-vortex-red"><Check className="h-3.5 w-3.5" />Picked up</button>}
                  {order.status === 'awaiting_payment' && ['cash', 'check', 'mobile'].includes(order.paymentMethod) && <button type="button" onClick={() => void runSave(async () => { await adminCollectStoreOrderPayment(order.id) }, 'Payment collected and receipt sent.')} className="ml-auto inline-flex items-center gap-1 rounded bg-black px-2.5 py-1.5 text-xs font-bold text-white hover:bg-vortex-red"><Check className="h-3.5 w-3.5" />Collect payment</button>}
                  {(order.status === 'awaiting_payment' || order.paymentStatus === 'billed_to_account') && <button type="button" onClick={() => void runSave(async () => { await adminUpdateStoreOrder(order.id, 'cancelled') }, 'Order cancelled and stock returned.')} className="rounded px-2.5 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100">Cancel</button>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="border-t border-gray-200 pt-2">
        <button type="button" onClick={() => setShowAuditActions((shown) => !shown)} aria-expanded={showAuditActions} className="inline-flex items-center gap-2 px-1 py-2 text-sm font-semibold text-vortex-red hover:underline">
          <History className="h-4 w-4" />
          Audit actions
        </button>
        {showAuditActions && (
          <section className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
              <div>
                <h3 className="font-display text-xl font-bold text-gray-950">Action audit</h3>
                <p className="mt-1 text-sm text-gray-600">An immutable record of catalog, discount, inventory, and sale activity.</p>
              </div>
              <button type="button" onClick={() => void downloadActionAudit()} disabled={auditExporting} className="inline-flex items-center gap-1.5 px-1 py-2 text-sm font-semibold text-vortex-red hover:underline disabled:cursor-not-allowed disabled:opacity-50">
                {auditExporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download action audit
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3 text-xs font-semibold text-gray-600">
              <span className="mr-1 uppercase tracking-wide text-gray-500">Sort by</span>
              {([['date', 'Date'], ['person', 'Person'], ['action', 'Action']] as Array<[AuditSortKey, string]>).map(([sort, label]) => (
                <button type="button" key={sort} onClick={() => sortAuditBy(sort)} aria-pressed={auditSort === sort} className={`rounded-md px-2.5 py-1.5 ${auditSort === sort ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {label}{auditSort === sort ? (auditSortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              ))}
            </div>
            <div className="max-h-[32rem] overflow-auto">
              {auditLoading ? (
                <p className="flex items-center gap-2 p-5 text-sm text-gray-600"><LoaderCircle className="h-4 w-4 animate-spin" />Loading action audit…</p>
              ) : sortedAuditActions.length === 0 ? (
                <p className="p-5 text-sm text-gray-600">No Store Desk actions have been recorded yet.</p>
              ) : (
                <table className="min-w-[760px] w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    <tr><th className="px-5 py-3">When</th><th className="px-5 py-3">Person</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Details</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedAuditActions.map((event) => <tr key={event.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-gray-600">{new Date(event.occurredAt).toLocaleString()}</td>
                      <td className="px-5 py-3 font-semibold text-gray-900">{event.actorName}</td>
                      <td className="px-5 py-3"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{auditActionLabel(event.action)}</span></td>
                      <td className="px-5 py-3 text-gray-600">{auditSummary(event)}</td>
                    </tr>)}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}
      </div>
      {loading && <div className="fixed bottom-5 right-5 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-lg"><LoaderCircle className="h-4 w-4 animate-spin" />Loading store</div>}
    </div>
  )
}
