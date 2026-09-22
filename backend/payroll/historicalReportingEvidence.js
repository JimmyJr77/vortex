import {historicalAnnualWageState} from './historicalEmploymentWageReview.js'
import {loadEmploymentTaxWageHistory} from './employmentTaxWageHistory.js'

// Reporting dates select actual payments, while validation still checks the
// complete retained annual source and its agreement with committed payroll.
export async function historicalReportingRange(db,facility,employeeId,start,end){
 if(!/^2026-\d{2}-\d{2}$/.test(start)||!/^2026-\d{2}-\d{2}$/.test(end)||start>end)return {status:'UNSUPPORTED_PERIOD',totals:null,issues:['Imported reporting needs a supported 2026 payment range.']}
 let state=await historicalAnnualWageState(db,facility,employeeId,{start,end})
 if(state.totals){
  const history=await loadEmploymentTaxWageHistory(db,facility,[employeeId],'2026-12-31',null,[employeeId])
  if(history.warnings.length||!history.ytdTaxWagesByEmployee[employeeId])state={...state,status:'NATIVE_HISTORY_CONFLICT',totals:null,issues:history.warnings.map(w=>w.message)}
 }
 return state
}
