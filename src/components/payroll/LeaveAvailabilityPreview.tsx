import {useEffect,useState} from 'react'
import {workforceApi} from '../../utils/workforceApi'

export default function LeaveAvailabilityPreview({startDate,endDate,leaveType,requestedMinutes,employeeId,refreshKey}:{startDate:string;endDate:string;leaveType:string;requestedMinutes:number;employeeId?:number;refreshKey?:string}){
 const key=JSON.stringify([startDate,endDate,leaveType,employeeId,refreshKey])
 const [result,setResult]=useState<{key:string;minutes?:number;error?:string}|null>(null)
 useEffect(()=>{
  let current=true
  void workforceApi.leaveAvailability(startDate,endDate,leaveType,employeeId).then(data=>{if(current)setResult({key,minutes:data.availableMinutes})}).catch(error=>{if(current)setResult({key,error:error instanceof Error?error.message:'Unable to check leave availability.'})})
  return ()=>{current=false}
 },[startDate,endDate,leaveType,employeeId,key])
 const shown=result?.key===key?result:null
 return <div className="rounded-xl bg-blue-50 p-3 text-sm sm:col-span-2" aria-live="polite">
  {!shown?<p>Checking leave availability…</p>:shown.error?<p>{shown.error}</p>:<><p className="font-bold">{((shown.minutes??0)/60).toFixed(2)} hours available from {startDate}</p><p className="mt-1">Includes dated credits and existing approved leave and payout commitments. Your admin rechecks availability at approval.</p>{requestedMinutes>(shown.minutes??0)?<p className="mt-1 font-bold">Requested hours exceed the available balance for these dates.</p>:null}</>}
 </div>
}
