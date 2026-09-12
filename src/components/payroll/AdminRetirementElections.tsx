import RetirementParticipantMapping from './RetirementParticipantMapping'
import {useEffect,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
import type {RetirementEmployeePlan} from '../../utils/employeePayrollApi'
import {RetirementElectionHistory} from './EmployeeRetirement'
export default function AdminRetirementElections({employeeId}:{employeeId:number}){
 const [requested,setRequested]=useState(false),[plans,setPlans]=useState<RetirementEmployeePlan[]>([]),[issue,setIssue]=useState(''),[refresh,setRefresh]=useState(0)
 useEffect(()=>{if(!requested)return;let live=true,inFlight=false;const read=async()=>{if(inFlight)return;inFlight=true;try{const r=await adminApiRequest(`/api/admin/payroll/employees/${employeeId}/retirement-elections`),body=await r.json();if(!r.ok||!body.success)throw new Error(body.message||'Unable to read retirement elections.');if(live){setPlans(body.data.plans);setIssue('')}}catch(e){if(live)setIssue(e instanceof Error?e.message:'Unable to read retirement elections.')}finally{inFlight=false}};void read();const timer=setInterval(()=>void read(),30000);return()=>{live=false;clearInterval(timer)}},[employeeId,requested,refresh])
 return <section aria-label="Participant signed retirement elections" className="space-y-3 rounded-xl border bg-white p-4 text-sm"><h3 className="font-bold">Participant signed retirement elections</h3><button type="button" className="rounded border px-3 py-2" onClick={()=>{setRequested(true);setRefresh(value=>value+1)}}>Load signed retirement elections</button>{issue?<p role="alert">{issue} Automatic refresh will retry.</p>:null}{plans.map(plan=><article key={plan.planId} className="space-y-2"><h4 className="font-bold">{plan.planName}</h4><p>{plan.explanation}</p><RetirementElectionHistory plan={plan}/><RetirementParticipantMapping employeeId={employeeId} planId={plan.planId}/>{!plan.history.length?<p>No signed election is retained for this plan.</p>:null}</article>)}</section>
}
