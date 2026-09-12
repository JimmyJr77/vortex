// Ordinary employee 401(k) deferrals only; not employer contributions, pickups,
// distributions, nonqualified deferrals or other plan types.
// IRS retirement contribution withholding table; Maryland 2026 withholding
// guide; Maryland Employers' Quick Reference Guide elective-deferral table.
export function retirement401kTaxWages({grossCents,annualBonusCents,pretaxCents,rothCents,pretaxAnnualBonusCents,year,workState,residenceState,planType}){
 const fail=message=>{throw new Error(message)}
 if(year!==2026||workState!=='MD'||residenceState!=='MD'||planType!=='STANDARD_401K')fail('Use reviewed 2026 Maryland-resident standard 401(k) wage treatment.')
 for(const value of [grossCents,annualBonusCents,pretaxCents,rothCents,pretaxAnnualBonusCents])if(!Number.isSafeInteger(value)||value<0)fail('Retirement wage components must be explicit nonnegative integer cents.')
 if(annualBonusCents>grossCents||pretaxCents>grossCents||rothCents>grossCents-pretaxCents||pretaxAnnualBonusCents>annualBonusCents||pretaxAnnualBonusCents>pretaxCents||pretaxCents-pretaxAnnualBonusCents>grossCents-annualBonusCents)fail('Retirement deductions and their bonus allocation must fit the corresponding wages.')
 return {version:1,planType,pretaxCents,rothCents,pretaxAnnualBonusCents,federalWagesCents:grossCents-pretaxCents,marylandWagesCents:grossCents-pretaxCents,marylandAnnualBonusWagesCents:annualBonusCents-pretaxAnnualBonusCents,marylandRegularWagesCents:grossCents-annualBonusCents-(pretaxCents-pretaxAnnualBonusCents),socialSecurityWagesCents:grossCents,medicareWagesCents:grossCents,futaWagesCents:grossCents,marylandUnemploymentWagesCents:grossCents}
}
