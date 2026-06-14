import { DollarSign } from 'lucide-react'
import AdminPricingProgramTable from './pricing/AdminPricingProgramTable'

const AdminPricing = () => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-7 h-7 text-vortex-red" />
          Pricing
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Set program-level default slot costs and limits. Classes inherit program defaults unless
          customized.
        </p>
      </div>

      <AdminPricingProgramTable />
    </div>
  )
}

export default AdminPricing
