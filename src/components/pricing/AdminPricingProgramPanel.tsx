import type { AdminProgramPricing, TopProgram } from '../../utils/programsApi'
import AdminPricingClassTable from './AdminPricingClassTable'
import PricingBenefitSelectionField from './PricingBenefitSelectionField'

interface Props {
  program: TopProgram
  classes: AdminProgramPricing[]
  onRefresh: () => Promise<void>
}

export default function AdminPricingProgramPanel({ program, classes, onRefresh }: Props) {
  return <div className="p-6 bg-gray-50 border-t-2 border-vortex-red space-y-6">
    <div><h4 className="text-base font-bold text-black">Class pricing</h4><p className="text-sm text-gray-600">Prices are set on each class. Existing class prices and enrollment subscriptions are retained. Use Classes & schedules in Admin to edit the monthly class price.</p></div>
    <PricingBenefitSelectionField scopeLevel="program" scopeRefId={program.id} title="Program discounts & free passes" />
    <AdminPricingClassTable program={program} classes={classes} onRefresh={onRefresh} />
  </div>
}
