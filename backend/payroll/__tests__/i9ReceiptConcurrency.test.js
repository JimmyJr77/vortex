import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {receiptFixture} from '../testing/receiptFixture.js'
import {preparedReceiptFixture} from '../testing/completedReceiptFixture.js'
async function replacement(h,fixture,row){
 const {api,employee,signed,pdf}=fixture
 const task=(await h.pool.query('SELECT compliance_task_id FROM payroll_i9_signature_followup WHERE signature_id=$1 AND row_key=$2',[signed.signatureId,row])).rows[0].compliance_task_id
 const path=`/employees/${employee.id}/i9/different-documents/${task}`,context=await api(path+'/context')
 const review=await api(path+'/preview',{signatureId:signed.signatureId,initials:'RA',reason:'Employee selected a complete different document set to resolve the original receipts.',section2:{edition:'01/20/25',documentChoice:'LIST_A',listA:[{title:'Synthetic replacement document',issuingAuthority:'Synthetic issuer',number:`REPLACEMENT-${row}`,expiresOn:'2030-01-01'}],examinationMethod:'PHYSICAL',...context.employerDefaults,representativeNameAndTitle:'Reviewer Alice, Hiring Administrator',additionalInformation:''}})
 const key={reviewId:review.reviewId,previewSha256:review.previewSha256}
 for(const part of review.packet)for(let page=1;page<=part.pageCount;page++)await api(path+'/page',{...key,documentKey:part.documentKey,page,displayed:true})
 const copy=await api(path+'/copies',{...key,rowKey:'A1',requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:pdf.toString('base64')})
 for(let page=1;page<=2;page++)await api(path+'/copy-page',{...key,rowKey:'A1',copyId:copy.id,page,displayed:true})
 return {path,body:{...key,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:review.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:{differentDocumentsConfirmed:true,authorizationIndefinite:true,authorizationThrough:'',authorizationEvidence:'Examiner verified current authorization against original replacement documents.',examination:{examinedOn:review.recordedOn,examinerInitials:'RA',identityEvidence:'Authenticated examiner personally reviewed the employee originals.',businessDays:[1,2,3,4,5],closedDates:[],calendarConfirmed:true,shortEmployment:false,employeeChoseDocuments:true,section1Reviewed:true,documentsGenuineAndRelated:true,physicalPresence:true,documents:[{rowKey:'A1',copyIds:[copy.id],copiesComplete:true,accepted:true,acceptance:'STANDARD',followUpKind:'NONE',noFollowUpConfirmed:true}]}}}}
}
async function send(h,prepared){
 const response=await fetch(`${h.url}/api/admin/payroll${prepared.path}/sign`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(prepared.body)})
 return {status:response.status,json:await response.json()}
}
for(const scenario of ['two different','actual first','different first'])test(`concurrent receipt signing retains one consistent outcome (${scenario})`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const actual=scenario!=='two different'
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='97'.repeat(32)
 t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const fixture=await receiptFixture(h,{multipleReceipts:true})
 const first=actual?await preparedReceiptFixture(h,fixture,'B'):await replacement(h,fixture,'B')
 const second=await replacement(h,fixture,'C')
 const candidates=scenario==='different first'?[second,first]:[first,second]
 const outcomes=await Promise.all(candidates.map(candidate=>send(h,candidate)))
 assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409])
 const winner=outcomes.findIndex(r=>r.status===200),prepared=candidates[winner]
 assert.deepEqual(await send(h,prepared),outcomes[winner])
 assert.equal((await h.pool.query('SELECT (SELECT count(*) FROM payroll_i9_receipt_signature)+(SELECT count(*) FROM payroll_i9_different_signature) AS count')).rows[0].count,'1')
 const actualWon=actual&&prepared===first
 t.diagnostic(`Winning operation: ${actualWon?'actual replacement':'different-document replacement'}; receipt signing response recovery verified.`)
 const tasks=async()=>(await h.pool.query('SELECT f.row_key,c.status FROM payroll_i9_signature_followup f JOIN payroll_compliance_task c ON c.id=f.compliance_task_id WHERE f.signature_id=$1 ORDER BY f.row_key',[fixture.signed.signatureId])).rows
 assert.deepEqual(await tasks(),[{row_key:'B',status:'COMPLETE'},{row_key:'C',status:actualWon?'OPEN':'COMPLETE'}])
 assert.equal((await h.pool.query('SELECT count(*)::int AS count FROM payroll_i9_different_resolution')).rows[0].count,actualWon?0:2)
 const audit=(await h.pool.query("SELECT action FROM payroll_audit_log WHERE action IN ('I9_RECEIPT_SIGNED','I9_DIFFERENT_SIGNED')")).rows
 assert.equal(audit.length,1)
 if(actualWon){
  const refreshed=await replacement(h,fixture,'C')
  assert.equal((await send(h,refreshed)).status,200)
  assert.deepEqual(await send(h,first),outcomes[winner])
  t.diagnostic('Refreshed remaining-receipt review completed after the actual replacement won.')
  assert.deepEqual((await h.pool.query('SELECT row_key FROM payroll_i9_different_resolution')).rows,[{row_key:'C'}])
 }
 assert.ok((await tasks()).every(task=>task.status==='COMPLETE'))
})
