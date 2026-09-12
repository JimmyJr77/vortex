// EFTPS Financial Institution Handbook, revision 02/2026, ACH CCD+ TXP pages 6/24.
const fail=message=>Object.assign(new Error(message),{status:400})
export function federalRemittanceInstruction({agency,year,quarter,ein,amountCents,settlementDate}){
 if(!['IRS_941','IRS_FUTA'].includes(agency)||year!==2026||!Number.isInteger(quarter)||quarter<1||quarter>4||typeof ein!=='string'||!/^\d{9}$/.test(ein)||/^0{9}$/.test(ein)||!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>9999999999||typeof settlementDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(settlementDate)||!Number.isFinite(Date.parse(settlementDate))||new Date(settlementDate).toISOString().slice(0,10)!==settlementDate)throw fail('Review the verified 2026 federal tax period, employer identity, amount and settlement date.')
 const taxCode=agency==='IRS_941'?'94105':'09405',month=agency==='IRS_941'?quarter*3:12
 const periodEnd=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10),taxPeriod=`${String(year).slice(-2)}${String(month).padStart(2,'0')}01`
 // A total-only deposit repeats the tax type instead of inventing a subcategory allocation.
 const addenda=`TXP*${ein}*${taxCode}*${taxPeriod}*${taxCode}*${amountCents}\\`
 if(addenda.length>80)throw fail('Federal tax addenda exceeds the supported bank format.')
 return {version:'EFTPS_2026_02',agency,taxCode,periodEnd,taxPeriod,amountCents,settlementDate,ein,secCode:'CCD',direction:'credit',currency:'USD',receivingRoutingNumber:'061036000',receivingAccountNumber:'23401009',receivingAccountName:'Treasury General Account',receivingCompanyName:'IRS',entryIdentification:ein,statementDescriptor:'TAXPAYMENT',addenda}
}
