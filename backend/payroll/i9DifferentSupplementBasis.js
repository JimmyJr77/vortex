import {createHash} from 'node:crypto'
import {i9DifferentDocumentsBasis} from './i9DifferentDocumentsBasis.js'
import {renderI9DifferentSupplementPreview} from './i9DifferentSupplementPdf.js'
const hash=value=>createHash('sha256').update(value).digest('hex')
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
// Resolve within the caller's transaction, preserving the shared facility/task locks.
export async function i9DifferentSupplementBasis(db,ctx,taskId){
 const current=await i9DifferentDocumentsBasis(db,ctx,taskId)
 if(current.receipt.sourceKind!=='SUPPLEMENT_B')throw fail('Use the new Section 2 replacement workflow for an initial receipt.')
 const sourceSignatureId=current.row.followup_row_key.slice('SUPPLEMENT:'.length)
 const source=current.previousSupplements.find(p=>String(p.signatureId)===sourceSignatureId)
 if(!source||String(source.documentId)!==String(current.receipt.documentId)||source.sha256!==current.receipt.sha256)throw fail('The receipt follow-up does not match its retained signed supplement.')
 return {...current,receiptSignatureId:sourceSignatureId,basisHash:hash(JSON.stringify({sourceBasisHash:current.basisHash,receiptSignatureId:sourceSignatureId,receiptDocumentId:source.documentId,receiptSha256:source.sha256}))}
}
export async function i9DifferentSupplementContext(db,ctx,taskId){
 const current=await i9DifferentSupplementBasis(db,ctx,taskId)
 const clock=(await db.query('SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0]
 return {signatureId:current.row.id,receiptSignatureId:current.receiptSignatureId,sourceKind:'SUPPLEMENT_B',dueOn:current.row.due_on,today:clock.today,originalExaminedOn:current.receipt.examination.examinedOn,retainedHiringContext:{attestationKind:current.retained.context.attestationKind,...current.examinationContext}}
}
export async function prepareI9DifferentSupplement(db,ctx,taskId,body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['signatureId','supplement','reason','initials'].includes(key)))throw fail('Use the supported replacement supplement preparation fields.',400)
 const current=await i9DifferentSupplementBasis(db,ctx,taskId)
 if(String(body.signatureId)!==String(current.row.id))throw fail('Reload the current employer certification before replacing its supplement receipt.')
 const clock=(await db.query('SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0]
 const rendered=await renderI9DifferentSupplementPreview(current.bytes,current.receipt.bytes,{supplement:body.supplement,reason:body.reason,initials:body.initials,recordedOn:clock.today})
 if(rendered.sourceEmployerSha256!==current.row.content_sha256||rendered.sourceSupplementSha256!==current.receipt.sha256)throw fail('The replacement supplement does not match its verified signed sources.')
 return {current,...rendered,recordedOn:clock.today,previewSha256:hash(rendered.pdf)}
}
