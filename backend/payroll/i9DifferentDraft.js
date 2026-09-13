import {createHash} from 'node:crypto'
import {i9DifferentDocumentsBasis} from './i9DifferentDocumentsBasis.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const object=(value,keys)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw fail('Use supported draft fields; signatures and signing confirmations cannot be saved.',400);return value}
const formKeys=['choice','method','businessName','businessAddress','representative','reason','initials','notes']
const factKeys=['examinedOn','identity','physical','short','closures','late','indefinite','authorizationThrough','authorizationEvidence','qualification','video']
const decisionKeys=['acceptance','ruleSource','ruleEvidence','validUntil','formNotation','followUpKind','followUpOn']
const choices={choice:['','LIST_A','LIST_B_C'],method:['','PHYSICAL','ALTERNATIVE'],physical:['','yes','no'],short:['','yes','no'],indefinite:['','yes','no'],acceptance:['','STANDARD','EXTENSION','OTHER_ACCEPTABLE'],followUpKind:['','NONE','REVERIFICATION','OTHER']}
const fields=(value,keys)=>Object.fromEntries(Object.entries(object(value??{},keys)).map(([key,value])=>{
 const max=key==='initials'?20:key==='reason'?500:key==='notes'||key==='formNotation'?1000:['title'].includes(key)?150:['number'].includes(key)?100:['businessName','businessAddress','representative','issuingAuthority'].includes(key)?200:2000
 if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value)||choices[key]&&!choices[key].includes(value))throw fail('Review the unfinished replacement entries.',400)
 return [key,value.normalize('NFC')]
}))
export function i9DifferentDraftInput(raw){
 const b=object(raw,['form','facts']),form=object(b.form??{},[...formKeys,'listA','listB','listC']),facts=object(b.facts??{},['fields','days','decisions'])
 const doc=value=>fields(value,['title','issuingAuthority','number','expiresOn'])
 if(form.listA!==undefined&&(!Array.isArray(form.listA)||form.listA.length>3))throw fail('Retain at most three List A entries.',400)
 const {listA,listB,listC,...common}=form,days=facts.days??[]
 if(!Array.isArray(days)||days.some(n=>!Number.isInteger(n)||n<0||n>6)||new Set(days).size!==days.length)throw fail('Review employer business days.',400)
 const decisions=object(facts.decisions??{},['A1','A2','A3','B','C'])
 return {form:{...fields(common,formKeys),listA:(listA??[]).map(doc),listB:doc(listB),listC:doc(listC)},facts:{fields:fields(facts.fields,factKeys),days:[...days].sort(),decisions:Object.fromEntries(Object.entries(decisions).map(([key,value])=>[key,fields(value,decisionKeys)]))}}
}
const aad=(ctx,taskId)=>`i9-different-draft:${ctx.facility}:${ctx.employee}:${taskId}:${ctx.admin}`
async function state(db,ctx,taskId){
 const current=await i9DifferentDocumentsBasis(db,ctx,taskId),id=current.row.compliance_task_id
 if(current.receipt.sourceKind!=='SECTION2')throw fail('Use the Supplement B replacement workflow for this receipt.')
 const saved=(await db.query('SELECT * FROM payroll_i9_different_draft WHERE compliance_task_id=$1 AND actor_user_id=$2',[id,ctx.admin])).rows[0]
 const valid=saved?.basis_hash===current.basisHash
 return {current,saved,id,result:{revision:saved?.revision||0,basisHash:current.basisHash,draft:valid?JSON.parse(decryptDocument(saved.encrypted_draft,aad(ctx,id)).toString()):null,savedAt:valid?saved.updated_at:null,invalidated:!!saved&&!valid}}
}
export async function readI9DifferentDraft(db,ctx,taskId){return (await state(db,ctx,taskId)).result}
export async function saveI9DifferentDraft(db,ctx,taskId,body){
 object(body,['draft','basisHash','expectedRevision','requestKey'])
 const {current,saved,id,result}=await state(db,ctx,taskId)
 if(body.basisHash!==current.basisHash)throw fail('The source I-9 evidence changed. Reload the draft before saving.')
 if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Reload the draft and use a unique save key.',400)
 const draft=i9DifferentDraftInput(body.draft),requestHash=hash({draft,basisHash:current.basisHash,expectedRevision:body.expectedRevision})
 if(saved?.request_key===body.requestKey.toLowerCase()){if(saved.request_hash!==requestHash)throw fail('This save key was used for different draft entries.');return result}
 if(body.expectedRevision!==result.revision)throw fail('Another tab saved newer entries. Reload before saving.')
 const next=(await db.query(`INSERT INTO payroll_i9_different_draft(facility_id,employee_id,compliance_task_id,signature_id,actor_user_id,basis_hash,revision,encrypted_draft,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,1,$7,$8,$9) ON CONFLICT(compliance_task_id,actor_user_id) DO UPDATE SET basis_hash=EXCLUDED.basis_hash,revision=payroll_i9_different_draft.revision+1,encrypted_draft=EXCLUDED.encrypted_draft,request_key=EXCLUDED.request_key,request_hash=EXCLUDED.request_hash,updated_at=clock_timestamp() RETURNING revision,updated_at`,[ctx.facility,ctx.employee,id,current.row.id,ctx.admin,current.basisHash,encryptDocument(Buffer.from(JSON.stringify(draft)),aad(ctx,id)),body.requestKey,requestHash])).rows[0]
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_DIFFERENT_DRAFT_SAVED','compliance_task',$3,$4)",[ctx.facility,ctx.admin,String(id),{employeeId:ctx.employee,signatureId:current.row.id,revision:next.revision}])
 return {revision:next.revision,basisHash:current.basisHash,draft,savedAt:next.updated_at,invalidated:false}
}
