import {useCallback,useEffect,useRef,useState} from 'react'
import {employeePayrollApi,type W4Preview} from '../../utils/employeePayrollApi'
import W4PdfReview from './W4PdfReview'
import officialFormUrl from '../../../backend/payroll/forms/maryland-mw507-2026.pdf?url'
import {emptyMw507,mw507Answers} from '../../utils/mw507Answers'

const input='mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900'
const button='rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40'
const empty=emptyMw507
export default function EmployeeMW507({taskId,cycle,vaultReady,onSubmitted}:{taskId:number;cycle:number;vaultReady:boolean;onSubmitted:()=>Promise<void>}){
 const [form,setForm]=useState(empty),[preview,setPreview]=useState<W4Preview|null>(null),[visited,setVisited]=useState<number[]>([]),[signature,setSignature]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const retry=useRef<Record<string,unknown>|null>(null)
 const draftRetry=useRef<Record<string,unknown>|null>(null)
 const [draftMeta,setDraftMeta]=useState<{revision:number;baseSubmissionId:string|null}>({revision:0,baseSubmissionId:null}),[draftLoaded,setDraftLoaded]=useState(false),[draftReload,setDraftReload]=useState(0)
 useEffect(()=>{let live=true;void employeePayrollApi.readMW507Draft<ReturnType<typeof empty>>(taskId,cycle).then(data=>{if(live){setDraftMeta(data);setForm(data.draft||empty());setDraftLoaded(true);if(data.draft)setNotice('Your saved MW507 draft is ready to continue. It has not been signed.')}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[taskId,cycle,draftReload])
 const saveDraft=async()=>{
  setBusy(true);setError('');setNotice('')
  try{const body=draftRetry.current??{draft:form,expectedRevision:draftMeta.revision,baseSubmissionId:draftMeta.baseSubmissionId,onboardingCycle:cycle,requestKey:crypto.randomUUID()};draftRetry.current=body;const saved=await employeePayrollApi.saveMW507Draft(taskId,body);setDraftMeta(saved);draftRetry.current=null;setNotice('MW507 draft saved securely. You can sign out and resume later. This does not submit or sign the form.')}
  catch(e){setError(e instanceof Error?e.message:'Unable to save the MW507 draft.')}finally{setBusy(false)}
 }

 const change=<K extends keyof ReturnType<typeof empty>>(key:K,value:ReturnType<typeof empty>[K])=>{setForm(current=>({...current,[key]:value}));setError('');setNotice('');retry.current=null;draftRetry.current=null}
 const edit=()=>{setPreview(null);setVisited([]);setConfirmed(false);setSignature('');setError('');retry.current=null}
 const prepare=async()=>{
  setBusy(true);setError('');setNotice('')
  try{
   const answers=mw507Answers(form)
   setPreview(await employeePayrollApi.previewMW507(taskId,{answers,onboardingCycle:cycle}));setVisited([]);setSignature('');setConfirmed(false);retry.current=null
  }catch(e){setError(e instanceof Error?e.message:'Unable to prepare your MW507.')}finally{setBusy(false)}
 }
 const displayed=useCallback(async(page:number)=>{
  if(!preview)return
  await employeePayrollApi.visitMW507Page(taskId,{reviewId:preview.reviewId,previewSha256:preview.previewSha256,onboardingCycle:cycle,page,displayed:true})
  setVisited(current=>current.includes(page)?current:[...current,page])
 },[preview,taskId,cycle])
 const sign=async()=>{
  if(!preview)return
  setBusy(true);setError('')
  try{
   const body=retry.current??{reviewId:preview.reviewId,previewSha256:preview.previewSha256,onboardingCycle:cycle,signature,perjury:preview.perjury,confirmed,reviewedAllPages:visited.length===2,requestKey:crypto.randomUUID()}
   retry.current=body
   await employeePayrollApi.signMW507(taskId,body)
   setForm(empty());setPreview(null);setVisited([]);setSignature('');setConfirmed(false);retry.current=null
   setNotice('Your signed MW507 is saved for hiring-admin review. A copy is available with this step.');setDraftLoaded(false);setDraftReload(value=>value+1)
   await onSubmitted()
  }catch(e){setError(e instanceof Error?e.message:'Unable to save your signature. Retry without changing your entries.')}finally{setBusy(false)}
 }

 const field=(key:keyof ReturnType<typeof empty>,label:string,mode:'text'|'numeric'|'decimal'='text',required=false)=><label className="block text-sm font-semibold">{label}<input className={input} required={required} autoComplete="off" type={key==='ssn'?'password':'text'} inputMode={mode} maxLength={key==='ssn'?11:200} value={String(form[key])} onChange={e=>change(key,e.target.value)}/></label>
 return <section aria-label="Complete MW507 internally" className="mt-4 space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
  <h3 className="text-lg font-bold">Complete your 2026 Maryland MW507 here</h3>
  <p className="text-sm">Enter your details, save unfinished work securely, review both official pages, then sign. Your hiring admin must review the certificate and any required attachments, agreements or Comptroller submissions before applying it to payroll.</p>
  {!vaultReady?<p role="alert" className="text-sm text-amber-900">Your hiring admin must enable secure document storage before you can complete this certificate here.</p>:null}
  {error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>:null}
  {notice?<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>:null}
  <button type="button" disabled={busy||!!preview} className="text-sm font-semibold underline" onClick={()=>{setDraftLoaded(false);setError('');draftRetry.current=null;setDraftReload(value=>value+1)}}>Reload saved MW507 draft (replaces unsaved entries)</button>
  <form autoComplete="off" onSubmit={e=>{e.preventDefault();void prepare()}}>
   <fieldset disabled={busy||!!preview||!vaultReady||!draftLoaded} className="space-y-4 disabled:opacity-80">
    <legend className="font-bold">Employee’s Maryland Withholding Exemption Certificate</legend>
    {field('fullName','Print full name','text',true)}{field('ssn','Social Security number','numeric',true)}{field('address','Street address, city, state and ZIP','text',true)}{field('county','County of residence (nonresidents: Maryland work county or Baltimore City)','text',true)}
    <label className="block text-sm font-semibold">Maryland withholding rate<select className={input} value={form.withholdingRate} required={form.claimKind==='NONE'} onChange={e=>change('withholdingRate',e.target.value)}><option value="">Choose a rate or leave blank for an exempt certificate</option><option value="SINGLE">Single</option><option value="MARRIED">Married (surviving spouse or unmarried Head of Household) Rate</option><option value="MARRIED_SINGLE">Married, but withhold at Single rate</option></select></label>
    {field('exemptions','Line 1: total exemptions claimed','numeric',form.claimKind==='NONE')}
    <p className="text-sm">Do not exceed line f of the worksheet. Complete the worksheet if claiming additional exemptions or if federal AGI will exceed $100,000 for single/separate filers or $150,000 for joint/head-of-household filers. You may claim fewer or zero exemptions.</p>
    {field('additionalWithholdingCents','Line 2: additional withholding per pay period in dollars')}
    <p className="text-sm">Additional withholding requires an agreement with your employer. Entering an amount does not create that agreement.</p>
    <label className="block text-sm font-semibold">Exemption basis<select className={input} value={form.claimKind} onChange={e=>change('claimKind',e.target.value)}><option value="NONE">None — withhold Maryland tax</option><option value="NO_LIABILITY">Line 3 — no Maryland tax liability</option><option value="RECIPROCAL">Line 4 — DC, Virginia or West Virginia domicile</option><option value="PENNSYLVANIA">Lines 5–7 — Pennsylvania domicile</option><option value="MILITARY_SPOUSE">Line 8 — qualifying military spouse</option></select></label>
    {form.claimKind==='NO_LIABILITY'?<div className="space-y-3 text-sm">
     <label className="flex gap-2"><input type="checkbox" checked={form.priorYearNoTax} onChange={e=>change('priorYearNoTax',e.target.checked)}/>Last year I did not owe any Maryland income tax and had a right to a full refund of all income tax withheld.</label>
     <label className="flex gap-2"><input type="checkbox" checked={form.currentYearNoTax} onChange={e=>change('currentYearNoTax',e.target.checked)}/>This year I do not expect to owe any Maryland income tax and expect to have the right to a full refund of all income tax withheld.</label>
     <p>Both statements must apply. Effective year: 2026. A new exemption certificate is due by February 15, 2027. Hiring admins must review the submission requirement if expected wages exceed $200 weekly.</p>
    </div>:null}
    {form.claimKind==='RECIPROCAL'?<label className="block text-sm font-semibold">State of domicile<select className={input} value={form.state} onChange={e=>change('state',e.target.value)}><option value="">Choose your state</option><option value="DC">District of Columbia</option><option value="VA">Virginia</option><option value="WV">West Virginia</option></select></label>:null}
    {['RECIPROCAL','PENNSYLVANIA'].includes(form.claimKind)?<label className="flex gap-2 text-sm"><input type="checkbox" checked={form.noMarylandAbode} onChange={e=>change('noMarylandAbode',e.target.checked)}/>I certify that I do not maintain a place of abode in Maryland as described in the official instructions. Review the 183-day rule and West Virginia exception on page 1.</label>:null}
    {form.claimKind==='PENNSYLVANIA'?<label className="block text-sm font-semibold">Pennsylvania local-tax exemption<select className={input} value={form.localExemption} onChange={e=>change('localExemption',e.target.value)}><option value="NONE">No local exemption — state exemption only</option><option value="YORK_ADAMS">Line 6 — I live in a local jurisdiction within York or Adams counties</option><option value="NO_LOCAL_TAX">Line 7 — my local jurisdiction does not impose earnings or income tax on Maryland residents</option></select></label>:null}
    {form.claimKind==='MILITARY_SPOUSE'?<div className="space-y-3">{field('state','Legal residence state (two-letter code)')}<label className="flex gap-2 text-sm"><input type="checkbox" checked={form.certifiedEligible} onChange={e=>change('certifiedEligible',e.target.checked)}/>I certify that I meet the Servicemembers Civil Relief Act requirements stated on this form and am not subject to Maryland withholding.</label><p className="text-sm">Review all military-spouse requirements on page 1. Attach Form MW507M and a copy of your spousal military identification card using the document upload below. Your admin must review those attachments.</p></div>:null}
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.useWorksheet} onChange={e=>change('useWorksheet',e.target.checked)}/>Complete the Personal Exemptions Worksheet on page 2</label>
    {form.useWorksheet?<div className="space-y-3 rounded-lg border bg-white p-3">
     <p className="text-sm">Enter only exemptions and expenses not claimed at another job or by your spouse. Dependent taxpayers may not claim themselves. The preview calculates lines a–f and checks your line 1 against the maximum; line f drops fractions without rounding up.</p>
     <label className="block text-sm font-semibold">Worksheet tax-return filing group<select className={input} value={form.filingGroup} onChange={e=>change('filingGroup',e.target.value)}><option value="">Select the filing group</option><option value="SINGLE">Single or married filing separately</option><option value="JOINT">Joint, head of household or qualifying surviving spouse</option></select></label>
     {field('agiCents','Estimated federal AGI in dollars','decimal')}{field('personalExemptions','Worksheet line a: personal exemption count','numeric')}{field('agedDependentExemptions','Worksheet line b: additional dependents age 65 or over','numeric')}
     {field('additionalDeductionCents','Worksheet line c: eligible additional deduction amount in dollars','decimal')}
     <p className="text-sm">Line c includes eligible itemized deductions excluding state/local income taxes above the $3,400 standard deduction, plus eligible alimony, childcare, retirement contributions, business losses and employee business expenses. Follow page 2 instructions.</p>
     {field('agedBlindExemptions','Worksheet line d: taxpayer/spouse age 65 or blindness exemption count (0–4)','numeric')}
    </div>:null}
    {!preview?<div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>void saveDraft()}>Save MW507 draft</button><button className={button}>Prepare MW507 for review</button></div>:null}
   </fieldset>
  </form>
  <W4PdfReview key={preview?.reviewId||'official'} formName="MW507" pageCount={2} sourceUrl={officialFormUrl} pdfBase64={preview?.pdfBase64} onDisplayed={preview?displayed:undefined}/>
  {preview?<>
   <button type="button" className="font-bold underline" disabled={busy} onClick={edit}>Edit MW507 answers and restart review</button>
   <p className="text-sm">{visited.length} of 2 pages visited. Review expires at {new Date(preview.expiresAt).toLocaleTimeString()}.</p>
   <form className="space-y-3" onSubmit={e=>{e.preventDefault();void sign()}}>
    <h4 className="font-bold">Sign your Maryland certificate</h4><p className="text-sm">{preview.perjury}</p>
    <label className="flex gap-2 text-sm"><input required disabled={busy||visited.length!==2} type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);retry.current=null}}/>I reviewed both pages and my entries, agree to the declaration above, and intend my typed name to electronically sign this MW507.</label>
    <label className="block text-sm font-semibold">Employee’s MW507 signature<input className={input} required disabled={busy||!confirmed||visited.length!==2} autoComplete="off" maxLength={200} value={signature} onChange={e=>{setSignature(e.target.value);retry.current=null}}/></label>
    <button className={button} disabled={busy||visited.length!==2||!confirmed||!signature.trim()}>Sign and submit MW507</button>
   </form>
  </>:null}
 </section>
}
