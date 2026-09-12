import {useState} from 'react'
export default function PayCalendarGenerator({busy,onGenerate}:{busy:boolean;onGenerate:(year:number,month:number)=>Promise<unknown>}){
 const [month,setMonth]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`})
 const valid=/^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&Number(month.slice(0,4))>=2000&&Number(month.slice(0,4))<=2200
 return <form className="flex flex-wrap items-end gap-2" onSubmit={event=>{event.preventDefault();if(valid)void onGenerate(Number(month.slice(0,4)),Number(month.slice(5)))}}><label className="text-sm font-semibold text-slate-700">Pay calendar month<input type="month" required min="2000-01" max="2200-12" value={month} onChange={event=>setMonth(event.target.value)} className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"/></label><button type="submit" disabled={busy||!valid} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Generate pay periods</button></form>
}
