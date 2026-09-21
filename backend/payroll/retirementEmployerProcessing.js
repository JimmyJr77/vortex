// Standalone employee deduction calculation cannot authorize employer funding.
// The regular payroll producer separately binds eligibility, capacity and reservations.
export function retirementEmployerProcessingIssue(plan) {
 if(plan?.employerContributions==='NONE')return null
 return 'Employer retirement contributions require the integrated payroll review of eligibility, formula obligations, annual limits and funding. Standalone employee deduction calculations cannot authorize employer contributions.'
}
