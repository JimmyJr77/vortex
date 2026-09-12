import { createRoot } from 'react-dom/client'
import AdminPayroll from '../../src/components/payroll/AdminPayroll'
import PayrollEmployeePortal from '../../src/components/payroll/PayrollEmployeePortal'
import '../../src/index.css'
const employee = new URLSearchParams(location.search).has('employee')
createRoot(document.getElementById('root')!).render(employee ? <PayrollEmployeePortal /> : <div className="min-h-screen bg-slate-100 p-6"><AdminPayroll /></div>)
