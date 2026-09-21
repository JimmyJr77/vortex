// Retaining a textual formula does not implement employer funding. Keep this
// gate until calculation, annual-additions reservation, accounting and delivery
// all retain employer contributions separately from employee wage deductions.
export function retirementEmployerProcessingIssue(plan) {
 if(plan?.employerContributions==='NONE')return null
 return 'Employer retirement contributions require implemented calculation, annual-limit reconciliation and remittance before this plan can process payroll. Retained formula text alone does not calculate employer funding.'
}
