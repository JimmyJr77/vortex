// Printed 2026 IRS W-4 page-4 worksheet. All inputs and outputs are integer cents.
// Eligibility estimates are supplied by the employee; this is not a tax return.
export const w4DeductionStatuses={SINGLE:'SINGLE',MARRIED_SEPARATELY:'SINGLE',MARRIED_JOINTLY:'MARRIED',SURVIVING_SPOUSE:'MARRIED',HEAD_OF_HOUSEHOLD:'HEAD_OF_HOUSEHOLD'}
const money=value=>{if(!Number.isSafeInteger(value)||value<0)throw new Error('Use nonnegative whole-cent amounts for the deductions worksheet.');return value}
const sum=(...values)=>money(values.reduce((a,b)=>a+b,0))
const ratio=(value,numerator,denominator)=>Number((BigInt(value)*BigInt(numerator)*2n+BigInt(denominator))/(2n*BigInt(denominator)))
const excess=(expense,income,numerator,denominator)=>{
 const net=BigInt(expense)*BigInt(denominator)-BigInt(income)*BigInt(numerator)
 return net<=0n?0:Number((net*2n+BigInt(denominator))/(2n*BigInt(denominator)))
}
export function w4Deductions2026(input){
 const {status,filingStatus,totalIncomeCents,selfSenior,spouseSenior}=input
 if(!Object.hasOwn(w4DeductionStatuses,status)||w4DeductionStatuses[status]!==filingStatus)throw new Error('Select the detailed worksheet filing status that matches Step 1(c).')
 const income=money(totalIncomeCents),joint=status==='MARRIED_JOINTLY',separate=status==='MARRIED_SEPARATELY',jointOrSurvivor=joint||status==='SURVIVING_SPOUSE'
 for(const value of [selfSenior,spouseSenior])if(typeof value!=='boolean')throw new Error('Select senior eligibility explicitly.')
 if(spouseSenior&&!joint)throw new Error('The spouse senior deduction requires married filing jointly.')
 const fields=['qualifiedTipsCents','qualifiedOvertimeCents','vehicleInterestCents','adjustmentsCents','medicalExpensesCents','stateLocalTaxesCents','mortgageInterestCents','acquisitionDebtCents','charitableGiftsCents','otherItemizedCents','cashGiftsCents']
 const a=Object.fromEntries(fields.map(key=>[key,money(input[key])]))
 if(separate&&(a.qualifiedTipsCents||a.qualifiedOvertimeCents||selfSenior))throw new Error('Married filing separately cannot claim the tips, overtime or enhanced senior deductions. Review your eligible entries.')
 const eligibleBelow=(amount,threshold,label)=>{if(amount&&income>=threshold*100)throw new Error(`${label} exceeds the income range of this printed W-4 worksheet. Review the IRS instructions for the applicable limitation before entering Step 4(b).`)}
 eligibleBelow(sum(a.qualifiedTipsCents,a.qualifiedOvertimeCents),joint?300000:150000,'Tips/overtime')
 eligibleBelow(a.vehicleInterestCents,joint?200000:100000,'Vehicle loan interest')
 eligibleBelow(selfSenior||spouseSenior?1:0,joint?150000:75000,'Senior deduction')
 eligibleBelow(a.stateLocalTaxesCents,separate?252500:505000,'State/local tax deduction')
 if(a.mortgageInterestCents&&a.acquisitionDebtCents>=(separate?37500000:75000000))throw new Error('Mortgage debt is outside the range in the printed worksheet. Review the mortgage interest limitation before entering Step 4(b).')
 const lines={}
 lines['1a']=Math.min(a.qualifiedTipsCents,2500000)
 lines['1b']=Math.min(a.qualifiedOvertimeCents,joint?2500000:1250000)
 lines['1c']=Math.min(a.vehicleInterestCents,1000000)
 lines['2']=sum(lines['1a'],lines['1b'],lines['1c'])
 lines['3a']=selfSenior?600000:0;lines['3b']=spouseSenior?600000:0;lines['4']=sum(lines['3a'],lines['3b'])
 lines['5']=a.adjustmentsCents
 lines['6a']=excess(a.medicalExpensesCents,income,75,1000)
 lines['6b']=Math.min(a.stateLocalTaxesCents,separate?2020000:4040000)
 lines['6c']=a.mortgageInterestCents
 lines['6d']=excess(a.charitableGiftsCents,income,5,1000)
 lines['6e']=a.otherItemizedCents
 lines['7']=sum(lines['6a'],lines['6b'],lines['6c'],lines['6d'],lines['6e'])
 lines['8a']=income;lines['8b']=Math.max(0,income-lines['4'])
 lines['9']=lines['4']>income?null:(jointOrSurvivor?76870000:separate?38435000:64060000)
 lines['10']=lines['9']===null?0:lines['9']>lines['8b']?lines['7']:ratio(lines['7'],94,100)
 lines['11']=jointOrSurvivor?3220000:status==='HEAD_OF_HOUSEHOLD'?2415000:1610000
 const cashCandidate=Math.min(a.cashGiftsCents,joint?200000:100000)
 const usesItemized=lines['10']>sum(lines['11'],cashCandidate)
 lines['12']=usesItemized?0:cashCandidate
 lines['13']=sum(lines['11'],lines['12'])
 lines['14']=usesItemized?lines['10']-lines['11']:lines['12']
 lines['15']=sum(lines['2'],lines['4'],lines['5'],lines['14'])
 return {lines,usesItemized,step4bCents:lines['15']}
}
