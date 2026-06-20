import { useState } from 'react'
import { DollarSign } from 'lucide-react'
import AdminPricingProgramTable from './pricing/AdminPricingProgramTable'
import SportDefaultsPanel from './pricing/SportDefaultsPanel'
import AdminAdditionalFeesPanel from './pricing/AdminAdditionalFeesPanel'
import AdminDiscountsPanel from './pricing/AdminDiscountsPanel'
import AdminFreePassesPanel from './pricing/AdminFreePassesPanel'
import AdminPricingRulesOverview from './pricing/AdminPricingRulesOverview'

type PricingTab = 'costs' | 'discounts' | 'free_passes' | 'rules'

const TABS: Array<{ id: PricingTab; label: string }> = [
  { id: 'costs', label: 'Costs' },
  { id: 'discounts', label: 'Discounts' },
  { id: 'free_passes', label: 'Free Passes' },
  { id: 'rules', label: 'Rules' },
]

const AdminPricing = () => {
  const [tab, setTab] = useState<PricingTab>('costs')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-7 h-7 text-vortex-red" />
          Pricing
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Set costs and discounts, then review which rules apply to each program and class.
          Defaults cascade from primary sport to program to class.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
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

      {tab === 'costs' && (
        <div className="space-y-4">
          <AdminAdditionalFeesPanel />
          <SportDefaultsPanel />
          <AdminPricingProgramTable />
        </div>
      )}
      {tab === 'discounts' && <AdminDiscountsPanel showFacilityCaps showSimulator />}
      {tab === 'free_passes' && <AdminFreePassesPanel />}
      {tab === 'rules' && <AdminPricingRulesOverview />}
    </div>
  )
}

export default AdminPricing
