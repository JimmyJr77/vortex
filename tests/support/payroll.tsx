import SettlementPosting from '../../src/components/payroll/SettlementPosting'
import { useState } from 'react'
import OnboardingWorkspace from '../../src/components/payroll/OnboardingWorkspace'
import { createRoot } from 'react-dom/client'
import AdminPayroll from '../../src/components/payroll/AdminPayroll'
import PayrollEmployeePortal from '../../src/components/payroll/PayrollEmployeePortal'
import '../../src/index.css'
function ChecklistRaceFixture() {
 const [refresh,setRefresh]=useState(0)
 return <div data-payroll-workspace><button onClick={()=>setRefresh(value=>value+1)}>Refresh from parent</button><OnboardingWorkspace refresh={refresh} employmentStatus="ONBOARDING" onChanged={async()=>{}} /></div>
}
const employee = new URLSearchParams(location.search).has('employee')
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('settlement-response') ? <SettlementPosting runId={1} /> : new URLSearchParams(location.search).has('checklist-race') ? <ChecklistRaceFixture /> : employee ? <PayrollEmployeePortal /> : <div className="min-h-screen bg-slate-100 p-6"><AdminPayroll /></div>)
