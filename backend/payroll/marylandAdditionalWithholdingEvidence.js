import {verifyMarylandAdditionalAllocation} from './marylandAdditionalAllocation.js'
import {isDeepStrictEqual} from 'node:util'
const cents=value=>Number.isSafeInteger(value)&&value>=0
const missing={status:'MISSING',requestedAdditionalCents:null,appliedAdditionalCents:null,message:'Prior Maryland withholding does not separately identify additional deductions.'}
const invalid={status:'INVALID',requestedAdditionalCents:null,appliedAdditionalCents:null,message:'Reconcile Maryland additional-withholding components with the retained calculation, statement and posted tax.'}

// Component evidence is separate from wage reconciliation. Legacy total tax
// alone cannot prove that an elected additional amount was already deducted.
export function marylandAdditionalWithholdingEvidence(row,wagesReconciled,stage='FINALIZED'){
 if(!wagesReconciled||!['APPROVED','FINALIZED'].includes(stage)||stage==='APPROVED'&&row.status!=='APPROVED')return {...invalid}
 const employeeId=String(row.employee_id)
 const calculations=row.calculation_snapshot?.employees
 const matches=Array.isArray(calculations)?calculations.filter(e=>String(e?.employeeId)===employeeId):[]
 if(matches.length!==1)return {...invalid}
 const basis=matches[0].incomeTaxWageBasis,statement=row.statement_snapshot?.incomeTaxWageBasis
 const component=basis?.stateTaxComponents,saved=statement?.stateTaxComponents
 if(component===undefined&&saved===undefined)return {...missing}
 const method={REGULAR:'REGULAR_PERIOD',OFF_CYCLE_PTO:'PTO_PERIOD',OFF_CYCLE_BONUS:'BONUS_PERIOD'}[row.run_kind]
 if(!method||!component||(stage==='FINALIZED'&&!isDeepStrictEqual(component,saved))||component.version!==1||component.method!==method||!['WEEKLY','BIWEEKLY','SEMIMONTHLY','MONTHLY'].includes(component.payFrequency)||typeof component.exempt!=='boolean'||typeof component.electionFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(component.electionFingerprint))return {...invalid}
 const {regularBaseCents,annualBonusTaxCents,requestedAdditionalCents,appliedAdditionalCents,totalCents}=component
 const ptoBaseCents=component.ptoBaseCents??0
 if(![ptoBaseCents,regularBaseCents,annualBonusTaxCents,requestedAdditionalCents,appliedAdditionalCents,totalCents].every(cents)||BigInt(regularBaseCents)+BigInt(annualBonusTaxCents)+BigInt(ptoBaseCents)+BigInt(appliedAdditionalCents)!==BigInt(totalCents)||totalCents!==Number(row.state_income_tax_cents))return {...invalid}
 if(method==='PTO_PERIOD'&&(regularBaseCents!==0||annualBonusTaxCents!==0)||method!=='PTO_PERIOD'&&ptoBaseCents!==0||method==='BONUS_PERIOD'&&regularBaseCents!==0)return {...invalid}
 if(component.exempt){if(method!=='REGULAR_PERIOD'||regularBaseCents!==0||annualBonusTaxCents!==0||appliedAdditionalCents!==0||component.allocation)return {...invalid}}
 else if(component.allocation){
  try{const allocation=verifyMarylandAdditionalAllocation(component.allocation,{requestedAdditionalCents,electionFingerprint:component.electionFingerprint,payFrequency:component.payFrequency,employeeId,paymentDate:row.payment_date instanceof Date?row.payment_date.toISOString().slice(0,10):String(row.payment_date).slice(0,10)});if(appliedAdditionalCents!==allocation.remainingAdditionalCents)return {...invalid}}catch{return {...invalid}}
 }else if(method==='REGULAR_PERIOD'?appliedAdditionalCents!==requestedAdditionalCents:appliedAdditionalCents!==0||method==='PTO_PERIOD'&&requestedAdditionalCents!==0)return {...invalid}
 return {status:'VERIFIED',requestedAdditionalCents,appliedAdditionalCents,payFrequency:component.payFrequency,electionFingerprint:component.electionFingerprint}
}
