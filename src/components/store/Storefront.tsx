import { useEffect, useMemo, useState } from 'react'
import { Check, CreditCard, Minus, PackageCheck, Plus, ReceiptText, ShoppingBag, X } from 'lucide-react'
import {
  checkoutMemberStoreOrder,
  fetchMemberStoreOrders,
  fetchMemberStoreProducts,
  fetchPublicStoreProducts,
  type StoreCartLine,
  type StoreOrder,
  type StorePaymentMethod,
  type StoreProduct,
} from '../../utils/storeApi'

interface StorefrontProps {
  memberToken?: string | null
  memberName?: string | null
  onSignIn?: () => void
  mode?: 'public' | 'member'
}

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`
const formatTags = (tags: StoreProduct['tags']) => tags
  .map((tag) => `${tag.slice(0, 1).toUpperCase()}${tag.slice(1)}`)
  .join(' · ')

export default function Storefront({ memberToken = null, memberName = null, onSignIn, mode = 'public' }: StorefrontProps) {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [cart, setCart] = useState<Record<number, number>>({})
  const [discountCode, setDiscountCode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<StorePaymentMethod>('card')
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<StoreOrder | null>(null)
  const [orders, setOrders] = useState<StoreOrder[]>([])

  const loadProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      setProducts(memberToken ? await fetchMemberStoreProducts(memberToken) : await fetchPublicStoreProducts())
      if (memberToken && mode === 'member') setOrders(await fetchMemberStoreOrders(memberToken))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      setError(message === 'Failed to fetch'
        ? 'The store is refreshing right now. Please try again in a moment.'
        : message || 'Could not load the store right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadProducts() }, [memberToken, mode])

  const cartItems = useMemo(() => products.flatMap((product) => {
    const quantity = cart[product.id] ?? 0
    return quantity > 0 ? [{ product, quantity }] : []
  }), [products, cart])
  const subtotalCents = cartItems.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0)
  const itemCount = cartItems.reduce((sum, line) => sum + line.quantity, 0)

  const updateQuantity = (product: StoreProduct, quantity: number) => {
    const maximum = product.inventoryQuantity ?? 20
    const next = Math.max(0, Math.min(maximum, quantity))
    setCart((current) => {
      const result = { ...current }
      if (next === 0) delete result[product.id]
      else result[product.id] = next
      return result
    })
  }

  const handleCheckout = async () => {
    if (!memberToken) {
      onSignIn?.()
      return
    }
    if (cartItems.length === 0) return
    setCheckoutLoading(true)
    setError(null)
    try {
      const items: StoreCartLine[] = cartItems.map(({ product, quantity }) => ({ productId: product.id, quantity }))
      const order = await checkoutMemberStoreOrder(memberToken, {
        items,
        paymentMethod,
        discountCode: discountCode.trim() || undefined,
      })
      if (order.stripeCheckoutUrl) {
        window.location.assign(order.stripeCheckoutUrl)
        return
      }
      setConfirmation(order)
      setCart({})
      setDiscountCode('')
      if (mode === 'member') setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete this store order.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div className={mode === 'member' ? 'space-y-6' : 'container-custom py-28 md:py-32'}>
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-black via-gray-900 to-zinc-800 text-white shadow-xl">
        <div className="grid gap-8 p-6 md:grid-cols-[1fr_auto] md:p-10">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-gray-100">
              <ShoppingBag className="h-3.5 w-3.5 text-vortex-red" /> VORTEX STORE
            </div>
            <h1 className="font-display text-4xl font-bold md:text-5xl">{memberName ? `Gear for ${memberName}.` : 'Gear for training days.'}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-300 md:text-base">
              Clean essentials for Vortex athletes. Every order is pickup only at the gym — no shipping, no wait at home.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-200">
            <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-vortex-red" />
            <span><strong className="block text-white">Gym pickup</strong>We’ll email your receipt when your order is confirmed.</span>
          </div>
        </div>
      </section>

      {confirmation && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-green-900">
          <div className="flex gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0" />
            <div><strong>Order {confirmation.orderNumber} is confirmed.</strong><p className="mt-1 text-sm">Your receipt is on its way to {confirmation.purchaserEmail || 'your email'}. Pick it up at the gym.</p></div>
          </div>
          <button type="button" onClick={() => setConfirmation(null)} aria-label="Dismiss confirmation"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div><h2 className="font-display text-2xl font-bold text-gray-950">Shop the store</h2><p className="mt-1 text-sm text-gray-600">Simple, durable, and ready for the gym.</p></div>
            <span className="text-sm font-semibold text-gray-600">{itemCount} item{itemCount === 1 ? '' : 's'} in cart</span>
          </div>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl bg-gray-100" />)}</div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-600">The store catalog is being refreshed. Please check back shortly.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => {
                const quantity = cart[product.id] ?? 0
                const outOfStock = product.inventoryQuantity === 0
                return (
                  <article key={product.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="mb-5 flex h-24 items-end rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 p-3">
                      <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-gray-600">{formatTags(product.tags)}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-950">{product.name}</h3>
                    <p className="mt-1 min-h-10 text-sm leading-5 text-gray-600">{product.description || 'Vortex training essential.'}</p>
                    <div className="mt-4 flex items-center justify-between gap-3"><strong className="text-xl text-gray-950">{formatMoney(product.priceCents)}</strong>{product.inventoryQuantity != null && product.inventoryQuantity <= 5 && product.inventoryQuantity > 0 && <span className="text-xs font-semibold text-amber-700">Only {product.inventoryQuantity} left</span>}</div>
                    {outOfStock ? <p className="mt-4 rounded-lg bg-gray-100 px-3 py-2 text-center text-sm font-semibold text-gray-500">Out of stock</p> : quantity === 0 ? (
                      <button type="button" className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-black px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-vortex-red" onClick={() => updateQuantity(product, 1)}><Plus className="h-4 w-4" />Add to cart</button>
                    ) : (
                      <div className="mt-4 flex min-h-11 items-center justify-between rounded-lg border border-gray-200 px-2"><button type="button" className="rounded p-2 text-gray-700 hover:bg-gray-100" onClick={() => updateQuantity(product, quantity - 1)} aria-label={`Remove ${product.name}`}><Minus className="h-4 w-4" /></button><span className="text-sm font-bold">{quantity}</span><button type="button" className="rounded p-2 text-gray-700 hover:bg-gray-100 disabled:opacity-40" disabled={product.inventoryQuantity != null && quantity >= product.inventoryQuantity} onClick={() => updateQuantity(product, quantity + 1)} aria-label={`Add ${product.name}`}><Plus className="h-4 w-4" /></button></div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold text-gray-950">Your order</h2><ShoppingBag className="h-5 w-5 text-gray-500" /></div>
          {cartItems.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Your cart is ready when you are.</p> : <>
            <div className="mt-4 space-y-3 border-y border-gray-100 py-4">{cartItems.map(({ product, quantity }) => <div key={product.id} className="flex justify-between gap-3 text-sm"><span className="min-w-0"><strong className="block truncate text-gray-900">{product.name}</strong><span className="text-gray-500">Qty {quantity}</span></span><span className="shrink-0 font-semibold text-gray-900">{formatMoney(product.priceCents * quantity)}</span></div>)}</div>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-gray-500">Store discount code<input value={discountCode} onChange={(event) => setDiscountCode(event.target.value.toUpperCase())} placeholder="Optional" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium uppercase outline-none transition focus:border-black" /></label>
            {memberToken ? <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setPaymentMethod('card')} className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold ${paymentMethod === 'card' ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}><CreditCard className="mb-1 h-4 w-4" />Card</button><button type="button" onClick={() => setPaymentMethod('billing_account')} className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold ${paymentMethod === 'billing_account' ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}><ReceiptText className="mb-1 h-4 w-4" />Monthly account</button></div> : <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-5 text-gray-600">Sign in with your Vortex account to pay by card or bill the purchase to your monthly account.</p>}
            <div className="mt-4 flex items-end justify-between"><span className="text-sm text-gray-600">Subtotal</span><strong className="text-xl text-gray-950">{formatMoney(subtotalCents)}</strong></div>
            <button type="button" disabled={checkoutLoading} onClick={() => void handleCheckout()} className="mt-4 min-h-12 w-full rounded-lg bg-vortex-red px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60">{checkoutLoading ? 'Preparing order…' : memberToken ? paymentMethod === 'card' ? 'Continue to card payment' : 'Bill to monthly account' : 'Sign in to checkout'}</button>
            <p className="mt-3 text-center text-xs leading-5 text-gray-500">Pickup only at Vortex Athletics. Taxes, if applicable, are confirmed at checkout.</p>
          </>}
        </aside>
      </div>

      {mode === 'member' && orders.length > 0 && <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><ReceiptText className="h-5 w-5 text-vortex-red" /><h2 className="font-display text-xl font-bold text-gray-950">Recent store orders</h2></div><div className="divide-y divide-gray-100">{orders.slice(0, 5).map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong className="text-gray-900">{order.orderNumber}</strong><span className="ml-2 text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</span></div><div className="flex items-center gap-3"><span className="font-semibold text-gray-900">{formatMoney(order.totalCents)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${order.status === 'fulfilled' ? 'bg-green-100 text-green-800' : order.status === 'cancelled' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-800'}`}>{order.status === 'fulfilled' ? 'Picked up' : order.status === 'placed' ? 'Ready for pickup' : order.status.replace('_', ' ')}</span></div></div>)}</div></section>}
    </div>
  )
}
