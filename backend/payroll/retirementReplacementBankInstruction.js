import {modernTreasuryRetirementInstruction} from './modernTreasuryRetirementPayments.js'
import {previousBankBusinessDay} from './bankCalendar.js'
const fail=message=>Object.assign(new Error(message),{status:409})
// Source verification and durable claims belong to the dispatcher. This builder
// keeps the replacement payment identity separate from the original contribution.
export function retirementReplacementBankInstruction(authorization,funding,destination,{now=new Date()}={}){
 const a=authorization,p=a?.preview,allocation=p?.allocation,connection=funding?.configuration
 if(!p||!allocation||a.id===a.original_authorization_id||p.originalAuthorizationId!==a.original_authorization_id||p.returnAuthorizationId!==a.return_authorization_id||p.fileName!==a.file_name||!p.newAllocationRequired||!p.priorBatchReversedConfirmed||!p.outsideActivityReviewed||!p.lateCorrectionReviewed)throw fail('Retain the complete replacement contribution review.')
 if(String(destination?.id)!==String(allocation.destinationRevisionId)||Number(destination?.connection_id)!==Number(allocation.fundingRevisionId)||Number(destination?.facility_id)!==Number(a.facility_id)||destination?.plan_id!==p.planId||Number(funding?.id)!==Number(allocation.fundingRevisionId))throw fail('Replacement funding and destination must match the reviewed employer and plan.')
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),paymentDate=p.timing?.depositDate
 if(!paymentDate||paymentDate<=today||previousBankBusinessDay(paymentDate)!==paymentDate||!Number.isFinite(Date.parse(p.timing?.submissionAt))||new Date(now)>=new Date(p.timing.submissionAt))throw fail('A future bank-business deposit date and open replacement cutoff are required.')
 if(p.amountCents!==allocation.amountCents||p.originalWithheldDate!==allocation.withheldDate)throw fail('Replacement amounts and original withholding must match the retained allocation.')
 const intent={id:a.id,facilityId:Number(a.facility_id),runId:Number(p.runId),planId:p.planId,destinationId:destination.id,fundingRevisionId:Number(allocation.fundingRevisionId),originatingAccountId:connection.originatingAccountId,receivingAccountId:destination.destination.accountId,counterpartyId:destination.destination.counterpartyId,destinationFingerprint:destination.destination.fingerprint,amountCents:p.amountCents,paymentDate,submitBefore:p.timing.submissionAt,mode:connection.mode,originalAuthorizationId:a.original_authorization_id,replacementAuthorizationId:a.id,returnAuthorizationId:a.return_authorization_id,originalWithheldDate:p.originalWithheldDate}
 modernTreasuryRetirementInstruction(intent)
 return intent
}
