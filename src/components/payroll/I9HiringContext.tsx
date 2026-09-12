import {useEffect,useState} from 'react'
import {workforceApi,type I9HiringContext as Context} from '../../utils/workforceApi'
export default function I9HiringContext({employeeId,taskId,cycle}:{employeeId:number;taskId:number;cycle:number}){
 const [data,setData]=useState<Context|null>(null),[date,setDate]=useState(''),[participation,setParticipation]=useState(''),[evidence,setEvidence]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0)
 const apply=(value:Context)=>{setData(value);setDate(value.current?.offerAcceptedOn||'');setParticipation(value.current?String(value.current.eVerify):'');setEvidence(value.current?.evidence||'');setConfirmed(false)}
 useEffect(()=>{let live=true;void workforceApi.i9Context(employeeId,taskId,cycle).then(value=>{if(live)apply(value)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[employeeId,taskId,cycle,reload])
 const save=async()=>{if(!data)return;setBusy(true);setError('');setNotice('');try{apply(await workforceApi.saveI9Context(employeeId,taskId,{onboardingCycle:cycle,expectedRevision:data.revision,offerAccepted:confirmed,offerAcceptedOn:date,eVerify:participation==='true',evidence}));setNotice('I-9 hiring context recorded. Employee and employer signatures are still required.')}catch(e){setError(e instanceof Error?e.message:'Unable to save I-9 context.')}finally{setBusy(false)}}
 const input='mt-1 block w-full rounded border border-slate-300 p-2'
 return <section aria-label="I-9 hiring context" className="my-4 space-y-3 rounded-xl border border-slate-300 p-4">
  <h3 className="font-bold">Hiring-admin I-9 preparation</h3>
  <p className="text-sm">Record the accepted offer and verify whether this employer and hiring site participate in E-Verify. These facts determine the preparation requirements; it does not enroll the employer, create an E-Verify case, or complete document examination.</p>
  {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  <button type="button" disabled={busy} className="underline" onClick={()=>{setData(null);setError('');setNotice('');setReload(v=>v+1)}}>Reload I-9 hiring context (replaces unsaved entries)</button>
  <form onSubmit={e=>{e.preventDefault();void save()}}><fieldset disabled={busy||!data} className="space-y-3">
   <label className="block">Offer accepted on<input type="date" required className={input} value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label className="block">Employer and hiring-site E-Verify participation<select required className={input} value={participation} onChange={e=>setParticipation(e.target.value)}><option value="">Select verified status</option><option value="true">Participating</option><option value="false">Not participating</option></select></label>
   <label className="block">Offer and participation verification evidence<textarea required minLength={12} maxLength={2000} className={input} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
   <p className="text-sm">Use record references and the basis for the hiring-site determination. Do not put employee identity-document numbers here.</p>
   <label className="block"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I verified that this employee accepted an employment offer and checked the employer’s participation status.</label>
   <button disabled={!confirmed||!date||!participation} className="rounded bg-slate-950 px-3 py-2 font-bold text-white disabled:opacity-40">Record I-9 hiring context</button>
  </fieldset></form>
  {data?.history.length?<details><summary>Hiring context history ({data.history.length})</summary><ul>{data.history.map(row=><li key={row.revision} className="my-2 text-sm">Revision {row.revision}: offer accepted {row.offerAcceptedOn}; E-Verify {row.eVerify?'participating':'not participating'}; admin {row.actorUserId}; {row.recordedAt}. Evidence: {row.evidence}</li>)}</ul></details>:null}
 </section>
}
