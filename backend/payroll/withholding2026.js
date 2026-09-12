import {verifyMarylandAdditionalAllocation} from './marylandAdditionalAllocation.js'
import {marylandElectionFingerprint} from './marylandElectionFingerprint.js'
import {retirement401kTaxWages} from './retirement401kTaxWages.js'
// Official 2026 IRS Publication 15-T worksheet 1A and Maryland employer guide,
// printed pages 37–38 (3.20% local, weekly through monthly). Table amounts are dollars.
export const WITHHOLDING_VERSION='2026-irs15t-md320-semimonthly-v2'
export const WITHHOLDING_SOURCES={federal:'https://www.irs.gov/publications/p15t',maryland:'https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/withholding-guide.pdf'}
const FEDERAL={
 SINGLE:[[0,0,0],[7500,0,.10],[19900,1240,.12],[57900,5800,.22],[113200,17966,.24],[209275,41024,.32],[263725,58448,.35],[648100,192979.25,.37]],
 MARRIED:[[0,0,0],[19300,0,.10],[44100,2480,.12],[120100,11600,.22],[230700,35932,.24],[422850,82048,.32],[531750,116896,.35],[788000,206583.50,.37]],
 HEAD_OF_HOUSEHOLD:[[0,0,0],[15550,0,.10],[33250,1770,.12],[83000,7740,.22],[121250,16155,.24],[217300,39207,.32],[271750,56631,.35],[656150,191171,.37]],
}
const FEDERAL_TWO_JOBS={
 SINGLE:[[0,0,0],[8050,0,.10],[14250,620,.12],[33250,2900,.22],[60900,8983,.24],[108938,20512,.32],[136163,29224,.35],[328350,96489.63,.37]],
 MARRIED:[[0,0,0],[16100,0,.10],[28500,1240,.12],[66500,5800,.22],[121800,17966,.24],[217875,41024,.32],[272325,58448,.35],[400450,103291.75,.37]],
 HEAD_OF_HOUSEHOLD:[[0,0,0],[12075,0,.10],[20925,885,.12],[45800,3870,.22],[64925,8077.50,.24],[112950,19603.50,.32],[140175,28315.50,.35],[332375,95585.50,.37]],
}
const MARYLAND={
 SINGLE:[[0,0,.0795],[4167,331.25,.082],[5208,416.67,.0845],[6250,504.69,.087],[10417,867.19,.0895],[20833,1799.48,.0945],[41667,3768.26,.097]],
 JOINT:[[0,0,.0795],[6250,496.88,.082],[7292,582.29,.0845],[9375,758.33,.087],[12500,1030.21,.0895],[25000,2148.96,.0945],[50000,4511.46,.097]],
}
const FREQUENCIES={WEEKLY:{periods:52,standard:65.38,exemption:61.54,minimum:96},BIWEEKLY:{periods:26,standard:130.76,exemption:123.08,minimum:192},SEMIMONTHLY:{periods:24,standard:141.66,exemption:133.33,minimum:208},MONTHLY:{periods:12,standard:283.33,exemption:266.67,minimum:417}}
// Published 3.20% local tables, printed pages 37–38. Preserve published
// rounded brackets/base amounts instead of rescaling another payroll period.
const MARYLAND_BY_FREQUENCY={
 SEMIMONTHLY:MARYLAND,
 WEEKLY:{
  SINGLE:[[0,0,.0795],[1923,152.88,.082],[2404,192.31,.0845],[2885,232.93,.087],[4808,400.24,.0895],[9615,830.49,.0945],[19231,1739.21,.097]],
  JOINT:[[0,0,.0795],[2885,229.33,.082],[3365,268.75,.0845],[4327,350,.087],[5769,475.48,.0895],[11538,991.79,.0945],[23077,2082.22,.097]],
 },
 BIWEEKLY:{
  SINGLE:[[0,0,.0795],[3846,305.77,.082],[4808,384.62,.0845],[5769,465.87,.087],[9615,800.48,.0895],[19231,1661.11,.0945],[38462,3478.44,.097]],
  JOINT:[[0,0,.0795],[5769,458.65,.082],[6731,537.50,.0845],[8654,700,.087],[11538,950.96,.0895],[23077,1983.66,.0945],[46154,4164.44,.097]],
 },
 MONTHLY:{
  SINGLE:[[0,0,.0795],[8333,662.50,.082],[10417,833.33,.0845],[12500,1009.38,.087],[20833,1734.38,.0895],[41667,3598.99,.0945],[83333,7536.43,.097]],
  JOINT:[[0,0,.0795],[12500,993.75,.082],[14583,1164.58,.0845],[18750,1516.67,.087],[25000,2060.42,.0895],[50000,4297.92,.0945],[100000,9022.92,.097]],
 },
}
const amount=(value,label)=>{if(!Number.isSafeInteger(value)||value<0)throw new Error(`${label} must be non-negative integer cents.`);return value/100}
function bracketTax(value,table,inclusive=true){const row=[...table].reverse().find(([lower])=>inclusive?value>=lower:value>lower)||table[0];return row[1]+Math.max(0,value-row[0])*row[2]}
export function federalWithholding2026(grossCents,election,periods=24) {
 const gross=amount(grossCents,'Taxable wages')
 if(![12,24,26,52].includes(periods)||(!Object.hasOwn(FEDERAL,election.filingStatus)&&!(election.exempt===true&&election.filingStatus==null)))throw new Error('Unsupported federal filing status or payroll frequency.')
 if(election.nonresidentAlien||election.lockInLetter)throw new Error('A nonresident or IRS lock-in case needs a separately verified calculation.')
 const other=amount(election.otherIncomeCents??0,'W-4 other income'),deductions=amount(election.deductionsCents??0,'W-4 deductions'),credits=amount(election.creditsCents??0,'W-4 credits'),extra=amount(election.extraWithholdingCents??0,'W-4 extra withholding')
 if(election.exempt===true)return 0
 const adjustment=election.multipleJobs===true?0:election.filingStatus==='MARRIED'?12900:8600
 const annual=Math.max(0,gross*periods+other-deductions-adjustment)
 const tax=bracketTax(annual,(election.multipleJobs?FEDERAL_TWO_JOBS:FEDERAL)[election.filingStatus])
 return Math.round((Math.max(0,(tax-credits)/periods)+extra)*100)
}
export function marylandWithholding2026(grossCents,election,payFrequency='SEMIMONTHLY') {
 return marylandWithholdingDetails2026(grossCents,election,payFrequency).totalCents
}
export function marylandWithholdingDetails2026(grossCents,election,payFrequency='SEMIMONTHLY') {
 const frequency=FREQUENCIES[payFrequency],table=MARYLAND_BY_FREQUENCY[payFrequency]
 const gross=amount(grossCents,'Maryland wages')
 if(!frequency||(!table?.[election.filingStatus]&&!(election.exempt===true&&election.filingStatus==null))||Number(election.localRate)!==3.2||(!(Number.isInteger(election.exemptions)&&election.exemptions>=0&&election.exemptions<=99)&&!(election.exempt===true&&election.exemptions==null)))throw new Error('Automatic Maryland calculation requires verified 3.20% local elections and a supported payroll frequency.')
 const requestedAdditionalCents=election.extraWithholdingCents??0
 amount(requestedAdditionalCents,'Maryland additional withholding')
 if(election.exempt===true)return {baseCents:0,requestedAdditionalCents,appliedAdditionalCents:0,totalCents:0}
 const taxableCents=Math.max(0,grossCents-Math.round(frequency.standard*100)-election.exemptions*Math.round(frequency.exemption*100))
 const bracket=[...table[election.filingStatus]].reverse().find(([lower])=>taxableCents>lower*100)||table[election.filingStatus][0]
 const numerator=BigInt(Math.round(bracket[1]*100))*10000n+BigInt(Math.max(0,taxableCents-bracket[0]*100))*BigInt(Math.round(bracket[2]*10000))
 const taxCents=gross<frequency.minimum?0n:(numerator+5000n)/10000n
 const total=taxCents+BigInt(requestedAdditionalCents)
 if(total>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Maryland withholding exceeds safe cent precision.')
 return {baseCents:Number(taxCents),requestedAdditionalCents,appliedAdditionalCents:requestedAdditionalCents,totalCents:Number(total)}
}
export const withholdingVersionFor=payFrequency=>payFrequency==='SEMIMONTHLY'?WITHHOLDING_VERSION:`2026-irs15t-md320-${String(payFrequency).toLowerCase()}-v2`
export function assertNativeW4ExemptionDate(election,paymentDate){
 if(!election?.w4Source||election.federal?.exempt!==true)return
 const valid=v=>typeof v==='string'&&/^2026-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
 if(!valid(election.w4Source.effectiveOn)||!valid(paymentDate)||paymentDate<election.w4Source.effectiveOn)throw new Error('The signed 2026 W-4 exemption requires a 2026 payment date on or after its received date. Review another certificate or the applicable payment-date treatment.')
}
export function assertNativeMW507Date(election,paymentDate){
 if(!election?.mw507Source)return
 const valid=v=>typeof v==='string'&&/^2026-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
 if(!valid(election.mw507Source.receivedOn)||!valid(paymentDate)||paymentDate<election.mw507Source.receivedOn)throw new Error('The signed 2026 MW507 requires a 2026 payment date on or after its received date. Select the applicable historical certificate before using earlier or later-year payments.')
}
export function calculateWithholding2026({grossPayCents,election,payFrequency,year,workState,residenceState,paymentDate,pretaxDeductionCents=0,retirement401k,hasBonus=false,annualBonusCents=0,bonusReviewComplete=false,ytdWagesCents=0,leavePayoutCents=0,regularWagesCents=0}) {
 if(election?.w4ReviewRequired)throw new Error('Review and save tax elections from the latest employee-signed W-4 before calculating withholding.')
 if(election?.mw507ReviewRequired)throw new Error('Review and save tax elections from the latest employee-signed MW507 before calculating withholding.')
 assertNativeW4ExemptionDate(election,paymentDate)
 assertNativeMW507Date(election,paymentDate)
 if(!election?.verified||year!==2026||!Object.hasOwn(FREQUENCIES,payFrequency)||workState!=='MD'||residenceState!=='MD')throw new Error('Verified 2026 Maryland-resident tax elections and a supported payroll frequency are required for automatic withholding.')
 if(pretaxDeductionCents)throw new Error('Pretax deductions need a separately verified tax calculation.')
 if(leavePayoutCents&&(!Number.isSafeInteger(leavePayoutCents)||leavePayoutCents<0||!Number.isSafeInteger(regularWagesCents)||regularWagesCents<=0||grossPayCents<=leavePayoutCents+annualBonusCents||!Number.isSafeInteger(ytdWagesCents)||ytdWagesCents+grossPayCents>100000000))throw new Error('PTO payouts require concurrent regular wages and cumulative wages no greater than $1 million for automatic aggregate withholding. Record a separately verified calculation otherwise.')
 if(hasBonus&&election.maryland?.exempt===true)throw new Error('An annual bonus with a Maryland withholding exemption needs separately verified treatment.')
 if(hasBonus&&(!bonusReviewComplete||!Number.isSafeInteger(annualBonusCents)||annualBonusCents<=0||grossPayCents<=annualBonusCents||!Number.isSafeInteger(ytdWagesCents)||ytdWagesCents+grossPayCents>100000000))throw new Error('Annual bonuses require verified classification, concurrent regular wages, and cumulative wages no greater than $1 million for this automatic method.')
 const retirement=retirement401k===undefined?null:retirement401kTaxWages({...retirement401k,grossCents:grossPayCents,annualBonusCents:hasBonus?annualBonusCents:0,year,workState,residenceState})
 const federalWagesCents=retirement?.federalWagesCents??grossPayCents,marylandRegularWagesCents=retirement?.marylandRegularWagesCents??grossPayCents-(hasBonus?annualBonusCents:0),marylandAnnualBonusWagesCents=retirement?.marylandAnnualBonusWagesCents??(hasBonus?annualBonusCents:0)
 const allocation=election.marylandAdditionalAllocation
 if(allocation?.error)throw new Error(allocation.error)
 if(allocation)verifyMarylandAdditionalAllocation(allocation,{requestedAdditionalCents:election.maryland.extraWithholdingCents??0,electionFingerprint:marylandElectionFingerprint(election.maryland),payFrequency})
 const regularState=marylandWithholdingDetails2026(marylandRegularWagesCents,allocation?{...election.maryland,extraWithholdingCents:allocation.remainingAdditionalCents}:election.maryland,payFrequency)
 const annualBonusTaxCents=hasBonus?Number((BigInt(marylandAnnualBonusWagesCents)*970n+5000n)/10000n):0
 const stateTotal=BigInt(regularState.totalCents)+BigInt(annualBonusTaxCents)
 if(stateTotal>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Maryland withholding exceeds safe cent precision.')
 const stateTaxComponents={version:1,method:'REGULAR_PERIOD',payFrequency,regularBaseCents:regularState.baseCents,annualBonusTaxCents,requestedAdditionalCents:election.maryland.extraWithholdingCents??0,...(allocation?{allocation}:{}),appliedAdditionalCents:regularState.appliedAdditionalCents,totalCents:Number(stateTotal),exempt:election.maryland.exempt===true,electionFingerprint:marylandElectionFingerprint(election.maryland)}
 return {incomeTaxWageBasis:{version:1,source:'NATIVE_ENGINE',stateTaxComponents,year,workState,residenceState,grossWagesCents:grossPayCents,federalWagesCents,marylandWagesCents:retirement?.marylandWagesCents??grossPayCents,marylandRegularWagesCents,marylandAnnualBonusWagesCents,pretaxDeductionCents:retirement?.pretaxCents??0,...(retirement?{retirement401k:retirement}:{})},federalIncomeTaxCents:federalWithholding2026(federalWagesCents,election.federal,FREQUENCIES[payFrequency].periods),stateIncomeTaxCents:Number(stateTotal),method:withholdingVersionFor(payFrequency)+(hasBonus?'-federal-aggregate-md-annual-bonus-9.70':'')+(leavePayoutCents?'-pto-aggregate':'')+(retirement?'-401k':'')}
}
