import {createHash} from 'node:crypto'
const allowed=new Set(['REVIEW_REQUIRED','DELIVERY_EVIDENCE_MATCHED','RECONCILED','CANCELLED'])
// Pure decision only. A coordinator must derive the assessment and owned alert
// identities from a scoped, locked database snapshot before applying this result.
export function retirementContributionAlertDecision(assessment){
 if(!assessment||!allowed.has(assessment.status)||typeof assessment.authorizationId!=='string'||!Number.isSafeInteger(assessment.amountCents)||assessment.amountCents<=0||!Array.isArray(assessment.issues)||assessment.issues.some(i=>typeof i!=='string'))throw new Error('Use a complete scoped contribution assessment.')
 const matched=assessment.returnReviewRequired!==true&&assessment.payrollStatus==='MATCHED'&&assessment.bankStatus==='BANK_POSTED'&&assessment.receiptStatus==='POSTED'&&assessment.accountingStatus==='MATCHED'&&(!assessment.returnAccountingStatus||assessment.returnAccountingStatus==='NOT_REQUIRED')&&assessment.postedCents===assessment.amountCents&&assessment.issues.length===0
 const cancelled=assessment.status==='CANCELLED',reconciled=assessment.status==='RECONCILED'&&matched
 const status=cancelled?'CANCELLED':reconciled?'RECONCILED':'REVIEW_REQUIRED'
 const summary={authorizationId:assessment.authorizationId,status,payrollStatus:assessment.payrollStatus,bankStatus:assessment.bankStatus,receiptStatus:assessment.receiptStatus,accountingStatus:assessment.accountingStatus,returnReviewRequired:assessment.returnReviewRequired===true,returnAccountingStatus:assessment.returnAccountingStatus??'NOT_REQUIRED',reversedAllocationCents:assessment.reversedAllocationCents??null,replacementReviewStatus:assessment.replacementReviewStatus??'NOT_APPLICABLE',amountCents:assessment.amountCents,postedCents:assessment.postedCents??null,issues:[...assessment.issues]}
 if(assessment.status==='RECONCILED'&&!matched)summary.issues.push('The combined reconciliation status conflicts with its supporting evidence.')
 const fingerprint=createHash('sha256').update(JSON.stringify(summary)).digest('hex')
 return {summary,fingerprint,combinedAlert:cancelled||reconciled?'DISMISS':'OPEN',clearDeliveryWarnings:reconciled,title:reconciled?'Retirement contribution reconciled':cancelled?'Retirement contribution cancelled':'Retirement contribution needs reconciliation'}
}
