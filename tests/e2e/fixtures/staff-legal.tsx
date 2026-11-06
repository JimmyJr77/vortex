import React from 'react'
import { createRoot } from 'react-dom/client'
import StaffLegalPolicies from '../../../src/components/legal/StaffLegalPolicies'
import AdminStaffLegal from '../../../src/components/legal/AdminStaffLegal'
import '../../../src/index.css'

const portal = new URLSearchParams(location.search).get('portal') === 'payroll' ? 'payroll' : 'coach'
localStorage.setItem('vortex_member_token', 'coach')
localStorage.setItem('adminToken', 'admin')
sessionStorage.setItem('vortex_payroll_employee_session_v1', 'linked-payroll')
createRoot(document.getElementById('root')!).render(<React.StrictMode><StaffLegalPolicies portal={portal} /><AdminStaffLegal /></React.StrictMode>)
