const guidance='https://services.marylandcomptroller.gov/taxes/en/maryland-income-tax-rates-and-brackets?id=kb_article_view&sysparm_article=KB0010014'
// Actual local rates map to the tables linked by the Comptroller's 2026
// jurisdiction selector. The caller verifies the applicable county/tier.
const tables=new Map([[2.25,[225,875]],[2.4,[240,890]],[2.65,[265,915]],[2.7,[275,925]],[2.74,[275,925]],[2.75,[275,925]],[2.94,[300,950]],[2.95,[300,950]],[2.96,[300,950]],[3.03,[305,955]],[3.06,[310,960]],[3.2,[320,970]],[3.3,[330,980]]])
const fail=message=>Object.assign(new Error(message),{status:409})

// Standalone arithmetic; not yet imported by payroll execution. The caller
// must establish the lump-sum classification and reconciled Maryland tax wages.
export function marylandLumpSum2026({year,workState,residenceState,taxableWagesCents,wageBasisVerified,lumpSumVerified,election}){
 if(year!==2026||workState!=='MD'||residenceState!=='MD'||wageBasisVerified!==true||lumpSumVerified!==true)throw fail('Verify a 2026 Maryland-resident lump-sum payment and its Maryland taxable wages.')
 if(!Number.isSafeInteger(taxableWagesCents)||taxableWagesCents<0)throw fail('Maryland taxable wages must be non-negative safe integer cents.')
 if(election?.verified!==true||!tables.has(election.localRate)||!['SINGLE','JOINT'].includes(election.filingStatus)||!Number.isInteger(election.exemptions)||election.exemptions<0||election.exemptions>99)throw fail('Review current Maryland elections and applicability of the local rate and its published withholding table.')
 if(election.exempt!==false||election.extraWithholdingCents!==0)throw fail('Exempt or additional-withholding elections require separate lump-sum treatment.')
 const [tableBasisPoints,rateBasisPoints]=tables.get(election.localRate)
 const table=`https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/pm${tableBasisPoints}.pdf`
 // One final half-up rounding operation; no floating-point wage multiplication
 // and no second subtraction of regular-period allowances from a flat rate.
 const stateIncomeTaxCents=Number((BigInt(taxableWagesCents)*BigInt(rateBasisPoints)+5000n)/10000n)
 return {version:'2026-md-lump-sum-v1',method:'MD_LUMP_SUM',year,localRate:election.localRate,withholdingTableRate:tableBasisPoints/100,rateBasisPoints,taxableWagesCents,stateIncomeTaxCents,sources:{guidance,table}}
}
