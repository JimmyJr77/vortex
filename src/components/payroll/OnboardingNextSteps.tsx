import type {Packet} from '../../utils/workforceApi'

export default function OnboardingNextSteps({packet, admin, workspaceId}: {packet: Packet; admin: boolean; workspaceId: string}) {
  const steps = packet.tasks.flatMap(task => {
    const changed = packet.reviewIssues?.some(issue => Number(issue.taskId) === Number(task.id)) ||
      (task.task_key === 'PAY_REVIEW' && packet.paySetup?.status === 'NEEDS_REVIEW') ||
      (task.task_key === 'FIRST_SHIFT' && packet.firstShift?.status === 'NEEDS_REVIEW')
    const signature = task.task_key === 'PAY_REVIEW' && packet.benefitsDeduction?.required && packet.benefitsDeduction.status !== 'CURRENT'
    if (!changed && !signature && ['COMPLETE', 'NOT_APPLICABLE'].includes(task.status)) return []
    const employeeCanAct = signature || (task.owner === 'EMPLOYEE' && ['OPEN', 'CHANGES_REQUESTED'].includes(task.status))
    const adminCanAct = task.owner === 'ADMIN' || task.status === 'SUBMITTED' || changed
    const instruction = signature ? 'Employee benefit deduction authorization needs attention.' :
      changed ? 'Updated evidence needs hiring admin review.' :
      task.status === 'SUBMITTED' ? 'Submitted; awaiting hiring admin review.' :
      task.owner === 'ADMIN' ? 'Hiring admin action required.' :
      task.status === 'CHANGES_REQUESTED' ? 'Employee changes requested; review the admin instructions.' : 'Employee submission needed.'
    return [{task, instruction, actionable: admin ? adminCanAct : employeeCanAct}]
  })
  const next = steps.find(step => step.actionable)
  const openStep = (taskId: number) => {
    const details = document.getElementById(`${workspaceId}-task-${taskId}`)
    if (!(details instanceof HTMLDetailsElement)) return
    details.open = true
    details.querySelector('summary')?.focus({preventScroll: true})
    details.scrollIntoView({block: 'start'})
  }
  if (!steps.length) return null
  return <nav aria-label="Onboarding next steps" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
    <h3 className="font-bold">{admin ? 'Hiring review next steps' : 'Your next steps'}</h3>
    {next ? <button type="button" className="mt-3 min-h-11 rounded-xl bg-slate-950 px-4 py-3 text-left font-bold text-white" onClick={() => openStep(next.task.id)}>Continue: {next.task.title}</button> :
      <p className="mt-2">{admin ? 'Waiting for employee submissions. Open a step below to review its current status.' : 'Your submitted steps are awaiting your hiring admin. Open a step below to see its status and instructions.'}</p>}
    <ul className="mt-3 space-y-3">
      {steps.map(({task, instruction}) => <li key={task.id}>
        <button type="button" className="min-h-11 text-left font-bold text-blue-700 underline" onClick={() => openStep(task.id)}>{task.title}</button>
        <p>{instruction}</p>
      </li>)}
    </ul>
  </nav>
}
