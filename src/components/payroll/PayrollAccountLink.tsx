import {useEffect,useState} from 'react'
import {employeePayrollApi} from '../../utils/employeePayrollApi'

export default function PayrollAccountLink({mode,facilityId,onSignedIn}:{mode:'link'|'login';facilityId?:number;onSignedIn?:()=>Promise<void>}) {
  const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[workplace,setWorkplace]=useState(String(facilityId||1))
  const [identity,setIdentity]=useState<{accountToken:string;email:string}|null>(null)
  const [linked,setLinked]=useState<{linked:boolean;email:string|null}|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  useEffect(()=>{
    if(mode!=='link')return
    let live=true
    void employeePayrollApi.accountLink().then(value=>{if(live)setLinked(value)}).catch(e=>{if(live)setError(e.message)})
    return()=>{live=false}
  },[mode])
  return <section aria-label="Existing Vortex account" className="rounded-2xl border border-slate-200 bg-white p-5 text-left">
    <h2 className="text-lg font-bold">{mode==='link'?'Link your existing Vortex account':'Sign in with your linked Vortex account'}</h2>
    {error?<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>:null}
    {linked?.linked?<p role="status" className="mt-3 text-sm text-emerald-800">Linked to {linked.email}. You can return using that Vortex account and workplace {facilityId}.</p>:<>
      <p className="mt-2 text-sm text-slate-600">{mode==='link'?'Already have a member, coach, or admin login? Verify it below, then confirm the link. Your payroll records stay separate from family accounts.':'Use the account you linked after opening your hiring invitation. New hires must open their invitation and link the account first.'}</p>
      {identity?<div className="mt-3 space-y-3"><p className="text-sm">Link <strong>{identity.email}</strong> to this employee payroll profile?</p><button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 font-bold text-white" onClick={async()=>{
        setBusy(true);setError('')
        try{setLinked(await employeePayrollApi.linkAccount(identity.accountToken));setIdentity(null)}catch(e){setError(e instanceof Error?e.message:'Unable to link account.')}finally{setBusy(false)}
      }}>Confirm account link</button><button disabled={busy} className="ml-3 text-sm underline" onClick={()=>setIdentity(null)}>Use a different account</button></div>:<form className="mt-3 space-y-3" onSubmit={async event=>{
        event.preventDefault();setBusy(true);setError('')
        try{
          const account=await employeePayrollApi.verifyExistingAccount(identifier,password)
          setPassword('')
          if(mode==='link')setIdentity(account)
          else{await employeePayrollApi.signInWithAccount(account.accountToken,Number(workplace));await onSignedIn?.()}
        }catch(e){setPassword('');setError(e instanceof Error?e.message:'Unable to sign in.')}finally{setBusy(false)}
      }}>
        <label className="block text-sm font-bold">Vortex email or username<input required autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="block text-sm font-bold">Vortex password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        {mode==='login'?<label className="block text-sm font-bold">Linked account workplace number<input required type="number" min="1" value={workplace} onChange={e=>setWorkplace(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>:null}
        <button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 font-bold text-white">{busy?'Verifying…':mode==='link'?'Verify existing account':'Sign in with Vortex account'}</button>
      </form>}
    </>}
  </section>
}
