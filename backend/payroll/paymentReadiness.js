import {decryptDocument} from './onboarding.js'
import {paymentAuthorizationDisclosure} from './paymentAuthorization.js'
// Retained enrollment readiness only. Dispatch must revalidate provider accounts
// and the exact authorization under its transaction/dispatch locks.
export async function employeePaymentReadiness(db,facility,employee){
 const connection=(await db.query('SELECT id,mode FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[facility])).rows[0]
 const destination=(await db.query('SELECT id,connection_id FROM payroll_payment_destination WHERE facility_id=$1 AND employee_id=$2 ORDER BY id DESC LIMIT 1',[facility,employee])).rows[0]
 const authorization=(await db.query('SELECT a.id,a.destination_id,a.decision,a.encrypted_receipt FROM payroll_payment_authorization a JOIN payroll_payment_destination d ON d.id=a.destination_id WHERE d.facility_id=$1 AND d.employee_id=$2 ORDER BY a.id DESC LIMIT 1',[facility,employee])).rows[0]
 const evidence={connectionId:Number(connection?.id||0),destinationId:Number(destination?.id||0),authorizationId:Number(authorization?.id||0),mode:connection?.mode||null}
 const result=(status,issue,extra={})=>({...evidence,status,issue,...extra})
 if(!connection)return result('NO_CONNECTION','Configure the employer payment connection.')
 if(!destination)return result('NO_DESTINATION','Link the employee’s verified bank account.')
 if(Number(destination.connection_id)!==Number(connection.id))return result('CONNECTION_CHANGED','Review and re-link the employee account after the employer connection change.')
 if(authorization?.decision!=='AUTHORIZE'||Number(authorization.destination_id)!==Number(destination.id))return result('AUTHORIZATION_REQUIRED','The employee must authorize the current direct-deposit account.')
 let fingerprint
 try{
  const details=await paymentAuthorizationDisclosure(db,{facility_id:facility,employee_id:employee},destination)
  const receipt=JSON.parse(decryptDocument(authorization.encrypted_receipt,`payroll-payment-authorization:${facility}:${employee}:${destination.id}`).toString())
  fingerprint=details.fingerprint
  if(receipt.fingerprint!==fingerprint)return result('TERMS_CHANGED','The employee must review and authorize the updated employer/account terms.',{termsFingerprint:fingerprint})
 }catch{return result('EVIDENCE_UNAVAILABLE','Restore encrypted payment evidence before reviewing direct deposit.')}
 if(connection.mode!=='LIVE')return result('TEST_ONLY','A test-mode bank account cannot receive live payroll.',{termsFingerprint:fingerprint})
 const check=(await db.query('SELECT status FROM payroll_payment_connection_check WHERE connection_id=$1 ORDER BY id DESC LIMIT 1',[connection.id])).rows[0]
 if(check?.status!=='VERIFIED')return result('FUNDING_CHECK_REQUIRED','Verify the current employer funding account.',{termsFingerprint:fingerprint})
 return result('READY',null,{termsFingerprint:fingerprint})
}
