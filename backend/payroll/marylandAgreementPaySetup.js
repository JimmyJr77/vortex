import {loadMarylandAdditionalAgreement} from './marylandAdditionalAgreement.js'
import {marylandElectionFingerprint} from './marylandElectionFingerprint.js'
import {generateVersionedPayPeriods,loadScheduleVersions} from './payCalendar.js'
import {compensationEvidence} from './employmentCompensation.js'
import {createHash} from 'node:crypto'
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')
const periodBasis=row=>({start:day(row.period_start??row.periodStart),end:day(row.period_end??row.periodEnd),frequency:row.frequency})
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10)
export async function marylandAgreementPaySetup(db,{facility,employee,election,settings,review,today}){
 const md=election?.elections?.maryland
 if(employee.work_state!=='MD'||employee.residence_state!=='MD'||!md)return null
 const latest=(await db.query('SELECT id,fingerprint FROM payroll_maryland_additional_agreement WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC LIMIT 1',[facility,employee.id])).rows[0]
 if(!(md.extraWithholdingCents>0)&&!latest)return null
 const versions=await loadScheduleVersions(db,facility)
 const calendar={settings:Object.fromEntries(['pay_frequency','semimonthly_first_day','semimonthly_second_day','pay_period_anchor_start','pay_period_payment_lag_days'].map(key=>[key,settings[key]])),versions}
 const reference=hash({election:marylandElectionFingerprint(md),agreement:latest?.fingerprint??null,hireDate:day(employee.hire_date),calendar})
 const previous=review?.response?.paySetup?.basis?.marylandAgreement
 let paymentDate=null,periodId=null,plannedPeriod=null
 try{
  if(previous?.reference===reference&&previous.paymentDate&&previous.plannedPeriod){
   const retained=previous.plannedPeriod
   const periods=(await db.query("SELECT * FROM payroll_pay_period WHERE facility_id=$1 AND status<>'VOID' AND period_start<=$3::date AND period_end>=$2::date",[facility,retained.start,retained.end])).rows
   if(periods.length>1)throw Object.assign(new Error('Resolve overlapping payroll periods before approving additional-withholding setup.'),{status:409})
   const exact=periods[0]
   if(exact&&hash(periodBasis(exact))===hash(retained)&&day(exact.pay_date)===previous.paymentDate){paymentDate=previous.paymentDate;periodId=String(exact.id);plannedPeriod=retained}
   else if(!exact&&!previous.periodId){paymentDate=previous.paymentDate;plannedPeriod=retained}
  }
  if(!paymentDate){
   const period=(await db.query("SELECT * FROM payroll_pay_period WHERE facility_id=$1 AND status='OPEN' AND pay_date >= $2::date AND period_end >= $3::date ORDER BY pay_date,period_start LIMIT 1",[facility,today,employee.hire_date])).rows[0]
   if(period){paymentDate=day(period.pay_date);periodId=String(period.id);plannedPeriod=periodBasis(period)}
   else{
    const anchor=[today,day(employee.hire_date)].sort().at(-1),date=new Date(anchor+'T00:00:00Z'),candidates=[]
    for(let offset=0;offset<3;offset++){const month=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+offset,1));candidates.push(...generateVersionedPayPeriods(month.getUTCFullYear(),month.getUTCMonth()+1,settings,versions))}
    const candidate=candidates.filter(period=>period.payDate>=anchor&&period.periodEnd>=day(employee.hire_date)).sort((a,b)=>a.payDate.localeCompare(b.payDate))[0]
    if(candidate){paymentDate=candidate.payDate;plannedPeriod=periodBasis(candidate)}
   }
  }
  if(!paymentDate)throw Object.assign(new Error('Review the first planned payroll payment date before completing additional-withholding setup.'),{status:409})
  const overlaps=(await db.query("SELECT * FROM payroll_pay_period WHERE facility_id=$1 AND status<>'VOID' AND period_start<=$3::date AND period_end>=$2::date",[facility,plannedPeriod.start,plannedPeriod.end])).rows
  if(overlaps.length>1)throw Object.assign(new Error('Resolve overlapping payroll periods before approving additional-withholding setup.'),{status:409})
  if(overlaps[0]&&(hash(periodBasis(overlaps[0]))!==hash(plannedPeriod)||day(overlaps[0].pay_date)!==paymentDate))throw Object.assign(new Error('The saved payroll period differs from the planned calendar. Review its dates before approving withholding setup.'),{status:409})
  const agreement=await loadMarylandAdditionalAgreement(db,{facility,employeeId:employee.id,paymentDate})
  return {status:'CURRENT',reference,paymentDate,periodId,plannedPeriod,agreementId:agreement.agreementId,agreementFingerprint:agreement.fingerprint,effectiveOn:agreement.effectiveOn,issue:null}
 }catch(e){if(!e.status)throw e;return {status:'NEEDS_REVIEW',reference,paymentDate,periodId,plannedPeriod,agreementId:null,issue:`Maryland additional withholding: ${e.message} Complete the agreement in pay settings and employee Onboarding before approving pay setup.`}}
}
