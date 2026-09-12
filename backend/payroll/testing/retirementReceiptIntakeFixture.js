import {createHash} from 'node:crypto'
import {decryptDocument} from '../onboarding.js'
import {retirementReceiptCsv} from '../retirementAllocationReceipt.js'
import {retirementReceiptBindingFixture} from './retirementReceiptBindingFixture.js'
import {receiptContractFixture} from './retirementReceiptContractFixture.js'
export async function retirementReceiptIntakeFixture(h,configuration){
 const f=await retirementReceiptBindingFixture(h,configuration),binding=await f.api(f.bindingPath,f.bindingBody),a=(await h.pool.query('SELECT * FROM payroll_retirement_remittance_authorization WHERE id=$1',[f.remittanceId])).rows[0],bytes=decryptDocument(a.encrypted_allocation,`payroll-retirement-remittance:1:${a.id}`),rows=retirementReceiptCsv(bytes);if(a.basis.includeHeader)rows.shift()
 const quote=x=>'"'+String(x).replaceAll('"','""')+'"',contract=receiptContractFixture(),original=rows.map(values=>Object.fromEntries(a.basis.columns.map((c,i)=>[c.field,values[i]])))
 const receipt=(changes={})=>{
  const result=original.map(row=>({...row,...Object.fromEntries(Object.keys(row).filter(k=>k.endsWith('Cents')).map(k=>[k,String(Number(a.basis.amountFormat==='DOLLARS'?row[k].replace('.',''):row[k]))])),sourceFileName:f.deliveryBody.fileName,sourceSha256:createHash('sha256').update(bytes).digest('hex'),batchId:'Synthetic batch 1',status:'Credited',recordedAt:'2026-09-19T13:00:00Z',...changes}))
  return Buffer.from([contract.columns.map(c=>quote(c.header)).join(','),...result.map(row=>contract.columns.map(c=>quote(row[c.field])).join(','))].join('\r\n')+'\r\n')
 }
 return {...f,bindingId:binding.id,receiptPath:`${f.deliveryPath}/${f.allocationId}/receipts`,remotePath:f.bindingBody.directory+'/'+f.bindingBody.fileName,receipt}
}
