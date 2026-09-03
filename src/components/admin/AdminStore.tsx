import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Check, ClipboardList, LoaderCircle, PackagePlus, Plus, ReceiptText, RefreshCw, Search, ShoppingBag, Tag, X } from 'lucide-react'
import {
  adminAdjustStoreInventory,
  adminCollectStoreOrderPayment,
  adminCreateStoreDiscount,
  adminCreateStoreOrder,
  adminCreateStoreProduct,
  adminDeleteStoreDiscount,
  adminFetchStoreDashboard,
  adminFetchStoreDiscountCodes,
  adminFetchStoreProducts,
  adminSearchStoreMembers,
  adminUpdateStoreDiscount,
  adminUpdateStoreOrder,
  adminUpdateStoreProduct,
  type StoreCartLine,
  type StoreDiscountCode,
  type StoreMemberOption,
  type StoreOrder,
  type StorePaymentMethod,
  type StoreProduct,
  type StoreCategory,
} from '../../utils/storeApi'

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`

const emptyProduct: { sku: string; name: string; description: string; category: StoreCategory; price: string; inventory: string; isPublic: boolean } = {
  sku: '',
  name: '',
  description: '',
  category: 'apparel',
  price: '',
  inventory: '',
  isPublic: true,
}
type DiscountForm = { code: string; type: 'percent' | 'amount'; value: string; minimum: string; max: string }
const emptyDiscount: DiscountForm = { code: '', type: 'percent', value: '', minimum: '', max: '' }

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
  const [copySourceProductId, setCopySourceProductId] = useState('')
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

  useEffect(() => { void reload() }, [reload])

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
  const saleProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase()
    if (!query) return activeProducts
    return activeProducts.filter((product) => [
      product.name,
      product.sku,
      product.description ?? '',
      product.category.replace('_', ' '),
    ].some((value) => value.toLocaleLowerCase().includes(query)))
  }, [activeProducts, productSearch])
  const saleLines = useMemo(() => activeProducts.flatMap((product) => {
    const quantity = saleCart[product.id] ?? 0
    return quantity > 0 ? [{ product, quantity }] : []
  }), [activeProducts, saleCart])
  const saleSubtotal = saleLines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0)

  const runSave = async (task: () => Promise<void>, success: string) => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await task()
      setNotice(success)
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Store update failed.')
    } finally {
      setSaving(false)
    }
  }

  const createProduct = () => void runSave(async () => {
    await adminCreateStoreProduct({
      sku: productForm.sku,
      name: productForm.name,
      description: productForm.description,
      category: productForm.category,
      priceCents: Math.round(Number(productForm.price) * 100),
      inventoryQuantity: productForm.inventory === '' ? null : Number(productForm.inventory),
      isPublic: productForm.isPublic,
    })
    setProductForm(emptyProduct)
    setCopySourceProductId('')
  }, 'Store item added.')

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
      category: product.category,
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
    await adminCreateStoreOrder({
      memberId: selectedMember?.id ?? null,
      purchaserName: saleName || null,
      purchaserEmail: saleEmail || null,
      paymentMethod: salePayment,
      items,
      discountCode: saleCode || undefined,
      externalReference: saleReference || undefined,
    })
    setSaleCart({})
    setSaleCode('')
    setSaleReference('')
  }, 'Sale recorded and receipt sent when an email is available.')

  const updateProduct = (product: StoreProduct, change: Partial<StoreProduct>, success = 'Store item updated.') => void runSave(async () => {
    await adminUpdateStoreProduct(product.id, change)
  }, success)

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

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5"><div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-vortex-red" /><h3 className="font-display text-xl font-bold text-gray-950">New front-desk sale</h3></div><p className="mt-1 text-sm text-gray-600">Record cash, check, mobile payment, card terminal, or add the purchase to a member’s account.</p></div>
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <div className="space-y-3"><label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Member (optional except monthly account)<div className="relative mt-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setSelectedMember(null) }} placeholder="Search member" className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-black" />{memberOptions.length > 0 && <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">{memberOptions.map((member) => <button type="button" key={member.id} onClick={() => chooseMember(member)} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"><strong>{member.name}</strong>{member.email && <span className="ml-2 text-xs text-gray-500">{member.email}</span>}</button>)}</div>}</div></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold uppercase tracking-wide text-gray-500">Receipt name<input value={saleName} onChange={(event) => setSaleName(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-normal normal-case outline-none focus:border-black" /></label><label className="text-xs font-bold uppercase tracking-wide text-gray-500">Receipt email<input type="email" value={saleEmail} onChange={(event) => setSaleEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-normal normal-case outline-none focus:border-black" /></label></div></div>
            <div className="space-y-3"><label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Payment method<select value={salePayment} onChange={(event) => setSalePayment(event.target.value as StorePaymentMethod)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-black"><option value="card">Card terminal</option><option value="billing_account">Bill monthly account</option><option value="cash">Cash</option><option value="check">Check</option><option value="mobile">Mobile payment</option></select></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold uppercase tracking-wide text-gray-500">Store code<input value={saleCode} onChange={(event) => setSaleCode(event.target.value.toUpperCase())} placeholder="Optional" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-semibold outline-none focus:border-black" /></label><label className="text-xs font-bold uppercase tracking-wide text-gray-500">Reference<input value={saleReference} onChange={(event) => setSaleReference(event.target.value)} placeholder="Check #, mobile ID…" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-normal normal-case outline-none focus:border-black" /></label></div></div>
          </div>
          <div className="border-t border-gray-100 p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wide text-gray-500">Add items</p><label className="relative block w-full sm:w-64"><span className="sr-only">Search store products</span><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products or SKU" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm outline-none focus:border-black" />{productSearch && <button type="button" onClick={() => setProductSearch('')} aria-label="Clear product search" className="absolute right-2 top-2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>}</label></div><div className="grid gap-2 sm:grid-cols-2">{saleProducts.map((product) => { const quantity = saleCart[product.id] ?? 0; const out = product.inventoryQuantity === 0; return <div key={product.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2.5"><div className="min-w-0"><strong className="block truncate text-sm text-gray-900">{product.name}</strong><span className="text-xs text-gray-500">{formatMoney(product.priceCents)}{product.inventoryQuantity != null ? ` · ${product.inventoryQuantity} in stock` : ''}</span></div>{quantity === 0 ? <button type="button" disabled={out} onClick={() => setSaleQuantity(product, 1)} className="rounded-md bg-black px-2.5 py-1.5 text-xs font-bold text-white hover:bg-vortex-red disabled:opacity-40">Add</button> : <div className="flex items-center gap-2"><button type="button" onClick={() => setSaleQuantity(product, quantity - 1)} className="rounded border border-gray-300 p-1"><X className="h-3.5 w-3.5" /></button><strong className="text-sm">{quantity}</strong><button type="button" disabled={product.inventoryQuantity != null && quantity >= product.inventoryQuantity} onClick={() => setSaleQuantity(product, quantity + 1)} className="rounded border border-gray-300 p-1 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button></div>}</div> })}</div>{saleProducts.length === 0 && <p className="rounded-lg border border-dashed border-gray-300 px-3 py-5 text-center text-sm text-gray-500">No active products match “{productSearch}”.</p>}<div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gray-950 px-4 py-3 text-white"><div><span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Sale subtotal</span><strong className="ml-3 text-xl">{formatMoney(saleSubtotal)}</strong></div><button type="button" disabled={saving || saleLines.length === 0 || (salePayment === 'billing_account' && !selectedMember)} onClick={recordSale} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-bold hover:bg-red-700 disabled:opacity-50">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Record sale</button></div></div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-vortex-red" /><h3 className="font-display text-xl font-bold text-gray-950">Add store item</h3></div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-gray-500">
              Copy an existing item
              <select value={copySourceProductId} onChange={(event) => copyProductToForm(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal normal-case outline-none focus:border-black">
                <option value="">Start a new item</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}{product.isActive ? '' : ' (archived)'}</option>)}
              </select>
              <span className="font-normal normal-case text-gray-500">Copies item details and price; enter a new SKU before saving.</span>
            </label>
            <div className="grid grid-cols-2 gap-3"><input value={productForm.name} onChange={(event) => setProductForm((form) => ({ ...form, name: event.target.value }))} placeholder="Item name" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black" /><input value={productForm.sku} onChange={(event) => setProductForm((form) => ({ ...form, sku: event.target.value.toUpperCase() }))} placeholder="SKU" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-semibold uppercase outline-none focus:border-black" /></div>
            <input value={productForm.description} onChange={(event) => setProductForm((form) => ({ ...form, description: event.target.value }))} placeholder="Brief description" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black" />
            <div className="grid grid-cols-3 gap-3"><select value={productForm.category} onChange={(event) => setProductForm((form) => ({ ...form, category: event.target.value as typeof form.category }))} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="apparel">Apparel</option><option value="food_drink">Food & drink</option><option value="other">Other</option></select><input type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => setProductForm((form) => ({ ...form, price: event.target.value }))} placeholder="Price" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black" /><input type="number" min="0" step="1" value={productForm.inventory} onChange={(event) => setProductForm((form) => ({ ...form, inventory: event.target.value }))} placeholder="Stock" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black" /></div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={productForm.isPublic} onChange={(event) => setProductForm((form) => ({ ...form, isPublic: event.target.checked }))} />Show in public/member store</label>
            <button type="button" disabled={saving} onClick={createProduct} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-vortex-red disabled:opacity-50"><Plus className="h-4 w-4" />Add item</button>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5"><div><h3 className="font-display text-xl font-bold text-gray-950">Catalog & inventory</h3><p className="mt-1 text-sm text-gray-600">Archive instead of deleting anything with order history.</p></div>{lowStock.length > 0 && <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">{lowStock.length} low-stock item{lowStock.length === 1 ? '' : 's'}</span>}</div><div className="overflow-x-auto"><table className="min-w-[780px] w-full text-sm"><thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Item</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Inventory</th><th className="px-5 py-3">Visibility</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{products.map((product) => <tr key={product.id} className={!product.isActive ? 'bg-gray-50 text-gray-400' : ''}><td className="px-5 py-3"><strong className="text-gray-900">{product.name}</strong><span className="ml-2 text-xs text-gray-500">{product.sku} · {product.category.replace('_', ' ')}</span></td><td className="px-5 py-3"><input type="number" min="0" step="0.01" defaultValue={(product.priceCents / 100).toFixed(2)} onBlur={(event) => { const cents = Math.round(Number(event.target.value) * 100); if (Number.isSafeInteger(cents) && cents !== product.priceCents) updateProduct(product, { priceCents: cents }, 'Price updated.') }} className="w-20 rounded border border-gray-300 px-2 py-1.5 font-semibold text-gray-900" /></td><td className="px-5 py-3"><span className={product.inventoryQuantity != null && product.inventoryQuantity <= 5 ? 'font-bold text-amber-700' : 'text-gray-700'}>{product.inventoryQuantity == null ? 'Not tracked' : product.inventoryQuantity}</span>{product.inventoryQuantity != null && <button type="button" onClick={() => adjustInventory(product)} className="ml-2 text-xs font-bold text-vortex-red hover:underline">Adjust</button>}</td><td className="px-5 py-3"><label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700"><input type="checkbox" checked={product.isPublic} disabled={!product.isActive || saving} onChange={(event) => updateProduct(product, { isPublic: event.target.checked }, event.target.checked ? 'Item is now public.' : 'Item is now front-desk only.')} />Public</label></td><td className="px-5 py-3 text-right"><button type="button" disabled={saving || !product.isActive} onClick={() => updateProduct(product, { isActive: false }, 'Item archived.') } className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"><Archive className="h-3.5 w-3.5" />Archive</button></td></tr>)}</tbody></table></div></section>

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
      {loading && <div className="fixed bottom-5 right-5 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-lg"><LoaderCircle className="h-4 w-4 animate-spin" />Loading store</div>}
    </div>
  )
}
