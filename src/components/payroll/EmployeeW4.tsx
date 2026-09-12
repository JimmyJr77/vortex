import {useCallback,useEffect,useRef,useState} from 'react'
import {employeePayrollApi,type W4Preview} from '../../utils/employeePayrollApi'
import W4PdfReview from './W4PdfReview'
import wording from './w4OfficialWording2026.json'

const input='mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900'
const button='rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40'
const empty=()=>({firstNameMiddleInitial:'',lastName:'',address:'',cityStateZip:'',ssn:'',filingStatus:'',twoJobs:false,exempt:false,nonresidentAlien:'',qualifyingChildrenCents:'',otherDependentsCents:'',creditsCents:'',otherIncomeCents:'',deductionsCents:'',extraWithholdingCents:''})
const amounts=['qualifyingChildrenCents','otherDependentsCents','creditsCents','otherIncomeCents','deductionsCents','extraWithholdingCents'] as const
type Amount=typeof amounts[number]
function cents(value:string){if(!value.trim())return null;if(!/^\d+(\.\d{1,2})?$/.test(value))throw new Error('Enter dollar amounts with no more than two decimal places.');const [whole,fraction='']=value.split('.'),result=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(result))throw new Error('This dollar amount is too large.');return result}
export default function EmployeeW4({taskId,cycle,vaultReady,onSubmitted}:{taskId:number;cycle:number;vaultReady:boolean;onSubmitted:()=>Promise<void>}){
 const [form,setForm]=useState(empty),[preview,setPreview]=useState<W4Preview|null>(null),[visited,setVisited]=useState<number[]>([]),[signature,setSignature]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const retry=useRef<Record<string,unknown>|null>(null)
 const draftRetry=useRef<Record<string,unknown>|null>(null)
 const [draftMeta,setDraftMeta]=useState<{revision:number;baseSubmissionId:string|null}>({revision:0,baseSubmissionId:null}),[draftLoaded,setDraftLoaded]=useState(false),[draftReload,setDraftReload]=useState(0)
 useEffect(()=>{let live=true;void employeePayrollApi.readW4Draft<ReturnType<typeof empty>>(taskId,cycle).then(data=>{if(live){setDraftMeta(data);setForm(data.draft||empty());setDraftLoaded(true);if(data.draft)setNotice('Your saved W-4 draft is ready to continue. It has not been signed.')}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[taskId,cycle,draftReload])
 const saveDraft=async()=>{
  setBusy(true);setError('');setNotice('')
  try{const body=draftRetry.current??{draft:form,expectedRevision:draftMeta.revision,baseSubmissionId:draftMeta.baseSubmissionId,onboardingCycle:cycle,requestKey:crypto.randomUUID()};draftRetry.current=body;const saved=await employeePayrollApi.saveW4Draft(taskId,body);setDraftMeta(saved);draftRetry.current=null;setNotice('W-4 draft saved securely. You can sign out and resume later. This does not submit or sign the form.')}
  catch(e){setError(e instanceof Error?e.message:'Unable to save the W-4 draft.')}finally{setBusy(false)}
 }

 const change=<K extends keyof ReturnType<typeof empty>>(key:K,value:ReturnType<typeof empty>[K])=>{setForm(current=>({...current,[key]:value}));setError('');setNotice('');retry.current=null;draftRetry.current=null}
 const edit=()=>{setPreview(null);setVisited([]);setConfirmed(false);setSignature('');setError('');retry.current=null}
 const prepare=async()=>{
  setBusy(true);setError('');setNotice('')
  try{
   if(!form.nonresidentAlien)throw new Error('Select whether you are a nonresident alien.')
   const answers={year:2026,personal:Object.fromEntries(['firstNameMiddleInitial','lastName','address','cityStateZip','ssn'].map(k=>[k,form[k as keyof typeof form]])),filingStatus:form.filingStatus||null,twoJobs:form.twoJobs,exempt:form.exempt,nonresidentAlien:form.nonresidentAlien==='YES',...Object.fromEntries(amounts.map(k=>[k,cents(form[k])]))}
   setPreview(await employeePayrollApi.previewW4(taskId,{answers,onboardingCycle:cycle}));setVisited([]);setSignature('');setConfirmed(false);retry.current=null
  }catch(e){setError(e instanceof Error?e.message:'Unable to prepare your W-4.')}finally{setBusy(false)}
 }
 const displayed=useCallback(async(page:number)=>{
  if(!preview)return
  await employeePayrollApi.visitW4Page(taskId,{reviewId:preview.reviewId,previewSha256:preview.previewSha256,onboardingCycle:cycle,page,displayed:true})
  setVisited(current=>current.includes(page)?current:[...current,page])
 },[preview,taskId,cycle])
 const sign=async()=>{
  if(!preview)return
  setBusy(true);setError('')
  try{
   const body=retry.current??{reviewId:preview.reviewId,previewSha256:preview.previewSha256,onboardingCycle:cycle,signature,perjury:preview.perjury,confirmed,reviewedAllPages:visited.length===5,requestKey:crypto.randomUUID()}
   retry.current=body
   await employeePayrollApi.signW4(taskId,body)
   setForm(empty());setPreview(null);setVisited([]);setSignature('');setConfirmed(false);retry.current=null
   setNotice('Your signed W-4 is saved for hiring-admin review. A copy is available with this step.');setDraftLoaded(false);setDraftReload(value=>value+1)
   await onSubmitted()
  }catch(e){setError(e instanceof Error?e.message:'Unable to save your signature. Retry without changing your entries.')}finally{setBusy(false)}
 }
 const money=(key:Amount,label:string)=><label className="block text-sm font-semibold">{label}<input inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" value={form[key]} onChange={e=>change(key,e.target.value)} className={input} placeholder="Leave blank if not applicable" /></label>
 const official=(key:keyof typeof wording)=><p className="whitespace-pre-line text-sm leading-6">{wording[key]}</p>
 return <section aria-label="Complete W-4 internally" className="mt-4 space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
  <div><h3 className="text-lg font-bold">Complete your 2026 W-4 here</h3><p className="mt-1 text-sm">Complete Form W-4 so that your employer can withhold the correct federal income tax from your pay. Give Form W-4 to your employer. Your withholding is subject to review by the IRS.</p><p className="mt-2 text-sm">Enter your information, review all five pages, then sign. Use Save W-4 draft to keep unfinished entries securely and return later. Drafts are not signed or submitted.</p></div>
  {!vaultReady?<p role="alert" className="text-sm text-amber-900">Your hiring admin must enable secure document storage before you can complete this form here.</p>:null}
  {error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>:null}
  {notice?<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>:null}
  <button type="button" disabled={busy||!!preview} className="text-sm font-semibold underline" onClick={()=>{setDraftLoaded(false);setError('');draftRetry.current=null;setDraftReload(value=>value+1)}}>Reload saved draft (replaces unsaved entries)</button>
  <form autoComplete="off" onSubmit={e=>{e.preventDefault();void prepare()}}>
   <fieldset disabled={busy||!!preview||!vaultReady||!draftLoaded} className="space-y-5 disabled:opacity-80">
    <legend className="font-bold">Step 1: Enter Personal Information</legend>
    <div className="grid gap-3 sm:grid-cols-2">{([['firstNameMiddleInitial','First name and middle initial'],['lastName','Last name'],['address','Address'],['cityStateZip','City or town, state, and ZIP code'],['ssn','Social security number']] as const).map(([key,label])=><label key={key} className="block text-sm font-semibold">{label}<input required type={key==='ssn'?'password':'text'} inputMode={key==='ssn'?'numeric':undefined} autoComplete="off" maxLength={key==='ssn'?11:200} value={form[key]} onChange={e=>change(key,e.target.value)} className={input}/></label>)}</div>
    {official('identity')}
    <label className="block text-sm font-semibold">Step 1(c): Filing status<select required={!form.exempt} value={form.filingStatus} onChange={e=>change('filingStatus',e.target.value)} className={input}><option value="">Leave blank only if claiming exemption</option><option value="SINGLE">Single or Married filing separately</option><option value="MARRIED">Married filing jointly or Qualifying surviving spouse</option><option value="HEAD_OF_HOUSEHOLD">Head of household</option></select></label>
    {official('filing')}
    <a className="text-sm font-bold underline" href="https://www.irs.gov/W4App" target="_blank" rel="noreferrer">Open IRS withholding estimator</a>
    <h4 className="font-bold">Step 2: Multiple Jobs or Spouse Works</h4>
    {official('multipleJobs')}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.twoJobs} onChange={e=>change('twoJobs',e.target.checked)}/><span>{wording.twoJobs}</span></label>
    {official('oneJob')}
    <h4 className="font-bold">Step 3: Claim Dependent and Other Credits</h4>
    {official('credits')}
    {money('qualifyingChildrenCents','Step 3(a): Qualifying children amount in dollars')}
    {money('otherDependentsCents','Step 3(b): Other dependents amount in dollars')}
    {official('totalCredits')}
    {money('creditsCents','Step 3: Total credits in dollars')}
    <h4 className="font-bold">Step 4: Other Adjustments</h4>
    {official('otherIncome')}{money('otherIncomeCents','Step 4(a): Other income in dollars')}
    {official('deductions')}{money('deductionsCents','Step 4(b): Deductions in dollars')}
    {official('extra')}{money('extraWithholdingCents','Step 4(c): Extra withholding in dollars')}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.exempt} onChange={e=>change('exempt',e.target.checked)}/><span>Exempt from withholding: {wording.exempt}</span></label>
    {form.exempt?<div className="space-y-2 text-sm"><p>For exemption, leave filing status and Steps 2–4 blank, as the official instructions require.</p><button type="button" className="font-bold underline" onClick={()=>{draftRetry.current=null;setForm(current=>({...current,filingStatus:'',twoJobs:false,...Object.fromEntries(amounts.map(k=>[k,'']))}))}}>Clear filing status and Steps 2–4 for exemption</button></div>:null}
    <label className="block text-sm font-semibold">Are you a nonresident alien?<select required value={form.nonresidentAlien} onChange={e=>change('nonresidentAlien',e.target.value)} className={input}><option value="">Select an answer</option><option value="NO">No</option><option value="YES">Yes</option></select></label>
    <p className="text-sm">Nonresident aliens: review the special instructions on page 2 before completing this form.</p>
    {!preview?<div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>void saveDraft()}>Save W-4 draft</button><button className={button}>Prepare W-4 for review</button></div>:null}
   </fieldset>
  </form>
  <W4PdfReview key={preview?.reviewId||'official'} pdfBase64={preview?.pdfBase64} onDisplayed={preview?displayed:undefined}/>
  {preview?<>
   <button type="button" className="font-bold underline" disabled={busy} onClick={edit}>Edit answers and restart review</button>
   <p className="text-sm">{visited.length} of 5 pages visited. This review expires at {new Date(preview.expiresAt).toLocaleTimeString()}.</p>
   <form className="space-y-3" onSubmit={e=>{e.preventDefault();void sign()}}>
    <h4 className="font-bold">Step 5: Sign Here</h4><p className="text-sm">{preview.perjury}</p>
    <label className="flex items-start gap-2 text-sm"><input required disabled={busy||visited.length!==5} type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);retry.current=null}}/>I have reviewed all five pages and my entries. I agree to the declaration above and intend my typed name to electronically sign this W-4.</label>
    <label className="block text-sm font-semibold">Employee’s signature (This form is not valid unless you sign it.)<input required disabled={busy||!confirmed||visited.length!==5} autoComplete="off" maxLength={200} value={signature} onChange={e=>{setSignature(e.target.value);retry.current=null}} className={input}/></label>
    <button className={button} disabled={busy||visited.length!==5||!confirmed||!signature.trim()}>Sign and submit W-4</button>
   </form>
  </>:null}
 </section>
}
