export type AnnualRetirementReport = {
  year: number
  status: string
  pretaxDeferrals: string
  rothDeferrals: string
  hasEmployeeDeferrals: boolean
  records: Array<{
    runId: string
    paymentDate: string
    planId: string
    planName: string
    ordinaryPretaxCents: number
    ordinaryRothCents: number
    catchUpPretaxCents: number
    catchUpRothCents: number
  }>
}

const money = (cents: number) => {
  const value = BigInt(cents)
  return `$${value / 100n}.${String(value % 100n).padStart(2, '0')}`
}

export default function AnnualRetirementEvidence({ report }: { report?: AnnualRetirementReport | null }) {
  return <section aria-label="Annual retirement contribution evidence" className="space-y-3 rounded-lg bg-slate-50 p-3">
    <h5 className="font-bold">Annual retirement contribution evidence</h5>
    <p>Finalized internal payroll contributions, reconciled against retained calculations, employee statements and the retirement ledger. External amounts used to review contribution limits are excluded.</p>
    {report?.status === 'RECONCILED' ? <>
      <dl className="space-y-1">
        <div><dt className="inline">{report.year} pretax employee deferrals: </dt><dd className="inline font-semibold">${report.pretaxDeferrals}</dd></div>
        <div><dt className="inline">{report.year} Roth employee deferrals: </dt><dd className="inline font-semibold">${report.rothDeferrals}</dd></div>
      </dl>
      {report.hasEmployeeDeferrals ? <p>Review these amounts before confirming standard 401(k) reporting. The W-2 draft uses the reconciled totals after the required annual reviews.</p> : <p>These retained records contain no employee deferrals. Review plan participation separately.</p>}
      <details>
        <summary className="cursor-pointer font-semibold">Review {report.records.length} retained payroll contribution records</summary>
        <ul className="mt-3 space-y-3">
          {report.records.map(record => <li key={`${record.runId}:${record.planId}`} className="space-y-1 break-words rounded-lg border border-slate-200 bg-white p-3">
            <p className="font-semibold">{record.planName} · Paid {record.paymentDate} · Payroll {record.runId}</p>
            <dl>
              <div><dt className="inline">Ordinary pretax: </dt><dd className="inline">{money(record.ordinaryPretaxCents)}</dd></div>
              <div><dt className="inline">Ordinary Roth: </dt><dd className="inline">{money(record.ordinaryRothCents)}</dd></div>
              <div><dt className="inline">Catch-up pretax: </dt><dd className="inline">{money(record.catchUpPretaxCents)}</dd></div>
              <div><dt className="inline">Catch-up Roth: </dt><dd className="inline">{money(record.catchUpRothCents)}</dd></div>
            </dl>
          </li>)}
        </ul>
      </details>
    </> : <p className="text-amber-900">No reconciled internal retirement contribution report is available. Review any source issues below and the plan records before deciding retirement applicability.</p>}
  </section>
}
