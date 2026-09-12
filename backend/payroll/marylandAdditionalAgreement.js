import {marylandElectionFingerprint} from './marylandElectionFingerprint.js'
import {effectiveScheduleSettings} from './payCalendar.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10)

// Read-only selection. Call inside the employer-locked payroll transaction
// before period history is loaded and an additional deduction is reserved.
export async function loadMarylandAdditionalAgreement(db,{facility,employeeId,paymentDate}){
 if(typeof paymentDate!=='string'||!/^2026-\d{2}-\d{2}$/.test(paymentDate)||!Number.isFinite(Date.parse(paymentDate))||day(new Date(paymentDate))!==paymentDate)throw fail('Select a valid 2026 payment date for the additional-withholding agreement.')
 const employee=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employeeId])).rows[0]
 if(!employee)throw Object.assign(new Error('Employee not found.'),{status:404})
 const record=(await db.query('SELECT * FROM payroll_maryland_additional_agreement WHERE facility_id=$1 AND employee_id=$2 AND effective_on<=$3::date ORDER BY effective_on DESC,revision DESC LIMIT 1',[facility,employeeId,paymentDate])).rows[0]
 if(!record||record.status!=='ACTIVE')throw fail('Retain an active signed Maryland additional-withholding agreement effective on this payment date.')
 const election=(await db.query('SELECT elections FROM payroll_tax_election WHERE facility_id=$1 AND employee_id=$2 AND tax_year=2026',[facility,employeeId])).rows[0]?.elections?.maryland
 const agreement=record.agreement
 if(employee.work_state!=='MD'||employee.residence_state!=='MD'||employee.w4_status!=='COMPLETE'||employee.state_withholding_status!=='COMPLETE'||!election||election.exempt||agreement?.verified!==true||agreement.version!==1||agreement.employeeId!==String(employeeId)||agreement.periodBasis!=='PAYMENT_DATE'||!Number.isSafeInteger(agreement.amountCents)||agreement.amountCents<0||agreement.amountCents!==election.extraWithholdingCents||agreement.electionFingerprint!==marylandElectionFingerprint(election))throw fail('The current employee tax election differs from the retained additional-withholding agreement. Review updated signed instructions.')
 const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]
 if(!settings||(await effectiveScheduleSettings(db,facility,settings,paymentDate)).pay_frequency!==agreement.payFrequency)throw fail('The payment-date pay frequency differs from the retained agreement. Review its period basis.')
 return {...agreement,agreementId:String(record.id),revision:record.revision,effectiveOn:day(record.effective_on),fingerprint:record.fingerprint}
}
