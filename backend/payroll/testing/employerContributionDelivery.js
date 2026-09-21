import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {decryptDocument} from '../onboarding.js'
import {retirementReceiptCsv} from '../retirementAllocationReceipt.js'
import {employeeRetirementContributions} from '../employeeRetirementContributions.js'

export async function assertEmployerContributionDelivery(h,api,reservation,server,provider,setNow){
 const {authorizationId,contractId,contract,employeeId}=reservation
 const setupPath='/retirement-plans/standard/allocation-delivery',setup=await api(setupPath)
 const configuration=await api(setupPath,{action:'REVIEW',planRevisionId:setup.planRevisionId,formatId:setup.formatId,configuration:server.config,expectedRevision:0,requestKey:randomUUID(),confirmed:true,acceptsCsv:true,stagingExcluded:true,nonOverwritingRename:true,noAutomaticDebit:true,reference:'Synthetic verified combined allocation contract and separate bank funding'})
 await api(`${setupPath}/${configuration.id}/check`,{})
 const deliveryPath=`/retirement-remittance-authorizations/${authorizationId}/allocation-delivery`,fileName=`retirement_${authorizationId}.csv`
 const allocation=await api(deliveryPath,{configurationId:configuration.id,fileName,reference:'Reviewed exact synthetic combined file and absent outside submissions',confirmed:true,outsideActivityReviewed:true,requestKey:randomUUID()})
 const dispatchPath=`${deliveryPath}/${allocation.id}/dispatch`,dispatch={action:'SUBMIT',confirmed:true,outsideActivityReviewed:true,reference:'Reviewed original combined allocation and no duplicate provider submission'}
 await Promise.all([api(dispatchPath,dispatch),api(dispatchPath,dispatch)])
 assert.equal(server.state.created,1);assert.equal(server.state.renames,1)
 const stored=(await h.pool.query('SELECT encrypted_allocation,basis FROM payroll_retirement_remittance_authorization WHERE id=$1',[authorizationId])).rows[0]
 const bytes=decryptDocument(stored.encrypted_allocation,`payroll-retirement-remittance:1:${authorizationId}`)
 assert.ok(server.files.get(`/incoming/${fileName}`).equals(bytes))
 const bankPath=`/retirement-remittance-authorizations/${authorizationId}/dispatch`,bank={action:'SUBMIT',confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Synthetic trustee accepts separate CCD funding without automatic allocation debit'}
 provider.loseResponse(true)
 await Promise.all([api(bankPath,bank),api(bankPath,bank)])
 assert.equal(provider.posts(),1);assert.equal(provider.instruction().amount,2400)
 provider.complete();setNow('2026-09-22T16:00:00Z')
 const recovered=await api(bankPath,{action:'RECOVER',confirmed:true})
 assert.equal(recovered.result.settlementStatus,'BANK_POSTED')
 assert.equal(recovered.result.settlementEvidence[0].amountCents,2400)
 const receiptName=`receipt_${allocation.id}.csv`,binding=await api(`${deliveryPath}/${allocation.id}/receipt-binding`,{action:'REVIEW',contractId,directory:'/incoming',fileName:receiptName,expectedRevision:0,requestKey:randomUUID(),reference:'Reviewed exact synthetic combined receipt path and interpretation',originalFileReviewed:true,confirmed:true})
 const rows=retirementReceiptCsv(bytes),original=Object.fromEntries(rows[0].map((field,i)=>[field,rows[1][i]]))
 const quote=x=>'"'+String(x).replaceAll('"','""')+'"'
 const receipt=(changes={})=>{
  const row={...original,...Object.fromEntries(Object.entries(original).filter(([field])=>field.endsWith('Cents')).map(([field,value])=>[field,String(Number(value.replace('.','')))])),sourceFileName:fileName,sourceSha256:createHash('sha256').update(bytes).digest('hex'),batchId:'SYNTHETIC-COMBINED-BATCH',status:'Credited',recordedAt:'2026-09-22T15:00:00Z',...changes}
  return Buffer.from([contract.columns.map(c=>quote(c.header)).join(','),contract.columns.map(c=>quote(row[c.field])).join(',')].join('\r\n')+'\r\n')
 }
 const check=()=>api(`${deliveryPath}/${allocation.id}/receipts`,{bindingId:binding.id,confirmed:true,requestKey:randomUUID()})
 server.files.set(`/incoming/${receiptName}`,receipt({employerMatchingCents:'200',totalCents:'2000'}))
 const partial=await check();assert.equal(partial.summary.status,'PARTIALLY_POSTED');assert.equal(partial.summary.postedCents,2000)
 server.files.set(`/incoming/${receiptName}`,receipt({recordedAt:'2026-09-22T15:30:00Z'}))
 const full=await check();assert.equal(full.summary.status,'POSTED');assert.equal(full.summary.postedCents,2400)
 const result=(await h.pool.query('SELECT encrypted_result FROM payroll_retirement_receipt_observation WHERE id=$1',[full.id])).rows[0]
 const decoded=JSON.parse(decryptDocument(result.encrypted_result,`payroll-retirement-receipt:1:${full.id}:result`).toString())
 assert.equal(decoded.participants[0].reported.employerMatchingCents,600);assert.equal(decoded.participants[0].reported.employerNonelectiveCents,400)
 const employee=await employeeRetirementContributions(h.pool,1,employeeId)
 assert.equal(employee.items[0].contributions[0].status,'POSTED');assert.equal(employee.items[0].contributions[0].postedCents,2400)
 assert.ok(!JSON.stringify(employee).includes('SYNTHETIC-COMBINED-BATCH'))
 const assessment=await api(`/retirement-remittance-authorizations/${authorizationId}/assessment`)
 assert.equal(assessment.bankStatus,'BANK_POSTED');assert.equal(assessment.receiptStatus,'POSTED')
 assert.equal(provider.posts(),1);assert.equal(server.state.created,1);assert.equal(server.state.renames,1)
}
