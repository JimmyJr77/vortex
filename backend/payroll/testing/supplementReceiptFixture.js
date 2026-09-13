import {randomUUID} from 'node:crypto'
import {reverificationFixture} from './reverificationFixture.js'
export async function supplementReceiptFixture(h){
 const fixture=await reverificationFixture(h),{api,employee,signed,pdf}=fixture
 const followup=(await h.pool.query('SELECT * FROM payroll_i9_signature_followup WHERE signature_id=$1',[signed.signatureId])).rows[0]
 const path=`/employees/${employee.id}/i9/supplement/${followup.compliance_task_id}`
 const today=(await h.pool.query("SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=1")).rows[0].today
 const validUntil=new Date(Date.parse(today)+60*86400000).toISOString().slice(0,10)
 const stamp=`${today.slice(5,7)}/${today.slice(8,10)}/${today.slice(0,4)}`
 const notation=`RA ${stamp}: Synthetic lost document receipt review.`
 const answers={edition:'01/20/25',document:{list:'A',title:'Employment Authorization Document receipt',number:'receipt SYNTHETIC',expiresOn:validUntil},representativeName:'Reviewer Alice',examinationMethod:'PHYSICAL',additionalInformation:notation}
 const review=await api(path+'/preview',{signatureId:signed.signatureId,answers}),page={reviewId:review.reviewId,previewSha256:review.previewSha256,displayed:true}
 const copy=await api(path+'/copies',{...page,requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:pdf.toString('base64')})
 for(let n=1;n<=4;n++)await api(path+'/page',{...page,documentKey:'source',page:n})
 await api(path+'/page',{...page,documentKey:'supplement',page:1})
 for(let n=1;n<=2;n++)await api(path+'/copy-page',{...page,copyId:copy.id,page:n})
 const examination={examinedOn:today,examinerInitials:'RA',identityEvidence:'Authenticated examiner reviewed the synthetic replacement receipt.',reverificationRequired:true,requirementSource:'https://www.uscis.gov/i-9-central',requirementEvidence:'Synthetic finite authorization requires review.',employeeChoseDocuments:true,currentAuthorizationReviewed:true,documentsGenuineAndRelated:true,copiesComplete:true,copyIds:[copy.id],physicalPresence:true,acceptance:'RECEIPT',acceptanceSource:'https://www.uscis.gov/i-9-central',acceptanceEvidence:'Synthetic receipt used only to test retained source selection.',validUntil,formNotation:notation,authorizationIndefinite:false,authorizationThrough:'2032-01-01',followUpKind:'RECEIPT_REPLACEMENT',followUpOn:validUntil,noFurtherReverificationRequired:false}
 const completed=await api(path+'/sign',{...page,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:review.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination})
 return {...fixture,receipt:completed,receiptTaskId:completed.nextFollowup.id,today}
}
