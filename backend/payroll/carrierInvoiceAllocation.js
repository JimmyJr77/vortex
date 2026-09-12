const fail=message=>{throw Object.assign(new Error(message),{status:400})}
export function carrierInvoiceAllocation(input,total){
 if(input===undefined||input===null)return null
 if(input.confirmed!==true)fail('Confirm the employer expense and employee contribution allocation.')
 const {employerExpenseCents,employeeContributionCents}=input
 if(![employerExpenseCents,employeeContributionCents].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=9999999999))fail('Invoice allocation amounts must be non-negative integer cents.')
 if(employerExpenseCents+employeeContributionCents!==total)fail('Employer expense plus employee contributions must equal the carrier invoice total.')
 if(typeof input.reference!=='string'||input.reference.trim().length<12||input.reference.length>2000||/[\u0000-\u001f\u007f]/.test(input.reference))fail('Explain the supporting records for the invoice accounting allocation.')
 return {...(input.contributions!==undefined?{contributions:input.contributions}:{}),version:1,employerExpenseCents,employeeContributionCents,reference:input.reference.trim(),confirmed:true}
}
