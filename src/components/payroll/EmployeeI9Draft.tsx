import {useEffect,useRef,useState} from 'react'
import {employeePayrollApi} from '../../utils/employeePayrollApi'
import W4PdfReview from './W4PdfReview'
import instructionsUrl from '../../../backend/payroll/forms/uscis-i9-instructions-012025.pdf?url'
const labels={lastName:'Last name (family name)',firstName:'First name (given name)',middleInitial:'Middle initial (if any)',otherLastNames:'Other last names used (if any)',address:'Street address',apartment:'Apartment number (if any)',city:'City or town',state:'State',postalCode:'ZIP code',dateOfBirth:'Date of birth (YYYY-MM-DD)',ssn:'Social Security number (if provided)',email:'Email address (optional)',phone:'Telephone number (optional)',aNumber:'USCIS/A-Number',authorizationExpiresOn:'Authorization expiration (YYYY-MM-DD or N/A)',identifierNumber:'Selected identifier number',passportCountry:'Passport country of issuance'}
type TextKey=keyof typeof labels
type Draft=Record<TextKey,string>&{attestationKind:string;identifierKind:string;ssnPending:boolean|null;preparerAssisted:boolean|null}
const empty=():Draft=>({...Object.fromEntries(Object.keys(labels).map(k=>[k,''])) as Record<TextKey,string>,attestationKind:'',identifierKind:'',ssnPending:null,preparerAssisted:null})
const input='mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm'
export default function EmployeeI9Draft({taskId,cycle,vaultReady}:{taskId:number;cycle:number;vaultReady:boolean}){
 const [draft,setDraft]=useState(empty),[meta,setMeta]=useState<{revision:number;baseResponseHash:string}|null>(null),[reload,setReload]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[showInstructions,setShowInstructions]=useState(false)
 const retry=useRef<Record<string,unknown>|null>(null)
 useEffect(()=>{let live=true;void employeePayrollApi.readI9Draft<Draft>(taskId,cycle).then(data=>{if(live){setMeta(data);setDraft(data.draft||empty());if(data.draft)setNotice('Your saved I-9 draft is ready to continue.')}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[taskId,cycle,reload])
 const change=<K extends keyof Draft>(key:K,value:Draft[K])=>{setDraft(current=>({...current,[key]:value}));retry.current=null;setError('');setNotice('')}
 const save=async()=>{
  if(!meta)return;setBusy(true);setError('');setNotice('')
  try{const body=retry.current||{draft,expectedRevision:meta.revision,baseResponseHash:meta.baseResponseHash,onboardingCycle:cycle,requestKey:crypto.randomUUID()};retry.current=body;const result=await employeePayrollApi.saveI9Draft(taskId,body);setMeta(result);retry.current=null;setNotice('I-9 draft saved securely. It has not been signed or submitted.')}
  catch(e){setError(e instanceof Error?e.message:'Unable to save I-9 draft.')}finally{setBusy(false)}
 }
 const field=(key:TextKey)=><label key={key} className="block text-sm font-semibold">{labels[key]}<input autoComplete="off" type={key==='ssn'?'password':'text'} maxLength={key==='ssn'?11:200} className={input} value={draft[key]} onChange={e=>change(key,e.target.value)}/></label>
 const question=(key:'ssnPending'|'preparerAssisted',label:string)=><label className="block text-sm font-semibold">{label}<select className={input} value={draft[key]===null?'':draft[key]?'YES':'NO'} onChange={e=>change(key,e.target.value===''?null:e.target.value==='YES')}><option value="">Not answered yet</option><option value="NO">No</option><option value="YES">Yes</option></select></label>
 return <section aria-label="Internal I-9 draft" className="mt-4 space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
  <h3 className="text-lg font-bold">Prepare your I-9 Section 1</h3>
  <p className="text-sm">Save unfinished information here and return later. Internal signing is still being connected; this draft does not complete your I-9. Use the completed-form upload below if your hiring admin needs the signed form now.</p>
  <p className="text-sm">Complete Section 1 after accepting an offer and no later than your first day. Choose your own acceptable documents for employer verification. Your employer must make the instructions available.</p>
  <button type="button" className="font-semibold underline" onClick={()=>setShowInstructions(value=>!value)}>{showInstructions?'Hide official I-9 instructions':'Read official I-9 instructions here'}</button>
  {showInstructions?<W4PdfReview formName="I-9 instructions" pageCount={8} sourceUrl={instructionsUrl} editionLabel="01/20/25 edition"/>:null}
  {error?<p role="alert" className="text-sm text-red-800">{error}</p>:null}{notice?<p role="status" className="text-sm text-emerald-800">{notice}</p>:null}
  {!vaultReady?<p role="alert">Your hiring admin must enable secure document storage before saving private I-9 details.</p>:null}
  <button type="button" disabled={busy} className="text-sm underline" onClick={()=>{setMeta(null);setError('');setNotice('');retry.current=null;setReload(v=>v+1)}}>Reload saved I-9 draft (replaces unsaved entries)</button>
  <form autoComplete="off" onSubmit={e=>{e.preventDefault();void save()}}><fieldset disabled={busy||!meta||!vaultReady} className="space-y-3 disabled:opacity-50"><legend className="font-bold">Employee information</legend>
   {(Object.keys(labels) as TextKey[]).filter(key=>!['aNumber','authorizationExpiresOn','identifierNumber','passportCountry'].includes(key)).map(field)}
   <p className="text-sm">Leave nonapplicable fields blank. SSN is voluntary unless your employer participates in E-Verify; if you applied and are waiting for it, indicate that below. Do not enter an ITIN. If you have one legal name, enter it as your last name and “Unknown” as your first name.</p>
   {question('ssnPending','Have you applied for an SSN and are waiting to receive it?')}
   <label className="block text-sm font-semibold">Citizenship or immigration attestation<select className={input} value={draft.attestationKind} onChange={e=>change('attestationKind',e.target.value)}><option value="">Choose your attestation</option><option value="CITIZEN">1. A citizen of the United States</option><option value="NONCITIZEN_NATIONAL">2. A noncitizen national of the United States</option><option value="PERMANENT_RESIDENT">3. A lawful permanent resident</option><option value="AUTHORIZED_WORKER">4. An alien authorized to work</option></select></label>
   {draft.attestationKind==='PERMANENT_RESIDENT'?field('aNumber'):null}
   {draft.attestationKind==='AUTHORIZED_WORKER'?<>{field('authorizationExpiresOn')}<label className="block text-sm font-semibold">Identifier alternative<select className={input} value={draft.identifierKind} onChange={e=>change('identifierKind',e.target.value)}><option value="">Choose one</option><option value="A_NUMBER">USCIS/A-Number</option><option value="I94">Form I-94 admission number</option><option value="PASSPORT">Foreign passport and country of issuance</option></select></label>{field('identifierNumber')}{draft.identifierKind==='PASSPORT'?field('passportCountry'):null}</>:null}
   {question('preparerAssisted','Did a preparer or translator assist you with Section 1?')}
   {draft.preparerAssisted?<p className="text-sm">Each assisting preparer or translator must separately complete and sign Supplement A. Saving this answer does not certify their work.</p>:null}
   <button className="rounded-lg bg-slate-950 px-4 py-2 font-bold text-white">Save I-9 draft</button>
  </fieldset></form>
 </section>
}
