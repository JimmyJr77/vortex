import { Suspense, useState } from 'react'
import { DollarSign } from 'lucide-react'
import ClassCosts from './pricing/ClassCosts'
import AdminDiscountsPanel from './pricing/AdminDiscountsPanel'
import AdminPricingRulesOverview from './pricing/AdminPricingRulesOverview'
import AdminPromoCodesPanel from './pricing/AdminPromoCodesPanel'
import { allowed, useRead, type Access } from './newAdmin/api'
import { ErrorNotice, Loading } from './newAdmin/shared'

type PricingTab = 'costs' | 'discounts' | 'rules' | 'promo_codes'

const TABS: Array<{ id: PricingTab; label: string }> = [
  { id: 'costs', label: 'Costs' },
  { id: 'discounts', label: 'Discounts' },
  { id: 'rules', label: 'Rules' },
  { id: 'promo_codes', label: 'Promo Codes' },
]

const AdminPricing = ({ access, revision = 0 }: { access?: Access; revision?: number }) => {
  const [tab, setTab] = useState<PricingTab>('costs')
  const currentAccess = useRead<Access>(access ? null : '/api/admin/access/me')
  const resolvedAccess = access ?? currentAccess.data
  if (!resolvedAccess) return <><Loading /><ErrorNotice message={currentAccess.error} /></>
  const canManage = allowed(resolvedAccess, 'pricing.manage')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-7 h-7 text-vortex-red" />
          Pricing
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Set class prices and manage discounts, rules, and promo codes.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav aria-label="Pricing tabs" className="flex gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-1 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'border-vortex-red text-vortex-red'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <Suspense fallback={<Loading />}>
      {tab === 'costs' && <ClassCosts canManage={canManage} revision={revision} />}
      {tab === 'discounts' && <AdminDiscountsPanel showSimulator canManage={canManage} />}
      {tab === 'rules' && <AdminPricingRulesOverview />}
      {tab === 'promo_codes' && <AdminPromoCodesPanel />}
      </Suspense>
    </div>
  )
}

export default AdminPricing
