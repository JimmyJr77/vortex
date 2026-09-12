import {useId} from 'react'
import RetirementProcessingReview from './RetirementProcessingReview'
import RetirementDestination from './RetirementDestination'
import RetirementTiming from './RetirementTiming'
import RetirementAllocationFormat from './RetirementAllocationFormat'
import RetirementSftpSetup from './RetirementSftpSetup'
import RetirementReceiptContract from './RetirementReceiptContract'
import RetirementSettlementMapping from './RetirementSettlementMapping'

const sections = [
  {key: 'processing', label: 'Processing and contributions', Component: RetirementProcessingReview},
  {key: 'destination', label: 'Contribution destination', Component: RetirementDestination},
  {key: 'timing', label: 'Deposit timing', Component: RetirementTiming},
  {key: 'allocation', label: 'Participant file format', Component: RetirementAllocationFormat},
  {key: 'delivery', label: 'File delivery', Component: RetirementSftpSetup},
  {key: 'receipts', label: 'Participant receipts', Component: RetirementReceiptContract},
  {key: 'accounting', label: 'QuickBooks accounts', Component: RetirementSettlementMapping},
]

// Jump navigation preserves mounted forms, drafts and in-flight recovery state.
export default function RetirementPlanOperations({planId, name}: {planId: string; name: string}) {
  const id = useId()
  const navigate = (target: string) => {
    const element = document.getElementById(target)
    element?.focus({preventScroll: true})
    element?.scrollIntoView({block: 'start'})
  }
  return <div className="space-y-4">
    <nav aria-label={`${name} workflow navigation`} className="rounded border bg-slate-50 p-3">
      <h3 id={`${id}-navigation`} tabIndex={-1} className="payroll-retirement-jump-target font-bold">{name} workflows</h3>
      <p className="my-2">Jump to a setup or contribution workflow. Your unfinished entries stay in place.</p>
      <ul className="flex flex-wrap gap-2">
        {sections.map(({key, label}) => <li key={key}><button type="button" className="rounded border bg-white px-3 py-2 text-left font-semibold" onClick={() => navigate(`${id}-${key}`)}>{label}</button></li>)}
      </ul>
    </nav>
    {sections.map(({key, label, Component}) => <div key={key} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={`${id}-${key}`} tabIndex={-1} className="payroll-retirement-jump-target font-bold">{label}</h4>
        <button type="button" className="rounded border px-3 py-2" onClick={() => navigate(`${id}-navigation`)}>Back to workflow navigation</button>
      </div>
      <Component planId={planId}/>
    </div>)}
  </div>
}
